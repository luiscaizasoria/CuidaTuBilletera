import {
  AuthError,
  type ApiSession,
  type AuthErrorKind,
  type AuthUser,
  type RefreshedSession,
  type SessionApi,
} from './auth-types';

const REQUEST_TIMEOUT_MS = 15_000;
const LOGOUT_TIMEOUT_MS = 8_000;
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
// Códigos 401 que significan "credencial rechazada" (refresh, access token o ID token de Google).
const REJECTED_CODES = new Set(['INVALID_REFRESH_TOKEN', 'INVALID_TOKEN', 'UNAUTHORIZED']);

// Pura: clasifica por status y por error.code del cuerpo. Un 409 sin código o un 401 desconocido
// nunca se interpretan como revocación.
export function classifyFailure(status: number, code?: string): AuthErrorKind {
  if (status === 401)
    return code !== undefined && REJECTED_CODES.has(code) ? 'rejected' : 'unknown';
  if (status === 409) return code === 'REFRESH_CONFLICT' ? 'conflict' : 'unknown';
  if (status === 429 || status >= 500) return 'server';
  return 'unknown'; // 400, 413 y el resto
}

export async function request(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw new AuthError('network');
  } finally {
    clearTimeout(timer);
  }
}

// Lee solo error.code (validado por patrón). El message del cuerpo nunca se lee ni se propaga.
export async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const data: unknown = await response.json();
    const error = (data as { error?: unknown } | null)?.error;
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && ERROR_CODE_PATTERN.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

async function failure(response: Response): Promise<AuthError> {
  const code = await readErrorCode(response);
  return new AuthError(classifyFailure(response.status, code), response.status, code);
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // respuesta inválida: se trata abajo
  }
  throw new AuthError('unknown');
}

function parseUser(value: unknown): AuthUser {
  const user = value as Partial<AuthUser> | null | undefined;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
    throw new AuthError('unknown');
  }
  return {
    id: user.id,
    email: user.email,
    ...(typeof user.name === 'string' ? { name: user.name } : {}),
  };
}

const UTC_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

// Pura y compartida con session-storage. Exige ISO 8601 en UTC con sufijo Z:
// YYYY-MM-DDTHH:mm:ss(.f{1,3})?Z, que es lo que emite la API con Date.toISOString().
// No se aceptan offsets (+00:00, -05:00) ni fechas sin zona: el contrato real es siempre Z.
// Las fechas imposibles (30 de febrero, mes 13, hora 24) se rechazan comparando los
// componentes con los de Date.UTC, que normalizaría el desborde.
export function isUtcIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = UTC_ISO_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function parseTokens(data: Record<string, unknown>): RefreshedSession {
  const { accessToken, tokenType, expiresIn, refreshToken, refreshExpiresAt } = data;
  if (
    typeof accessToken !== 'string' ||
    accessToken === '' ||
    tokenType !== 'Bearer' ||
    typeof expiresIn !== 'number' ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0 ||
    typeof refreshToken !== 'string' ||
    !REFRESH_TOKEN_PATTERN.test(refreshToken) ||
    !isUtcIsoDate(refreshExpiresAt)
  ) {
    throw new AuthError('unknown');
  }
  return { accessToken, expiresIn, refreshToken, refreshExpiresAt };
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export function createSessionApi(baseUrl: string, fetchImpl: typeof fetch = fetch): SessionApi {
  return {
    async exchangeGoogleToken(idToken): Promise<ApiSession> {
      const response = await request(fetchImpl, `${baseUrl}/auth/google`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw await failure(response);
      const data = await readBody(response);
      return { ...parseTokens(data), user: parseUser(data.user) };
    },

    async refresh(refreshToken): Promise<RefreshedSession> {
      const response = await request(fetchImpl, `${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) throw await failure(response);
      return parseTokens(await readBody(response));
    },

    async logout(refreshToken): Promise<void> {
      const response = await request(
        fetchImpl,
        `${baseUrl}/auth/logout`,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ refreshToken }) },
        LOGOUT_TIMEOUT_MS,
      );
      if (response.status === 204) return;
      if (!response.ok) throw await failure(response);
      throw new AuthError('unknown'); // 2xx distinto de 204: no confirma la revocación
    },

    async getMe(accessToken): Promise<AuthUser> {
      const response = await request(fetchImpl, `${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw await failure(response);
      return parseUser((await readBody(response)).user);
    },
  };
}
