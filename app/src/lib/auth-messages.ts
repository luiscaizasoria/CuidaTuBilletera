import type { AuthErrorKind } from './auth-types';

// Textos visibles para el usuario (en español, ver docs/002-CONVENCIONES.md).
export const AUTH_ERROR_MESSAGES: Record<AuthErrorKind, string> = {
  'play-services': 'Google Play Services no está disponible o necesita actualizarse.',
  'in-progress': 'Ya hay un inicio de sesión en curso.',
  config: 'La configuración de acceso con Google es incorrecta. Contacta al administrador.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  rejected: 'No se pudo validar tu cuenta de Google. Inténtalo de nuevo.',
  unknown: 'Ocurrió un error inesperado al iniciar sesión.',
};
