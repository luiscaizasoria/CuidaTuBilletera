import {
  WEEK_START,
  addDays,
  buildMonthGrid,
  calendarCellWidth,
  dateKey,
  dayGroupTitle,
  dayOfWeek,
  daysInMonth,
  defaultDay,
  initialMonthFor,
  isLeapYear,
  monthKey,
  monthTitle,
  monthTotals,
  parseDateKey,
  parseMonthKey,
  safeSumCents,
  shiftMonth,
  weekRange,
  weekdayHeaders,
} from './calendar';
import { sizes } from '../theme/tokens';

describe('isLeapYear y daysInMonth', () => {
  it.each([
    [1900, false],
    [2000, true],
    [2024, true],
    [2026, false],
    [2100, false],
  ])('isLeapYear(%i) = %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('meses de 28, 29, 30 y 31 días', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('dayOfWeek', () => {
  it.each([
    [2000, 1, 1, 6], // sábado
    [2024, 2, 29, 4], // jueves
    [2026, 10, 1, 4], // jueves
    [2100, 1, 1, 5], // viernes
    [2100, 12, 31, 5], // viernes
  ])('%i-%i-%i -> %i', (y, m, d, expected) => {
    expect(dayOfWeek(y, m, d)).toBe(expected);
  });

  it('coincide con Date.UTC en cada día de 2000 a 2100', () => {
    let checked = 0;
    for (let year = 2000; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const days = daysInMonth(year, month);
        // El número de días también se contrasta con Date.UTC (día 0 del mes siguiente).
        expect(new Date(Date.UTC(year, month, 0)).getUTCDate()).toBe(days);
        for (let day = 1; day <= days; day += 1) {
          const expected = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
          if (dayOfWeek(year, month, day) !== expected) {
            throw new Error(`dayOfWeek distinto en ${year}-${month}-${day}`);
          }
          checked += 1;
        }
      }
    }
    expect(checked).toBe(36890);
  });
});

