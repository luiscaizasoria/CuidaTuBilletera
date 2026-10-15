import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError, resourceNotFound } from './errors';
import { readJsonBody } from './json-body';
import { isValidTransactionDate } from './dates';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_RESOURCE_BODY_BYTES,
} from './limits';

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

const UUID_LOWERCASE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const uuidSchema = z.string().regex(UUID_LOWERCASE);
export const transactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidTransactionDate);

export const transactionsQuerySchema = z.object({
  page: pageQueryShape.page,
  page_size: pageQueryShape.page_size,
  account_id: uuidSchema,
  tipo: z.enum(['ingreso', 'gasto']).optional(),
  category_id: uuidSchema.optional(),
  desde: transactionDateSchema.optional(),
  hasta: transactionDateSchema.optional(),
});

export interface TransactionsQuery {
  accountId: string;
  tipo?: 'ingreso' | 'gasto';
  categoryId?: string;
  desde?: string;
  hasta?: string;
  page: number;
  pageSize: number;
}

// Un parámetro repetido o vacío es inválido; los desconocidos se ignoran.
export function collectQuery(c: Context, keys: readonly string[]): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const key of keys) {
    const values = c.req.queries(key);
    if (!values) continue;
    if (values.length !== 1) throw invalidRequest();
    raw[key] = values[0] as string;
  }
  return raw;
}

// Query de GET /transactions: account_id obligatorio, page_size por defecto 20 y desde <= hasta.
export function parseTransactionsQuery(c: Context): TransactionsQuery {
  const parsed = transactionsQuerySchema.safeParse(
    collectQuery(c, ['account_id', 'tipo', 'category_id', 'desde', 'hasta', 'page', 'page_size']),
  );
  if (!parsed.success) throw invalidRequest();
  const { account_id, tipo, category_id, desde, hasta, page, page_size } = parsed.data;
  if (desde !== undefined && hasta !== undefined && desde > hasta) throw invalidRequest();
  return {
    accountId: account_id,
    ...(tipo ? { tipo } : {}),
    ...(category_id ? { categoryId: category_id } : {}),
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    page: page ?? 1,
    pageSize: page_size ?? DEFAULT_TRANSACTIONS_PAGE_SIZE,
  };
}

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
  const parsed = schema.safeParse(collectQuery(c, keys));
  if (!parsed.success) throw invalidRequest();
  const { page, page_size, incluirArchivadas, tipo } = parsed.data;
  return {
    page: page ?? 1,
    pageSize: page_size ?? DEFAULT_PAGE_SIZE,
    incluirArchivadas: incluirArchivadas ?? false,
    ...(tipo ? { tipo } : {}),
  };
}

// Un id de ruta que no es UUID no puede existir: 404 igual que un recurso inexistente.
export function requireUuidParam(value: string): string {
  if (!UUID_LOWERCASE.test(value)) throw resourceNotFound();
  return value;
}

const calendarQuerySchema = z.object({
  account_id: uuidSchema,
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .refine((value) => isValidTransactionDate(`${value}-01`)),
});

export interface CalendarQuery {
  accountId: string;
  month: string;
}

// Query de GET /calendar: account_id UUID y month AAAA-MM (2000-01 a 2100-12), ambos obligatorios.
export function parseCalendarQuery(c: Context): CalendarQuery {
  const parsed = calendarQuerySchema.safeParse(collectQuery(c, ['account_id', 'month']));
  if (!parsed.success) throw invalidRequest();
  return { accountId: parsed.data.account_id, month: parsed.data.month };
}

const reportRangeShape = {
  account_id: uuidSchema,
  desde: transactionDateSchema,
  hasta: transactionDateSchema,
};
const reportRangeSchema = z.object(reportRangeShape);
const reportPeriodSchema = z.object({ ...reportRangeShape, group: z.enum(['month', 'year']) });

export type ReportGroup = 'month' | 'year';

export interface ReportRangeQuery {
  accountId: string;
  desde: string;
  hasta: string;
}

export interface ReportPeriodQuery extends ReportRangeQuery {
  group: ReportGroup;
}

// Máximo de puntos de la serie por mes (10 años). Por año el máximo natural es 101 (2000-2100).
export const MAX_REPORT_MONTH_POINTS = 120;

export function countPeriods(desde: string, hasta: string, group: ReportGroup): number {
  const years = Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4));
  if (group === 'year') return years + 1;
  return years * 12 + Number(hasta.slice(5, 7)) - Number(desde.slice(5, 7)) + 1;
}

// Query de GET /reports/summary y /reports/by-category: account_id, desde y hasta obligatorios
// (inclusivos, 2000-01-01 a 2100-12-31) y desde <= hasta.
export function parseReportQuery(c: Context): ReportRangeQuery {
  const parsed = reportRangeSchema.safeParse(collectQuery(c, ['account_id', 'desde', 'hasta']));
  if (!parsed.success || parsed.data.desde > parsed.data.hasta) throw invalidRequest();
  const { account_id, desde, hasta } = parsed.data;
  return { accountId: account_id, desde, hasta };
}

// Query de GET /reports/by-period: igual que la anterior más group=month|year (obligatorio).
// Por mes se admiten como máximo 120 períodos.
export function parseReportPeriodQuery(c: Context): ReportPeriodQuery {
  const parsed = reportPeriodSchema.safeParse(
    collectQuery(c, ['account_id', 'desde', 'hasta', 'group']),
  );
  if (!parsed.success || parsed.data.desde > parsed.data.hasta) throw invalidRequest();
  const { account_id, desde, hasta, group } = parsed.data;
  if (group === 'month' && countPeriods(desde, hasta, group) > MAX_REPORT_MONTH_POINTS) {
    throw invalidRequest();
  }
  return { accountId: account_id, desde, hasta, group };
}

const exportQuerySchema = z.object({
  ...reportRangeShape,
  tipo: z.enum(['ingreso', 'gasto']).optional(),
  category_id: uuidSchema.optional(),
  format: z.enum(['csv', 'pdf']).optional(),
});

export interface ExportQuery extends ReportRangeQuery {
  tipo?: 'ingreso' | 'gasto';
  categoryId?: string;
  format: 'csv' | 'pdf';
}

// Query de GET /export: account_id, desde y hasta obligatorios (desde <= hasta); tipo, category_id
// y format opcionales. format admite csv (por defecto) o pdf.
export function parseExportQuery(c: Context): ExportQuery {
  const parsed = exportQuerySchema.safeParse(
    collectQuery(c, ['account_id', 'desde', 'hasta', 'tipo', 'category_id', 'format']),
  );
  if (!parsed.success || parsed.data.desde > parsed.data.hasta) throw invalidRequest();
  const { account_id, desde, hasta, tipo, category_id, format } = parsed.data;
  return {
    accountId: account_id,
    desde,
    hasta,
    format: format ?? 'csv',
    ...(tipo ? { tipo } : {}),
    ...(category_id ? { categoryId: category_id } : {}),
  };
}
