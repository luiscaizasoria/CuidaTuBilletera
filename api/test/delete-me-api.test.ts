import type { JWTPayload } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { USER_DATA_TABLES } from '../src/db/profile-repository';
import { issueAccessToken } from '../src/services/access-token-service';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertToken,
  insertTransactionRow,
  insertUser,
  iso,
  plusDays,
  uuid,
} from './d1-helpers';
import { AUTH_ENV, createGoogleFixture, JWT_SECRET, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let db: D1Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  fx = await createGoogleFixture();
});
beforeEach(async () => {
  db = await freshDb();
  app = createApp({ googleKeys: fx.keys, now: () => NOW });
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

const nowSec = Math.floor(NOW.getTime() / 1000);
const SUB_A = 'google-sub-A';
const SUB_B = 'google-sub-B';
const REAUTH = {
  error: {
    code: 'REAUTH_REQUIRED',
    message:
      'No se pudo confirmar tu identidad. Usa la cuenta de Google con la que iniciaste sesión.',
  },
};

const env = (database: unknown = db) => ({ ...AUTH_ENV, DB: database });
const idClaims = (over: JWTPayload = {}): JWTPayload => ({
  ...fx.validClaims(),
  sub: SUB_A,
  ...over,
});

async function makeUser(sub: string, email: string) {
  const id = await insertUser(db, { google_sub: sub, email });
  return { id, token: await issueAccessToken({ id, email }, JWT_SECRET, NOW) };
}

function del(token: string | undefined, body?: unknown, raw = false, e: object = env()) {
  return app.request(
    '/me',
    {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: raw ? (body as string) : JSON.stringify(body) } : {}),
    },
    e,
  );
}

async function validBody(over: JWTPayload = {}) {
  return { confirm: 'ELIMINAR', idToken: await fx.sign(idClaims(over)) };
}

// Inserta n categorías en un único batch (más rápido que una a una).
async function bulkCategories(accountId: string, n: number) {
  const sql = `INSERT INTO categories (id, account_id, nombre, tipo, icono, color, created_at, updated_at)
    VALUES (?1, ?2, ?3, 'egreso', 'tag', '#6B7280', ?4, ?4)`;
  await db.batch(
    Array.from({ length: n }, (_, i) =>
      db.prepare(sql).bind(uuid(), accountId, `Cat ${i}`, iso(NOW)),
    ),
  );
}

async function seed(userId: string) {
  const a1 = await insertAccount(db, userId, { nombre: 'Principal' });
  const a2 = await insertAccount(db, userId, { nombre: 'Archivada', archivada: 1 });
  const a3 = await insertAccount(db, userId, { nombre: 'Llena' });
  const c1 = await insertCategory(db, a1);
  const c1b = await insertCategory(db, a1, { archivada: 1 });
  const c1i = await insertCategory(db, a1, { tipo: 'ingreso' });
  await bulkCategories(a2, 58); // más la de la transacción: 59 categorías
  await bulkCategories(a3, 60);
  await insertTransactionRow(db, a1, c1);
  await insertTransactionRow(db, a1, c1b, { deleted_at: iso(NOW) });
  await insertTransactionRow(db, a1, c1i, { tipo: 'ingreso' });
  await insertTransactionRow(db, a2, await insertCategory(db, a2));
  // Tokens: activo, expirado, revocado y cadena rotada con replaced_by.
  await insertToken(db, userId);
  await insertToken(db, userId, {
    created_at: iso(plusDays(NOW, -10)),
    updated_at: iso(plusDays(NOW, -10)),
    expires_at: iso(plusDays(NOW, -3)),
  });
  await insertToken(db, userId, { revoked_at: iso(NOW), revoked_reason: 'logout' });
  const family = uuid();
  const successor = await insertToken(db, userId, { family_id: family });
  await insertToken(db, userId, {
    family_id: family,
    revoked_at: iso(NOW),
    revoked_reason: 'rotated',
    replaced_by: successor.id,
  });
}

async function counts(userId?: string) {
  const out: Record<string, number> = {};
  for (const t of USER_DATA_TABLES) out[t] = await count(db, t);
  if (userId) {
    out.u_users = await count(db, 'users', `id = '${userId}'`);
    out.u_accounts = await count(db, 'accounts', `user_id = '${userId}'`);
    out.u_tokens = await count(db, 'refresh_tokens', `user_id = '${userId}'`);
  }
  return out;
}

