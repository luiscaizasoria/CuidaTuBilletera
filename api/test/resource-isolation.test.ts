import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  NOW,
  rowOf,
  uuid,
} from './d1-helpers';
import { api, userWithToken } from './resource-helpers';

// Dos usuarios con datos propios: cada endpoint, ejecutado por el usuario B contra recursos de A,
// responde 404 idéntico al de un recurso inexistente y no altera ninguna fila de A.
let db: D1Database;
let call: ReturnType<typeof api>;
let a: { id: string; token: string };
let b: { id: string; token: string };
let accountA: string;
let categoryA: string;

beforeEach(async () => {
  db = await freshDb();
  call = api(createApp({ now: () => NOW }), db);
  a = await userWithToken(db, 'a@example.com');
  b = await userWithToken(db, 'b@example.com');
  accountA = await insertAccount(db, a.id, { nombre: 'De A', saldo_inicial: 1000 });
  categoryA = await insertCategory(db, accountA, { nombre: 'Solo de A' });
}, DB_HOOK_TIMEOUT_MS);

const NOT_FOUND = { error: { code: 'NOT_FOUND', message: expect.any(String) } };

async function snapshot() {
  return {
    account: await rowOf(db, 'accounts', accountA),
    category: await rowOf(db, 'categories', categoryA),
    accounts: await count(db, 'accounts'),
    categories: await count(db, 'categories'),
  };
}

async function expectSameAsMissing(
  method: string,
  foreign: string,
  missing: string,
  body?: unknown,
) {
  const before = await snapshot();
  const response = await call(method, foreign, b.token, body);
  const reference = await call(method, missing, b.token, body);
  expect(response.status).toBe(404);
  expect(reference.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
  expect(await reference.json()).toEqual(NOT_FOUND);
  expect(await snapshot()).toEqual(before);
}

describe('aislamiento entre usuarios (los 7 endpoints)', () => {
  it('GET /accounts solo lista las cuentas propias', async () => {
    const own = await insertAccount(db, b.id, { nombre: 'De B' });
    const response = await call('GET', '/accounts?incluirArchivadas=true', b.token);
    const body = (await response.json()) as { items: { id: string }[]; total: number };
    expect(body.items.map((item) => item.id)).toEqual([own]);
    expect(body.total).toBe(1);
    const asA = (await (await call('GET', '/accounts', a.token)).json()) as { total: number };
    expect(asA.total).toBe(1);
  });

  it('POST /accounts crea la cuenta para el usuario autenticado y el límite no se comparte', async () => {
    const response = await call('POST', '/accounts', b.token, { nombre: 'Nueva de B' });
    expect(response.status).toBe(201);
    const { account } = (await response.json()) as { account: { id: string } };
    expect(await rowOf(db, 'accounts', account.id)).toMatchObject({ user_id: b.id });
    expect(await count(db, 'accounts', `user_id = '${a.id}'`)).toBe(1);
  });

  it('PATCH /accounts/:id ajena es 404 y no modifica la cuenta', async () => {
    await expectSameAsMissing('PATCH', `/accounts/${accountA}`, `/accounts/${uuid()}`, {
      nombre: 'Robada',
      archivada: true,
    });
  });

  it('GET /accounts/:id/categories de una cuenta ajena es 404', async () => {
    await expectSameAsMissing(
      'GET',
      `/accounts/${accountA}/categories`,
      `/accounts/${uuid()}/categories`,
    );
  });

  it('POST /accounts/:id/categories en una cuenta ajena es 404 y no inserta', async () => {
    await expectSameAsMissing(
      'POST',
      `/accounts/${accountA}/categories`,
      `/accounts/${uuid()}/categories`,
      { nombre: 'Intrusa', tipo: 'egreso' },
    );
  });

  it('PATCH /categories/:id ajena es 404 y no modifica la categoría', async () => {
    await expectSameAsMissing('PATCH', `/categories/${categoryA}`, `/categories/${uuid()}`, {
      nombre: 'Robada',
      archivada: true,
    });
  });

  it('DELETE /categories/:id ajena es 404 y no borra la categoría', async () => {
    await expectSameAsMissing('DELETE', `/categories/${categoryA}`, `/categories/${uuid()}`);
    expect(await rowOf(db, 'categories', categoryA)).not.toBeNull();
  });

  it('el propietario sí opera sobre sus recursos tras los intentos ajenos', async () => {
    expect(
      (await call('PATCH', `/categories/${categoryA}`, a.token, { nombre: 'Mía' })).status,
    ).toBe(200);
    expect((await call('DELETE', `/categories/${categoryA}`, a.token)).status).toBe(204);
  });

  it('el nombre repetido no se detecta entre cuentas de usuarios distintos', async () => {
    const accountB = await insertAccount(db, b.id);
    const response = await call('POST', `/accounts/${accountB}/categories`, b.token, {
      nombre: 'Solo de A',
      tipo: 'egreso',
    });
    expect(response.status).toBe(201);
  });
});
