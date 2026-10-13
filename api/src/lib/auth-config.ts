import { ApiError } from './errors';

// Variables y secretos del Worker relacionados con la autenticación (ver api/.dev.vars.example).
export interface AuthBindings {
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  JWT_SECRET?: string;
}

// Audiencia del JWT propio. Distinta a propósito de la audiencia de los ID tokens de Google
// (el cliente Web), para que un token nunca pueda hacerse pasar por el otro.
export const SESSION_ISSUER = 'cuidatubilletera-api';
export const SESSION_AUDIENCE = 'cuidatubilletera-app';
export const SESSION_TTL_SECONDS = 15 * 60;

export const MIN_JWT_SECRET_LENGTH = 32;

export function configError(): ApiError {
  return new ApiError(500, 'CONFIG_ERROR', 'Configuración del servidor incompleta.');
}

export function requireJwtSecret(env: AuthBindings): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) throw configError();
  return secret;
}

export function requireGoogleWebClientId(env: AuthBindings): string {
  const id = env.GOOGLE_WEB_CLIENT_ID?.trim();
  if (!id) throw configError();
  return id;
}
