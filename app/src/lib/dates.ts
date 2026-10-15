// Fechas de movimientos: texto AAAA-MM-DD (docs/003, Decisión 3.1). Se trabaja siempre con la fecha
// LOCAL del dispositivo; nunca se usa toISOString porque convierte a UTC y puede cambiar el día.
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Misma regla que la API: formato estricto, día real del calendario y año entre 2000 y 2100.
export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

// Fecha local del dispositivo como AAAA-MM-DD.
export function toLocalDateString(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return toLocalDateString(now);
}

export function yesterdayLocal(now: Date = new Date()): string {
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

// "2026-10-15" -> "15/10/2026". Un texto que no es fecha válida se devuelve tal cual.
export function formatDateEs(value: string): string {
  if (!isValidDateString(value)) return value;
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}
