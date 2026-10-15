import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { issueAccessToken } from '../src/services/access-token-service';
import { hashRefreshToken } from '../src/services/refresh-token';
import { issueSession } from '../src/services/session-service';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  iso,
  plusDays,
  plusMs,
  readInvariants,
  uuid,
} from './d1-helpers';
import { AUTH_ENV, createGoogleFixture, JWT_SECRET, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let db: D1Database;
let clock: Date;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  fx = await createGoogleFixture();
});
beforeEach(async () => {
  db = await freshDb();
  clock = NOW;
  app = createApp({ googleKeys: fx.keys, now: () => clock });
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

const envWith = (database: unknown = db) => ({ ...AUTH_ENV, DB: database });

function post(path: string, body: unknown, env: object = envWith(), raw = false) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw ? (body as string) : JSON.stringify(body),
    },
    env,
  );
}

const login = (body: unknown, env?: object, raw = false) => post('/auth/google', body, env, raw);
const refresh = (refreshToken: unknown, env?: object) =>
  post('/auth/refresh', { refreshToken }, env);
const logout = (refreshToken: unknown, env?: object) => post('/auth/logout', { refreshToken }, env);
const me = (token?: string, env: object = envWith()) =>
  app.request('/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {}, env);

interface LoginBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
  user: { id: string; email: string; name?: string };
}
interface RefreshBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
}

async function doLogin(claims: Record<string, unknown> = {}): Promise<LoginBody> {
  const idToken = await fx.sign({ ...fx.validClaims(), ...claims });
  const response = await login({ idToken });
  expect(response.status).toBe(200);
  return (await response.json()) as LoginBody;
}

const userClaims = (n: string) => ({
  sub: `google-${n}`,
  email: `${n}@example.com`,
  name: `Usuario ${n}`,
});

const CODE = (code: string) => ({ error: { code, message: expect.any(String) } });

