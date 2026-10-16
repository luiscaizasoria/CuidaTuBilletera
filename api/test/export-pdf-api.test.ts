import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { MAX_EXPORT_ROWS } from '../src/services/export-service';
import { ROWS_PER_PAGE } from '../src/lib/pdf';
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
import { inspectPdf, latin1 } from './pdf-helpers';
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
  accountId = await insertAccount(db, userId, { nombre: 'Mi cuenta' });
  income = await insertCategory(db, accountId, { tipo: 'ingreso', nombre: 'Sueldo' });
  expense = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Comida' });
}, DB_HOOK_TIMEOUT_MS);

const ERR = (code: string) => ({ error: { code, message: expect.any(String) } });
const q = (extra: Record<string, string> = {}) => ({
  account_id: accountId,
  desde: '2026-10-01',
  hasta: '2026-10-31',
  format: 'pdf',
  ...extra,
});
const exp = (query: Record<string, string>, as = token) =>
  call('GET', `/export?${new URLSearchParams(query).toString()}`, as);
const run = (extra: Record<string, string> = {}) => exp(q(extra));
const pdfOf = async (response: Response) =>
  inspectPdf(new Uint8Array(await response.arrayBuffer()));
const textOf = async (response: Response) => (await pdfOf(response)).pages.flat();

const add = (
  tipo: 'ingreso' | 'gasto',
  monto: number,
  fecha: string,
  extra: Record<string, unknown> = {},
  category = tipo === 'ingreso' ? income : expense,
  account = accountId,
) => insertTransactionRow(db, account, category, { tipo, monto, fecha, ...extra });

describe('GET /export?format=pdf: respuesta', () => {
  it('200 con cabeceras de descarga y PDF bien formado', async () => {
    await add('gasto', 1250, '2026-10-05', { nota: 'Almuerzo' });
    const response = await run();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="movimientos_2026-10-01_2026-10-31.pdf"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Number(response.headers.get('Content-Length') ?? bytes.length)).toBe(bytes.length);
    const pdf = inspectPdf(bytes);
    expect(pdf.raw.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.startxref).toBe(pdf.xrefOffset);
    expect(pdf.pages[0]).toEqual(
      expect.arrayContaining([
        'Cuenta: Mi cuenta',
        'Período: 2026-10-01 a 2026-10-31',
        'Comida',
        'Almuerzo',
        '-12.50',
        'Balance',
      ]),
    );
  });

  it('sin movimientos: una página con «Sin movimientos»', async () => {
    const pdf = await pdfOf(await run());
    expect(pdf.count).toBe(1);
    expect(pdf.pages[0]).toContain('Sin movimientos');
  });

  it('los bytes WinAnsi llegan intactos por HTTP (ñ = 0xF1, emoji = ?)', async () => {
    await add('gasto', 100, '2026-10-05', { nota: 'Café ñandú ¿ok? (x) 😀' });
    const pdf = await pdfOf(await run());
    expect(pdf.pages[0]).toContain('Café ñandú ¿ok? (x) ?');
    expect(pdf.raw).toContain('Café ñandú ¿ok? \\(x\\) ?');
  });

  it('las cuentas archivadas y las categorías archivadas se exportan', async () => {
    const archived = await insertAccount(db, userId, { nombre: 'Vieja', archivada: 1 });
    const cat = await insertCategory(db, archived, { tipo: 'egreso', nombre: 'Luz', archivada: 1 });
    await insertTransactionRow(db, archived, cat, { monto: 4200, fecha: '2026-10-05' });
    const text = await textOf(await run({ account_id: archived }));
    expect(text).toEqual(expect.arrayContaining(['Cuenta: Vieja', 'Luz', '-42.00']));
  });
});

