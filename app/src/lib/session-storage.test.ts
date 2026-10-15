import * as SecureStore from 'expo-secure-store';
import { AuthError, type StoredSessionV2 } from './auth-types';
import { isUtcIsoDate } from './session-api';
import { parseStoredSession, secureSessionStorage } from './session-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'jwt'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const REFRESH = 'A'.repeat(43);
const SECRET_ACCESS = 'access-secreto-xyz';
const SESSION: StoredSessionV2 = {
  version: 2,
  accessToken: SECRET_ACCESS,
  refreshToken: REFRESH,
  refreshExpiresAt: '2026-11-13T12:00:00.000Z',
  user: { id: 'sub-1', email: 'ana@example.com', name: 'Ana' },
};

const store = SecureStore as jest.Mocked<typeof SecureStore>;

describe('parseStoredSession', () => {
  it('recupera una sesión v2 serializada', () => {
    expect(parseStoredSession(JSON.stringify(SESSION))).toEqual({
      kind: 'session',
      session: SESSION,
    });
  });

  it('acepta un usuario sin name', () => {
    const raw = JSON.stringify({ ...SESSION, user: { id: 'u', email: 'a@b.c' } });
    expect(parseStoredSession(raw)).toMatchObject({
      kind: 'session',
      session: { user: { id: 'u', email: 'a@b.c' } },
    });
  });

  it.each([
    ['JSON corrupto', '{no es json'],
    ['valor no objeto', '"texto"'],
    ['arreglo', '[]'],
    ['sin versión', JSON.stringify({ ...SESSION, version: undefined })],
    ['versión 1', JSON.stringify({ ...SESSION, version: 1 })],
    ['refresh de 42 caracteres', JSON.stringify({ ...SESSION, refreshToken: 'A'.repeat(42) })],
    [
      'refresh con caracteres inválidos',
      JSON.stringify({ ...SESSION, refreshToken: '+'.repeat(43) }),
    ],
    ['sin user', JSON.stringify({ ...SESSION, user: undefined })],
    ['user sin email', JSON.stringify({ ...SESSION, user: { id: 'u' } })],
    ['refreshExpiresAt inválido', JSON.stringify({ ...SESSION, refreshExpiresAt: 'ayer' })],
    ['refreshExpiresAt no ISO', JSON.stringify({ ...SESSION, refreshExpiresAt: '12' })],
    ['sin accessToken', JSON.stringify({ ...SESSION, accessToken: '' })],
  ])('marca como corrupta: %s', (_name, raw) => {
    expect(parseStoredSession(raw)).toEqual({ kind: 'corrupt' });
  });

  // Paridad con la API: se usa la misma función isUtcIsoDate en ambos lados.
  it.each([
    '2026-11-13T12:00:00Z',
    '2026-11-13T12:00:00.5Z',
    '2026-11-13T12:00:00.123Z',
    new Date().toISOString(),
  ])('round-trip: guarda y relee como sesión la fecha %p', (refreshExpiresAt) => {
    expect(isUtcIsoDate(refreshExpiresAt)).toBe(true);
    const raw = JSON.stringify({ ...SESSION, refreshExpiresAt });
    expect(parseStoredSession(raw)).toMatchObject({
      kind: 'session',
      session: { refreshExpiresAt },
    });
  });

  it.each([
    '12',
    '2026-02-30T12:00:00.000Z',
    '2026-13-01T12:00:00.000Z',
    '2026-11-32T12:00:00.000Z',
    '2026-11-13T24:00:00.000Z',
    '2026-11-13T12:00:00',
    '2026-11-13T12:00:00.000+00:00',
    '2026-11-13T12:00:00-05:00',
    '2026-11-13T12:00:00.0000Z',
    '2026-11-13',
  ])('lo que la API rechaza también es corrupto en almacenamiento: %p', (refreshExpiresAt) => {
    expect(isUtcIsoDate(refreshExpiresAt)).toBe(false);
    const raw = JSON.stringify({ ...SESSION, refreshExpiresAt });
    expect(parseStoredSession(raw)).toEqual({ kind: 'corrupt' });
  });

  it('marca una versión futura como no soportada (sin autorizar borrado)', () => {
    expect(parseStoredSession(JSON.stringify({ version: 3, foo: 'bar' }))).toEqual({
      kind: 'unsupported',
    });
  });
});

