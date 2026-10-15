import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { MAX_AMOUNT_CENTS, MAX_RESOURCE_BODY_BYTES } from '../src/lib/limits';
import { issueSession } from '../src/services/session-service';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertTransactionRow,
  iso,
  NOW,
  plusMs,
  rowOf,
  uuid,
} from './d1-helpers';
import { AUTH_ENV } from './helpers';
import { api, userWithToken } from './resource-helpers';

// Cada prueba crea cuentas con 11 categorías sobre D1 local: con la máquina cargada, los 5 s por
// defecto no alcanzan.
vi.setConfig({ testTimeout: 30_000, hookTimeout: DB_HOOK_TIMEOUT_MS });

let db: D1Database;
let clock: Date;
let app: ReturnType<typeof createApp>;
let call: ReturnType<typeof api>;
let token: string;
let userId: string;

beforeEach(async () => {
  db = await freshDb();
  clock = NOW;
  app = createApp({ now: () => clock });
  call = api(app, db);
  ({ id: userId, token } = await userWithToken(db));
}, DB_HOOK_TIMEOUT_MS);

const ERR = (code: string) => ({ error: { code, message: expect.any(String) } });
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (response: Response) => (await response.json()) as Json;

interface Fixture {
  accountId: string;
  expense: string;
  income: string;
  expense2: string;
}

async function createAccount(
  as = token,
  body: unknown = { nombre: 'Principal' },
): Promise<Fixture> {
  const response = await call('POST', '/accounts', as, body);
  expect(response.status).toBe(201);
  const created = await json(response);
  const categories = created.categories as Json[];
  return {
    accountId: created.account.id,
    expense: categories.find((c) => c.tipo === 'egreso')!.id,
    expense2: categories.filter((c) => c.tipo === 'egreso')[1]!.id,
    income: categories.find((c) => c.tipo === 'ingreso')!.id,
  };
}

const expenseBody = (f: Fixture, extra: Json = {}) => ({
  accountId: f.accountId,
  categoryId: f.expense,
  tipo: 'gasto',
  monto: 1500,
  fecha: '2026-10-13',
  ...extra,
});
const incomeBody = (f: Fixture, extra: Json = {}) => ({
  accountId: f.accountId,
  categoryId: f.income,
  tipo: 'ingreso',
  monto: 10_000,
  fecha: '2026-10-13',
  ...extra,
});

async function createTx(body: unknown, as = token): Promise<Json> {
  const response = await call('POST', '/transactions', as, body);
  expect(response.status).toBe(201);
  return (await json(response)).transaction;
}

async function balance(accountId: string, as = token): Promise<Json> {
  const response = await call('GET', `/accounts/${accountId}/balance`, as);
  expect(response.status).toBe(200);
  return json(response);
}

async function accountSaldo(accountId: string, as = token): Promise<number> {
  const list = await json(await call('GET', '/accounts?incluirArchivadas=true', as));
  return (list.items as Json[]).find((a) => a.id === accountId)!.saldo;
}