// Base que delega en la real pero registra cada acceso y puede fallar a demanda.
function spyDb(failOn?: { method: 'batch' | 'prepare'; nth: number; message: string }) {
  const calls: string[] = [];
  const seen: Record<string, number> = {};
  const proxy = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof prop !== 'string' || typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(prop);
        seen[prop] = (seen[prop] ?? 0) + 1;
        if (failOn?.method === prop && seen[prop] === failOn.nth) {
          if (prop === 'prepare') throw new Error(failOn.message);
          return Promise.reject(new Error(failOn.message));
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { db: proxy, calls };
}

function captureLogs() {
  const spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
  return () => JSON.stringify(spies.flatMap((s) => s.mock.calls));
}

describe('POST /auth/google', () => {
  it('con un ID token válido devuelve sesión v2 con la estructura que consume Android', async () => {
    const idToken = await fx.sign(fx.validClaims());
    const response = await login({ idToken });
    expect(response.status).toBe(200);
    const body = (await response.json()) as LoginBody;
    expect(Object.keys(body).sort()).toEqual(
      ['accessToken', 'expiresIn', 'refreshExpiresAt', 'refreshToken', 'tokenType', 'user'].sort(),
    );
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(900);
    expect(body.accessToken).not.toBe(idToken);
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.refreshExpiresAt).toBe(iso(plusDays(NOW, 7)));
    expect(body.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'usuario@example.com',
      name: 'Usuario Prueba',
    });
    // user.id es el UUID interno, no el sub de Google.
    expect(body.user.id).not.toBe('1234567890');
    const row = await db
      .prepare('SELECT expires_at FROM refresh_tokens WHERE token_hash = ?1')
      .bind(await hashRefreshToken(body.refreshToken))
      .first<{ expires_at: string }>();
    expect(row?.expires_at).toBe(body.refreshExpiresAt);
  });

  it('la sesión emitida sirve en GET /me', async () => {
    const body = await doLogin();
    const profile = await me(body.accessToken);
    expect(profile.status).toBe(200);
    expect(await profile.json()).toEqual({ user: body.user });
  });

  it('crea el usuario en el primer login y lo actualiza en el segundo conservando el id', async () => {
    const first = await doLogin();
    expect(await count(db, 'users')).toBe(1);
    const second = await doLogin({ email: 'nuevo@example.com', name: 'Nombre Nuevo' });
    expect(second.user).toEqual({
      id: first.user.id,
      email: 'nuevo@example.com',
      name: 'Nombre Nuevo',
    });
    expect(await count(db, 'users')).toBe(1);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(2);
    const profile = await me(second.accessToken);
    expect(await profile.json()).toEqual({ user: second.user });
  });

  it('sin la claim name: guarda NULL, omite user.name y /me coincide; un segundo login con name no rompe', async () => {
    const claims = fx.validClaims();
    delete claims.name;
    const idToken = await fx.sign(claims);
    const response = await login({ idToken });
    expect(response.status).toBe(200);
    const first = (await response.json()) as LoginBody;
    expect(Object.keys(first).sort()).toEqual(
      ['accessToken', 'expiresIn', 'refreshExpiresAt', 'refreshToken', 'tokenType', 'user'].sort(),
    );
    expect(first.user).toEqual({ id: first.user.id, email: 'usuario@example.com' });
    expect('name' in first.user).toBe(false);
    expect(await count(db, 'users', 'nombre IS NULL')).toBe(1);
    expect(await (await me(first.accessToken)).json()).toEqual({ user: first.user });

    const second = await doLogin({ name: 'Con Nombre' });
    expect(second.user).toEqual({
      id: first.user.id,
      email: 'usuario@example.com',
      name: 'Con Nombre',
    });
    expect(await count(db, 'users')).toBe(1);
    expect(await (await me(second.accessToken)).json()).toEqual({ user: second.user });
  });

  it('un login sin la claim name tras uno con name conserva el nombre en BD, en la respuesta y en /me', async () => {
    const first = await doLogin({ name: 'Nombre Guardado' });
    const claims = fx.validClaims();
    delete claims.name;
    const response = await login({ idToken: await fx.sign(claims) });
    expect(response.status).toBe(200);
    const second = (await response.json()) as LoginBody;
    expect(second.user).toEqual({
      id: first.user.id,
      email: 'usuario@example.com',
      name: 'Nombre Guardado',
    });
    expect(await count(db, 'users', "nombre = 'Nombre Guardado'")).toBe(1);
    expect(await count(db, 'users')).toBe(1);
    expect(await (await me(second.accessToken)).json()).toEqual({ user: second.user });
  });

  it('con un ID token inválido responde 401 INVALID_TOKEN y no crea nada', async () => {
    const response = await login({ idToken: await fx.signWithOtherKey(fx.validClaims()) });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_TOKEN', message: 'Token de autenticación inválido' },
    });
    expect(await count(db, 'users')).toBe(0);
    expect(await count(db, 'refresh_tokens')).toBe(0);
  });

  it('ignora campos extra en el cuerpo', async () => {
    const idToken = await fx.sign(fx.validClaims());
    expect((await login({ idToken, extra: 1 })).status).toBe(200);
  });

  it.each([
    ['body vacío', ''],
    ['JSON inválido', '{no-json'],
    ['sin idToken', '{}'],
    ['idToken no texto', '{"idToken":123}'],
    ['idToken vacío', '{"idToken":""}'],
  ])('responde 400 con %s', async (_name, body) => {
    const response = await login(body, undefined, true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(CODE('INVALID_REQUEST'));
  });

  it.each([
    ['sin JWT_SECRET', { ...AUTH_ENV, JWT_SECRET: undefined }],
    ['con JWT_SECRET corto', { ...AUTH_ENV, JWT_SECRET: 'corto' }],
    ['sin GOOGLE_WEB_CLIENT_ID', { ...AUTH_ENV, GOOGLE_WEB_CLIENT_ID: undefined }],
    ['con entorno vacío', {}],
  ])('no emite sesión %s', async (_name, partial) => {
    captureLogs();
    const response = await login(
      { idToken: await fx.sign(fx.validClaims()) },
      { ...partial, DB: db },
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(CODE('CONFIG_ERROR'));
    expect(await count(db, 'users')).toBe(0);
  });

  it('no filtra el ID token en la respuesta ni en los logs', async () => {
    const logs = captureLogs();
    const idToken = await fx.signWithOtherKey(fx.validClaims());
    const response = await login({ idToken });
    expect(await response.text()).not.toContain(idToken);
    expect(logs()).not.toContain(idToken);
  });
});

