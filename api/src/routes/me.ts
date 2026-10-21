import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { findUserById } from '../db/user-repository';
import {
  requireAndroidClientIds,
  requireDb,
  requireGoogleWebClientId,
  requireJwtSecret,
} from '../lib/auth-config';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { ApiError } from '../lib/errors';
import { readJsonBody } from '../lib/json-body';
import { googleRemoteKeys, verifyGoogleIdToken } from '../services/google-token-service';
import { deleteUserProfile } from '../services/profile-service';

// Frescura máxima del ID token de Google exigido para eliminar el perfil.
export const REAUTH_MAX_AGE_SECONDS = 300;

const deleteSchema = z.strictObject({
  confirm: z.literal('ELIMINAR'),
  idToken: z.string().min(1).max(8192),
});

// Mismo mensaje para cualquier fallo de la verificación de identidad con Google: no revela si el sub coincide.
const reauthRequired = () =>
  new ApiError(
    401,
    'REAUTH_REQUIRED',
    'No se pudo confirmar tu identidad. Usa la cuenta de Google con la que iniciaste sesión.',
  );

export function meRoutes(now?: () => Date, googleKeys?: JWTVerifyGetKey) {
  const routes = new Hono<AuthEnv>();
  routes.get('/me', authMiddleware(now), (c) => c.json({ user: c.get('user') }));

  routes.delete('/me', async (c, next) => {
    // Configuración completa antes de autenticar o tocar Google.
    requireDb(c.env);
    requireJwtSecret(c.env);
    requireGoogleWebClientId(c.env);
    requireAndroidClientIds(c.env);
    await next();
  });
  routes.delete('/me', authMiddleware(now), async (c) => {
    const db = requireDb(c.env);
    const webClientId = requireGoogleWebClientId(c.env);
    const androidClientIds = requireAndroidClientIds(c.env);
    const user = c.get('user');

    const parsed = deleteSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw new ApiError(400, 'INVALID_REQUEST', 'La solicitud no es válida.');

    const requestNow = now?.() ?? new Date();
    let identitySub: string;
    try {
      const identity = await verifyGoogleIdToken(
        parsed.data.idToken,
        { webClientId, androidClientIds },
        googleKeys ?? googleRemoteKeys(),
        requestNow,
        REAUTH_MAX_AGE_SECONDS,
      );
      identitySub = identity.sub;
    } catch {
      throw reauthRequired();
    }

    const row = await findUserById(db, user.id);
    if (!row) throw new ApiError(401, 'INVALID_TOKEN', 'Token de autenticación inválido');
    if (row.google_sub !== identitySub) throw reauthRequired();

    await deleteUserProfile(db, user.id);
    return c.body(null, 204);
  });
  return routes;
}
