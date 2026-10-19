import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { MAX_CATEGORIES_PER_ACCOUNT } from '../src/lib/limits';
import { DEFAULT_CATEGORIES } from '../src/services/default-categories';
import {
  DB_HOOK_TIMEOUT_MS,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  insertUser,
  iso,
  migrationSql,
  NOW,
  type Row,
} from './d1-helpers';

// Migración 0005 (solo datos) aplicada SOBRE datos reales de 0001-0004.
interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: { name: string; queries: string[] }[];
}
const testEnv = env as unknown as TestEnv;
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function dbUntil0004(): Promise<D1Database> {
  await reset();
  const before = testEnv.TEST_MIGRATIONS.filter((m) => m.name < '0005');
  expect(before).toHaveLength(4);
  await applyD1Migrations(testEnv.DB, before as never);
  return testEnv.DB;
}

// Aplica la 0005 por el mecanismo real de migraciones.
const apply0005 = (db: D1Database) => applyD1Migrations(db, testEnv.TEST_MIGRATIONS as never);

// Reejecuta el SQL de la 0005 a mano (idempotencia: d1_migrations ya la registró).
async function rerun0005(db: D1Database): Promise<void> {
  const migration = testEnv.TEST_MIGRATIONS.find((m) => m.name.startsWith('0005'))!;
  for (const query of migration.queries) await db.prepare(query).run();
}

const rows = async (db: D1Database, sql: string, ...binds: unknown[]): Promise<Row[]> =>
  (
    await db
      .prepare(sql)
      .bind(...binds)
      .all<Row>()
  ).results;
const dump = (db: D1Database, table: string) => rows(db, `SELECT * FROM ${table} ORDER BY id`);

async function concOf(db: D1Database, accountId: string): Promise<Row[]> {
  return rows(
    db,
    `SELECT * FROM categories WHERE account_id = ?1 AND nombre = 'Conciliación' ORDER BY tipo`,
    accountId,
  );
}
const countOf = async (db: D1Database, accountId: string): Promise<number> =>
  (
    await db
      .prepare('SELECT count(*) AS n FROM categories WHERE account_id = ?1')
      .bind(accountId)
      .first<{ n: number }>()
  )?.n ?? -1;

// Cuenta con `n` categorías de relleno (alternando tipo), sin usar el nombre Conciliación.
async function accountWith(db: D1Database, userId: string, n: number): Promise<string> {
  const id = await insertAccount(db, userId);
  for (let i = 0; i < n; i += 1) {
    await insertCategory(db, id, { nombre: `Relleno ${i}`, tipo: i % 2 ? 'ingreso' : 'egreso' });
  }
  return id;
}

