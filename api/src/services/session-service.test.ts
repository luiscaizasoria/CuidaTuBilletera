import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { AUTH_ENV, JWT_SECRET, NOW } from '../../test/helpers';
import { issueSession, verifySession } from './session-service';

const identity = { sub: 'sub-1', email: 'a@example.com', name: 'Ana' };

describe('sesión propia', () => {
  it('emite un JWT de 15 minutos que se verifica', async () => {
    const session = await issueSession(identity, AUTH_ENV, NOW);
    expect(session.expiresIn).toBe(900);
    expect(session.user).toEqual({ id: 'sub-1', email: 'a@example.com', name: 'Ana' });
    expect(await verifySession(session.accessToken, AUTH_ENV, NOW)).toEqual(session.user);
  });

  it('el JWT contiene solo los claims mínimos acordados', async () => {
    const { accessToken } = await issueSession(identity, AUTH_ENV, NOW);
    const payload = JSON.parse(
      atob(accessToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
    );
    expect(Object.keys(payload).sort()).toEqual(
      ['aud', 'email', 'exp', 'iat', 'iss', 'name', 'sub'].sort(),
    );
    expect(payload.exp - payload.iat).toBe(900);
  });

  it('rechaza un JWT expirado', async () => {
    const { accessToken } = await issueSession(identity, AUTH_ENV, NOW);
    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    await expect(verifySession(accessToken, AUTH_ENV, later)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it('rechaza un JWT firmado con otra clave', async () => {
    const { accessToken } = await issueSession(identity, AUTH_ENV, NOW);
    const env = { ...AUTH_ENV, JWT_SECRET: 'otra-clave-distinta-con-mas-de-32-caracteres-yy' };
    await expect(verifySession(accessToken, env, NOW)).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza un JWT con audiencia o emisor ajenos', async () => {
    const forged = await new SignJWT({ email: 'a@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('web-client.apps.googleusercontent.com')
      .setSubject('sub-1')
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 600)
      .sign(new TextEncoder().encode(JWT_SECRET));
    await expect(verifySession(forged, AUTH_ENV, NOW)).rejects.toMatchObject({ status: 401 });
  });

  it('no emite ni verifica sin JWT_SECRET válido', async () => {
    for (const JWT_SECRET of [undefined, '', 'corto']) {
      const env = { ...AUTH_ENV, JWT_SECRET };
      await expect(issueSession(identity, env, NOW)).rejects.toMatchObject({
        status: 500,
        code: 'CONFIG_ERROR',
      });
      await expect(verifySession('x.y.z', env, NOW)).rejects.toMatchObject({
        code: 'CONFIG_ERROR',
      });
    }
  });
});
