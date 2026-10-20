// Textos de «Eliminar mi cuenta y mis datos» (G1; docs/003 Decisión G1, docs/010 §24). Sin cifras ni
// plazos de conservación: la política de privacidad es la fuente de esos datos.
import type { DeleteAccountFailureReason } from './auth-service';

export const CONFIRM_WORD = 'ELIMINAR';

// Sin espacios en los extremos y sin distinguir mayúsculas. La app envía siempre el literal.
export function matchesConfirmation(input: string): boolean {
  return input.trim().toUpperCase() === CONFIRM_WORD;
}

export const DELETE_ACCOUNT_LABEL = 'Eliminar mi cuenta y mis datos';
export const DELETE_ACCOUNT_HINT = 'Abre una confirmación';
export const PRIVACY_POLICY_LABEL = 'Política de privacidad';
export const PRIVACY_POLICY_HINT = 'Se abre en el navegador';
export const DELETION_WEB_LABEL = 'Ver cómo solicitar la eliminación sin la app';

export const DELETE_SHEET_TITLE = DELETE_ACCOUNT_LABEL;
export const DELETE_IRREVERSIBLE = 'Esto no se puede deshacer.';
export const DELETE_WILL_REMOVE_TITLE = 'Se eliminará';
export const DELETE_WILL_REMOVE =
  'Tus cuentas, categorías y movimientos (incluidos los anulados y los archivados) y tus sesiones.';
export const DELETE_WILL_KEEP_TITLE = 'No se elimina';
export const DELETE_WILL_KEEP =
  'Los archivos que ya exportaste y tu cuenta de Google. Algunas copias de recuperación se conservan por un tiempo limitado; la política de privacidad lo explica.';
export const DELETE_ALTERNATIVE =
  'Si solo quieres dejar de usar una cuenta, puedes archivarla; si quieres salir de la app, cierra sesión. Antes de eliminar, te sugerimos exportar tus datos.';
export const DELETE_REAUTH_NOTICE =
  'Después te pediremos elegir tu cuenta de Google para verificar la cuenta.';
export const DELETE_FIELD_LABEL = 'Para confirmar, escribe ELIMINAR';
export const DELETE_FIELD_ACCESSIBILITY = 'Escribe ELIMINAR para confirmar';
export const DELETE_CONFIRM_LABEL = 'Eliminar definitivamente';
export const DELETE_BUSY_LABEL = 'Eliminando…';
export const DELETE_RETRY_LABEL = 'Comprobar y reintentar';
export const DELETE_CANCEL_LABEL = 'Cancelar';
export const DELETE_REAUTH_PROGRESS = 'Elige tu cuenta de Google para verificar la cuenta';
export const DELETE_DISCARD_TITLE = '¿Descartar la eliminación?';
export const DELETE_DISCARD_MESSAGE = 'Lo que escribiste se perderá y no se eliminará nada.';

export const DELETE_CANCELLED_MESSAGE =
  'No se eliminó nada. Para continuar, elige de nuevo tu cuenta de Google.';
export const DELETE_UNCERTAIN_MESSAGE =
  'No pudimos confirmar si se eliminó tu cuenta. Comprueba tu conexión y toca «Comprobar y reintentar».';

// `{correo}` se sustituye por el correo de la sesión (o se omite si no se conoce).
export const DELETE_FAILURE_MESSAGES = {
  'reauth-required':
    'No pudimos verificar tu cuenta de Google. Elige la cuenta con la que iniciaste sesión ({correo}) e inténtalo de nuevo. No se eliminó nada.',
  timeout: 'No recibimos respuesta de Google a tiempo. No se eliminó nada. Inténtalo de nuevo.',
  network:
    'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo. No se eliminó nada.',
  server:
    'El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos. No se eliminó nada.',
  'invalid-request': 'No pudimos procesar la solicitud. No se eliminó nada. Inténtalo de nuevo.',
  'play-services':
    'Google Play Services no está disponible o necesita actualizarse. No se eliminó nada.',
  config: 'La configuración de acceso con Google es incorrecta. No se eliminó nada.',
  'in-progress':
    'Ya hay una verificación de Google en curso. Espera un momento e inténtalo de nuevo. No se eliminó nada.',
  unknown: 'Ocurrió un error inesperado. No se eliminó nada. Inténtalo de nuevo.',
} as const satisfies Record<DeleteAccountFailureReason, string>;

// Mensaje del pie según el resultado: con `uncertain` manda el texto de «no pudimos confirmar».
export function deleteFailureMessage(
  reason: DeleteAccountFailureReason,
  uncertain: boolean,
  email?: string,
): string {
  if (uncertain) return DELETE_UNCERTAIN_MESSAGE;
  const text: string = DELETE_FAILURE_MESSAGES[reason];
  // Función de reemplazo: el correo se inserta literal (sin interpretar `$&`, `$'`, etc.).
  return email ? text.replace('{correo}', () => email) : text.replace(' ({correo})', () => '');
}
