import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ACCOUNT_COLORS, ACCOUNT_ICONS } from '../src/lib/account-appearance';
import {
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertTransactionRow,
  iso,
  NOW,
  plusMs,
  rowOf,
  uuid,
} from './d1-helpers';
import { api, userWithToken } from './resource-helpers';

let db: D1Database;
let clock: Date;
let call: ReturnType<typeof api>;
let token: string;
let userId: string;

beforeEach(async () => {
  db = await freshDb();
  clock = NOW;
  call = api(createApp({ now: () => clock }), db);
  ({ id: userId, token } = await userWithToken(db));
}, DB_HOOK_TIMEOUT_MS);

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (response: Response) => (await response.json()) as Json;
const ERR400 = { error: { code: 'INVALID_REQUEST', message: expect.any(String) } };

async function create(body: unknown = { nombre: 'Cuenta' }): Promise<Json> {
  const response = await call('POST', '/accounts', token, body);
  expect(response.status).toBe(201);
  return (await json(response)).account;
}
const patch = (id: string, body: unknown, as = token) => call('PATCH', `/accounts/${id}`, as, body);

describe('cuentas antiguas (sin apariencia)', () => {
  it('una fila previa a la 0004 se devuelve con color e icono null en GET', async () => {
    const id = await insertAccount(db, userId, { nombre: 'Antigua' });
    const list = await json(await call('GET', '/accounts', token));
    expect(list.items).toEqual([
      {
        id,
        nombre: 'Antigua',
        saldoInicial: 0,
        saldo: 0,
        archivada: false,
        color: null,
        icono: null,
        createdAt: iso(NOW),
        updatedAt: iso(NOW),
      },
    ]);
  });
});

describe('POST /accounts con apariencia', () => {
  it('sin color ni icono, o con null, guarda NULL y los devuelve como null', async () => {
    for (const body of [
      { nombre: 'A' },
      { nombre: 'B', color: null, icono: null },
      { nombre: 'C', color: undefined },
    ]) {
      const account = await create(body);
      expect(account).toMatchObject({ color: null, icono: null });
      expect(await rowOf(db, 'accounts', account.id)).toMatchObject({ color: null, icono: null });
    }
  });

  it('acepta solo uno de los dos campos', async () => {
    expect(await create({ nombre: 'A', color: 'rosa' })).toMatchObject({
      color: 'rosa',
      icono: null,
    });
    expect(await create({ nombre: 'B', icono: 'gift' })).toMatchObject({
      color: null,
      icono: 'gift',
    });
  });

  it.each(ACCOUNT_COLORS)('guarda y devuelve el color %s', async (color) => {
    const account = await create({ nombre: 'X', color });
    expect(account.color).toBe(color);
    expect((await rowOf(db, 'accounts', account.id))?.color).toBe(color);
    const list = await json(await call('GET', '/accounts', token));
    expect(list.items[0].color).toBe(color);
  });

  it.each(ACCOUNT_ICONS)('guarda y devuelve el ícono %s', async (icono) => {
    const account = await create({ nombre: 'X', icono });
    expect(account.icono).toBe(icono);
    expect((await rowOf(db, 'accounts', account.id))?.icono).toBe(icono);
  });

  it('devuelve ambos junto con el resto del DTO y las 11 categorías', async () => {
    const response = await call('POST', '/accounts', token, {
      nombre: 'Ahorros',
      saldoInicial: 100,
      color: 'lavanda',
      icono: 'piggy-bank',
    });
    const body = await json(response);
    expect(body.account).toEqual({
      id: expect.any(String),
      nombre: 'Ahorros',
      saldoInicial: 100,
      saldo: 100,
      archivada: false,
      color: 'lavanda',
      icono: 'piggy-bank',
      createdAt: iso(NOW),
      updatedAt: iso(NOW),
    });
    expect(body.categories).toHaveLength(11);
  });

  it.each([
    ['limón con tilde', { color: 'limón' }],
    ['mayúsculas', { color: 'Rosa' }],
    ['vacío', { color: '' }],
    ['hex', { color: '#FFFFFF' }],
    ['número', { color: 5 }],
    ['booleano', { icono: true }],
    ['ícono desconocido', { icono: 'inventado' }],
    ['ícono exclusivo de categoría tag', { icono: 'tag' }],
    ['ícono exclusivo de categoría ellipsis', { icono: 'ellipsis' }],
    ['ícono exclusivo de categoría plus-circle', { icono: 'plus-circle' }],
    ['ícono nuevo en mayúsculas', { icono: 'PIZZA' }],
    ['ícono de más de 20 caracteres', { icono: 'a'.repeat(21) }],
    ['ícono en mayúsculas', { icono: 'Wallet' }],
    ['ícono vacío', { icono: '' }],
    ['ícono número', { icono: 1 }],
    ['ícono con espacio', { icono: 'piggy bank' }],
    ['campo extra', { colour: 'rosa' }],
  ])('rechaza con 400 sin reflejar el valor: %s', async (_name, extra) => {
    const response = await call('POST', '/accounts', token, { nombre: 'X', ...extra });
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(ERR400);
    for (const value of Object.values(extra)) {
      if (typeof value === 'string' && value.length > 0) expect(text).not.toContain(value);
    }
    expect((await json(await call('GET', '/accounts', token))).total).toBe(0);
  });
});

