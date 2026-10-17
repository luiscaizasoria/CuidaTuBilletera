import { beforeEach, describe, expect, it } from 'vitest';
import { categoryHasTransactions } from '../src/db/category-repository';
import {
  findTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
  voidTransaction,
} from '../src/db/transaction-repository';
import { isValidTransactionDate } from '../src/lib/dates';
import { computeBalance } from '../src/services/account-service';
import {
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  insertUser,
  iso,
  NOW,
  plusMs,
  rowOf,
  uuid,
} from './d1-helpers';

// Pruebas directas de repositorio: los INSERT, UPDATE y DELETE deben acotarse por usuario por sí
// mismos, sin depender de una comprobación previa del servicio.
let db: D1Database;
let owner: string;
let intruder: string;
let accountId: string;
let expenseId: string;
let incomeId: string;
let txId: string;

beforeEach(async () => {
  db = await freshDb();
  owner = await insertUser(db, { google_sub: 'owner' });
  intruder = await insertUser(db, { google_sub: 'intruder' });
  accountId = await insertAccount(db, owner);
  expenseId = await insertCategory(db, accountId, { tipo: 'egreso' });
  incomeId = await insertCategory(db, accountId, { tipo: 'ingreso' });
  txId = await insertTransactionRow(db, accountId, expenseId);
}, DB_HOOK_TIMEOUT_MS);

const later = plusMs(NOW, 60_000);
const newTx = (overrides: Partial<Parameters<typeof insertTransaction>[1]> = {}) => ({
  id: uuid(),
  userId: owner,
  accountId,
  categoryId: expenseId,
  tipo: 'gasto' as const,
  monto: 100,
  fecha: '2026-10-13',
  nota: null,
  now: NOW,
  ...overrides,
});

describe('repositorio de movimientos: filas de otro usuario', () => {
  it('insertTransaction con otro usuario no inserta nada', async () => {
    const result = await insertTransaction(db, newTx({ userId: intruder }));
    expect(result).toEqual({ inserted: false, row: null });
    expect(await rowOf(db, 'transactions', txId)).not.toBeNull();
    const total = await db.prepare('SELECT count(*) AS n FROM transactions').first<{ n: number }>();
    expect(total?.n).toBe(1);
  });

  it('updateTransaction de otro usuario devuelve null y no modifica la fila', async () => {
    const before = await rowOf(db, 'transactions', txId);
    const result = await updateTransaction(
      db,
      intruder,
      txId,
      { monto: 1, fecha: '2026-01-01', nota: 'x' },
      later,
    );
    expect(result).toBeNull();
    expect(await rowOf(db, 'transactions', txId)).toEqual(before);
  });

  it('voidTransaction de otro usuario devuelve false y no anula', async () => {
    expect(await voidTransaction(db, intruder, txId, later)).toBe(false);
    expect(await rowOf(db, 'transactions', txId)).toMatchObject({ deleted_at: null });
  });

  it('findTransaction y listTransactions de otro usuario no ven nada', async () => {
    expect(await findTransaction(db, intruder, txId)).toBeNull();
    const page = await listTransactions(db, intruder, { accountId, page: 1, pageSize: 20 });
    expect(page).toEqual({ items: [], total: 0 });
  });

  it('el propietario sí inserta, actualiza, anula y lista', async () => {
    const created = await insertTransaction(db, newTx({ categoryId: incomeId, tipo: 'ingreso' }));
    expect(created.inserted).toBe(true);
    expect(created.row).toMatchObject({ tipo: 'ingreso', monto: 100 });
    expect(await updateTransaction(db, owner, txId, { monto: 7 }, later)).toMatchObject({
      monto: 7,
      updated_at: iso(later),
    });
    expect(await voidTransaction(db, owner, txId, later)).toBe(true);
    const page = await listTransactions(db, owner, { accountId, page: 1, pageSize: 20 });
    expect(page.total).toBe(1);
  });
});

describe('repositorio de movimientos: reglas del UPDATE y DELETE', () => {
  it('updateTransaction no actualiza un movimiento anulado', async () => {
    await voidTransaction(db, owner, txId, later);
    const before = await rowOf(db, 'transactions', txId);
    expect(await updateTransaction(db, owner, txId, { monto: 9 }, plusMs(later, 1000))).toBeNull();
    expect(await rowOf(db, 'transactions', txId)).toEqual(before);
  });

  it('voidTransaction es idempotente y conserva deleted_at y updated_at originales', async () => {
    expect(await voidTransaction(db, owner, txId, later)).toBe(true);
    const first = await rowOf(db, 'transactions', txId);
    expect(await voidTransaction(db, owner, txId, plusMs(later, 5000))).toBe(true);
    expect(await rowOf(db, 'transactions', txId)).toEqual(first);
    expect(first).toMatchObject({ deleted_at: iso(later), updated_at: iso(later) });
  });

  it('voidTransaction de un id inexistente devuelve false', async () => {
    expect(await voidTransaction(db, owner, uuid(), later)).toBe(false);
  });
});

