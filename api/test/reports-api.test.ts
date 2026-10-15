import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { issueSession } from '../src/services/session-service';
import {
  toCategoryReport,
  toPeriodPoints,
  type PeriodPointDto,
} from '../src/services/report-service';
import { categoryTotals, periodTotals, summaryTotals } from '../src/db/report-repository';
import {
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  iso,
  NOW,
  uuid,
} from './d1-helpers';
import { AUTH_ENV } from './helpers';
import { api, userWithToken } from './resource-helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: DB_HOOK_TIMEOUT_MS });

let db: D1Database;
let call: ReturnType<typeof api>;
let token: string;
let userId: string;
let accountId: string;
let income: string;
let expense: string;

beforeEach(async () => {
  db = await freshDb();
  call = api(createApp({ now: () => NOW }), db);
  ({ id: userId, token } = await userWithToken(db));
  accountId = await insertAccount(db, userId);
  income = await insertCategory(db, accountId, { tipo: 'ingreso', nombre: 'Sueldo' });
  expense = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Comida' });
}, DB_HOOK_TIMEOUT_MS);

const ERR = (code: string) => ({ error: { code, message: expect.any(String) } });
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const get = (
  kind: 'summary' | 'by-category' | 'by-period',
  query: Record<string, string>,
  as = token,
) => call('GET', `/reports/${kind}?${new URLSearchParams(query).toString()}`, as);

const q = (desde = '2026-10-01', hasta = '2026-10-31', account = accountId) => ({
  account_id: account,
  desde,
  hasta,
});
const summary = (desde?: string, hasta?: string, account?: string, as?: string) =>
  get('summary', q(desde, hasta, account), as);
const byCategory = (desde?: string, hasta?: string, account?: string, as?: string) =>
  get('by-category', q(desde, hasta, account), as);
const byPeriod = (group: string, desde?: string, hasta?: string, account?: string, as?: string) =>
  get('by-period', { ...q(desde, hasta, account), group }, as);

const add = (
  tipo: 'ingreso' | 'gasto',
  monto: number,
  fecha: string,
  category = tipo === 'ingreso' ? income : expense,
  account = accountId,
  extra: Record<string, unknown> = {},
) => insertTransactionRow(db, account, category, { tipo, monto, fecha, ...extra });

const json = async (response: Response) => (await response.json()) as Json;

const ENDPOINTS = ['summary', 'by-category', 'by-period'] as const;
const withGroup = (kind: string, query: Record<string, string>) =>
  kind === 'by-period' ? { ...query, group: 'month' } : query;