describe('autenticación y cabeceras (los 5 endpoints nuevos)', () => {
  const id = uuid();
  const endpoints: [string, string, unknown?][] = [
    ['POST', '/transactions', { accountId: id }],
    ['GET', `/transactions?account_id=${id}`],
    ['PATCH', `/transactions/${id}`, { monto: 5 }],
    ['DELETE', `/transactions/${id}`],
    ['GET', `/accounts/${id}/balance`],
  ];

  it.each(endpoints)('%s %s sin token responde 401 con no-store', async (method, path, body) => {
    const response = await call(method, path, undefined, body);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(ERR('UNAUTHORIZED'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(endpoints)(
    '%s %s con un JWT v1 responde 401 INVALID_TOKEN',
    async (method, path, body) => {
      const v1 = await issueSession({ sub: userId, email: 'usuario@example.com' }, AUTH_ENV, NOW);
      const response = await call(method, path, v1.accessToken, body);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(ERR('INVALID_TOKEN'));
    },
  );

  it('401 se evalúa antes que 413 y 400', async () => {
    const big = JSON.stringify({ nota: 'x'.repeat(MAX_RESOURCE_BODY_BYTES + 1) });
    expect((await call('POST', '/transactions', undefined, big, true)).status).toBe(401);
    expect((await call('PATCH', `/transactions/${id}`, undefined, '{', true)).status).toBe(401);
  });

  it('las respuestas de éxito y de error llevan Cache-Control: no-store', async () => {
    const f = await createAccount();
    const created = await call('POST', '/transactions', token, expenseBody(f));
    const txId = (await json(created)).transaction.id as string;
    const responses = [
      created,
      await call('POST', '/transactions', token, { accountId: 'x' }),
      await call('GET', `/transactions?account_id=${f.accountId}`, token),
      await call('GET', '/transactions', token),
      await call('PATCH', `/transactions/${txId}`, token, { monto: 5 }),
      await call('PATCH', `/transactions/${uuid()}`, token, { monto: 5 }),
      await call('DELETE', `/transactions/${txId}`, token),
      await call('DELETE', `/transactions/${uuid()}`, token),
      await call('GET', `/accounts/${f.accountId}/balance`, token),
      await call('GET', `/accounts/${uuid()}/balance`, token),
    ];
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });
});

describe('POST /transactions', () => {
  it('crea un gasto y un ingreso con el DTO exacto (sin deletedAt)', async () => {
    const f = await createAccount();
    const expense = await createTx(expenseBody(f, { nota: '  almuerzo  ' }));
    expect(expense).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      accountId: f.accountId,
      categoryId: f.expense,
      tipo: 'gasto',
      monto: 1500,
      fecha: '2026-10-13',
      nota: 'almuerzo',
      createdAt: iso(NOW),
      updatedAt: iso(NOW),
    });
    const income = await createTx(incomeBody(f));
    expect(income).toMatchObject({ tipo: 'ingreso', monto: 10_000, nota: null });
    expect(await count(db, 'transactions')).toBe(2);
    expect(await rowOf(db, 'transactions', expense.id)).toMatchObject({ deleted_at: null });
  });

  it('acepta fechas futuras y bisiestas, y los extremos de fecha y monto', async () => {
    const f = await createAccount();
    for (const fecha of ['2024-02-29', '2000-01-01', '2100-12-31', '2099-06-15']) {
      await createTx(expenseBody(f, { fecha }));
    }
    await createTx(expenseBody(f, { monto: 1 }));
    await createTx(expenseBody(f, { monto: 99_999_999_999 }));
    expect(await count(db, 'transactions')).toBe(6);
  });

  it.each([
    ['2025-02-30', 'día inexistente'],
    ['2025-02-29', 'no bisiesto'],
    ['2025-13-01', 'mes 13'],
    ['2025-00-10', 'mes 0'],
    ['2025-04-31', 'abril 31'],
    ['1999-12-31', 'bajo el rango'],
    ['2101-01-01', 'sobre el rango'],
    ['0050-01-01', 'año de dos dígitos efectivos'],
    ['2026-1-5', 'sin ceros'],
    ['2026/10/13', 'separador'],
    ['2026-10-13T00:00:00Z', 'con hora'],
    ['', 'vacía'],
  ])('rechaza la fecha %s (%s)', async (fecha) => {
    const f = await createAccount();
    const response = await call('POST', '/transactions', token, expenseBody(f, { fecha }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it.each([
    ['monto 0', { monto: 0 }],
    ['monto negativo', { monto: -5 }],
    ['monto decimal', { monto: 10.5 }],
    ['monto como string', { monto: '100' }],
    ['monto null', { monto: null }],
    ['monto 100000000000', { monto: 100_000_000_000 }],
    ['monto ausente', { monto: undefined }],
    ['fecha ausente', { fecha: undefined }],
    ['fecha numérica', { fecha: 20261013 }],
    ['tipo ajuste', { tipo: 'ajuste' }],
    ['tipo egreso', { tipo: 'egreso' }],
    ['tipo ausente', { tipo: undefined }],
    ['accountId no UUID', { accountId: 'abc' }],
    ['categoryId no UUID', { categoryId: 'abc' }],
    ['categoryId ausente', { categoryId: undefined }],
    ['nota de 501 caracteres', { nota: 'n'.repeat(501) }],
    ['nota numérica', { nota: 5 }],
    ['campo desconocido', { extra: 1 }],
    ['deletedAt', { deletedAt: '2026-10-13T00:00:00.000Z' }],
    ['id explícito', { id: uuid() }],
  ])('rechaza %s con 400', async (_name, extra) => {
    const f = await createAccount();
    const body = { ...expenseBody(f), ...extra };
    const response = await call('POST', '/transactions', token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('monto 99999999999 es válido', async () => {
    const f = await createAccount();
    expect((await createTx(expenseBody(f, { monto: 99_999_999_999 }))).monto).toBe(99_999_999_999);
  });

  it('nota: 500 caracteres ok, vacía o de espacios pasa a null, null y ausente son null', async () => {
    const f = await createAccount();
    expect((await createTx(expenseBody(f, { nota: 'n'.repeat(500) }))).nota).toHaveLength(500);
    expect((await createTx(expenseBody(f, { nota: '' }))).nota).toBeNull();
    expect((await createTx(expenseBody(f, { nota: '   ' }))).nota).toBeNull();
    expect((await createTx(expenseBody(f, { nota: null }))).nota).toBeNull();
    expect((await createTx(expenseBody(f))).nota).toBeNull();
    // 500 caracteres tras recortar los espacios.
    expect((await createTx(expenseBody(f, { nota: ` ${'n'.repeat(500)} ` }))).nota).toHaveLength(
      500,
    );
  });

  it('JSON inválido responde 400 y un cuerpo mayor de 4 KiB responde 413', async () => {
    expect((await call('POST', '/transactions', token, '{', true)).status).toBe(400);
    const big = JSON.stringify({ nota: 'x'.repeat(MAX_RESOURCE_BODY_BYTES + 1) });
    const response = await call('POST', '/transactions', token, big, true);
    expect(response.status).toBe(413);
  });

  it('cuenta inexistente o categoría inexistente: 404', async () => {
    const f = await createAccount();
    for (const body of [
      expenseBody(f, { accountId: uuid() }),
      expenseBody(f, { categoryId: uuid() }),
    ]) {
      const response = await call('POST', '/transactions', token, body);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });

  it('categoría de otra cuenta del mismo usuario: 409 CATEGORY_MISMATCH', async () => {
    const a = await createAccount();
    const b = await createAccount(token, { nombre: 'Otra' });
    const response = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(a, { categoryId: b.expense }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_MISMATCH'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('tipo incompatible con la categoría: 409 CATEGORY_MISMATCH en ambos sentidos', async () => {
    const f = await createAccount();
    const gastoConIngreso = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(f, { categoryId: f.income }),
    );
    expect(gastoConIngreso.status).toBe(409);
    expect(await gastoConIngreso.json()).toEqual(ERR('CATEGORY_MISMATCH'));
    const ingresoConGasto = await call(
      'POST',
      '/transactions',
      token,
      incomeBody(f, { categoryId: f.expense }),
    );
    expect(ingresoConGasto.status).toBe(409);
    expect(await ingresoConGasto.json()).toEqual(ERR('CATEGORY_MISMATCH'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('categoría archivada: 409 CATEGORY_ARCHIVED', async () => {
    const f = await createAccount();
    await call('PATCH', `/categories/${f.expense}`, token, { archivada: true });
    const response = await call('POST', '/transactions', token, expenseBody(f));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_ARCHIVED'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('cuenta archivada: 409 ACCOUNT_ARCHIVED', async () => {
    const f = await createAccount();
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    const response = await call('POST', '/transactions', token, expenseBody(f));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('ACCOUNT_ARCHIVED'));
  });

  it('prioridad de los 409: ACCOUNT_ARCHIVED, CATEGORY_MISMATCH, CATEGORY_ARCHIVED', async () => {
    const f = await createAccount();
    await call('PATCH', `/categories/${f.income}`, token, { archivada: true });
    // Categoría de tipo erróneo y archivada: MISMATCH gana a ARCHIVED.
    const mismatch = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(f, { categoryId: f.income }),
    );
    expect(await mismatch.json()).toEqual(ERR('CATEGORY_MISMATCH'));
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    // Cuenta archivada gana a todo.
    const archived = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(f, { categoryId: f.income }),
    );
    expect(await archived.json()).toEqual(ERR('ACCOUNT_ARCHIVED'));
  });

  it('orden 404 antes que 409 y 400 antes que 404', async () => {
    const f = await createAccount();
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    const notFound = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(f, { categoryId: uuid() }),
    );
    expect(notFound.status).toBe(404);
    const invalid = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(f, { accountId: uuid(), monto: 0 }),
    );
    expect(invalid.status).toBe(400);
  });
});

describe('PATCH /transactions/:id', () => {
  it('edita monto, fecha y nota y actualiza updatedAt', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f, { nota: 'a' }));
    clock = plusMs(NOW, 5000);
    const response = await call('PATCH', `/transactions/${tx.id}`, token, {
      monto: 2500,
      fecha: '2026-11-01',
      nota: '  nueva ',
    });
    expect(response.status).toBe(200);
    expect((await json(response)).transaction).toEqual({
      ...tx,
      monto: 2500,
      fecha: '2026-11-01',
      nota: 'nueva',
      updatedAt: iso(clock),
    });
  });

  it('un solo campo basta; nota null o vacía la borra', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f, { nota: 'a' }));
    const only = await json(await call('PATCH', `/transactions/${tx.id}`, token, { monto: 7 }));
    expect(only.transaction).toMatchObject({ monto: 7, nota: 'a', fecha: '2026-10-13' });
    const cleared = await json(
      await call('PATCH', `/transactions/${tx.id}`, token, { nota: null }),
    );
    expect(cleared.transaction.nota).toBeNull();
    await call('PATCH', `/transactions/${tx.id}`, token, { nota: 'otra' });
    const empty = await json(await call('PATCH', `/transactions/${tx.id}`, token, { nota: '' }));
    expect(empty.transaction.nota).toBeNull();
  });

  it.each([
    ['cuerpo vacío', {}],
    ['solo undefined', { monto: undefined }],
    ['tipo (inmutable)', { tipo: 'ingreso' }],
    ['categoryId (inmutable)', { categoryId: uuid() }],
    ['accountId (inmutable)', { accountId: uuid() }],
    ['tipo junto a un campo válido', { monto: 5, tipo: 'gasto' }],
    ['deletedAt', { deletedAt: null }],
    ['id', { id: uuid() }],
    ['monto 0', { monto: 0 }],
    ['monto decimal', { monto: 1.5 }],
    ['monto string', { monto: '5' }],
    ['monto 100000000000', { monto: 100_000_000_000 }],
    ['fecha 2025-02-30', { fecha: '2025-02-30' }],
    ['fecha fuera de rango', { fecha: '2101-01-01' }],
    ['nota de 501 caracteres', { nota: 'n'.repeat(501) }],
  ])('rechaza %s con 400 y no modifica la fila', async (_name, body) => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    const before = await rowOf(db, 'transactions', tx.id);
    const response = await call('PATCH', `/transactions/${tx.id}`, token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await rowOf(db, 'transactions', tx.id)).toEqual(before);
  });

  it('un movimiento anulado responde 409 TRANSACTION_VOIDED y no cambia', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    await call('DELETE', `/transactions/${tx.id}`, token);
    const before = await rowOf(db, 'transactions', tx.id);
    const response = await call('PATCH', `/transactions/${tx.id}`, token, { monto: 9 });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('TRANSACTION_VOIDED'));
    expect(await rowOf(db, 'transactions', tx.id)).toEqual(before);
  });

  it('404 para inexistente y para un id que no es UUID; 400 antes que 404', async () => {
    expect((await call('PATCH', `/transactions/${uuid()}`, token, { monto: 5 })).status).toBe(404);
    expect((await call('PATCH', '/transactions/abc', token, { monto: 5 })).status).toBe(404);
    expect((await call('PATCH', `/transactions/${uuid()}`, token, {})).status).toBe(400);
  });

  it('413 con un cuerpo mayor de 4 KiB', async () => {
    const big = JSON.stringify({ nota: 'x'.repeat(MAX_RESOURCE_BODY_BYTES + 1) });
    expect((await call('PATCH', `/transactions/${uuid()}`, token, big, true)).status).toBe(413);
  });

  it('permite editar un vigente aunque la cuenta y la categoría estén archivadas', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    await call('PATCH', `/categories/${f.expense}`, token, { archivada: true });
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    const response = await call('PATCH', `/transactions/${tx.id}`, token, { monto: 42 });
    expect(response.status).toBe(200);
    expect((await json(response)).transaction.monto).toBe(42);
  });
});