describe('secureSessionStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.getItemAsync.mockResolvedValue(null);
    store.setItemAsync.mockResolvedValue(undefined);
    store.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('guarda la sesión como un solo JSON en session_v2', async () => {
    await secureSessionStorage.saveSession(SESSION);
    expect(store.setItemAsync).toHaveBeenCalledTimes(1);
    expect(store.setItemAsync).toHaveBeenCalledWith('session_v2', JSON.stringify(SESSION));
  });

  it('carga session_v2 y no consulta la clave legada', async () => {
    store.getItemAsync.mockResolvedValueOnce(JSON.stringify(SESSION));
    await expect(secureSessionStorage.loadSession()).resolves.toEqual({
      kind: 'session',
      session: SESSION,
    });
    expect(store.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('devuelve legacy solo si no hay session_v2', async () => {
    store.getItemAsync.mockImplementation(async (key) =>
      key === 'session_token' ? 'jwt-v1' : null,
    );
    await expect(secureSessionStorage.loadSession()).resolves.toEqual({
      kind: 'legacy',
      token: 'jwt-v1',
    });
  });

  it('prefiere session_v2 aunque exista el token legado', async () => {
    store.getItemAsync.mockImplementation(async (key) =>
      key === 'session_v2' ? JSON.stringify(SESSION) : 'jwt-v1',
    );
    await expect(secureSessionStorage.loadSession()).resolves.toMatchObject({ kind: 'session' });
  });

  it('devuelve empty sin datos', async () => {
    await expect(secureSessionStorage.loadSession()).resolves.toEqual({ kind: 'empty' });
  });

  it('load() nunca borra: ni con datos corruptos ni con versión futura', async () => {
    store.getItemAsync.mockResolvedValueOnce('{corrupto');
    await expect(secureSessionStorage.loadSession()).resolves.toEqual({ kind: 'corrupt' });
    store.getItemAsync.mockResolvedValueOnce(JSON.stringify({ version: 9 }));
    await expect(secureSessionStorage.loadSession()).resolves.toEqual({ kind: 'unsupported' });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  it('traduce fallos de lectura, escritura y borrado a AuthError storage', async () => {
    store.getItemAsync.mockRejectedValue(new Error(`nativo ${SECRET_ACCESS}`));
    await expect(secureSessionStorage.loadSession()).rejects.toMatchObject({ kind: 'storage' });
    store.getItemAsync.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x'));
    await expect(secureSessionStorage.loadSession()).rejects.toBeInstanceOf(AuthError);
    store.setItemAsync.mockRejectedValue(new Error(`nativo ${SECRET_ACCESS}`));
    const error = await secureSessionStorage.saveSession(SESSION).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'storage' });
    expect((error as Error).message).not.toContain(SECRET_ACCESS);
    store.deleteItemAsync.mockRejectedValue(new Error('x'));
    await expect(secureSessionStorage.clearLegacy()).rejects.toMatchObject({ kind: 'storage' });
  });

  it('clearLegacy borra solo session_token', async () => {
    await secureSessionStorage.clearLegacy();
    expect(store.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(store.deleteItemAsync).toHaveBeenCalledWith('session_token');
  });

  it('clearAll borra ambas claves', async () => {
    await secureSessionStorage.clearAll();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('session_v2');
    expect(store.deleteItemAsync).toHaveBeenCalledWith('session_token');
  });

  it.each(['session_v2', 'session_token'])(
    'clearAll lanza storage si falla %s pero intenta la otra clave',
    async (failing) => {
      store.deleteItemAsync.mockImplementation(async (key) => {
        if (key === failing) throw new Error('nativo');
      });
      await expect(secureSessionStorage.clearAll()).rejects.toMatchObject({ kind: 'storage' });
      expect(store.deleteItemAsync).toHaveBeenCalledTimes(2);
    },
  );

  it('no registra contenido en console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    store.getItemAsync.mockResolvedValueOnce(JSON.stringify(SESSION));
    await secureSessionStorage.loadSession();
    await secureSessionStorage.saveSession(SESSION);
    store.setItemAsync.mockRejectedValueOnce(new Error(SECRET_ACCESS));
    await secureSessionStorage.saveSession(SESSION).catch(() => undefined);
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(SECRET_ACCESS);
    expect(logged).not.toContain(REFRESH);
    spies.forEach((spy) => spy.mockRestore());
  });
});

describe('refreshConsumed (marca de refresh token consumido)', () => {
  const EMPTY_OK = { kind: 'session' };

  it('round-trip: una sesión marcada se guarda y se relee marcada', async () => {
    store.setItemAsync.mockClear();
    await secureSessionStorage.saveSession({ ...SESSION, refreshConsumed: true });
    const raw = store.setItemAsync.mock.calls[0]?.[1] as string;
    expect(JSON.parse(raw)).toMatchObject({ refreshConsumed: true });
    expect(parseStoredSession(raw)).toEqual({
      kind: 'session',
      session: { ...SESSION, refreshConsumed: true },
    });
  });

  it('una sesión antigua sin el campo sigue siendo válida y sin marca', () => {
    const parsed = parseStoredSession(JSON.stringify(SESSION));
    expect(parsed).toMatchObject(EMPTY_OK);
    expect(parsed).toEqual({ kind: 'session', session: SESSION });
    expect('refreshConsumed' in (parsed as { session: object }).session).toBe(false);
  });

  it('false se interpreta como sin marca', () => {
    const parsed = parseStoredSession(JSON.stringify({ ...SESSION, refreshConsumed: false }));
    expect(parsed).toEqual({ kind: 'session', session: SESSION });
  });

  it.each([['"true"'], ['1'], ['0'], ['null'], ['{}'], ['[]'], ['""']])(
    'valor inesperado %s: se interpreta como consumido, no como corrupto',
    (literal) => {
      const raw = JSON.stringify(SESSION).replace(/}$/, `,"refreshConsumed":${literal}}`);
      expect(parseStoredSession(raw)).toEqual({
        kind: 'session',
        session: { ...SESSION, refreshConsumed: true },
      });
    },
  );

  it('saveSession no escribe el campo cuando está ausente o es false', async () => {
    store.setItemAsync.mockClear();
    await secureSessionStorage.saveSession(SESSION);
    await secureSessionStorage.saveSession({
      ...SESSION,
      refreshConsumed: false,
    } as unknown as StoredSessionV2);
    for (const call of store.setItemAsync.mock.calls) {
      expect(call[1]).not.toContain('refreshConsumed');
    }
  });
});
