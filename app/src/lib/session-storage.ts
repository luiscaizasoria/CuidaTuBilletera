import * as SecureStore from 'expo-secure-store';
import {
  AuthError,
  type AuthUser,
  type SessionStorage,
  type StoredLoad,
  type StoredSessionV2,
} from './auth-types';
import { isUtcIsoDate } from './session-api';

const LEGACY_KEY = 'session_token';
const SESSION_V2_KEY = 'session_v2';
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null;
  const { id, email, name } = value;
  if (typeof id !== 'string' || id === '' || typeof email !== 'string' || email === '') return null;
  if (name !== undefined && typeof name !== 'string') return null;
  return { id, email, ...(name !== undefined ? { name } : {}) };
}

// Pura: valida la estructura sin registrar ni devolver contenido en errores.
// Una versión distinta de 2 (p. ej. una futura) es 'unsupported', no 'corrupt'.
export function parseStoredSession(
  raw: string,
): Extract<StoredLoad, { kind: 'session' | 'corrupt' | 'unsupported' }> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt' };
  }
  if (!isRecord(data)) return { kind: 'corrupt' };
  if (data.version !== 2) {
    return typeof data.version === 'number' && Number.isInteger(data.version) && data.version > 2
      ? { kind: 'unsupported' }
      : { kind: 'corrupt' };
  }
  const user = parseUser(data.user);
  if (
    typeof data.accessToken !== 'string' ||
    data.accessToken === '' ||
    typeof data.refreshToken !== 'string' ||
    !REFRESH_TOKEN_PATTERN.test(data.refreshToken) ||
    !isUtcIsoDate(data.refreshExpiresAt) ||
    !user
  ) {
    return { kind: 'corrupt' };
  }
  // Ausente o false: sin marca. Cualquier otro valor (true, o uno inesperado) se interpreta de
  // forma conservadora como «consumido»: nunca autoriza a renovar ni vuelve la sesión corrupta.
  const consumed = data.refreshConsumed !== undefined && data.refreshConsumed !== false;
  return {
    kind: 'session',
    session: {
      version: 2,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      refreshExpiresAt: data.refreshExpiresAt,
      user,
      ...(consumed ? { refreshConsumed: true as const } : {}),
    },
  };
}

// Cualquier error nativo se reduce a AuthError('storage'): el original puede contener datos.
async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new AuthError('storage');
  }
}

// Sesión v2 en una sola entrada JSON de SecureStore. session_token solo se lee (migración) o se borra.
export const secureSessionStorage: SessionStorage = {
  async loadSession() {
    const raw = await guard(() => SecureStore.getItemAsync(SESSION_V2_KEY));
    if (raw !== null) return parseStoredSession(raw);
    const legacy = await guard(() => SecureStore.getItemAsync(LEGACY_KEY));
    return legacy ? { kind: 'legacy', token: legacy } : { kind: 'empty' };
  },

  saveSession(session: StoredSessionV2) {
    // refreshConsumed solo se serializa cuando es true.
    const { refreshConsumed, ...rest } = session;
    const serializable = refreshConsumed === true ? { ...rest, refreshConsumed } : rest;
    return guard(() => SecureStore.setItemAsync(SESSION_V2_KEY, JSON.stringify(serializable)));
  },

  clearLegacy() {
    return guard(() => SecureStore.deleteItemAsync(LEGACY_KEY));
  },

  async clearAll() {
    const results = await Promise.allSettled(
      [SESSION_V2_KEY, LEGACY_KEY].map(async (key) => SecureStore.deleteItemAsync(key)),
    );
    if (results.some((result) => result.status === 'rejected')) throw new AuthError('storage');
  },
};