describe('DELETE /transactions/:id', () => {
  it('anula con 204 sin cuerpo; no se borra la fila y desaparece del historial', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    clock = plusMs(NOW, 1000);
    const response = await call('DELETE', `/transactions/${tx.id}`, token);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(await rowOf(db, 'transactions', tx.id)).toMatchObject({
      deleted_at: iso(clock),
      updated_at: iso(clock),
    });
    const list = await json(await call('GET', `/transactions?account_id=${f.accountId}`, token));
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
  });

  it('es idempotente: la segunda vez también 204 y conserva el deleted_at original', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    clock = plusMs(NOW, 1000);
    expect((await call('DELETE', `/transactions/${tx.id}`, token)).status).toBe(204);
    const first = await rowOf(db, 'transactions', tx.id);
    clock = plusMs(NOW, 60_000);
    const again = await call('DELETE', `/transactions/${tx.id}`, token);
    expect(again.status).toBe(204);
    expect(await again.text()).toBe('');
    expect(await rowOf(db, 'transactions', tx.id)).toEqual(first);
    expect(first).toMatchObject({ deleted_at: iso(plusMs(NOW, 1000)) });
  });

  it('404 para inexistente y para id que no es UUID', async () => {
    const missing = await call('DELETE', `/transactions/${uuid()}`, token);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(ERR('NOT_FOUND'));
    expect((await call('DELETE', '/transactions/abc', token)).status).toBe(404);
  });

  it('permite anular con la cuenta y la categoría archivadas', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    await call('PATCH', `/categories/${f.expense}`, token, { archivada: true });
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    expect((await call('DELETE', `/transactions/${tx.id}`, token)).status).toBe(204);
  });
});

