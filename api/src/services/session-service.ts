import { jwtVerify, SignJWT } from 'jose';
import {
  requireJwtSecret,
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  SESSION_TTL_SECONDS,
  type AuthBindings,
} from '../lib/auth-config';
import { ApiError } from '../lib/errors';
import type { GoogleIdentity } from './google-token-service';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

export interface Session {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SessionUser;
}

const encoder = new TextEncoder();

// Sesión transitoria sin base de datos: no hay revocación (ver docs/003-DECISIONES-FASE0.md).
export async function issueSession(
  identity: GoogleIdentity,
  env: AuthBindings,
  now: Date = new Date(),
): Promise<Session> {
  const secret = encoder.encode(requireJwtSecret(env));
  const issuedAt = Math.floor(now.getTime() / 1000);
  const accessToken = await new SignJWT({ email: identity.email, name: identity.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(identity.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(secret);

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: SESSION_TTL_SECONDS,
    user: { id: identity.sub, email: identity.email, name: identity.name },
  };
}

export async function verifySession(
  token: string,
  env: AuthBindings,
  currentDate?: Date,
): Promise<SessionUser> {
  const secret = encoder.encode(requireJwtSecret(env));
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      requiredClaims: ['exp', 'iat', 'sub'],
      currentDate,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new Error('claims inválidos');
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token de autenticación inválido');
  }
}
