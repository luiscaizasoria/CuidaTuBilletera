import { describe, expect, it } from 'vitest';
import {
  buildCsv,
  CSV_BOM,
  escapeCsvField,
  formatCents,
  neutralizeFormula,
  textField,
} from './csv';

describe('formatCents', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [9, '0.09'],
    [10, '0.10'],
    [99, '0.99'],
    [100, '1.00'],
    [101, '1.01'],
    [123456, '1234.56'],
    [99_999_999_999, '999999999.99'],
    [Number.MAX_SAFE_INTEGER, '90071992547409.91'],
  ])('%d centavos -> %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it.each([1.5, -1, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza %s (no es entero seguro no negativo)',
    (value) => {
      expect(() => formatCents(value)).toThrow();
    },
  );
});

describe('escapeCsvField', () => {
  it('no cambia texto simple', () => {
    expect(escapeCsvField('Comida')).toBe('Comida');
    expect(escapeCsvField('')).toBe('');
  });

  it.each([
    ['a,b', '"a,b"'],
    ['di "hola"', '"di ""hola"""'],
    ['l1\nl2', '"l1\nl2"'],
    ['l1\r\nl2', '"l1\r\nl2"'],
    ['x\ry', '"x\ry"'],
    ['"', '""""'],
  ])('escapa %j', (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });
});

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+1', '-5', '@x', '\t=1', '\r=1'])('antepone comilla a %j', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it.each(['abc', "'=1", ' =1', 'a=1', '', '5-1'])('no modifica %j', (value) => {
    expect(neutralizeFormula(value)).toBe(value);
  });
});

describe('textField', () => {
  it('null es vacío', () => {
    expect(textField(null)).toBe('');
  });

  it('neutraliza y luego escapa', () => {
    expect(textField('=SUM(A1,A2)')).toBe('"\'=SUM(A1,A2)"');
    expect(textField('\r=1')).toBe('"\'\r=1"');
    expect(textField('-5')).toBe("'-5");
  });
});

describe('buildCsv', () => {
  it('empieza con BOM y termina cada línea, incluida la última, con CRLF', () => {
    const csv = buildCsv(['a', 'b'], [['1', '2']]);
    expect(csv).toBe(`${CSV_BOM}a,b\r\n1,2\r\n`);
  });

  it('sin filas devuelve BOM y cabecera', () => {
    expect(buildCsv(['a'], [])).toBe(`${CSV_BOM}a\r\n`);
  });
});