describe('GET /transactions', () => {
  it('account_id es obligatorio y debe ser un UUID', async () => {
    expect((await call('GET', '/transactions', token)).status).toBe(400);
    expect((await call('GET', '/transactions?account_id=abc', token)).status).toBe(400);
    expect((await call('GET', '/transactions?account_id=', token)).status).toBe(400);
  });

  it('cuenta sin movimientos: lista vacía con página y tamaño por defecto 20', async () => {
    const f = await createAccount();
    const response = await call('GET', `/transactions?account_id=${f.accountId}`, token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('ordena por fecha DESC, created_at DESC e id DESC, con empates', async () => {
    const f = await createAccount();
    const ids = {
      a: '00000000-0000-4000-8000-00000000000a',
      b: '00000000-0000-4000-8000-00000000000b',
    };
    const row = (id: string, fecha: string, created: Date) =>
      insertTransactionRow(db, f.accountId, f.expense, {
        id,
        fecha,
        created_at: iso(created),
        updated_at: iso(created),
      });
    const oldest = await row(uuid(), '2026-01-01', NOW);
    const sameDayEarly = await row(uuid(), '2026-02-01', NOW);
    const sameDayLate = await row(uuid(), '2026-02-01', plusMs(NOW, 1000));
    const tieLow = await row(ids.a, '2026-03-01', plusMs(NOW, 5000));
    const tieHigh = await row(ids.b, '2026-03-01', plusMs(NOW, 5000));
    const list = await json(await call('GET', `/transactions?account_id=${f.accountId}`, token));
    expect((list.items as Json[]).map((t) => t.id)).toEqual([
      tieHigh,
      tieLow,
      sameDayLate,
      sameDayEarly,
      oldest,
    ]);
  });

  it('pagina con page y page_size y devuelve el total', async () => {
    const f = await createAccount();
    for (let day = 1; day <= 25; day++) {
      await insertTransactionRow(db, f.accountId, f.expense, {
        fecha: `2026-05-${String(day).padStart(2, '0')}`,
      });
    }
    const first = await json(await call('GET', `/transactions?account_id=${f.accountId}`, token));
    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 25 });
    expect(first.items).toHaveLength(20);
    expect(first.items[0].fecha).toBe('2026-05-25');
    const second = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&page=2`, token),
    );
    expect(second.items).toHaveLength(5);
    expect(second.items[4].fecha).toBe('2026-05-01');
    const small = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&page_size=10&page=3`, token),
    );
    expect(small).toMatchObject({ page: 3, pageSize: 10, total: 25 });
    expect(small.items).toHaveLength(5);
    const beyond = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&page=9`, token),
    );
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(25);
  });

  it('page_size máximo 100; 101, 0, vacío y repetidos son 400', async () => {
    const f = await createAccount();
    const base = `/transactions?account_id=${f.accountId}`;
    expect((await call('GET', `${base}&page_size=100`, token)).status).toBe(200);
    for (const query of [
      '&page_size=101',
      '&page_size=0',
      '&page_size=',
      '&page=0',
      '&page=abc',
      '&page=1&page=2',
      '&tipo=',
      '&tipo=egreso',
      '&tipo=ingreso&tipo=gasto',
      '&desde=',
      '&desde=2025-02-30',
      '&hasta=2101-01-01',
      '&category_id=abc',
      '&category_id=',
    ]) {
      const response = await call('GET', `${base}${query}`, token);
      expect(response.status, query).toBe(400);
    }
    expect((await call('GET', `${base}&desconocido=1`, token)).status).toBe(200);
  });

  it('filtra por tipo', async () => {
    const f = await createAccount();
    await createTx(expenseBody(f));
    await createTx(incomeBody(f));
    const gastos = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&tipo=gasto`, token),
    );
    expect((gastos.items as Json[]).map((t) => t.tipo)).toEqual(['gasto']);
    expect(gastos.total).toBe(1);
    const ingresos = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&tipo=ingreso`, token),
    );
    expect((ingresos.items as Json[]).map((t) => t.tipo)).toEqual(['ingreso']);
  });

  it('filtra por categoría; tipo y categoría incompatibles dan lista vacía', async () => {
    const f = await createAccount();
    const a = await createTx(expenseBody(f));
    await createTx(expenseBody(f, { categoryId: f.expense2 }));
    const byCategory = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&category_id=${f.expense}`, token),
    );
    expect((byCategory.items as Json[]).map((t) => t.id)).toEqual([a.id]);
    const incompatible = await json(
      await call(
        'GET',
        `/transactions?account_id=${f.accountId}&category_id=${f.expense}&tipo=ingreso`,
        token,
      ),
    );
    expect(incompatible).toMatchObject({ items: [], total: 0 });
  });

  it('filtra por rango desde/hasta inclusivo, solo desde o solo hasta', async () => {
    const f = await createAccount();
    for (const fecha of ['2026-01-10', '2026-02-10', '2026-03-10']) {
      await createTx(expenseBody(f, { fecha }));
    }
    const fechas = async (query: string) =>
      (
        (await json(await call('GET', `/transactions?account_id=${f.accountId}${query}`, token)))
          .items as Json[]
      ).map((t) => t.fecha);
    expect(await fechas('&desde=2026-01-10&hasta=2026-02-10')).toEqual([
      '2026-02-10',
      '2026-01-10',
    ]);
    expect(await fechas('&desde=2026-02-11')).toEqual(['2026-03-10']);
    expect(await fechas('&hasta=2026-01-09')).toEqual([]);
    expect(await fechas('&desde=2026-02-10&hasta=2026-02-10')).toEqual(['2026-02-10']);
  });

  it('desde > hasta responde 400', async () => {
    const f = await createAccount();
    const response = await call(
      'GET',
      `/transactions?account_id=${f.accountId}&desde=2026-03-01&hasta=2026-02-01`,
      token,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
  });

  it('account_id inexistente o category_id inexistente: 404', async () => {
    const f = await createAccount();
    expect((await call('GET', `/transactions?account_id=${uuid()}`, token)).status).toBe(404);
    const response = await call(
      'GET',
      `/transactions?account_id=${f.accountId}&category_id=${uuid()}`,
      token,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(ERR('NOT_FOUND'));
  });

  it('category_id de otra cuenta del mismo usuario: 404', async () => {
    const a = await createAccount();
    const b = await createAccount(token, { nombre: 'Otra' });
    const response = await call(
      'GET',
      `/transactions?account_id=${a.accountId}&category_id=${b.expense}`,
      token,
    );
    expect(response.status).toBe(404);
  });

  it('excluye anulados y funciona con cuenta y categoría archivadas', async () => {
    const f = await createAccount();
    const kept = await createTx(expenseBody(f));
    const voided = await createTx(expenseBody(f, { monto: 99 }));
    await call('DELETE', `/transactions/${voided.id}`, token);
    await call('PATCH', `/categories/${f.expense}`, token, { archivada: true });
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    const list = await json(
      await call('GET', `/transactions?account_id=${f.accountId}&category_id=${f.expense}`, token),
    );
    expect((list.items as Json[]).map((t) => t.id)).toEqual([kept.id]);
    expect(list.total).toBe(1);
    expect(JSON.stringify(list)).not.toContain('deleted');
  });
});

