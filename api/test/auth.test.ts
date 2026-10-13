import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AUTH_ENV, createGoogleFixture, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  fx = await createGoogleFixture();
  app = createApp({ googleKeys: fx.keys, now: () => NOW });
});
afterEach(() => vi.restoreAllMocks());

function login(body: unknown, env: object = AUTH_ENV, raw = false) {
  return app.request(
    '/auth/google',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw ? (body as string) : JSON.stringify(body),
    },
    env,
  );
}

const me = (token?: string, env: object = AUTH_ENV) =>
  app.request('/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {}, env);

describe('POST /auth/google', () => {
  it('con un ID token válido devuelve una sesión que sirve en GET /me', async () => {
    const idToken = await fx.sign(fx.validClaims());
    const response = await login({ idToken });
    expect(response.status).toBe(200);
    const session = (await response.json()) as { accessToken: string; expiresIn: number };
    expect(session.expiresIn).toBe(900);
    expect(session.accessToken).not.toBe(idToken);

    const profile = await me(session.accessToken);
    expect(profile.status).toBe(200);
    expect(await profile.json()).toEqual({
      user: { id: '1234567890', email: 'usuario@example.com', name: 'Usuario Prueba' },
    });
  });

  it.each([
    ['body vacío', ''],
    ['JSON inválido', '{no-json'],
    ['sin idToken', '{}'],
    ['idToken no texto', '{"idToken":123}'],
    ['idToken vacío', '{"idToken":""}'],
  ])('responde 400 con %s', async (_name, body) => {
    const response = await login(body, AUTH_ENV, true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: expect.any(String) },
    });
  });

  it('responde 401 con el formato acordado ante un token inválido', async () => {
    const response = await login({ idToken: await fx.signWithOtherKey(fx.validClaims()) });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_TOKEN', message: 'Token de autenticación inválido' },
    });
  });

  it('no filtra el token en la respuesta ni en los logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const idToken = await fx.signWithOtherKey(fx.validClaims());
    const response = await login({ idToken });
    expect(await response.text()).not.toContain(idToken);
    const logged = JSON.stringify([...spy.mock.calls, ...log.mock.calls]);
    expect(logged).not.toContain(idToken);
  });

  it.each([
    ['sin JWT_SECRET', { ...AUTH_ENV, JWT_SECRET: undefined }],
    ['con JWT_SECRET corto', { ...AUTH_ENV, JWT_SECRET: 'corto' }],
    ['sin GOOGLE_WEB_CLIENT_ID', { ...AUTH_ENV, GOOGLE_WEB_CLIENT_ID: undefined }],
    ['con entorno vacío', {}],
  ])('no emite sesión %s', async (_name, env) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await login({ idToken: await fx.sign(fx.validClaims()) }, env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'CONFIG_ERROR', message: expect.any(String) },
    });
  });
});

describe('GET /me', () => {
  it('responde 401 sin Authorization', async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
  });

  it('rechaza un ID token de Google como sesión', async () => {
    const response = await me(await fx.sign(fx.validClaims()));
    expect(response.status).toBe(401);
  });

  it('rechaza un JWT manipulado', async () => {
    const login200 = await login({ idToken: await fx.sign(fx.validClaims()) });
    const { accessToken } = (await login200.json()) as { accessToken: string };
    const [h, p, s] = accessToken.split('.');
    const response = await me(`${h}.${p}.${s!.slice(0, -2)}xx`);
    expect(response.status).toBe(401);
  });

  it('rechaza un JWT expirado', async () => {
    const login200 = await login({ idToken: await fx.sign(fx.validClaims()) });
    const { accessToken } = (await login200.json()) as { accessToken: string };
    const later = createApp({
      googleKeys: fx.keys,
      now: () => new Date(NOW.getTime() + 16 * 60 * 1000),
    });
    const response = await later.request(
      '/me',
      { headers: { Authorization: `Bearer ${accessToken}` } },
      AUTH_ENV,
    );
    expect(response.status).toBe(401);
  });

  it('responde 500 CONFIG_ERROR sin JWT_SECRET', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await me('x.y.z', {});
    expect(response.status).toBe(500);
  });
});