describe('buildMonthGrid', () => {
  it('la semana empieza en lunes', () => {
    expect(WEEK_START).toBe(1);
    expect(weekdayHeaders().map((h) => h.short)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(weekdayHeaders()[0]!.long).toBe('lunes');
    expect(weekdayHeaders()[6]!.long).toBe('domingo');
  });

  it('febrero de 28 días que empieza en lunes ocupa 4 filas', () => {
    // 2027-02-01 es lunes.
    expect(dayOfWeek(2027, 2, 1)).toBe(1);
    const grid = buildMonthGrid(2027, 2);
    expect(grid).toHaveLength(4);
    expect(grid[0]![0]).toBe(1);
    expect(grid[3]![6]).toBe(28);
  });

  it('un mes de 31 días que empieza en domingo ocupa 6 filas', () => {
    // 2026-03-01 es domingo.
    expect(dayOfWeek(2026, 3, 1)).toBe(0);
    const grid = buildMonthGrid(2026, 3);
    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(grid[5]![0]).toBe(30);
    expect(grid[5]![1]).toBe(31);
  });

  it('octubre 2026 empieza en jueves (3 huecos) y cada semana tiene 7 posiciones', () => {
    const grid = buildMonthGrid(2026, 10);
    expect(grid[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it('contiene cada día del mes exactamente una vez y en orden, con 4 a 6 filas', () => {
    for (let year = 2000; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const grid = buildMonthGrid(year, month);
        const days = grid.flat().filter((d): d is number => d !== null);
        expect(days).toEqual(Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1));
        expect(grid.length).toBeGreaterThanOrEqual(4);
        expect(grid.length).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('claves y navegación', () => {
  it('monthKey y dateKey rellenan con ceros', () => {
    expect(monthKey(2026, 3)).toBe('2026-03');
    expect(monthKey(2000, 12)).toBe('2000-12');
    expect(dateKey(2026, 3, 5)).toBe('2026-03-05');
    expect(dateKey(2100, 12, 31)).toBe('2100-12-31');
  });

  it('monthTitle usa el nombre en español', () => {
    expect(monthTitle(2026, 10)).toBe('Octubre 2026');
  });

  it('shiftMonth cruza diciembre y enero', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 10, 1)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth(2026, 10, -1)).toEqual({ year: 2026, month: 9 });
    expect(shiftMonth(2026, 10, 0)).toEqual({ year: 2026, month: 10 });
  });

  it('shiftMonth devuelve null fuera de 2000-01 a 2100-12', () => {
    expect(shiftMonth(2000, 1, -1)).toBeNull();
    expect(shiftMonth(2100, 12, 1)).toBeNull();
    expect(shiftMonth(2000, 1, 1)).toEqual({ year: 2000, month: 2 });
    expect(shiftMonth(2100, 12, -1)).toEqual({ year: 2100, month: 11 });
    expect(shiftMonth(2000, 2, -1)).toEqual({ year: 2000, month: 1 });
    expect(shiftMonth(2100, 11, 1)).toEqual({ year: 2100, month: 12 });
  });

  it('parseMonthKey y parseDateKey validan formato y rango', () => {
    expect(parseMonthKey('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseMonthKey('2000-01')).toEqual({ year: 2000, month: 1 });
    expect(parseMonthKey('2100-12')).toEqual({ year: 2100, month: 12 });
    for (const bad of ['1999-12', '2101-01', '2026-13', '2026-00', '2026-1', '2026-10-01', '']) {
      expect(parseMonthKey(bad)).toBeNull();
    }
    expect(parseDateKey('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDateKey('2026-02-29')).toBeNull();
    expect(parseDateKey('2026-10-00')).toBeNull();
    expect(parseDateKey('2026-10')).toBeNull();
  });

  it('el mes inicial se ajusta a 2000-2100 y el día por defecto es hoy o el día 1', () => {
    expect(initialMonthFor('2026-10-15')).toEqual({ year: 2026, month: 10 });
    expect(initialMonthFor('1990-05-01')).toEqual({ year: 2000, month: 1 });
    expect(initialMonthFor('2150-05-01')).toEqual({ year: 2100, month: 12 });
    expect(initialMonthFor('basura')).toEqual({ year: 2000, month: 1 });
    expect(defaultDay(2026, 10, '2026-10-15')).toBe('2026-10-15');
    expect(defaultDay(2026, 11, '2026-10-15')).toBe('2026-11-01');
    expect(defaultDay(2025, 10, '2026-10-15')).toBe('2025-10-01');
  });
});

describe('independencia de la zona horaria', () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  const snapshot = () => ({
    dow: [dayOfWeek(2000, 1, 1), dayOfWeek(2024, 2, 29), dayOfWeek(2100, 12, 31)],
    grid: buildMonthGrid(2026, 10),
    shift: shiftMonth(2026, 12, 1),
    key: dateKey(2026, 2, 3),
  });

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Guayaquil'])(
    'el resultado no cambia con TZ=%s',
    (tz) => {
      const base = snapshot();
      process.env.TZ = tz;
      expect(snapshot()).toEqual(base);
    },
  );
});

describe('safeSumCents y monthTotals', () => {
  it('suma enteros seguros y devuelve 0 para una lista vacía', () => {
    expect(safeSumCents([])).toBe(0);
    expect(safeSumCents([100, 250, 5])).toBe(355);
  });

  it('devuelve null si un sumando no es entero seguro', () => {
    expect(safeSumCents([1, 1.5])).toBeNull();
    expect(safeSumCents([1, Number.NaN])).toBeNull();
    expect(safeSumCents([1, Infinity])).toBeNull();
    expect(safeSumCents([1, Number.MAX_SAFE_INTEGER + 1])).toBeNull();
  });

  it('devuelve null si el total desborda el rango seguro', () => {
    expect(safeSumCents([Number.MAX_SAFE_INTEGER, 1])).toBeNull();
    expect(safeSumCents([Number.MAX_SAFE_INTEGER, 0])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('monthTotals calcula ingresos, gastos y neto', () => {
    expect(
      monthTotals([
        { ingresos: 1000, gastos: 200 },
        { ingresos: 0, gastos: 300 },
      ]),
    ).toEqual({ ingresos: 1000, gastos: 500, neto: 500 });
  });

  it('monthTotals propaga null al neto cuando falla un total', () => {
    const big = Number.MAX_SAFE_INTEGER;
    expect(
      monthTotals([
        { ingresos: big, gastos: 1 },
        { ingresos: 1, gastos: 1 },
      ]),
    ).toEqual({ ingresos: null, gastos: 2, neto: null });
  });
});

describe('addDays', () => {
  it.each([
    ['2026-10-16', 1, '2026-10-17'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2026-10-16', 0, '2026-10-16'],
    ['2026-10-16', 40, '2026-11-25'],
  ])('addDays(%s, %i) = %s', (key, delta, expected) => {
    expect(addDays(key, delta)).toBe(expected);
  });

  it('fuera de 2000-2100 o fecha inválida devuelve null', () => {
    expect(addDays('2000-01-01', -1)).toBeNull();
    expect(addDays('2100-12-31', 1)).toBeNull();
    expect(addDays('2026-02-30', 1)).toBeNull();
    expect(addDays('2026-10-16', 1.5)).toBeNull();
  });
});

describe('weekRange (lunes a domingo)', () => {
  it.each([
    ['2026-10-16', '2026-10-12', '2026-10-18'], // viernes
    ['2026-10-12', '2026-10-12', '2026-10-18'], // lunes
    ['2026-10-18', '2026-10-12', '2026-10-18'], // domingo
    ['2026-11-01', '2026-10-26', '2026-11-01'], // cruza de mes
    ['2026-12-31', '2026-12-28', '2027-01-03'], // cruza de año
    ['2024-03-01', '2024-02-26', '2024-03-03'], // bisiesto
  ])('weekRange(%s) = %s..%s', (key, desde, hasta) => {
    expect(weekRange(key)).toEqual({ desde, hasta });
  });

  it('fecha inválida o semana fuera de rango devuelve null', () => {
    expect(weekRange('hoy')).toBeNull();
    expect(weekRange('2000-01-01')).toBeNull(); // sábado: el lunes cae en 1999
  });
});

describe('calendarCellWidth (R4, P-3)', () => {
  it('360 dp da ≈ 44,3 dp y 412 dp da 48 dp o más', () => {
    expect(calendarCellWidth(360)).toBeCloseTo(44.3, 1);
    expect(calendarCellWidth(360)).toBeGreaterThanOrEqual(44);
    expect(calendarCellWidth(412)).toBeGreaterThanOrEqual(48);
    expect(sizes.calendarCellHeight).toBe(52);
  });

  it('usa el margen responsive: 16 dp bajo 400 dp y 20 dp desde 400 dp (R4 D6)', () => {
    expect(calendarCellWidth(360)).toBeCloseTo((360 - 32 - 18) / 7, 1);
    expect(calendarCellWidth(399)).toBeCloseTo((399 - 32 - 18) / 7, 1);
    expect(calendarCellWidth(400)).toBeCloseTo((400 - 40 - 18) / 7, 1);
    expect(calendarCellWidth(412)).toBeCloseTo(50.57, 1);
    expect(calendarCellWidth(412)).toBeGreaterThanOrEqual(48);
  });

  it('las siete celdas con sus separaciones nunca exceden el ancho disponible', () => {
    for (const width of [320, 360, 385, 400, 412, 480]) {
      const used = 7 * calendarCellWidth(width) + 6 * 3 + 2 * (width >= 400 ? 20 : 16);
      expect(used).toBeLessThanOrEqual(width);
    }
  });

  it('un ancho inválido no produce valores negativos', () => {
    expect(calendarCellWidth(0)).toBe(0);
  });
});

describe('dayGroupTitle (R4)', () => {
  it('Hoy, Ayer y fecha larga con día de la semana', () => {
    expect(dayGroupTitle('2026-10-15', '2026-10-15')).toBe('Hoy');
    expect(dayGroupTitle('2026-10-14', '2026-10-15')).toBe('Ayer');
    expect(dayGroupTitle('2026-10-14', '2026-10-16')).toBe('Miércoles 14 de octubre');
    expect(dayGroupTitle('2026-11-01', '2026-11-02')).toBe('Ayer');
  });

  it('agrega el año si no es el actual y usa addDays para cruzar de mes y año', () => {
    expect(dayGroupTitle('2025-12-31', '2026-01-01')).toBe('Ayer');
    expect(dayGroupTitle('2025-10-14', '2026-10-16')).toBe('Martes 14 de octubre de 2025');
    expect(dayGroupTitle('2000-01-01', '2026-10-16')).toBe('Sábado 1 de enero de 2000');
    expect(dayGroupTitle('2100-12-31', '2026-10-16')).toBe('Viernes 31 de diciembre de 2100');
  });

  it('una fecha inválida se devuelve tal cual', () => {
    expect(dayGroupTitle('hoy', '2026-10-16')).toBe('hoy');
  });
});
