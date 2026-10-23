import { ApiError } from './errors';

// Variables y secretos del Worker relacionados con la autenticación (ver api/.dev.vars.example).
export interface AuthBindings {
  GOOGLE_WEB_CLIENT_ID?: string;
  // Variable heredada de DEV (un solo cliente). Excluyente con GOOGLE_ANDROID_CLIENT_IDS.
  GOOGLE_ANDROID_CLIENT_ID?: string;
  // Lista separada por comas de clientes Android permitidos como azp (PROD).
  GOOGLE_ANDROID_CLIENT_IDS?: string;
  JWT_SECRET?: string;
  // Binding D1. Solo existe en los entornos que lo declaran en wrangler.jsonc.
  DB?: D1Database;
  // Diagnóstico de REAUTH_REQUIRED: se pasan solo en un despliegue DEV explícito (--var) y nunca
  // se versionan en wrangler.jsonc. En PROD no existen; sin ENVIRONMENT === 'dev' no se emite nada.
  ENVIRONMENT?: string;
  REAUTH_DIAGNOSTICS?: string;
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

// Sin base de datos no hay sesiones persistentes: las rutas con D1 fallan antes de procesar nada.
export function requireDb(env: AuthBindings): D1Database {
  if (!env.DB) throw configError();
  return env.DB;
}

export const MAX_ANDROID_CLIENT_IDS = 4;
const MAX_CLIENT_ID_LENGTH = 128;
const CLIENT_ID_PATTERN = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

// Interpreta de forma estricta la lista de clientes Android. Función pura: cualquier error
// lanza configError() sin incluir valores. Vacío o solo espacios equivale a «no definida».
export function parseAndroidClientIds(
  raw: string | undefined,
  webClientId?: string,
): readonly string[] {
  if (raw === undefined || raw.trim() === '') return [];
  const ids = raw.split(',').map((item) => item.trim());
  if (ids.length > MAX_ANDROID_CLIENT_IDS) throw configError();
  for (const id of ids) {
    if (id.length > MAX_CLIENT_ID_LENGTH || !CLIENT_ID_PATTERN.test(id)) throw configError();
    if (webClientId !== undefined && id === webClientId) throw configError();
  }
  if (new Set(ids).size !== ids.length) throw configError();
  return ids;
}

// Lista de clientes Android permitidos (azp). Vacía = política azp desactivada (p. ej. wrangler dev).
// La variable heredada de un solo cliente sigue funcionando; definir ambas es ambiguo.
export function requireAndroidClientIds(env: AuthBindings): readonly string[] {
  const legacy = env.GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';
  const list = env.GOOGLE_ANDROID_CLIENT_IDS?.trim() ?? '';
  if (legacy !== '' && list !== '') throw configError();
  const webClientId = env.GOOGLE_WEB_CLIENT_ID?.trim() || undefined;
  if (list !== '') return parseAndroidClientIds(list, webClientId);
  return legacy === '' ? [] : [legacy];
}
