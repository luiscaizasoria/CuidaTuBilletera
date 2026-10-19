import { AuthError } from './auth-types';
import { ExportFileError } from './export-files';
import { ApiRequestError } from './resources-api';

// Mensajes en español mapeados desde el código del error. Nunca se muestra el message del servidor.
const API_CODE_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
  NOT_FOUND: 'El elemento ya no existe. Actualiza la lista.',
  ACCOUNT_ARCHIVED: 'La cuenta está archivada. Desarchívala para modificarla.',
  CATEGORY_NAME_TAKEN: 'Ya existe una categoría de ese tipo con ese nombre.',
  CATEGORY_IN_USE:
    'La categoría tiene movimientos y no puede eliminarse. Puedes archivarla en su lugar.',
  LIMIT_REACHED: 'Alcanzaste el límite permitido. Archiva o elimina elementos para continuar.',
  CATEGORY_ARCHIVED: 'La categoría está archivada. Elige otra categoría.',
  CATEGORY_MISMATCH: 'La categoría no corresponde a esta cuenta o al tipo de movimiento.',
  TRANSACTION_VOIDED: 'El movimiento ya fue anulado y no puede modificarse.',
  EXPORT_TOO_LARGE: 'El rango tiene más de 2000 movimientos; elige un período más corto.',
  PAYLOAD_TOO_LARGE: 'Los datos enviados son demasiado grandes.',
};

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

const EXPORT_PREPARE_MESSAGE = 'No se pudo preparar el archivo. Inténtalo de nuevo.';
const EXPORT_UNAVAILABLE_MESSAGE =
  'Esta versión de la app no admite compartir archivos; instala la versión actualizada.';

export function resourceErrorMessage(error: unknown): string {
  if (error instanceof ExportFileError) {
    return error.code === 'EXPORT_UNAVAILABLE'
      ? EXPORT_UNAVAILABLE_MESSAGE
      : EXPORT_PREPARE_MESSAGE;
  }
  if (error instanceof ApiRequestError) {
    if (error.status === 413) return API_CODE_MESSAGES.PAYLOAD_TOO_LARGE!;
    return API_CODE_MESSAGES[error.code] ?? GENERIC_MESSAGE;
  }
  if (error instanceof AuthError) {
    switch (error.kind) {
      case 'network':
        return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
      case 'server':
        return 'El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos.';
      case 'rejected':
      case 'conflict':
        return 'No pudimos verificar tu sesión. Inténtalo de nuevo o vuelve a iniciar sesión.';
      case 'storage':
        return 'No se pudo acceder al almacenamiento seguro de este dispositivo.';
      default:
        return GENERIC_MESSAGE;
    }
  }
  return GENERIC_MESSAGE;
}

// Respuesta perdida al CREAR (docs/007 §5.5): el servidor pudo haber guardado el registro y la API no
// tiene clave de idempotencia; el mensaje no invita a reintentar a ciegas.
export const LOST_RESPONSE_MOVEMENT =
  'No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.';
export const LOST_RESPONSE_ACCOUNT =
  'No pudimos confirmar si se creó. Revisa Mis cuentas antes de volver a intentar.';
// Respuesta perdida al crear una categoría desde Nuevo movimiento (docs/007 §5.13 E).
export const UNCERTAIN_CATEGORY_MESSAGE =
  'No pudimos confirmar si se creó. Revisa la lista de categorías antes de volver a intentar.';
// Cuenta archivada en otro dispositivo (docs/007 §3.5.3): el movimiento no se guardó.
export const ACCOUNT_ARCHIVED_ON_SAVE =
  'Esta cuenta está archivada, por eso no se guardó el movimiento. Desarchívala desde Mis cuentas para anotar movimientos.';

// true si la escritura pudo haber llegado al servidor sin que la app lo sepa (sin conexión o respuesta
// perdida, error 5xx o fallo desconocido). Un 4xx de la API garantiza que no se guardó.
export function isUncertainWriteFailure(error: unknown): boolean {
  if (error instanceof ApiRequestError) return error.status >= 500;
  if (error instanceof AuthError) return error.kind === 'network' || error.kind === 'server';
  return !(error instanceof ExportFileError);
}

// Falla al guardar una cuenta con el bloque Apariencia visible (docs/007 §5.14.I): red, servidor o 400.
export const APPEARANCE_SAVE_ERROR =
  'No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.';
