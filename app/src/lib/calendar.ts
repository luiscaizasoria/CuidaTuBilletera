// Aritmética de calendario pura (docs/003, Decisión 4.1 D3): calendario gregoriano, sin objetos de
// fecha del sistema, sin conversión a UTC y sin Intl. Así el resultado no depende de la zona horaria.
import { screenMargin } from '../theme/tokens';
import { MAX_YEAR, MIN_YEAR } from './dates';

// Primer día de la semana: 0 = domingo, 1 = lunes. Es una constante para poder revertirla.
export const WEEK_START = 1;

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

// Índice 0 = domingo.
const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export interface WeekdayHeader {
  short: string;
  long: string;
}

// Cabeceras de columna en el orden de la semana (con WEEK_START = 1: L M M J V S D).
export function weekdayHeaders(): WeekdayHeader[] {
  return Array.from({ length: 7 }, (_, i) => {
    const index = (WEEK_START + i) % 7;
    return { short: WEEKDAY_SHORT[index]!, long: WEEKDAY_LONG[index]! };
  });
}

export interface YearMonth {
  year: number;
  month: number; // 1..12
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_PER_MONTH[month - 1]!;
}

const SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

// Algoritmo de Sakamoto. 0 = domingo ... 6 = sábado.
export function dayOfWeek(year: number, month: number, day: number): number {
  const y = month < 3 ? year - 1 : year;
  const sum =
    y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + SAKAMOTO[month - 1]! + day;
  return sum % 7;
}

// Semanas de 7 posiciones: número de día o null (hueco fuera del mes). Entre 4 y 6 filas.
export function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const leading = (dayOfWeek(year, month, 1) - WEEK_START + 7) % 7;
  const total = daysInMonth(year, month);
  const rows = Math.ceil((leading + total) / 7);
  const weeks: (number | null)[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col += 1) {
      const day = row * 7 + col - leading + 1;
      week.push(day >= 1 && day <= total ? day : null);
    }
    weeks.push(week);
  }
  return weeks;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function monthKey(year: number, month: number): string {
  return `${pad(year, 4)}-${pad(month)}`;
}

export function dateKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${pad(day)}`;
}

// Mes siguiente (delta > 0) o anterior (delta < 0). null fuera de enero 2000 a diciembre 2100.
export function shiftMonth(year: number, month: number, delta: number): YearMonth | null {
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return null;
  return { year: nextYear, month: (index % 12) + 1 };
}

export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// "AAAA-MM" -> año y mes si es un mes del rango 2000-01 a 2100-12; si no, null.
export function parseMonthKey(value: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return null;
  return { year, month };
}

// "AAAA-MM-DD" -> año, mes y día si es una fecha real del rango; si no, null.
export function parseDateKey(value: string): (YearMonth & { day: number }) | null {
  const match = /^(\d{4}-\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const ym = parseMonthKey(match[1]!);
  if (!ym) return null;
  const day = Number(match[2]);
  if (day < 1 || day > daysInMonth(ym.year, ym.month)) return null;
  return { ...ym, day };
}

// Mes que se muestra al abrir: el de la fecha local indicada, ajustado al rango 2000-2100.
export function initialMonthFor(todayKey: string): YearMonth {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { year: MIN_YEAR, month: 1 };
  }
  if (year < MIN_YEAR) return { year: MIN_YEAR, month: 1 };
  if (year > MAX_YEAR) return { year: MAX_YEAR, month: 12 };
  return { year, month };
}

// Día seleccionado por defecto: hoy si pertenece al mes visible; si no, el día 1.
export function defaultDay(year: number, month: number, todayKey: string): string {
  return todayKey.startsWith(`${monthKey(year, month)}-`) && parseDateKey(todayKey) !== null
    ? todayKey
    : dateKey(year, month, 1);
}

export interface MonthTotals {
  ingresos: number | null;
  gastos: number | null;
  neto: number | null;
}

// Suma en centavos solo si cada sumando y el total son enteros seguros; si no, null (nunca una cifra inexacta).
export function safeSumCents(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) return null;
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

// Totales del mes a partir de los días devueltos por la API. null = no representable con exactitud.
export function monthTotals(days: readonly { ingresos: number; gastos: number }[]): MonthTotals {
  const ingresos = safeSumCents(days.map((d) => d.ingresos));
  const gastos = safeSumCents(days.map((d) => d.gastos));
  const neto = ingresos === null || gastos === null ? null : safeSumCents([ingresos, -gastos]);
  return { ingresos, gastos, neto };
}

// Suma `delta` días (positivo o negativo) a una fecha AAAA-MM-DD sin objetos de fecha del sistema.
// null si la fecha no es válida o el resultado sale del rango 2000-2100.
export function addDays(key: string, delta: number): string | null {
  const parsed = parseDateKey(key);
  if (!parsed || !Number.isInteger(delta)) return null;
  let { year, month, day } = parsed;
  day += delta;
  while (day < 1) {
    const prev = shiftMonth(year, month, -1);
    if (!prev) return null;
    ({ year, month } = prev);
    day += daysInMonth(year, month);
  }
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    const next = shiftMonth(year, month, 1);
    if (!next) return null;
    ({ year, month } = next);
  }
  return dateKey(year, month, day);
}

// Semana (WEEK_START = lunes, hasta el domingo) que contiene la fecha indicada. null si la fecha no
// es válida o la semana sale del rango 2000-2100.
export function weekRange(todayKey: string): { desde: string; hasta: string } | null {
  const parsed = parseDateKey(todayKey);
  if (!parsed) return null;
  const offset = (dayOfWeek(parsed.year, parsed.month, parsed.day) - WEEK_START + 7) % 7;
  const desde = addDays(todayKey, -offset);
  const hasta = addDays(todayKey, 6 - offset);
  return desde && hasta ? { desde, hasta } : null;
}

// Celdas del calendario (docs/007 §5.11 D.2, P-3): siete columnas con 3 dp de separación y el margen
// lateral responsive (16 dp, 20 dp desde 400 dp). 44,3 dp a 360 dp de ventana; 48 dp o más desde ≈ 386 dp. Solo presentación.
export const CALENDAR_CELL_GAP = 3;

export function calendarCellWidth(windowWidth: number): number {
  const raw = (windowWidth - 2 * screenMargin(windowWidth) - 6 * CALENDAR_CELL_GAP) / 7;
  // Se trunca a centésimas para que las siete celdas nunca excedan el ancho disponible.
  return Math.max(0, Math.floor(raw * 100) / 100);
}

const WEEKDAY_TITLE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Encabezado de grupo del Historial (docs/007 §5.11 C.4): «Hoy», «Ayer» o «Miércoles 14 de octubre»
// (más « de 2025» si el año no es el de hoy). Una fecha no válida se devuelve tal cual.
export function dayGroupTitle(fecha: string, todayKey: string): string {
  const parsed = parseDateKey(fecha);
  if (!parsed) return fecha;
  if (fecha === todayKey) return 'Hoy';
  if (addDays(todayKey, -1) === fecha) return 'Ayer';
  const weekday = WEEKDAY_TITLE[dayOfWeek(parsed.year, parsed.month, parsed.day)]!;
  const base = `${weekday} ${parsed.day} de ${MONTH_NAMES[parsed.month - 1]!.toLowerCase()}`;
  const todayYear = Number(todayKey.slice(0, 4));
  return parsed.year === todayYear ? base : `${base} de ${parsed.year}`;
}
