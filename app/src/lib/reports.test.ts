import {
  formatPercent,
  initialReportsView,
  maxCents,
  monthRange,
  monthSpan,
  percentTenths,
  periodGroupFor,
  periodLabel,
  scaleUnits,
  shiftYear,
  validateRange,
  viewRange,
  yearRange,
} from './reports';

describe('reports: rangos', () => {
  it('vista inicial: mes de la fecha local, ajustado a 2000-2100', () => {
    expect(initialReportsView('2026-10-15')).toMatchObject({
      mode: 'month',
      year: 2026,
      month: 10,
    });
    expect(initialReportsView('1990-05-01')).toMatchObject({ year: 2000, month: 1 });
  });

  it('mes y año: primer y último día, incluido febrero bisiesto', () => {
    expect(monthRange(2026, 10)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(monthRange(2024, 2)).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
    expect(monthRange(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(yearRange(2026)).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
  });

  it('viewRange según el modo y rango inválido -> null', () => {
    const base = initialReportsView('2026-10-15');
    expect(viewRange(base)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(viewRange({ ...base, mode: 'year' })).toEqual(yearRange(2026));
    expect(viewRange({ ...base, mode: 'range', desde: '2026-02-01', hasta: '2026-03-05' })).toEqual(
      {
        desde: '2026-02-01',
        hasta: '2026-03-05',
      },
    );
    expect(viewRange({ ...base, mode: 'range' })).toBeNull();
  });

  it('shiftYear respeta 2000-2100', () => {
    expect(shiftYear(2026, 1)).toBe(2027);
    expect(shiftYear(2000, -1)).toBeNull();
    expect(shiftYear(2100, 1)).toBeNull();
  });

  it('validateRange: ambas fechas obligatorias, válidas y en orden', () => {
    expect(validateRange(' 2026-01-01 ', '2026-01-01').range).toEqual({
      desde: '2026-01-01',
      hasta: '2026-01-01',
    });
    expect(validateRange('', '2026-01-01').error).toMatch(/AAAA-MM-DD/);
    expect(validateRange('2026-01-01', '').error).toMatch(/AAAA-MM-DD/);
    expect(validateRange('2026-02-30', '2026-03-01').error).toMatch(/AAAA-MM-DD/);
    expect(validateRange('1999-12-31', '2026-03-01').error).toMatch(/AAAA-MM-DD/);
    expect(validateRange('2026-03-02', '2026-03-01').error).toMatch(/posterior/);
  });

  it('serie: mensual salvo que el rango supere 120 meses', () => {
    expect(monthSpan({ desde: '2026-01-31', hasta: '2026-01-31' })).toBe(1);
    expect(monthSpan({ desde: '2026-01-01', hasta: '2026-12-31' })).toBe(12);
    const ten = { desde: '2000-01-01', hasta: '2009-12-31' };
    expect(monthSpan(ten)).toBe(120);
    expect(periodGroupFor('range', ten)).toBe('month');
    expect(periodGroupFor('range', { desde: '2000-01-01', hasta: '2010-01-01' })).toBe('year');
    expect(periodGroupFor('year', yearRange(2026))).toBe('month');
    expect(periodGroupFor('month', monthRange(2026, 1))).toBeNull();
  });
});

describe('reports: porcentajes y escalas exactos', () => {
  it('porcentaje con un decimal, redondeado al más cercano', () => {
    expect(formatPercent(1, 3)).toBe('33.3%');
    expect(formatPercent(2, 3)).toBe('66.7%');
    expect(formatPercent(5, 5)).toBe('100.0%');
    expect(formatPercent(0, 5)).toBe('0.0%');
    expect(percentTenths(1, 8)).toBe(125);
  });

  it('total del grupo 0 o valores no seguros: sin porcentaje', () => {
    expect(formatPercent(0, 0)).toBeNull();
    expect(formatPercent(1, -1)).toBeNull();
    expect(formatPercent(Number.MAX_SAFE_INTEGER + 2, 10)).toBeNull();
  });

  it('exacto con importes cercanos al máximo seguro (sin overflow)', () => {
    const big = Number.MAX_SAFE_INTEGER;
    expect(formatPercent(big, big)).toBe('100.0%');
    expect(formatPercent(Math.floor(big / 2), big)).toBe('50.0%');
    expect(scaleUnits(big, big, 1000)).toBe(1000);
  });

  it('scaleUnits: proporción al máximo y 0 sin máximo', () => {
    expect(scaleUnits(50, 200, 80)).toBe(20);
    expect(scaleUnits(1, 3, 100)).toBe(33);
    expect(scaleUnits(5, 0, 100)).toBe(0);
    expect(scaleUnits(0, 10, 100)).toBe(0);
  });

  it('maxCents y etiquetas de período', () => {
    expect(maxCents([])).toBe(0);
    expect(maxCents([3, 9, 4])).toBe(9);
    expect(periodLabel('2026-03')).toBe('Mar 26');
    expect(periodLabel('2026')).toBe('2026');
  });
});