describe('GET /export?format=pdf: datos', () => {
  it('excluye anulados y fuera de rango, con límites inclusivos y totales exactos', async () => {
    await add('ingreso', 100000, '2026-10-01');
    await add('gasto', 222, '2026-10-31');
    await add('gasto', 333, '2026-09-30');
    await add('gasto', 444, '2026-11-01');
    await add('gasto', 555, '2026-10-15', { deleted_at: iso(NOW) });
    const text = await textOf(await run());
    expect(text).toEqual(expect.arrayContaining(['1000.00', '-2.22', '997.78']));
    for (const excluded of ['3.33', '4.44', '5.55']) {
      expect(text).not.toContain(excluded);
      expect(text).not.toContain(`-${excluded}`);
    }
  });

  it('balance negativo con «-»', async () => {
    await add('ingreso', 100, '2026-10-05');
    await add('gasto', 10050, '2026-10-06');
    const text = await textOf(await run());
    const at = text.indexOf('Balance');
    expect(text.slice(at, at + 2)).toEqual(['Balance', '-99.50']);
  });

  it('filtro por tipo y por categoría, con sus nombres en la cabecera', async () => {
    const other = await insertCategory(db, accountId, { tipo: 'egreso', nombre: 'Transporte' });
    await add('ingreso', 5000, '2026-10-02');
    await add('gasto', 1000, '2026-10-03');
    await add('gasto', 2000, '2026-10-04', {}, other);

    const byTipo = await textOf(await run({ tipo: 'gasto' }));
    expect(byTipo).toContain('Filtros: Tipo: Gasto');
    expect(byTipo).not.toContain('Sueldo');
    expect(byTipo).toEqual(expect.arrayContaining(['Comida', 'Transporte']));

    const byCategory = await textOf(await run({ category_id: other }));
    expect(byCategory).toContain('Filtros: Categoría: Transporte');
    expect(byCategory).toContain('-20.00');
    expect(byCategory).not.toContain('-10.00');
    expect(byCategory).not.toContain('Sueldo');

    const both = await textOf(await run({ tipo: 'gasto', category_id: expense }));
    expect(both).toContain('Filtros: Tipo: Gasto | Categoría: Comida');
    expect(both).toContain('-10.00');
    expect(both).not.toContain('-20.00');
  });

  it('aislamiento: no incluye movimientos de otra cuenta ni de otro usuario', async () => {
    await add('gasto', 1111, '2026-10-05', { nota: 'propia' });
    const second = await insertAccount(db, userId, { nombre: 'Segunda' });
    const secondCat = await insertCategory(db, second, { tipo: 'egreso', nombre: 'Otra cat' });
    await insertTransactionRow(db, second, secondCat, { monto: 2222, fecha: '2026-10-05' });
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id, { nombre: 'Ajena' });
    const foreignCat = await insertCategory(db, foreign, { tipo: 'egreso', nombre: 'Secreta' });
    await insertTransactionRow(db, foreign, foreignCat, {
      monto: 3333,
      fecha: '2026-10-05',
      nota: 'ajeno',
    });
    const text = (await textOf(await run())).join('|');
    expect(text).toContain('propia');
    for (const leaked of ['22.22', '33.33', 'Otra cat', 'Secreta', 'ajeno', 'Ajena']) {
      expect(text).not.toContain(leaked);
    }
  });

  it('pagina: ROWS_PER_PAGE + 1 filas dan 2 páginas con la cabecera repetida', async () => {
    for (let i = 0; i < ROWS_PER_PAGE + 1; i++) await add('gasto', 100, '2026-10-05');
    const pdf = await pdfOf(await run());
    expect(pdf.count).toBe(2);
    expect(pdf.pages[0]).toContain('Página 1 de 2');
    expect(pdf.pages[1]).toContain('Página 2 de 2');
    for (const page of pdf.pages) expect(page).toContain('Cuenta: Mi cuenta');
    for (const stream of pdf.streams) expect(stream.declared).toBe(stream.actual);
  });
});

