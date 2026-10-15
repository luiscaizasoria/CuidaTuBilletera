// Montos monetarios: enteros en centavos (docs/001). Sin aritmética de coma flotante.
const AMOUNT_PATTERN = /^(-?)(\d{1,15})(?:[.,](\d{1,2}))?$/;

// Convierte lo escrito por el usuario a centavos. Devuelve null si el texto no es un monto válido.
// Acepta punto o coma decimal, signo negativo y hasta 2 decimales; rechaza separadores de miles,
// exceso de decimales, espacios internos, notación científica y valores fuera del rango seguro.
export function parseCentsFromInput(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match as unknown as [string, string, string, string?];
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return sign === '-' && cents !== 0 ? -cents : cents;
}

// 1250 -> "$12.50"; -1250 -> "-$12.50". Un valor no entero o no seguro se muestra como "$0.00".
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) return '$0.00';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${whole}.${fraction}`;
}

// Importe compacto para celdas del calendario: trunca, nunca redondea.
// Ejemplos: 4550 -> "45", 120000 -> "1.2k", 99999900 -> "999k", 0 -> "0", 50 -> "<1".
// Un valor negativo o no seguro se muestra como "—".
export function formatCompactCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) return '—';
  const dollars = Math.floor(cents / 100);
  if (cents > 0 && dollars === 0) return '<1';
  if (dollars < 1000) return String(dollars);
  const scale = (divisor: number, suffix: string) => {
    const tenths = Math.floor(dollars / (divisor / 10));
    const rest = tenths % 10;
    return `${Math.floor(tenths / 10)}${rest === 0 ? '' : `.${rest}`}${suffix}`;
  };
  if (dollars < 1_000_000) return scale(1000, 'k');
  if (dollars < 1_000_000_000) return scale(1_000_000, 'M');
  return scale(1_000_000_000, 'B');
}
