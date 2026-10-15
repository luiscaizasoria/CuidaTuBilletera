import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError, resourceNotFound } from './errors';
import { readJsonBody } from './json-body';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_RESOURCE_BODY_BYTES } from './limits';

export const invalidRequest = () =>
  new ApiError(400, 'INVALID_REQUEST', 'La solicitud no es válida.');

// Lee el cuerpo (máx. 4 KiB: 413) y lo valida con un esquema Zod estricto (400).
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await readJsonBody(request, MAX_RESOURCE_BODY_BYTES));
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

const pageQueryShape = {
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .optional(),
  page_size: z
    .string()
    .regex(/^[1-9]\d{0,2}$/)
    .transform(Number)
    .pipe(z.number().max(MAX_PAGE_SIZE))
    .optional(),
  incluirArchivadas: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
};

export const accountsQuerySchema = z.object(pageQueryShape);
export const categoriesQuerySchema = z.object({
  ...pageQueryShape,
  tipo: z.enum(['ingreso', 'egreso']).optional(),
});

export interface ListQuery {
  page: number;
  pageSize: number;
  incluirArchivadas: boolean;
  tipo?: 'ingreso' | 'egreso';
}

type RawListQuery = {
  page?: number;
  page_size?: number;
  incluirArchivadas?: boolean;
  tipo?: 'ingreso' | 'egreso';
};

// Valida la query de un listado. Un parámetro repetido o vacío es inválido; los desconocidos
// se ignoran.
export function parseListQuery(
  c: Context,
  schema: z.ZodType<RawListQuery>,
  keys: readonly string[],
): ListQuery {
  const raw: Record<string, string> = {};
  for (const key of keys) {
    const values = c.req.queries(key);
    if (!values) continue;
    if (values.length !== 1) throw invalidRequest();
    raw[key] = values[0] as string;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw invalidRequest();
  const { page, page_size, incluirArchivadas, tipo } = parsed.data;
  return {
    page: page ?? 1,
    pageSize: page_size ?? DEFAULT_PAGE_SIZE,
    incluirArchivadas: incluirArchivadas ?? false,
    ...(tipo ? { tipo } : {}),
  };
}

const UUID_LOWERCASE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Un id de ruta que no es UUID no puede existir: 404 igual que un recurso inexistente.
export function requireUuidParam(value: string): string {
  if (!UUID_LOWERCASE.test(value)) throw resourceNotFound();
  return value;
}
