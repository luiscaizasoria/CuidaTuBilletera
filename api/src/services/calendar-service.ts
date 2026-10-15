import { findAccount } from '../db/account-repository';
import { dailyTotals, type DailyTotalsRow } from '../db/transaction-repository';
import { resourceNotFound } from '../lib/errors';

export interface CalendarDayDto {
  fecha: string;
  ingresos: number;
  gastos: number;
  cantidad: number;
}

export interface CalendarDto {
  accountId: string;
  month: string;
  days: CalendarDayDto[];
}

// Fail-closed como el saldo (Decisión 3.1, D6): si algún total sale del rango entero seguro de
// JavaScript se lanza un error genérico (500) en lugar de devolver cifras imprecisas.
export function toCalendarDays(rows: DailyTotalsRow[]): CalendarDayDto[] {
  return rows.map((row) => {
    if (
      !Number.isSafeInteger(row.ingresos) ||
      !Number.isSafeInteger(row.gastos) ||
      !Number.isSafeInteger(row.cantidad)
    ) {
      throw new Error('toCalendarDays: total fuera del rango entero seguro');
    }
    return {
      fecha: row.fecha,
      ingresos: row.ingresos,
      gastos: row.gastos,
      cantidad: row.cantidad,
    };
  });
}

// Totales por día de un mes. Cuenta ajena o inexistente: 404. Las cuentas archivadas se leen.
export async function getCalendarMonth(
  db: D1Database,
  userId: string,
  accountId: string,
  month: string,
): Promise<CalendarDto> {
  if (!(await findAccount(db, userId, accountId))) throw resourceNotFound();
  const rows = await dailyTotals(db, userId, accountId, month);
  return { accountId, month, days: toCalendarDays(rows) };
}
