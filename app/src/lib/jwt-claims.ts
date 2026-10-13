// Lectura SIN verificar de los claims del JWT propio. Solo sirve para decidir cuándo renovar y
// para mostrar datos en pantalla. Nunca es una decisión de autorización: eso lo hace la API.
export interface UnverifiedClaims {
  exp: number;
  sub?: string;
  email?: string;
  name?: string;
}

export function readUnverifiedClaims(token: string): UnverifiedClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const json = decodeURIComponent(
      Array.from(binary, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims = JSON.parse(json) as Record<string, unknown>;
    if (typeof claims.exp !== 'number') return null;
    return {
      exp: claims.exp,
      sub: typeof claims.sub === 'string' ? claims.sub : undefined,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      name: typeof claims.name === 'string' ? claims.name : undefined,
    };
  } catch {
    return null;
  }
}