describe.each(ENDPOINTS)('GET /reports/%s: autenticación y validación', (kind) => {
  const id = uuid();
  const base = { account_id: id, desde: '2026-10-01', hasta: '2026-10-31' };

  it('sin token y con token inválido responde 401 con no-store', async () => {
    for (const [as, code] of [
      ['', 'UNAUTHORIZED'],
      ['no-es-un-jwt', 'INVALID_TOKEN'],
    ] as const) {
      const response = await get(kind, withGroup(kind, { ...base, account_id: accountId }), as);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(ERR(code));
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('con un JWT v1 responde 401', async () => {
    const v1 = await issueSession({ sub: userId, email: 'usuario@example.com' }, AUTH_ENV, NOW);
    const response = await get(
      kind,
      withGroup(kind, { ...base, account_id: accountId }),
      v1.accessToken,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  const invalid: [string, Record<string, string>][] = [
    ['sin account_id', { desde: base.desde, hasta: base.hasta }],
    ['sin desde', { account_id: id, hasta: base.hasta }],
    ['sin hasta', { account_id: id, desde: base.desde }],
    ['sin parámetros', {}],
    ['account_id no UUID', { ...base, account_id: 'abc' }],
    ['account_id en mayúsculas', { ...base, account_id: id.toUpperCase() }],
    ['account_id vacío', { ...base, account_id: '' }],
    ['desde vacío', { ...base, desde: '' }],
    ['desde formato inválido', { ...base, desde: '2026-1-01' }],
    ['desde con mes inexistente', { ...base, desde: '2026-13-01' }],
    ['desde 2025-02-30', { ...base, desde: '2025-02-30' }],
    ['hasta 2026-02-29 (no bisiesto)', { ...base, hasta: '2026-02-29' }],
    ['desde fuera de rango 1999-12-31', { ...base, desde: '1999-12-31' }],
    ['hasta fuera de rango 2101-01-01', { ...base, hasta: '2101-01-01' }],
    ['desde con hora', { ...base, desde: '2026-10-01T00:00:00Z' }],
    ['desde > hasta', { ...base, desde: '2026-10-31', hasta: '2026-10-01' }],
  ];

  it.each(invalid)('%s: 400 INVALID_REQUEST con no-store', async (_name, query) => {
    const response = await get(kind, withGroup(kind, query));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('parámetros repetidos: 400', async () => {
    for (const key of ['account_id', 'desde', 'hasta']) {
      const params = new URLSearchParams(withGroup(kind, base));
      params.append(key, params.get(key) as string);
      const response = await call('GET', `/reports/${kind}?${params.toString()}`, token);
      expect(response.status).toBe(400);
    }
  });

  it('desde = hasta y los extremos 2000-01-01 / 2100-12-31 se aceptan; desconocidos se ignoran', async () => {
    for (const [desde, hasta] of [
      ['2026-10-05', '2026-10-05'],
      ['2000-01-01', '2000-01-01'],
      ['2100-12-31', '2100-12-31'],
    ] as const) {
      const response = await get(
        kind,
        withGroup(kind, { account_id: accountId, desde, hasta, otro: '1' }),
      );
      expect(response.status).toBe(200);
    }
  });

  it('cuenta ajena e inexistente: 404 idéntico con no-store; 400 antes que 404', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const a = await get(kind, withGroup(kind, { ...base, account_id: foreign }));
    const b = await get(kind, withGroup(kind, { ...base, account_id: uuid() }));
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual(ERR('NOT_FOUND'));
    expect(await b.json()).toEqual(ERR('NOT_FOUND'));
    expect(a.headers.get('Cache-Control')).toBe('no-store');
    const invalidFirst = await get(
      kind,
      withGroup(kind, { account_id: foreign, desde: '2026-10-31', hasta: '2026-10-01' }),
    );
    expect(invalidFirst.status).toBe(400);
  });
});

describe('GET /reports/by-period: group', () => {
  const bad = ['', 'day', 'MONTH', 'months'];
  it.each(bad)('group=%j: 400 con no-store', async (group) => {
    const response = await byPeriod(group);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sin group y group repetido: 400', async () => {
    expect((await get('by-period', q())).status).toBe(400);
    const params = new URLSearchParams(q());
    params.append('group', 'month');
    params.append('group', 'year');
    expect((await call('GET', `/reports/by-period?${params}`, token)).status).toBe(400);
  });
});

describe('GET /reports/summary', () => {
  it('rango vacío: ceros con 200 y no-store', async () => {
    const response = await summary();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      accountId,
      desde: '2026-10-01',
      hasta: '2026-10-31',
      ingresos: 0,
      gastos: 0,
      balance: 0,
      cantidad: 0,
    });
  });

  it('totales exactos, balance = ingresos - gastos (puede ser negativo) y cantidad', async () => {
    await add('ingreso', 150_000, '2026-10-15');
    await add('ingreso', 1, '2026-10-16');
    await add('gasto', 4550, '2026-10-15');
    await add('gasto', 99, '2026-10-02');
    const body = await json(await summary());
    expect(Object.keys(body).sort()).toEqual(
      ['accountId', 'balance', 'cantidad', 'desde', 'gastos', 'hasta', 'ingresos'].sort(),
    );
    expect(body).toMatchObject({ ingresos: 150_001, gastos: 4649, balance: 145_352, cantidad: 4 });

    await add('gasto', 1_000_000, '2026-10-20');
    expect(await json(await summary())).toMatchObject({ balance: 145_352 - 1_000_000 });
  });

  it('rango inclusivo en ambos extremos y excluye lo adyacente', async () => {
    await add('gasto', 1, '2026-09-30');
    await add('gasto', 10, '2026-10-01');
    await add('ingreso', 100, '2026-10-31');
    await add('gasto', 1000, '2026-11-01');
    expect(await json(await summary())).toMatchObject({
      ingresos: 100,
      gastos: 10,
      balance: 90,
      cantidad: 2,
    });
    expect(await json(await summary('2026-10-31', '2026-10-31'))).toMatchObject({
      ingresos: 100,
      gastos: 0,
      cantidad: 1,
    });
    expect(await json(await summary('2026-09-30', '2026-11-01'))).toMatchObject({ cantidad: 4 });
  });

  it('excluye anulados (insertados y vía DELETE)', async () => {
    await add('gasto', 700, '2026-10-10');
    await add('gasto', 300, '2026-10-10', expense, accountId, { deleted_at: iso(NOW) });
    const created = await call('POST', '/transactions', token, {
      accountId,
      categoryId: income,
      tipo: 'ingreso',
      monto: 2500,
      fecha: '2026-10-20',
    });
    const { transaction } = await json(created);
    expect(await json(await summary())).toMatchObject({ ingresos: 2500, gastos: 700, cantidad: 2 });
    expect((await call('DELETE', `/transactions/${transaction.id}`, token)).status).toBe(204);
    expect(await json(await summary())).toMatchObject({ ingresos: 0, gastos: 700, cantidad: 1 });
  });

  it('cuenta archivada: 200 con sus totales', async () => {
    await add('gasto', 321, '2026-10-03');
    expect((await call('PATCH', `/accounts/${accountId}`, token, { archivada: true })).status).toBe(
      200,
    );
    const response = await summary();
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ gastos: 321, cantidad: 1 });
  });

  it('aislamiento entre cuentas del mismo usuario y entre usuarios', async () => {
    await add('gasto', 111, '2026-10-03');
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCategory = await insertCategory(db, second, { tipo: 'egreso' });
    await add('gasto', 5000, '2026-10-03', secondCategory, second);
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, foreign, { tipo: 'egreso' });
    await add('gasto', 7000, '2026-10-03', foreignCategory, foreign);

    expect(await json(await summary())).toMatchObject({ gastos: 111, cantidad: 1 });
    expect(await json(await summary(undefined, undefined, second))).toMatchObject({ gastos: 5000 });
    expect(await json(await summary(undefined, undefined, foreign, other.token))).toMatchObject({
      gastos: 7000,
      cantidad: 1,
    });
    expect((await summary(undefined, undefined, accountId, other.token)).status).toBe(404);
  });
});

describe('GET /reports/by-category', () => {
  it('rango vacío: grupos con total 0 e items vacíos', async () => {
    const response = await byCategory();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      accountId,
      desde: '2026-10-01',
      hasta: '2026-10-31',
      ingresos: { total: 0, items: [] },
      gastos: { total: 0, items: [] },
    });
  });

  it('agrupa por categoría, separa ingresos y gastos y calcula total y cantidad', async () => {
    const rent = await insertCategory(db, accountId, {
      tipo: 'egreso',
      nombre: 'Alquiler',
      icono: 'home',
      color: '#112233',
    });
    await add('gasto', 4000, '2026-10-02');
    await add('gasto', 600, '2026-10-20');
    await add('gasto', 90_000, '2026-10-01', rent);
    await add('ingreso', 200_000, '2026-10-31');
    const body = await json(await byCategory());
    expect(Object.keys(body).sort()).toEqual(
      ['accountId', 'desde', 'gastos', 'hasta', 'ingresos'].sort(),
    );
    expect(body.gastos.total).toBe(94_600);
    expect(body.gastos.items).toEqual([
      {
        categoryId: rent,
        nombre: 'Alquiler',
        icono: 'home',
        color: '#112233',
        archivada: false,
        total: 90_000,
        cantidad: 1,
      },
      {
        categoryId: expense,
        nombre: 'Comida',
        icono: 'tag',
        color: '#6B7280',
        archivada: false,
        total: 4600,
        cantidad: 2,
      },
    ]);
    expect(body.ingresos.total).toBe(200_000);
    expect(body.ingresos.items).toHaveLength(1);
    expect(body.ingresos.items[0]).toMatchObject({
      categoryId: income,
      nombre: 'Sueldo',
      total: 200_000,
    });
    expect(Object.keys(body.ingresos.items[0]).sort()).toEqual(
      ['archivada', 'cantidad', 'categoryId', 'color', 'icono', 'nombre', 'total'].sort(),
    );
  });

  it('solo categorías con movimientos vigentes en el rango', async () => {
    const unused = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Sin uso' });
    const onlyVoided = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Anulada' });
    const outside = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Fuera' });
    await add('gasto', 5, '2026-10-05', onlyVoided, accountId, { deleted_at: iso(NOW) });
    await add('gasto', 5, '2026-11-05', outside);
    await add('gasto', 50, '2026-10-05');
    const body = await json(await byCategory());
    expect(body.gastos.items.map((i: Json) => i.categoryId)).toEqual([expense]);
    expect(body.gastos.items.map((i: Json) => i.categoryId)).not.toContain(unused);
    expect(body.gastos.total).toBe(50);
  });

  it('incluye categorías archivadas con el indicador archivada', async () => {
    const old = await insertCategory(db, accountId, {
      tipo: 'egreso',
      nombre: 'Vieja',
      archivada: 1,
    });
    await add('gasto', 800, '2026-10-05', old);
    await add('gasto', 100, '2026-10-06');
    const body = await json(await byCategory());
    expect(body.gastos.items.map((i: Json) => [i.nombre, i.archivada, i.total])).toEqual([
      ['Vieja', true, 800],
      ['Comida', false, 100],
    ]);
    expect(body.gastos.total).toBe(900);
  });

  it('orden: total descendente y, a igual total, nombre ascendente', async () => {
    const mk = (nombre: string) => insertCategory(db, accountId, { tipo: 'egreso', nombre });
    const b = await mk('B');
    const a = await mk('A');
    const c = await mk('C');
    const big = await mk('Z grande');
    await add('gasto', 100, '2026-10-05', b);
    await add('gasto', 100, '2026-10-05', c);
    await add('gasto', 100, '2026-10-05', a);
    await add('gasto', 999, '2026-10-05', big);
    const body = await json(await byCategory());
    expect(body.gastos.items.map((i: Json) => i.categoryId)).toEqual([big, a, b, c]);
  });

  it('rango inclusivo y anulados excluidos de totales', async () => {
    await add('gasto', 1, '2026-09-30');
    await add('gasto', 10, '2026-10-01');
    await add('gasto', 100, '2026-10-31');
    await add('gasto', 1000, '2026-11-01');
    await add('gasto', 5000, '2026-10-15', expense, accountId, { deleted_at: iso(NOW) });
    const body = await json(await byCategory());
    expect(body.gastos.items).toHaveLength(1);
    expect(body.gastos.items[0]).toMatchObject({ total: 110, cantidad: 2 });
  });

  it('cuenta archivada se consulta; aislamiento entre cuentas y usuarios', async () => {
    await add('gasto', 111, '2026-10-03');
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCategory = await insertCategory(db, second, { tipo: 'egreso', nombre: 'Otra' });
    await add('gasto', 5000, '2026-10-03', secondCategory, second);
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, foreign, { tipo: 'egreso' });
    await add('gasto', 7000, '2026-10-03', foreignCategory, foreign);
    await call('PATCH', `/accounts/${accountId}`, token, { archivada: true });

    const mine = await json(await byCategory());
    expect(mine.gastos.items.map((i: Json) => i.categoryId)).toEqual([expense]);
    expect(mine.gastos.total).toBe(111);
    const secondBody = await json(await byCategory(undefined, undefined, second));
    expect(secondBody.gastos.items.map((i: Json) => i.categoryId)).toEqual([secondCategory]);
    expect((await byCategory(undefined, undefined, accountId, other.token)).status).toBe(404);
  });
});

