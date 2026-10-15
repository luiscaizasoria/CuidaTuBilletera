import type { AuthErrorKind } from './auth-types';
import type { SignedOutReason, UnavailableCause } from './auth-service';

// Textos visibles para el usuario (en español, ver docs/002-CONVENCIONES.md).
export const AUTH_ERROR_MESSAGES: Record<AuthErrorKind, string> = {
  'play-services': 'Google Play Services no está disponible o necesita actualizarse.',
  'in-progress': 'Ya hay un inicio de sesión en curso.',
  config: 'La configuración de acceso con Google es incorrecta. Contacta al administrador.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  rejected: 'No se pudo validar tu cuenta de Google. Inténtalo de nuevo.',
  // El servicio publica 'conflict' (y nunca lo propaga como error de la API) cuando la
  // recuperación con Google devolvió una cuenta distinta a la de la sesión previa.
  conflict: 'La cuenta de Google cambió; inicia sesión de nuevo.',
  server: 'El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos.',
  storage: 'No se pudo acceder al almacenamiento seguro de este dispositivo.',
  unknown: 'Ocurrió un error inesperado al iniciar sesión.',
};

export const LOGOUT_NOTICE_MESSAGES = {
  'logout-unconfirmed':
    'Cerraste sesión en este dispositivo, pero no pudimos confirmarlo con el servidor. Esa sesión podría seguir activa hasta 7 días sin uso; los accesos ya emitidos valen hasta 15 minutos.',
  'logout-storage-error':
    'No se pudo borrar por completo la sesión del almacenamiento seguro de este dispositivo.',
} as const;

export const DEGRADED_MESSAGE =
  'Sin conexión estable con el servidor. Mostramos tu última sesión conocida y reintentaremos la renovación.';

// Sesión degradada porque /me respondió 401 con un access aparentemente vigente (no es un fallo de red).
export const DEGRADED_UNVERIFIED_MESSAGE =
  'No pudimos verificar tu sesión. Puedes reintentar más tarde';

export const UNAVAILABLE_MESSAGES = {
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  server: 'El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos.',
  storage: 'No se pudo leer la sesión del almacenamiento seguro de este dispositivo.',
} as const;

// Texto neutro para una sesión que terminó sin que el usuario cerrara sesión. No afirma que el
// servidor la haya revocado: solo que ya no se puede usar en este dispositivo.
export const SIGNED_OUT_MESSAGES: Record<SignedOutReason, string | null> = {
  absent: null,
  revoked: 'Tu sesión ya no está disponible en este dispositivo. Ingresa con Google.',
  'signed-out': null,
};

// Texto de la pantalla "sesión no disponible": distingue Play Services, configuración y error
// desconocido (que el servicio publica con causa 'server' y el detalle en `error`) de una caída
// real del servidor, de la red o del almacenamiento.
export function unavailableMessage(cause: UnavailableCause, error: AuthErrorKind | null): string {
  if (error === 'play-services' || error === 'config' || error === 'unknown') {
    return AUTH_ERROR_MESSAGES[error];
  }
  return UNAVAILABLE_MESSAGES[cause];
}
