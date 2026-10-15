import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { dailyTotals } from '../src/db/transaction-repository';
import { issueSession } from '../src/services/session-service';
import { toCalendarDays } from '../src/services/calendar-service';
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

// Cada prueba crea una base D1 local: con la máquina cargada, los 5 s por defecto no alcanzan.
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
  income = await insertCategory(db, accountId, { tipo: 'ingreso' });
  expense = await insertCategory(db, accountId, { tipo: 'egreso' });
}, DB_HOOK_TIMEOUT_MS);

const ERR = (code: string) => ({ error: { code, message: expect.any(String) } });
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const calendar = (month: string, account = accountId, as = token) =>
  call('GET', `/calendar?account_id=${account}&month=${month}`, as);

const add = (tipo: 'ingreso' | 'gasto', monto: number, fecha: string, account = accountId) =>
  insertTransactionRow(db, account, tipo === 'ingreso' ? income : expense, {
    tipo,
    monto,
    fecha,
  });

describe('GET /calendar: autenticación y orden de validación', () => {
  it('sin token y con token inválido responde 401 con no-store', async () => {
    for (const [as, code] of [
      ['', 'UNAUTHORIZED'],
      ['no-es-un-jwt', 'INVALID_TOKEN'],
    ] as const) {
      const response = await calendar('2026-10', accountId, as);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(ERR(code));
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('con un JWT v1 responde 401', async () => {
    const v1 = await issueSession({ sub: userId, email: 'usuario@example.com' }, AUTH_ENV, NOW);
    const response = await calendar('2026-10', accountId, v1.accessToken);
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  const id = uuid();
  const invalid: [string, string][] = [
    ['sin account_id', '/calendar?month=2026-10'],
    ['sin month', `/calendar?account_id=${id}`],
    ['sin parámetros', '/calendar'],
    ['account_id no UUID', '/calendar?account_id=abc&month=2026-10'],
    ['account_id en mayúsculas', `/calendar?account_id=${id.toUpperCase()}&month=2026-10`],
    ['account_id vacío', '/calendar?account_id=&month=2026-10'],
    ['account_id repetido', `/calendar?account_id=${id}&account_id=${id}&month=2026-10`],
    ['month 2026-13', `/calendar?account_id=${id}&month=2026-13`],
    ['month 2026-00', `/calendar?account_id=${id}&month=2026-00`],
    ['month 2026-1', `/calendar?account_id=${id}&month=2026-1`],
    ['month 1999-12', `/calendar?account_id=${id}&month=1999-12`],
    ['month 2101-01', `/calendar?account_id=${id}&month=2101-01`],
    ['month con día', `/calendar?account_id=${id}&month=2026-10-01`],
    ['month vacío', `/calendar?account_id=${id}&month=`],
    ['month repetido', `/calendar?account_id=${id}&month=2026-10&month=2026-11`],
    ['month con letras', `/calendar?account_id=${id}&month=abcd-ef`],
  ];

  it.each(invalid)('%s: 400 INVALID_REQUEST con no-store', async (_name, path) => {
    const response = await call('GET', path, token);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('los límites 2000-01 y 2100-12 se aceptan y los desconocidos se ignoran', async () => {
    for (const month of ['2000-01', '2100-12']) {
      const response = await calendar(month);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ accountId, month, days: [] });
    }
    const extra = await call(
      'GET',
      `/calendar?account_id=${accountId}&month=2026-10&otro=1`,
      token,
    );
    expect(extra.status).toBe(200);
  });

  it('cuenta ajena e inexistente: 404 idéntico con no-store, y 400 antes que 404', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, foreign);
    await insertTransactionRow(db, foreign, foreignCategory, { fecha: '2026-10-05' });

    const a = await calendar('2026-10', foreign);
    const b = await calendar('2026-10', uuid());
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual(ERR('NOT_FOUND'));
    expect(await b.json()).toEqual(ERR('NOT_FOUND'));
    expect(a.headers.get('Cache-Control')).toBe('no-store');

    const invalidFirst = await calendar('2026-13', foreign);
    expect(invalidFirst.status).toBe(400);
  });
});

describe('GET /calendar: totales', () => {
  it('mes sin movimientos: 200 con days vacío y no-store', async () => {
    const response = await calendar('2026-10');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ accountId, month: '2026-10', days: [] });
  });

  it('totales exactos en centavos, varios días, cantidad y orden ascendente', async () => {
    await add('gasto', 4550, '2026-10-15');
    await add('ingreso', 150_000, '2026-10-15');
    await add('ingreso', 1, '2026-10-15');
    await add('gasto', 99, '2026-10-15');
    await add('gasto', 1000, '2026-10-02');
    await add('ingreso', 5000, '2026-10-31');
    const body = (await (await calendar('2026-10')).json()) as Json;
    expect(Object.keys(body).sort()).toEqual(['accountId', 'days', 'month']);
    expect(body.days).toEqual([
      { fecha: '2026-10-02', ingresos: 0, gastos: 1000, cantidad: 1 },
      { fecha: '2026-10-15', ingresos: 150_001, gastos: 4649, cantidad: 4 },
      { fecha: '2026-10-31', ingresos: 5000, gastos: 0, cantidad: 1 },
    ]);
    for (const day of body.days) {
      expect(Object.keys(day).sort()).toEqual(['cantidad', 'fecha', 'gastos', 'ingresos']);
    }
  });

  it('un mes completo devuelve a lo sumo 31 días en orden ascendente', async () => {
    for (let day = 31; day >= 1; day--) {
      await add('gasto', day, `2026-10-${String(day).padStart(2, '0')}`);
    }
    const body = (await (await calendar('2026-10')).json()) as Json;
    expect(body.days).toHaveLength(31);
    const fechas = body.days.map((d: Json) => d.fecha);
    expect(fechas).toEqual([...fechas].sort());
  });

  it('excluye los movimientos anulados y reaparece el total al anular vía DELETE', async () => {
    await add('gasto', 700, '2026-10-10');
    await insertTransactionRow(db, accountId, expense, {
      monto: 300,
      fecha: '2026-10-10',
      deleted_at: iso(NOW),
    });
    await insertTransactionRow(db, accountId, expense, {
      monto: 999,
      fecha: '2026-10-11',
      deleted_at: iso(NOW),
    });
    let body = (await (await calendar('2026-10')).json()) as Json;
    expect(body.days).toEqual([{ fecha: '2026-10-10', ingresos: 0, gastos: 700, cantidad: 1 }]);

    const created = await call('POST', '/transactions', token, {
      accountId,
      categoryId: income,
      tipo: 'ingreso',
      monto: 2500,
      fecha: '2026-10-20',
    });
    const { transaction } = (await created.json()) as Json;
    body = (await (await calendar('2026-10')).json()) as Json;
    expect(body.days.at(-1)).toEqual({
      fecha: '2026-10-20',
      ingresos: 2500,
      gastos: 0,
      cantidad: 1,
    });
    expect((await call('DELETE', `/transactions/${transaction.id}`, token)).status).toBe(204);
    body = (await (await calendar('2026-10')).json()) as Json;
    expect(body.days.map((d: Json) => d.fecha)).toEqual(['2026-10-10']);
  });

  const boundaries: [string, string, string, string][] = [
    ['octubre', '2026-10', '2026-09-30', '2026-11-01'],
    ['febrero bisiesto 2024 (29 días)', '2024-02', '2024-01-31', '2024-03-01'],
    ['febrero 2100 (28 días, no bisiesto)', '2100-02', '2100-01-31', '2100-03-01'],
    ['febrero 2026 (28 días)', '2026-02', '2026-01-31', '2026-03-01'],
    ['diciembre', '2026-12', '2026-11-30', '2027-01-01'],
    ['enero', '2026-01', '2025-12-31', '2026-02-01'],
  ];

  it.each(boundaries)('frontera de mes: %s', async (_name, month, before, after) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const first = `${month}-01`;
    const end = `${month}-${String(last).padStart(2, '0')}`;
    await add('gasto', 1, before);
    await add('gasto', 10, first);
    await add('ingreso', 100, end);
    await add('gasto', 1000, after);
    const body = (await (await calendar(month)).json()) as Json;
    expect(body.days).toEqual([
      { fecha: first, ingresos: 0, gastos: 10, cantidad: 1 },
      { fecha: end, ingresos: 100, gastos: 0, cantidad: 1 },
    ]);
  });

  it('cuenta archivada: 200 con sus totales', async () => {
    await add('gasto', 321, '2026-10-03');
    expect((await call('PATCH', `/accounts/${accountId}`, token, { archivada: true })).status).toBe(
      200,
    );
    const response = await calendar('2026-10');
    expect(response.status).toBe(200);
    expect(((await response.json()) as Json).days).toEqual([
      { fecha: '2026-10-03', ingresos: 0, gastos: 321, cantidad: 1 },
    ]);
  });

  it('otra cuenta del mismo usuario no cuenta; otro usuario no ve ni afecta los totales', async () => {
    await add('gasto', 111, '2026-10-03');
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCategory = await insertCategory(db, second, { tipo: 'egreso' });
    await insertTransactionRow(db, second, secondCategory, { monto: 5000, fecha: '2026-10-03' });
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, foreign, { tipo: 'egreso' });
    await insertTransactionRow(db, foreign, foreignCategory, { monto: 7000, fecha: '2026-10-03' });

    const mine = (await (await calendar('2026-10')).json()) as Json;
    expect(mine.days).toEqual([{ fecha: '2026-10-03', ingresos: 0, gastos: 111, cantidad: 1 }]);
    const other2 = (await (await calendar('2026-10', second)).json()) as Json;
    expect(other2.days).toEqual([{ fecha: '2026-10-03', ingresos: 0, gastos: 5000, cantidad: 1 }]);
    // El otro usuario consulta su propia cuenta: solo ve lo suyo.
    const theirs = await call('GET', `/calendar?account_id=${foreign}&month=2026-10`, other.token);
    expect(((await theirs.json()) as Json).days[0]).toMatchObject({ gastos: 7000, cantidad: 1 });
    // Y no puede leer la cuenta de este usuario.
    expect(
      (await call('GET', `/calendar?account_id=${accountId}&month=2026-10`, other.token)).status,
    ).toBe(404);
  });
});