describe('íconos ampliados (R5.1)', () => {
  const OLD_ICONS = [
    'wallet',
    'card',
    'bank',
    'piggy-bank',
    'cash',
    'trending-up',
    'briefcase',
    'home',
    'plane',
    'gift',
    'shopping-bag',
    'money-bag',
  ];

  it('las 12 claves antiguas siguen aceptadas en POST y PATCH', async () => {
    const account = await create();
    for (const [i, icono] of OLD_ICONS.entries()) {
      expect(ACCOUNT_ICONS).toContain(icono);
      const response = await patch(account.id, { icono });
      expect(response.status).toBe(200);
      expect((await json(response)).account.icono).toBe(icono);
      // El máximo de cuentas por usuario es 10: POST se prueba con las 9 primeras claves.
      if (i < 9) expect((await create({ nombre: `C ${icono}`, icono })).icono).toBe(icono);
    }
  });

  it('las 246 claves se aceptan en PATCH y se leen en el listado', async () => {
    expect(ACCOUNT_ICONS).toHaveLength(246);
    const account = await create();
    for (const icono of ACCOUNT_ICONS) {
      const response = await patch(account.id, { icono });
      expect(response.status).toBe(200);
      expect((await json(response)).account.icono).toBe(icono);
    }
    const list = await json(await call('GET', '/accounts', token));
    expect(list.items[0].icono).toBe(ACCOUNT_ICONS[ACCOUNT_ICONS.length - 1]);
  }, 120_000);

  it.each(['tag', 'ellipsis', 'plus-circle', 'inventado', 'Pizza', 'a'.repeat(21)])(
    'PATCH rechaza con 400 la clave %s y no modifica la cuenta',
    async (icono) => {
      const account = await create({ nombre: 'A', icono: 'pizza' });
      const response = await patch(account.id, { icono });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(ERR400);
      expect(await rowOf(db, 'accounts', account.id)).toMatchObject({ icono: 'pizza' });
    },
  );

  it('un usuario no puede fijar un ícono nuevo en la cuenta de otro', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id, { nombre: 'Ajena' });
    const before = await rowOf(db, 'accounts', foreign);
    const response = await patch(foreign, { icono: 'pizza' });
    expect(response.status).toBe(404);
    expect(await rowOf(db, 'accounts', foreign)).toEqual(before);
  });

  it('las categorías aceptan, guardan y leen claves nuevas del catálogo', async () => {
    const account = await create();
    for (const icono of ['pizza', 'shower', 'microscope']) {
      const response = await call('POST', `/accounts/${account.id}/categories`, token, {
        nombre: `Cat ${icono}`,
        tipo: 'egreso',
        icono,
      });
      expect(response.status).toBe(201);
      expect((await json(response)).category.icono).toBe(icono);
    }
    const list = await json(await call('GET', `/accounts/${account.id}/categories`, token));
    const icons = list.items.map((c: Json) => c.icono);
    expect(icons).toEqual(expect.arrayContaining(['pizza', 'shower', 'microscope']));
  });
});

