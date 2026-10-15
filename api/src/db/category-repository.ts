// Acceso a D1 de la tabla categories. Solo persistencia: sin HTTP ni reglas de negocio.
// categories no tiene user_id: la propiedad se verifica siempre mediante accounts.user_id.

import type { Page } from './account-repository';

export interface CategoryRow {
  id: string;
  account_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'ingreso' | 'egreso';
  icono: string;
  color: string;
  archivada: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithAccountRow extends CategoryRow {
  account_archivada: number;
}

export interface CategoryListOptions {
  page: number;
  pageSize: number;
  incluirArchivadas: boolean;
  tipo?: 'ingreso' | 'egreso';
}

export interface NewCategory {
  id: string;
  accountId: string;
  userId: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'ingreso' | 'egreso';
  icono: string;
  color: string;
  now: Date;
}

const CATEGORY_COLUMNS =
  'c.id, c.account_id, c.nombre, c.descripcion, c.tipo, c.icono, c.color, c.archivada, c.created_at, c.updated_at';

// Subconsulta de propiedad: las cuentas del usuario autenticado.
const OWNED_ACCOUNTS = '(SELECT id FROM accounts WHERE user_id = ?USER)';

export async function countCategories(
  db: D1Database,
  userId: string,
  accountId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT count(*) AS n FROM categories c JOIN accounts a ON a.id = c.account_id
        WHERE c.account_id = ?1 AND a.user_id = ?2`,
    )
    .bind(accountId, userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listCategories(
  db: D1Database,
  userId: string,
  accountId: string,
  { page, pageSize, incluirArchivadas, tipo }: CategoryListOptions,
): Promise<Page<CategoryRow>> {
  const where = `c.account_id = ?1 AND a.user_id = ?2 AND (?3 = 1 OR c.archivada = 0)
          AND (?4 IS NULL OR c.tipo = ?4)`;
  const archived = incluirArchivadas ? 1 : 0;
  const [items, total] = await db.batch<CategoryRow | { n: number }>([
    db
      .prepare(
        `SELECT ${CATEGORY_COLUMNS} FROM categories c JOIN accounts a ON a.id = c.account_id
          WHERE ${where}
          ORDER BY c.tipo, c.nombre COLLATE NOCASE, c.id LIMIT ?5 OFFSET ?6`,
      )
      .bind(accountId, userId, archived, tipo ?? null, pageSize, (page - 1) * pageSize),
    db
      .prepare(
        `SELECT count(*) AS n FROM categories c JOIN accounts a ON a.id = c.account_id WHERE ${where}`,
      )
      .bind(accountId, userId, archived, tipo ?? null),
  ]);
  return {
    items: (items?.results ?? []) as CategoryRow[],
    total: (total?.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

// Categoría del usuario, con el estado de archivo de su cuenta; null si no existe o es ajena.
export async function findCategory(
  db: D1Database,
  userId: string,
  id: string,
): Promise<CategoryWithAccountRow | null> {
  return db
    .prepare(
      `SELECT ${CATEGORY_COLUMNS}, a.archivada AS account_archivada
         FROM categories c JOIN accounts a ON a.id = c.account_id
        WHERE c.id = ?1 AND a.user_id = ?2`,
    )
    .bind(id, userId)
    .first<CategoryWithAccountRow>();
}

// Id y nombre de las categorías de la cuenta y el tipo (incluidas las archivadas), para
// detectar duplicados que el índice NOCASE no ve (letras con tilde).
export async function listCategoryNames(
  db: D1Database,
  userId: string,
  accountId: string,
  tipo: 'ingreso' | 'egreso',
): Promise<{ id: string; nombre: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.nombre FROM categories c JOIN accounts a ON a.id = c.account_id
        WHERE c.account_id = ?1 AND a.user_id = ?2 AND c.tipo = ?3`,
    )
    .bind(accountId, userId, tipo)
    .all<{ id: string; nombre: string }>();
  return results;
}

// Sentencia (sin ejecutar) para componerla en un db.batch. INSERT ... SELECT desde accounts:
// solo inserta si la cuenta pertenece al usuario (0 filas afectadas en caso contrario).
export function insertCategoryStatement(db: D1Database, input: NewCategory): D1PreparedStatement {
  const at = input.now.toISOString();
  return db
    .prepare(
      `INSERT INTO categories
         (id, account_id, nombre, descripcion, tipo, icono, color, archivada, created_at, updated_at)
       SELECT ?1, a.id, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?8 FROM accounts a
        WHERE a.id = ?2 AND a.user_id = ?9`,
    )
    .bind(
      input.id,
      input.accountId,
      input.nombre,
      input.descripcion,
      input.tipo,
      input.icono,
      input.color,
      at,
      input.userId,
    );
}

export async function insertCategory(db: D1Database, input: NewCategory): Promise<boolean> {
  const result = await insertCategoryStatement(db, input).run();
  return result.meta.changes > 0;
}

export interface CategoryPatch {
  nombre?: string;
  descripcion?: string | null;
  icono?: string;
  color?: string;
  archivada?: boolean;
}

// Devuelve la categoría actualizada, o null si no existe o no pertenece al usuario.
// `tipo` no es actualizable: no existe en este contrato.
export async function updateCategory(
  db: D1Database,
  userId: string,
  id: string,
  patch: CategoryPatch,
  now: Date,
): Promise<CategoryRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = ?${values.length}`);
  };
  if (patch.nombre !== undefined) add('nombre', patch.nombre);
  if (patch.descripcion !== undefined) add('descripcion', patch.descripcion);
  if (patch.icono !== undefined) add('icono', patch.icono);
  if (patch.color !== undefined) add('color', patch.color);
  if (patch.archivada !== undefined) add('archivada', patch.archivada ? 1 : 0);
  add('updated_at', now.toISOString());
  values.push(id, userId);
  const idIndex = values.length - 1;
  const owned = OWNED_ACCOUNTS.replace('?USER', `?${idIndex + 1}`);
  const [, selected] = await db.batch<CategoryRow>([
    db
      .prepare(
        `UPDATE categories SET ${sets.join(', ')} WHERE id = ?${idIndex} AND account_id IN ${owned}`,
      )
      .bind(...values),
    db
      .prepare(
        `SELECT ${CATEGORY_COLUMNS} FROM categories c JOIN accounts a ON a.id = c.account_id
          WHERE c.id = ?1 AND a.user_id = ?2`,
      )
      .bind(id, userId),
  ]);
  return selected?.results[0] ?? null;
}

// Devuelve false si no existía o era ajena (nada se borra).
export async function deleteCategory(db: D1Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM categories WHERE id = ?1
          AND account_id IN (SELECT id FROM accounts WHERE user_id = ?2)`,
    )
    .bind(id, userId)
    .run();
  return result.meta.changes > 0;
}

// PENDIENTE DE FASE 3: la tabla transactions todavía no existe, así que ninguna categoría puede
// tener movimientos y esta función devuelve false de forma constante. Cuando exista, deberá
// consultar TODOS los movimientos de la categoría, anulados incluidos (docs/001 §5), y
// transactions.category_id llevará ON DELETE RESTRICT como respaldo en la base.
export async function categoryHasTransactions(
  db: D1Database,
  categoryId: string,
): Promise<boolean> {
  void db;
  void categoryId;
  return false;
}
