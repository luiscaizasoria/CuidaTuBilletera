import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JWT_SECRET } from '../../test/helpers';
import { SESSION_AUDIENCE, SESSION_ISSUER } from '../lib/auth-config';
import { issueSession } from './session-service';
import {
  ACCESS_TOKEN_AUDIENCE_V2,
  issueAccessToken,
  verifyAccessToken,
} from './access-token-service';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const USER = { id: '0b8f2c9e-6f3a-4b1d-9a57-2f4e8c1d7a10', email: 'a@example.com', name: 'Ana' };
const key = new TextEncoder().encode(JWT_SECRET);
const iat = Math.floor(NOW.getTime() / 1000);

const payloadOf = (token: string) =>
  JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));

function custom(alg = 'HS256', sub: string = USER.id, signKey: Uint8Array = key) {
  return new SignJWT({ email: USER.email })
    .setProtectedHeader({ alg })
    .setIssuer(SESSION_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE_V2)
    .setSubject(sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 900)
    .sign(signKey);
}

describe('JWT v2', () => {
  it('emite y verifica un token válido con sus claims', async () => {
    const token = await issueAccessToken(USER, JWT_SECRET, NOW);
    const payload = payloadOf(token);
    expect(payload).toMatchObject({
      sub: USER.id,
      iss: SESSION_ISSUER,
      aud: ACCESS_TOKEN_AUDIENCE_V2,
      email: USER.email,
      name: USER.name,
    });
    expect(payload.exp - payload.iat).toBe(900);
    expect(ACCESS_TOKEN_AUDIENCE_V2).not.toBe(SESSION_AUDIENCE);
    expect(await verifyAccessToken(token, JWT_SECRET, NOW)).toEqual({
      status: 'valid',
      user: USER,
    });
  });

  it('rechaza un JWT v1', async () => {
    const v1 = await issueSession({ sub: USER.id, email: USER.email }, { JWT_SECRET }, NOW);
    expect(await verifyAccessToken(v1.accessToken, JWT_SECRET, NOW)).toEqual({ status: 'invalid' });
  });

  it('rechaza algoritmo distinto', async () => {
    expect(await verifyAccessToken(await custom('HS384'), JWT_SECRET, NOW)).toEqual({
      status: 'invalid',
    });
  });

  it('rechaza firma inválida', async () => {
    const other = new TextEncoder().encode('x'.repeat(40));
    expect(await verifyAccessToken(await custom('HS256', USER.id, other), JWT_SECRET, NOW)).toEqual(
      {
        status: 'invalid',
      },
    );
  });

  it('rechaza audiencia o emisor incorrectos', async () => {
    const badAud = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience('otra')
      .setSubject(USER.id)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 900)
      .sign(key);
    const badIss = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('otro')
      .setAudience(ACCESS_TOKEN_AUDIENCE_V2)
      .setSubject(USER.id)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 900)
      .sign(key);
    expect((await verifyAccessToken(badAud, JWT_SECRET, NOW)).status).toBe('invalid');
    expect((await verifyAccessToken(badIss, JWT_SECRET, NOW)).status).toBe('invalid');
  });

  it('rechaza sub que no es UUID', async () => {
    expect((await verifyAccessToken(await custom('HS256', 'sub-1'), JWT_SECRET, NOW)).status).toBe(
      'invalid',
    );
  });

  it('rechaza exp ausente', async () => {
    const token = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE_V2)
      .setSubject(USER.id)
      .setIssuedAt(iat)
      .sign(key);
    expect((await verifyAccessToken(token, JWT_SECRET, NOW)).status).toBe('invalid');
  });

  it('rechaza iat ausente', async () => {
    const token = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE_V2)
      .setSubject(USER.id)
      .setExpirationTime(iat + 900)
      .sign(key);
    expect((await verifyAccessToken(token, JWT_SECRET, NOW)).status).toBe('invalid');
  });

  it('rechaza un token expirado con el reloj inyectado', async () => {
    const token = await issueAccessToken(USER, JWT_SECRET, NOW);
    const later = new Date(NOW.getTime() + 15 * 60 * 1000 + 1000);
    expect((await verifyAccessToken(token, JWT_SECRET, later)).status).toBe('invalid');
  });
});