describe('PATCH /accounts/:id con apariencia', () => {
  it('fija color e ícono, devuelve la cuenta y actualiza updatedAt', async () => {
    const account = await create();
    clock = plusMs(NOW, 5000);
    const response = await patch(account.id, { color: 'celeste', icono: 'bank' });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      account: { ...account, color: 'celeste', icono: 'bank', updatedAt: iso(clock) },
    });
  });

  it('ausente = sin cambio, null = NULL, valor = fijar', async () => {
    const account = await create({ nombre: 'A', color: 'rosa', icono: 'cash' });
    let body = await json(await patch(account.id, { nombre: 'B' }));
    expect(body.account).toMatchObject({ nombre: 'B', color: 'rosa', icono: 'cash' });
    body = await json(await patch(account.id, { color: null }));
    expect(body.account).toMatchObject({ color: null, icono: 'cash' });
    expect(await rowOf(db, 'accounts', account.id)).toMatchObject({ color: null, icono: 'cash' });
    body = await json(await patch(account.id, { icono: null, color: 'limon' }));
    expect(body.account).toMatchObject({ color: 'limon', icono: null });
    body = await json(await patch(account.id, { icono: 'home' }));
    expect(body.account).toMatchObject({ color: 'limon', icono: 'home' });
  });

  it('null sobre una cuenta ya en NULL es válido y no falla', async () => {
    const account = await create();
    const response = await patch(account.id, { color: null, icono: null });
    expect(response.status).toBe(200);
    expect((await json(response)).account).toMatchObject({ color: null, icono: null });
  });

  it.each([
    ['cuerpo vacío', {}],
    ['solo undefined', { color: undefined }],
    ['limón con tilde', { color: 'limón' }],
    ['mayúsculas', { icono: 'WALLET' }],
    ['vacío', { color: '' }],
    ['número', { icono: 3 }],
    ['campo extra con apariencia válida', { color: 'rosa', extra: 1 }],
    ['saldoInicial sigue sin ser editable', { color: 'rosa', saldoInicial: 5 }],
  ])('rechaza con 400: %s', async (_name, body) => {
    const account = await create({ nombre: 'A', color: 'aguamarina', icono: 'wallet' });
    const response = await patch(account.id, body);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(ERR400);
    expect(text).not.toContain('limón');
    expect(await rowOf(db, 'accounts', account.id)).toMatchObject({
      nombre: 'A',
      color: 'aguamarina',
      icono: 'wallet',
      updated_at: iso(NOW),
    });
  });

  it('archivar y restaurar conserva la apariencia', async () => {
    const account = await create({ nombre: 'A', color: 'rosa', icono: 'gift' });
    const archived = await json(await patch(account.id, { archivada: true }));
    expect(archived.account).toMatchObject({ archivada: true, color: 'rosa', icono: 'gift' });
    const list = await json(await call('GET', '/accounts?incluirArchivadas=true', token));
    expect(list.items[0]).toMatchObject({ archivada: true, color: 'rosa', icono: 'gift' });
    const restored = await json(await patch(account.id, { archivada: false }));
    expect(restored.account).toMatchObject({ archivada: false, color: 'rosa', icono: 'gift' });
  });
});