describe('migración 0005: Conciliación en cuentas existentes', () => {
  it(
    'agrega una Conciliación de egreso y una de ingreso con los valores del catálogo',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const acc = await accountWith(db, user, 3);
      await apply0005(db);
      const found = await concOf(db, acc);
      expect(found.map((r) => r.tipo)).toEqual(['egreso', 'ingreso']);
      for (const row of found) {
        expect(row).toMatchObject({
          descripcion: null,
          icono: 'exchange',
          color: '#6366F1',
          archivada: 0,
        });
        expect(row.id).toMatch(V4);
        expect(row.created_at).toMatch(TS);
        expect(row.updated_at).toBe(row.created_at);
      }
      expect(found[0]!.id).not.toBe(found[1]!.id);
      expect(await countOf(db, acc)).toBe(5);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'cuenta sin categorías y cuenta archivada también la reciben; ids distintos entre cuentas',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const empty = await insertAccount(db, user);
      const archived = await insertAccount(db, user, { nombre: 'Vieja', archivada: 1 });
      await apply0005(db);
      expect(await countOf(db, empty)).toBe(2);
      expect(await countOf(db, archived)).toBe(2);
      const ids = await rows(db, 'SELECT id FROM categories');
      expect(new Set(ids.map((r) => r.id)).size).toBe(4);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'no duplica equivalentes: tilde, sin tilde, mayúsculas, NFD y otras tildes, también archivadas',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const names = [
        'Conciliación',
        'Conciliacion',
        'CONCILIACIÓN',
        'conciliación',
        'Conciliación',
        'CONCILIACIÓN',
        'Concilíacion',
        'Conciliacíón',
        'Cónciliación',
      ];
      const created: string[] = [];
      for (const [index, nombre] of names.entries()) {
        const acc = await insertAccount(db, user, { nombre: `Cuenta ${index}` });
        await insertCategory(db, acc, { nombre, tipo: 'egreso', archivada: index % 2 });
        await insertCategory(db, acc, { nombre, tipo: 'ingreso', archivada: (index + 1) % 2 });
        created.push(acc);
      }
      const before = await dump(db, 'categories');
      await apply0005(db);
      // «Cónciliación» no equivale a «Conciliación» salvo por tildes: también se normaliza (ó = o).
      expect(await dump(db, 'categories')).toEqual(before);
      for (const acc of created) expect(await countOf(db, acc)).toBe(2);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'una categoría renombrada no cuenta; una con otro nombre parecido se deja intacta',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const acc = await insertAccount(db, user);
      const renamed = await insertCategory(db, acc, { nombre: 'Ajustes', tipo: 'egreso' });
      const similar = await insertCategory(db, acc, {
        nombre: 'Conciliación bancaria',
        tipo: 'ingreso',
      });
      const before = await dump(db, 'categories');
      await apply0005(db);
      const after = await dump(db, 'categories');
      expect(after.filter((r) => before.some((b) => b.id === r.id))).toEqual(before);
      expect(after).toHaveLength(4);
      expect((await concOf(db, acc)).map((r) => r.tipo)).toEqual(['egreso', 'ingreso']);
      expect(renamed).toBeTruthy();
      expect(similar).toBeTruthy();
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'si solo existe un tipo, agrega únicamente el otro',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const onlyEgreso = await insertAccount(db, user, { nombre: 'A' });
      const onlyIngreso = await insertAccount(db, user, { nombre: 'B' });
      const existingE = await insertCategory(db, onlyEgreso, {
        nombre: 'Conciliación',
        tipo: 'egreso',
        icono: 'tag',
        color: '#111111',
      });
      const existingI = await insertCategory(db, onlyIngreso, {
        nombre: 'conciliacion',
        tipo: 'ingreso',
        archivada: 1,
      });
      await apply0005(db);
      const a = await concOf(db, onlyEgreso);
      expect(a.map((r) => [r.tipo, r.id === existingE])).toEqual([
        ['egreso', true],
        ['ingreso', false],
      ]);
      expect(a[0]).toMatchObject({ icono: 'tag', color: '#111111' });
      const nombresB = await rows(
        db,
        'SELECT nombre, tipo FROM categories WHERE account_id = ?1 ORDER BY tipo',
        onlyIngreso,
      );
      expect(nombresB).toEqual([
        { nombre: 'Conciliación', tipo: 'egreso' },
        { nombre: 'conciliacion', tipo: 'ingreso' },
      ]);
      expect(existingI).toBeTruthy();
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'respeta el máximo de 60 (cuentas con 58, 59 y 60; entra primero el egreso)',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const a58 = await accountWith(db, user, MAX_CATEGORIES_PER_ACCOUNT - 2);
      const a59 = await accountWith(db, user, MAX_CATEGORIES_PER_ACCOUNT - 1);
      const a60 = await accountWith(db, user, MAX_CATEGORIES_PER_ACCOUNT);
      await apply0005(db);
      expect((await concOf(db, a58)).map((r) => r.tipo)).toEqual(['egreso', 'ingreso']);
      expect(await countOf(db, a58)).toBe(60);
      expect((await concOf(db, a59)).map((r) => r.tipo)).toEqual(['egreso']);
      expect(await countOf(db, a59)).toBe(60);
      expect(await concOf(db, a60)).toEqual([]);
      expect(await countOf(db, a60)).toBe(60);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'cuenta las categorías archivadas para el máximo',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const acc = await insertAccount(db, user);
      for (let i = 0; i < MAX_CATEGORIES_PER_ACCOUNT; i += 1) {
        await insertCategory(db, acc, { nombre: `Arch ${i}`, archivada: 1 });
      }
      await apply0005(db);
      expect(await countOf(db, acc)).toBe(60);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'respeta el aislamiento: cada cuenta de cada usuario recibe lo suyo y nada se cruza',
    async () => {
      const db = await dbUntil0004();
      const u1 = await insertUser(db, { email: 'a@example.com' });
      const u2 = await insertUser(db, { email: 'b@example.com' });
      const a1 = await accountWith(db, u1, 2);
      const a2 = await accountWith(db, u2, 2);
      const a3 = await insertAccount(db, u2, { nombre: 'Otra' });
      await insertCategory(db, a3, { nombre: 'Conciliación', tipo: 'egreso' });
      await apply0005(db);
      for (const acc of [a1, a2])
        expect((await concOf(db, acc)).map((r) => r.tipo)).toEqual(['egreso', 'ingreso']);
      expect((await concOf(db, a3)).map((r) => r.tipo)).toEqual(['egreso', 'ingreso']);
      const crossed = await rows(
        db,
        `SELECT c.id FROM categories c JOIN accounts a ON a.id = c.account_id
          WHERE c.nombre = 'Conciliación' AND a.user_id NOT IN (?1, ?2)`,
        u1,
        u2,
      );
      expect(crossed).toEqual([]);
      expect(await countOf(db, a1)).toBe(4);
      expect(await countOf(db, a2)).toBe(4);
      expect(await countOf(db, a3)).toBe(2);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'deja intactas las demás filas, los movimientos y los saldos; es idempotente',
    async () => {
      const db = await dbUntil0004();
      const user = await insertUser(db);
      const acc = await insertAccount(db, user, { saldo_inicial: 5000 });
      const exp = await insertCategory(db, acc, { nombre: 'Comida', tipo: 'egreso' });
      const inc = await insertCategory(db, acc, { nombre: 'Sueldo', tipo: 'ingreso' });
      await insertTransactionRow(db, acc, exp, { monto: 1234 });
      await insertTransactionRow(db, acc, inc, {
        tipo: 'ingreso',
        monto: 99,
        deleted_at: iso(NOW),
      });
      const balanceSql = `SELECT a.saldo_inicial + coalesce(sum(CASE t.tipo WHEN 'ingreso' THEN t.monto ELSE -t.monto END), 0) AS saldo
                          FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL GROUP BY a.id`;
      const snap = async () => ({
        users: await dump(db, 'users'),
        accounts: await dump(db, 'accounts'),
        tx: await dump(db, 'transactions'),
        tokens: await dump(db, 'refresh_tokens'),
        categories: await dump(db, 'categories'),
        saldo: await rows(db, balanceSql),
      });
      const before = await snap();
      await apply0005(db);
      const after = await snap();
      expect({ ...after, categories: undefined }).toEqual({ ...before, categories: undefined });
      expect(after.categories.filter((r) => before.categories.some((b) => b.id === r.id))).toEqual(
        before.categories,
      );
      expect(after.categories).toHaveLength(4);
      expect(after.saldo).toEqual([{ saldo: 5000 - 1234 }]);

      await rerun0005(db);
      await rerun0005(db);
      expect(await snap()).toEqual(after);
      expect(await rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it('es solo de datos: sin DDL, PRAGMA ni transacciones; solo dos INSERT en categories', () => {
    const sql = migrationSql('0005')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sql).not.toMatch(
      /\b(CREATE|ALTER|DROP|PRAGMA|BEGIN|COMMIT|UPDATE|DELETE|TRIGGER|INDEX)\b/i,
    );
    expect(sql.match(/\bINSERT INTO\b/gi)).toHaveLength(2);
    expect(sql.match(/INSERT INTO categories\b/g)).toHaveLength(2);
    expect(sql).not.toMatch(/abs\s*\(\s*random/i);
  });

  it('coincide con las entradas Conciliación de DEFAULT_CATEGORIES (sin deriva)', () => {
    const sql = migrationSql('0005');
    const found = [
      ...sql.matchAll(
        /a\.id, '([^']+)', NULL, '(ingreso|egreso)', '([^']+)', '(#[0-9A-F]{6})', 0,/g,
      ),
    ].map((m) => ({ nombre: m[1], tipo: m[2], icono: m[3], color: m[4] }));
    const expected = DEFAULT_CATEGORIES.filter((c) => c.nombre === 'Conciliación').map((c) => ({
      ...c,
    }));
    expect(expected).toHaveLength(2);
    expect(found).toHaveLength(2);
    expect([...found].sort((x, y) => String(x.tipo).localeCompare(String(y.tipo)))).toEqual(
      [...expected].sort((x, y) => x.tipo.localeCompare(y.tipo)),
    );
    // Cada INSERT guarda por su propio tipo.
    for (const tipo of ['ingreso', 'egreso']) {
      expect(sql).toContain(`c.account_id = a.id AND c.tipo = '${tipo}'`);
    }
    expect(sql).toContain('< 60');
    expect(MAX_CATEGORIES_PER_ACCOUNT).toBe(60);
  });
});
