import { findAccount } from '../db/account-repository';
import { findCategory } from '../db/category-repository';
import {
  listTransactionsForExport,
  type ExportRow,
  type TransactionFilters,
} from '../db/transaction-repository';
import { ApiError, resourceNotFound } from '../lib/errors';
import { buildCsv, formatCents, textField } from '../lib/csv';
import { buildExportPdf } from '../lib/pdf';

// Tope de filas por exportación (Decisión 5.2): si se supera se rechaza, nunca se trunca.
export const MAX_EXPORT_ROWS = 2000;

const HEADER = ['fecha', 'tipo', 'categoria', 'nota', 'monto', 'monto_centavos'] as const;

interface ExportData {
  accountName: string;
  categoryName?: string;
  rows: ExportRow[];
}

// Lectura común de CSV y PDF. 404 si la cuenta (o la categoría filtrada) no existe o es ajena;
// las cuentas archivadas se pueden exportar. Si hay más de MAX_EXPORT_ROWS se rechaza.
async function loadExportRows(
  db: D1Database,
  userId: string,
  filters: TransactionFilters,
): Promise<ExportData> {
  const account = await findAccount(db, userId, filters.accountId);
  if (!account) throw resourceNotFound();
  let categoryName: string | undefined;
  if (filters.categoryId !== undefined) {
    const category = await findCategory(db, userId, filters.categoryId);
    if (!category || category.account_id !== filters.accountId) throw resourceNotFound();
    categoryName = category.nombre;
  }
  const rows = await listTransactionsForExport(db, userId, filters, MAX_EXPORT_ROWS + 1);
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new ApiError(
      400,
      'EXPORT_TOO_LARGE',
      `El rango tiene más de ${MAX_EXPORT_ROWS} movimientos; elige un período más corto.`,
    );
  }
  return {
    accountName: account.nombre,
    ...(categoryName !== undefined ? { categoryName } : {}),
    rows,
  };
}

// CSV de los movimientos vigentes de una cuenta del usuario.
export async function exportTransactionsCsv(
  db: D1Database,
  userId: string,
  filters: TransactionFilters,
): Promise<string> {
  const { rows } = await loadExportRows(db, userId, filters);
  return buildCsv(
    HEADER,
    rows.map((row) => [
      row.fecha,
      row.tipo,
      textField(row.categoria),
      textField(row.nota),
      formatCents(row.monto),
      String(row.monto),
    ]),
  );
}

export type PdfExportFilters = TransactionFilters & { desde: string; hasta: string };

// PDF de los mismos movimientos (mismo tope, filtros y orden que el CSV).
export async function exportTransactionsPdf(
  db: D1Database,
  userId: string,
  filters: PdfExportFilters,
): Promise<Uint8Array> {
  const { accountName, categoryName, rows } = await loadExportRows(db, userId, filters);
  return buildExportPdf({
    accountName,
    desde: filters.desde,
    hasta: filters.hasta,
    ...(filters.tipo ? { tipo: filters.tipo } : {}),
    ...(categoryName !== undefined ? { categoryName } : {}),
    rows,
  });
}
