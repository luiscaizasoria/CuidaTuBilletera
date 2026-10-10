import type { ErrorHandler, NotFoundHandler } from 'hono';

// Formato único de error de la API (docs/001-CONSTITUCION.md).
export interface ErrorBody {
  error: { code: string; message: string };
}

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(errorBody('NOT_FOUND', 'Ruta no encontrada.'), 404);

// El detalle del error se registra en el servidor y nunca se devuelve al cliente.
export const errorHandler: ErrorHandler = (err, c) => {
  console.error(err);
  return c.json(errorBody('INTERNAL_ERROR', 'Error interno del servidor.'), 500);
};
