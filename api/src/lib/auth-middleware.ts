import { createMiddleware } from 'hono/factory';
import { findUserById } from '../db/user-repository';
import { verifyAccessToken } from '../services/access-token-service';
import { requireDb, requireJwtSecret, type AuthBindings } from './auth-config';
import { ApiError } from './errors';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthEnv {
  Bindings: AuthBindings;
  Variables: { user: AuthUser };
}

const invalidToken = () => new ApiError(401, 'INVALID_TOKEN', 'Token de autenticación inválido');

// Exige el JWT v2 de la API. Los ID tokens de Google y los JWT v1 no sirven como sesión.
// El usuario autenticado sale de la fila de D1, nunca de los claims del token.
export function authMiddleware(now?: () => Date) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const db = requireDb(c.env);
    const secret = requireJwtSecret(c.env);
    const match = /^Bearer (\S+)$/.exec(c.req.header('Authorization') ?? '');
    if (!match?.[1]) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Se requiere autenticación.');
    }
    const verified = await verifyAccessToken(match[1], secret, now?.() ?? new Date());
    if (verified.status !== 'valid') throw invalidToken();
    const row = await findUserById(db, verified.user.id);
    if (!row) throw invalidToken();
    c.set('user', { id: row.id, email: row.email, name: row.nombre ?? undefined });
    await next();
  });
}
