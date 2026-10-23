import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
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
  // Solo para diagnóstico interno; se define como propiedad no enumerable (no se serializa ni compara).
  readonly tokenAgeSeconds?: number;
}

export interface GoogleAudience {
  webClientId: string;
  // Vacía = política azp desactivada. `aud` siempre es solo webClientId.
  androidClientIds: readonly string[];
}

export function invalidTokenError(): ApiError {
  return new ApiError(401, 'INVALID_TOKEN', 'Token de autenticación inválido');
}

// Motivo interno del rechazo de un ID token. Solo sirve para diagnóstico: nunca se serializa ni
// llega al cliente. GOOGLE_SUB_MISMATCH lo decide el llamador (el token es válido en sí mismo).
export type ReauthRejectionReason =
  | 'TOKEN_INVALID'
  | 'TOKEN_TOO_OLD'
  | 'GOOGLE_SUB_MISMATCH'
  | 'EMAIL_NOT_VERIFIED'
  | 'AZP_INVALID'
  | 'OTRAS_CONDICIONES';

// Mismo status, código y mensaje públicos que invalidTokenError; el motivo es solo interno.
export class GoogleTokenRejectedError extends ApiError {
  readonly reason!: ReauthRejectionReason;
  readonly tokenAgeSeconds?: number;

  constructor(reason: ReauthRejectionReason, tokenAgeSeconds?: number) {
    super(401, 'INVALID_TOKEN', 'Token de autenticación inválido');
    this.name = 'ApiError';
    // No enumerable: JSON.stringify y los registros genéricos no lo incluyen.
    Object.defineProperty(this, 'reason', { value: reason, enumerable: false });
    Object.defineProperty(this, 'tokenAgeSeconds', { value: tokenAgeSeconds, enumerable: false });
  }
}

const rejection = (reason: ReauthRejectionReason, tokenAgeSeconds?: number) =>
  new GoogleTokenRejectedError(reason, tokenAgeSeconds);

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

    if (typeof payload.sub !== 'string' || payload.sub === '') throw rejection('TOKEN_INVALID');
    // Edad del token (firma ya verificada) respecto a la misma fecha de la verificación.
    const nowSeconds = Math.floor((currentDate ?? new Date()).getTime() / 1000);
    const iat = payload.iat;
    const age = typeof iat === 'number' && Number.isFinite(iat) ? nowSeconds - iat : undefined;
    if (maxAgeSeconds !== undefined) {
      if (typeof iat !== 'number' || !Number.isFinite(iat)) throw rejection('TOKEN_TOO_OLD');
      if (iat < nowSeconds - maxAgeSeconds || iat > nowSeconds + MAX_IAT_FUTURE_SECONDS) {
        throw rejection('TOKEN_TOO_OLD', age);
      }
    }
    if (payload.email_verified !== true) throw rejection('EMAIL_NOT_VERIFIED', age);
    if (typeof payload.email !== 'string' || payload.email === '') {
      throw rejection('EMAIL_NOT_VERIFIED', age);
    }

    // OpenID Connect: azp identifica al cliente que pidió el token. Si viene y hay un cliente
    // Android configurado, solo se aceptan los clientes conocidos (Android o Web).
    if (payload.azp !== undefined && audience.androidClientIds.length > 0) {
      const known = [...audience.androidClientIds, audience.webClientId];
      if (typeof payload.azp !== 'string' || !known.includes(payload.azp)) {
        throw rejection('AZP_INVALID', age);
      }
    }

    const identity: GoogleIdentity = {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
    Object.defineProperty(identity, 'tokenAgeSeconds', { value: age, enumerable: false });
    return identity;
  } catch (error) {
    if (error instanceof GoogleTokenRejectedError) throw error;
    // Un fallo de red al obtener las claves no es un token inválido.
    const reason =
      error instanceof errors.JWKSTimeout || !(error instanceof errors.JOSEError)
        ? 'OTRAS_CONDICIONES'
        : 'TOKEN_INVALID';
    throw rejection(reason);
  }
}
