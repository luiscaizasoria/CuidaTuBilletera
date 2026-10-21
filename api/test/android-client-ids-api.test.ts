import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { issueAccessToken } from '../src/services/access-token-service';
import { DB_HOOK_TIMEOUT_MS, freshDb, insertUser } from './d1-helpers';
import { createGoogleFixture, JWT_SECRET, NOW, WEB_CLIENT_ID } from './helpers';

const A1 = '1-a.apps.googleusercontent.com';
const A2 = '2-b.apps.googleusercontent.com';
const FOREIGN = '9-zzz.apps.googleusercontent.com';

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

const envWith = (vars: Record<string, string | undefined>) => ({
  GOOGLE_WEB_CLIENT_ID: WEB_CLIENT_ID,
  JWT_SECRET,
  DB: db,
  ...vars,
});

const jsonPost = (path: string, method: string, body: unknown, env: object, token?: string) =>
  app.request(
    path,
    {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env,
  );

const code = async (res: Response) =>
  ((await res.json()) as { error: { code: string } }).error.code;

async function loginWith(azp: unknown, vars: Record<string, string | undefined>) {
  const claims = { ...fx.validClaims(), ...(azp === undefined ? {} : { azp }) };
  if (azp === undefined) delete (claims as Record<string, unknown>).azp;
  return jsonPost('/auth/google', 'POST', { idToken: await fx.sign(claims) }, envWith(vars));
}

async function deleteWith(azp: unknown, vars: Record<string, string | undefined>) {
  const id = await insertUser(db, { google_sub: '1234567890', email: 'usuario@example.com' });
  const token = await issueAccessToken({ id, email: 'usuario@example.com' }, JWT_SECRET, NOW);
  const claims: Record<string, unknown> = { ...fx.validClaims() };
  if (azp === undefined) delete claims.azp;
  else claims.azp = azp;
  return jsonPost(
    '/me',
    'DELETE',
    { confirm: 'ELIMINAR', idToken: await fx.sign(claims as never) },
    envWith(vars),
    token,
  );
}

const LIST = { GOOGLE_ANDROID_CLIENT_IDS: `${A1}, ${A2}` };

describe('GOOGLE_ANDROID_CLIENT_IDS en POST /auth/google', () => {
  it.each([A1, A2, WEB_CLIENT_ID, undefined])('acepta azp %s', async (azp) => {
    expect((await loginWith(azp, LIST)).status).toBe(200);
  });

  it.each([FOREIGN, 123])('rechaza azp %s con 401 INVALID_TOKEN', async (azp) => {
    const res = await loginWith(azp, LIST);
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('INVALID_TOKEN');
  });

  it('aud ajeno se rechaza aunque azp esté en la lista', async () => {
    const idToken = await fx.sign({ ...fx.validClaims(), aud: A1, azp: A1 });
    const res = await jsonPost('/auth/google', 'POST', { idToken }, envWith(LIST));
    expect(res.status).toBe(401);
  });

  it('sin variables la política azp está desactivada', async () => {
    expect((await loginWith(FOREIGN, {})).status).toBe(200);
    expect(
      (await loginWith(FOREIGN, { GOOGLE_ANDROID_CLIENT_IDS: '  ', GOOGLE_ANDROID_CLIENT_ID: '' }))
        .status,
    ).toBe(200);
  });

  it('DEV heredado: GOOGLE_ANDROID_CLIENT_ID sigue aplicando la política', async () => {
    const legacy = { GOOGLE_ANDROID_CLIENT_ID: 'android-client.apps.googleusercontent.com' };
    expect((await loginWith('android-client.apps.googleusercontent.com', legacy)).status).toBe(200);
    expect((await loginWith(FOREIGN, legacy)).status).toBe(401);
  });

  it.each([
    ['lista inválida', { GOOGLE_ANDROID_CLIENT_IDS: 'a,,b' }],
    ['cliente Web en la lista', { GOOGLE_ANDROID_CLIENT_IDS: `${A1},${WEB_CLIENT_ID}` }],
    ['ambas variables', { GOOGLE_ANDROID_CLIENT_IDS: A1, GOOGLE_ANDROID_CLIENT_ID: A2 }],
  ])('500 CONFIG_ERROR con %s, antes de leer el cuerpo', async (_n, vars) => {
    // Cuerpo que de otro modo daría 400: la configuración se valida primero.
    const res = await jsonPost('/auth/google', 'POST', 'no es json', envWith(vars));
    expect(res.status).toBe(500);
    expect(await code(res)).toBe('CONFIG_ERROR');
  });
});

describe('GOOGLE_ANDROID_CLIENT_IDS en DELETE /me', () => {
  it.each([A1, A2, WEB_CLIENT_ID, undefined])('acepta azp %s', async (azp) => {
    expect((await deleteWith(azp, LIST)).status).toBe(204);
  });

  it.each([FOREIGN, 123])('rechaza azp %s con 401 REAUTH_REQUIRED', async (azp) => {
    const res = await deleteWith(azp, LIST);
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('REAUTH_REQUIRED');
  });

  it('sin variables la política azp está desactivada', async () => {
    expect((await deleteWith(FOREIGN, {})).status).toBe(204);
  });

  it('DEV heredado intacto', async () => {
    const legacy = { GOOGLE_ANDROID_CLIENT_ID: A1 };
    expect((await deleteWith(FOREIGN, legacy)).status).toBe(401);
  });

  it.each([
    ['lista inválida', { GOOGLE_ANDROID_CLIENT_IDS: 'x' }],
    ['ambas variables', { GOOGLE_ANDROID_CLIENT_IDS: A1, GOOGLE_ANDROID_CLIENT_ID: A2 }],
  ])('500 CONFIG_ERROR con %s, antes de autenticar y leer el cuerpo', async (_n, vars) => {
    const res = await jsonPost('/me', 'DELETE', 'no es json', envWith(vars));
    expect(res.status).toBe(500);
    expect(await code(res)).toBe('CONFIG_ERROR');
  });
});