describe('GET /reports/by-period', () => {
  it('group=month: relleno de ceros, orden ascendente y balance por punto', async () => {
    await add('gasto', 1000, '2026-10-15');
    await add('ingreso', 5000, '2026-10-20');
    await add('gasto', 200, '2026-12-01');
    const response = await byPeriod('month', '2026-09-10', '2027-01-20');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await json(response);
    expect(Object.keys(body).sort()).toEqual(
      ['accountId', 'desde', 'group', 'hasta', 'points'].sort(),
    );
    expect(body.group).toBe('month');
    const zero = (periodo: string) => ({
      periodo,
      ingresos: 0,
      gastos: 0,
      balance: 0,
      cantidad: 0,
    });
    expect(body.points).toEqual([
      zero('2026-09'),
      { periodo: '2026-10', ingresos: 5000, gastos: 1000, balance: 4000, cantidad: 2 },
      zero('2026-11'),
      { periodo: '2026-12', ingresos: 0, gastos: 200, balance: -200, cantidad: 1 },
      zero('2027-01'),
    ]);
  });

  it('recorta los extremos: solo se suma lo que está dentro del rango', async () => {
    await add('gasto', 1, '2026-10-09');
    await add('gasto', 10, '2026-10-10');
    await add('gasto', 100, '2026-11-20');
    await add('gasto', 1000, '2026-11-21');
    const body = await json(await byPeriod('month', '2026-10-10', '2026-11-20'));
    expect(body.points).toEqual([
      { periodo: '2026-10', ingresos: 0, gastos: 10, balance: -10, cantidad: 1 },
      { periodo: '2026-11', ingresos: 0, gastos: 100, balance: -100, cantidad: 1 },
    ]);
  });

  it('un rango dentro de un solo mes devuelve un único punto (aun vacío)', async () => {
    const body = await json(await byPeriod('month', '2026-10-05', '2026-10-06'));
    expect(body.points).toEqual([
      { periodo: '2026-10', ingresos: 0, gastos: 0, balance: 0, cantidad: 0 },
    ]);
  });

  it('cruce de año con diciembre -> enero', async () => {
    const body = await json(await byPeriod('month', '2026-12-31', '2027-01-01'));
    expect(body.points.map((p: Json) => p.periodo)).toEqual(['2026-12', '2027-01']);
  });

  it('group=year: agrupa por año, rellena años sin datos', async () => {
    await add('gasto', 100, '2024-03-01');
    await add('ingreso', 900, '2024-12-31');
    await add('gasto', 50, '2026-01-01');
    const body = await json(await byPeriod('year', '2023-06-01', '2026-06-30'));
    expect(body.group).toBe('year');
    expect(body.points).toEqual([
      { periodo: '2023', ingresos: 0, gastos: 0, balance: 0, cantidad: 0 },
      { periodo: '2024', ingresos: 900, gastos: 100, balance: 800, cantidad: 2 },
      { periodo: '2025', ingresos: 0, gastos: 0, balance: 0, cantidad: 0 },
      { periodo: '2026', ingresos: 0, gastos: 50, balance: -50, cantidad: 1 },
    ]);
  });

  it('group=year admite todo el rango 2000-2100 (101 puntos)', async () => {
    const response = await byPeriod('year', '2000-01-01', '2100-12-31');
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.points).toHaveLength(101);
    expect(body.points[0].periodo).toBe('2000');
    expect(body.points[100].periodo).toBe('2100');
  });

  it('group=month: 120 períodos se aceptan y 121 son 400', async () => {
    const ok = await byPeriod('month', '2016-01-01', '2025-12-31');
    expect(ok.status).toBe(200);
    expect((await json(ok)).points).toHaveLength(120);
    const ok2 = await byPeriod('month', '2016-01-31', '2025-12-01');
    expect(ok2.status).toBe(200);

    const tooMany = await byPeriod('month', '2015-12-31', '2025-12-01');
    expect(tooMany.status).toBe(400);
    expect(await tooMany.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(tooMany.headers.get('Cache-Control')).toBe('no-store');
    expect((await byPeriod('month', '2000-01-01', '2100-12-31')).status).toBe(400);
  });

  it('límite de 120 se valida antes de comprobar la cuenta (400, no 404)', async () => {
    expect((await byPeriod('month', '2000-01-01', '2100-12-31', uuid())).status).toBe(400);
  });

  it('excluye anulados y aísla por cuenta y usuario', async () => {
    await add('gasto', 100, '2026-10-05');
    await add('gasto', 900, '2026-10-05', expense, accountId, { deleted_at: iso(NOW) });
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCategory = await insertCategory(db, second, { tipo: 'egreso' });
    await add('gasto', 5000, '2026-10-05', secondCategory, second);
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, foreign, { tipo: 'egreso' });
    await add('gasto', 7000, '2026-10-05', foreignCategory, foreign);

    expect((await json(await byPeriod('month'))).points[0]).toMatchObject({
      gastos: 100,
      cantidad: 1,
    });
    expect(
      (await json(await byPeriod('month', undefined, undefined, second))).points[0],
    ).toMatchObject({
      gastos: 5000,
    });
    expect((await byPeriod('month', undefined, undefined, accountId, other.token)).status).toBe(
      404,
    );
  });

  it('cuenta archivada: 200', async () => {
    await add('gasto', 100, '2026-10-05');
    await call('PATCH', `/accounts/${accountId}`, token, { archivada: true });
    const response = await byPeriod('year');
    expect(response.status).toBe(200);
    expect((await json(response)).points[0]).toMatchObject({ periodo: '2026', gastos: 100 });
  });
});

