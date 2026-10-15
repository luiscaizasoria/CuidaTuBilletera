import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// Formato único de error de la API (docs/001-CONSTITUCION.md).
export interface ErrorBody {
  error: { code: string; message: string };
}

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

// Error esperado con respuesta pública: el código y el mensaje se devuelven tal cual.
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(errorBody('NOT_FOUND', 'Ruta no encontrada.'), 404);

// El detalle de los errores inesperados nunca se devuelve al cliente ni se registra completo.
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(errorBody(err.code, err.message), err.status);
  }
  // Solo el nombre del error: el mensaje de D1 puede incluir SQL, valores enlazados o hashes.
  console.error('Error no controlado:', err instanceof Error ? err.name : typeof err);
  return c.json(errorBody('INTERNAL_ERROR', 'Error interno del servidor.'), 500);
};