describe('saldo y GET /accounts/:id/balance', () => {
  it('cuenta sin movimientos: saldo = saldoInicial (LEFT JOIN), también negativo', async () => {
    const f = await createAccount(token, { nombre: 'Con saldo', saldoInicial: -2500 });
    expect(await accountSaldo(f.accountId)).toBe(-2500);
    expect(await balance(f.accountId)).toEqual({
      accountId: f.accountId,
      saldoInicial: -2500,
      ingresos: 0,
      gastos: 0,
      saldo: -2500,
    });
    const created = await json(
      await call('POST', '/accounts', token, { nombre: 'Nueva', saldoInicial: 300 }),
    );
    expect(created.account.saldo).toBe(300);
    const listed = await json(await call('GET', '/accounts', token));
    expect((listed.items as Json[]).every((a) => Number.isInteger(a.saldo))).toBe(true);
  });

  it('suma ingresos y resta gastos; listado, PATCH y /balance son coherentes', async () => {
    const f = await createAccount(token, { nombre: 'Caja', saldoInicial: 1000 });
    await createTx(incomeBody(f, { monto: 5000 }));
    await createTx(incomeBody(f, { monto: 2500 }));
    await createTx(expenseBody(f, { monto: 1200 }));
    const expected = {
      accountId: f.accountId,
      saldoInicial: 1000,
      ingresos: 7500,
      gastos: 1200,
      saldo: 7300,
    };
    expect(await balance(f.accountId)).toEqual(expected);
    expect(await accountSaldo(f.accountId)).toBe(7300);
    const patched = await json(
      await call('PATCH', `/accounts/${f.accountId}`, token, { nombre: 'Caja 2' }),
    );
    expect(patched.account.saldo).toBe(7300);
  });

  it('una edición cambia el saldo y una anulación lo revierte (idempotente)', async () => {
    const f = await createAccount(token, { nombre: 'Caja', saldoInicial: 0 });
    const income = await createTx(incomeBody(f, { monto: 5000 }));
    const expense = await createTx(expenseBody(f, { monto: 1000 }));
    expect(await accountSaldo(f.accountId)).toBe(4000);
    await call('PATCH', `/transactions/${expense.id}`, token, { monto: 3000 });
    expect(await accountSaldo(f.accountId)).toBe(2000);
    expect((await balance(f.accountId)).gastos).toBe(3000);
    await call('DELETE', `/transactions/${expense.id}`, token);
    await call('DELETE', `/transactions/${expense.id}`, token);
    expect(await accountSaldo(f.accountId)).toBe(5000);
    await call('DELETE', `/transactions/${income.id}`, token);
    expect(await balance(f.accountId)).toEqual({
      accountId: f.accountId,
      saldoInicial: 0,
      ingresos: 0,
      gastos: 0,
      saldo: 0,
    });
    const patched = await json(
      await call('PATCH', `/accounts/${f.accountId}`, token, { nombre: 'X' }),
    );
    expect(patched.account.saldo).toBe(0);
  });

  it('una cuenta con solo movimientos anulados sigue apareciendo con su saldo inicial', async () => {
    const f = await createAccount(token, { nombre: 'Caja', saldoInicial: 700 });
    const tx = await createTx(incomeBody(f));
    await call('DELETE', `/transactions/${tx.id}`, token);
    const list = await json(await call('GET', '/accounts', token));
    expect((list.items as Json[]).map((a) => a.id)).toContain(f.accountId);
    expect(await accountSaldo(f.accountId)).toBe(700);
  });

  it('las cuentas no se mezclan: cada saldo usa solo sus movimientos', async () => {
    const a = await createAccount(token, { nombre: 'A', saldoInicial: 100 });
    const b = await createAccount(token, { nombre: 'B', saldoInicial: 200 });
    await createTx(incomeBody(a, { monto: 1 }));
    await createTx(incomeBody(b, { monto: 10 }));
    await createTx(expenseBody(b, { monto: 5 }));
    expect(await accountSaldo(a.accountId)).toBe(101);
    expect(await accountSaldo(b.accountId)).toBe(205);
  });

  it('el listado paginado de cuentas conserva el saldo y el total', async () => {
    const a = await createAccount(token, { nombre: 'A', saldoInicial: 100 });
    clock = plusMs(NOW, 1000);
    await createAccount(token, { nombre: 'B' });
    await createTx(incomeBody(a, { monto: 50 }));
    const page = await json(await call('GET', '/accounts?page=1&page_size=1', token));
    expect(page.total).toBe(2);
    expect(page.pageSize).toBe(1);
    expect(page.items[0]).toMatchObject({ id: a.accountId, saldo: 150 });
  });

  it('funciona en cuentas archivadas; 404 para inexistente o id no UUID', async () => {
    const f = await createAccount(token, { nombre: 'Caja', saldoInicial: 10 });
    await createTx(incomeBody(f, { monto: 5 }));
    await call('PATCH', `/accounts/${f.accountId}`, token, { archivada: true });
    expect((await balance(f.accountId)).saldo).toBe(15);
    const missing = await call('GET', `/accounts/${uuid()}/balance`, token);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(ERR('NOT_FOUND'));
    expect((await call('GET', '/accounts/abc/balance', token)).status).toBe(404);
  });

  it('desborde del saldo: falla cerrado con 500 genérico en listado, PATCH y /balance', async () => {
    const f = await createAccount(token, { nombre: 'Límite', saldoInicial: MAX_AMOUNT_CENTS });
    expect(await accountSaldo(f.accountId)).toBe(MAX_AMOUNT_CENTS);
    await insertTransactionRow(db, f.accountId, f.income, { tipo: 'ingreso', monto: 1 });
    const responses = [
      await call('GET', '/accounts', token),
      await call('PATCH', `/accounts/${f.accountId}`, token, { nombre: 'X' }),
      await call('GET', `/accounts/${f.accountId}/balance`, token),
    ];
    for (const response of responses) {
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual(ERR('INTERNAL_ERROR'));
    }
  });
});

