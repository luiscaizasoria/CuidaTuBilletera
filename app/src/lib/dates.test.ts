import {
  formatDateEs,
  isValidDateString,
  toLocalDateString,
  todayLocal,
  yesterdayLocal,
} from './dates';

describe('isValidDateString', () => {
  it.each(['2000-01-01', '2100-12-31', '2024-02-29', '2026-10-15'])('acepta %s', (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each([
    '1999-12-31',
    '2101-01-01',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-1-05',
    '26-10-15',
    '2026/10/15',
    '2026-10-15T00:00:00Z',
    ' 2026-10-15',
    '',
    'hoy',
  ])('rechaza %j', (value) => {
    expect(isValidDateString(value)).toBe(false);
  });
});

describe('fechas locales', () => {
  it('toLocalDateString usa los componentes locales, no UTC', () => {
    // 23:30 local del 15 de octubre: en UTC podría ser otro día, la fecha local sigue siendo el 15.
    expect(toLocalDateString(new Date(2026, 9, 15, 23, 30))).toBe('2026-10-15');
    expect(toLocalDateString(new Date(2026, 9, 15, 0, 5))).toBe('2026-10-15');
  });

  it('todayLocal y yesterdayLocal', () => {
    const now = new Date(2026, 9, 15, 23, 59);
    expect(todayLocal(now)).toBe('2026-10-15');
    expect(yesterdayLocal(now)).toBe('2026-10-14');
  });

  it('ayer cruza mes y año', () => {
    expect(yesterdayLocal(new Date(2026, 2, 1, 10))).toBe('2026-02-28');
    expect(yesterdayLocal(new Date(2024, 2, 1, 10))).toBe('2024-02-29');
    expect(yesterdayLocal(new Date(2026, 0, 1, 10))).toBe('2025-12-31');
  });

  it('no usa toISOString', () => {
    const spy = jest.spyOn(Date.prototype, 'toISOString');
    todayLocal(new Date(2026, 9, 15));
    yesterdayLocal(new Date(2026, 9, 15));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('las funciones sin argumento devuelven fechas válidas', () => {
    expect(isValidDateString(todayLocal())).toBe(true);
    expect(isValidDateString(yesterdayLocal())).toBe(true);
  });
});

describe('formatDateEs', () => {
  it('formatea DD/MM/AAAA y deja intacto lo inválido', () => {
    expect(formatDateEs('2026-10-05')).toBe('05/10/2026');
    expect(formatDateEs('basura')).toBe('basura');
  });
});
