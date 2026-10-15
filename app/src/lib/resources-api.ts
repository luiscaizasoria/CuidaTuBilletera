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
  };
}