describe('fallos de D1 en el login', () => {
  const failures = [
    ['el upsert del usuario', 1],
    ['la creación de la familia', 2],
  ] as const;

  it.each(failures)('responde 500 sin credenciales si falla %s', async (_name, nth) => {
    const logs = captureLogs();
    const idToken = await fx.sign(fx.validClaims());
    const secretDetail = `D1_ERROR token=${idToken} SQL=INSERT INTO refresh_tokens`;
    const failing = spyDb({ method: 'batch', nth, message: secretDetail });
    const response = await login({ idToken }, envWith(failing.db));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual(CODE('INTERNAL_ERROR'));
    expect(text).not.toMatch(/accessToken|refreshToken|D1_ERROR|INSERT/);
    const logged = logs();
    expect(logged).not.toContain(idToken);
    expect(logged).not.toContain('INSERT INTO');
    expect(response.headers.get('cache-control')).toBe('no-store');
    // Sin sucesión parcial: ningún refresh token activo.
    expect(await count(db, 'refresh_tokens')).toBe(0);
  });
});

describe('POST /auth/refresh', () => {
  it('rota el token y devuelve un nuevo access token y refresh token', async () => {
    const first = await doLogin();
    clock = plusDays(NOW, 1);
    const response = await refresh(first.refreshToken);
    expect(response.status).toBe(200);
    const body = (await response.json()) as RefreshBody;
    expect(Object.keys(body).sort()).toEqual(
      ['accessToken', 'expiresIn', 'refreshExpiresAt', 'refreshToken', 'tokenType'].sort(),
    );
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(900);
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.refreshToken).not.toBe(first.refreshToken);
    expect(body.refreshExpiresAt).toBe(iso(plusDays(clock, 7)));
    const row = await db
      .prepare('SELECT expires_at FROM refresh_tokens WHERE token_hash = ?1')
      .bind(await hashRefreshToken(body.refreshToken))
      .first<{ expires_at: string }>();
    expect(row?.expires_at).toBe(body.refreshExpiresAt);
    expect((await me(body.accessToken)).status).toBe(200);
    expect(await readInvariants(db)).toEqual({
      familiesWithManyActive: 0,
      rotatedWithoutSuccessor: 0,
      successorsOfOtherFamily: 0,
    });
  });

  it('ignora campos extra', async () => {
    const first = await doLogin();
    const response = await post('/auth/refresh', { refreshToken: first.refreshToken, otro: true });
    expect(response.status).toBe(200);
  });

  it('el token rotado dentro de la gracia (29 999 ms) responde 409 sin credenciales ni revocar', async () => {
    const first = await doLogin();
    clock = plusMs(NOW, 1000);
    const second = (await (await refresh(first.refreshToken)).json()) as RefreshBody;
    clock = plusMs(NOW, 1000 + 29_999);
    const response = await refresh(first.refreshToken);
    const text = await response.text();
    expect(response.status).toBe(409);
    expect(JSON.parse(text)).toEqual(CODE('REFRESH_CONFLICT'));
    expect(text).not.toMatch(/accessToken|refreshToken/);
    // El sucesor sigue activo: no se revocó la familia.
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(1);
    expect((await refresh(second.refreshToken)).status).toBe(200);
  });

  it('el token rotado a partir de 30 000 ms responde 401 y revoca la familia', async () => {
    const first = await doLogin();
    clock = plusMs(NOW, 1000);
    const second = (await (await refresh(first.refreshToken)).json()) as RefreshBody;
    clock = plusMs(NOW, 1000 + 30_000);
    const response = await refresh(first.refreshToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(CODE('INVALID_REFRESH_TOKEN'));
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(0);
    expect((await refresh(second.refreshToken)).status).toBe(401);
  });

  it('token inexistente, vencido, revocado y reutilizado responden 401 idéntico', async () => {
    const bodies: string[] = [];
    const record = async (response: Response) => {
      expect(response.status).toBe(401);
      bodies.push(await response.text());
    };
    await record(await refresh('A'.repeat(43)));

    const expired = await doLogin();
    clock = plusMs(plusDays(NOW, 7), 1000);
    await record(await refresh(expired.refreshToken));

    clock = NOW;
    const loggedOut = await doLogin();
    await logout(loggedOut.refreshToken);
    await record(await refresh(loggedOut.refreshToken));

    const reused = await doLogin();
    await refresh(reused.refreshToken);
    clock = plusMs(NOW, 60_000);
    await record(await refresh(reused.refreshToken));

    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual(CODE('INVALID_REFRESH_TOKEN'));
  });

  it.each([
    ['body vacío', ''],
    ['JSON inválido', '{no-json'],
    ['sin refreshToken', '{}'],
    ['no texto', '{"refreshToken":123}'],
    ['demasiado corto', `{"refreshToken":"${'a'.repeat(42)}"}`],
    ['demasiado largo', `{"refreshToken":"${'a'.repeat(44)}"}`],
    ['caracteres fuera de base64url', `{"refreshToken":"${'+'.repeat(43)}"}`],
  ])('responde 400 sin tocar D1 con %s', async (_name, body) => {
    const spied = spyDb();
    const response = await post('/auth/refresh', body, envWith(spied.db), true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(CODE('INVALID_REQUEST'));
    expect(spied.calls).toEqual([]);
  });

  it('refrescos concurrentes: uno gana y el resto recibe 409', async () => {
    const first = await doLogin();
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => refresh(first.refreshToken)),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409]);
    for (const response of responses.filter((r) => r.status === 409)) {
      expect(await response.text()).not.toMatch(/accessToken|refreshToken/);
    }
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(1);
    expect(await readInvariants(db)).toEqual({
      familiesWithManyActive: 0,
      rotatedWithoutSuccessor: 0,
      successorsOfOtherFamily: 0,
    });
  });

  it('un fallo de D1 responde 500 sin credenciales ni detalles', async () => {
    const first = await doLogin();
    const logs = captureLogs();
    const failing = spyDb({
      method: 'prepare',
      nth: 1,
      message: `D1_ERROR ${first.refreshToken} ${await hashRefreshToken(first.refreshToken)}`,
    });
    const response = await refresh(first.refreshToken, envWith(failing.db));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual(CODE('INTERNAL_ERROR'));
    expect(text).not.toContain(first.refreshToken);
    const logged = logs();
    expect(logged).not.toContain(first.refreshToken);
    expect(logged).not.toContain(await hashRefreshToken(first.refreshToken));
  });

  it('no registra tokens ni hashes en los flujos normales', async () => {
    const logs = captureLogs();
    const first = await doLogin();
    const second = (await (await refresh(first.refreshToken)).json()) as RefreshBody;
    await refresh(first.refreshToken);
    await logout(second.refreshToken);
    const logged = logs();
    for (const secret of [first.refreshToken, second.refreshToken, first.accessToken]) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).not.toContain(await hashRefreshToken(first.refreshToken));
  });
});