describe('GET /calendar: desborde (fail-closed)', () => {
  it('toCalendarDays rechaza totales fuera del rango entero seguro', () => {
    const ok = { fecha: '2026-10-01', ingresos: 1, gastos: 2, cantidad: 1 };
    expect(toCalendarDays([ok])).toEqual([ok]);
    for (const bad of [
      { ...ok, ingresos: Number.MAX_SAFE_INTEGER + 2 },
      { ...ok, gastos: 2 ** 60 },
      { ...ok, ingresos: 1.5 },
      { ...ok, cantidad: Number.NaN },
    ]) {
      expect(() => toCalendarDays([bad])).toThrow();
    }
  });

  it('un total diario por encima de 2^53 responde 500 genérico sin cifras imprecisas', async () => {
    // 90 073 movimientos de 99 999 999 999 centavos el mismo día superan Number.MAX_SAFE_INTEGER.
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
    const response = await calendar('2026-10');
    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(ERR('INTERNAL_ERROR'));
    expect(text).not.toMatch(/\d{12,}/);
  });
});

describe('dailyTotals (repositorio)', () => {
  it('acota por usuario: un userId ajeno obtiene [] aunque la cuenta tenga movimientos', async () => {
    await add('gasto', 100, '2026-10-10');
    const intruder = await userWithToken(db, 'intruso@example.com');
    expect(await dailyTotals(db, intruder.id, accountId, '2026-10')).toEqual([]);
    expect(await dailyTotals(db, userId, accountId, '2026-10')).toEqual([
      { fecha: '2026-10-10', ingresos: 0, gastos: 100, cantidad: 1 },
    ]);
  });

  it('usa ix_transactions_account_fecha (sin escaneo completo de transactions)', async () => {
    await add('gasto', 100, '2026-10-10');
    const { results } = await db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT t.fecha,
              COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto END), 0) AS gastos,
              count(*) AS cantidad
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.account_id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL
          AND t.fecha >= ?3 AND t.fecha <= ?4
        GROUP BY t.fecha ORDER BY t.fecha`,
      )
      .bind(accountId, userId, '2026-10-01', '2026-10-31')
      .all<{ detail: string }>();
    const plan = results.map((row) => row.detail).join('\n');
    expect(plan).toContain('ix_transactions_account_fecha');
    expect(plan).not.toMatch(/SCAN t(?:ransactions)?\b(?! USING)/);
  });
});
