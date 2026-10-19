import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_TRANSACTION_AMOUNT_CENTS,
  TRANSACTION_MAX_DATE,
  TRANSACTION_MIN_DATE,
  TRANSACTION_NOTE_MAX,
} from '../src/lib/limits';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  insertUser,
  migrationSql as migrationSqlOf,
  rowOf,
  uuid,
} from './d1-helpers';

// Integración sobre D1 local con el esquema real de api/migrations/0003_transactions.sql.
let db: D1Database;
let userId: string;
let accountId: string;
let categoryId: string;
beforeEach(async () => {
  db = await freshDb();
  userId = await insertUser(db);
  accountId = await insertAccount(db, userId);
  categoryId = await insertCategory(db, accountId);
}, DB_HOOK_TIMEOUT_MS);

const CHECK = /CHECK constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;

const migrationSql = migrationSqlOf('0003_transactions');

describe('migración 0003', () => {
  it('se aplica después de la 0001 y la 0002, en orden, y crea tabla e índices', async () => {
    const { results } = await db
      .prepare('SELECT name FROM d1_migrations ORDER BY id')
      .all<{ name: string }>();
    expect(results.map((row) => row.name.replace(/\.sql$/, ''))).toEqual([
      '0001_users_refresh_tokens',
      '0002_accounts_categories',
      '0003_transactions',
      '0004_account_appearance',
      '0005_default_conciliacion',
    ]);
    const { results: objects } = await db
      .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all<{ name: string }>();
    expect(objects.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'transactions',
        'ix_transactions_account_fecha',
        'ix_transactions_account_category',
      ]),
    );
  });

  it('los índices cubren las columnas del contrato', async () => {
    const columnsOf = async (index: string) =>
      (
        await db.prepare(`SELECT name FROM pragma_index_info('${index}') ORDER BY seqno`).all<{
          name: string;
        }>()
      ).results.map((row) => row.name);
    expect(await columnsOf('ix_transactions_account_fecha')).toEqual(['account_id', 'fecha']);
    expect(await columnsOf('ix_transactions_account_category')).toEqual([
      'account_id',
      'category_id',
    ]);
  });

  it('no define user_id (la propiedad va por accounts) ni BEGIN/COMMIT/PRAGMA', async () => {
    const { results } = await db
      .prepare("SELECT name FROM pragma_table_info('transactions')")
      .all<{ name: string }>();
    expect(results.map((row) => row.name)).not.toContain('user_id');
    expect(migrationSql.replace(/--.*$/gm, '')).not.toMatch(/\b(BEGIN|COMMIT|PRAGMA)\b/i);
  });

  it('los límites del SQL coinciden con limits.ts', () => {
    expect(migrationSql).toContain(`BETWEEN 1 AND ${MAX_TRANSACTION_AMOUNT_CENTS}`);
    expect(migrationSql).toContain(`length(nota) BETWEEN 1 AND ${TRANSACTION_NOTE_MAX}`);
    expect(migrationSql).toContain(
      `BETWEEN '${TRANSACTION_MIN_DATE}' AND '${TRANSACTION_MAX_DATE}'`,
    );
    expect(DEFAULT_TRANSACTIONS_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe('transactions: CHECK', () => {
  it('acepta un movimiento válido con nota y deleted_at nulos por defecto', async () => {
    const id = await insertTransactionRow(db, accountId, categoryId);
    expect(await rowOf(db, 'transactions', id)).toMatchObject({
      tipo: 'gasto',
      monto: 1000,
      nota: null,
      deleted_at: null,
    });
  });

  it.each([
    ['id que no es UUID', { id: 'abc' }],
    ['id con mayúsculas', { id: uuid().toUpperCase() }],
    ['account_id que no es UUID', { account_id: 'abc' }],
    ['category_id que no es UUID', { category_id: 'abc' }],
    ['tipo ajuste', { tipo: 'ajuste' }],
    ['tipo egreso', { tipo: 'egreso' }],
    ['monto 0', { monto: 0 }],
    ['monto negativo', { monto: -1 }],
    ['monto decimal', { monto: 10.5 }],
    ['monto como texto', { monto: 'abc' }],
    ['monto por encima del máximo', { monto: MAX_TRANSACTION_AMOUNT_CENTS + 1 }],
    ['fecha con otro formato', { fecha: '13/10/2026' }],
    ['fecha inexistente 2025-02-30', { fecha: '2025-02-30' }],
    ['fecha 2025-02-29 (no bisiesto)', { fecha: '2025-02-29' }],
    ['fecha anterior al rango', { fecha: '1999-12-31' }],
    ['fecha posterior al rango', { fecha: '2101-01-01' }],
    ['fecha con hora', { fecha: '2026-10-13T00:00' }],
    ['nota vacía', { nota: '' }],
    ['nota con espacios en los extremos', { nota: ' hola' }],
    ['nota de 501 caracteres', { nota: 'n'.repeat(TRANSACTION_NOTE_MAX + 1) }],
    ['deleted_at con otro formato', { deleted_at: '2026-10-13' }],
    ['created_at con otro formato', { created_at: 'ayer' }],
    ['updated_at imposible', { updated_at: '2026-02-30T00:00:00.000Z' }],
  ])('rechaza %s', async (_name, overrides) => {
    await expect(insertTransactionRow(db, accountId, categoryId, overrides)).rejects.toThrow(CHECK);
  });

  it('acepta los extremos: monto 1 y máximo, fechas límite, bisiesto y nota de 500', async () => {
    await insertTransactionRow(db, accountId, categoryId, { monto: 1 });
    await insertTransactionRow(db, accountId, categoryId, { monto: MAX_TRANSACTION_AMOUNT_CENTS });
    await insertTransactionRow(db, accountId, categoryId, { fecha: TRANSACTION_MIN_DATE });
    await insertTransactionRow(db, accountId, categoryId, { fecha: TRANSACTION_MAX_DATE });
    await insertTransactionRow(db, accountId, categoryId, { fecha: '2024-02-29' });
    await insertTransactionRow(db, accountId, categoryId, {
      nota: 'n'.repeat(TRANSACTION_NOTE_MAX),
    });
    await insertTransactionRow(db, accountId, categoryId, {
      tipo: 'ingreso',
      deleted_at: '2026-10-13T12:00:00.000Z',
    });
    expect(await count(db, 'transactions')).toBe(7);
  });
});

describe('transactions: claves foráneas', () => {
  it('exige una cuenta existente', async () => {
    await expect(insertTransactionRow(db, uuid(), categoryId)).rejects.toThrow(FOREIGN_KEY);
  });

  it('exige una categoría existente', async () => {
    await expect(insertTransactionRow(db, accountId, uuid())).rejects.toThrow(FOREIGN_KEY);
  });

  it('category_id es RESTRICT: no se borra una categoría con movimientos (ni anulados)', async () => {
    await insertTransactionRow(db, accountId, categoryId, {
      deleted_at: '2026-10-13T12:00:00.000Z',
    });
    await expect(
      db.prepare('DELETE FROM categories WHERE id = ?1').bind(categoryId).run(),
    ).rejects.toThrow(FOREIGN_KEY);
    expect(await rowOf(db, 'categories', categoryId)).not.toBeNull();
  });

  it('account_id es CASCADE: borrar la cuenta borra sus movimientos y los de otras no', async () => {
    const otherAccount = await insertAccount(db, userId);
    const otherCategory = await insertCategory(db, otherAccount);
    await insertTransactionRow(db, accountId, categoryId);
    const kept = await insertTransactionRow(db, otherAccount, otherCategory);
    // Con CASCADE en ambas cadenas, la cuenta se lleva categorías y movimientos; el RESTRICT de
    // la categoría no bloquea porque sus movimientos desaparecen por la misma cuenta.
    await db.prepare('DELETE FROM accounts WHERE id = ?1').bind(accountId).run();
    expect(await count(db, 'transactions')).toBe(1);
    expect(await rowOf(db, 'transactions', kept)).not.toBeNull();
  });
});