describe('DELETE /categories/:id con movimientos', () => {
  it('categoría con un movimiento activo: 409 CATEGORY_IN_USE y no se borra', async () => {
    const f = await createAccount();
    await createTx(expenseBody(f));
    const response = await call('DELETE', `/categories/${f.expense}`, token);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_IN_USE'));
    expect(await rowOf(db, 'categories', f.expense)).not.toBeNull();
  });

  it('categoría con un movimiento anulado: también 409 CATEGORY_IN_USE', async () => {
    const f = await createAccount();
    const tx = await createTx(expenseBody(f));
    await call('DELETE', `/transactions/${tx.id}`, token);
    const response = await call('DELETE', `/categories/${f.expense}`, token);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_IN_USE'));
    expect(await rowOf(db, 'categories', f.expense)).not.toBeNull();
  });

  it('una categoría sin movimientos se sigue eliminando y archivar sigue permitido', async () => {
    const f = await createAccount();
    await createTx(expenseBody(f));
    expect((await call('DELETE', `/categories/${f.expense2}`, token)).status).toBe(204);
    expect(
      (await call('PATCH', `/categories/${f.expense}`, token, { archivada: true })).status,
    ).toBe(200);
  });

  it('carrera: si la comprobación previa no ve el movimiento, el FK RESTRICT da 409', async () => {
    const racing = createApp({ now: () => NOW, categoryHasTransactions: async () => false });
    const racingCall = api(racing, db);
    const f = await createAccount();
    await createTx(expenseBody(f));
    const response = await racingCall('DELETE', `/categories/${f.expense}`, token);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_IN_USE'));
    expect(await rowOf(db, 'categories', f.expense)).not.toBeNull();
  });
});

