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
