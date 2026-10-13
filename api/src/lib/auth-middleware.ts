import { createMiddleware } from 'hono/factory';
import type { SessionUser } from '../services/session-service';
import { verifySession } from '../services/session-service';
import type { AuthBindings } from './auth-config';
import { ApiError } from './errors';

export interface AuthEnv {
  Bindings: AuthBindings;
  Variables: { user: SessionUser };
}

// Exige el JWT propio de la API. Los ID tokens de Google no sirven como sesión.
export function authMiddleware(now?: () => Date) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const match = /^Bearer (\S+)$/.exec(c.req.header('Authorization') ?? '');
    if (!match?.[1]) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Se requiere autenticación.');
    }
    c.set('user', await verifySession(match[1], c.env, now?.()));
    await next();
  });
}