describe('aislamiento entre usuarios', () => {
  let otherToken: string;
  let mine: Fixture;
  let theirs: Fixture;
  let theirTx: Json;

  beforeEach(async () => {
    ({ token: otherToken } = await userWithToken(db, 'otro@example.com'));
    mine = await createAccount(token, { nombre: 'Mía', saldoInicial: 100 });
    theirs = await createAccount(otherToken, { nombre: 'Ajena', saldoInicial: 500 });
    theirTx = await createTx(incomeBody(theirs, { monto: 900 }), otherToken);
  });

  it('POST con cuenta ajena: 404 y nada insertado', async () => {
    const response = await call('POST', '/transactions', token, {
      ...expenseBody(theirs),
    });
    expect(response.status).toBe(404);
    expect(await count(db, 'transactions')).toBe(1);
  });

  it('POST con mi cuenta y categoría ajena: 404 y nada insertado', async () => {
    const response = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(mine, { categoryId: theirs.expense }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    expect(await count(db, 'transactions')).toBe(1);
  });

  it('POST con cuenta ajena y categoría propia: 404 y nada insertado', async () => {
    const response = await call(
      'POST',
      '/transactions',
      token,
      expenseBody(theirs, { categoryId: mine.expense }),
    );
    expect(response.status).toBe(404);
    expect(await count(db, 'transactions')).toBe(1);
  });

  it('GET con account_id ajeno y con category_id ajeno: 404', async () => {
    expect((await call('GET', `/transactions?account_id=${theirs.accountId}`, token)).status).toBe(
      404,
    );
    expect(
      (
        await call(
          'GET',
          `/transactions?account_id=${mine.accountId}&category_id=${theirs.income}`,
          token,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          'GET',
          `/transactions?account_id=${theirs.accountId}&category_id=${theirs.income}`,
          token,
        )
      ).status,
    ).toBe(404);
  });

  it('GET propio no incluye movimientos ajenos', async () => {
    await createTx(incomeBody(mine, { monto: 1 }));
    const list = await json(await call('GET', `/transactions?account_id=${mine.accountId}`, token));
    expect(list.total).toBe(1);
    expect((list.items as Json[]).every((t) => t.accountId === mine.accountId)).toBe(true);
  });

  it('PATCH ajeno: 404 idéntico a inexistente y la fila no cambia', async () => {
    const before = await rowOf(db, 'transactions', theirTx.id);
    const foreign = await call('PATCH', `/transactions/${theirTx.id}`, token, { monto: 1 });
    const missing = await call('PATCH', `/transactions/${uuid()}`, token, { monto: 1 });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(await rowOf(db, 'transactions', theirTx.id)).toEqual(before);
  });

  it('PATCH ajeno de un movimiento anulado: 404 (no revela 409)', async () => {
    await call('DELETE', `/transactions/${theirTx.id}`, otherToken);
    const response = await call('PATCH', `/transactions/${theirTx.id}`, token, { monto: 1 });
    expect(response.status).toBe(404);
  });

  it('DELETE ajeno: 404 y el movimiento no se anula', async () => {
    const response = await call('DELETE', `/transactions/${theirTx.id}`, token);
    expect(response.status).toBe(404);
    expect(await rowOf(db, 'transactions', theirTx.id)).toMatchObject({ deleted_at: null });
  });

  it('DELETE ajeno de un ya anulado también es 404', async () => {
    await call('DELETE', `/transactions/${theirTx.id}`, otherToken);
    expect((await call('DELETE', `/transactions/${theirTx.id}`, token)).status).toBe(404);
  });

  it('/balance ajeno: 404; los saldos propios no incluyen movimientos ajenos', async () => {
    expect((await call('GET', `/accounts/${theirs.accountId}/balance`, token)).status).toBe(404);
    expect(await accountSaldo(mine.accountId)).toBe(100);
    expect(await accountSaldo(theirs.accountId, otherToken)).toBe(1400);
    const list = await json(await call('GET', '/accounts', token));
    expect((list.items as Json[]).map((a) => a.id)).toEqual([mine.accountId]);
  });

  it('DELETE de una categoría ajena con movimientos: 404 (no revela CATEGORY_IN_USE)', async () => {
    const response = await call('DELETE', `/categories/${theirs.income}`, token);
    expect(response.status).toBe(404);
  });
});

describe('atomicidad del alta', () => {
  // Simula una carrera: justo antes de ejecutar el batch del alta, otra solicitud cambia el
  // estado. El INSERT ... SELECT evalúa las condiciones al insertar, así que no queda nada.
  const withRace = (race: () => Promise<unknown>): D1Database =>
    ({
      prepare: (sql: string) => db.prepare(sql),
      batch: async (statements: D1PreparedStatement[]) => {
        await race();
        return db.batch(statements);
      },
    }) as unknown as D1Database;

  const post = async (database: D1Database, body: unknown, as = token) =>
    api(app, database)('POST', '/transactions', as, body);

  it('categoría archivada entre la validación y el alta: 409 y ninguna fila', async () => {
    const f = await createAccount();
    const racing = withRace(() =>
      db.prepare('UPDATE categories SET archivada = 1 WHERE id = ?1').bind(f.expense).run(),
    );
    const response = await post(racing, expenseBody(f));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('CATEGORY_ARCHIVED'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('cuenta archivada entre la validación y el alta: 409 y ninguna fila', async () => {
    const f = await createAccount();
    const racing = withRace(() =>
      db.prepare('UPDATE accounts SET archivada = 1 WHERE id = ?1').bind(f.accountId).run(),
    );
    const response = await post(racing, expenseBody(f));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('ACCOUNT_ARCHIVED'));
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('categoría eliminada entre la validación y el alta: 404 y ninguna fila', async () => {
    const f = await createAccount();
    const racing = withRace(() =>
      db.prepare('DELETE FROM categories WHERE id = ?1').bind(f.expense).run(),
    );
    const response = await post(racing, expenseBody(f));
    expect(response.status).toBe(404);
    expect(await count(db, 'transactions')).toBe(0);
  });

  it('el camino feliz no hace comprobaciones previas: una sola ida con el batch', async () => {
    const f = await createAccount();
    const statements: string[] = [];
    const spy = {
      prepare: (sql: string) => {
        statements.push(sql.replace(/\s+/g, ' ').trim());
        return db.prepare(sql);
      },
      batch: (items: D1PreparedStatement[]) => db.batch(items),
    } as unknown as D1Database;
    const response = await post(spy, expenseBody(f));
    expect(response.status).toBe(201);
    // Solo el INSERT ... SELECT y la lectura por id; ninguna consulta previa a accounts/categories.
    const domain = statements.filter((sql) => /transactions|categories|accounts/.test(sql));
    expect(domain).toHaveLength(2);
    expect(domain[0]).toMatch(/^INSERT INTO transactions/);
    expect(domain[1]).toMatch(/^SELECT .* FROM transactions t/);
  });
});
