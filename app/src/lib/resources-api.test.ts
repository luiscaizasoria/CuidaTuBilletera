import { AuthError } from './auth-types';
import { ApiRequestError, createResourcesApi } from './resources-api';
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
    await expect(api.listAccounts(TOKEN)).resolves.toEqual(pageOf([account()]));
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
