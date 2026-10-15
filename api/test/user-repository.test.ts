import { beforeEach, describe, expect, it } from 'vitest';
import { findUserById, upsertUserByGoogleSub } from '../src/db/user-repository';
import { count, DB_HOOK_TIMEOUT_MS, freshDb, iso, NOW, plusMs, rowOf, uuid } from './d1-helpers';

let db: D1Database;
beforeEach(async () => {
  db = await freshDb();
}, DB_HOOK_TIMEOUT_MS);

const input = (overrides: Partial<Parameters<typeof upsertUserByGoogleSub>[1]> = {}) => ({
  id: uuid(),
  google_sub: 'google-sub-1',
  email: 'ana@example.com',
  nombre: 'Ana',
  now: NOW,
  ...overrides,
});

describe('upsertUserByGoogleSub', () => {
  it('crea el usuario con los valores por defecto de la tabla', async () => {
    const data = input();
    const result = await upsertUserByGoogleSub(db, data);
    expect(result.created).toBe(true);
    expect(result.user).toEqual({
      id: data.id,
      google_sub: 'google-sub-1',
      email: 'ana@example.com',
      nombre: 'Ana',
      currency: 'USD',
      plan: 'free',
      plan_expires_at: null,
      created_at: iso(NOW),
      updated_at: iso(NOW),
    });
  });

  it('conserva el id del usuario existente y no escribe si nada cambió', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    const later = plusMs(NOW, 60_000);
    const second = await upsertUserByGoogleSub(db, input({ now: later }));
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.updated_at).toBe(iso(NOW));
    expect(await count(db, 'users')).toBe(1);
  });

  it('actualiza email y nombre, y solo entonces cambia updated_at', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    const later = plusMs(NOW, 60_000);
    const changedEmail = await upsertUserByGoogleSub(
      db,
      input({ email: 'nuevo@example.com', now: later }),
    );
    expect(changedEmail.created).toBe(false);
    expect(changedEmail.user).toMatchObject({
      id: first.user.id,
      email: 'nuevo@example.com',
      nombre: 'Ana',
      created_at: iso(NOW),
      updated_at: iso(later),
    });

    const evenLater = plusMs(NOW, 120_000);
    const changedName = await upsertUserByGoogleSub(
      db,
      input({ email: 'nuevo@example.com', nombre: 'Ana María', now: evenLater }),
    );
    expect(changedName.user).toMatchObject({ nombre: 'Ana María', updated_at: iso(evenLater) });
  });

  it('usuario nuevo sin nombre válido (null, vacío o espacios) guarda NULL', async () => {
    for (const [i, nombre] of ([null, '', '   '] as const).entries()) {
      const result = await upsertUserByGoogleSub(db, input({ google_sub: `sub-${i}`, nombre }));
      expect(result.created).toBe(true);
      expect(result.user.nombre).toBeNull();
    }
  });

  it.each([
    ['ausente (null)', null],
    ['vacío', ''],
    ['solo espacios', '   \t '],
  ])(
    'existente con nombre y Google entrega nombre %s: conserva nombre y no escribe',
    async (_n, nombre) => {
      const first = await upsertUserByGoogleSub(db, input());
      const second = await upsertUserByGoogleSub(db, input({ nombre, now: plusMs(NOW, 60_000) }));
      expect(second.created).toBe(false);
      expect(second.user).toEqual(first.user);
      expect(second.user.nombre).toBe('Ana');
      expect(second.user.updated_at).toBe(iso(NOW));
    },
  );

  it('nombre válido distinto actualiza nombre y updated_at; se recorta con trim', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    const later = plusMs(NOW, 60_000);
    const second = await upsertUserByGoogleSub(db, input({ nombre: '  Ana María ', now: later }));
    expect(second.user).toEqual({ ...first.user, nombre: 'Ana María', updated_at: iso(later) });
  });

  it('sin cambios la fila queda idéntica', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    await upsertUserByGoogleSub(db, input({ now: plusMs(NOW, 60_000) }));
    expect(await rowOf(db, 'users', first.user.id)).toEqual(first.user);
  });

  it('email cambia sin nombre: actualiza email, conserva nombre y updated_at cambia', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    const later = plusMs(NOW, 60_000);
    const second = await upsertUserByGoogleSub(
      db,
      input({ email: 'otro@example.com', nombre: null, now: later }),
    );
    expect(second.user).toEqual({
      ...first.user,
      email: 'otro@example.com',
      nombre: 'Ana',
      updated_at: iso(later),
    });
  });

  it('id interno y google_sub nunca cambian en un upsert', async () => {
    const first = await upsertUserByGoogleSub(db, input());
    const second = await upsertUserByGoogleSub(
      db,
      input({ id: uuid(), email: 'x@example.com', nombre: 'Otro', now: plusMs(NOW, 1000) }),
    );
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.google_sub).toBe('google-sub-1');
    expect(await count(db, 'users')).toBe(1);
  });

  it('nombre NULL guardado se completa cuando Google entrega uno válido', async () => {
    await upsertUserByGoogleSub(db, input({ nombre: null }));
    const later = plusMs(NOW, 1000);
    const second = await upsertUserByGoogleSub(db, input({ nombre: 'Ana', now: later }));
    expect(second.user).toMatchObject({ nombre: 'Ana', updated_at: iso(later) });
  });

  it('10 upserts simultáneos del mismo google_sub dejan una sola fila y un solo creado', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => upsertUserByGoogleSub(db, input())),
    );
    expect(await count(db, 'users')).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.user.id)).size).toBe(1);
  });

  it('google_sub distintos crean usuarios distintos', async () => {
    await upsertUserByGoogleSub(db, input({ google_sub: 'a' }));
    await upsertUserByGoogleSub(db, input({ google_sub: 'b' }));
    expect(await count(db, 'users')).toBe(2);
  });
});

describe('findUserById', () => {
  it('devuelve el usuario o null', async () => {
    const { user } = await upsertUserByGoogleSub(db, input());
    expect(await findUserById(db, user.id)).toEqual(user);
    expect(await findUserById(db, uuid())).toBeNull();
    expect(await rowOf(db, 'users', user.id)).toMatchObject({ id: user.id });
  });
});
