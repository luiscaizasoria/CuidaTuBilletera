import { jwtVerify, SignJWT } from 'jose';
import { MIN_JWT_SECRET_LENGTH, SESSION_ISSUER, SESSION_TTL_SECONDS } from '../lib/auth-config';

// JWT v2 (sesiones persistentes). Audiencia propia, distinta de SESSION_AUDIENCE (JWT v1) y del
// cliente de Google, para que un token v1 nunca sea aceptado como v2 ni al revés.
export const ACCESS_TOKEN_AUDIENCE_V2 = 'cuidatubilletera-app-v2';
export const ACCESS_TOKEN_TTL_SECONDS = SESSION_TTL_SECONDS;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

export interface AccessTokenUser {
  id: string;
  email: string;
  name?: string;
}

export type AccessTokenVerification =
  | { status: 'valid'; user: AccessTokenUser }
  // Sin detalle a propósito: el motivo concreto no se expone.
  | { status: 'invalid' };

function secretKey(secret: string): Uint8Array {
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error('JWT_SECRET ausente o demasiado corto');
  }
  return encoder.encode(secret);
}

export async function issueAccessToken(
  user: AccessTokenUser,
  secret: string,
  now: Date,
): Promise<string> {
  const key = secretKey(secret);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: Record<string, string> = { email: user.email };
  if (user.name) claims.name = user.name;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE_V2)
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .sign(key);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  now: Date,
): Promise<AccessTokenVerification> {
  const key = secretKey(secret);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE_V2,
      requiredClaims: ['exp', 'iat', 'sub'],
      currentDate: now,
    });
    if (
      typeof payload.sub !== 'string' ||
      !UUID_PATTERN.test(payload.sub) ||
      typeof payload.email !== 'string'
    ) {
      return { status: 'invalid' };
    }
    return {
      status: 'valid',
      user: {
        id: payload.sub,
        email: payload.email,
        name: typeof payload.name === 'string' ? payload.name : undefined,
      },
    };
  } catch {
    return { status: 'invalid' };
  }
}
