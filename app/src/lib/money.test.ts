import { formatCents, parseCentsFromInput } from './money';

describe('parseCentsFromInput', () => {
  it.each([
    ['12.50', 1250],
    ['12,50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['0', 0],
    ['0.01', 1],
    ['0,99', 99],
    ['-12.50', -1250],
    ['-0.05', -5],
    ['-0', 0],
    ['007.10', 710],
    ['  3.30  ', 330],
    ['0.10', 10],
    ['19.99', 1999],
    ['1.15', 115],
    ['4.35', 435],
    ['9007199254740.99', 900719925474099],
  ])('%s -> %d', (input, expected) => {
    expect(parseCentsFromInput(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    '-',
    '.',
    '.5',
    '5.',
    'abc',
    '12a',
    '1 2',
    '12.345',
    '12,345',
    '1,234.50',
    '1.234,50',
    '1e3',
    '+5',
    '--5',
    '12..5',
    '12.5.1',
    '0x10',
    'Infinity',
    'NaN',
    '9999999999999999',
    '99999999999999999.00',
  ])('rechaza %j', (input) => {
    expect(parseCentsFromInput(input)).toBeNull();
  });

  it('no usa coma flotante: 1.15 y 4.35 son exactos', () => {
    expect(parseCentsFromInput('1.15')).toBe(115);
    expect(parseCentsFromInput('4.35')).toBe(435);
  });
});

describe('formatCents', () => {
  it.each([
    [1250, '$12.50'],
    [0, '$0.00'],
    [5, '$0.05'],
    [100, '$1.00'],
    [-1250, '-$12.50'],
    [-5, '-$0.05'],
    [123456789, '$1234567.89'],
  ])('%d -> %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it('valores no enteros o no seguros se muestran como $0.00', () => {
    expect(formatCents(1.5)).toBe('$0.00');
    expect(formatCents(Number.NaN)).toBe('$0.00');
    expect(formatCents(Number.MAX_SAFE_INTEGER + 2)).toBe('$0.00');
  });

  it('es inverso de parseCentsFromInput', () => {
    for (const cents of [0, 1, 99, 100, 1250, -1250, 99999999]) {
      expect(parseCentsFromInput(formatCents(cents).replace('$', ''))).toBe(cents);
    }
  });
});
