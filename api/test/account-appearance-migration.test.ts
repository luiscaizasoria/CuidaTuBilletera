import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_COLORS, ACCOUNT_ICONS } from '../src/lib/account-appearance';
import {
  DB_HOOK_TIMEOUT_MS,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  insertUser,
  iso,
  migrationSql,
  NOW,
  plusDays,
  rowOf,
  type Row,
} from './d1-helpers';

// Migración 0004 aplicada SOBRE datos reales de 0001-0003 (no sobre una base vacía).
interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: { name: string; queries: string[] }[];
}
const testEnv = env as unknown as TestEnv;
const CHECK = /CHECK constraint failed/;

async function dbUntil0003(): Promise<D1Database> {
  await reset();
  const before = testEnv.TEST_MIGRATIONS.filter((m) => m.name < '0004');
  expect(before).toHaveLength(3);
  await applyD1Migrations(testEnv.DB, before as never);
  return testEnv.DB;
}

async function dump(db: D1Database, table: string, columns = '*'): Promise<Row[]> {
  const { results } = await db.prepare(`SELECT ${columns} FROM ${table} ORDER BY id`).all<Row>();
  return results;
}

const ALL_TABLES = ['users', 'refresh_tokens', 'accounts', 'categories', 'transactions'];

describe('migración 0004 sobre datos de 0001 a 0003', () => {
  it(
    'añade color e icono NULL sin alterar filas ni updated_at',
    async () => {
      const db = await dbUntil0003();
      const userA = await insertUser(db, { email: 'a@example.com' });
      const userB = await insertUser(db, { email: 'b@example.com' });
      const stamp = iso(plusDays(NOW, -3));
      const accA1 = await insertAccount(db, userA, { saldo_inicial: 5000, updated_at: stamp });
      const accA2 = await insertAccount(db, userA, { nombre: 'Archivada', archivada: 1 });
      const accB = await insertAccount(db, userB, { nombre: 'Ajena' });
      const catA = await insertCategory(db, accA1);
      const catB = await insertCategory(db, accB);
      await insertTransactionRow(db, accA1, catA, { monto: 1234 });
      await insertTransactionRow(db, accA1, catA, {
        tipo: 'ingreso',
        monto: 99,
        deleted_at: iso(NOW),
      });
      await insertTransactionRow(db, accB, catB, { monto: 777 });

      const before: Record<string, Row[]> = {};
      for (const table of ALL_TABLES) before[table] = await dump(db, table);
      expect(before.accounts).toHaveLength(3);

      // Solo hasta la 0004: la 0005 inserta categorías y se prueba en conciliacion-migration.test.ts.
      await applyD1Migrations(db, testEnv.TEST_MIGRATIONS.filter((m) => m.name < '0005') as never);

      for (const table of ALL_TABLES.filter((t) => t !== 'accounts')) {
        expect(await dump(db, table)).toEqual(before[table]);
      }
      const after = await dump(db, 'accounts');
      expect(after).toEqual(before.accounts!.map((row) => ({ ...row, color: null, icono: null })));
      expect((await rowOf(db, 'accounts', accA1))?.updated_at).toBe(stamp);
      expect(await rowOf(db, 'accounts', accA2)).toMatchObject({ archivada: 1, color: null });

      const { results } = await db.prepare('PRAGMA foreign_key_check').all();
      expect(results).toEqual([]);
      const columns = (await db.prepare('PRAGMA table_info(accounts)').all<Row>()).results;
      for (const name of ['color', 'icono']) {
        expect(columns.find((c) => c.name === name)).toMatchObject({
          type: 'TEXT',
          notnull: 0,
          dflt_value: null,
        });
      }
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it('el SQL es aditivo: solo ALTER TABLE accounts ADD COLUMN', () => {
    const sql = migrationSql('0004_account_appearance')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    const statements = sql
      .split(/(?=ALTER TABLE)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(2);
    for (const statement of statements) {
      expect(statement).toMatch(/^ALTER TABLE accounts ADD COLUMN (color|icono) TEXT\b/);
    }
    expect(sql).not.toMatch(/\b(DROP|UPDATE|DELETE|INSERT|PRAGMA|DEFAULT)\b/i);
  });
});

describe('CHECK de forma de color e icono', () => {
  async function accountOn(): Promise<{ db: D1Database; id: string }> {
    const db = await dbUntil0003();
    await applyD1Migrations(db, testEnv.TEST_MIGRATIONS as never);
    const id = await insertAccount(db, await insertUser(db));
    return { db, id };
  }
  const set = (db: D1Database, id: string, column: string, value: unknown) =>
    db.prepare(`UPDATE accounts SET ${column} = ?1 WHERE id = ?2`).bind(value, id).run();

  it.each(['color', 'icono'])(
    '%s acepta NULL e identificadores válidos y rechaza formas inválidas',
    async (column) => {
      const { db, id } = await accountOn();
      for (const ok of [null, 'a', 'piggy-bank', 'x1-2', 'a'.repeat(20)]) {
        await set(db, id, column, ok);
        expect((await rowOf(db, 'accounts', id))?.[column]).toBe(ok);
      }
      for (const bad of [
        '',
        'A',
        'Rosa',
        'limón',
        'con espacio',
        'a_b',
        '#FFFFFF',
        'a'.repeat(21),
        'a\nb',
      ]) {
        await expect(set(db, id, column, bad)).rejects.toThrow(CHECK);
      }
      await expect(set(db, id, column, 5)).rejects.toThrow(CHECK);
      expect((await rowOf(db, 'accounts', id))?.[column]).toBe('a'.repeat(20));
    },
    DB_HOOK_TIMEOUT_MS,
  );

  it(
    'todo el catálogo del enum cumple el CHECK (coherencia CHECK <-> enum)',
    async () => {
      const { db, id } = await accountOn();
      for (const color of ACCOUNT_COLORS) await set(db, id, 'color', color);
      for (const icono of ACCOUNT_ICONS) await set(db, id, 'icono', icono);
      expect(await rowOf(db, 'accounts', id)).toMatchObject({
        color: ACCOUNT_COLORS.at(-1),
        icono: ACCOUNT_ICONS.at(-1),
      });
    },
    DB_HOOK_TIMEOUT_MS,
  );
});
