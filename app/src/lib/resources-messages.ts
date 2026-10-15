import { AuthError } from './auth-types';
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
  PAYLOAD_TOO_LARGE: 'Los datos enviados son demasiado grandes.',
};

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

export function resourceErrorMessage(error: unknown): string {
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