describe('DELETE /me', () => {
  it('204 sin cuerpo y no-store; deja cero filas en las 5 tablas', async () => {
    const a = await makeUser(SUB_A, 'a@example.com');
    await seed(a.id);
    expect((await counts()).transactions).toBeGreaterThan(0);

    const res = await del(a.token, await validBody());
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await counts()).toEqual({
      transactions: 0,
      categories: 0,
      accounts: 0,
      refresh_tokens: 0,
      users: 0,
    });
  });

  it('aísla al usuario B: sus filas quedan intactas', async () => {
    const a = await makeUser(SUB_A, 'a@example.com');
    const b = await makeUser(SUB_B, 'b@example.com');
    await seed(a.id);
    const onlyA = await counts();
    await seed(b.id);
    const both = await counts(b.id);

    expect((await del(a.token, await validBody())).status).toBe(204);

    const after = await counts(b.id);
    expect(after.u_users).toBe(1);
    expect(after.u_accounts).toBe(both.u_accounts);
    expect(after.u_tokens).toBe(both.u_tokens);
    for (const t of USER_DATA_TABLES.filter((x) => x !== 'users'))
      expect(after[t]).toBe(both[t]! - onlyA[t]!);
  });

  it('el refresh token real del usuario borrado devuelve 401 y el de B sigue vigente', async () => {
    const login = async (sub: string, email: string) => {
      const idToken = await fx.sign(idClaims({ sub, email }));
      const r = await app.request(
        '/auth/google',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        },
        env(),
      );
      expect(r.status).toBe(200);
      return (await r.json()) as { accessToken: string; refreshToken: string };
    };
    const refresh = (refreshToken: string) =>
      app.request(
        '/auth/refresh',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        env(),
      );
    const a = await login(SUB_A, 'a@example.com');
    const b = await login(SUB_B, 'b@example.com');
    expect((await del(a.accessToken, await validBody())).status).toBe(204);
    const ra = await refresh(a.refreshToken);
    expect(ra.status).toBe(401);
    expect(((await ra.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_REFRESH_TOKEN',
    );
    expect((await refresh(b.refreshToken)).status).toBe(200);
  });

  describe('401 de sesión', () => {
    it('sin token', async () => {
      const res = await del(undefined, await validBody());
      expect(res.status).toBe(401);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('con un ID token de Google como sesión, JWT v1 y JWT expirado', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      await seed(a.id);
      const before = await counts();
      const body = await validBody();
      const expired = await issueAccessToken(
        { id: a.id, email: 'a@example.com' },
        JWT_SECRET,
        plusDays(NOW, -1),
      );
      const googleAsSession = await fx.sign(idClaims());
      for (const token of [googleAsSession, expired, 'abc.def.ghi']) {
        const res = await del(token, body);
        expect(res.status).toBe(401);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
          'INVALID_TOKEN',
        );
      }
      expect(await counts()).toEqual(before);
    });

    it('segunda llamada tras borrar: 401 INVALID_TOKEN (idempotencia)', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      expect((await del(a.token, await validBody())).status).toBe(204);
      const second = await del(a.token, await validBody());
      expect(second.status).toBe(401);
      expect(((await second.json()) as { error: { code: string } }).error.code).toBe(
        'INVALID_TOKEN',
      );
    });

    it('doble DELETE concurrente: nunca 500', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      await seed(a.id);
      const body = await validBody();
      const results = await Promise.all([del(a.token, body), del(a.token, body)]);
      for (const r of results) expect([204, 401]).toContain(r.status);
      expect(results.some((r) => r.status === 204)).toBe(true);
      expect((await counts()).users).toBe(0);
    });
  });

  describe('REAUTH_REQUIRED sin borrar nada', () => {
    const cases: Array<[string, () => Promise<string>]> = [
      ['iat de hace 301 s', () => fx.sign(idClaims({ iat: nowSec - 301 }))],
      ['iat futuro > 60 s', () => fx.sign(idClaims({ iat: nowSec + 61 }))],
      ['exp vencido', () => fx.sign(idClaims({ iat: nowSec - 100, exp: nowSec - 50 }))],
      ['sub de otro usuario', () => fx.sign(idClaims({ sub: SUB_B }))],
      ['aud errónea', () => fx.sign(idClaims({ aud: 'otro-cliente' }))],
      ['iss erróneo', () => fx.sign(idClaims({ iss: 'https://evil.example.com' }))],
      ['azp ajeno', () => fx.sign(idClaims({ azp: 'ajeno.apps.googleusercontent.com' }))],
      ['email_verified false', () => fx.sign(idClaims({ email_verified: false }))],
      ['sin firma', async () => fx.unsigned(idClaims())],
      ['HS256', () => fx.signHs256(idClaims())],
      ['otra clave', () => fx.signWithOtherKey(idClaims())],
      [
        'manipulado',
        async () => {
          const [h, p, s] = (await fx.sign(idClaims())).split('.');
          const payload = JSON.parse(atob(p!.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;
          payload.sub = SUB_B;
          return `${h}.${btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.${s}`;
        },
      ],
    ];

    it.each(cases)('%s', async (_name, make) => {
      const a = await makeUser(SUB_A, 'a@example.com');
      await makeUser(SUB_B, 'b@example.com');
      await seed(a.id);
      const before = await counts();
      const res = await del(a.token, { confirm: 'ELIMINAR', idToken: await make() });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual(REAUTH);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await counts()).toEqual(before);
    });

    it('iat de hace 299 s y de hace 300 s se aceptan', async () => {
      for (const age of [299, 300]) {
        const a = await makeUser(`${SUB_A}-${age}`, `a${age}@example.com`);
        const res = await del(
          a.token,
          await validBody({ sub: `${SUB_A}-${age}`, iat: nowSec - age }),
        );
        expect(res.status).toBe(204);
      }
    });
  });

  describe('400 y 413', () => {
    it.each([
      ['confirm erróneo', async () => ({ ...(await validBody()), confirm: 'eliminar' })],
      ['campo extra', async () => ({ ...(await validBody()), extra: 1 })],
      ['userId en el cuerpo', async () => ({ ...(await validBody()), userId: uuid() })],
      ['email en el cuerpo', async () => ({ ...(await validBody()), email: 'x@example.com' })],
      ['idToken ausente', async () => ({ confirm: 'ELIMINAR' })],
      ['idToken vacío', async () => ({ confirm: 'ELIMINAR', idToken: '' })],
    ])('400 con %s, sin borrar y sin llamar a Google', async (_n, make) => {
      const a = await makeUser(SUB_A, 'a@example.com');
      await seed(a.id);
      const before = await counts();
      const res = await del(a.token, await make());
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'INVALID_REQUEST',
      );
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await counts()).toEqual(before);
    });

    it('400 con JSON inválido y sin cuerpo', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      const bad = await del(a.token, '{no-json', true);
      const none = await del(a.token);
      for (const r of [bad, none]) {
        expect(r.status).toBe(400);
        expect(((await r.json()) as { error: { code: string } }).error.code).toBe(
          'INVALID_REQUEST',
        );
      }
      expect((await counts()).users).toBe(1);
    });

    it('413 con cuerpo mayor de 16 KiB', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      const res = await del(
        a.token,
        JSON.stringify({ confirm: 'ELIMINAR', idToken: 'x'.repeat(17000) }),
        true,
      );
      expect(res.status).toBe(413);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'PAYLOAD_TOO_LARGE',
      );
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect((await counts()).users).toBe(1);
    });
  });

  describe('configuración', () => {
    it.each([
      ['sin DB', { ...AUTH_ENV }],
      ['sin JWT_SECRET', { ...AUTH_ENV, JWT_SECRET: undefined }],
      ['sin cliente Web', { ...AUTH_ENV, GOOGLE_WEB_CLIENT_ID: '' }],
    ])('500 CONFIG_ERROR %s', async (name, base) => {
      const a = await makeUser(SUB_A, 'a@example.com');
      const e = name === 'sin DB' ? base : { ...base, DB: db };
      const res = await del(a.token, await validBody(), false, e);
      expect(res.status).toBe(500);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CONFIG_ERROR');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect((await counts()).users).toBe(1);
    });
  });

  describe('atomicidad y registros', () => {
    it('un trigger que aborta BEFORE DELETE ON users: 500, no-store y las 5 tablas intactas', async () => {
      const a = await makeUser(SUB_A, 'a@example.com');
      await seed(a.id);
      const before = await counts();
      await db
        .prepare(
          `CREATE TRIGGER fail_user_delete BEFORE DELETE ON users
           BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`,
        )
        .run();
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const body = await validBody();
      const res = await del(a.token, body);
      expect(res.status).toBe(500);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await counts()).toEqual(before);
      const logs = JSON.stringify(spy.mock.calls);
      expect(logs).not.toContain(body.idToken);
      expect(logs).not.toContain(body.idToken.split('.')[1]);
    });

    it('el idToken no aparece en ningún log (éxito y rechazo)', async () => {
      const spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => {}),
      );
      const a = await makeUser(SUB_A, 'a@example.com');
      const bad = await validBody({ iat: nowSec - 400 });
      const good = await validBody();
      await del(a.token, bad);
      await del(a.token, good);
      const logs = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      for (const t of [bad.idToken, good.idToken]) expect(logs).not.toContain(t.split('.')[1]);
    });
  });

  it('relogin con el mismo sub crea un usuario nuevo vacío y POST /accounts crea 13 categorías', async () => {
    const a = await makeUser(SUB_A, 'a@example.com');
    await seed(a.id);
    expect((await del(a.token, await validBody())).status).toBe(204);

    const idToken = await fx.sign(idClaims());
    const login = await app.request(
      '/auth/google',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      env(),
    );
    expect(login.status).toBe(200);
    const session = (await login.json()) as { accessToken: string; user: { id: string } };
    expect(session.user.id).not.toBe(a.id);
    expect(await count(db, 'accounts')).toBe(0);
    const bearer = { Authorization: `Bearer ${session.accessToken}` };
    const list = await app.request('/accounts', { headers: bearer }, env());
    expect(((await list.json()) as { total: number }).total).toBe(0);

    const created = await app.request(
      '/accounts',
      {
        method: 'POST',
        headers: { ...bearer, 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Nueva' }),
      },
      env(),
    );
    expect(created.status).toBe(201);
    expect(await count(db, 'categories')).toBe(13);
  });
});
