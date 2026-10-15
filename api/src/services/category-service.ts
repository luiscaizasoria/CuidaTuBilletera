import { findAccount } from '../db/account-repository';
import {
  countCategories,
  deleteCategory,
  findCategory,
  insertCategory,
  listCategories,
  listCategoryNames,
  updateCategory,
  type CategoryListOptions,
  type CategoryPatch,
  type CategoryRow,
} from '../db/category-repository';
import { ApiError, resourceNotFound } from '../lib/errors';
import { MAX_CATEGORIES_PER_ACCOUNT } from '../lib/limits';
import type { PageDto } from './account-service';
import { resolveResourceDeps, type ResourceDeps } from './resource-deps';

export interface CategoryDto {
  id: string;
  accountId: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'ingreso' | 'egreso';
  icono: string;
  color: string;
  archivada: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    accountId: row.account_id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    tipo: row.tipo,
    icono: row.icono,
    color: row.color,
    archivada: row.archivada === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const accountArchived = () => new ApiError(409, 'ACCOUNT_ARCHIVED', 'La cuenta está archivada.');
const categoryInUse = () =>
  new ApiError(
    409,
    'CATEGORY_IN_USE',
    'La categoría tiene movimientos asociados; puede archivarse.',
  );
const nameTaken = () =>
  new ApiError(409, 'CATEGORY_NAME_TAKEN', 'Ya existe una categoría con ese nombre y tipo.');

// Comparación de nombres de la API: el índice NOCASE de D1 solo ignora mayúsculas ASCII.
const normalizeName = (nombre: string) => nombre.trim().toLocaleLowerCase('es');

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

async function assertNameAvailable(
  db: D1Database,
  userId: string,
  accountId: string,
  tipo: 'ingreso' | 'egreso',
  nombre: string,
  exceptId?: string,
): Promise<void> {
  const wanted = normalizeName(nombre);
  const names = await listCategoryNames(db, userId, accountId, tipo);
  if (names.some((row) => row.id !== exceptId && normalizeName(row.nombre) === wanted)) {
    throw nameTaken();
  }
}

export async function listAccountCategories(
  db: D1Database,
  userId: string,
  accountId: string,
  options: CategoryListOptions,
): Promise<PageDto<CategoryDto>> {
  if (!(await findAccount(db, userId, accountId))) throw resourceNotFound();
  const { items, total } = await listCategories(db, userId, accountId, options);
  return {
    items: items.map(toCategoryDto),
    page: options.page,
    pageSize: options.pageSize,
    total,
  };
}

export interface CreateCategoryInput {
  nombre: string;
  descripcion: string | null;
  tipo: 'ingreso' | 'egreso';
  icono: string;
  color: string;
}

// Orden de los conflictos: cuenta archivada, nombre repetido y límite de categorías.
export async function createCategory(
  db: D1Database,
  userId: string,
  accountId: string,
  input: CreateCategoryInput,
  overrides?: Partial<ResourceDeps>,
): Promise<CategoryDto> {
  const deps = resolveResourceDeps(overrides);
  const account = await findAccount(db, userId, accountId);
  if (!account) throw resourceNotFound();
  if (account.archivada === 1) throw accountArchived();
  await assertNameAvailable(db, userId, accountId, input.tipo, input.nombre);
  if ((await countCategories(db, userId, accountId)) >= MAX_CATEGORIES_PER_ACCOUNT) {
    throw new ApiError(409, 'LIMIT_REACHED', 'Se alcanzó el máximo de categorías de la cuenta.');
  }
  const id = deps.idGenerator();
  try {
    const inserted = await insertCategory(db, {
      id,
      accountId,
      userId,
      now: deps.now(),
      ...input,
    });
    if (!inserted) throw resourceNotFound();
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken(); // Carrera con otra solicitud.
    throw error;
  }
  const created = await findCategory(db, userId, id);
  if (!created) throw new Error('createCategory: la categoría no existe tras insertarla');
  return toCategoryDto(created);
}

export async function updateUserCategory(
  db: D1Database,
  userId: string,
  id: string,
  patch: CategoryPatch,
  overrides?: Partial<ResourceDeps>,
): Promise<CategoryDto> {
  const deps = resolveResourceDeps(overrides);
  const current = await findCategory(db, userId, id);
  if (!current) throw resourceNotFound();
  if (patch.archivada === false && current.account_archivada === 1) throw accountArchived();
  if (patch.nombre !== undefined) {
    await assertNameAvailable(db, userId, current.account_id, current.tipo, patch.nombre, id);
  }
  try {
    const updated = await updateCategory(db, userId, id, patch, deps.now());
    if (!updated) throw resourceNotFound();
    return toCategoryDto(updated);
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
}

// No es idempotente: borrar una categoría ya borrada responde 404.
export async function deleteUserCategory(
  db: D1Database,
  userId: string,
  id: string,
  overrides?: Partial<ResourceDeps>,
): Promise<void> {
  const deps = resolveResourceDeps(overrides);
  if (!(await findCategory(db, userId, id))) throw resourceNotFound();
  if (await deps.categoryHasTransactions(db, id)) throw categoryInUse();
  try {
    if (!(await deleteCategory(db, userId, id))) throw resourceNotFound();
  } catch (error) {
    // Carrera: un movimiento se creó entre la comprobación y el DELETE (FK RESTRICT).
    if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
      throw categoryInUse();
    }
    throw error;
  }
}
