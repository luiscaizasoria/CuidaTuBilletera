import { findAccount } from '../db/account-repository';
import { findCategory } from '../db/category-repository';
import {
  findTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
  voidTransaction,
  type TransactionListOptions,
  type TransactionPatch,
  type TransactionRow,
  type TransactionType,
} from '../db/transaction-repository';
import { ApiError, resourceNotFound } from '../lib/errors';
import type { PageDto } from './account-service';
import { resolveResourceDeps, type ResourceDeps } from './resource-deps';

export interface TransactionDto {
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

// Nunca incluye deleted_at: ninguna respuesta devuelve movimientos anulados.
export function toTransactionDto(row: TransactionRow): TransactionDto {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    tipo: row.tipo,
    monto: row.monto,
    fecha: row.fecha,
    nota: row.nota,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId: string;
  tipo: TransactionType;
  monto: number;
  fecha: string;
  nota: string | null;
}

// Alta atómica (un único INSERT ... SELECT). Solo si no inserta se diagnostica el motivo, en este
// orden: cuenta (404), categoría (404), cuenta archivada, categoría de otra cuenta o de tipo
// incompatible, categoría archivada.
export async function createTransaction(
  db: D1Database,
  userId: string,
  input: CreateTransactionInput,
  overrides?: Partial<ResourceDeps>,
): Promise<TransactionDto> {
  const deps = resolveResourceDeps(overrides);
  const { inserted, row } = await insertTransaction(db, {
    id: deps.idGenerator(),
    userId,
    now: deps.now(),
    ...input,
  });
  if (inserted) {
    if (!row) throw new Error('createTransaction: el movimiento no existe tras insertarlo');
    return toTransactionDto(row);
  }
  throw await diagnoseRejectedInsert(db, userId, input);
}

async function diagnoseRejectedInsert(
  db: D1Database,
  userId: string,
  input: CreateTransactionInput,
): Promise<Error> {
  const account = await findAccount(db, userId, input.accountId);
  if (!account) return resourceNotFound();
  const category = await findCategory(db, userId, input.categoryId);
  if (!category) return resourceNotFound();
  if (account.archivada === 1) {
    return new ApiError(409, 'ACCOUNT_ARCHIVED', 'La cuenta está archivada.');
  }
  const expected = input.tipo === 'gasto' ? 'egreso' : 'ingreso';
  if (category.account_id !== input.accountId || category.tipo !== expected) {
    return new ApiError(
      409,
      'CATEGORY_MISMATCH',
      'La categoría no corresponde a la cuenta o al tipo del movimiento.',
    );
  }
  if (category.archivada === 1) {
    return new ApiError(409, 'CATEGORY_ARCHIVED', 'La categoría está archivada.');
  }
  // El estado cambió entre el INSERT y el diagnóstico: no hay un motivo público que informar.
  return new Error('createTransaction: alta rechazada sin motivo identificable');
}

export async function listAccountTransactions(
  db: D1Database,
  userId: string,
  options: TransactionListOptions,
): Promise<PageDto<TransactionDto>> {
  if (!(await findAccount(db, userId, options.accountId))) throw resourceNotFound();
  if (options.categoryId !== undefined) {
    const category = await findCategory(db, userId, options.categoryId);
    if (!category || category.account_id !== options.accountId) throw resourceNotFound();
  }
  const { items, total } = await listTransactions(db, userId, options);
  return {
    items: items.map(toTransactionDto),
    page: options.page,
    pageSize: options.pageSize,
    total,
  };
}

// Editar un movimiento vigente está permitido aunque su cuenta o categoría estén archivadas.
export async function updateUserTransaction(
  db: D1Database,
  userId: string,
  id: string,
  patch: TransactionPatch,
  overrides?: Partial<ResourceDeps>,
): Promise<TransactionDto> {
  const deps = resolveResourceDeps(overrides);
  const row = await updateTransaction(db, userId, id, patch, deps.now());
  if (row) return toTransactionDto(row);
  const current = await findTransaction(db, userId, id);
  if (!current) throw resourceNotFound();
  throw new ApiError(409, 'TRANSACTION_VOIDED', 'El movimiento está anulado.');
}

// Anulación lógica idempotente: 404 solo si no existe o es ajeno.
export async function voidUserTransaction(
  db: D1Database,
  userId: string,
  id: string,
  overrides?: Partial<ResourceDeps>,
): Promise<void> {
  const deps = resolveResourceDeps(overrides);
  if (!(await voidTransaction(db, userId, id, deps.now()))) throw resourceNotFound();
}
