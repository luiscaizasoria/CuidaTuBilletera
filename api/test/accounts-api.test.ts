import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { categoryHasTransactions } from '../src/db/category-repository';
import { insertAccountStatement } from '../src/db/account-repository';
import { insertCategoryStatement } from '../src/db/category-repository';
import {
  DEFAULT_PAGE_SIZE,
  MAX_ACCOUNTS_PER_USER,
  MAX_AMOUNT_CENTS,
  MAX_CATEGORIES_PER_ACCOUNT,
  MAX_RESOURCE_BODY_BYTES,
} from '../src/lib/limits';
import { issueSession } from '../src/services/session-service';
import { DEFAULT_CATEGORIES } from '../src/services/default-categories';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  iso,
  NOW,
  plusMs,
  rowOf,
  uuid,
} from './d1-helpers';
import { AUTH_ENV } from './helpers';
import { api, userWithToken } from './resource-helpers';

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

async function createAccount(body: unknown = { nombre: 'Principal' }): Promise<Json> {
  const response = await call('POST', '/accounts', token, body);
  expect(response.status).toBe(201);
  return json(response);
}

describe('autenticación y cabeceras (los 7 endpoints)', () => {
  const id = uuid();
  const endpoints: [string, string, unknown?][] = [
    ['GET', '/accounts'],
    ['POST', '/accounts', { nombre: 'X' }],
    ['PATCH', `/accounts/${id}`, { nombre: 'X' }],
    ['GET', `/accounts/${id}/categories`],
    ['POST', `/accounts/${id}/categories`, { nombre: 'X', tipo: 'egreso' }],
    ['PATCH', `/categories/${id}`, { nombre: 'X' }],
    ['DELETE', `/categories/${id}`],
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
    const big = JSON.stringify({ nombre: 'x'.repeat(MAX_RESOURCE_BODY_BYTES + 1) });
    expect((await call('POST', '/accounts', undefined, big, true)).status).toBe(401);
    expect((await call('POST', '/accounts', undefined, '{', true)).status).toBe(401);
  });

  it('las respuestas de éxito y de error llevan Cache-Control: no-store', async () => {
    const created = await createAccount();
    const accountId = created.account.id as string;
    const responses = [
      await call('GET', '/accounts', token),
      await call('POST', '/accounts', token, { nombre: '' }),
      await call('PATCH', `/accounts/${accountId}`, token, { nombre: 'Nueva' }),
      await call('GET', `/accounts/${accountId}/categories`, token),
      await call('POST', `/accounts/${accountId}/categories`, token, {
        nombre: 'Z',
        tipo: 'egreso',
      }),
      await call('PATCH', `/categories/${created.categories[0].id}`, token, { nombre: 'W' }),
      await call('DELETE', `/categories/${created.categories[0].id}`, token),
      await call('DELETE', `/categories/${uuid()}`, token),
    ];
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });
});

