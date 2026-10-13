import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  UnsecuredJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose';

export const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
export const ANDROID_CLIENT_ID = 'android-client.apps.googleusercontent.com';
export const JWT_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres-xxxxxxxx';
export const KID = 'test-key-1';
export const NOW = new Date('2026-10-13T12:00:00Z');

const nowSeconds = Math.floor(NOW.getTime() / 1000);

// Claves RSA generadas al vuelo: simulan las claves públicas de Google sin llamadas de red.
export async function createGoogleFixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });

  const validClaims = (): JWTPayload => ({
    iss: 'https://accounts.google.com',
    aud: WEB_CLIENT_ID,
    azp: ANDROID_CLIENT_ID,
    sub: '1234567890',
    email: 'usuario@example.com',
    email_verified: true,
    name: 'Usuario Prueba',
    iat: nowSeconds - 60,
    exp: nowSeconds + 3600,
  });

  async function sign(claims: JWTPayload, key: CryptoKey = privateKey) {
    return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: KID }).sign(key);
  }

  return {
    keys,
    validClaims,
    sign,
    signWithOtherKey: (claims: JWTPayload) => sign(claims, other.privateKey),
    signHs256: (claims: JWTPayload) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256', kid: KID })
        .sign(new TextEncoder().encode(JWT_SECRET)),
    unsigned: (claims: JWTPayload) => new UnsecuredJWT(claims).encode(),
  };
}

export const AUTH_ENV = {
  GOOGLE_WEB_CLIENT_ID: WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: ANDROID_CLIENT_ID,
  JWT_SECRET,
};
