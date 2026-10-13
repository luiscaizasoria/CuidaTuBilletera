import type { JWTPayload } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANDROID_CLIENT_ID, createGoogleFixture, NOW, WEB_CLIENT_ID } from '../../test/helpers';
import { verifyGoogleIdToken, type GoogleAudience } from './google-token-service';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
beforeAll(async () => {
  fx = await createGoogleFixture();
});

function without(claims: JWTPayload, key: string): JWTPayload {
  const copy = { ...claims };
  delete copy[key];
  return copy;
}

const audience = { webClientId: WEB_CLIENT_ID, androidClientId: ANDROID_CLIENT_ID };
const verify = (token: string, aud: GoogleAudience = audience) =>
  verifyGoogleIdToken(token, aud, fx.keys, NOW);
const rejected = (token: string, aud: GoogleAudience = audience) =>
  expect(verify(token, aud)).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });

describe('verifyGoogleIdToken', () => {
  it('acepta un token válido y devuelve la identidad', async () => {
    const identity = await verify(await fx.sign(fx.validClaims()));
    expect(identity).toEqual({
      sub: '1234567890',
      email: 'usuario@example.com',
      name: 'Usuario Prueba',
    });
  });

  it('acepta el emisor sin esquema', async () => {
    await verify(await fx.sign({ ...fx.validClaims(), iss: 'accounts.google.com' }));
  });

  it('acepta un token sin azp', async () => {
    await verify(await fx.sign(without(fx.validClaims(), 'azp')));
  });

  it('acepta azp igual al cliente Web', async () => {
    await verify(await fx.sign({ ...fx.validClaims(), azp: WEB_CLIENT_ID }));
  });

  it('rechaza una firma inválida', async () => {
    await rejected(await fx.signWithOtherKey(fx.validClaims()));
  });

  it('rechaza una audiencia incorrecta', async () => {
    await rejected(await fx.sign({ ...fx.validClaims(), aud: 'otro-cliente' }));
  });

  it('rechaza un emisor incorrecto', async () => {
    await rejected(await fx.sign({ ...fx.validClaims(), iss: 'https://evil.example.com' }));
  });

  it('rechaza un token expirado', async () => {
    const exp = Math.floor(NOW.getTime() / 1000) - 3600;
    await rejected(await fx.sign({ ...fx.validClaims(), exp }));
  });

  it('rechaza el algoritmo none', async () => {
    await rejected(fx.unsigned(fx.validClaims()));
  });

  it('rechaza algoritmos simétricos', async () => {
    await rejected(await fx.signHs256(fx.validClaims()));
  });

  it('rechaza un token sin sub', async () => {
    await rejected(await fx.sign(without(fx.validClaims(), 'sub')));
  });

  it('rechaza un correo sin verificar', async () => {
    await rejected(await fx.sign({ ...fx.validClaims(), email_verified: false }));
  });

  it('rechaza email_verified ausente', async () => {
    await rejected(await fx.sign(without(fx.validClaims(), 'email_verified')));
  });

  it('rechaza un azp desconocido cuando hay cliente Android configurado', async () => {
    await rejected(await fx.sign({ ...fx.validClaims(), azp: 'cliente-ajeno' }));
  });

  it('no valida azp si no hay cliente Android configurado', async () => {
    const token = await fx.sign({ ...fx.validClaims(), azp: 'cliente-ajeno' });
    await verify(token, { webClientId: WEB_CLIENT_ID });
  });

  it('rechaza texto que no es un JWT', async () => {
    await rejected('no-es-un-jwt');
  });
});
