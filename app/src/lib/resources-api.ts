import { AuthError } from './auth-types';
import { isValidDateString } from './dates';
import { isUtcIsoDate, readErrorCode, request } from './session-api';

// Contrato aprobado en docs/003 (Decisión 2B.1): JSON camelCase, errores { error: { code, message } }.
export interface Account {
  id: string;
  nombre: string;
  saldoInicial: number; // centavos
  saldo: number; // centavos; calculado por la API (saldoInicial + ingresos - gastos)
  archivada: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType = 'ingreso' | 'egreso';

export interface Category {
  id: string;
  accountId: string;
  nombre: string;
  descripcion: string | null;
  tipo: CategoryType;
  icono: string;
  color: string;
  archivada: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'ingreso' | 'gasto';

// Contrato de docs/003 (Decisión 3.1). `monto` en centavos (> 0), `fecha` AAAA-MM-DD.
export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  tipo: TransactionType;
  monto: number;
  fecha: string;
  nota: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListTransactionsOptions {
  accountId: string;
  tipo?: TransactionType;
  categoryId?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId: string;
  tipo: TransactionType;
  monto: number;
  fecha: string;
  nota?: string;
}

export interface UpdateTransactionInput {
  monto?: number;
  fecha?: string;
  nota?: string | null;
}

// Contrato de docs/003 (Decisión 4.1): solo los días con movimientos vigentes, en centavos.
export interface CalendarDay {
  fecha: string;
  ingresos: number;
  gastos: number;
  cantidad: number;
}

export interface CalendarMonth {
  accountId: string;
  month: string; // AAAA-MM
  days: CalendarDay[];
}

export interface GetCalendarOptions {
  accountId: string;
  month: string;
}

// Contrato de reportes (Fase 5): totales en centavos, sin porcentajes (los calcula la app).
export interface ReportRange {
  accountId: string;
  desde: string;
  hasta: string;
}

export interface ReportSummary extends ReportRange {
  ingresos: number;
  gastos: number;
  balance: number;
  cantidad: number;
}

export interface CategoryReportItem {
  categoryId: string;
  nombre: string;
  icono: string;
  color: string;
  archivada: boolean;
  total: number;
  cantidad: number;
}

export interface CategoryReportGroup {
  total: number;
  items: CategoryReportItem[];
}

export interface CategoryReport extends ReportRange {
  ingresos: CategoryReportGroup;
  gastos: CategoryReportGroup;
}

export type ReportGroup = 'month' | 'year';

export interface PeriodPoint {
  periodo: string; // AAAA-MM o AAAA
  ingresos: number;
  gastos: number;
  balance: number;
  cantidad: number;
}

export interface PeriodReport extends ReportRange {
  group: ReportGroup;
  points: PeriodPoint[];
}

export interface GetReportOptions {
  accountId: string;
  desde: string;
  hasta: string;
}

export interface GetPeriodReportOptions extends GetReportOptions {
  group: ReportGroup;
}

// Exportación de archivos CSV o PDF (Fase 5). `tipo` y `categoryId` solo se envían si hay filtro activo.
export type ExportFormat = 'csv' | 'pdf';

export interface ExportFileOptions {
  accountId: string;
  desde: string;
  hasta: string;
  format: ExportFormat;
  tipo?: TransactionType;
  categoryId?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
  incluirArchivadas?: boolean;
}

export interface ListCategoriesOptions extends ListOptions {
  tipo?: CategoryType;
}

export interface CreateCategoryInput {
  nombre: string;
  tipo: CategoryType;
  descripcion?: string;
  icono?: string;
  color?: string;
}

export interface UpdateCategoryInput {
  nombre?: string;
  descripcion?: string | null;
  icono?: string;
  color?: string;
  archivada?: boolean;
}

// Error de negocio de la API (400, 404, 409, 413...). `code` es el error.code del cuerpo, validado
// por patrón, o 'UNKNOWN'. El message del servidor nunca se lee ni se propaga.
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiRequestError';
  }
}

