import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from '../lib/errors';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const CLOCK_TOLERANCE_SECONDS = 5;
// Un iat en el futuro se tolera solo hasta este margen cuando se exige frescura (maxAgeSeconds).
const MAX_IAT_FUTURE_SECONDS = 60;

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
}

export interface GoogleAudience {
  webClientId: string;
  androidClientId?: string;
}

export function invalidTokenError(): ApiError {
  return new ApiError(401, 'INVALID_TOKEN', 'Token de autenticación inválido');
}

// Se crea una sola vez por isolate: solo cachea las claves públicas de Google.
let remoteKeys: JWTVerifyGetKey | undefined;
export function googleRemoteKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return remoteKeys;
}

// Verifica un ID token de Google. Cualquier fallo se reporta igual (INVALID_TOKEN) sin detalle
// y sin registrar el token. Las claves se inyectan para poder probar sin llamar a Google.
export async function verifyGoogleIdToken(
  idToken: string,
  audience: GoogleAudience,
  keys: JWTVerifyGetKey,
  currentDate?: Date,
  // Opcional: exige un token recién emitido (iat entre now - maxAgeSeconds y now + 60 s). El login
  // no lo usa; las operaciones sensibles (DELETE /me) piden una verificación de identidad con Google (token reciente; no equivale a reautenticar con contraseña o biometría).
  maxAgeSeconds?: number,
): Promise<GoogleIdentity> {
  try {
    const { payload } = await jwtVerify(idToken, keys, {
      algorithms: ['RS256'],
      issuer: GOOGLE_ISSUERS,
      audience: audience.webClientId,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate,
      requiredClaims: ['exp', 'iat', 'sub'],
    });

    if (typeof payload.sub !== 'string' || payload.sub === '') throw invalidTokenError();
    if (maxAgeSeconds !== undefined) {
      const nowSeconds = Math.floor((currentDate ?? new Date()).getTime() / 1000);
      const iat = payload.iat;
      if (typeof iat !== 'number' || !Number.isFinite(iat)) throw invalidTokenError();
      if (iat < nowSeconds - maxAgeSeconds || iat > nowSeconds + MAX_IAT_FUTURE_SECONDS) {
        throw invalidTokenError();
      }
    }
    if (payload.email_verified !== true) throw invalidTokenError();
    if (typeof payload.email !== 'string' || payload.email === '') throw invalidTokenError();

    // OpenID Connect: azp identifica al cliente que pidió el token. Si viene y hay un cliente
    // Android configurado, solo se aceptan los clientes conocidos (Android o Web).
    if (payload.azp !== undefined && audience.androidClientId) {
      const known = [audience.androidClientId, audience.webClientId];
      if (typeof payload.azp !== 'string' || !known.includes(payload.azp)) {
        throw invalidTokenError();
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    throw invalidTokenError();
  }
}
