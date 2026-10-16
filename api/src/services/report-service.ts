import { findAccount } from '../db/account-repository';
import {
  categoryTotals,
  periodTotals,
  summaryTotals,
  type CategoryTotalRow,
  type PeriodTotalRow,
} from '../db/report-repository';
import { resourceNotFound } from '../lib/errors';
import type { ReportGroup } from '../lib/resource-http';

export interface ReportSummaryDto {
  accountId: string;
  desde: string;
  hasta: string;
  ingresos: number;
  gastos: number;
  balance: number;
  cantidad: number;
}

export interface CategoryReportItemDto {
  categoryId: string;
  nombre: string;
  icono: string;
  color: string;
  archivada: boolean;
  total: number;
  cantidad: number;
}

export interface CategoryGroupDto {
  total: number;
  items: CategoryReportItemDto[];
}

export interface CategoryReportDto {
  accountId: string;
  desde: string;
  hasta: string;
  ingresos: CategoryGroupDto;
  gastos: CategoryGroupDto;
}

export interface PeriodPointDto {
  periodo: string;
  ingresos: number;
  gastos: number;
  balance: number;
  cantidad: number;
}

export interface PeriodReportDto {
  accountId: string;
  desde: string;
  hasta: string;
  group: ReportGroup;
  points: PeriodPointDto[];
}

// Fail-closed como el saldo y el calendario: todo total (y toda suma calculada aquí) debe ser un
// entero seguro de JavaScript; si no, se lanza un error genérico (500) sin cifras imprecisas.
function assertSafe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('report: total fuera del rango entero seguro');
  return value;
}

export function toCategoryReport(rows: CategoryTotalRow[]): {
  ingresos: CategoryGroupDto;
  gastos: CategoryGroupDto;
} {
  const groups = {
    ingreso: { total: 0, items: [] as CategoryReportItemDto[] },
    egreso: { total: 0, items: [] as CategoryReportItemDto[] },
  };
  for (const row of rows) {
    const group = groups[row.tipo];
    const total = assertSafe(row.total);
    group.items.push({
      categoryId: row.categoryId,
      nombre: row.nombre,
      icono: row.icono,
      color: row.color,
      archivada: row.archivada === 1,
      total,
      cantidad: assertSafe(row.cantidad),
    });
    group.total = assertSafe(group.total + total);
  }
  return { ingresos: groups.ingreso, gastos: groups.egreso };
}

function nextPeriod(periodo: string, group: ReportGroup): string {
  if (group === 'year') return String(Number(periodo) + 1).padStart(4, '0');
  const year = Number(periodo.slice(0, 4));
  const month = Number(periodo.slice(5, 7));
  return month === 12
    ? `${String(year + 1).padStart(4, '0')}-01`
    : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
}

// Serie continua desde el período de `desde` hasta el de `hasta`, con ceros donde no hay datos.
export function toPeriodPoints(
  rows: PeriodTotalRow[],
  desde: string,
  hasta: string,
  group: ReportGroup,
): PeriodPointDto[] {
  const length = group === 'month' ? 7 : 4;
  const byPeriod = new Map(rows.map((row) => [row.periodo, row]));
  const last = hasta.slice(0, length);
  const points: PeriodPointDto[] = [];
  for (
    let periodo = desde.slice(0, length);
    periodo <= last;
    periodo = nextPeriod(periodo, group)
  ) {
    const row = byPeriod.get(periodo);
    const ingresos = assertSafe(row?.ingresos ?? 0);
    const gastos = assertSafe(row?.gastos ?? 0);
    points.push({
      periodo,
      ingresos,
      gastos,
      balance: assertSafe(ingresos - gastos),
      cantidad: assertSafe(row?.cantidad ?? 0),
    });
  }
  return points;
}

async function requireAccount(db: D1Database, userId: string, accountId: string): Promise<void> {
  if (!(await findAccount(db, userId, accountId))) throw resourceNotFound();
}

export async function getReportSummary(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
): Promise<ReportSummaryDto> {
  await requireAccount(db, userId, accountId);
  const row = await summaryTotals(db, userId, accountId, desde, hasta);
  const ingresos = assertSafe(row.ingresos);
  const gastos = assertSafe(row.gastos);
  return {
    accountId,
    desde,
    hasta,
    ingresos,
    gastos,
    balance: assertSafe(ingresos - gastos),
    cantidad: assertSafe(row.cantidad),
  };
}

export async function getReportByCategory(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
): Promise<CategoryReportDto> {
  await requireAccount(db, userId, accountId);
  const rows = await categoryTotals(db, userId, accountId, desde, hasta);
  return { accountId, desde, hasta, ...toCategoryReport(rows) };
}

export async function getReportByPeriod(
  db: D1Database,
  userId: string,
  accountId: string,
  desde: string,
  hasta: string,
  group: ReportGroup,
): Promise<PeriodReportDto> {
  await requireAccount(db, userId, accountId);
  const rows = await periodTotals(db, userId, accountId, desde, hasta, group);
  return { accountId, desde, hasta, group, points: toPeriodPoints(rows, desde, hasta, group) };
}
