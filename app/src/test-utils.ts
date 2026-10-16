import type {
  ApiSession,
  AuthUser,
  GoogleIdTokenResult,
  GoogleProvider,
  RefreshedSession,
  SessionApi,
  StoredLoad,
  StoredSessionV2,
} from './lib/auth-types';
import { AuthError } from './lib/auth-types';

// El mock de jest-expo mide 750 dp y fontScale 2, lo que activa siempre el modo de dos filas de la
// barra de contexto. Las pruebas fijan una ventana normal salvo que prueben ese modo.
// Con la caché de Jest fría (CI, primera corrida, máquina cargada) el primer render de las suites
// pesadas transforma React Native en línea y supera el límite por defecto de 5 s por prueba o gancho
// y el de 1 s de `findBy`/`waitFor`. Las suites pesadas llaman a esta función una vez, al inicio:
// solo ajusta los límites, no cambia ninguna aserción ni silencia pruebas.
export function relaxTimeoutsForColdCache() {
  jest.setTimeout(30_000);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });
}

export function mockWindow(width = 411, fontScale = 1) {
  // `import *` crea una copia del módulo con la interoperabilidad de Babel: se espía el original.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
    width,
    height: 800,
    scale: 2.6,
    fontScale,
  });
}

export const NOW_MS = Date.UTC(2026, 9, 13, 12, 0, 0);
export const USER: AuthUser = { id: 'sub-1', email: 'ana@example.com', name: 'Ana' };
export const REFRESH_EXPIRES_AT = '2026-11-13T12:00:00.000Z';

// JWT de pruebas sin firma real: la app nunca lo verifica, solo lee exp y datos de pantalla.
// `nonce` permite distinguir dos access tokens con la misma expiración.
export function fakeJwt(expiresInSeconds: number, user: AuthUser = USER, nonce?: string): string {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(NOW_MS / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, email: user.email, name: user.name, exp, nonce })}.firma`;
}

// Refresh token de 43 caracteres base64url, derivado de una etiqueta legible.
export function refreshTokenOf(label: string): string {
  return label.padEnd(43, 'x').slice(0, 43);
}

export function storedSession(overrides: Partial<StoredSessionV2> = {}): StoredSessionV2 {
  return {
    version: 2,
    accessToken: fakeJwt(900, USER, 'stored'),
    refreshToken: refreshTokenOf('RT-stored'),
    refreshExpiresAt: REFRESH_EXPIRES_AT,
    user: USER,
    ...overrides,
  };
}

export function controlledPromise<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Cede el turno varias veces para que terminen las cadenas de promesas pendientes.
export async function flush(times = 20) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

export function fakeClock(start = NOW_MS) {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
    sleeps,
    // La espera resuelve de inmediato y avanza el reloj lo que habría durado.
    sleep: jest.fn(async (ms: number) => {
      sleeps.push(ms);
      current += ms;
    }),
    random: () => 0.5, // jitter determinista
  };
}

export type StorageOp = 'loadSession' | 'saveSession' | 'clearLegacy' | 'clearAll';

// SecureStore falso con dos "claves" (session_v2 y session_token), fallos configurables,
// compuertas controlables por operación y un registro del orden de ejecución.
export function fakeStorage(initial: StoredLoad = { kind: 'empty' }) {
  let v2: StoredSessionV2 | null = initial.kind === 'session' ? initial.session : null;
  let legacy: string | null = initial.kind === 'legacy' ? initial.token : null;
  let corrupt = initial.kind === 'corrupt';
  let unsupported = initial.kind === 'unsupported';
  const log: StorageOp[] = [];
  const failures = new Map<StorageOp, number>();
  const gates = new Map<StorageOp, Promise<void>>();

  async function enter(op: StorageOp) {
    const gate = gates.get(op);
    if (gate) await gate;
    log.push(op);
    const remaining = failures.get(op) ?? 0;
    if (remaining > 0) {
      failures.set(op, remaining - 1);
      throw new Error('fallo nativo simulado');
    }
  }

  const storage = {
    loadSession: jest.fn(async (): Promise<StoredLoad> => {
      await enter('loadSession');
      if (unsupported) return { kind: 'unsupported' };
      if (corrupt) return { kind: 'corrupt' };
      if (v2) return { kind: 'session', session: v2 };
      if (legacy) return { kind: 'legacy', token: legacy };
      return { kind: 'empty' };
    }),
    saveSession: jest.fn(async (session: StoredSessionV2) => {
      await enter('saveSession');
      v2 = session;
      corrupt = false;
      unsupported = false;
    }),
    clearLegacy: jest.fn(async () => {
      await enter('clearLegacy');
      legacy = null;
    }),
    clearAll: jest.fn(async () => {
      await enter('clearAll');
      v2 = null;
      legacy = null;
      corrupt = false;
      unsupported = false;
    }),
  };

  return Object.assign(storage, {
    log,
    session: () => v2,
    legacyToken: () => legacy,
    isEmpty: () => v2 === null && legacy === null && !corrupt && !unsupported,
    isUnsupported: () => unsupported,
    // Simula a otro proceso escribiendo un sucesor.
    writeExternal: (session: StoredSessionV2) => {
      v2 = session;
    },
    // Las próximas `times` ejecuciones de la operación fallan.
    failNext: (op: StorageOp, times = 1) => failures.set(op, times),
    failAlways: (op: StorageOp) => failures.set(op, Number.POSITIVE_INFINITY),
    // Retiene la operación hasta llamar a release().
    hold: (op: StorageOp) => {
      const gate = controlledPromise();
      gates.set(op, gate.promise);
      return () => {
        gates.delete(op);
        gate.resolve();
      };
    },
  });
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
  let counter = 0;
  const next = () => {
    counter += 1;
    return counter;
  };
  const session = (): ApiSession => {
    const n = next();
    return {
      accessToken: fakeJwt(900, USER, `google-${n}`),
      expiresIn: 900,
      refreshToken: refreshTokenOf(`RT-google-${n}`),
      refreshExpiresAt: REFRESH_EXPIRES_AT,
      user: USER,
    };
  };
  const refreshed = (): RefreshedSession => {
    const n = next();
    return {
      accessToken: fakeJwt(900, USER, `refresh-${n}`),
      expiresIn: 900,
      refreshToken: refreshTokenOf(`RT-refresh-${n}`),
      refreshExpiresAt: REFRESH_EXPIRES_AT,
    };
  };
  return {
    exchangeGoogleToken: jest.fn(async () => session()),
    refresh: jest.fn(async () => refreshed()),
    logout: jest.fn(async () => undefined),
    getMe: jest.fn(async () => USER),
    ...overrides,
  };
}

export const fail = (kind: AuthError['kind'], status?: number, code?: string) =>
  jest.fn(async () => {
    throw new AuthError(kind, status, code);
  });
