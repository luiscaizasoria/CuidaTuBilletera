import { AuthError } from './auth-types';
import { ApiRequestError, createResourcesApi, hasAppearanceKeys } from './resources-api';
import { account, category, pageOf, transaction } from '../resources-test-utils';

const res = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const noContent = () => res(204, {});
const errBody = (code: string) => ({ error: { code, message: 'MENSAJE-NO-PROPAGAR' } });

function make(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = jest.fn(impl);
  const api = createResourcesApi('https://api.test', fetchMock as unknown as typeof fetch);
  const call = (i = 0) => fetchMock.mock.calls[i] as unknown as [string, RequestInit];
  return { api, fetchMock, call };
}

const TOKEN = 'access-token';

describe('createResourcesApi: peticiones', () => {
  it('listAccounts: URL, cabeceras y respuesta', async () => {
    const { api, call } = make(async () => res(200, pageOf([account()])));
    await expect(api.listAccounts(TOKEN)).resolves.toEqual({
      ...pageOf([account()]),
      appearanceSupported: true,
    });
    const [url, init] = call();
    expect(url).toBe('https://api.test/accounts');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(init.body).toBeUndefined();
  });

  it('listAccounts: parámetros de consulta', async () => {
    const { api, call } = make(async () => res(200, pageOf([])));
    await api.listAccounts(TOKEN, { page: 2, pageSize: 100, incluirArchivadas: true });
    expect(call()[0]).toBe('https://api.test/accounts?page=2&page_size=100&incluirArchivadas=true');
    await api.listAccounts(TOKEN, { incluirArchivadas: false });
    expect(call(1)[0]).toBe('https://api.test/accounts');
  });

  it('createAccount: cuerpo JSON y respuesta con categorías', async () => {
    const body = { account: account(), categories: [category()] };
    const { api, call } = make(async () => res(201, body));
    await expect(
      api.createAccount(TOKEN, { nombre: 'Banco', saldoInicial: -500 }),
    ).resolves.toEqual(body);
    const [url, init] = call();
    expect(url).toBe('https://api.test/accounts');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({ nombre: 'Banco', saldoInicial: -500 });
  });

  it('updateAccount: PATCH con solo los campos indicados', async () => {
    const { api, call } = make(async () => res(200, { account: account({ archivada: true }) }));
    await expect(api.updateAccount(TOKEN, 'acc-1', { archivada: true })).resolves.toEqual(
      account({ archivada: true }),
    );
    expect(call()[0]).toBe('https://api.test/accounts/acc-1');
    expect(call()[1].method).toBe('PATCH');
    expect(JSON.parse(call()[1].body as string)).toEqual({ archivada: true });
  });

  it('listCategories: tipo, incluirArchivadas y paginación', async () => {
    const { api, call } = make(async () => res(200, pageOf([category()])));
    await expect(
      api.listCategories(TOKEN, 'acc-1', { tipo: 'ingreso', incluirArchivadas: true, page: 1 }),
    ).resolves.toEqual(pageOf([category()]));
    expect(call()[0]).toBe(
      'https://api.test/accounts/acc-1/categories?tipo=ingreso&incluirArchivadas=true&page=1',
    );
  });

  it('createCategory y updateCategory (descripcion null)', async () => {
    const { api, call } = make(async () => res(200, { category: category() }));
    await expect(
      api.createCategory(TOKEN, 'acc-1', { nombre: 'Comida', tipo: 'egreso' }),
    ).resolves.toEqual(category());
    expect(call()[0]).toBe('https://api.test/accounts/acc-1/categories');
    expect(call()[1].method).toBe('POST');

    await api.updateCategory(TOKEN, 'cat-1', { descripcion: null });
    expect(call(1)[0]).toBe('https://api.test/categories/cat-1');
    expect(call(1)[1].method).toBe('PATCH');
    expect(JSON.parse(call(1)[1].body as string)).toEqual({ descripcion: null });
  });

  it('deleteCategory: resuelve con 204 y rechaza otro 2xx', async () => {
    const ok = make(async () => noContent());
    await expect(ok.api.deleteCategory(TOKEN, 'cat-1')).resolves.toBeUndefined();
    expect(ok.call()[0]).toBe('https://api.test/categories/cat-1');
    expect(ok.call()[1].method).toBe('DELETE');

    const bad = make(async () => res(200, {}));
    await expect(bad.api.deleteCategory(TOKEN, 'cat-1')).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('codifica los identificadores en la ruta', async () => {
    const { api, call } = make(async () => res(200, pageOf([])));
    await api.listCategories(TOKEN, 'a/b');
    expect(call()[0]).toBe('https://api.test/accounts/a%2Fb/categories');
  });
});

describe('createResourcesApi: errores', () => {
  it('401 -> AuthError rejected (con o sin código)', async () => {
    for (const body of [errBody('UNAUTHORIZED'), errBody('INVALID_TOKEN'), {}]) {
      const { api } = make(async () => res(401, body));
      await expect(api.listAccounts(TOKEN)).rejects.toMatchObject({
        name: 'AuthError',
        kind: 'rejected',
        status: 401,
      });
    }
  });

  it.each([
    [404, 'NOT_FOUND'],
    [409, 'CATEGORY_NAME_TAKEN'],
    [409, 'CATEGORY_IN_USE'],
    [409, 'ACCOUNT_ARCHIVED'],
    [409, 'LIMIT_REACHED'],
    [400, 'INVALID_REQUEST'],
    [413, 'PAYLOAD_TOO_LARGE'],
  ])('%i %s -> ApiRequestError', async (status, code) => {
    const { api } = make(async () => res(status, errBody(code)));
    const error = await api.deleteCategory(TOKEN, 'cat-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status, code });
    expect((error as Error).message).not.toContain('MENSAJE-NO-PROPAGAR');
  });

  it('error de negocio sin código válido -> UNKNOWN', async () => {
    const { api } = make(async () => res(409, { error: { code: 'minúscula!' } }));
    await expect(api.deleteCategory(TOKEN, 'c')).rejects.toMatchObject({
      status: 409,
      code: 'UNKNOWN',
    });
    const second = make(async () => res(404, 'texto'));
    await expect(second.api.deleteCategory(TOKEN, 'c')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it.each([429, 500, 503])('%i -> AuthError server', async (status) => {
    const { api } = make(async () => res(status, errBody('INTERNAL_ERROR')));
    await expect(api.listAccounts(TOKEN)).rejects.toMatchObject({ kind: 'server', status });
  });

  it('fallo de red o timeout -> AuthError network', async () => {
    const { api } = make(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(api.listAccounts(TOKEN)).rejects.toMatchObject({ kind: 'network' });
  });

  it('el token no aparece en los errores', async () => {
    const { api } = make(async () => res(409, errBody('CATEGORY_IN_USE')));
    const error = (await api.deleteCategory(TOKEN, 'c').catch((e: unknown) => e)) as Error;
    expect(JSON.stringify([error.message, error.name])).not.toContain(TOKEN);
  });
});

describe('createResourcesApi: parseo defensivo', () => {
  const bad = (
    name: string,
    body: unknown,
    run: (api: ReturnType<typeof make>['api']) => Promise<unknown>,
  ) =>
    it(name, async () => {
      const { api } = make(async () => res(200, body));
      const error = await run(api).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toMatchObject({ kind: 'unknown' });
    });

  bad('cuerpo no objeto', [], (a) => a.listAccounts(TOKEN));
  bad('lista sin items', { page: 1, pageSize: 1, total: 0 }, (a) => a.listAccounts(TOKEN));
  bad('lista con paginación inválida', { items: [], page: '1', pageSize: 1, total: 0 }, (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta sin saldo', pageOf([{ ...account(), saldo: undefined }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta con saldo no entero', pageOf([{ ...account(), saldo: 10.5 }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta con saldo como texto', pageOf([{ ...account(), saldo: '10' }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta con saldoInicial no entero', pageOf([{ ...account(), saldoInicial: 1.5 }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta sin archivada booleana', pageOf([{ ...account(), archivada: 'no' }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('cuenta con fecha inválida', pageOf([{ ...account(), createdAt: 'ayer' }]), (a) =>
    a.listAccounts(TOKEN),
  );
  bad('createAccount sin categories', { account: account() }, (a) =>
    a.createAccount(TOKEN, { nombre: 'x' }),
  );
  bad('updateAccount sin account', {}, (a) => a.updateAccount(TOKEN, 'a', { nombre: 'x' }));
  bad('categoría con tipo desconocido', { category: { ...category(), tipo: 'otro' } }, (a) =>
    a.createCategory(TOKEN, 'a', { nombre: 'x', tipo: 'egreso' }),
  );
  bad('categoría con descripcion numérica', { category: { ...category(), descripcion: 3 } }, (a) =>
    a.updateCategory(TOKEN, 'c', {}),
  );
  bad('categoría sin color', { category: { ...category(), color: undefined } }, (a) =>
    a.updateCategory(TOKEN, 'c', {}),
  );

  it('cuerpo no JSON -> unknown', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('x');
      },
    }));
    const api = createResourcesApi('https://api.test', fetchMock as unknown as typeof fetch);
    await expect(api.listAccounts(TOKEN)).rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('createResourcesApi: movimientos', () => {
  const ACC = '11111111-1111-4111-8111-111111111111';
  const CAT = '22222222-2222-4222-8222-222222222222';

  it('listTransactions: solo account_id y respuesta', async () => {
    const { api, call } = make(async () => res(200, pageOf([transaction()])));
    await expect(api.listTransactions(TOKEN, { accountId: ACC })).resolves.toEqual(
      pageOf([transaction()]),
    );
    const [url, init] = call();
    expect(url).toBe(`https://api.test/transactions?account_id=${ACC}`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(init.body).toBeUndefined();
  });

  it('listTransactions: todos los filtros en snake_case y orden exacto', async () => {
    const { api, call } = make(async () => res(200, pageOf([])));
    await api.listTransactions(TOKEN, {
      accountId: ACC,
      tipo: 'gasto',
      categoryId: CAT,
      desde: '2026-01-01',
      hasta: '2026-12-31',
      page: 3,
      pageSize: 20,
    });
    expect(call()[0]).toBe(
      `https://api.test/transactions?account_id=${ACC}&tipo=gasto&category_id=${CAT}` +
        '&desde=2026-01-01&hasta=2026-12-31&page=3&page_size=20',
    );
  });

  it('createTransaction: POST con cuerpo JSON y respuesta 201', async () => {
    const created = transaction({ nota: 'almuerzo' });
    const { api, call } = make(async () => res(201, { transaction: created }));
    const input = {
      accountId: ACC,
      categoryId: CAT,
      tipo: 'gasto' as const,
      monto: 1500,
      fecha: '2026-10-14',
      nota: 'almuerzo',
    };
    await expect(api.createTransaction(TOKEN, input)).resolves.toEqual(created);
    const [url, init] = call();
    expect(url).toBe('https://api.test/transactions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('updateTransaction: PATCH solo con los campos indicados (nota null)', async () => {
    const { api, call } = make(async () => res(200, { transaction: transaction() }));
    await expect(api.updateTransaction(TOKEN, 'tx-1', { nota: null })).resolves.toEqual(
      transaction(),
    );
    expect(call()[0]).toBe('https://api.test/transactions/tx-1');
    expect(call()[1].method).toBe('PATCH');
    expect(JSON.parse(call()[1].body as string)).toEqual({ nota: null });
  });

  it('deleteTransaction: DELETE resuelve con 204 y rechaza otro 2xx', async () => {
    const ok = make(async () => noContent());
    await expect(ok.api.deleteTransaction(TOKEN, 'tx-1')).resolves.toBeUndefined();
    expect(ok.call()[0]).toBe('https://api.test/transactions/tx-1');
    expect(ok.call()[1].method).toBe('DELETE');
    expect(ok.call()[1].body).toBeUndefined();

    const bad = make(async () => res(200, {}));
    await expect(bad.api.deleteTransaction(TOKEN, 'tx-1')).rejects.toMatchObject({
      kind: 'unknown',
    });
  });

  it('codifica el id en la ruta', async () => {
    const { api, call } = make(async () => noContent());
    await api.deleteTransaction(TOKEN, 'a/b');
    expect(call()[0]).toBe('https://api.test/transactions/a%2Fb');
  });

  it('401 -> AuthError rejected en las cuatro operaciones', async () => {
    const { api } = make(async () => res(401, errBody('UNAUTHORIZED')));
    const runs = [
      () => api.listTransactions(TOKEN, { accountId: ACC }),
      () =>
        api.createTransaction(TOKEN, {
          accountId: ACC,
          categoryId: CAT,
          tipo: 'ingreso',
          monto: 1,
          fecha: '2026-10-14',
        }),
      () => api.updateTransaction(TOKEN, 'tx-1', { monto: 2 }),
      () => api.deleteTransaction(TOKEN, 'tx-1'),
    ];
    for (const run of runs) {
      await expect(run()).rejects.toMatchObject({
        name: 'AuthError',
        kind: 'rejected',
        status: 401,
      });
    }
  });

  it.each([
    [404, 'NOT_FOUND'],
    [409, 'ACCOUNT_ARCHIVED'],
    [409, 'CATEGORY_ARCHIVED'],
    [409, 'CATEGORY_MISMATCH'],
    [409, 'TRANSACTION_VOIDED'],
    [400, 'INVALID_REQUEST'],
    [413, 'PAYLOAD_TOO_LARGE'],
  ])('%i %s -> ApiRequestError sin propagar el message', async (status, code) => {
    const { api } = make(async () => res(status, errBody(code)));
    const error = await api.updateTransaction(TOKEN, 'tx-1', { monto: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status, code });
    expect((error as Error).message).not.toContain('MENSAJE-NO-PROPAGAR');
  });

  it.each([429, 500])('%i -> AuthError server', async (status) => {
    const { api } = make(async () => res(status, errBody('INTERNAL_ERROR')));
    await expect(api.listTransactions(TOKEN, { accountId: ACC })).rejects.toMatchObject({
      kind: 'server',
    });
  });

  const bad = (
    name: string,
    body: unknown,
    run: (api: ReturnType<typeof make>['api']) => Promise<unknown>,
  ) =>
    it(`cuerpo inválido: ${name}`, async () => {
      const { api } = make(async () => res(200, body));
      await expect(run(api)).rejects.toMatchObject({ name: 'AuthError', kind: 'unknown' });
    });
  const list = (api: ReturnType<typeof make>['api']) =>
    api.listTransactions(TOKEN, { accountId: ACC });
  const upd = (api: ReturnType<typeof make>['api']) =>
    api.updateTransaction(TOKEN, 't', { monto: 1 });

  bad('lista sin items', { page: 1, pageSize: 20, total: 0 }, list);
  bad('monto decimal', pageOf([{ ...transaction(), monto: 1.5 }]), list);
  bad('monto cero', pageOf([{ ...transaction(), monto: 0 }]), list);
  bad('monto como texto', pageOf([{ ...transaction(), monto: '15' }]), list);
  bad('tipo desconocido', pageOf([{ ...transaction(), tipo: 'ajuste' }]), list);
  bad('fecha imposible', pageOf([{ ...transaction(), fecha: '2026-02-30' }]), list);
  bad('fecha con hora', pageOf([{ ...transaction(), fecha: '2026-02-10T10:00:00Z' }]), list);
  bad('nota numérica', pageOf([{ ...transaction(), nota: 5 }]), list);
  bad('sin categoryId', pageOf([{ ...transaction(), categoryId: undefined }]), list);
  bad('createdAt inválido', pageOf([{ ...transaction(), createdAt: 'ayer' }]), list);
  bad('PATCH sin transaction', {}, upd);
  bad('PATCH con transaction no objeto', { transaction: 'x' }, upd);
  bad('POST con cuerpo lista', [], (api) =>
    api.createTransaction(TOKEN, {
      accountId: ACC,
      categoryId: CAT,
      tipo: 'gasto',
      monto: 1,
      fecha: '2026-10-14',
    }),
  );
});

describe('createResourcesApi: calendario', () => {
  const ACC = '11111111-1111-4111-8111-111111111111';
  const MONTH = '2026-10';
  const day = (fecha: string, extra: object = {}) => ({
    fecha,
    ingresos: 150_000,
    gastos: 4_550,
    cantidad: 3,
    ...extra,
  });
  const body = (days: unknown[] = [day('2026-10-01'), day('2026-10-15')], extra: object = {}) => ({
    accountId: ACC,
    month: MONTH,
    days,
    ...extra,
  });
  const get = (api: ReturnType<typeof make>['api']) =>
    api.getCalendar(TOKEN, { accountId: ACC, month: MONTH });

  it('GET /calendar con account_id y month, cabecera Bearer y respuesta', async () => {
    const { api, call } = make(async () => res(200, body()));
    await expect(get(api)).resolves.toEqual(body());
    const [url, init] = call();
    expect(url).toBe(`https://api.test/calendar?account_id=${ACC}&month=2026-10`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(init.body).toBeUndefined();
  });

  it('acepta un mes sin movimientos y ceros', async () => {
    const empty = make(async () => res(200, body([])));
    await expect(get(empty.api)).resolves.toEqual(body([]));
    const zeros = make(async () => res(200, body([day('2026-10-02', { ingresos: 0 })])));
    await expect(get(zeros.api)).resolves.toMatchObject({ days: [{ ingresos: 0, gastos: 4550 }] });
  });

  it('401 -> AuthError rejected; 400 y 404 -> ApiRequestError', async () => {
    const unauthorized = make(async () => res(401, errBody('UNAUTHORIZED')));
    await expect(get(unauthorized.api)).rejects.toMatchObject({ kind: 'rejected', status: 401 });
    for (const [status, code] of [
      [400, 'INVALID_REQUEST'],
      [404, 'NOT_FOUND'],
    ] as const) {
      const { api } = make(async () => res(status, errBody(code)));
      const error = await get(api).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({ status, code });
    }
  });

  const bad = (name: string, payload: unknown) =>
    it(`respuesta inesperada: ${name}`, async () => {
      const { api } = make(async () => res(200, payload));
      await expect(get(api)).rejects.toMatchObject({ name: 'AuthError', kind: 'unknown' });
    });

  bad('cuerpo lista', []);
  bad('sin days', { accountId: ACC, month: MONTH });
  bad('days no es lista', { accountId: ACC, month: MONTH, days: {} });
  bad('mes distinto', body([], { month: '2026-09' }));
  bad('cuenta distinta', body([], { accountId: 'otra' }));
  bad('más de 31 días', body(Array.from({ length: 32 }, () => day('2026-10-01'))));
  bad('fecha fuera del mes', body([day('2026-11-01')]));
  bad('fecha imposible', body([day('2026-10-32')]));
  bad('fechas desordenadas', body([day('2026-10-15'), day('2026-10-01')]));
  bad('fecha repetida', body([day('2026-10-01'), day('2026-10-01')]));
  bad('día no objeto', body(['2026-10-01']));
  bad('ingresos negativos', body([day('2026-10-01', { ingresos: -1 })]));
  bad('gastos negativos', body([day('2026-10-01', { gastos: -100 })]));
  bad('ingresos decimales', body([day('2026-10-01', { ingresos: 1.5 })]));
  bad('gastos como texto', body([day('2026-10-01', { gastos: '10' })]));
  bad('importe no seguro', body([day('2026-10-01', { ingresos: Number.MAX_SAFE_INTEGER + 1 })]));
  bad('ingresos ausentes', body([day('2026-10-01', { ingresos: undefined })]));
  bad('cantidad cero', body([day('2026-10-01', { cantidad: 0 })]));
  bad('cantidad negativa', body([day('2026-10-01', { cantidad: -2 })]));
  bad('cantidad decimal', body([day('2026-10-01', { cantidad: 1.5 })]));
});

describe('createResourcesApi: saldo de la cuenta', () => {
  const balance = (overrides: Record<string, unknown> = {}) => ({
    accountId: 'acc-1',
    saldoInicial: 1000,
    ingresos: 500,
    gastos: 1750,
    saldo: -250,
    ...overrides,
  });

  it('GET /accounts/:id/balance con token y respuesta validada', async () => {
    const { api, call } = make(async () => res(200, balance()));
    await expect(api.getAccountBalance(TOKEN, 'acc-1')).resolves.toEqual(balance());
    const [url, init] = call();
    expect(url).toBe('https://api.test/accounts/acc-1/balance');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it('codifica el id en la ruta', async () => {
    const { api, call } = make(async () => res(200, balance({ accountId: 'a/b' })));
    await api.getAccountBalance(TOKEN, 'a/b');
    expect(call()[0]).toBe('https://api.test/accounts/a%2Fb/balance');
  });

  it('404 -> ApiRequestError sin propagar el mensaje del servidor', async () => {
    const { api } = make(async () => res(404, errBody('NOT_FOUND')));
    const error = await api.getAccountBalance(TOKEN, 'acc-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(String((error as Error).message)).not.toContain('MENSAJE-NO-PROPAGAR');
  });

  it.each([500, 503])('%s -> AuthError server', async (status) => {
    const { api } = make(async () => res(status, errBody('INTERNAL')));
    await expect(api.getAccountBalance(TOKEN, 'acc-1')).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it.each([
    ['otra cuenta', { accountId: 'acc-2' }],
    ['saldo no entero', { saldo: -250.5 }],
    ['saldo inicial no entero', { saldoInicial: 1000.1, saldo: -249.9 }],
    ['saldo fuera de rango seguro', { saldoInicial: 2 ** 53, saldo: 2 ** 53 - 1250 }],
    ['ingresos negativos', { ingresos: -500, saldo: -1250 }],
    ['gastos negativos', { gastos: -1750, saldo: 3250 }],
    ['saldo como texto', { saldo: '-250' }],
    ['campo ausente', { ingresos: undefined }],
    ['suma incoherente', { saldo: -249 }],
  ])('respuesta inválida (%s) -> AuthError unknown', async (_name, overrides) => {
    const { api } = make(async () => res(200, balance(overrides)));
    await expect(api.getAccountBalance(TOKEN, 'acc-1')).rejects.toMatchObject({
      kind: 'unknown',
    });
  });
});

describe('createResourcesApi: reportes', () => {
  const ACC = 'acc-1';
  const range = { accountId: ACC, desde: '2026-10-01', hasta: '2026-10-31' };
  const base = { accountId: ACC, desde: range.desde, hasta: range.hasta };
  const summary = (extra: object = {}) => ({
    ...base,
    ingresos: 10_000,
    gastos: 4_550,
    balance: 5_450,
    cantidad: 3,
    ...extra,
  });
  const item = (extra: object = {}) => ({
    categoryId: 'c1',
    nombre: 'Comida',
    icono: 'tag',
    color: '#E53935',
    archivada: false,
    total: 300,
    cantidad: 2,
    ...extra,
  });
  const byCategory = (gastos: object = { total: 300, items: [item()] }) => ({
    ...base,
    ingresos: { total: 0, items: [] },
    gastos,
  });
  const byPeriod = (points: unknown[], extra: object = {}) => ({
    ...base,
    group: 'month',
    points,
    ...extra,
  });
  const point = (extra: object = {}) => ({
    periodo: '2026-10',
    ingresos: 100,
    gastos: 40,
    balance: 60,
    cantidad: 2,
    ...extra,
  });

  it('GET /reports/summary con account_id, desde y hasta', async () => {
    const { api, call } = make(async () => res(200, summary()));
    await expect(api.getReportSummary(TOKEN, range)).resolves.toEqual(summary());
    const [url, init] = call();
    expect(url).toBe(
      `https://api.test/reports/summary?account_id=${ACC}&desde=2026-10-01&hasta=2026-10-31`,
    );
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it('summary: balance inconsistente, negativos o rango distinto -> inválido', async () => {
    for (const bad of [
      summary({ balance: 1 }),
      summary({ gastos: -1, balance: 10_001 }),
      summary({ ingresos: 1.5 }),
      summary({ desde: '2026-09-01' }),
      summary({ accountId: 'otra' }),
    ]) {
      const { api } = make(async () => res(200, bad));
      await expect(api.getReportSummary(TOKEN, range)).rejects.toBeInstanceOf(AuthError);
    }
  });

  it('balance negativo exacto es válido', async () => {
    const { api } = make(async () => res(200, summary({ ingresos: 0, gastos: 10, balance: -10 })));
    await expect(api.getReportSummary(TOKEN, range)).resolves.toMatchObject({ balance: -10 });
  });

  it('GET /reports/by-category y validación de totales por grupo', async () => {
    const ok = make(async () => res(200, byCategory()));
    await expect(ok.api.getReportByCategory(TOKEN, range)).resolves.toEqual(byCategory());
    expect(ok.call()[0]).toBe(
      `https://api.test/reports/by-category?account_id=${ACC}&desde=2026-10-01&hasta=2026-10-31`,
    );
    const bad = make(async () => res(200, byCategory({ total: 999, items: [item()] })));
    await expect(bad.api.getReportByCategory(TOKEN, range)).rejects.toBeInstanceOf(AuthError);
    const unsafe = make(async () =>
      res(200, byCategory({ total: 1, items: [item({ total: Number.MAX_SAFE_INTEGER + 2 })] })),
    );
    await expect(unsafe.api.getReportByCategory(TOKEN, range)).rejects.toBeInstanceOf(AuthError);
  });

  it('GET /reports/by-period envía group y valida la serie', async () => {
    const ok = make(async () => res(200, byPeriod([point(), point({ periodo: '2026-11' })])));
    const result = await ok.api.getReportByPeriod(TOKEN, { ...range, group: 'month' });
    expect(result.points).toHaveLength(2);
    expect(ok.call()[0]).toBe(
      `https://api.test/reports/by-period?account_id=${ACC}&desde=2026-10-01&hasta=2026-10-31&group=month`,
    );
    for (const bad of [
      byPeriod([point({ balance: 1 })]),
      byPeriod([point(), point()]),
      byPeriod([point({ periodo: '2026' })]),
      byPeriod([point()], { group: 'year' }),
    ]) {
      const { api } = make(async () => res(200, bad));
      await expect(
        api.getReportByPeriod(TOKEN, { ...range, group: 'month' }),
      ).rejects.toBeInstanceOf(AuthError);
    }
  });

  it('401 -> rejected; 404 -> ApiRequestError; 500 -> server', async () => {
    const unauthorized = make(async () => res(401, errBody('UNAUTHORIZED')));
    await expect(unauthorized.api.getReportSummary(TOKEN, range)).rejects.toMatchObject({
      kind: 'rejected',
    });
    const missing = make(async () => res(404, errBody('NOT_FOUND')));
    await expect(missing.api.getReportByCategory(TOKEN, range)).rejects.toBeInstanceOf(
      ApiRequestError,
    );
    const broken = make(async () => res(500, errBody('INTERNAL')));
    await expect(
      broken.api.getReportByPeriod(TOKEN, { ...range, group: 'year' }),
    ).rejects.toMatchObject({ kind: 'server' });
  });
});

describe('createResourcesApi: exportación de archivos', () => {
  const options = { accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' };
  const csvOptions = { ...options, format: 'csv' as const };
  const pdfOptions = { ...options, format: 'pdf' as const };
  const HEADER = Uint8Array.from([0xef, 0xbb, 0xbf, 0x66, 0x65, 0x63, 0x68, 0x61, 0x0d, 0x0a]);
  const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff]);
  const fileRes = (bytes: Uint8Array, contentType: string | null = 'text/csv; charset=utf-8') =>
    ({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }) as unknown as Response;

  it('CSV: GET /export con parámetros exactos y token; conserva el BOM', async () => {
    const { api, call } = make(async () => fileRes(HEADER));
    const bytes = await api.exportFile(TOKEN, csvOptions);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual(Array.from(HEADER));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const [url, init] = call();
    expect(url).toBe(
      'https://api.test/export?account_id=acc-1&desde=2026-10-01&hasta=2026-10-31&format=csv',
    );
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it('PDF: format=pdf y bytes idénticos (incluidos bytes altos y nulos)', async () => {
    const { api, call } = make(async () => fileRes(PDF, 'application/pdf'));
    const bytes = await api.exportFile(TOKEN, pdfOptions);
    expect(Array.from(bytes)).toEqual(Array.from(PDF));
    expect(call()[0]).toBe(
      'https://api.test/export?account_id=acc-1&desde=2026-10-01&hasta=2026-10-31&format=pdf',
    );
  });

  it('envía tipo y category_id solo cuando se indican', async () => {
    const { api, call } = make(async () => fileRes(HEADER));
    await api.exportFile(TOKEN, { ...csvOptions, tipo: 'gasto', categoryId: 'c 1' });
    expect(call()[0]).toBe(
      'https://api.test/export?account_id=acc-1&desde=2026-10-01&hasta=2026-10-31&tipo=gasto&category_id=c%201&format=csv',
    );
  });

  it('acepta application/pdf sin parámetros', async () => {
    const { api } = make(async () => fileRes(PDF, 'application/pdf; charset=binary'));
    await expect(api.exportFile(TOKEN, pdfOptions)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('Content-Type que no corresponde al formato, ausente o cuerpo vacío -> AuthError unknown', async () => {
    const cases: [Response, typeof csvOptions | typeof pdfOptions][] = [
      [fileRes(HEADER, 'application/json'), csvOptions],
      [fileRes(HEADER, 'text/csvx'), csvOptions],
      [fileRes(HEADER, null), csvOptions],
      [fileRes(new Uint8Array(0)), csvOptions],
      [fileRes(PDF, 'text/csv'), pdfOptions],
      [fileRes(HEADER, 'application/pdf'), csvOptions],
      [fileRes(new Uint8Array(0), 'application/pdf'), pdfOptions],
    ];
    for (const [response, opts] of cases) {
      const { api } = make(async () => response);
      await expect(api.exportFile(TOKEN, opts)).rejects.toMatchObject({ kind: 'unknown' });
    }
  });

  it('cuerpo ilegible -> AuthError unknown', async () => {
    const bad = {
      ...fileRes(HEADER),
      arrayBuffer: async () => Promise.reject(new Error('x')),
    } as unknown as Response;
    const { api } = make(async () => bad);
    await expect(api.exportFile(TOKEN, csvOptions)).rejects.toBeInstanceOf(AuthError);
  });

  it('errores: 400 EXPORT_TOO_LARGE y 404 son ApiRequestError; 401 rejected; 500 server; red', async () => {
    const tooLarge = make(async () => res(400, errBody('EXPORT_TOO_LARGE')));
    const error = (await tooLarge.api
      .exportFile(TOKEN, pdfOptions)
      .catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 400, code: 'EXPORT_TOO_LARGE' });
    expect(error.message).not.toContain('MENSAJE-NO-PROPAGAR');
    const missing = make(async () => res(404, errBody('NOT_FOUND')));
    await expect(missing.api.exportFile(TOKEN, csvOptions)).rejects.toMatchObject({ status: 404 });
    const unauthorized = make(async () => res(401, errBody('UNAUTHORIZED')));
    await expect(unauthorized.api.exportFile(TOKEN, csvOptions)).rejects.toMatchObject({
      kind: 'rejected',
    });
    const broken = make(async () => res(500, errBody('INTERNAL')));
    await expect(broken.api.exportFile(TOKEN, pdfOptions)).rejects.toMatchObject({
      kind: 'server',
    });
    const offline = make(async () => Promise.reject(new Error('offline')));
    await expect(offline.api.exportFile(TOKEN, csvOptions)).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

describe('apariencia de cuenta', () => {
  const legacy: Record<string, unknown> = { ...account() };
  delete legacy.color;
  delete legacy.icono;

  it('hasAppearanceKeys detecta las claves aunque valgan null o undefined', () => {
    expect(hasAppearanceKeys({ color: null })).toBe(true);
    expect(hasAppearanceKeys({ icono: undefined })).toBe(true);
    expect(hasAppearanceKeys({ nombre: 'a' })).toBe(false);
  });

  it('listAccounts: con claves (aunque null) hay soporte; sin claves no; lista vacía es null', async () => {
    const withKeys = make(async () => res(200, pageOf([account()])));
    expect((await withKeys.api.listAccounts(TOKEN)).appearanceSupported).toBe(true);
    const without = make(async () => res(200, pageOf([legacy])));
    const page = await without.api.listAccounts(TOKEN);
    expect(page.appearanceSupported).toBe(false);
    expect(page.items[0]).toMatchObject({ color: null, icono: null });
    const empty = make(async () => res(200, pageOf([])));
    expect((await empty.api.listAccounts(TOKEN)).appearanceSupported).toBeNull();
  });

  it('basta una cuenta con la clave para detectar soporte', async () => {
    const { api } = make(async () => res(200, pageOf([legacy, { ...legacy, icono: null }])));
    expect((await api.listAccounts(TOKEN)).appearanceSupported).toBe(true);
  });

  it('parseAccount conserva color e ícono string y normaliza ausentes o de otro tipo a null', async () => {
    const { api } = make(async () =>
      res(200, pageOf([{ ...account(), color: 'rosa', icono: 7 }, legacy])),
    );
    const { items } = await api.listAccounts(TOKEN);
    expect(items[0]).toMatchObject({ color: 'rosa', icono: null });
    expect(items[1]).toMatchObject({ color: null, icono: null });
  });

  it('createAccount y updateAccount envían el cuerpo tal cual y parsean la apariencia', async () => {
    const created = make(async () =>
      res(201, { account: { ...account(), color: 'limon' }, categories: [] }),
    );
    const result = await created.api.createAccount(TOKEN, { nombre: 'A', color: 'limon' });
    expect(JSON.parse(created.call()[1].body as string)).toEqual({ nombre: 'A', color: 'limon' });
    expect(result.account.color).toBe('limon');
    const patched = make(async () => res(200, { account: account() }));
    await patched.api.updateAccount(TOKEN, 'acc-1', { color: null });
    expect(JSON.parse(patched.call()[1].body as string)).toEqual({ color: null });
  });
});
