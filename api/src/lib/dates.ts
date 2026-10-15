import { TRANSACTION_MAX_DATE, TRANSACTION_MIN_DATE } from './limits';

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de calendario AAAA-MM-DD real (2025-02-30 no existe; 2024-02-29 sí) dentro del rango
// admitido para movimientos (2000-01-01 a 2100-12-31). Misma regla que el CHECK de la base.
export function isValidTransactionDate(value: string): boolean {
  if (!DATE_SHAPE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC interpreta años 0-99 como 1900-1999: el round-trip y el rango lo descartan.
  const roundTrip =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrip && value >= TRANSACTION_MIN_DATE && value <= TRANSACTION_MAX_DATE;
}
