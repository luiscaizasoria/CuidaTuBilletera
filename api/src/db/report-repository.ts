// Consultas de solo lectura de reportes. Todas se acotan por cuenta Y usuario autenticado
// (accounts.user_id) y solo cuentan movimientos vigentes de tipo ingreso/gasto en el rango
// inclusivo [desde, hasta]. Usan ix_transactions_account_fecha.
const BASE_WHERE = `t.account_id = ?1 AND a.user_id = ?2 AND t.deleted_at IS NULL
          AND t.tipo IN ('ingreso', 'gasto') AND t.fecha BETWEEN ?3 AND ?4`;

export interface ReportSummaryRow {
  ingresos: number;
  gastos: number;
  cantidad: number;
}

export interface CategoryTotalRow {
  categoryId: string;
  nombre: string;
  icono: string;
  color: string;
  archivada: number;
  tipo: 'ingreso' | 'egreso';
  total: number;
  cantidad: number;
}

export interface PeriodTotalRow {
  periodo: string;
  ingresos: number;
  gastos: number;
  cantidad: number;
}

export async function summaryTotals(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
): Promise<ReportSummaryRow> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto END), 0) AS gastos,
              count(*) AS cantidad
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE ${BASE_WHERE}`,
    )
    .bind(accountId, userId, desde, hasta)
    .first<ReportSummaryRow>();
  return row ?? { ingresos: 0, gastos: 0, cantidad: 0 };
}

// Orden: total descendente, nombre y id ascendentes. Incluye categorías archivadas.
export async function categoryTotals(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
): Promise<CategoryTotalRow[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id AS categoryId, c.nombre, c.icono, c.color, c.archivada, c.tipo,
              SUM(t.monto) AS total, count(*) AS cantidad
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         JOIN categories c ON c.id = t.category_id AND c.account_id = t.account_id
        WHERE ${BASE_WHERE}
        GROUP BY c.id
        ORDER BY total DESC, c.nombre ASC, c.id ASC`,
    )
    .bind(accountId, userId, desde, hasta)
    .all<CategoryTotalRow>();
  return results;
}

export async function periodTotals(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
  group: 'month' | 'year',
): Promise<PeriodTotalRow[]> {
  const length = group === 'month' ? 7 : 4;
  const { results } = await db
    .prepare(
      `SELECT substr(t.fecha, 1, ?5) AS periodo,
              COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto END), 0) AS gastos,
              count(*) AS cantidad
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE ${BASE_WHERE}
        GROUP BY periodo ORDER BY periodo`,
    )
    .bind(accountId, userId, desde, hasta, length)
    .all<PeriodTotalRow>();
  return results;
}
