// Generación y hash de refresh tokens. El token en claro solo existe en el resultado de emisión
// al cliente; la base guarda únicamente su SHA-256 en hex. Nada de esto se registra en logs.

export const REFRESH_TOKEN_BYTES = 32;
// Expiración deslizante: exactamente 7 días desde now en cada emisión o rotación.
export const REFRESH_TTL_MS = 7 * 86_400_000;

export type RandomBytes = (length: number) => Uint8Array;

export const defaultRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 32 bytes -> 43 caracteres base64url sin padding.
export function generateRefreshToken(randomBytes: RandomBytes = defaultRandomBytes): string {
  return toBase64Url(randomBytes(REFRESH_TOKEN_BYTES));
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function refreshExpiry(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TTL_MS);
}
