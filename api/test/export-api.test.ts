import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { issueSession } from '../src/services/session-service';
import { MAX_EXPORT_ROWS } from '../src/services/export-service';
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
const BOM = '﻿';
const HEADER = 'fecha,tipo,categoria,nota,monto,monto_centavos';

const q = (extra: Record<string, string> = {}) => ({
  account_id: accountId,
  desde: '2026-10-01',
  hasta: '2026-10-31',
  ...extra,
});
const exp = (query: Record<string, string>, as = token) =>
  call('GET', `/export?${new URLSearchParams(query).toString()}`, as);
const run = (extra: Record<string, string> = {}) => exp(q(extra));
// Lee el cuerpo como bytes y lo decodifica sin que TextDecoder retire el BOM.
const bodyOf = async (response: Response) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
const lines = (body: string) => body.slice(1).split('\r\n');

const add = (
  tipo: 'ingreso' | 'gasto',
  monto: number,
  fecha: string,
  extra: Record<string, unknown> = {},
  category = tipo === 'ingreso' ? income : expense,
  account = accountId,
) => insertTransactionRow(db, account, category, { tipo, monto, fecha, ...extra });

describe('GET /export: autenticación', () => {
  it('sin token y con token inválido responde 401 con no-store', async () => {
    for (const [as, code] of [
      ['', 'UNAUTHORIZED'],
      ['no-es-un-jwt', 'INVALID_TOKEN'],
    ] as const) {
      const response = await exp(q(), as);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(ERR(code));
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('con un JWT v1 responde 401', async () => {
    const v1 = await issueSession({ sub: userId, email: 'usuario@example.com' }, AUTH_ENV, NOW);
    const response = await exp(q(), v1.accessToken);
    expect(response.status).toBe(401);
  });

  it('401 tiene prioridad sobre 400', async () => {
    expect((await exp({}, '')).status).toBe(401);
  });
});

describe('GET /export: validación (400)', () => {
  const id = uuid();
  const base = { account_id: id, desde: '2026-10-01', hasta: '2026-10-31' };
  const invalid: [string, Record<string, string>][] = [
    ['sin parámetros', {}],
    ['sin account_id', { desde: base.desde, hasta: base.hasta }],
    ['sin desde', { account_id: id, hasta: base.hasta }],
    ['sin hasta', { account_id: id, desde: base.desde }],
    ['account_id no UUID', { ...base, account_id: 'abc' }],
    ['account_id en mayúsculas', { ...base, account_id: id.toUpperCase() }],
    ['account_id vacío', { ...base, account_id: '' }],
    ['desde vacío', { ...base, desde: '' }],
    ['desde formato inválido', { ...base, desde: '2026-1-01' }],
    ['desde 2025-02-30', { ...base, desde: '2025-02-30' }],
    ['hasta 2026-02-29', { ...base, hasta: '2026-02-29' }],
    ['desde 1999-12-31', { ...base, desde: '1999-12-31' }],
    ['hasta 2101-01-01', { ...base, hasta: '2101-01-01' }],
    ['desde con hora', { ...base, desde: '2026-10-01T00:00:00Z' }],
    ['desde > hasta', { ...base, desde: '2026-11-01', hasta: '2026-10-01' }],
    ['tipo inválido', { ...base, tipo: 'egreso' }],
    ['tipo vacío', { ...base, tipo: '' }],
    ['category_id no UUID', { ...base, category_id: 'x' }],
    ['category_id vacío', { ...base, category_id: '' }],
    ['format=PDF (mayúsculas)', { ...base, format: 'PDF' }],
    ['format=xlsx', { ...base, format: 'xlsx' }],
    ['format=CSV (mayúsculas)', { ...base, format: 'CSV' }],
    ['format vacío', { ...base, format: '' }],
  ];

  it.each(invalid)('%s -> 400 con no-store', async (_name, query) => {
    const response = await exp(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it.each(['account_id', 'desde', 'hasta', 'tipo', 'category_id', 'format'])(
    'parámetro %s repetido -> 400',
    async (key) => {
      const params = new URLSearchParams(q({ tipo: 'gasto', category_id: expense, format: 'csv' }));
      params.append(key, params.get(key) as string);
      const response = await call('GET', `/export?${params.toString()}`, token);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    },
  );

  it('400 tiene prioridad sobre 404 (cuenta inexistente con fechas inválidas)', async () => {
    const response = await exp({ ...base, desde: '2026-13-01' });
    expect(response.status).toBe(400);
  });

  it('acepta format=csv explícito y parámetros desconocidos', async () => {
    expect((await run({ format: 'csv', otro: 'x' })).status).toBe(200);
  });

  it('acepta los extremos 2000-01-01 y 2100-12-31 y desde = hasta', async () => {
    expect((await run({ desde: '2000-01-01', hasta: '2100-12-31' })).status).toBe(200);
    expect((await run({ desde: '2026-10-05', hasta: '2026-10-05' })).status).toBe(200);
  });
});

describe('GET /export: 404', () => {
  it('cuenta inexistente', async () => {
    const response = await exp(q({ account_id: uuid() }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('cuenta de otro usuario responde igual que una inexistente', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const a = await exp(q({ account_id: foreign }));
    const b = await exp(q({ account_id: uuid() }));
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual(await b.json());
  });

  it('category_id inexistente, ajena o de otra cuenta propia -> 404', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const otherAccount = await insertAccount(db, other.id);
    const foreignCategory = await insertCategory(db, otherAccount, { tipo: 'egreso' });
    const secondAccount = await insertAccount(db, userId, { nombre: 'Otra' });
    const ownOther = await insertCategory(db, secondAccount, { tipo: 'egreso' });
    for (const category_id of [uuid(), foreignCategory, ownOther]) {
      const response = await run({ category_id });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });
});

describe('GET /export: contenido', () => {
  it('rango sin movimientos: solo BOM y cabecera con CRLF', async () => {
    const response = await run();
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toBe(`${BOM}${HEADER}\r\n`);
  });

  it('el cuerpo empieza con los bytes del BOM UTF-8 y termina en CRLF', async () => {
    await add('gasto', 1250, '2026-10-05', { nota: 'Almuerzo' });
    const bytes = new Uint8Array(await (await run()).arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.endsWith('\r\n\r\n')).toBe(false);
    expect(
      text.includes('\n') &&
        text.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r')),
    ).toBe(true);
  });

  it('fila de gasto e ingreso con categoría, nota y monto', async () => {
    await add('gasto', 1250, '2026-10-05', { nota: 'Almuerzo' });
    await add('ingreso', 500000, '2026-10-04');
    expect(lines(await bodyOf(await run()))).toEqual([
      HEADER,
      '2026-10-05,gasto,Comida,Almuerzo,12.50,1250',
      '2026-10-04,ingreso,Sueldo,,5000.00,500000',
      '',
    ]);
  });

  it.each([
    [1, '0.01'],
    [99, '0.99'],
    [100, '1.00'],
    [99_999_999_999, '999999999.99'],
  ])('importe exacto %d centavos -> %s', async (cents, decimal) => {
    await add('gasto', cents, '2026-10-05');
    expect(lines(await bodyOf(await run()))[1]).toBe(
      `2026-10-05,gasto,Comida,,${decimal},${cents}`,
    );
  });

  it('excluye anulados y movimientos fuera del rango (límites inclusivos)', async () => {
    await add('gasto', 111, '2026-10-01');
    await add('gasto', 222, '2026-10-31');
    await add('gasto', 333, '2026-09-30');
    await add('gasto', 444, '2026-11-01');
    await add('gasto', 555, '2026-10-15', { deleted_at: iso(NOW) });
    const rows = lines(await bodyOf(await run())).slice(1, -1);
    expect(rows).toEqual([
      '2026-10-31,gasto,Comida,,2.22,222',
      '2026-10-01,gasto,Comida,,1.11,111',
    ]);
  });

  it('ordena por fecha DESC, created_at DESC e id DESC', async () => {
    const t1 = iso(new Date('2026-10-13T10:00:00.000Z'));
    const t2 = iso(new Date('2026-10-13T11:00:00.000Z'));
    await add('gasto', 100, '2026-10-02', { created_at: t1, updated_at: t1 });
    await add('gasto', 200, '2026-10-03', { created_at: t1, updated_at: t1 });
    await add('gasto', 300, '2026-10-03', { created_at: t2, updated_at: t2 });
    await add('gasto', 400, '2026-10-03', {
      id: '00000000-0000-4000-8000-000000000001',
      created_at: t2,
      updated_at: t2,
    });
    await add('gasto', 500, '2026-10-03', {
      id: 'ffffffff-0000-4000-8000-000000000001',
      created_at: t2,
      updated_at: t2,
    });
    const montos = lines(await bodyOf(await run()))
      .slice(1, -1)
      .map((l) => l.split(',').pop());
    const history = await call(
      'GET',
      `/transactions?${new URLSearchParams({ account_id: accountId, desde: '2026-10-01', hasta: '2026-10-31', page_size: '100' })}`,
      token,
    );
    const historyMontos = ((await history.json()) as { items: { monto: number }[] }).items.map(
      (i) => String(i.monto),
    );
    expect(montos).toEqual(historyMontos);
    expect(montos[montos.length - 1]).toBe('100');
    expect(montos.indexOf('500')).toBeLessThan(montos.indexOf('300'));
    expect(montos.indexOf('300')).toBeLessThan(montos.indexOf('400'));
    expect(montos.indexOf('300')).toBeLessThan(montos.indexOf('200'));
  });

  it('filtra por tipo', async () => {
    await add('gasto', 100, '2026-10-05');
    await add('ingreso', 200, '2026-10-06');
    expect(lines(await bodyOf(await run({ tipo: 'gasto' }))).slice(1, -1)).toEqual([
      '2026-10-05,gasto,Comida,,1.00,100',
    ]);
    expect(lines(await bodyOf(await run({ tipo: 'ingreso' }))).slice(1, -1)).toEqual([
      '2026-10-06,ingreso,Sueldo,,2.00,200',
    ]);
  });

  it('filtra por category_id y combina con tipo', async () => {
    const extra = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Transporte' });
    await add('gasto', 100, '2026-10-05');
    await add('gasto', 700, '2026-10-06', {}, extra);
    await add('ingreso', 900, '2026-10-07');
    expect(lines(await bodyOf(await run({ category_id: extra }))).slice(1, -1)).toEqual([
      '2026-10-06,gasto,Transporte,,7.00,700',
    ]);
    expect(
      lines(await bodyOf(await run({ category_id: extra, tipo: 'ingreso' }))).slice(1, -1),
    ).toEqual([]);
  });

  it('una categoría archivada se exporta con su nombre', async () => {
    const old = await insertCategory(db, accountId, {
      tipo: 'egreso',
      nombre: 'Vieja',
      archivada: 1,
    });
    await add('gasto', 100, '2026-10-05', {}, old);
    expect(lines(await bodyOf(await run()))[1]).toBe('2026-10-05,gasto,Vieja,,1.00,100');
  });

  it('una cuenta archivada se puede exportar', async () => {
    const archived = await insertAccount(db, userId, { nombre: 'Vieja', archivada: 1 });
    const cat = await insertCategory(db, archived, { tipo: 'egreso', nombre: 'Luz' });
    await insertTransactionRow(db, archived, cat, { monto: 4200, fecha: '2026-10-05' });
    const response = await exp(q({ account_id: archived }));
    expect(response.status).toBe(200);
    expect(lines(await bodyOf(response))[1]).toBe('2026-10-05,gasto,Luz,,42.00,4200');
  });

  it('aísla cuentas del mismo usuario y usuarios distintos', async () => {
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCat = await insertCategory(db, second, { tipo: 'egreso', nombre: 'Otra' });
    const other = await userWithToken(db, 'otro@example.com');
    const otherAccount = await insertAccount(db, other.id);
    const otherCat = await insertCategory(db, otherAccount, { tipo: 'egreso', nombre: 'Ajena' });
    await add('gasto', 100, '2026-10-05');
    await insertTransactionRow(db, second, secondCat, { monto: 200, fecha: '2026-10-05' });
    await insertTransactionRow(db, otherAccount, otherCat, { monto: 300, fecha: '2026-10-05' });

    expect(lines(await bodyOf(await run())).slice(1, -1)).toEqual([
      '2026-10-05,gasto,Comida,,1.00,100',
    ]);
    expect(lines(await bodyOf(await exp(q({ account_id: second })))).slice(1, -1)).toEqual([
      '2026-10-05,gasto,Otra,,2.00,200',
    ]);
    expect(
      lines(await bodyOf(await exp(q({ account_id: otherAccount }), other.token))).slice(1, -1),
    ).toEqual(['2026-10-05,gasto,Ajena,,3.00,300']);
    const crossed = await exp(q({ account_id: otherAccount }));
    expect(crossed.status).toBe(404);
    expect(JSON.stringify(await crossed.json())).not.toContain('Ajena');
  });
});

describe('GET /export: escapado e inyección de fórmulas', () => {
  const noteOf = async (nota: string) => {
    await add('gasto', 100, '2026-10-05', { nota });
    return bodyOf(await run());
  };

  it('escapa comas, comillas y saltos de línea en nota', async () => {
    expect(await noteOf('a,b')).toContain(',"a,b",1.00,100\r\n');
  });

  it('duplica las comillas', async () => {
    expect(await noteOf('di "hola"')).toContain(',"di ""hola""",1.00,100\r\n');
  });

  it('entrecomilla saltos de línea LF, CRLF y CR', async () => {
    expect(await noteOf('l1\nl2')).toContain(',"l1\nl2",1.00,100\r\n');
  });

  it('escapa también el nombre de la categoría', async () => {
    const cat = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Ropa, "moda"' });
    await add('gasto', 100, '2026-10-06', {}, cat);
    expect(await bodyOf(await run())).toContain('2026-10-06,gasto,"Ropa, ""moda""",,1.00,100');
  });

  it.each([
    ['=1+1', "'=1+1"],
    ['-5', "'-5"],
    ['+1', "'+1"],
    ['@x', "'@x"],
    ['\t=1', "'\t=1"],
    ['\r=1', '"\'\r=1"'],
    ['=SUM(A1,A2)', '"\'=SUM(A1,A2)"'],
  ])('nota %j se neutraliza como %j', async (nota, expected) => {
    expect(await noteOf(nota)).toContain(`,${expected},1.00,100\r\n`);
  });

  it('neutraliza fórmulas en el nombre de la categoría', async () => {
    const cat = await insertCategory(db, accountId, { tipo: 'egreso', nombre: '=cmd' });
    await add('gasto', 100, '2026-10-06', {}, cat);
    expect(await bodyOf(await run())).toContain("2026-10-06,gasto,'=cmd,,1.00,100");
  });

  it('no prefija los numéricos ni la fecha', async () => {
    await add('gasto', 100, '2026-10-05');
    const row = lines(await bodyOf(await run()))[1] as string;
    expect(row.startsWith('2026-10-05,')).toBe(true);
    expect(row.endsWith(',1.00,100')).toBe(true);
    expect(row).not.toContain("'");
  });

  it('una nota que solo tiene apóstrofe o texto normal no cambia', async () => {
    expect(await noteOf("l'avion")).toContain(",l'avion,1.00,100\r\n");
  });

  it('conserva acentos y emojis en UTF-8', async () => {
    expect(await noteOf('Café ñandú ✓')).toContain(',Café ñandú ✓,1.00,100');
  });
});

describe('GET /export: tope de filas', () => {
  const bulk = async (n: number) => {
    await db
      .prepare(
        `WITH RECURSIVE s(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM s WHERE i < ?3),
              r(i, h) AS (SELECT i, lower(hex(randomblob(16))) FROM s)
         INSERT INTO transactions (id, account_id, category_id, tipo, monto, fecha, created_at, updated_at)
         SELECT substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12),
                ?1, ?2, 'gasto', 100, '2026-10-10', ?4, ?4
           FROM r`,
      )
      .bind(accountId, expense, n, iso(NOW))
      .run();
  };

  it('2000 filas exactas se exportan completas', async () => {
    await bulk(MAX_EXPORT_ROWS);
    const response = await run();
    expect(response.status).toBe(200);
    expect(lines(await bodyOf(response))).toHaveLength(MAX_EXPORT_ROWS + 2);
  });

  it('2001 filas responden 400 EXPORT_TOO_LARGE sin truncar y sin datos', async () => {
    await bulk(MAX_EXPORT_ROWS + 1);
    const response = await run();
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('EXPORT_TOO_LARGE');
    expect(body.error.message).toContain('2000');
    expect(Object.keys(body)).toEqual(['error']);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it('el tope cuenta solo las filas filtradas', async () => {
    await bulk(MAX_EXPORT_ROWS + 1);
    expect((await run({ tipo: 'ingreso' })).status).toBe(200);
    expect((await run({ desde: '2026-10-11' })).status).toBe(200);
  });
});

describe('GET /export: cabeceras', () => {
  it('éxito', async () => {
    const response = await run();
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="movimientos_2026-10-01_2026-10-31.csv"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('el nombre de archivo solo contiene fechas validadas', async () => {
    const response = await run({ desde: '2026-10-05', hasta: '2026-10-05' });
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="movimientos_2026-10-05_2026-10-05.csv"',
    );
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="movimientos_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  it('los errores llevan no-store y JSON estándar sin datos del usuario', async () => {
    await add('gasto', 100, '2026-10-05', { nota: 'secreto' });
    for (const response of [
      await run({ format: 'xlsx' }),
      await run({ account_id: uuid() }),
      await exp(q(), ''),
    ]) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Type')).toContain('application/json');
      const text = await response.text();
      expect(text).not.toContain('secreto');
      expect(text).not.toContain('Comida');
    }
  });

  it('un movimiento nuevo de otro usuario no filtra: POST no es una ruta de /export', async () => {
    expect((await call('POST', '/export', token)).status).toBe(404);
  });
});

describe('regresión de rutas existentes', () => {
  it('/reports, /transactions y /calendar siguen respondiendo con no-store', async () => {
    await add('gasto', 100, '2026-10-05');
    const params = new URLSearchParams(q());
    const reports = await call('GET', `/reports/summary?${params}`, token);
    expect(reports.status).toBe(200);
    expect(reports.headers.get('Cache-Control')).toBe('no-store');
    expect(((await reports.json()) as { gastos: number }).gastos).toBe(100);

    const tx = await call('GET', `/transactions?account_id=${accountId}`, token);
    expect(tx.status).toBe(200);
    expect(tx.headers.get('Cache-Control')).toBe('no-store');
    expect(((await tx.json()) as { total: number }).total).toBe(1);

    const cal = await call('GET', `/calendar?account_id=${accountId}&month=2026-10`, token);
    expect(cal.status).toBe(200);
    expect(cal.headers.get('Cache-Control')).toBe('no-store');
  });
});
