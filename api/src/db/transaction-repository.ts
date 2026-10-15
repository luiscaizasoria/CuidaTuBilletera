// Acceso a D1 de la tabla transactions. Solo persistencia: sin HTTP ni reglas de negocio.
// transactions no tiene user_id: la propiedad se verifica siempre mediante accounts.user_id.
// Toda consulta, UPDATE y DELETE se acota por usuario; nunca se busca solo por id.

import type { Page } from './account-repository';

export type TransactionType = 'ingreso' | 'gasto';

export interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string;
  tipo: TransactionType;
  monto: number;
  fecha: string;
  nota: string | null;
  created_at: string;
  updated_at: string;
}

// Solo para diagnosticar (404 frente a 409): el DTO público nunca incluye la anulación.
export interface TransactionWithVoidRow extends TransactionRow {
  deleted_at: string | null;
}

export interface NewTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  tipo: TransactionType;
  monto: number;
  fecha: string;
  nota: string | null;
  now: Date;
}

export interface TransactionListOptions {
  accountId: string;
  tipo?: TransactionType;
  categoryId?: string;
  desde?: string;
  hasta?: string;
  page: number;
  pageSize: number;
}

export interface TransactionPatch {
  monto?: number;
  fecha?: string;
  nota?: string | null;
}

const COLUMNS =
  't.id, t.account_id, t.category_id, t.tipo, t.monto, t.fecha, t.nota, t.created_at, t.updated_at';

const OWNED_ACCOUNTS = '(SELECT id FROM accounts WHERE user_id = ?USER)';

const SELECT_OWNED_BY_ID = `SELECT ${COLUMNS} FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL`;

export interface InsertResult {
  // false si la condición del INSERT ... SELECT no se cumplió (nada se insertó).
  inserted: boolean;
  row: TransactionRow | null;
}

// Alta atómica: un único INSERT ... SELECT que solo inserta si la cuenta es del usuario y está
// activa, la categoría es de esa cuenta, está activa y su tipo es compatible. Se ejecuta junto
// con la lectura por id en un db.batch. Sin comprobación previa en el camino feliz.
export async function insertTransaction(
  db: D1Database,
  input: NewTransaction,
): Promise<InsertResult> {
  const at = input.now.toISOString();
  const [insert, selected] = await db.batch<TransactionRow>([
    db
      .prepare(
        `INSERT INTO transactions
           (id, account_id, category_id, tipo, monto, fecha, nota, deleted_at, created_at, updated_at)
         SELECT ?1, a.id, c.id, ?4, ?5, ?6, ?7, NULL, ?8, ?8
           FROM categories c JOIN accounts a ON a.id = c.account_id
          WHERE c.id = ?3 AND a.id = ?2 AND a.user_id = ?9
            AND a.archivada = 0 AND c.archivada = 0
            AND c.tipo = CASE ?4 WHEN 'gasto' THEN 'egreso' ELSE 'ingreso' END`,
      )
      .bind(
        input.id,
        input.accountId,
        input.categoryId,
        input.tipo,
        input.monto,
        input.fecha,
        input.nota,
        at,
        input.userId,
      ),
    db.prepare(SELECT_OWNED_BY_ID).bind(input.id, input.userId),
  ]);
  const inserted = (insert?.meta.changes ?? 0) > 0;
  return { inserted, row: inserted ? (selected?.results[0] ?? null) : null };
}

// Movimiento del usuario, anulado o no; null si no existe o es ajeno.
export async function findTransaction(
  db: D1Database,
  userId: string,
  id: string,
): Promise<TransactionWithVoidRow | null> {
  return db
    .prepare(
      `SELECT ${COLUMNS}, t.deleted_at FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.id = ?1 AND a.user_id = ?2`,
    )
    .bind(id, userId)
    .first<TransactionWithVoidRow>();
}

