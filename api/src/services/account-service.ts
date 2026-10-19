import {
  countAccounts,
  findAccount,
  insertAccountStatement,
  listAccounts,
  updateAccount,
  type AccountListOptions,
  type AccountPatch,
  type AccountWithTotalsRow,
} from '../db/account-repository';
import { insertCategoryStatement, listCategories } from '../db/category-repository';
import { ApiError, resourceNotFound } from '../lib/errors';
import { MAX_ACCOUNTS_PER_USER } from '../lib/limits';
import { toCategoryDto, type CategoryDto } from './category-service';
import { DEFAULT_CATEGORIES } from './default-categories';
import { resolveResourceDeps, type ResourceDeps } from './resource-deps';

export interface AccountDto {
  id: string;
  nombre: string;
  saldoInicial: number;
  // Calculado (saldoInicial + ingresos - gastos de los movimientos vigentes); nunca se guarda.
  saldo: number;
  archivada: boolean;
  // Identificadores de catálogo (D12); null = apariencia predeterminada de la app.
  color: string | null;
  icono: string | null;
  createdAt: string;
  updatedAt: string;
}

// Saldo en centavos. Fail-closed: si algún total sale del rango entero seguro de JavaScript se
// lanza un error genérico (500) en lugar de devolver cifras imprecisas (Decisión 3.1, D6).
export function computeBalance(row: AccountWithTotalsRow): {
  saldoInicial: number;
  ingresos: number;
  gastos: number;
  saldo: number;
} {
  const saldo = row.saldo_inicial + row.ingresos - row.gastos;
  if (
    !Number.isSafeInteger(row.ingresos) ||
    !Number.isSafeInteger(row.gastos) ||
    !Number.isSafeInteger(saldo)
  ) {
    throw new Error('computeBalance: total fuera del rango entero seguro');
  }
  return { saldoInicial: row.saldo_inicial, ingresos: row.ingresos, gastos: row.gastos, saldo };
}

export function toAccountDto(row: AccountWithTotalsRow): AccountDto {
  const { saldo } = computeBalance(row);
  return {
    id: row.id,
    nombre: row.nombre,
    saldoInicial: row.saldo_inicial,
    saldo,
    archivada: row.archivada === 1,
    color: row.color,
    icono: row.icono,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listUserAccounts(
  db: D1Database,
  userId: string,
  options: AccountListOptions,
): Promise<PageDto<AccountDto>> {
  const { items, total } = await listAccounts(db, userId, options);
  return {
    items: items.map(toAccountDto),
    page: options.page,
    pageSize: options.pageSize,
    total,
  };
}

// Crea la cuenta y sus categorías iniciales en un único db.batch (atómico). El límite de
// cuentas se comprueba antes; COUNT + INSERT no es atómico y se acepta (Decisión 2B.1, D6).
export async function createAccountWithDefaults(
  db: D1Database,
  userId: string,
  input: { nombre: string; saldoInicial: number; color: string | null; icono: string | null },
  overrides?: Partial<ResourceDeps>,
): Promise<{ account: AccountDto; categories: CategoryDto[] }> {
  const deps = resolveResourceDeps(overrides);
  if ((await countAccounts(db, userId)) >= MAX_ACCOUNTS_PER_USER) {
    throw new ApiError(409, 'LIMIT_REACHED', 'Se alcanzó el máximo de cuentas permitido.');
  }
  const now = deps.now();
  const accountId = deps.idGenerator();
  await db.batch([
    insertAccountStatement(db, { id: accountId, userId, now, ...input }),
    ...DEFAULT_CATEGORIES.map((category) =>
      insertCategoryStatement(db, {
        id: deps.idGenerator(),
        accountId,
        userId,
        descripcion: null,
        now,
        ...category,
      }),
    ),
  ]);
  const account = await findAccount(db, userId, accountId);
  if (!account) throw new Error('createAccountWithDefaults: la cuenta no existe tras el batch');
  const { items } = await listCategories(db, userId, accountId, {
    page: 1,
    pageSize: DEFAULT_CATEGORIES.length,
    incluirArchivadas: true,
  });
  return { account: toAccountDto(account), categories: items.map(toCategoryDto) };
}

export async function updateUserAccount(
  db: D1Database,
  userId: string,
  id: string,
  patch: AccountPatch,
  overrides?: Partial<ResourceDeps>,
): Promise<AccountDto> {
  const deps = resolveResourceDeps(overrides);
  const row = await updateAccount(db, userId, id, patch, deps.now());
  if (!row) throw resourceNotFound();
  return toAccountDto(row);
}

export interface BalanceDto {
  accountId: string;
  saldoInicial: number;
  ingresos: number;
  gastos: number;
  saldo: number;
}

export async function getAccountBalance(
  db: D1Database,
  userId: string,
  id: string,
): Promise<BalanceDto> {
  const row = await findAccount(db, userId, id);
  if (!row) throw resourceNotFound();
  return { accountId: row.id, ...computeBalance(row) };
}
