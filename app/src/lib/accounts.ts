// Cálculos puros de Mis cuentas (docs/007 §5.2; docs/003, Decisión R0 D6 y D11).
import { accountPalette } from '../theme/tokens';
import { accountColorOption, accountIconOption } from './account-appearance';
import type { Account } from './resources-api';

// Hash estable del id (multiplicador 31, aritmética de 32 bits sin signo).
export function accountColorIndex(id: string): number {
  let x = 0;
  for (let i = 0; i < id.length; i += 1) x = (Math.imul(x, 31) + id.charCodeAt(i)) >>> 0;
  return x % accountPalette.length;
}

export function accountColors(id: string): (typeof accountPalette)[number] {
  return accountPalette[accountColorIndex(id)]!;
}

// Ícono de la cuenta según su nombre (solo presentación): tarjeta, banco o billetera por defecto.
export function accountIcon(name: string): string {
  const lower = name.toLocaleLowerCase('es');
  if (lower.includes('tarjeta')) return '💳';
  if (lower.includes('banco')) return '🏦';
  return '👛';
}

// Color de la cuenta: el elegido (apariencia guardada) o, si no hay o es desconocido, el del hash del id.
export function accountColorsFor(account: Pick<Account, 'id' | 'color'>): {
  card: string;
  tile: string;
} {
  return accountColorOption(account.color) ?? accountColors(account.id);
}

// Ícono de la cuenta: el elegido o, si no hay o es desconocido, el que sale del nombre.
export function accountIconFor(account: Pick<Account, 'nombre' | 'icono'>): string {
  return accountIconOption(account.icono)?.glyph ?? accountIcon(account.nombre);
}

export interface AccountsTotal {
  total: number;
  count: number;
}

// «Total en tus cuentas»: suma exacta de los saldos de las cuentas activas, solo con 2 o más.
// null si no corresponde mostrarlo o si algún saldo o la suma no es un entero seguro: nunca
// se muestra una cifra inexacta ni un «$0.00» por fallo.
export function activeAccountsTotal(accounts: readonly Account[]): AccountsTotal | null {
  const active = accounts.filter((account) => !account.archivada);
  if (active.length < 2) return null;
  let total = 0;
  for (const account of active) {
    if (!Number.isSafeInteger(account.saldo)) return null;
    total += account.saldo;
    if (!Number.isSafeInteger(total)) return null;
  }
  return { total, count: active.length };
}

// Primer nombre para el saludo; nunca el correo.
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// Inicial del avatar: del nombre o, si no hay, del correo.
export function avatarInitial(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || '';
  return source === '' ? '?' : source.charAt(0).toLocaleUpperCase('es');
}