describe('Reportes: desborde (fail-closed)', () => {
  it('toCategoryReport y toPeriodPoints rechazan totales fuera del rango entero seguro', () => {
    const row = {
      categoryId: 'c',
      nombre: 'n',
      icono: 'i',
      color: '#000000',
      archivada: 0,
      tipo: 'egreso' as const,
      total: 1,
      cantidad: 1,
    };
    expect(toCategoryReport([row]).gastos.total).toBe(1);
    expect(() => toCategoryReport([{ ...row, total: Number.MAX_SAFE_INTEGER + 2 }])).toThrow();
    expect(() => toCategoryReport([{ ...row, total: 2 ** 60 }])).toThrow();
    expect(() => toCategoryReport([{ ...row, cantidad: Number.NaN }])).toThrow();
    // La suma del grupo también se verifica.
    const half = Number.MAX_SAFE_INTEGER - 1;
    expect(() =>
      toCategoryReport([
        { ...row, total: half },
        { ...row, total: half },
      ]),
    ).toThrow();

    const p = { periodo: '2026-10', ingresos: 1, gastos: 2, cantidad: 1 };
    const pts: PeriodPointDto[] = toPeriodPoints([p], '2026-10-01', '2026-10-31', 'month');
    expect(pts).toEqual([{ ...p, balance: -1 }]);
    expect(() =>
      toPeriodPoints([{ ...p, ingresos: 2 ** 60 }], '2026-10-01', '2026-10-31', 'month'),
    ).toThrow();
    expect(() =>
      toPeriodPoints([{ ...p, ingresos: 1.5 }], '2026-10-01', '2026-10-31', 'month'),
    ).toThrow();
  });

  it('totales por encima de 2^53 responden 500 genérico en los tres endpoints', async () => {
    const rows = 90_073;
    await db
      .prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
         INSERT INTO transactions (id, account_id, category_id, tipo, monto, fecha, created_at, updated_at)
         SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
                substr(lower(hex(randomblob(2))), 2) || '-a' || substr(lower(hex(randomblob(2))), 2) ||
                '-' || lower(hex(randomblob(6))),
                ?2, ?3, 'ingreso', 99999999999, '2026-10-10', ?4, ?4 FROM n`,
      )
      .bind(rows, accountId, income, iso(NOW))
      .run();
    for (const response of [
      await summary(),
      await byCategory(),
      await byPeriod('month'),
      await byPeriod('year'),
    ]) {
      expect(response.status).toBe(500);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const text = await response.text();
      expect(JSON.parse(text)).toEqual(ERR('INTERNAL_ERROR'));
      expect(text).not.toMatch(/\d{12,}/);
    }
  });
});

describe('Repositorio de reportes', () => {
  it('un userId ajeno obtiene resultados vacíos aunque la cuenta tenga movimientos', async () => {
    await add('gasto', 100, '2026-10-10');
    const intruder = await userWithToken(db, 'intruso@example.com');
    const args = [accountId, '2026-10-01', '2026-10-31'] as const;
    expect(await summaryTotals(db, intruder.id, ...args)).toEqual({
      ingresos: 0,
      gastos: 0,
      cantidad: 0,
    });
    expect(await categoryTotals(db, intruder.id, ...args)).toEqual([]);
    expect(await periodTotals(db, intruder.id, ...args, 'month')).toEqual([]);
    expect(await summaryTotals(db, userId, ...args)).toMatchObject({ gastos: 100, cantidad: 1 });
  });

  it('la consulta de resumen usa ix_transactions_account_fecha', async () => {
    const { results } = await db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT count(*)
           FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.account_id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL
            AND t.tipo IN ('ingreso', 'gasto') AND t.fecha BETWEEN ?3 AND ?4`,
      )
      .bind(accountId, userId, '2026-10-01', '2026-10-31')
      .all<{ detail: string }>();
    expect(results.map((r) => r.detail).join('\n')).toContain('ix_transactions_account_fecha');
  });
});

describe('Regresión: calendar y transactions siguen funcionando', () => {
  it('GET /calendar y GET /transactions responden como antes', async () => {
    await add('gasto', 250, '2026-10-05');
    const calendar = await call('GET', `/calendar?account_id=${accountId}&month=2026-10`, token);
    expect(calendar.status).toBe(200);
    expect((await json(calendar)).days).toEqual([
      { fecha: '2026-10-05', ingresos: 0, gastos: 250, cantidad: 1 },
    ]);
    const list = await call('GET', `/transactions?account_id=${accountId}`, token);
    expect(list.status).toBe(200);
    expect(list.headers.get('Cache-Control')).toBe('no-store');
    expect(Object.keys(await json(list)).length).toBeGreaterThan(0);
  });

  it('una ruta /reports desconocida responde 404 y no hay escritura (POST no existe)', async () => {
    const response = await call('POST', '/reports/summary', token, {});
    expect([404, 405]).toContain(response.status);
  });
});
