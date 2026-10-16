// Utilidades puras para generar CSV (RFC 4180). Sin acceso a datos ni HTTP.

export const CSV_BOM = '﻿';
export const CSV_EOL = '\r\n';

// Un texto que una hoja de cálculo interpretaría como fórmula se neutraliza con una comilla simple.
const FORMULA_START = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

// Entre comillas (con " duplicadas) si contiene coma, comilla, CR o LF.
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Texto libre del usuario: primero se neutraliza la fórmula y luego se escapa.
export function textField(value: string | null): string {
  return escapeCsvField(neutralizeFormula(value ?? ''));
}

// Centavos enteros a decimal con punto y dos dígitos, solo con aritmética entera.
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error('formatCents: monto no es un entero seguro no negativo');
  }
  const whole = Math.trunc(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${fraction < 10 ? '0' : ''}${fraction}`;
}

// BOM, cabecera y filas, cada línea terminada en CRLF (también la última).
export function buildCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return CSV_BOM + [header, ...rows].map((row) => row.join(',') + CSV_EOL).join('');
}
