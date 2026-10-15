import {
  countAccounts,
  findAccount,
  insertAccountStatement,
  listAccounts,
  updateAccount,
  type AccountListOptions,
  type AccountPatch,
  type AccountRow,
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
  archivada: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toAccountDto(row: AccountRow): AccountDto {
  return {
    id: row.id,
    nombre: row.nombre,
    saldoInicial: row.saldo_inicial,
    archivada: row.archivada === 1,
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

// Crea la cuenta y sus 11 categorías iniciales en un único db.batch (atómico). El límite de
// cuentas se comprueba antes; COUNT + INSERT no es atómico y se acepta (Decisión 2B.1, D6).
export async function createAccountWithDefaults(
  db: D1Database,
  userId: string,
  input: { nombre: string; saldoInicial: number },
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