describe('repositorio de movimientos: alta condicionada', () => {
  it('no inserta con categoría de otra cuenta, tipo erróneo o archivadas', async () => {
    const otherAccount = await insertAccount(db, owner);
    const foreignCategory = await insertCategory(db, otherAccount, { tipo: 'egreso' });
    const archivedCategory = await insertCategory(db, accountId, { tipo: 'egreso', archivada: 1 });
    for (const input of [
      newTx({ categoryId: foreignCategory }),
      newTx({ categoryId: incomeId }),
      newTx({ categoryId: expenseId, tipo: 'ingreso' }),
      newTx({ categoryId: archivedCategory }),
    ]) {
      expect((await insertTransaction(db, input)).inserted).toBe(false);
    }
    const archivedAccount = await insertAccount(db, owner, { archivada: 1 });
    const category = await insertCategory(db, archivedAccount, { tipo: 'egreso' });
    expect(
      (await insertTransaction(db, newTx({ accountId: archivedAccount, categoryId: category })))
        .inserted,
    ).toBe(false);
    const total = await db.prepare('SELECT count(*) AS n FROM transactions').first<{ n: number }>();
    expect(total?.n).toBe(1);
  });

  it('una violación de CHECK del batch no deja filas (el batch es atómico)', async () => {
    await expect(insertTransaction(db, newTx({ monto: 0 }))).rejects.toThrow(/CHECK constraint/);
    const total = await db.prepare('SELECT count(*) AS n FROM transactions').first<{ n: number }>();
    expect(total?.n).toBe(1);
  });
});

describe('categoryHasTransactions', () => {
  it('cuenta movimientos vigentes y anulados, sin filtrar deleted_at', async () => {
    expect(await categoryHasTransactions(db, expenseId)).toBe(true);
    await voidTransaction(db, owner, txId, later);
    expect(await categoryHasTransactions(db, expenseId)).toBe(true);
  });

  it('es false para una categoría sin movimientos o inexistente', async () => {
    expect(await categoryHasTransactions(db, incomeId)).toBe(false);
    expect(await categoryHasTransactions(db, uuid())).toBe(false);
  });
});

describe('computeBalance (fail-closed)', () => {
  const row = (ingresos: number, gastos: number, saldoInicial = 0) => ({
    id: uuid(),
    user_id: owner,
    nombre: 'C',
    saldo_inicial: saldoInicial,
    archivada: 0,
    color: null,
    icono: null,
    created_at: iso(NOW),
    updated_at: iso(NOW),
    ingresos,
    gastos,
  });

  it('calcula saldoInicial + ingresos - gastos', () => {
    expect(computeBalance(row(500, 200, 100))).toEqual({
      saldoInicial: 100,
      ingresos: 500,
      gastos: 200,
      saldo: 400,
    });
  });

  it('lanza si ingresos, gastos o el saldo salen del rango entero seguro', () => {
    expect(() => computeBalance(row(2 ** 53, 0))).toThrow();
    expect(() => computeBalance(row(0, 2 ** 53))).toThrow();
    expect(() => computeBalance(row(1, 0, Number.MAX_SAFE_INTEGER))).toThrow();
    expect(() => computeBalance(row(0, 1, -Number.MAX_SAFE_INTEGER))).toThrow();
    expect(() => computeBalance(row(Number.NaN, 0))).toThrow();
  });
});

describe('isValidTransactionDate', () => {
  it.each(['2000-01-01', '2100-12-31', '2024-02-29', '2000-02-29', '2026-10-13'])(
    'acepta %s',
    (value) => expect(isValidTransactionDate(value)).toBe(true),
  );

  it.each([
    '2025-02-30',
    '2025-02-29',
    '2100-02-29',
    '2025-04-31',
    '2025-13-01',
    '2025-00-01',
    '2025-01-00',
    '1999-12-31',
    '2101-01-01',
    '0099-01-01',
    '2026-1-1',
    '2026-10-13 ',
    '',
  ])('rechaza %s', (value) => expect(isValidTransactionDate(value)).toBe(false));
});
