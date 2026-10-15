import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { requireDb, requireGoogleWebClientId, requireJwtSecret } from '../lib/auth-config';
import type { AuthEnv } from '../lib/auth-middleware';
import { ApiError } from '../lib/errors';
import { readJsonBody } from '../lib/json-body';
import {
  createSessionFromGoogleLogin,
  logoutSession,
  refreshSession,
  type AuthSession,
  type AuthSessionDeps,
} from '../services/auth-session-service';
import { googleRemoteKeys, verifyGoogleIdToken } from '../services/google-token-service';
import { refreshExpiry, type RandomBytes } from '../services/refresh-token';

const loginSchema = z.object({ idToken: z.string().min(1).max(8192) });
// 32 bytes en base64url sin padding. Se valida antes de hashear o consultar D1.
const refreshSchema = z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export interface AuthRouteDeps {
  googleKeys?: JWTVerifyGetKey;
  now?: () => Date;
  // Solo para pruebas deterministas; en producción se usan crypto.randomUUID y getRandomValues.
  idGenerator?: () => string;
  randomBytes?: RandomBytes;
}

const invalidRequest = () => new ApiError(400, 'INVALID_REQUEST', 'La solicitud no es válida.');

export function authRoutes({ googleKeys, now, idGenerator, randomBytes }: AuthRouteDeps = {}) {
  const routes = new Hono<AuthEnv>();

  // Un solo instante por petición: lo comparten la expiración informada y la persistida.
  function serviceDeps(requestNow: Date): Partial<AuthSessionDeps> {
    const deps: Partial<AuthSessionDeps> = { now: () => requestNow };
    if (idGenerator) deps.idGenerator = idGenerator;
    if (randomBytes) deps.randomBytes = randomBytes;
    return deps;
  }

  const requestInstant = () => now?.() ?? new Date();
  const refreshExpiresAt = (requestNow: Date) => refreshExpiry(requestNow).toISOString();

  routes.post('/auth/google', async (c) => {
    // Sin configuración válida no se emite ninguna sesión.
    const webClientId = requireGoogleWebClientId(c.env);
    const secret = requireJwtSecret(c.env);
    const db = requireDb(c.env);

    const parsed = loginSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw invalidRequest();

    const requestNow = requestInstant();
    const identity = await verifyGoogleIdToken(
      parsed.data.idToken,
      {
        webClientId,
        androidClientId: c.env.GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined,
      },
      googleKeys ?? googleRemoteKeys(),
      requestNow,
    );
    const { session } = await createSessionFromGoogleLogin(
      db,
      secret,
      identity,
      serviceDeps(requestNow),
    );
    return c.json(loginBody(session, requestNow));
  });

  routes.post('/auth/refresh', async (c) => {
    const db = requireDb(c.env);
    const secret = requireJwtSecret(c.env);

    const parsed = refreshSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw invalidRequest();

    const requestNow = requestInstant();
    const result = await refreshSession(
      db,
      secret,
      parsed.data.refreshToken,
      serviceDeps(requestNow),
    );
    if (result.status === 'REFRESH_CONFLICT') {
      throw new ApiError(
        409,
        'REFRESH_CONFLICT',
        'El token ya fue renovado por otra solicitud. Reintenta.',
      );
    }
    if (result.status !== 'OK') {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token inválido o expirado.');
    }
    const { accessToken, tokenType, expiresIn, refreshToken } = result.session;
    return c.json({
      accessToken,
      tokenType,
      expiresIn,
      refreshToken,
      refreshExpiresAt: refreshExpiresAt(requestNow),
    });
  });

  routes.post('/auth/logout', async (c) => {
    const db = requireDb(c.env);

    const parsed = refreshSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw invalidRequest();

    await logoutSession(db, parsed.data.refreshToken, serviceDeps(requestInstant()));
    // Idempotente: igual respuesta exista o no el token.
    return c.body(null, 204);
  });

  function loginBody(session: AuthSession, requestNow: Date) {
    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
      user: session.user,
      refreshToken: session.refreshToken,
      refreshExpiresAt: refreshExpiresAt(requestNow),
    };
  }

  return routes;
}