// Historial vigente (sin anulados) de una cuenta del usuario, del más reciente al más antiguo.
export async function listTransactions(
  db: D1Database,
  userId: string,
  { accountId, tipo, categoryId, desde, hasta, page, pageSize }: TransactionListOptions,
): Promise<Page<TransactionRow>> {
  const where = `t.account_id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL
          AND (?3 IS NULL OR t.tipo = ?3) AND (?4 IS NULL OR t.category_id = ?4)
          AND (?5 IS NULL OR t.fecha >= ?5) AND (?6 IS NULL OR t.fecha <= ?6)`;
  const filters = [
    accountId,
    userId,
    tipo ?? null,
    categoryId ?? null,
    desde ?? null,
    hasta ?? null,
  ];
  const [items, total] = await db.batch<TransactionRow | { n: number }>([
    db
      .prepare(
        `SELECT ${COLUMNS} FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE ${where}
          ORDER BY t.fecha DESC, t.created_at DESC, t.id DESC LIMIT ?7 OFFSET ?8`,
      )
      .bind(...filters, pageSize, (page - 1) * pageSize),
    db
      .prepare(
        `SELECT count(*) AS n FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE ${where}`,
      )
      .bind(...filters),
  ]);
  return {
    items: (items?.results ?? []) as TransactionRow[],
    total: (total?.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

// Devuelve el movimiento actualizado, o null si no existe, es ajeno o está anulado (el servicio
// lo distingue con findTransaction). Solo se actualizan movimientos vigentes.
export async function updateTransaction(
  db: D1Database,
  userId: string,
  id: string,
  patch: TransactionPatch,
  now: Date,
): Promise<TransactionRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = ?${values.length}`);
  };
  if (patch.monto !== undefined) add('monto', patch.monto);
  if (patch.fecha !== undefined) add('fecha', patch.fecha);
  if (patch.nota !== undefined) add('nota', patch.nota);
  add('updated_at', now.toISOString());
  values.push(id, userId);
  const idIndex = values.length - 1;
  const owned = OWNED_ACCOUNTS.replace('?USER', `?${idIndex + 1}`);
  const [update, selected] = await db.batch<TransactionRow>([
    db
      .prepare(
        `UPDATE transactions SET ${sets.join(', ')}
          WHERE id = ?${idIndex} AND deleted_at IS NULL AND account_id IN ${owned}`,
      )
      .bind(...values),
    db.prepare(SELECT_OWNED_BY_ID).bind(id, userId),
  ]);
  if ((update?.meta.changes ?? 0) === 0) return null;
  return selected?.results[0] ?? null;
}

// Anulación lógica idempotente: conserva el deleted_at original si ya estaba anulado. Devuelve
// false solo si el movimiento no existe o es ajeno.
export async function voidTransaction(
  db: D1Database,
  userId: string,
  id: string,
  now: Date,
): Promise<boolean> {
  const at = now.toISOString();
  const result = await db
    .prepare(
      `UPDATE transactions
          SET deleted_at = COALESCE(deleted_at, ?1),
              updated_at = CASE WHEN deleted_at IS NULL THEN ?1 ELSE updated_at END
        WHERE id = ?2 AND account_id IN (SELECT id FROM accounts WHERE user_id = ?3)`,
    )
    .bind(at, id, userId)
    .run();
  return result.meta.changes > 0;
}

export interface DailyTotalsRow {
  fecha: string;
  ingresos: number;
  gastos: number;
  cantidad: number;
}

// Totales por día (solo movimientos vigentes) de una cuenta del usuario en un mes AAAA-MM. Solo
// devuelve los días con movimientos, en orden ascendente. La fecha es texto AAAA-MM-DD, así que
// el rango [AAAA-MM-01, AAAA-MM-31] cubre el mes completo. Usa ix_transactions_account_fecha.
export async function dailyTotals(
  db: D1Database,
  userId: string,
  accountId: string,
  month: string,
): Promise<DailyTotalsRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.fecha,
              COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto END), 0) AS gastos,
              count(*) AS cantidad
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.account_id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL
          AND t.fecha >= ?3 AND t.fecha <= ?4
        GROUP BY t.fecha ORDER BY t.fecha`,
    )
    .bind(accountId, userId, `${month}-01`, `${month}-31`)
    .all<DailyTotalsRow>();
  return results;
}