describe('POST /accounts', () => {
  it('crea la cuenta y exactamente las categorías iniciales', async () => {
    const body = await createAccount({ nombre: '  Billetera  ', saldoInicial: 12_345 });
    expect(body.account).toEqual({
      id: expect.any(String),
      nombre: 'Billetera',
      saldoInicial: 12_345,
      saldo: 12_345,
      archivada: false,
      color: null,
      icono: null,
      createdAt: iso(NOW),
      updatedAt: iso(NOW),
    });
    expect(body.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(
      body.categories
        .filter((c: Json) => c.tipo === 'egreso')
        .map((c: Json) => c.nombre)
        .sort(),
    ).toEqual(
      [
        'Alimentación',
        'Educación',
        'Entretenimiento',
        'Hogar',
        'Otros gastos',
        'Conciliación',
        'Salud',
        'Servicios básicos',
        'Transporte',
      ].sort(),
    );
    expect(
      body.categories
        .filter((c: Json) => c.tipo === 'ingreso')
        .map((c: Json) => c.nombre)
        .sort(),
    ).toEqual(['Conciliación', 'Otros ingresos', 'Sueldo', 'Ventas'].sort());
    for (const category of body.categories) {
      expect(category).toEqual({
        id: expect.any(String),
        accountId: body.account.id,
        nombre: expect.any(String),
        descripcion: null,
        tipo: expect.stringMatching(/^(ingreso|egreso)$/),
        icono: expect.stringMatching(/^[a-z0-9_-]{1,40}$/),
        color: expect.stringMatching(/^#[0-9A-F]{6}$/),
        archivada: false,
        createdAt: iso(NOW),
        updatedAt: iso(NOW),
      });
    }
    expect(await count(db, 'categories', `account_id = '${body.account.id}'`)).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it('el saldo inicial es opcional (0) y admite negativos y los extremos del rango', async () => {
    expect((await createAccount({ nombre: 'A' })).account.saldoInicial).toBe(0);
    expect((await createAccount({ nombre: 'B', saldoInicial: -500 })).account.saldoInicial).toBe(
      -500,
    );
    expect(
      (await createAccount({ nombre: 'C', saldoInicial: MAX_AMOUNT_CENTS })).account.saldoInicial,
    ).toBe(MAX_AMOUNT_CENTS);
    expect(
      (await createAccount({ nombre: 'D', saldoInicial: -MAX_AMOUNT_CENTS })).account.saldoInicial,
    ).toBe(-MAX_AMOUNT_CENTS);
  });

  it('guarda -0 como 0', async () => {
    const response = await call(
      'POST',
      '/accounts',
      token,
      '{"nombre":"Cero","saldoInicial":-0}',
      true,
    );
    expect(response.status).toBe(201);
    expect(Object.is((await json(response)).account.saldoInicial, 0)).toBe(true);
  });

  it.each([
    ['sin nombre', {}],
    ['nombre vacío', { nombre: '' }],
    ['nombre solo espacios', { nombre: '   ' }],
    ['nombre de 61 caracteres', { nombre: 'a'.repeat(61) }],
    ['nombre no texto', { nombre: 5 }],
    ['saldo decimal', { nombre: 'A', saldoInicial: 10.5 }],
    ['saldo texto', { nombre: 'A', saldoInicial: '100' }],
    ['saldo null', { nombre: 'A', saldoInicial: null }],
    ['saldo fuera de rango', { nombre: 'A', saldoInicial: MAX_AMOUNT_CENTS + 2 }],
    ['campo desconocido', { nombre: 'A', archivada: true }],
    ['arreglo', []],
    ['null', null],
  ])('rechaza con 400 INVALID_REQUEST: %s', async (_name, body) => {
    const response = await call('POST', '/accounts', token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await count(db, 'accounts')).toBe(0);
  });

  it('rechaza un cuerpo que no es JSON y un cuerpo ausente con 400', async () => {
    expect((await call('POST', '/accounts', token, '{no json', true)).status).toBe(400);
    expect((await call('POST', '/accounts', token)).status).toBe(400);
  });

  it('rechaza con 413 PAYLOAD_TOO_LARGE un cuerpo de más de 4 KiB', async () => {
    const big = JSON.stringify({ nombre: 'x'.repeat(MAX_RESOURCE_BODY_BYTES) });
    const response = await call('POST', '/accounts', token, big, true);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(ERR('PAYLOAD_TOO_LARGE'));
    expect(await count(db, 'accounts')).toBe(0);
  });

  it('413 y 400 se evalúan antes que 404 y 409', async () => {
    const big = JSON.stringify({ nombre: 'x'.repeat(MAX_RESOURCE_BODY_BYTES) });
    expect((await call('POST', `/accounts/${uuid()}/categories`, token, big, true)).status).toBe(
      413,
    );
    expect((await call('PATCH', `/accounts/${uuid()}`, token, {})).status).toBe(400);
    expect((await call('PATCH', '/accounts/no-es-uuid', token, {})).status).toBe(400);
    expect((await call('PATCH', `/categories/${uuid()}`, token, { tipo: 'ingreso' })).status).toBe(
      400,
    );
  });

  it('el límite de cuentas cuenta las archivadas y responde 409 LIMIT_REACHED', async () => {
    for (let i = 0; i < MAX_ACCOUNTS_PER_USER; i += 1) {
      await insertAccount(db, userId, { archivada: i % 2 });
    }
    const response = await call('POST', '/accounts', token, { nombre: 'Once' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('LIMIT_REACHED'));
    expect(await count(db, 'accounts')).toBe(MAX_ACCOUNTS_PER_USER);
  });

  it('el límite es por usuario: las cuentas de otro no cuentan', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    for (let i = 0; i < MAX_ACCOUNTS_PER_USER; i += 1) await insertAccount(db, other.id);
    expect((await call('POST', '/accounts', token, { nombre: 'Mía' })).status).toBe(201);
  });

  it('con 9 cuentas todavía permite la décima', async () => {
    for (let i = 0; i < MAX_ACCOUNTS_PER_USER - 1; i += 1) await insertAccount(db, userId);
    expect((await call('POST', '/accounts', token, { nombre: 'Décima' })).status).toBe(201);
  });
});

describe('atomicidad de la creación', () => {
  it('si falla una sentencia del batch no queda la cuenta ni ninguna categoría', async () => {
    const accountId = uuid();
    const statements = [
      insertAccountStatement(db, {
        id: accountId,
        userId,
        nombre: 'Rota',
        saldoInicial: 0,
        color: null,
        icono: null,
        now: NOW,
      }),
      ...DEFAULT_CATEGORIES.map((category, index) =>
        insertCategoryStatement(db, {
          id: uuid(),
          accountId,
          userId,
          descripcion: null,
          now: NOW,
          ...category,
          // La última sentencia incumple el CHECK de color.
          color: index === DEFAULT_CATEGORIES.length - 1 ? 'rojo' : category.color,
        }),
      ),
    ];
    expect(statements).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    await expect(db.batch(statements)).rejects.toThrow();
    expect(await count(db, 'accounts')).toBe(0);
    expect(await count(db, 'categories')).toBe(0);
  });

  it('el servicio no deja una cuenta a medias si el batch falla', async () => {
    const failing = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            // Ejecuta todo menos la última sentencia en un batch real y luego falla: simulado
            // con un batch que incluye una sentencia inválida.
            const bad = target.prepare('INSERT INTO categories (id) VALUES (NULL)');
            return target.batch([...statements.slice(0, -1), bad]);
          };
        }
        const value = Reflect.get(target, prop, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const response = await app.request(
      '/accounts',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Rota' }),
      },
      { ...AUTH_ENV, DB: failing },
    );
    expect(response.status).toBe(500);
    expect(await count(db, 'accounts')).toBe(0);
    expect(await count(db, 'categories')).toBe(0);
  });
});

describe('GET /accounts', () => {
  it('lista vacía con la paginación por defecto', async () => {
    const response = await call('GET', '/accounts', token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
    });
  });

  it('oculta las archivadas salvo incluirArchivadas=true y respeta el orden de creación', async () => {
    const first = await insertAccount(db, userId, { nombre: 'Primera', created_at: iso(NOW) });
    const second = await insertAccount(db, userId, {
      nombre: 'Segunda',
      archivada: 1,
      created_at: iso(plusMs(NOW, 1000)),
    });
    const active = await json(await call('GET', '/accounts', token));
    expect(active.items.map((a: Json) => a.id)).toEqual([first]);
    expect(active.total).toBe(1);
    const all = await json(await call('GET', '/accounts?incluirArchivadas=true', token));
    expect(all.items.map((a: Json) => a.id)).toEqual([first, second]);
    expect(all.items[1]).toEqual({
      id: second,
      nombre: 'Segunda',
      saldoInicial: 0,
      saldo: 0,
      archivada: true,
      color: null,
      icono: null,
      createdAt: iso(plusMs(NOW, 1000)),
      updatedAt: iso(NOW),
    });
    expect(all.total).toBe(2);
    const explicitFalse = await json(await call('GET', '/accounts?incluirArchivadas=false', token));
    expect(explicitFalse.total).toBe(1);
  });

  it('pagina con page y page_size', async () => {
    for (let i = 0; i < 5; i += 1) {
      await insertAccount(db, userId, { nombre: `C${i}`, created_at: iso(plusMs(NOW, i * 1000)) });
    }
    const page2 = await json(await call('GET', '/accounts?page=2&page_size=2', token));
    expect(page2.items.map((a: Json) => a.nombre)).toEqual(['C2', 'C3']);
    expect(page2).toMatchObject({ page: 2, pageSize: 2, total: 5 });
    const page3 = await json(await call('GET', '/accounts?page=3&page_size=2', token));
    expect(page3.items.map((a: Json) => a.nombre)).toEqual(['C4']);
    const beyond = await json(await call('GET', '/accounts?page=9&page_size=2', token));
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(5);
    expect((await json(await call('GET', '/accounts?page_size=100', token))).pageSize).toBe(100);
  });

  it.each([
    'page=0',
    'page=-1',
    'page=abc',
    'page=1.5',
    'page=',
    'page=1&page=2',
    'page_size=0',
    'page_size=101',
    'page_size=x',
    'incluirArchivadas=si',
    'incluirArchivadas=TRUE',
    'incluirArchivadas=1',
  ])('rechaza con 400 INVALID_REQUEST el parámetro inválido %s', async (query) => {
    const response = await call('GET', `/accounts?${query}`, token);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
  });
});

describe('PATCH /accounts/:id', () => {
  it('renombra y archiva, actualiza updatedAt y deja intacto saldoInicial', async () => {
    const { account } = await createAccount({ nombre: 'Vieja', saldoInicial: 700 });
    clock = plusMs(NOW, 5000);
    const renamed = await call('PATCH', `/accounts/${account.id}`, token, { nombre: '  Nueva ' });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({
      account: { ...account, nombre: 'Nueva', updatedAt: iso(clock) },
    });
    const archived = await json(
      await call('PATCH', `/accounts/${account.id}`, token, { archivada: true }),
    );
    expect(archived.account).toMatchObject({
      archivada: true,
      nombre: 'Nueva',
      saldoInicial: 700,
      saldo: 700,
    });
    const restored = await json(
      await call('PATCH', `/accounts/${account.id}`, token, { archivada: false, nombre: 'Otra' }),
    );
    expect(restored.account).toMatchObject({ archivada: false, nombre: 'Otra' });
  });

  it('archivar una cuenta conserva sus categorías', async () => {
    const { account } = await createAccount();
    await call('PATCH', `/accounts/${account.id}`, token, { archivada: true });
    expect(await count(db, 'categories', `account_id = '${account.id}'`)).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it.each([
    ['cuerpo vacío', {}],
    ['saldoInicial (no editable)', { saldoInicial: 5 }],
    ['saldoInicial junto a un campo válido', { nombre: 'X', saldoInicial: 5 }],
    ['nombre vacío', { nombre: ' ' }],
    ['archivada no booleana', { archivada: 1 }],
    ['campo desconocido', { foo: 1 }],
  ])('rechaza con 400: %s', async (_name, body) => {
    const { account } = await createAccount();
    const response = await call('PATCH', `/accounts/${account.id}`, token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await rowOf(db, 'accounts', account.id)).toMatchObject({
      nombre: 'Principal',
      saldo_inicial: 0,
    });
  });

  it('responde 404 para un id inexistente o que no es UUID', async () => {
    for (const id of [uuid(), 'no-es-uuid', uuid().toUpperCase()]) {
      const response = await call('PATCH', `/accounts/${id}`, token, { nombre: 'X' });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });

  it('413 con un cuerpo de más de 4 KiB', async () => {
    const { account } = await createAccount();
    const big = JSON.stringify({ nombre: 'x'.repeat(MAX_RESOURCE_BODY_BYTES) });
    expect((await call('PATCH', `/accounts/${account.id}`, token, big, true)).status).toBe(413);
  });
});

describe('GET /accounts/:id/categories', () => {
  it('lista ordenado por tipo y luego por nombre sin distinguir mayúsculas', async () => {
    const accountId = await insertAccount(db, userId);
    await insertCategory(db, accountId, { nombre: 'beta', tipo: 'egreso' });
    await insertCategory(db, accountId, { nombre: 'Alfa', tipo: 'egreso' });
    await insertCategory(db, accountId, { nombre: 'Zeta', tipo: 'egreso' });
    await insertCategory(db, accountId, { nombre: 'Sueldo', tipo: 'ingreso' });
    const body = await json(await call('GET', `/accounts/${accountId}/categories`, token));
    expect(body.items.map((c: Json) => `${c.tipo}:${c.nombre}`)).toEqual([
      'egreso:Alfa',
      'egreso:beta',
      'egreso:Zeta',
      'ingreso:Sueldo',
    ]);
    expect(body).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 4 });
  });

  it('filtra por tipo y por archivadas, y pagina', async () => {
    const { account } = await createAccount();
    const url = `/accounts/${account.id}/categories`;
    const egresos = await json(await call('GET', `${url}?tipo=egreso`, token));
    expect(egresos.total).toBe(9);
    expect((await json(await call('GET', `${url}?tipo=ingreso`, token))).total).toBe(4);
    const page = await json(await call('GET', `${url}?tipo=egreso&page=2&page_size=3`, token));
    expect(page.items).toHaveLength(3);
    expect(page).toMatchObject({ page: 2, pageSize: 3, total: 9 });

    await call('PATCH', `/categories/${egresos.items[0].id}`, token, { archivada: true });
    expect((await json(await call('GET', url, token))).total).toBe(DEFAULT_CATEGORIES.length - 1);
    const all = await json(await call('GET', `${url}?incluirArchivadas=true`, token));
    expect(all.total).toBe(DEFAULT_CATEGORIES.length);
    expect(all.items.find((c: Json) => c.id === egresos.items[0].id).archivada).toBe(true);
  });

  it.each([
    'tipo=gasto',
    'tipo=',
    'tipo=ingreso&tipo=egreso',
    'page=0',
    'page_size=101',
    'incluirArchivadas=x',
  ])('rechaza con 400 el parámetro inválido %s', async (query) => {
    const { account } = await createAccount();
    const response = await call('GET', `/accounts/${account.id}/categories?${query}`, token);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
  });

  it('responde 404 para una cuenta inexistente o un id que no es UUID', async () => {
    for (const id of [uuid(), 'abc']) {
      const response = await call('GET', `/accounts/${id}/categories`, token);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });

  it('una cuenta archivada sigue listando sus categorías', async () => {
    const { account } = await createAccount();
    await call('PATCH', `/accounts/${account.id}`, token, { archivada: true });
    const body = await json(await call('GET', `/accounts/${account.id}/categories`, token));
    expect(body.total).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('POST /accounts/:id/categories', () => {
  const url = (accountId: string) => `/accounts/${accountId}/categories`;

  it('crea con los valores por defecto de icono y color', async () => {
    const { account } = await createAccount();
    const response = await call('POST', url(account.id), token, {
      nombre: ' Mascotas ',
      tipo: 'egreso',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      category: {
        id: expect.any(String),
        accountId: account.id,
        nombre: 'Mascotas',
        descripcion: null,
        tipo: 'egreso',
        icono: 'tag',
        color: '#6B7280',
        archivada: false,
        createdAt: iso(NOW),
        updatedAt: iso(NOW),
      },
    });
  });

  it('normaliza el color a mayúsculas y guarda descripción e icono', async () => {
    const { account } = await createAccount();
    const body = await json(
      await call('POST', url(account.id), token, {
        nombre: 'Freelance',
        tipo: 'ingreso',
        descripcion: ' Trabajos sueltos ',
        icono: 'laptop_2-x',
        color: '#abcdef',
      }),
    );
    expect(body.category).toMatchObject({
      descripcion: 'Trabajos sueltos',
      icono: 'laptop_2-x',
      color: '#ABCDEF',
    });
    const row = await rowOf(db, 'categories', body.category.id);
    expect(row).toMatchObject({ color: '#ABCDEF' });
  });

  it.each([
    ['sin nombre', { tipo: 'egreso' }],
    ['sin tipo', { nombre: 'X' }],
    ['tipo inválido', { nombre: 'X', tipo: 'gasto' }],
    ['nombre de 41 caracteres', { nombre: 'a'.repeat(41), tipo: 'egreso' }],
    ['nombre vacío', { nombre: '  ', tipo: 'egreso' }],
    ['descripción vacía', { nombre: 'X', tipo: 'egreso', descripcion: '' }],
    [
      'descripción de 201 caracteres',
      { nombre: 'X', tipo: 'egreso', descripcion: 'a'.repeat(201) },
    ],
    ['icono con mayúsculas', { nombre: 'X', tipo: 'egreso', icono: 'Tag' }],
    ['icono con espacios', { nombre: 'X', tipo: 'egreso', icono: 'a b' }],
    ['icono de 41 caracteres', { nombre: 'X', tipo: 'egreso', icono: 'a'.repeat(41) }],
    ['icono vacío', { nombre: 'X', tipo: 'egreso', icono: '' }],
    ['color sin almohadilla', { nombre: 'X', tipo: 'egreso', color: 'ABCDEF' }],
    ['color corto', { nombre: 'X', tipo: 'egreso', color: '#ABC' }],
    ['color no hexadecimal', { nombre: 'X', tipo: 'egreso', color: '#ZZZZZZ' }],
    ['campo desconocido', { nombre: 'X', tipo: 'egreso', archivada: true }],
  ])('rechaza con 400: %s', async (_name, body) => {
    const { account } = await createAccount();
    const response = await call('POST', url(account.id), token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    expect(await count(db, 'categories', `account_id = '${account.id}'`)).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it('rechaza un nombre repetido sin distinguir mayúsculas ni tildes en mayúscula', async () => {
    const { account } = await createAccount();
    for (const nombre of ['Alimentación', 'alimentación', 'ALIMENTACIÓN', ' alimentación ']) {
      const response = await call('POST', url(account.id), token, { nombre, tipo: 'egreso' });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual(ERR('CATEGORY_NAME_TAKEN'));
    }
    expect(await count(db, 'categories', `account_id = '${account.id}'`)).toBe(
      DEFAULT_CATEGORIES.length,
    );
  });

  it('el duplicado vale por cuenta y tipo: mismo nombre en el otro tipo o en otra cuenta es válido', async () => {
    const { account } = await createAccount();
    const other = await createAccount({ nombre: 'Otra' });
    expect(
      (await call('POST', url(account.id), token, { nombre: 'Alimentación', tipo: 'ingreso' }))
        .status,
    ).toBe(201);
    expect(
      (await call('POST', url(other.account.id), token, { nombre: 'Nuevo', tipo: 'egreso' }))
        .status,
    ).toBe(201);
    expect(
      (await call('POST', url(other.account.id), token, { nombre: 'Nuevo', tipo: 'egreso' }))
        .status,
    ).toBe(409);
  });

  it('un nombre repetido de una categoría archivada también cuenta como duplicado', async () => {
    const { account, categories } = await createAccount();
    await call('PATCH', `/categories/${categories[0].id}`, token, { archivada: true });
    const response = await call('POST', url(account.id), token, {
      nombre: categories[0].nombre,
      tipo: categories[0].tipo,
    });
    expect(response.status).toBe(409);
  });

  it('el límite de 60 categorías por cuenta cuenta las archivadas', async () => {
    const { account } = await createAccount();
    for (let i = 0; i < MAX_CATEGORIES_PER_ACCOUNT - DEFAULT_CATEGORIES.length; i += 1) {
      await insertCategory(db, account.id, { nombre: `Extra ${i}`, archivada: i % 2 });
    }
    expect(await count(db, 'categories', `account_id = '${account.id}'`)).toBe(
      MAX_CATEGORIES_PER_ACCOUNT,
    );
    const response = await call('POST', url(account.id), token, {
      nombre: 'Una más',
      tipo: 'egreso',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('LIMIT_REACHED'));
  });

  it('con 59 categorías todavía permite la 60', async () => {
    const { account } = await createAccount();
    for (let i = 0; i < MAX_CATEGORIES_PER_ACCOUNT - DEFAULT_CATEGORIES.length - 1; i += 1) {
      await insertCategory(db, account.id, { nombre: `Extra ${i}` });
    }
    expect(
      (await call('POST', url(account.id), token, { nombre: 'La 60', tipo: 'egreso' })).status,
    ).toBe(201);
  });

  it('en una cuenta archivada responde 409 ACCOUNT_ARCHIVED', async () => {
    const { account } = await createAccount();
    await call('PATCH', `/accounts/${account.id}`, token, { archivada: true });
    const response = await call('POST', url(account.id), token, {
      nombre: 'Nueva',
      tipo: 'egreso',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(ERR('ACCOUNT_ARCHIVED'));
  });

  it('404 para una cuenta inexistente o un id que no es UUID', async () => {
    for (const id of [uuid(), 'abc']) {
      const response = await call('POST', url(id), token, { nombre: 'X', tipo: 'egreso' });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });
});

describe('PATCH /categories/:id', () => {
  async function seeded() {
    const created = await createAccount();
    const category = created.categories.find((c: Json) => c.nombre === 'Transporte') as Json;
    return { account: created.account as Json, category };
  }

  it('edita nombre, descripción, icono, color y archivada, y actualiza updatedAt', async () => {
    const { category } = await seeded();
    clock = plusMs(NOW, 9000);
    const response = await call('PATCH', `/categories/${category.id}`, token, {
      nombre: ' Movilidad ',
      descripcion: 'Bus y taxi',
      icono: 'car',
      color: '#00ff00',
      archivada: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      category: {
        ...category,
        nombre: 'Movilidad',
        descripcion: 'Bus y taxi',
        icono: 'car',
        color: '#00FF00',
        archivada: true,
        updatedAt: iso(clock),
      },
    });
  });

  it('descripcion null borra la descripción', async () => {
    const { category } = await seeded();
    await call('PATCH', `/categories/${category.id}`, token, { descripcion: 'algo' });
    const cleared = await json(
      await call('PATCH', `/categories/${category.id}`, token, { descripcion: null }),
    );
    expect(cleared.category.descripcion).toBeNull();
  });

  it('el tipo es inmutable: enviarlo responde 400 y no cambia nada', async () => {
    const { category } = await seeded();
    for (const tipo of ['ingreso', 'egreso']) {
      const response = await call('PATCH', `/categories/${category.id}`, token, { tipo });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
    }
    expect(await rowOf(db, 'categories', category.id)).toMatchObject({ tipo: 'egreso' });
  });

  it.each([
    ['cuerpo vacío', {}],
    ['nombre vacío', { nombre: '' }],
    ['descripción vacía', { descripcion: '' }],
    ['icono inválido', { icono: 'A B' }],
    ['color inválido', { color: 'red' }],
    ['archivada no booleana', { archivada: 'true' }],
    ['accountId (no editable)', { accountId: uuid() }],
    ['campo desconocido', { foo: 1 }],
  ])('rechaza con 400: %s', async (_name, body) => {
    const { category } = await seeded();
    const response = await call('PATCH', `/categories/${category.id}`, token, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(ERR('INVALID_REQUEST'));
  });

  it('renombrar a un nombre existente responde 409, pero cambiar solo mayúsculas del propio es válido', async () => {
    const { category } = await seeded();
    const taken = await call('PATCH', `/categories/${category.id}`, token, {
      nombre: 'ALIMENTACIÓN',
    });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual(ERR('CATEGORY_NAME_TAKEN'));
    const own = await call('PATCH', `/categories/${category.id}`, token, { nombre: 'TRANSPORTE' });
    expect(own.status).toBe(200);
    expect((await json(own)).category.nombre).toBe('TRANSPORTE');
  });

  it('se puede archivar y desarchivar una categoría de una cuenta activa', async () => {
    const { category } = await seeded();
    expect(
      (await json(await call('PATCH', `/categories/${category.id}`, token, { archivada: true })))
        .category.archivada,
    ).toBe(true);
    expect(
      (await json(await call('PATCH', `/categories/${category.id}`, token, { archivada: false })))
        .category.archivada,
    ).toBe(false);
  });

  it('en una cuenta archivada no se desarchiva (409 ACCOUNT_ARCHIVED) pero sí se edita y se archiva', async () => {
    const { account, category } = await seeded();
    await call('PATCH', `/categories/${category.id}`, token, { archivada: true });
    await call('PATCH', `/accounts/${account.id}`, token, { archivada: true });

    const unarchive = await call('PATCH', `/categories/${category.id}`, token, {
      archivada: false,
    });
    expect(unarchive.status).toBe(409);
    expect(await unarchive.json()).toEqual(ERR('ACCOUNT_ARCHIVED'));
    expect(await rowOf(db, 'categories', category.id)).toMatchObject({ archivada: 1 });

    const edit = await call('PATCH', `/categories/${category.id}`, token, { color: '#111111' });
    expect(edit.status).toBe(200);
    const other =
      account &&
      (await json(await call('GET', `/accounts/${account.id}/categories`, token))).items[0];
    expect(
      (await call('PATCH', `/categories/${other.id}`, token, { archivada: true })).status,
    ).toBe(200);
  });

  it('404 para un id inexistente o que no es UUID', async () => {
    for (const id of [uuid(), 'abc']) {
      const response = await call('PATCH', `/categories/${id}`, token, { nombre: 'X' });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(ERR('NOT_FOUND'));
    }
  });
});

describe('DELETE /categories/:id', () => {
  it('elimina físicamente y responde 204 sin cuerpo; el segundo intento es 404 (no idempotente)', async () => {
    const { categories } = await createAccount();
    const id = categories[0].id as string;
    const first = await call('DELETE', `/categories/${id}`, token);
    expect(first.status).toBe(204);
    expect(await first.text()).toBe('');
    expect(await rowOf(db, 'categories', id)).toBeNull();
    const second = await call('DELETE', `/categories/${id}`, token);
    expect(second.status).toBe(404);
    expect(await second.json()).toEqual(ERR('NOT_FOUND'));
  });

  it('elimina también una categoría archivada y las de una cuenta archivada', async () => {
    const { account, categories } = await createAccount();
    await call('PATCH', `/categories/${categories[0].id}`, token, { archivada: true });
    await call('PATCH', `/accounts/${account.id}`, token, { archivada: true });
    expect((await call('DELETE', `/categories/${categories[0].id}`, token)).status).toBe(204);
    expect((await call('DELETE', `/categories/${categories[1].id}`, token)).status).toBe(204);
  });

  it('404 para un id que no es UUID', async () => {
    expect((await call('DELETE', '/categories/abc', token)).status).toBe(404);
  });

  it('responde 409 CATEGORY_IN_USE si la categoría tiene movimientos (dependencia inyectada)', async () => {
    const inUseIds = new Set<string>();
    const guarded = createApp({
      now: () => NOW,
      categoryHasTransactions: async (_db, id) => inUseIds.has(id),
    });
    const guardedCall = api(guarded, db);
    const created = await json(
      await guardedCall('POST', '/accounts', token, { nombre: 'Con uso' }),
    );
    const [used, free] = created.categories as Json[];
    inUseIds.add(used!.id);

    const blocked = await guardedCall('DELETE', `/categories/${used!.id}`, token);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual(ERR('CATEGORY_IN_USE'));
    expect(await rowOf(db, 'categories', used!.id)).not.toBeNull();

    // Archivar sigue permitido y las demás categorías se eliminan con normalidad.
    expect(
      (await guardedCall('PATCH', `/categories/${used!.id}`, token, { archivada: true })).status,
    ).toBe(200);
    expect((await guardedCall('DELETE', `/categories/${free!.id}`, token)).status).toBe(204);
  });

  it('categoryHasTransactions es false sin movimientos y para una categoría inexistente', async () => {
    const { categories } = await createAccount();
    expect(await categoryHasTransactions(db, categories[0].id)).toBe(false);
    expect(await categoryHasTransactions(db, uuid())).toBe(false);
  });
});
