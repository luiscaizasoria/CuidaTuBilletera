// Cálculos puros de la pantalla de Reportes (docs/003, Fase 5). Todo en enteros: los porcentajes y
// las escalas usan BigInt para no perder exactitud con importes grandes en centavos.
import { MAX_YEAR, MIN_YEAR, isValidDateString } from './dates';
import { MONTH_NAMES, dateKey, daysInMonth, parseMonthKey } from './calendar';
import type { ReportGroup } from './resources-api';

export type ReportMode = 'month' | 'year' | 'range';

export interface ReportsView {
  mode: ReportMode;
  year: number;
  month: number;
  // Rango aplicado (solo modo «range»); vacío si aún no se ha elegido.
  desde: string;
  hasta: string;
}

export interface DateRange {
  desde: string;
  hasta: string;
}

// El API acepta como máximo 120 puntos mensuales; por encima se agrupa por año.
export const MAX_MONTH_POINTS = 120;

// Vista inicial: el mes de la fecha local indicada, ajustado al rango 2000-2100.
export function initialReportsView(todayKey: string): ReportsView {
  const parsed = parseMonthKey(todayKey.slice(0, 7));
  const ym = parsed ?? { year: MIN_YEAR, month: 1 };
  return { mode: 'month', year: ym.year, month: ym.month, desde: '', hasta: '' };
}

export function monthRange(year: number, month: number): DateRange {
  return {
    desde: dateKey(year, month, 1),
    hasta: dateKey(year, month, daysInMonth(year, month)),
  };
}

export function yearRange(year: number): DateRange {
  return { desde: dateKey(year, 1, 1), hasta: dateKey(year, 12, 31) };
}

// Rango consultado según el modo; null si el modo «range» no tiene un rango válido.
export function viewRange(view: ReportsView): DateRange | null {
  if (view.mode === 'month') return monthRange(view.year, view.month);
  if (view.mode === 'year') return yearRange(view.year);
  return validateRange(view.desde, view.hasta).range;
}

export function shiftYear(year: number, delta: number): number | null {
  const next = year + delta;
  return next < MIN_YEAR || next > MAX_YEAR ? null : next;
}

export const RANGE_FORMAT_ERROR =
  'Escribe fechas válidas con formato AAAA-MM-DD (años 2000 a 2100).';
export const RANGE_ORDER_ERROR = 'La fecha «Desde» no puede ser posterior a «Hasta».';

// Ambas fechas son obligatorias, válidas y en orden (la API las exige así).
export function validateRange(
  desdeText: string,
  hastaText: string,
): { range: DateRange; error: null } | { range: null; error: string } {
  const desde = desdeText.trim();
  const hasta = hastaText.trim();
  if (!isValidDateString(desde) || !isValidDateString(hasta)) {
    return { range: null, error: RANGE_FORMAT_ERROR };
  }
  if (desde > hasta) return { range: null, error: RANGE_ORDER_ERROR };
  return { range: { desde, hasta }, error: null };
}

// Cantidad de meses calendario que toca el rango (ambos extremos incluidos).
export function monthSpan({ desde, hasta }: DateRange): number {
  const months = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
  return months(hasta) - months(desde) + 1;
}

// Serie mensual salvo que el rango supere el límite de la API.
export function periodGroupFor(mode: ReportMode, range: DateRange): ReportGroup | null {
  if (mode === 'month') return null;
  if (mode === 'year') return 'month';
  return monthSpan(range) > MAX_MONTH_POINTS ? 'year' : 'month';
}

// parte/total en décimas de punto porcentual (redondeo al más cercano). null si no hay total.
export function percentTenths(part: number, whole: number): number | null {
  if (!Number.isSafeInteger(part) || !Number.isSafeInteger(whole) || part < 0 || whole <= 0) {
    return null;
  }
  const p = BigInt(part);
  const w = BigInt(whole);
  return Number((p * 2000n + w) / (2n * w));
}

// 1234 -> "123.4%".
export function formatPercent(part: number, whole: number): string | null {
  const tenths = percentTenths(part, whole);
  if (tenths === null) return null;
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
}

// value/max escalado a `units` enteras (redondeo al más cercano); 0 si no hay máximo.
export function scaleUnits(value: number, max: number, units: number): number {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(max) || value <= 0 || max <= 0) {
    return 0;
  }
  const v = BigInt(value);
  const m = BigInt(max);
  return Number((v * BigInt(units) * 2n + m) / (2n * m));
}

// Máximo exacto de una lista de importes (0 si está vacía).
export function maxCents(values: readonly number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), 0);
}

// "2026-03" -> "Mar 26"; "2026" -> "2026".
export function periodLabel(periodo: string): string {
  if (periodo.length === 4) return periodo;
  const ym = parseMonthKey(periodo);
  if (!ym) return periodo;
  return `${MONTH_NAMES[ym.month - 1]!.slice(0, 3)} ${String(ym.year).slice(2)}`;
}
