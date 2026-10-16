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

export type AmountRejection = 'empty' | 'chars' | 'thousands' | 'decimals' | 'too-large';
export type AmountValidation = { ok: true; cents: number } | { ok: false; reason: AmountRejection };

// Mensajes en español por motivo (docs/003 Rediseño R3 D8). `empty` y `too-large` los redacta cada
// pantalla (monto mayor a cero, tope del monto o del saldo).
export const AMOUNT_REJECTION_MESSAGES = {
  chars: 'Escribe solo números, por ejemplo 12.50.',
  thousands: 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.',
  decimals: 'Usa como máximo 2 decimales, por ejemplo 12.50.',
} as const;

// Valida lo escrito o pegado en un campo de monto SIN interpretar nada en silencio (docs/003 R3 D8).
// Acepta enteros y decimales con punto o coma y hasta 2 decimales («1000», «12.50», «12,50», «.5»,
// «5.»). Rechaza: caracteres que no son dígitos ni separador (letras, «1e5», signos, espacios
// internos), varios separadores («1,234.56», «1.234.567») y un separador seguido de 3 o más dígitos
// («1.000», «1,234»; «1234.567» se rechaza como exceso de decimales). El signo lo da solo el
// interruptor de saldo en contra. La validación final de la cifra es `parseCentsFromInput`.
export function validateAmountText(text: string): AmountValidation {
  const value = text.trim();
  if (value === '' || value === '.' || value === ',') return { ok: false, reason: 'empty' };
  if (!/^[\d.,]+$/.test(value)) return { ok: false, reason: 'chars' };
  const separators = value.match(/[.,]/g)?.length ?? 0;
  if (separators > 1) return { ok: false, reason: 'thousands' };
  if (separators === 1) {
    const at = value.search(/[.,]/);
    if (value.length - at - 1 >= 3) {
      return {
        ok: false,
        reason: /^[1-9]\d{0,2}$/.test(value.slice(0, at)) ? 'thousands' : 'decimals',
      };
    }
  }
  const normalized = /^[.,]/.test(value) ? `0${value}` : value;
  const cents = parseCentsFromInput(trimTrailingSeparator(normalized));
  return cents === null ? { ok: false, reason: 'too-large' } : { ok: true, cents };
}

// «12.» -> «12»: un separador final no cambia el monto, pero `parseCentsFromInput` lo rechaza.
export function trimTrailingSeparator(text: string): string {
  return text.trim().replace(/[.,]$/, '');
}