describe('aislamiento por usuario', () => {
  it('PATCH de apariencia sobre una cuenta ajena responde 404 y no modifica la fila', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const foreign = await insertAccount(db, other.id, { nombre: 'Ajena' });
    const before = await rowOf(db, 'accounts', foreign);
    clock = plusMs(NOW, 9000);
    for (const body of [{ color: 'rosa' }, { icono: null }, { color: 'rosa', icono: 'bank' }]) {
      const response = await patch(foreign, body);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: expect.any(String) },
      });
    }
    expect(await rowOf(db, 'accounts', foreign)).toEqual(before);
    expect((await patch(uuid(), { color: 'rosa' })).status).toBe(404);
  });

  it('el listado no muestra la apariencia de cuentas de otro usuario', async () => {
    const other = await userWithToken(db, 'otro@example.com');
    const mine = await create({ nombre: 'Mía', color: 'rosa' });
    await call('POST', '/accounts', other.token, { nombre: 'Suya', color: 'limon' });
    const list = await json(await call('GET', '/accounts', token));
    expect(list.items.map((a: Json) => [a.id, a.color])).toEqual([[mine.id, 'rosa']]);
  });
});

describe('la apariencia no interviene en saldos, reportes, calendario ni exportación', () => {
  async function withMovements(body: Json): Promise<Json> {
    const account = await create({ saldoInicial: 1000, ...body });
    const expense = await insertCategory(db, account.id, {
      tipo: 'egreso',
      nombre: 'Prueba egreso',
    });
    const income = await insertCategory(db, account.id, {
      tipo: 'ingreso',
      nombre: 'Prueba ingreso',
    });
    await insertTransactionRow(db, account.id, expense, { monto: 300, fecha: '2026-10-05' });
    await insertTransactionRow(db, account.id, income, {
      tipo: 'ingreso',
      monto: 900,
      fecha: '2026-10-06',
    });
    return account;
  }

  async function views(id: string): Promise<Record<string, unknown>> {
    const range = `account_id=${id}&desde=2026-10-01&hasta=2026-10-31`;
    const csv = await (await call('GET', `/export?${range}`, token)).text();
    return {
      balance: await json(await call('GET', `/accounts/${id}/balance`, token)),
      summary: await json(await call('GET', `/reports/summary?${range}`, token)),
      byCategory: await json(await call('GET', `/reports/by-category?${range}`, token)),
      calendar: await json(await call('GET', `/calendar?account_id=${id}&month=2026-10`, token)),
      transactions: (await json(await call('GET', `/transactions?account_id=${id}`, token))).total,
      // Las columnas del CSV no incluyen la cuenta: debe ser idéntico byte a byte.
      csv,
    };
  }

  // Quita lo que depende del id de la cuenta o de las categorías creadas para cada una.
  const normalize = (value: unknown, id: string): unknown =>
    JSON.parse(
      JSON.stringify(value)
        .replaceAll(id, 'ACC')
        .replace(/"(categoryId|category_id|id)":"[0-9a-f-]{36}"/g, '"$1":"X"'),
    );

  it('saldo, reportes, calendario y exportación son idénticos con distinta apariencia', async () => {
    const plain = await withMovements({ nombre: 'Igual' });
    const styled = await withMovements({ nombre: 'Igual', color: 'lavanda', icono: 'plane' });
    const a = normalize(await views(plain.id), plain.id);
    const b = normalize(await views(styled.id), styled.id);
    expect(b).toEqual(a);
    expect((a as Json).balance).toMatchObject({ saldo: 1600, ingresos: 900, gastos: 300 });
  });

  it('cambiar la apariencia no altera saldo ni vistas', async () => {
    const account = await withMovements({ nombre: 'Cambia', color: 'rosa', icono: 'cash' });
    const before = await views(account.id);
    for (const body of [{ color: 'limon' }, { icono: null }, { color: null, icono: 'bank' }]) {
      expect((await patch(account.id, body)).status).toBe(200);
      expect(await views(account.id)).toEqual(before);
    }
  });
});
