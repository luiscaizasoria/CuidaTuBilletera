import type {
  ApiSession,
  AuthUser,
  GoogleIdTokenResult,
  GoogleProvider,
  SessionApi,
  SessionStorage,
} from './lib/auth-types';

export const NOW_MS = Date.UTC(2026, 9, 13, 12, 0, 0);
export const USER: AuthUser = { id: 'sub-1', email: 'ana@example.com', name: 'Ana' };

// JWT de pruebas sin firma real: la app nunca lo verifica, solo lee exp y datos de pantalla.
export function fakeJwt(expiresInSeconds: number, user: AuthUser = USER): string {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(NOW_MS / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, email: user.email, name: user.name, exp })}.firma`;
}

export function fakeStorage(initial: string | null = null) {
  let value = initial;
  const storage: SessionStorage & { value: () => string | null } = {
    load: jest.fn(async () => value),
    save: jest.fn(async (token: string) => {
      value = token;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    value: () => value,
  };
  return storage;
}

export function fakeGoogle(
  overrides: Partial<Record<keyof GoogleProvider, jest.Mock>> = {},
): GoogleProvider {
  const ok: GoogleIdTokenResult = { status: 'success', idToken: 'google-id-token' };
  return {
    signIn: jest.fn(async () => ok),
    signInSilently: jest.fn(async () => ok),
    signOut: jest.fn(async () => undefined),
    ...overrides,
  };
}

export function fakeApi(overrides: Partial<Record<keyof SessionApi, jest.Mock>> = {}): SessionApi {
  const session = (): ApiSession => ({
    accessToken: fakeJwt(900),
    expiresIn: 900,
    user: USER,
  });
  return {
    exchangeGoogleToken: jest.fn(async () => session()),
    getMe: jest.fn(async () => USER),
    ...overrides,
  };
}