export interface ResourcesApi {
  listAccounts(accessToken: string, options?: ListOptions): Promise<Page<Account>>;
  createAccount(
    accessToken: string,
    input: { nombre: string; saldoInicial?: number },
  ): Promise<{ account: Account; categories: Category[] }>;
  updateAccount(
    accessToken: string,
    id: string,
    input: { nombre?: string; archivada?: boolean },
  ): Promise<Account>;
  listCategories(
    accessToken: string,
    accountId: string,
    options?: ListCategoriesOptions,
  ): Promise<Page<Category>>;
  createCategory(
    accessToken: string,
    accountId: string,
    input: CreateCategoryInput,
  ): Promise<Category>;
  updateCategory(accessToken: string, id: string, input: UpdateCategoryInput): Promise<Category>;
  deleteCategory(accessToken: string, id: string): Promise<void>;
  listTransactions(
    accessToken: string,
    options: ListTransactionsOptions,
  ): Promise<Page<Transaction>>;
  createTransaction(accessToken: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(
    accessToken: string,
    id: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction>;
  deleteTransaction(accessToken: string, id: string): Promise<void>;
  getCalendar(accessToken: string, options: GetCalendarOptions): Promise<CalendarMonth>;
  getReportSummary(accessToken: string, options: GetReportOptions): Promise<ReportSummary>;
  getReportByCategory(accessToken: string, options: GetReportOptions): Promise<CategoryReport>;
  getReportByPeriod(accessToken: string, options: GetPeriodReportOptions): Promise<PeriodReport>;
  // Devuelve los bytes exactos del archivo (CSV con BOM o PDF). Nunca se registra ni se cachea.
  exportFile(accessToken: string, options: ExportFileOptions): Promise<Uint8Array>;
}

// 401 -> AuthError 'rejected' (authorizedCall renueva y reintenta). 429/5xx -> 'server'.
// El resto (400, 404, 409, 413...) son errores de negocio.
async function failure(response: Response): Promise<AuthError | ApiRequestError> {
  const code = await readErrorCode(response);
  if (response.status === 401) return new AuthError('rejected', 401, code);
  if (response.status === 429 || response.status >= 500) {
    return new AuthError('server', response.status, code);
  }
  return new ApiRequestError(response.status, code ?? 'UNKNOWN');
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // cuerpo inválido: se trata abajo
  }
  throw new AuthError('unknown');
}

const invalid = (): never => {
  throw new AuthError('unknown');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';

function parseAccount(value: unknown): Account {
  if (!isRecord(value)) return invalid();
  const { id, nombre, saldoInicial, saldo, archivada, createdAt, updatedAt } = value;
  if (
    !isString(id) ||
    typeof nombre !== 'string' ||
    typeof saldoInicial !== 'number' ||
    !Number.isSafeInteger(saldoInicial) ||
    typeof saldo !== 'number' ||
    !Number.isSafeInteger(saldo) ||
    typeof archivada !== 'boolean' ||
    !isUtcIsoDate(createdAt) ||
    !isUtcIsoDate(updatedAt)
  ) {
    return invalid();
  }
  return { id, nombre, saldoInicial, saldo, archivada, createdAt, updatedAt };
}

function parseCategory(value: unknown): Category {
  if (!isRecord(value)) return invalid();
  const { id, accountId, nombre, descripcion, tipo, icono, color, archivada } = value;
  const { createdAt, updatedAt } = value;
  if (
    !isString(id) ||
    !isString(accountId) ||
    typeof nombre !== 'string' ||
    !(descripcion === null || typeof descripcion === 'string') ||
    (tipo !== 'ingreso' && tipo !== 'egreso') ||
    typeof icono !== 'string' ||
    typeof color !== 'string' ||
    typeof archivada !== 'boolean' ||
    !isUtcIsoDate(createdAt) ||
    !isUtcIsoDate(updatedAt)
  ) {
    return invalid();
  }
  return {
    id,
    accountId,
    nombre,
    descripcion,
    tipo,
    icono,
    color,
    archivada,
    createdAt,
    updatedAt,
  };
}

function parseTransaction(value: unknown): Transaction {
  if (!isRecord(value)) return invalid();
  const { id, accountId, categoryId, tipo, monto, fecha, nota, createdAt, updatedAt } = value;
  if (
    !isString(id) ||
    !isString(accountId) ||
    !isString(categoryId) ||
    (tipo !== 'ingreso' && tipo !== 'gasto') ||
    typeof monto !== 'number' ||
    !Number.isSafeInteger(monto) ||
    monto <= 0 ||
    typeof fecha !== 'string' ||
    !isValidDateString(fecha) ||
    !(nota === null || typeof nota === 'string') ||
    !isUtcIsoDate(createdAt) ||
    !isUtcIsoDate(updatedAt)
  ) {
    return invalid();
  }
  return { id, accountId, categoryId, tipo, monto, fecha, nota, createdAt, updatedAt };
}

function parseCalendar(
  data: Record<string, unknown>,
  accountId: string,
  month: string,
): CalendarMonth {
  if (data.accountId !== accountId || data.month !== month || !Array.isArray(data.days)) {
    return invalid();
  }
  if (data.days.length > 31) return invalid();
  let previous = '';
  const days = data.days.map((value: unknown): CalendarDay => {
    if (!isRecord(value)) return invalid();
    const { fecha, ingresos, gastos, cantidad } = value;
    if (
      typeof fecha !== 'string' ||
      !isValidDateString(fecha) ||
      !fecha.startsWith(`${month}-`) ||
      fecha <= previous ||
      typeof ingresos !== 'number' ||
      !Number.isSafeInteger(ingresos) ||
      ingresos < 0 ||
      typeof gastos !== 'number' ||
      !Number.isSafeInteger(gastos) ||
      gastos < 0 ||
      typeof cantidad !== 'number' ||
      !Number.isSafeInteger(cantidad) ||
      cantidad < 1
    ) {
      return invalid();
    }
    previous = fecha;
    return { fecha, ingresos, gastos, cantidad };
  });
  return { accountId, month, days };
}

const isCents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Suma exacta o null si algún sumando o el total no es un entero seguro.
function exactSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

// Valida que la respuesta corresponda a la consulta hecha (cuenta y rango).
function checkRange(data: Record<string, unknown>, expected: GetReportOptions): void {
  if (
    data.accountId !== expected.accountId ||
    data.desde !== expected.desde ||
    data.hasta !== expected.hasta
  ) {
    invalid();
  }
}

function parseReportSummary(data: Record<string, unknown>, expected: GetReportOptions) {
  checkRange(data, expected);
  const { ingresos, gastos, balance, cantidad } = data;
  if (
    !isCents(ingresos) ||
    !isCents(gastos) ||
    typeof balance !== 'number' ||
    !Number.isSafeInteger(balance) ||
    exactSum([ingresos, -gastos]) !== balance ||
    !isCount(cantidad)
  ) {
    return invalid();
  }
  return { ...expected, ingresos, gastos, balance, cantidad } as ReportSummary;
}

function parseCategoryGroup(value: unknown): CategoryReportGroup {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 100) return invalid();
  const items = value.items.map((raw: unknown): CategoryReportItem => {
    if (!isRecord(raw)) return invalid();
    const { categoryId, nombre, icono, color, archivada, total, cantidad } = raw;
    if (
      !isString(categoryId) ||
      typeof nombre !== 'string' ||
      typeof icono !== 'string' ||
      typeof color !== 'string' ||
      typeof archivada !== 'boolean' ||
      !isCents(total) ||
      !isCount(cantidad)
    ) {
      return invalid();
    }
    return { categoryId, nombre, icono, color, archivada, total, cantidad };
  });
  if (!isCents(value.total) || exactSum(items.map((item) => item.total)) !== value.total) {
    return invalid();
  }
  return { total: value.total, items };
}

function parseCategoryReport(data: Record<string, unknown>, expected: GetReportOptions) {
  checkRange(data, expected);
  return {
    ...expected,
    ingresos: parseCategoryGroup(data.ingresos),
    gastos: parseCategoryGroup(data.gastos),
  } as CategoryReport;
}

function parsePeriodReport(data: Record<string, unknown>, expected: GetPeriodReportOptions) {
  checkRange(data, expected);
  if (data.group !== expected.group || !Array.isArray(data.points) || data.points.length > 120) {
    return invalid();
  }
  const pattern = expected.group === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  let previous = '';
  const points = data.points.map((raw: unknown): PeriodPoint => {
    if (!isRecord(raw)) return invalid();
    const { periodo, ingresos, gastos, balance, cantidad } = raw;
    if (
      typeof periodo !== 'string' ||
      !pattern.test(periodo) ||
      periodo <= previous ||
      !isCents(ingresos) ||
      !isCents(gastos) ||
      typeof balance !== 'number' ||
      exactSum([ingresos, -gastos]) !== balance ||
      !isCount(cantidad)
    ) {
      return invalid();
    }
    previous = periodo;
    return { periodo, ingresos, gastos, balance, cantidad };
  });
  return { ...expected, points } as PeriodReport;
}

const EXPORT_CONTENT_TYPES: Record<ExportFormat, RegExp> = {
  csv: /^text\/csv(\s*;|$)/i,
  pdf: /^application\/pdf(\s*;|$)/i,
};

// Bytes de un 2xx de /export: exige el Content-Type del formato pedido y un cuerpo no vacío.
// Se leen como bytes para conservar el BOM del CSV y no corromper el PDF.
async function readExportBytes(response: Response, format: ExportFormat): Promise<Uint8Array> {
  const contentType = response.headers?.get('content-type');
  if (typeof contentType !== 'string' || !EXPORT_CONTENT_TYPES[format].test(contentType.trim())) {
    return invalid();
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return invalid();
  }
  if (!buffer || typeof buffer.byteLength !== 'number' || buffer.byteLength === 0) return invalid();
  return new Uint8Array(buffer);
}

function parsePage<T>(data: Record<string, unknown>, parseItem: (value: unknown) => T): Page<T> {
  const { items, page, pageSize, total } = data;
  if (
    !Array.isArray(items) ||
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(pageSize) ||
    !Number.isSafeInteger(total)
  ) {
    return invalid();
  }
  return {
    items: items.map(parseItem),
    page: page as number,
    pageSize: pageSize as number,
    total: total as number,
  };
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  return `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`;
}

function reportQuery(options: GetReportOptions, group?: ReportGroup): string {
  return query({
    account_id: options.accountId,
    desde: options.desde,
    hasta: options.hasta,
    group,
  });
}

export function createResourcesApi(baseUrl: string, fetchImpl: typeof fetch = fetch): ResourcesApi {
  async function call(
    accessToken: string,
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: object,
  ): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await request(fetchImpl, `${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw await failure(response);
    return response;
  }

  const id = encodeURIComponent;

  return {
    async listAccounts(accessToken, options = {}) {
      const response = await call(
        accessToken,
        `/accounts${query({
          page: options.page,
          page_size: options.pageSize,
          incluirArchivadas: options.incluirArchivadas ? true : undefined,
        })}`,
        'GET',
      );
      return parsePage(await readJson(response), parseAccount);
    },

    async createAccount(accessToken, input) {
      const response = await call(accessToken, '/accounts', 'POST', input);
      const data = await readJson(response);
      if (!Array.isArray(data.categories)) return invalid();
      return {
        account: parseAccount(data.account),
        categories: data.categories.map(parseCategory),
      };
    },

    async updateAccount(accessToken, accountId, input) {
      const response = await call(accessToken, `/accounts/${id(accountId)}`, 'PATCH', input);
      return parseAccount((await readJson(response)).account);
    },

    async listCategories(accessToken, accountId, options = {}) {
      const response = await call(
        accessToken,
        `/accounts/${id(accountId)}/categories${query({
          tipo: options.tipo,
          incluirArchivadas: options.incluirArchivadas ? true : undefined,
          page: options.page,
          page_size: options.pageSize,
        })}`,
        'GET',
      );
      return parsePage(await readJson(response), parseCategory);
    },

    async createCategory(accessToken, accountId, input) {
      const response = await call(
        accessToken,
        `/accounts/${id(accountId)}/categories`,
        'POST',
        input,
      );
      return parseCategory((await readJson(response)).category);
    },

    async updateCategory(accessToken, categoryId, input) {
      const response = await call(accessToken, `/categories/${id(categoryId)}`, 'PATCH', input);
      return parseCategory((await readJson(response)).category);
    },

    async deleteCategory(accessToken, categoryId) {
      const response = await call(accessToken, `/categories/${id(categoryId)}`, 'DELETE');
      if (response.status !== 204) invalid();
    },

    async listTransactions(accessToken, options) {
      const response = await call(
        accessToken,
        `/transactions${query({
          account_id: options.accountId,
          tipo: options.tipo,
          category_id: options.categoryId,
          desde: options.desde,
          hasta: options.hasta,
          page: options.page,
          page_size: options.pageSize,
        })}`,
        'GET',
      );
      return parsePage(await readJson(response), parseTransaction);
    },

    // POST no es idempotente: nunca se reintenta salvo el 401 de authorizedCall.
    async createTransaction(accessToken, input) {
      const response = await call(accessToken, '/transactions', 'POST', input);
      return parseTransaction((await readJson(response)).transaction);
    },

    async updateTransaction(accessToken, transactionId, input) {
      const response = await call(
        accessToken,
        `/transactions/${id(transactionId)}`,
        'PATCH',
        input,
      );
      return parseTransaction((await readJson(response)).transaction);
    },

    async deleteTransaction(accessToken, transactionId) {
      const response = await call(accessToken, `/transactions/${id(transactionId)}`, 'DELETE');
      if (response.status !== 204) invalid();
    },

    async getCalendar(accessToken, options) {
      const response = await call(
        accessToken,
        `/calendar${query({ account_id: options.accountId, month: options.month })}`,
        'GET',
      );
      return parseCalendar(await readJson(response), options.accountId, options.month);
    },

    async getReportSummary(accessToken, options) {
      const response = await call(accessToken, `/reports/summary${reportQuery(options)}`, 'GET');
      return parseReportSummary(await readJson(response), options);
    },

    async getReportByCategory(accessToken, options) {
      const response = await call(
        accessToken,
        `/reports/by-category${reportQuery(options)}`,
        'GET',
      );
      return parseCategoryReport(await readJson(response), options);
    },

    async getReportByPeriod(accessToken, options) {
      const response = await call(
        accessToken,
        `/reports/by-period${reportQuery(options, options.group)}`,
        'GET',
      );
      return parsePeriodReport(await readJson(response), options);
    },

    async exportFile(accessToken, options) {
      const response = await call(
        accessToken,
        `/export${query({
          account_id: options.accountId,
          desde: options.desde,
          hasta: options.hasta,
          tipo: options.tipo,
          category_id: options.categoryId,
          format: options.format,
        })}`,
        'GET',
      );
      return readExportBytes(response, options.format);
    },
  };
}