describe('GET /export?format=pdf: errores y orden de validación', () => {
  it('401 sin token, 400 con query inválida y 404 con cuenta ajena, todos no-store', async () => {
    const unauth = await exp(q(), '');
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toEqual(ERR('UNAUTHORIZED'));

    const invalid = await run({ desde: '2026-13-01', account_id: uuid() });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual(ERR('INVALID_REQUEST'));

    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id);
    const missing = await run({ account_id: foreign });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(ERR('NOT_FOUND'));

    for (const response of [unauth, invalid, missing]) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('Content-Disposition')).toBeNull();
    }
  });

  it('401 tiene prioridad sobre 400; 400 sobre 404', async () => {
    expect((await exp({ format: 'pdf' }, '')).status).toBe(401);
    expect((await run({ desde: 'x', account_id: uuid() })).status).toBe(400);
  });

  it('category_id ajena o de otra cuenta -> 404', async () => {
    const second = await insertAccount(db, userId, { nombre: 'Otra' });
    const ownOther = await insertCategory(db, second, { tipo: 'egreso' });
    for (const category_id of [uuid(), ownOther]) {
      expect((await run({ category_id })).status).toBe(404);
    }
  });

  it.each(['xlsx', 'PDF', ''])('format=%j inválido -> 400', async (format) => {
    const response = await run({ format });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
  });

  it('format repetido -> 400', async () => {
    const params = new URLSearchParams(q());
    params.append('format', 'pdf');
    expect((await call('GET', `/export?${params.toString()}`, token)).status).toBe(400);
  });

  it('sin format se mantiene el CSV', async () => {
    const noFormat: Record<string, string> = q();
    delete noFormat.format;
    const response = await exp(noFormat);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toContain('.csv"');
  });

  it('montos máximos permitidos por la base se suman sin perder precisión', async () => {
    await add('ingreso', 99999999999, '2026-10-05');
    await add('ingreso', 99999999999, '2026-10-06');
    await add('gasto', 1, '2026-10-07');
    const text = await textOf(await run());
    expect(text).toEqual(expect.arrayContaining(['1999999999.98', '-0.01', '1999999999.97']));
  });
});

describe('GET /export?format=pdf: tope de filas', () => {
  const bulk = async (n: number) => {
    await db
      .prepare(
        `WITH RECURSIVE s(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM s WHERE i < ?3),
              r(i, h) AS (SELECT i, lower(hex(randomblob(16))) FROM s)
         INSERT INTO transactions (id, account_id, category_id, tipo, monto, fecha, nota, created_at, updated_at)
         SELECT substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12),
                ?1, ?2, 'gasto', 100, '2026-10-10', 'Movimiento de prueba número ' || i, ?4, ?4
           FROM r`,
      )
      .bind(accountId, expense, n, iso(NOW))
      .run();
  };

  it('2000 filas exactas se exportan completas (tamaño y tiempo informativos)', async () => {
    await bulk(MAX_EXPORT_ROWS);
    const started = performance.now();
    const response = await run();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const elapsed = performance.now() - started;
    expect(response.status).toBe(200);
    const pdf = inspectPdf(bytes);
    expect(pdf.count).toBe(Math.ceil(MAX_EXPORT_ROWS / ROWS_PER_PAGE));
    expect(pdf.pages.flat().filter((t) => t === '-1.00')).toHaveLength(MAX_EXPORT_ROWS);
    expect(pdf.pages.flat()).toContain('-2000.00');
    expect(pdf.startxref).toBe(pdf.xrefOffset);
    for (const stream of pdf.streams) expect(stream.declared).toBe(stream.actual);
    expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
    console.info(
      `PDF 2000 filas: ${bytes.length} bytes, ${pdf.count} paginas, ${elapsed.toFixed(0)} ms (incluye D1 y HTTP)`,
    );
    expect(latin1(bytes.slice(0, 8))).toBe('%PDF-1.4');
  });

  it('2001 filas responden 400 EXPORT_TOO_LARGE sin truncar y sin PDF', async () => {
    await bulk(MAX_EXPORT_ROWS + 1);
    const response = await run();
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('EXPORT_TOO_LARGE');
    expect(body.error.message).toContain('2000');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });
});