describe('POST /auth/logout', () => {
  it('responde 204 sin cuerpo y revoca la sesión', async () => {
    const session = await doLogin();
    const response = await logout(session.refreshToken);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect((await refresh(session.refreshToken)).status).toBe(401);
  });

  it('es idempotente: repetido y con un token desconocido responde igual', async () => {
    const session = await doLogin();
    const outcomes = [
      await logout(session.refreshToken),
      await logout(session.refreshToken),
      await logout('Z'.repeat(43)),
    ];
    for (const response of outcomes) {
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('revoca solo su familia', async () => {
    const one = await doLogin();
    const two = await doLogin();
    await logout(one.refreshToken);
    expect((await refresh(one.refreshToken)).status).toBe(401);
    expect((await refresh(two.refreshToken)).status).toBe(200);
  });

  it.each([
    ['body vacío', ''],
    ['JSON inválido', '{no-json'],
    ['sin refreshToken', '{}'],
    ['formato inválido', '{"refreshToken":"corto"}'],
  ])('responde 400 sin tocar D1 con %s', async (_name, body) => {
    const spied = spyDb();
    const response = await post('/auth/logout', body, envWith(spied.db), true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(CODE('INVALID_REQUEST'));
    expect(spied.calls).toEqual([]);
  });
});

describe('aislamiento entre usuarios', () => {
  it('el logout y el refresh de un usuario no afectan al otro', async () => {
    const a = await doLogin(userClaims('a'));
    const b = await doLogin(userClaims('b'));
    expect(a.user.id).not.toBe(b.user.id);
    expect(await count(db, 'users')).toBe(2);

    await logout(a.refreshToken);
    expect((await refresh(a.refreshToken)).status).toBe(401);
    const bRefreshed = await refresh(b.refreshToken);
    expect(bRefreshed.status).toBe(200);

    expect(await (await me(a.accessToken)).json()).toEqual({ user: a.user });
    expect(await (await me(b.accessToken)).json()).toEqual({ user: b.user });
  });
});

describe('GET /me', () => {
  it('responde 401 UNAUTHORIZED sin Authorization', async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(CODE('UNAUTHORIZED'));
  });

  it('rechaza un ID token de Google como sesión', async () => {
    const response = await me(await fx.sign(fx.validClaims()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(CODE('INVALID_TOKEN'));
  });

  it('rechaza un JWT v1 (sub de Google) con INVALID_TOKEN', async () => {
    const v1 = await issueSession(
      { sub: '1234567890', email: 'usuario@example.com', name: 'Usuario Prueba' },
      AUTH_ENV,
      NOW,
    );
    const response = await me(v1.accessToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(CODE('INVALID_TOKEN'));
  });

  it('rechaza un JWT v1 aunque su sub sea el UUID de un usuario existente', async () => {
    const session = await doLogin();
    const v1 = await issueSession(
      { sub: session.user.id, email: session.user.email },
      AUTH_ENV,
      NOW,
    );
    expect((await me(v1.accessToken)).status).toBe(401);
  });

  it('rechaza un JWT manipulado y uno expirado', async () => {
    const session = await doLogin();
    const [h, p, s] = session.accessToken.split('.');
    expect((await me(`${h}.${p}.${s!.slice(0, -2)}xx`)).status).toBe(401);
    clock = plusMs(NOW, 16 * 60 * 1000);
    expect((await me(session.accessToken)).status).toBe(401);
  });

  it('con un usuario inexistente responde 401 INVALID_TOKEN', async () => {
    const token = await issueAccessToken({ id: uuid(), email: 'x@example.com' }, JWT_SECRET, NOW);
    const response = await me(token);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(CODE('INVALID_TOKEN'));
  });

  it('responde desde la fila de D1 y no desde los claims', async () => {
    const session = await doLogin();
    await db
      .prepare('UPDATE users SET email = ?1, nombre = ?2 WHERE id = ?3')
      .bind('fila@example.com', 'Nombre Fila', session.user.id)
      .run();
    expect(await (await me(session.accessToken)).json()).toEqual({
      user: { id: session.user.id, email: 'fila@example.com', name: 'Nombre Fila' },
    });
    await db.prepare('UPDATE users SET nombre = NULL WHERE id = ?1').bind(session.user.id).run();
    const body = (await (await me(session.accessToken)).json()) as { user: object };
    expect(body.user).toEqual({ id: session.user.id, email: 'fila@example.com' });
    expect('name' in body.user).toBe(false);
  });
});

describe('sin binding DB', () => {
  const noDb = { ...AUTH_ENV };

  it('las cuatro rutas responden 500 CONFIG_ERROR antes de procesar nada', async () => {
    captureLogs();
    const idToken = await fx.sign(fx.validClaims());
    const token = 'a'.repeat(43);
    const session = await issueAccessToken({ id: uuid(), email: 'x@example.com' }, JWT_SECRET, NOW);
    const responses = [
      await login({ idToken }, noDb),
      await refresh(token, noDb),
      await logout(token, noDb),
      await me(session, noDb),
      // Incluso con cuerpo inválido o sin Authorization: la configuración se valida primero.
      await post('/auth/refresh', '{no-json', noDb, true),
      await me(undefined, noDb),
    ];
    for (const response of responses) {
      const text = await response.text();
      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual(CODE('CONFIG_ERROR'));
      expect(text).not.toMatch(/accessToken|refreshToken/);
    }
  });
});

describe('Cache-Control', () => {
  it('es no-store en 200, 204, 400, 401, 409 y 500 de /auth/* y /me', async () => {
    captureLogs();
    const session = await doLogin();
    const ok = await refresh(session.refreshToken);
    const conflict = await refresh(session.refreshToken);
    const responses: Record<string, Response> = {
      '200 login': await login({ idToken: await fx.sign(fx.validClaims()) }),
      '200 refresh': ok,
      '200 me': await me(session.accessToken),
      '204 logout': await logout('Q'.repeat(43)),
      '400 login': await login('{}', undefined, true),
      '400 refresh': await refresh('x'),
      '400 logout': await logout('x'),
      '401 login': await login({ idToken: await fx.signWithOtherKey(fx.validClaims()) }),
      '401 refresh': await refresh('B'.repeat(43)),
      '401 me sin bearer': await me(),
      '401 me inválido': await me('x.y.z'),
      '409 refresh': conflict,
      '500 config': await me(session.accessToken, { ...AUTH_ENV }),
      '500 d1': await login(
        { idToken: await fx.sign(fx.validClaims()) },
        envWith(spyDb({ method: 'batch', nth: 1, message: 'x' }).db),
      ),
    };
    expect(conflict.status).toBe(409);
    for (const [name, response] of Object.entries(responses)) {
      expect(response.headers.get('cache-control'), name).toBe('no-store');
    }
  });

  it('no se aplica a /health ni al 404 global', async () => {
    const health = await app.request('/health', {}, envWith());
    const missing = await app.request('/no-existe', {}, envWith());
    expect(health.headers.get('cache-control')).toBeNull();
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBeNull();
  });
});
