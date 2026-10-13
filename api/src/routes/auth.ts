import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { requireGoogleWebClientId, requireJwtSecret } from '../lib/auth-config';
import type { AuthEnv } from '../lib/auth-middleware';
import { ApiError } from '../lib/errors';
import { googleRemoteKeys, verifyGoogleIdToken } from '../services/google-token-service';
import { issueSession } from '../services/session-service';

const bodySchema = z.object({ idToken: z.string().min(1).max(8192) });

export interface AuthRouteDeps {
  googleKeys?: JWTVerifyGetKey;
  now?: () => Date;
}

export function authRoutes({ googleKeys, now }: AuthRouteDeps = {}) {
  const routes = new Hono<AuthEnv>();

  routes.post('/auth/google', async (c) => {
    // Sin configuración válida no se emite ninguna sesión.
    const webClientId = requireGoogleWebClientId(c.env);
    requireJwtSecret(c.env);

    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, 'INVALID_REQUEST', 'La solicitud no es válida.');
    }

    const identity = await verifyGoogleIdToken(
      parsed.data.idToken,
      {
        webClientId,
        androidClientId: c.env.GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined,
      },
      googleKeys ?? googleRemoteKeys(),
      now?.(),
    );
    return c.json(await issueSession(identity, c.env, now?.()));
  });

  return routes;
}
