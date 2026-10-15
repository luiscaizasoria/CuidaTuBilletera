import {
  controlledPromise,
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  flush,
  refreshTokenOf,
  storedSession,
  NOW_MS,
  USER,
} from '../test-utils';
import {
  createAuthService,
  GOOGLE_INTERACTIVE_TIMEOUT_MS,
  GOOGLE_SILENT_TIMEOUT_MS,
  RECOVERY_COOLDOWN_MS,
  RESTORE_MIN_INTERVAL_MS,
} from './auth-service';
import {
  AUTH_ERROR_MESSAGES,
  DEGRADED_UNVERIFIED_MESSAGE,
  LOGOUT_NOTICE_MESSAGES,
  SIGNED_OUT_MESSAGES,
  UNAVAILABLE_MESSAGES,
  unavailableMessage,
} from './auth-messages';
import { AuthError, type StoredLoad, type StoredSessionV2 } from './auth-types';

type Ctx = ReturnType<typeof setup>;

function setup(
  opts: {
    stored?: StoredLoad;
    google?: ReturnType<typeof fakeGoogle>;
    api?: ReturnType<typeof fakeApi>;
  } = {},
) {
  const clock = fakeClock();
  const storage = fakeStorage(opts.stored);
  const google = opts.google ?? fakeGoogle();
  const api = opts.api ?? fakeApi();
  const make = () =>
    createAuthService({
      google,
      storage,
      api,
      now: clock.now,
      sleep: clock.sleep,
      random: clock.random,
    });
  return { clock, storage, google, api, service: make(), make };
}

// Sesión guardada cuyo access vence en `seconds` segundos (negativo = ya vencido).
const stored = (seconds: number, label = 'A'): StoredLoad => ({
  kind: 'session',
  session: sessionWith(seconds, label),
});
const sessionWith = (seconds: number, label = 'A'): StoredSessionV2 =>
  storedSession({
    accessToken: fakeJwt(seconds, USER, label),
    refreshToken: refreshTokenOf(`RT-${label}`),
  });
const err = (kind: AuthError['kind'], status?: number, code?: string) =>
  new AuthError(kind, status, code);
const rejectOnce = (...errors: AuthError[]) => {
  const mock = jest.fn();
  errors.forEach((e) => mock.mockRejectedValueOnce(e));
  return mock;
};
const refreshedTokens = (label: string) => ({
  accessToken: fakeJwt(900, USER, label),
  expiresIn: 900,
  refreshToken: refreshTokenOf(`RT-${label}`),
  refreshExpiresAt: '2026-11-13T12:00:00.000Z',
});

// Inicia sesión y deja el servicio autenticado con un access de 900 s.
async function signedIn(opts: Parameters<typeof setup>[0] = {}): Promise<Ctx> {
  const ctx = setup(opts);
  await ctx.service.signIn();
  expect(ctx.service.getState().status).toBe('authenticated');
  jest.clearAllMocks();
  return ctx;
}
// Hace que el access en memoria deje de ser fresco (queda dentro del margen de 60 s).
const ageToMargin = (ctx: Ctx) => ctx.clock.advance(900_000 - 59_000);
const ageToExpired = (ctx: Ctx) => ctx.clock.advance(900_000 + 1_000);

describe('inicio de sesión', () => {
  it('guarda session_v2 con el usuario recibido y autentica', async () => {
    const { service, storage, api } = setup();
    await service.signIn();

    expect(api.exchangeGoogleToken).toHaveBeenCalledWith('google-id-token');
    expect(service.getState()).toMatchObject({
      status: 'authenticated',
      user: USER,
      busy: false,
      degraded: false,
      error: null,
      notice: null,
    });
    expect(storage.session()).toMatchObject({ version: 2, user: USER });
    expect(JSON.stringify(storage.session())).not.toContain('google-id-token');
  });

  it('la cancelación no es un error', async () => {
    const google = fakeGoogle({ signIn: jest.fn(async () => ({ status: 'cancelled' })) });
    const { service, api } = setup({ google });
    await service.signIn();

    expect(service.getState()).toMatchObject({ busy: false, error: null });
    expect(api.exchangeGoogleToken).not.toHaveBeenCalled();
  });

  it.each(['play-services', 'config', 'network', 'unknown'] as const)(
    'expone el error de Google "%s" sin autenticar',
    async (kind) => {
      const google = fakeGoogle({ signIn: jest.fn().mockRejectedValue(err(kind)) });
      const { service } = setup({ google });
      await service.signIn();

      expect(service.getState()).toMatchObject({ error: kind, busy: false });
      expect(service.getState().status).not.toBe('authenticated');
    },
  );

  it('un error que no es AuthError se presenta como unknown', async () => {
    const google = fakeGoogle({ signIn: jest.fn().mockRejectedValue(new Error('x')) });
    const { service } = setup({ google });
    await service.signIn();
    expect(service.getState().error).toBe('unknown');
  });

  it('si la API rechaza el token no guarda nada', async () => {
    const api = fakeApi({ exchangeGoogleToken: jest.fn().mockRejectedValue(err('rejected')) });
    const { service, storage } = setup({ api });
    await service.signIn();

    expect(service.getState().error).toBe('rejected');
    expect(storage.saveSession).not.toHaveBeenCalled();
  });

  it('ignora pulsaciones repetidas mientras hay un inicio en curso', async () => {
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    const google = fakeGoogle({ signIn: jest.fn(() => gate.promise) });
    const { service } = setup({ google });
    const first = service.signIn();
    await service.signIn();
    expect(service.getState().busy).toBe(true);
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await first;

    expect(google.signIn).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('authenticated');
  });

  it('si el guardado falla expone storage, no autentica y revoca la familia nueva', async () => {
    const { service, storage, api } = setup();
    storage.failAlways('saveSession');
    await service.signIn();
    await flush();

    expect(service.getState()).toMatchObject({
      status: 'initializing',
      error: 'storage',
      busy: false,
    });
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(storage.session()).toBeNull();
  });
});

describe('restauración de sesión', () => {
  it('sin nada guardado queda no autenticado (absent)', async () => {
    const { service } = setup();
    expect(service.getState().status).toBe('initializing');
    await service.restore();
    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'absent',
    });
  });

  it('con access fresco valida con GET /me y no toca refresh ni Google', async () => {
    const { service, api, google, storage } = setup({ stored: stored(120) });
    await service.restore();
    await flush();

    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(api.refresh).not.toHaveBeenCalled();
    expect(google.signInSilently).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({
      status: 'authenticated',
      user: USER,
      degraded: false,
    });
    expect(storage.clearLegacy).toHaveBeenCalled(); // v2 prevalece sobre un posible session_token
  });

  it('con access fresco y sin red conserva la sesión en modo degradado', async () => {
    const api = fakeApi({ getMe: jest.fn().mockRejectedValue(err('network')) });
    const { service, storage } = setup({ stored: stored(120), api });
    await service.restore();

    expect(service.getState()).toMatchObject({
      status: 'authenticated',
      degraded: true,
      user: USER,
    });
    expect(storage.clearAll).not.toHaveBeenCalled();
  });

  it('con access vencido renueva por /auth/refresh, guarda el par rotado y no usa Google', async () => {
    const { service, api, google, storage } = setup({ stored: stored(-10) });
    await service.restore();

    expect(api.refresh).toHaveBeenCalledWith(refreshTokenOf('RT-A'));
    expect(google.signInSilently).not.toHaveBeenCalled();
    expect(service.getState().status).toBe('authenticated');
    expect(storage.session()?.refreshToken).not.toBe(refreshTokenOf('RT-A'));
    expect(storage.session()?.user).toEqual(USER); // el refresh no devuelve usuario
  });

  it('con access vencido y sin red queda no disponible (network) sin borrar nada', async () => {
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(err('network')) });
    const { service, storage } = setup({ stored: stored(-10), api });
    await service.restore();

    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
    });
    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.session()).not.toBeNull();
  });

  it('con access aún vigente pero dentro del margen y sin red queda degradado', async () => {
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(err('network')) });
    const { service } = setup({ stored: stored(30), api });
    await service.restore();
    expect(service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
  });

  it('un access ilegible no se considera fresco', async () => {
    const { service, api } = setup({
      stored: { kind: 'session', session: storedSession({ accessToken: 'no-es-un-jwt' }) },
    });
    await service.restore();
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('un 401 persistente tras renovar no destruye la sesión: queda no disponible', async () => {
    const api = fakeApi({
      getMe: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_TOKEN')),
    });
    const { service, storage } = setup({ stored: stored(120), api });
    await service.restore();

    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(service.getState()).toMatchObject({ status: 'unavailable', unavailableCause: 'server' });
    expect(storage.clearAll).not.toHaveBeenCalled();
  });

  it('un fallo al leer SecureStore deja no disponible (storage)', async () => {
    const { service, storage } = setup({ stored: stored(120) });
    storage.failNext('loadSession');
    await service.restore();
    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
    expect(storage.clearAll).not.toHaveBeenCalled();
  });

  it('el contenido corrupto se limpia con clearAll y se trata como sesión ausente', async () => {
    const { service, storage } = setup({ stored: { kind: 'corrupt' } });
    await service.restore();
    expect(storage.clearAll).toHaveBeenCalledTimes(1);
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'absent',
    });
  });

  it('si no puede limpiar el contenido corrupto queda no disponible (storage)', async () => {
    const { service, storage } = setup({ stored: { kind: 'corrupt' } });
    storage.failAlways('clearAll');
    await service.restore();
    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });

  it("una sesión 'unsupported' (versión futura) NUNCA se borra automáticamente", async () => {
    const { service, storage } = setup({ stored: { kind: 'unsupported' } });
    await service.restore();
    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.clearLegacy).not.toHaveBeenCalled();
    expect(storage.isUnsupported()).toBe(true);
    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });

  it('restores concurrentes comparten una sola lectura', async () => {
    const { service, storage } = setup({ stored: stored(120) });
    await Promise.all([service.restore(), service.restore()]);
    expect(storage.loadSession).toHaveBeenCalledTimes(1);
  });

  it('Reintentar desde no disponible marca busy y se recupera', async () => {
    const refresh = jest
      .fn()
      .mockRejectedValueOnce(err('network'))
      .mockResolvedValue(refreshedTokens('reintento'));
    const api = fakeApi({ refresh });
    const { service, clock } = setup({ stored: stored(-10), api });
    await service.restore();
    expect(service.getState().status).toBe('unavailable');

    clock.advance(RESTORE_MIN_INTERVAL_MS); // intervalo mínimo entre reintentos que llegan a la red
    const retry = service.restore();
    expect(service.getState().busy).toBe(true);
    await retry;
    expect(service.getState()).toMatchObject({ status: 'authenticated', busy: false });
  });

  it('restaura tras cerrar y abrir la app (nuevo servicio con el mismo almacenamiento)', async () => {
    const first = setup();
    await first.service.signIn();
    const reopened = createAuthService({
      google: first.google,
      storage: first.storage,
      api: first.api,
      now: first.clock.now,
      sleep: first.clock.sleep,
      random: first.clock.random,
    });
    await reopened.restore();
    expect(reopened.getState()).toMatchObject({ status: 'authenticated', user: USER });
  });

  it('si el logout no pudo borrar, restore() no revive la sesión', async () => {
    const ctx = await signedIn();
    ctx.storage.failNext('clearAll', 4);
    await ctx.service.signOut();
    expect(ctx.storage.session()).not.toBeNull(); // sigue en disco: el borrado falló

    ctx.storage.failNext('clearAll', 2);
    await ctx.service.restore();
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      notice: 'logout-storage-error',
    });

    await ctx.service.restore(); // ahora el borrado funciona
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'absent',
    });
  });
});

describe('migración desde JWT v1', () => {
  const legacy: StoredLoad = { kind: 'legacy', token: 'jwt-v1-secreto' };

  it('éxito: guarda v2, borra session_token solo tras el guardado y no llama a /me', async () => {
    const { service, storage, api, google } = setup({ stored: legacy });
    await service.restore();

    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(api.getMe).not.toHaveBeenCalled();
    expect(storage.log).toEqual(['loadSession', 'saveSession', 'clearLegacy']);
    expect(storage.legacyToken()).toBeNull();
    expect(storage.session()).not.toBeNull();
    expect(service.getState().status).toBe('authenticated');
  });

  it.each([{ status: 'no-saved-credential' }, { status: 'cancelled' }] as const)(
    'sin credencial de Google (%j) limpia todo y queda no autenticado',
    async (result) => {
      const google = fakeGoogle({ signInSilently: jest.fn(async () => result) });
      const { service, storage } = setup({ stored: legacy, google });
      await service.restore();

      expect(storage.clearAll).toHaveBeenCalledTimes(1);
      expect(storage.isEmpty()).toBe(true);
      expect(service.getState()).toMatchObject({
        status: 'unauthenticated',
        signedOutReason: 'absent',
      });
    },
  );

  it.each([
    [
      'red en Google',
      { signInSilently: jest.fn().mockRejectedValue(err('network')) },
      {},
      'network',
    ],
    [
      'Play Services',
      { signInSilently: jest.fn().mockRejectedValue(err('play-services')) },
      {},
      'server',
    ],
    [
      '5xx de la API',
      {},
      { exchangeGoogleToken: jest.fn().mockRejectedValue(err('server', 503)) },
      'server',
    ],
    [
      'red en la API',
      {},
      { exchangeGoogleToken: jest.fn().mockRejectedValue(err('network')) },
      'network',
    ],
  ] as const)('error transitorio (%s) conserva session_token', async (_n, g, a, cause) => {
    const { service, storage } = setup({
      stored: legacy,
      google: fakeGoogle(g),
      api: fakeApi(a),
    });
    await service.restore();

    expect(service.getState()).toMatchObject({ status: 'unavailable', unavailableCause: cause });
    expect(storage.legacyToken()).toBe('jwt-v1-secreto');
    expect(storage.clearAll).not.toHaveBeenCalled();

    await service.restore(); // reintento manual
  });

  it('el reintento manual tras un error transitorio completa la migración', async () => {
    const google = fakeGoogle({
      signInSilently: jest
        .fn()
        .mockRejectedValueOnce(err('network'))
        .mockResolvedValue({ status: 'success', idToken: 'google-id-token' }),
    });
    const { service, storage, clock } = setup({ stored: legacy, google });
    await service.restore();
    clock.advance(RESTORE_MIN_INTERVAL_MS);
    await service.restore();
    expect(service.getState().status).toBe('authenticated');
    expect(storage.legacyToken()).toBeNull();
  });

  it('si la API rechaza el ID token de Google limpia la sesión legada', async () => {
    const api = fakeApi({ exchangeGoogleToken: jest.fn().mockRejectedValue(err('rejected', 401)) });
    const { service, storage } = setup({ stored: legacy, api });
    await service.restore();
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState().signedOutReason).toBe('absent');
  });

  it('si no se puede guardar v2 conserva session_token y revoca la familia nueva', async () => {
    const { service, storage, api } = setup({ stored: legacy });
    storage.failAlways('saveSession');
    await service.restore();
    await flush();

    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
    expect(storage.legacyToken()).toBe('jwt-v1-secreto');
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it('muerte tras guardar v2: la siguiente apertura usa v2 y borra session_token', async () => {
    const first = setup({ stored: legacy });
    first.storage.failAlways('clearLegacy'); // la app "muere" antes de borrar la v1
    await first.service.restore();
    expect(first.service.getState().status).toBe('authenticated'); // clearLegacy es inocuo
    expect(first.storage.legacyToken()).toBe('jwt-v1-secreto');
    expect(first.storage.session()).not.toBeNull();

    first.storage.failNext('clearLegacy', 0);
    const reopened = first.make();
    await reopened.restore();
    await flush();
    expect(first.storage.legacyToken()).toBeNull();
    expect(first.google.signInSilently).toHaveBeenCalledTimes(1); // no se migró otra vez
    expect(first.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
  });

  it('restores concurrentes comparten ciclo: una sola familia', async () => {
    const { service, api, google } = setup({ stored: legacy });
    await Promise.all([service.restore(), service.restore(), service.restore()]);
    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
  });

  it('logout durante la migración no deja sesión ni familia huérfana', async () => {
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    const google = fakeGoogle({ signInSilently: jest.fn(() => gate.promise) });
    const { service, storage, api } = setup({ stored: legacy, google });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await restoring;
    await flush();

    expect(api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('logout tras el intercambio descarta el par y lo revoca', async () => {
    const gate =
      controlledPromise<Awaited<ReturnType<ReturnType<typeof fakeApi>['exchangeGoogleToken']>>>();
    const api = fakeApi({ exchangeGoogleToken: jest.fn(() => gate.promise) });
    const { service, storage } = setup({ stored: legacy, api });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.resolve({
      ...refreshedTokens('mig'),
      user: USER,
    });
    await restoring;
    await flush();

    expect(storage.saveSession).not.toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalledWith(refreshTokenOf('RT-mig'));
    expect(storage.isEmpty()).toBe(true);
  });
});

describe('renovación', () => {
  it('proactiva: con 61 s restantes no renueva y con 59 s sí', async () => {
    const ctx = await signedIn();
    ctx.clock.advance(900_000 - 61_000);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.api.refresh).not.toHaveBeenCalled();

    ctx.clock.advance(2_000); // quedan 59 s
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('usa el access recién recibido (now + expiresIn), no el exp del JWT', async () => {
    const ctx = await signedIn();
    // El JWT trae exp = NOW+900 s; el reloj local manda desde la recepción.
    ctx.clock.advance(839_000);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.api.refresh).not.toHaveBeenCalled();
  });

  it('reactiva: ante 401 renueva una vez y reintenta una vez con el token nuevo', async () => {
    const ctx = await signedIn();
    const used: string[] = [];
    const result = await ctx.service.authorizedCall(async (token) => {
      used.push(token);
      if (used.length === 1) throw err('rejected', 401, 'INVALID_TOKEN');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(used).toHaveLength(2);
    expect(used[1]).not.toBe(used[0]);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('si otro ciclo ya renovó durante la llamada reintenta con el nuevo sin otro refresh', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<string>();
    const seen: string[] = [];
    const slow = ctx.service.authorizedCall(async (token) => {
      seen.push(token);
      if (seen.length === 1) {
        await gate.promise;
        throw err('rejected', 401, 'INVALID_TOKEN');
      }
      return 'lenta-ok';
    });
    await flush();
    // Otra llamada fuerza la renovación mientras la primera sigue en vuelo.
    let attempts = 0;
    await ctx.service.authorizedCall(async () => {
      attempts += 1;
      if (attempts === 1) throw err('rejected', 401, 'INVALID_TOKEN');
      return 'rapida-ok';
    });
    gate.resolve('x');

    await expect(slow).resolves.toBe('lenta-ok');
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(seen[1]).not.toBe(seen[0]);
  });

  it('un segundo 401 se propaga sin destruir la sesión', async () => {
    const ctx = await signedIn();
    const failure = err('rejected', 401, 'INVALID_TOKEN');
    await expect(
      ctx.service.authorizedCall(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('los errores que no son 401 se propagan sin renovar', async () => {
    const ctx = await signedIn();
    await expect(
      ctx.service.authorizedCall(async () => {
        throw err('server', 503);
      }),
    ).rejects.toMatchObject({ kind: 'server' });
    await expect(
      ctx.service.authorizedCall(async () => {
        throw new Error('otro');
      }),
    ).rejects.toThrow('otro');
    expect(ctx.api.refresh).not.toHaveBeenCalled();
  });

  it('10 llamadas concurrentes con el access vencido: 1 refresh y 1 guardado', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => ctx.service.authorizedCall(async (t) => t)),
    );

    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1);
    expect(new Set(results).size).toBe(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('guarda ANTES de publicar', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    const events: string[] = [];
    (ctx.storage.saveSession as jest.Mock).mockImplementationOnce(async () => {
      events.push('save');
    });
    ctx.service.subscribe(() => events.push('publish'));
    await ctx.service.authorizedCall(async (t) => t);
    expect(events).toEqual(['save', 'publish']);
  });

  it('rotación sin pérdida: la siguiente renovación usa el refresh token recién guardado', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    const rotated = ctx.storage.session()?.refreshToken;
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);

    expect((ctx.api.refresh as jest.Mock).mock.calls[1]?.[0]).toBe(rotated);
    expect(ctx.storage.session()?.refreshToken).not.toBe(rotated);
  });

  it('si no se puede renovar y el access sigue vigente, la llamada sigue con él (degradado)', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(err('network')) }),
    });
    ageToMargin(ctx);
    const token = await ctx.service.authorizedCall(async (t) => t);
    expect(token).toBeTruthy();
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
  });

  it('sin sesión en memoria la llamada se rechaza', async () => {
    const { service } = setup();
    await expect(service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'rejected',
    });
  });

  it('con el access vencido y fallo transitorio la llamada falla con la causa', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(err('server', 503)) }),
    });
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'server',
    });
  });
});

describe('fallos de refresh que no destruyen la sesión', () => {
  it.each([
    ['red / timeout', err('network'), 'network'],
    ['429 o 5xx', err('server', 503), 'server'],
    ['desconocido', err('unknown'), 'server'],
    ['no es AuthError', new Error('x'), 'server'],
  ] as const)('%s: 0 clearAll y conserva el almacenamiento', async (_n, failure, cause) => {
    const ctx = await signedIn({ api: fakeApi({ refresh: jest.fn().mockRejectedValue(failure) }) });
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);

    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: cause,
    });
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(ctx.storage.session()).not.toBeNull();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('un error inesperado dentro del ciclo se contiene como no disponible', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    (ctx.storage.saveSession as jest.Mock).mockImplementation(async () => {
      throw new Error('x');
    });
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });
});

describe('fallos de SecureStore al guardar', () => {
  it('reintenta una vez inmediatamente y publica si el segundo intento funciona', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    ctx.storage.failNext('saveSession', 1);
    await ctx.service.authorizedCall(async (t) => t);

    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(2);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: false });
    const issued = (await (ctx.api.refresh as jest.Mock).mock.results[0]!.value) as {
      refreshToken: string;
    };
    expect(ctx.storage.session()?.refreshToken).toBe(issued.refreshToken);
  });

  it('si falla dos veces NO publica el par; con access vigente queda degradado', async () => {
    const ctx = await signedIn();
    const before = ctx.storage.session();
    ageToMargin(ctx);
    ctx.storage.failNext('saveSession', 2);
    const used = await ctx.service.authorizedCall(async (t) => t);

    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(2);
    expect(used).toBe(before?.accessToken); // seguimos con el access anterior
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    expect(ctx.storage.session()).toEqual(before);
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
  });

  it('si falla dos veces con el access vencido queda no disponible (storage)', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    ctx.storage.failNext('saveSession', 2);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });
});

describe('REFRESH_CONFLICT (409)', () => {
  const conflict = () => err('conflict', 409, 'REFRESH_CONFLICT');

  it('sin sucesor: espera con jitter y hace UNA recuperación con Google', async () => {
    const ctx = await signedIn({ api: fakeApi({ refresh: rejectOnce(conflict()) }) });
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);

    expect(ctx.clock.sleeps).toEqual([1125]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1); // el token en conflicto jamás se reenvía
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(ctx.api.logout).not.toHaveBeenCalledWith(oldRefresh); // origen 409: no se revoca
    expect(ctx.service.getState().status).toBe('authenticated');
    expect(ctx.storage.session()?.refreshToken).not.toBe(oldRefresh);
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined(); // la marca no sobrevive
  });

  it('con sucesor fresco: lo usa sin llamar a la API ni a Google', async () => {
    const successor = sessionWith(2000, 'succ');
    const ctx = await signedIn();
    const refresh = jest.fn(async () => {
      ctx.storage.writeExternal(successor);
      throw conflict();
    });
    (ctx.api.refresh as jest.Mock).mockImplementation(refresh);
    ageToExpired(ctx);
    const token = await ctx.service.authorizedCall(async (t) => t);

    expect(token).toBe(successor.accessToken);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('con sucesor vencido: UN reintento con el sucesor, nunca con el token viejo', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await signedIn();
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    const refresh = jest
      .fn()
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(successor);
        throw conflict();
      })
      .mockResolvedValueOnce(refreshedTokens('post'));
    (ctx.api.refresh as jest.Mock).mockImplementation(refresh);
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);

    expect(refresh.mock.calls.map((c) => c[0])).toEqual([oldRefresh, successor.refreshToken]);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.session()?.refreshToken).toBe(refreshTokenOf('RT-post'));
  });

  it('un segundo 409 deja no disponible (server) sin Google ni nueva familia', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await signedIn();
    const refresh = jest
      .fn()
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(successor);
        throw conflict();
      })
      .mockRejectedValueOnce(conflict());
    (ctx.api.refresh as jest.Mock).mockImplementation(refresh);
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });

    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'server',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
  });

  it('si el logout ocurre durante la espera del conflicto, termina sin Google', async () => {
    const ctx = await signedIn({ api: fakeApi({ refresh: rejectOnce(conflict()) }) });
    ageToExpired(ctx);
    const gate = controlledPromise();
    ctx.clock.sleep.mockImplementationOnce(() => gate.promise);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.resolve();

    await expect(call).resolves.toMatchObject({ kind: 'rejected' });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('si el almacenamiento no se puede releer queda no disponible (storage)', async () => {
    const ctx = await signedIn({ api: fakeApi({ refresh: rejectOnce(conflict()) }) });
    ageToExpired(ctx);
    ctx.storage.failNext('loadSession');
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('si el almacenamiento tiene una versión futura no se toca', async () => {
    const ctx = await signedIn({ api: fakeApi({ refresh: rejectOnce(conflict()) }) });
    ageToExpired(ctx);
    // Sustituye lo almacenado por una sesión de versión futura.
    (ctx.storage.loadSession as jest.Mock).mockResolvedValueOnce({ kind: 'unsupported' });
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });
});

describe('recuperación con Google (401 INVALID_REFRESH_TOKEN)', () => {
  const invalidRefresh = () => err('rejected', 401, 'INVALID_REFRESH_TOKEN');
  const setupRecovery = (overrides: Parameters<typeof fakeApi>[0] = {}) =>
    signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()), ...overrides }),
    });

  it('recupera con Google una vez: nueva familia, revoca la vieja y guarda', async () => {
    const ctx = await setupRecovery();
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);

    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(ctx.api.logout).toHaveBeenCalledWith(oldRefresh);
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('N llamadas concurrentes: signInSilently y exchangeGoogleToken ≤ 1', async () => {
    const ctx = await setupRecovery();
    ageToExpired(ctx);
    await Promise.all(Array.from({ length: 8 }, () => ctx.service.authorizedCall(async (t) => t)));
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
  });

  it.each([{ status: 'no-saved-credential' }, { status: 'cancelled' }] as const)(
    'sin credencial (%j): sesión revocada y almacenamiento limpio',
    async (result) => {
      const ctx = await setupRecovery();
      (ctx.google.signInSilently as jest.Mock).mockResolvedValue(result);
      ageToExpired(ctx);
      await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
        kind: 'rejected',
      });

      expect(ctx.service.getState()).toMatchObject({
        status: 'unauthenticated',
        signedOutReason: 'revoked',
        user: null,
      });
      expect(ctx.storage.isEmpty()).toBe(true);
    },
  );

  it('si clearAll falla al revocar mantiene el aviso de almacenamiento', async () => {
    const ctx = await setupRecovery();
    (ctx.google.signInSilently as jest.Mock).mockResolvedValue({ status: 'no-saved-credential' });
    ctx.storage.failAlways('clearAll');
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);

    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'revoked',
      notice: 'logout-storage-error',
    });
  });

  it.each([
    ['red de Google', err('network'), 'network'],
    ['Play Services', err('play-services'), 'server'],
  ] as const)('%s: no destruye nada', async (_n, failure, cause) => {
    const ctx = await setupRecovery();
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(failure);
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);

    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: cause,
    });
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
  });

  it('un 5xx al intercambiar no destruye nada; un rechazo sí revoca', async () => {
    const ctx = await setupRecovery();
    (ctx.api.exchangeGoogleToken as jest.Mock).mockRejectedValueOnce(err('server', 503));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();

    const other = await setupRecovery();
    (other.api.exchangeGoogleToken as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
    ageToExpired(other);
    await expect(other.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);
    expect(other.service.getState().signedOutReason).toBe('revoked');
  });

  it('si apareció un sucesor descarta el par recuperado, lo revoca y adopta el sucesor', async () => {
    const successor = sessionWith(2000, 'succ');
    const ctx = await setupRecovery();
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      ctx.storage.writeExternal(successor);
      return { status: 'success', idToken: 'google-id-token' };
    });
    ageToExpired(ctx);
    const token = await ctx.service.authorizedCall(async (t) => t);
    await flush();

    expect(token).toBe(successor.accessToken);
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.api.logout).toHaveBeenCalledTimes(1); // el par recuperado no usado
  });

  it('un sucesor ya vencido tras la recuperación deja no disponible', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await setupRecovery();
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      ctx.storage.writeExternal(successor);
      return { status: 'success', idToken: 'google-id-token' };
    });
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);
    expect(ctx.service.getState().status).toBe('unavailable');
  });

  it('si no puede guardar el par recuperado no lo publica y lo revoca', async () => {
    const ctx = await setupRecovery();
    ctx.storage.failAlways('saveSession');
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    await flush();
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
    expect(ctx.api.logout).toHaveBeenCalledTimes(1);
  });

  it('no sobrescribe una sesión de versión futura', async () => {
    const ctx = await setupRecovery();
    (ctx.storage.loadSession as jest.Mock).mockResolvedValueOnce({ kind: 'unsupported' });
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
  });

  it('cooldown de 60 s tras una recuperación fallida; el inicio interactivo lo ignora', async () => {
    const ctx = await setupRecovery();
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(err('network'));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);

    ctx.clock.advance(30_000);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1); // dentro del cooldown

    ctx.clock.advance(31_000);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(2); // pasó el cooldown

    // El inicio interactivo del usuario no depende del cooldown y lo reinicia.
    await ctx.service.signOut();
    await ctx.service.signIn();
    expect(ctx.service.getState().status).toBe('authenticated');
    (ctx.api.refresh as jest.Mock).mockRejectedValue(invalidRefresh());
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(3);
  });
});

describe('cierre de sesión', () => {
  it('cierra el estado local de inmediato, antes de que responda la red', async () => {
    const ctx = await signedIn();
    const rt = ctx.storage.session()?.refreshToken;
    const gate = controlledPromise<void>();
    (ctx.api.logout as jest.Mock).mockImplementation(() => gate.promise);
    const pending = ctx.service.signOut();

    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
      user: null,
      notice: null,
    });
    await flush();
    expect(ctx.api.logout).toHaveBeenCalledTimes(1);
    expect(ctx.api.logout).toHaveBeenCalledWith(rt);
    gate.resolve();
    await expect(pending).resolves.toBe('revoked');
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.google.signOut).toHaveBeenCalledTimes(1);
  });

  it('sin red: un solo intento, resultado not-confirmed y aviso', async () => {
    const ctx = await signedIn();
    (ctx.api.logout as jest.Mock).mockRejectedValue(err('network'));
    await expect(ctx.service.signOut()).resolves.toBe('not-confirmed');

    expect(ctx.api.logout).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      notice: 'logout-unconfirmed',
    });
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('el aviso se limpia en el siguiente inicio de sesión', async () => {
    const ctx = await signedIn();
    (ctx.api.logout as jest.Mock).mockRejectedValue(err('network'));
    await ctx.service.signOut();
    expect(ctx.service.getState().notice).toBe('logout-unconfirmed');
    await ctx.service.signIn();
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', notice: null });
  });

  it('lee el refresh token del almacenamiento si no hay sesión en memoria', async () => {
    const { service, api, storage } = setup({ stored: stored(120) });
    await expect(service.signOut()).resolves.toBe('revoked');
    expect(api.logout).toHaveBeenCalledWith(refreshTokenOf('RT-A'));
    expect(storage.isEmpty()).toBe(true);
  });

  it('sin token en ninguna parte devuelve no-token y no llama a la API', async () => {
    const { service, api } = setup();
    await expect(service.signOut()).resolves.toBe('no-token');
    expect(api.logout).not.toHaveBeenCalled();
  });

  it('con el almacenamiento ilegible igualmente cierra y devuelve no-token', async () => {
    const { service, storage } = setup({ stored: stored(120) });
    storage.failNext('loadSession');
    await expect(service.signOut()).resolves.toBe('no-token');
  });

  it('si clearAll falla (con un reintento) avisa y no afirma limpieza', async () => {
    const ctx = await signedIn();
    ctx.storage.failNext('clearAll', 2);
    (ctx.api.logout as jest.Mock).mockRejectedValue(err('network'));
    await expect(ctx.service.signOut()).resolves.toBe('not-confirmed');

    expect(ctx.storage.clearAll).toHaveBeenCalledTimes(2);
    expect(ctx.service.getState().notice).toBe('logout-storage-error'); // no se pisa
  });

  it('un clearAll que falla una vez se reintenta y queda limpio', async () => {
    const ctx = await signedIn();
    ctx.storage.failNext('clearAll', 1);
    await ctx.service.signOut();
    expect(ctx.storage.clearAll).toHaveBeenCalledTimes(2);
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState().notice).toBeNull();
  });

  it('un fallo de Google no impide el cierre', async () => {
    const google = fakeGoogle({ signOut: jest.fn().mockRejectedValue(new Error('x')) });
    const ctx = await signedIn({ google });
    (ctx.google.signOut as jest.Mock).mockRejectedValue(new Error('x'));
    await expect(ctx.service.signOut()).resolves.toBe('revoked');
    expect(ctx.service.getState().status).toBe('unauthenticated');
  });

  it('logout con una renovación en vuelo: no se guarda ni se reautentica', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<ReturnType<typeof refreshedTokens>>();
    (ctx.api.refresh as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.resolve(refreshedTokens('tardia'));

    await expect(call).resolves.toBeInstanceOf(AuthError);
    await flush();
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState().status).toBe('unauthenticated');
  });

  it('logout con un guardado pendiente: el borrado queda último y no hay resurrección', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    const release = ctx.storage.hold('saveSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1); // retenido
    const loggingOut = ctx.service.signOut();
    release();
    await loggingOut;
    await call;
    await flush();

    expect(ctx.storage.log.slice(-1)).toEqual(['clearAll']);
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
  });

  it('logout con un guardado en cola que aún no corrió: el guardado se descarta', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    // Una operación previa retiene la cola mientras llega la respuesta del refresh.
    const release = ctx.storage.hold('loadSession');
    const reading = ctx.service.restore();
    await flush();
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([reading, call, loggingOut]);
    await flush();

    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState().status).toBe('unauthenticated');
  });

  it('logout durante el inicio de sesión: no autentica y revoca la familia nueva', async () => {
    const gate =
      controlledPromise<Awaited<ReturnType<ReturnType<typeof fakeApi>['exchangeGoogleToken']>>>();
    const api = fakeApi({ exchangeGoogleToken: jest.fn(() => gate.promise) });
    const { service, storage } = setup({ api });
    const signingIn = service.signIn();
    await flush();
    await service.signOut();
    gate.resolve({ ...refreshedTokens('tarde'), user: USER });
    await signingIn;
    await flush();

    expect(storage.saveSession).not.toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalledWith(refreshTokenOf('RT-tarde'));
    expect(service.getState()).toMatchObject({ status: 'unauthenticated', busy: false });
  });

  it('logout durante el guardado del inicio de sesión: no resucita', async () => {
    const { service, storage } = setup();
    const release = storage.hold('saveSession');
    const signingIn = service.signIn();
    await flush();
    const loggingOut = service.signOut();
    release();
    await Promise.all([signingIn, loggingOut]);
    await flush();

    expect(storage.isEmpty()).toBe(true);
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('el logout NO dispara recuperación con Google, ni durante ni después', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<never>();
    (ctx.api.refresh as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.reject(err('rejected', 401, 'INVALID_REFRESH_TOKEN'));
    await call;
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'rejected',
    });

    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
  });

  it('logout durante la recuperación con Google: no se intercambia ni se guarda', async () => {
    const ctx = await signedIn({
      api: fakeApi({
        refresh: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_REFRESH_TOKEN')),
      }),
    });
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    (ctx.google.signInSilently as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await call;

    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout tras el intercambio de la recuperación: revoca la familia descartada', async () => {
    const ctx = await signedIn({
      api: fakeApi({
        refresh: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_REFRESH_TOKEN')),
      }),
    });
    const gate =
      controlledPromise<Awaited<ReturnType<ReturnType<typeof fakeApi>['exchangeGoogleToken']>>>();
    (ctx.api.exchangeGoogleToken as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.resolve({ ...refreshedTokens('rec'), user: USER });
    await call;
    await flush();

    expect(ctx.api.logout).toHaveBeenCalledWith(refreshTokenOf('RT-rec'));
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout durante el guardado del par recuperado: no resucita', async () => {
    const ctx = await signedIn({
      api: fakeApi({
        refresh: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_REFRESH_TOKEN')),
      }),
    });
    ageToExpired(ctx);
    const release = ctx.storage.hold('saveSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, loggingOut]);
    await flush();

    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState().status).toBe('unauthenticated');
  });
});

describe('carreras con el cierre de sesión (epoch)', () => {
  const invalidRefresh = () => err('rejected', 401, 'INVALID_REFRESH_TOKEN');
  const recoveryCtx = () =>
    signedIn({ api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }) });
  const legacy: StoredLoad = { kind: 'legacy', token: 'jwt-v1-secreto' };

  it('un fallo de Google que llega tras el logout se ignora', async () => {
    const ctx = await recoveryCtx();
    const gate = controlledPromise<never>();
    (ctx.google.signInSilently as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.reject(err('network'));
    await call;
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
  });

  it('un fallo del intercambio que llega tras el logout se ignora', async () => {
    const ctx = await recoveryCtx();
    const gate = controlledPromise<never>();
    (ctx.api.exchangeGoogleToken as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.reject(err('server', 503));
    await call;
    expect(ctx.service.getState().signedOutReason).toBe('signed-out');
  });

  it('logout mientras se borra la sesión revocada: gana el logout', async () => {
    const ctx = await recoveryCtx();
    (ctx.google.signInSilently as jest.Mock).mockResolvedValue({ status: 'no-saved-credential' });
    ageToExpired(ctx);
    const release = ctx.storage.hold('clearAll');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, loggingOut]);
    expect(ctx.service.getState().signedOutReason).toBe('signed-out');
  });

  it('migración: un fallo de Google tras el logout se ignora', async () => {
    const gate = controlledPromise<never>();
    const google = fakeGoogle({ signInSilently: jest.fn(() => gate.promise) });
    const { service } = setup({ stored: legacy, google });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.reject(err('network'));
    await restoring;
    expect(service.getState().signedOutReason).toBe('signed-out');
  });

  it('migración: un fallo del intercambio tras el logout se ignora', async () => {
    const gate = controlledPromise<never>();
    const api = fakeApi({ exchangeGoogleToken: jest.fn(() => gate.promise) });
    const { service } = setup({ stored: legacy, api });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.reject(err('rejected'));
    await restoring;
    expect(service.getState().signedOutReason).toBe('signed-out');
  });

  it('migración: logout durante el guardado de v2 descarta el par', async () => {
    const { service, storage, api } = setup({ stored: legacy });
    const release = storage.hold('saveSession');
    const restoring = service.restore();
    await flush();
    const loggingOut = service.signOut();
    release();
    await Promise.all([restoring, loggingOut]);
    await flush();
    expect(storage.isEmpty()).toBe(true);
    expect(api.logout).toHaveBeenCalled();
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('migración: logout mientras se borra session_token no resucita', async () => {
    const { service, storage } = setup({ stored: legacy });
    const release = storage.hold('clearLegacy');
    const restoring = service.restore();
    await flush();
    const loggingOut = service.signOut();
    release();
    await Promise.all([restoring, loggingOut]);
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('restore: logout durante GET /me no publica la sesión', async () => {
    const gate = controlledPromise<typeof USER>();
    const api = fakeApi({ getMe: jest.fn(() => gate.promise) });
    const { service } = setup({ stored: stored(120), api });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.resolve(USER);
    await restoring;
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('restore: un fallo de GET /me tras el logout se ignora', async () => {
    const gate = controlledPromise<typeof USER>();
    const api = fakeApi({ getMe: jest.fn(() => gate.promise) });
    const { service } = setup({ stored: stored(120), api });
    const restoring = service.restore();
    await flush();
    await service.signOut();
    gate.reject(err('network'));
    await restoring;
    expect(service.getState().status).toBe('unauthenticated');
  });

  it('un fallo del inicio de sesión tras el logout se ignora', async () => {
    const gate = controlledPromise<never>();
    const api = fakeApi({ exchangeGoogleToken: jest.fn(() => gate.promise) });
    const { service } = setup({ api });
    const signingIn = service.signIn();
    await flush();
    await service.signOut();
    gate.reject(err('server', 503));
    await signingIn;
    expect(service.getState().error).toBeNull();
  });

  it('conflicto: lectura que termina tras el logout se ignora (con y sin error)', async () => {
    for (const failing of [false, true]) {
      const ctx = await signedIn({
        api: fakeApi({ refresh: rejectOnce(err('conflict', 409, 'REFRESH_CONFLICT')) }),
      });
      ageToExpired(ctx);
      const release = ctx.storage.hold('loadSession');
      if (failing) ctx.storage.failNext('loadSession');
      const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
      await flush();
      const loggingOut = ctx.service.signOut();
      release();
      await Promise.all([call, loggingOut]);
      expect(ctx.google.signInSilently).not.toHaveBeenCalled();
      expect(ctx.service.getState().status).toBe('unauthenticated');
    }
  });

  it('el borrado pendiente tras un logout fallido se reintenta en el siguiente inicio', async () => {
    const ctx = await signedIn();
    ctx.storage.failNext('clearAll', 2);
    await ctx.service.signOut();
    expect(ctx.service.getState().notice).toBe('logout-storage-error');

    await ctx.service.signIn();
    expect(ctx.storage.clearAll).toHaveBeenCalledTimes(3);
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('la llamada reactiva falla con la causa si la renovación no es posible', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(err('network')) }),
    });
    await expect(
      ctx.service.authorizedCall(async () => {
        throw err('rejected', 401, 'INVALID_TOKEN');
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('dependencias por defecto', () => {
  afterEach(() => jest.useRealTimers());

  it('usa reloj, espera y aleatorio reales cuando no se inyectan', async () => {
    jest.useFakeTimers({ now: NOW_MS });
    const storage = fakeStorage();
    const api = fakeApi({
      refresh: rejectOnce(err('conflict', 409, 'REFRESH_CONFLICT')),
    });
    const service = createAuthService({ google: fakeGoogle(), storage, api });
    await service.signIn();
    jest.advanceTimersByTime(901_000);
    const call = service.authorizedCall(async (t) => t);
    await jest.advanceTimersByTimeAsync(1_300);
    await call;
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.exchangeGoogleToken).toHaveBeenCalledTimes(2); // inicio + una recuperación
  });
});

describe('privacidad en consola', () => {
  it('ningún flujo, incluidos los fallos, registra tokens', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const secret = fakeJwt(900, USER, 'secreto');
    const api = fakeApi({
      exchangeGoogleToken: jest.fn(async () => ({
        ...refreshedTokens('secreto'),
        accessToken: secret,
        user: USER,
      })),
      refresh: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_REFRESH_TOKEN')),
      logout: jest.fn().mockRejectedValue(err('network')),
    });
    const ctx = await signedIn({ api });
    ctx.storage.failNext('saveSession', 4);
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await ctx.service.signOut();

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain(refreshTokenOf('RT-secreto'));
    spies.forEach((spy) => spy.mockRestore());
  });
});

// --- Correcciones del Paso 317.1 -------------------------------------------------------------

const invalidRefresh = () => err('rejected', 401, 'INVALID_REFRESH_TOKEN');
const conflict409 = () => err('conflict', 409, 'REFRESH_CONFLICT');
const logoutCalls = (ctx: Pick<Ctx, 'api'>) =>
  (ctx.api.logout as jest.Mock).mock.calls.map((call) => call[0] as string);
type Tokens = ReturnType<typeof refreshedTokens>;
const OTHER_USER = { id: 'sub-2', email: 'beto@example.com', name: 'Beto' };

describe('H1: limpieza pendiente obsoleta', () => {
  it('logout con clearAll fallido, signIn correcto y sesión no disponible: restore() no la borra', async () => {
    const ctx = await signedIn();
    ctx.storage.failAlways('clearAll');
    await ctx.service.signOut();
    expect(ctx.service.getState().notice).toBe('logout-storage-error'); // pendingClear

    await ctx.service.signIn(); // el clearAll sigue fallando pero el guardado funciona
    expect(ctx.service.getState().status).toBe('authenticated');
    const v2 = ctx.storage.session();
    expect(v2).not.toBeNull();

    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.service.getState().status).toBe('unavailable');

    const clears = (ctx.storage.clearAll as jest.Mock).mock.calls.length;
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore(); // Reintentar
    expect((ctx.storage.clearAll as jest.Mock).mock.calls.length).toBe(clears); // sin limpieza
    expect(ctx.storage.session()).not.toBeNull();
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('un restore() con la limpieza ya en cola no corre si un guardado nuevo apagó la marca', async () => {
    const ctx = await signedIn();
    ctx.storage.failNext('clearAll', 2);
    await ctx.service.signOut(); // marca pendiente
    const release = ctx.storage.hold('saveSession');
    const signingIn = ctx.service.signIn();
    await flush();
    const restoring = ctx.service.restore();
    release();
    await Promise.all([signingIn, restoring]);

    expect(ctx.storage.session()).not.toBeNull();
    expect(ctx.service.getState().status).toBe('authenticated');
  });
});

describe('H2: restore() concurrente con un ciclo activo', () => {
  it('con una renovación en vuelo espera el ciclo y no repone el par anterior', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<Tokens>();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    ageToMargin(ctx);
    const call = ctx.service.authorizedCall(async (t) => t);
    await flush();
    const restoring = ctx.service.restore();
    await flush();
    gate.resolve(refreshedTokens('nuevo'));
    await Promise.all([call, restoring]);

    expect(ctx.api.getMe).toHaveBeenCalledWith(refreshedTokens('nuevo').accessToken);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.session()?.refreshToken).toBe(refreshTokenOf('RT-nuevo'));
    const token = await ctx.service.authorizedCall(async (t) => t);
    expect(token).toBe(refreshedTokens('nuevo').accessToken);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: false });
  });

  it('con un logout durante el ciclo: no publica nada y solo revoca la familia del logout', async () => {
    const ctx = await signedIn();
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    const gate = controlledPromise<Tokens>();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    const restoring = ctx.service.restore();
    await flush();
    await ctx.service.signOut();
    gate.resolve(refreshedTokens('tarde'));
    await Promise.all([call, restoring]);
    await flush();

    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
      user: null,
    });
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.api.getMe).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([oldRefresh]); // el par rotado tardío no se revoca
  });

  it('una lectura anterior a la publicación de un ciclo posterior se relee', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    const release = ctx.storage.hold('loadSession');
    const restoring = ctx.service.restore();
    await flush();
    const call = ctx.service.authorizedCall(async (t) => t); // la cola queda tras la lectura
    await flush();
    release();
    await Promise.all([restoring, call]);

    const issued = (await (ctx.api.refresh as jest.Mock).mock.results[0]!.value) as Tokens;
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.getMe).toHaveBeenCalledWith(issued.accessToken);
    expect(ctx.storage.session()?.refreshToken).toBe(issued.refreshToken);
  });
});

describe('H3: tiempo límite de Google', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW_MS }));
  afterEach(() => jest.useRealTimers());
  const never = () => controlledPromise<{ status: 'success'; idToken: string }>();

  it('migración: signInSilently que no responde queda no disponible y el resultado tardío se ignora', async () => {
    const gate = never();
    const google = fakeGoogle({ signInSilently: jest.fn(() => gate.promise) });
    const { service, storage, api, clock } = setup({
      stored: { kind: 'legacy', token: 'jwt-v1-secreto' },
      google,
    });
    const restoring = service.restore();
    await flush();
    await jest.advanceTimersByTimeAsync(GOOGLE_SILENT_TIMEOUT_MS);
    await restoring;

    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
      busy: false,
    });
    expect(storage.legacyToken()).toBe('jwt-v1-secreto');
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await flush();
    expect(api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(storage.session()).toBeNull();

    // cycle y restoring quedaron libres: el reintento manual funciona
    (google.signInSilently as jest.Mock).mockResolvedValue({
      status: 'success',
      idToken: 'google-id-token',
    });
    clock.advance(RESTORE_MIN_INTERVAL_MS);
    await service.restore();
    expect(service.getState().status).toBe('authenticated');
  });

  it('recuperación: no destruye la sesión y un ID token tardío no se intercambia', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    const gate = never();
    (ctx.google.signInSilently as jest.Mock).mockImplementation(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await jest.advanceTimersByTimeAsync(GOOGLE_SILENT_TIMEOUT_MS);
    await expect(call).resolves.toMatchObject({ kind: 'network' });

    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
    });
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(ctx.storage.session()).not.toBeNull();
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await flush();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('signIn: vence el plazo, libera busy y el resultado tardío no abre sesión', async () => {
    const gate = never();
    const google = fakeGoogle({ signIn: jest.fn(() => gate.promise) });
    const { service, storage, api } = setup({ google });
    const signingIn = service.signIn();
    await flush();
    expect(service.getState().busy).toBe(true);
    await jest.advanceTimersByTimeAsync(GOOGLE_INTERACTIVE_TIMEOUT_MS);
    await signingIn;

    expect(service.getState()).toMatchObject({ busy: false, error: 'network' });
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await flush();
    expect(api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState().status).not.toBe('authenticated');
  });

  it('signIn: un ID token que llega tras un logout no se intercambia', async () => {
    const gate = never();
    const google = fakeGoogle({ signIn: jest.fn(() => gate.promise) });
    const { service, storage, api } = setup({ google });
    const signingIn = service.signIn();
    await flush();
    await service.signOut();
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await signingIn;

    expect(api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(storage.isEmpty()).toBe(true);
    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
      busy: false,
      error: null,
    });
  });

  it('el plazo se cancela cuando Google responde a tiempo', async () => {
    const { service } = setup();
    await service.signIn();
    expect(jest.getTimerCount()).toBe(0);
    expect(service.getState().status).toBe('authenticated');
  });

  it('una excepción síncrona de Google se trata como error y cancela el plazo', async () => {
    const google = fakeGoogle({
      signIn: jest.fn(() => {
        throw err('config');
      }),
    });
    const { service } = setup({ google });
    await service.signIn();
    expect(service.getState().error).toBe('config');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('H4: errores tardíos y epoch', () => {
  it('un error inesperado del ciclo tras el logout no sustituye signed-out', async () => {
    let explode = false;
    const clock = fakeClock();
    const storage = fakeStorage();
    const api = fakeApi();
    const service = createAuthService({
      google: fakeGoogle(),
      storage,
      api,
      now: () => {
        if (explode) {
          explode = false; // lanza una sola vez
          throw new Error('fallo inesperado');
        }
        return clock.now();
      },
      sleep: clock.sleep,
      random: clock.random,
    });
    await service.signIn();
    const gate = controlledPromise<Tokens>();
    (api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    clock.advance(901_000);
    const call = service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await service.signOut();
    explode = true;
    gate.resolve(refreshedTokens('tarde'));
    await call;
    explode = false;

    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
  });

  it('un error inesperado del ciclo sin logout se contiene como no disponible', async () => {
    let explode = false;
    const clock = fakeClock();
    const api = fakeApi();
    const service = createAuthService({
      google: fakeGoogle(),
      storage: fakeStorage(),
      api,
      now: () => {
        if (explode) {
          explode = false; // lanza una sola vez
          throw new Error('fallo inesperado');
        }
        return clock.now();
      },
      sleep: clock.sleep,
      random: clock.random,
    });
    await service.signIn();
    clock.advance(901_000);
    (api.refresh as jest.Mock).mockImplementationOnce(async () => {
      explode = true;
      return refreshedTokens('x');
    });
    await service.authorizedCall(async (t) => t).catch(() => undefined);
    explode = false;
    expect(service.getState()).toMatchObject({ status: 'unavailable', unavailableCause: 'server' });
  });

  it('migración: el guardado fallido que termina tras el logout no deja no disponible', async () => {
    const { service, storage } = setup({ stored: { kind: 'legacy', token: 'jwt-v1-secreto' } });
    const release = storage.hold('saveSession');
    storage.failNext('saveSession', 1);
    const restoring = service.restore();
    await flush();
    const loggingOut = service.signOut();
    release();
    await Promise.all([restoring, loggingOut]);
    await flush();

    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
  });

  it('restore: la lectura que falla tras el logout se ignora', async () => {
    const { service, storage } = setup({ stored: stored(120) });
    const release = storage.hold('loadSession');
    storage.failNext('loadSession', 1);
    const restoring = service.restore();
    await flush();
    const loggingOut = service.signOut();
    release();
    await Promise.all([restoring, loggingOut]);

    expect(service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
  });

  it('un suscriptor que lanza no rompe el servicio', async () => {
    const { service } = setup();
    service.subscribe(() => {
      throw new Error('suscriptor defectuoso');
    });
    await service.signIn();
    expect(service.getState().status).toBe('authenticated');
  });
});

describe('M12 y M24: identidad del ciclo', () => {
  it('M12: logout, nuevo signIn y refresh con el ciclo viejo en vuelo: no se une a él', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<Tokens>();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    ageToExpired(ctx);
    const oldCall = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    await ctx.service.signIn();
    (ctx.api.refresh as jest.Mock).mockResolvedValueOnce(refreshedTokens('nueva'));
    ageToMargin(ctx);
    const token = await ctx.service.authorizedCall(async (t) => t); // no recibe "rejected"
    expect(token).toBe(refreshedTokens('nueva').accessToken);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2);

    gate.resolve(refreshedTokens('vieja'));
    await oldCall;
    await flush();
    expect(ctx.storage.session()?.refreshToken).toBe(refreshTokenOf('RT-nueva'));
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('M24: un nuevo signIn con una rotación anterior en vuelo no es sobrescrito por ella', async () => {
    const ctx = await signedIn();
    const gate = controlledPromise<Tokens>();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    ageToExpired(ctx);
    const oldCall = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signIn();
    const newRefresh = ctx.storage.session()?.refreshToken;
    const savesBefore = (ctx.storage.saveSession as jest.Mock).mock.calls.length;

    // una renovación de la sesión nueva tampoco se une al ciclo viejo
    (ctx.api.refresh as jest.Mock).mockResolvedValueOnce(refreshedTokens('nueva'));
    ageToMargin(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    gate.resolve(refreshedTokens('vieja'));
    await oldCall;
    await flush();

    expect(ctx.storage.session()?.refreshToken).toBe(refreshTokenOf('RT-nueva'));
    expect(ctx.storage.session()?.refreshToken).not.toBe(newRefresh);
    expect((ctx.storage.saveSession as jest.Mock).mock.calls.length).toBe(savesBefore + 1);
    expect(ctx.service.getState().status).toBe('authenticated');
  });
});

describe('recuperación que devuelve otro usuario', () => {
  const otherSession = (label: string) => ({ ...refreshedTokens(label), user: OTHER_USER });

  it('401: no reemplaza la sesión, revoca solo la familia nueva y pide un inicio interactivo', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    (ctx.api.exchangeGoogleToken as jest.Mock).mockResolvedValueOnce(otherSession('otro'));
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'rejected',
    });
    await flush();
    expect(logoutCalls(ctx)).not.toContain(oldRefresh); // L1: la familia antigua no se revoca

    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'absent',
      error: 'conflict',
      user: null,
      busy: false,
    });
    expect(AUTH_ERROR_MESSAGES.conflict).toMatch(/cuenta de Google cambió/);
    expect(AUTH_ERROR_MESSAGES.conflict).not.toMatch(/revoc/i);
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(logoutCalls(ctx)).toEqual([refreshTokenOf('RT-otro')]);
  });

  it('409 sin sucesor: mismo tratamiento', async () => {
    const ctx = await signedIn({ api: fakeApi({ refresh: rejectOnce(conflict409()) }) });
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    (ctx.api.exchangeGoogleToken as jest.Mock).mockResolvedValueOnce(otherSession('otro'));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toBeInstanceOf(AuthError);
    await flush();
    expect(logoutCalls(ctx)).not.toContain(oldRefresh); // L1: puede haber un sucesor legítimo

    expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', error: 'conflict' });
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1); // solo la marca de consumido
    expect(logoutCalls(ctx)).toEqual([refreshTokenOf('RT-otro')]);
  });

  it('si no se puede borrar el almacenamiento queda no disponible (storage), sin sesión nueva', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    (ctx.api.exchangeGoogleToken as jest.Mock).mockResolvedValueOnce(otherSession('otro'));
    ctx.storage.failAlways('clearAll');
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
  });

  it('el mismo usuario sí se recupera con normalidad', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', user: USER });
  });
});

describe('REFRESH_CONFLICT: casos adicionales', () => {
  it('sin sucesor dentro del cooldown: ni Google ni nueva familia, y no reenvía en el mismo ciclo', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(err('network'));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'network',
    });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1); // el 409 no se reenvía dentro del ciclo
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);

    ctx.clock.advance(1_000); // dentro del cooldown de 60 s
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'server',
    });
    expect(ctx.storage.session()).not.toBeNull();

    ctx.clock.advance(RECOVERY_COOLDOWN_MS); // vencido el cooldown vuelve a intentarse UNA vez
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(2);
  });

  it('sucesor distinto que también da 409: unavailable(server), sin Google ni logout', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await signedIn();
    (ctx.api.refresh as jest.Mock)
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(successor);
        throw conflict409();
      })
      .mockRejectedValueOnce(conflict409());
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'server',
    });
  });
});

describe('revocaciones: conjunto exacto de llamadas a api.logout', () => {
  it('recuperación exitosa: solo la familia vieja', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    await flush();
    expect(logoutCalls(ctx)).toEqual([oldRefresh]);
  });

  it('par rotado recibido tarde tras un logout: solo el logout explícito', async () => {
    const ctx = await signedIn();
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    const gate = controlledPromise<Tokens>();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(() => gate.promise);
    ageToExpired(ctx);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    await ctx.service.signOut();
    gate.resolve(refreshedTokens('tarde'));
    await call;
    await flush();
    expect(logoutCalls(ctx)).toEqual([oldRefresh]);
  });

  it('par rotado que no se pudo guardar: no se revoca', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    ctx.storage.failNext('saveSession', 2);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await flush();
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('inicio de sesión que no se pudo guardar: solo la familia nueva', async () => {
    const { service, storage, api } = setup();
    storage.failAlways('saveSession');
    await service.signIn();
    await flush();
    expect(logoutCalls({ api })).toHaveLength(1);
    expect((api.logout as jest.Mock).mock.calls[0]?.[0]).toBe(refreshTokenOf('RT-google-1'));
  });

  it('recuperación cuyo guardado falla: solo la familia nueva (la vieja no se revoca)', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    ctx.storage.failAlways('saveSession');
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await flush();
    const issued = (await (ctx.api.exchangeGoogleToken as jest.Mock).mock.results[0]!
      .value) as Tokens;
    expect(logoutCalls(ctx)).toEqual([issued.refreshToken]);
  });
});

describe('mensajes por causa', () => {
  const unavailableBy = async (failure: AuthError) => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(failure);
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    const { unavailableCause, error } = ctx.service.getState();
    return { text: unavailableMessage(unavailableCause!, error), error, unavailableCause };
  };

  it.each(['play-services', 'config', 'unknown'] as const)(
    '%s tiene un texto propio, distinto del de servidor',
    async (kind) => {
      const { text, error, unavailableCause } = await unavailableBy(err(kind));
      expect(unavailableCause).toBe('server');
      expect(error).toBe(kind);
      expect(text).toBe(AUTH_ERROR_MESSAGES[kind]);
      expect(text).not.toBe(UNAVAILABLE_MESSAGES.server);
    },
  );

  it('red y servidor conservan sus textos, sin detalle adicional', async () => {
    const network = await unavailableBy(err('network'));
    expect(network.text).toBe(UNAVAILABLE_MESSAGES.network);
    expect(network.error).toBeNull();

    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(err('server', 503)) }),
    });
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    const { unavailableCause, error } = ctx.service.getState();
    expect(unavailableMessage(unavailableCause!, error)).toBe(UNAVAILABLE_MESSAGES.server);
    expect(error).toBeNull();
  });

  it('el error detallado se propaga también a quien llama (no se disfraza de servidor)', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(err('play-services'));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'play-services',
    });
  });

  it.each([{ status: 'no-saved-credential' }, { status: 'cancelled' }] as const)(
    'sin credencial de Google (%j): ofrece ingresar con un texto neutro, sin afirmar revocación',
    async (result) => {
      const ctx = await signedIn({
        api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
      });
      (ctx.google.signInSilently as jest.Mock).mockResolvedValue(result);
      ageToExpired(ctx);
      await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);

      const state = ctx.service.getState();
      expect(state).toMatchObject({ status: 'unauthenticated', error: null, user: null });
      const text = SIGNED_OUT_MESSAGES[state.signedOutReason!];
      expect(text).toBe('Tu sesión ya no está disponible en este dispositivo. Ingresa con Google.');
      expect(text).not.toMatch(/revoc|servidor/i);
    },
  );

  it('ningún texto visible menciona tokens ni afirma una revocación remota', () => {
    const all = [
      ...Object.values(AUTH_ERROR_MESSAGES),
      ...Object.values(UNAVAILABLE_MESSAGES),
      ...Object.values(LOGOUT_NOTICE_MESSAGES),
      ...Object.values(SIGNED_OUT_MESSAGES).filter((text): text is string => text !== null),
    ];
    all.forEach((text) => {
      expect(text).not.toMatch(/token|eyJ/i);
    });
    expect(Object.values(SIGNED_OUT_MESSAGES).join(' ')).not.toMatch(/revocad/i);
  });
});

describe('Reintentar repetido', () => {
  it('con un 401 persistente no rota por pulsación: respeta el intervalo mínimo', async () => {
    const api = fakeApi({
      getMe: jest.fn().mockRejectedValue(err('rejected', 401, 'INVALID_TOKEN')),
    });
    const { service, api: sameApi, clock } = setup({ stored: stored(120), api });
    await service.restore();
    expect(service.getState()).toMatchObject({ status: 'unavailable', unavailableCause: 'server' });
    expect(sameApi.refresh).toHaveBeenCalledTimes(1);
    const meCalls = (api.getMe as jest.Mock).mock.calls.length;

    for (let press = 0; press < 3; press += 1) {
      clock.advance(1_000);
      await service.restore();
      expect(service.getState().busy).toBe(false);
    }
    expect(sameApi.refresh).toHaveBeenCalledTimes(1); // sin rotaciones por pulsación
    expect((api.getMe as jest.Mock).mock.calls.length).toBe(meCalls);

    clock.advance(2_000); // se cumplen 5 s desde el último intento
    await service.restore();
    expect(sameApi.refresh).toHaveBeenCalledTimes(2);
  });

  it('varias pulsaciones simultáneas comparten un solo intento', async () => {
    const refresh = jest.fn().mockRejectedValue(err('network'));
    const { service, clock } = setup({ stored: stored(-10), api: fakeApi({ refresh }) });
    await service.restore();
    clock.advance(RESTORE_MIN_INTERVAL_MS);
    await Promise.all([service.restore(), service.restore(), service.restore()]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('un fallo de almacenamiento se puede reintentar sin esperar', async () => {
    const { service, storage } = setup({ stored: stored(120) });
    storage.failNext('loadSession', 1);
    await service.restore();
    expect(service.getState().unavailableCause).toBe('storage');
    await service.restore();
    expect(service.getState().status).toBe('authenticated');
  });
});

describe('privacidad en consola: flujos nuevos', () => {
  it('ni el cambio de cuenta ni los plazos de Google registran tokens', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const secret = fakeJwt(900, OTHER_USER, 'secreto-otro');
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) });
    const ctx = await signedIn({ api });
    (api.exchangeGoogleToken as jest.Mock).mockResolvedValueOnce({
      ...refreshedTokens('secreto-otro'),
      accessToken: secret,
      user: OTHER_USER,
    });
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await flush();

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain(refreshTokenOf('RT-secreto-otro'));
    expect(logged).not.toContain('google-id-token');
    spies.forEach((spy) => spy.mockRestore());
  });

  it('los errores del servicio solo llevan la categoría, nunca un token', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(err('network')) }),
    });
    ageToExpired(ctx);
    const failure = await ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    expect((failure as AuthError).message).toBe('network');
  });
});

describe('M1: restore() que espera un ciclo fallido no lanza un segundo refresh', () => {
  it('una pulsación de Reintentar con un ciclo en vuelo que falla: exactamente 1 api.refresh', async () => {
    const refresh = jest.fn().mockRejectedValueOnce(err('network'));
    const ctx = await signedIn({ api: fakeApi({ refresh }) });
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.service.getState().status).toBe('unavailable');
    expect(refresh).toHaveBeenCalledTimes(1);

    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    const gate = controlledPromise<Tokens>();
    refresh.mockImplementationOnce(() => gate.promise);
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush(); // el ciclo está en vuelo
    const pressed = ctx.service.restore(); // Reintentar mientras tanto
    expect(ctx.service.getState().busy).toBe(true);
    await flush();
    gate.reject(err('network'));
    await Promise.all([call, pressed]);

    expect(refresh).toHaveBeenCalledTimes(2); // el del ciclo; restore() no añade otro
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
      busy: false,
    });
    expect(ctx.storage.session()).not.toBeNull();

    // Sigue siendo posible reintentar después, respetando el intervalo mínimo.
    ctx.clock.advance(1_000);
    await ctx.service.restore();
    expect(refresh).toHaveBeenCalledTimes(2);
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    refresh.mockResolvedValueOnce(refreshedTokens('despues'));
    await ctx.service.restore();
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', busy: false });
  });

  it('con el access aún vigente, el ciclo fallido deja degradado y restore() no repite', async () => {
    const refresh = jest.fn();
    const ctx = await signedIn({ api: fakeApi({ refresh }) });
    ageToMargin(ctx);
    const gate = controlledPromise<Tokens>();
    refresh.mockImplementationOnce(() => gate.promise);
    const call = ctx.service.authorizedCall(async (t) => t);
    await flush();
    const restoring = ctx.service.restore();
    await flush();
    gate.reject(err('server', 503));
    await Promise.all([call, restoring]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
  });
});

describe('m6: logout durante el guardado de una rotación que ya respondió', () => {
  it('api.logout recibe EXACTAMENTE el refresh previo; el par rotado no se revoca', async () => {
    const ctx = await signedIn();
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    const release = ctx.storage.hold('saveSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1); // ya respondió
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1); // guardado retenido
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, loggingOut]);
    await flush();

    const rotated = ((await (ctx.api.refresh as jest.Mock).mock.results[0]!.value) as Tokens)
      .refreshToken;
    expect(logoutCalls(ctx)).toEqual([oldRefresh]);
    expect(logoutCalls(ctx)).not.toContain(rotated);
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState().signedOutReason).toBe('signed-out');
  });
});

describe('m13: plazos de Google con valores literales', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW_MS }));
  afterEach(() => jest.useRealTimers());

  it('silencioso: no vence a 14_999 ms y sí a 15_000 ms', async () => {
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    const google = fakeGoogle({ signInSilently: jest.fn(() => gate.promise) });
    const { service } = setup({ stored: { kind: 'legacy', token: 'jwt-v1-secreto' }, google });
    const restoring = service.restore();
    await flush();
    await jest.advanceTimersByTimeAsync(14_999);
    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('initializing');

    await jest.advanceTimersByTimeAsync(1);
    await restoring;
    expect(service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
    });
  });

  it('interactivo: no vence a 59_999 ms y sí a 60_000 ms', async () => {
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    const google = fakeGoogle({ signIn: jest.fn(() => gate.promise) });
    const { service } = setup({ google });
    const signingIn = service.signIn();
    await flush();
    await jest.advanceTimersByTimeAsync(59_999);
    expect(service.getState()).toMatchObject({ busy: true, error: null });

    await jest.advanceTimersByTimeAsync(1);
    await signingIn;
    expect(service.getState()).toMatchObject({ busy: false, error: 'network' });
  });
});

describe('cambio de cuenta de Google: la familia antigua no se revoca (L1)', () => {
  const other = (label: string) => ({ ...refreshedTokens(label), user: OTHER_USER });

  it.each([
    ['401 INVALID_REFRESH_TOKEN', () => jest.fn().mockRejectedValue(invalidRefresh())],
    ['409 REFRESH_CONFLICT sin sucesor', () => rejectOnce(conflict409())],
  ] as const)('%s: api.logout recibe solo la familia nueva', async (name, makeRefresh) => {
    const ctx = await signedIn({ api: fakeApi({ refresh: makeRefresh() }) });
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    (ctx.api.exchangeGoogleToken as jest.Mock).mockResolvedValueOnce(other('otro'));
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await flush();

    expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', error: 'conflict' });
    // el 409 solo escribe la marca de consumido; el 401 no escribe nada
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(name.startsWith('409') ? 1 : 0);
    expect(logoutCalls(ctx)).toEqual([refreshTokenOf('RT-otro')]);
    expect(logoutCalls(ctx)).not.toContain(oldRefresh);
  });
});

describe('privacidad en consola: M1, m6 y m13', () => {
  it('ni la carrera de restore(), ni el logout durante el guardado, ni los plazos registran tokens', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const ctx = await signedIn();
    ageToExpired(ctx);
    const release = ctx.storage.hold('saveSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    await flush();
    const restoring = ctx.service.restore();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, restoring, loggingOut]);
    await flush();

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toMatch(/RT-|eyJ|google-id-token/);
    spies.forEach((spy) => spy.mockRestore());
  });
});

describe('M2: refresh token consumido (marca refreshConsumed)', () => {
  const OK = { status: 'success', idToken: 'google-id-token' } as const;
  // Sesión autenticada cuyo refresh responde 409 siempre, con el access ya vencido.
  const consumedByConflict = async (opts: { googleFails?: AuthError } = {}) => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    if (opts.googleFails) {
      (ctx.google.signInSilently as jest.Mock).mockRejectedValue(opts.googleFails);
    }
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    return { ctx, oldRefresh };
  };

  it('(a) 409 sin sucesor: la marca se persiste ANTES de llamar a Google', async () => {
    const { ctx, oldRefresh } = await consumedByConflict();
    const seen: unknown[] = [];
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      seen.push(ctx.storage.session()?.refreshConsumed, ctx.storage.session()?.refreshToken);
      return OK;
    });
    await ctx.service.authorizedCall(async (t) => t);

    expect(seen).toEqual([true, oldRefresh]); // en disco ya estaba marcada cuando se llamó a Google
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined(); // sesión nueva sin marca
    expect(ctx.storage.session()?.refreshToken).not.toBe(oldRefresh);
    expect(logoutCalls(ctx)).toEqual([]); // origen 409: el token antiguo no se revoca
  });

  it('(b) si la marca no se puede escribir: 0 llamadas a Google y unavailable(storage)', async () => {
    const { ctx } = await consumedByConflict();
    ctx.storage.failAlways('saveSession');
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });

    // Reintentos en el mismo proceso: el token consumido no se reenvía (la marca sigue en memoria).
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('(c) tras 409 + Google transitorio fallido: nunca se reenvía el token consumido', async () => {
    const { ctx } = await consumedByConflict({ googleFails: err('network') });
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'network',
    });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.session()?.refreshConsumed).toBe(true);

    ctx.clock.advance(RECOVERY_COOLDOWN_MS + 1_000); // fin del cooldown
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(2); // un intento por ciclo permitido

    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS); // Reintentar (dentro del cooldown)
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(2);

    ctx.clock.advance(RECOVERY_COOLDOWN_MS);
    await ctx.service.restore();
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
  });

  it('(d) REINICIO con access vencido: 0 refresh con el token consumido y 1 signInSilently', async () => {
    const { ctx, oldRefresh } = await consumedByConflict({ googleFails: err('network') });
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.storage.session()?.refreshConsumed).toBe(true);
    jest.clearAllMocks();

    const restarted = ctx.make(); // proceso nuevo sobre el MISMO almacenamiento
    (ctx.google.signInSilently as jest.Mock).mockResolvedValue(OK);
    await restarted.restore();

    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(restarted.getState().status).toBe('authenticated');
    expect(ctx.storage.session()?.refreshToken).not.toBe(oldRefresh);
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('(d) REINICIO con access vigente: getMe sin refresh; al vencer, atajo a Google', async () => {
    const consumed: StoredSessionV2 = { ...sessionWith(900, 'A'), refreshConsumed: true };
    const ctx = setup({ stored: { kind: 'session', session: consumed } });
    await ctx.service.restore();

    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('authenticated');

    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(logoutCalls(ctx)).toEqual([]); // origen 409 (marca): sin revocar el token antiguo
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
  });

  it('(d) REINICIO con Google caído: sigue sin reenviar el token y respeta el cooldown', async () => {
    const consumed: StoredSessionV2 = { ...sessionWith(-10, 'A'), refreshConsumed: true };
    const google = fakeGoogle({ signInSilently: jest.fn().mockRejectedValue(err('network')) });
    const ctx = setup({ stored: { kind: 'session', session: consumed }, google });
    await ctx.service.restore();
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'network',
    });
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore(); // dentro del cooldown de 60 s
    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(ctx.api.refresh).not.toHaveBeenCalled();
  });

  it('(e) si aparece un sucesor entre la lectura y la marca: no se marca, no se revoca, sin Google', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    const base = ctx.storage.session() as StoredSessionV2;
    const successor = sessionWith(2000, 'succ');
    // La primera relectura (resolveConflict) aún ve el token base; luego aparece el sucesor.
    (ctx.storage.loadSession as jest.Mock).mockImplementationOnce(async () => {
      ctx.storage.writeExternal(successor);
      return { kind: 'session', session: base };
    });
    ageToExpired(ctx);
    const token = await ctx.service.authorizedCall(async (t) => t);

    expect(token).toBe(successor.accessToken);
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.session()).toEqual(successor);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('(e) un sucesor marcado por otro proceso se trata igual: sin refresh, a Google', async () => {
    const successor: StoredSessionV2 = { ...sessionWith(-10, 'succ'), refreshConsumed: true };
    const ctx = await signedIn();
    (ctx.api.refresh as jest.Mock).mockImplementationOnce(async () => {
      ctx.storage.writeExternal(successor);
      throw conflict409();
    });
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1); // el sucesor consumido no se envía
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('(f) recuperación por 401: sí revoca la familia antigua (token ya muerto, inocuo)', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
    });
    const oldRefresh = ctx.storage.session()?.refreshToken as string;
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    await flush();
    expect(logoutCalls(ctx)).toEqual([oldRefresh]);
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1); // el 401 no escribe marca
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
  });

  it('(g) logout concurrente con la escritura de la marca: nada se revive ni se llama a Google', async () => {
    const { ctx, oldRefresh } = await consumedByConflict();
    const release = ctx.storage.hold('saveSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1); // la marca está retenida
    const restoring = ctx.service.restore();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, restoring, loggingOut]);
    await flush();

    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
    expect(logoutCalls(ctx)).toEqual([oldRefresh]); // solo el logout explícito
  });

  it('(g) llamadas paralelas con 409: un solo ciclo, una marca, un exchange', async () => {
    const { ctx } = await consumedByConflict();
    const results = await Promise.all([
      ctx.service.authorizedCall(async (t) => t),
      ctx.service.authorizedCall(async (t) => t),
      ctx.service.restore(),
    ]);
    expect(results[0]).toBe(results[1]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
  });

  it('(h) sesión v2 sin marca (antigua): renueva con refresh como siempre', async () => {
    const ctx = setup({ stored: stored(-10) });
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
  });

  it('(h) migración v1: la sesión v2 resultante no lleva marca', async () => {
    const ctx = setup({ stored: { kind: 'legacy', token: 'jwt-v1' } });
    await ctx.service.restore();
    expect(ctx.service.getState().status).toBe('authenticated');
    expect(ctx.storage.session()?.version).toBe(2);
    expect(ctx.storage.session()).not.toHaveProperty('refreshConsumed');
    expect(ctx.api.refresh).not.toHaveBeenCalled();
  });

  it('(h) rotación normal tras una marca ajena sin efecto: la sesión rotada no hereda marca', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.storage.session()).not.toHaveProperty('refreshConsumed');
  });

  describe('(i) plazo de 15 s de la recuperación con literales', () => {
    beforeEach(() => jest.useFakeTimers({ now: NOW_MS }));
    afterEach(() => jest.useRealTimers());

    it.each([
      ['409', () => jest.fn().mockRejectedValue(conflict409())],
      ['401', () => jest.fn().mockRejectedValue(invalidRefresh())],
    ])('%s: no vence a 14_999 ms y sí a 15_000 ms', async (_origin, makeRefresh) => {
      const gate = controlledPromise<{ status: 'success'; idToken: string }>();
      const ctx = await signedIn({ api: fakeApi({ refresh: makeRefresh() }) });
      (ctx.google.signInSilently as jest.Mock).mockImplementation(() => gate.promise);
      ageToExpired(ctx);
      const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
      await flush();
      await jest.advanceTimersByTimeAsync(14_999);
      expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
      let settled = false;
      void call.then(() => {
        settled = true;
      });
      await flush();
      expect(settled).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await expect(call).resolves.toMatchObject({ kind: 'network' });
      expect(ctx.service.getState()).toMatchObject({
        status: 'unavailable',
        unavailableCause: 'network',
      });
      expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled(); // el ID token tardío se descarta
    });
  });

  describe('(j) un logout llega justo tras guardar la sesión recuperada', () => {
    // El guardado de recover termina y, antes de que recover reanude, un logout cambia el epoch.
    // Se prueba con N microtareas de desfase tras saveSession para cubrir la ventana sin tocar
    // producción. Cualquiera sea la rama alcanzada, la familia nueva se revoca y no queda sesión.
    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('desfase de %i microtareas', async (hops) => {
      const ctx = await signedIn({
        api: fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) }),
      });
      const oldRefresh = ctx.storage.session()?.refreshToken as string;
      const realSave = ctx.storage.saveSession.getMockImplementation() as (
        s: StoredSessionV2,
      ) => Promise<void>;
      let armed = true;
      let loggingOut: Promise<unknown> = Promise.resolve();
      ctx.storage.saveSession.mockImplementation(async (s: StoredSessionV2) => {
        await realSave(s);
        if (!armed) return;
        armed = false;
        let chain: Promise<void> = Promise.resolve();
        for (let i = 0; i < hops; i += 1) chain = chain.then(() => undefined);
        void chain.then(() => {
          loggingOut = ctx.service.signOut();
        });
      });
      ageToExpired(ctx);
      const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
      await flush(60);
      await call;
      await loggingOut;
      await flush();

      const issued = (await (ctx.api.exchangeGoogleToken as jest.Mock).mock.results[0]!
        .value) as Tokens;
      expect(ctx.storage.isEmpty()).toBe(true);
      expect(ctx.service.getState().status).toBe('unauthenticated');
      expect(logoutCalls(ctx)).toContain(issued.refreshToken); // la familia nueva no queda huérfana
      expect(logoutCalls(ctx)).toContain(oldRefresh); // y el logout explícito revocó lo suyo
    });
  });

  it('(k) los flujos nuevos no registran tokens en console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { ctx } = await consumedByConflict({ googleFails: err('network') });
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    ctx.storage.failAlways('saveSession');
    const restarted = ctx.make();
    await restarted.restore();
    ctx.clock.advance(RECOVERY_COOLDOWN_MS + 1);
    await restarted.restore();
    await flush();
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toMatch(/RT-|eyJ|google-id-token/);
    spies.forEach((spy) => spy.mockRestore());
  });
});

describe('M2 ronda 2: marca del sucesor, fusión al restaurar y persistencia diferida', () => {
  const OK = { status: 'success', idToken: 'google-id-token' } as const;

  it('H3: un segundo 409 sobre el sucesor lo marca; Reintentar y REINICIO no lo reenvían', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await signedIn();
    (ctx.api.refresh as jest.Mock)
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(successor);
        throw conflict409();
      })
      .mockRejectedValue(conflict409());
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(err('network'));
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled(); // en ese momento, sin Google
    expect(ctx.storage.session()).toMatchObject({
      refreshToken: successor.refreshToken,
      refreshConsumed: true,
    });

    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS); // Reintentar: guard de memoria marcada
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);

    const restarted = ctx.make(); // REINICIO sobre el mismo almacenamiento
    await restarted.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2);
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('H3: segundo 409 con un tercer sucesor: queda en memoria sin enviarse ni marcarse', async () => {
    const second = sessionWith(-10, 'succ');
    const third = sessionWith(-10, 'third');
    const ctx = await signedIn();
    (ctx.api.refresh as jest.Mock)
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(second);
        throw conflict409();
      })
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(third);
        throw conflict409();
      });
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2);
    expect(ctx.storage.session()).toEqual(third);
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('H3: si la marca del sucesor no se puede escribir queda unavailable(storage)', async () => {
    const successor = sessionWith(-10, 'succ');
    const ctx = await signedIn();
    (ctx.api.refresh as jest.Mock)
      .mockImplementationOnce(async () => {
        ctx.storage.writeExternal(successor);
        ctx.storage.failAlways('saveSession');
        throw conflict409();
      })
      .mockRejectedValue(conflict409());
    ageToExpired(ctx);
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(2); // el sucesor consumido no se reenvía
  });

  it('H4: memoria sin marca + disco marcado por otro proceso: se fusiona (0 refresh, 1 Google)', async () => {
    const ctx = await signedIn();
    const onDisk = ctx.storage.session() as StoredSessionV2;
    ctx.storage.writeExternal({ ...onDisk, refreshConsumed: true });
    ageToExpired(ctx);
    await ctx.service.restore();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('H4: memoria marcada + disco sin marca: se conserva la marca de memoria', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    (ctx.google.signInSilently as jest.Mock).mockRejectedValue(err('network'));
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    const marked = ctx.storage.session() as StoredSessionV2;
    ctx.storage.writeExternal({ ...marked, refreshConsumed: undefined }); // disco sin marca
    ctx.clock.advance(RECOVERY_COOLDOWN_MS + 1);
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(2);
  });

  it('persistencia diferida: Reintentar escribe la marca ANTES de llamar a Google', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    ctx.storage.failAlways('saveSession');
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();

    ctx.storage.failNext('saveSession', 0); // el disco se recupera
    const seen: unknown[] = [];
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      seen.push(ctx.storage.session()?.refreshConsumed);
      return OK;
    });
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();

    expect(seen).toEqual([true]); // la marca ya estaba en disco al llamar a Google
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState().status).toBe('authenticated');
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
  });

  it('persistencia diferida: si el disco sigue fallando, Reintentar no llama a Google', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    ctx.storage.failAlways('saveSession');
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ unavailableCause: 'storage' });
  });

  it('persistencia diferida: un sucesor aparecido antes de Reintentar se adopta sin marcarlo', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    ctx.storage.failAlways('saveSession');
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    ctx.storage.failNext('saveSession', 0);
    const successor = sessionWith(2000, 'succ');
    ctx.storage.writeExternal(successor);
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(ctx.service.getState().status).toBe('authenticated');
    expect(ctx.storage.session()).toEqual(successor);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('persistencia diferida: un logout durante el reintento de la marca termina sin Google', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    ctx.storage.failAlways('saveSession');
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    ctx.storage.failNext('saveSession', 0);
    ctx.clock.advance(RECOVERY_COOLDOWN_MS);
    const release = ctx.storage.hold('loadSession');
    const call = ctx.service.authorizedCall(async (t) => t).catch((e: unknown) => e);
    await flush();
    const loggingOut = ctx.service.signOut();
    release();
    await Promise.all([call, loggingOut]);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('persistencia diferida: sucesor aparecido antes del guard (sin restore) se adopta, sin marcar ni Google', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    ctx.storage.failAlways('saveSession');
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    ctx.storage.failNext('saveSession', 0);
    const successor = sessionWith(2000, 'succ');
    ctx.storage.writeExternal(successor);
    ctx.storage.saveSession.mockClear();
    const token = await ctx.service.authorizedCall(async (t) => t);
    expect(token).toBe(successor.accessToken);
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.session()).toEqual(successor);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('H5: con el disco vacío la marca no se escribe (no resucita) y la recuperación continúa', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    await ctx.storage.clearAll(); // otro proceso cerró sesión
    ctx.storage.saveSession.mockClear();
    ageToExpired(ctx);
    await ctx.service.authorizedCall(async (t) => t);

    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
    // única escritura: la sesión nueva de la recuperación, nunca la marca
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1);
    expect(ctx.storage.session()?.refreshConsumed).toBeUndefined();
    expect(ctx.storage.session()?.refreshToken).not.toBe(refreshTokenOf('RT-stored'));
  });

  // La guarda «marcar en memoria solo si session?.refreshToken === base.refreshToken» de
  // markConsumed no es alcanzable sin cambios de producción: toda asignación de la sesión en
  // memoria durante un ciclo (publicar, adoptar, cerrar sesión) cambia el epoch y termina en
  // ENDED antes de llegar allí, y doRestore espera al ciclo activo antes de reasignarla.
});

describe('M2 ronda 3 (H6): la relectura del disco falla tras el primer 409', () => {
  const setupLoadFailure = async (mode: 'throws' | 'unsupported') => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    if (mode === 'throws') ctx.storage.failNext('loadSession');
    else (ctx.storage.loadSession as jest.Mock).mockResolvedValueOnce({ kind: 'unsupported' });
    await expect(ctx.service.authorizedCall(async (t) => t)).rejects.toMatchObject({
      kind: 'storage',
    });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    return ctx;
  };
  const oldOf = (ctx: Ctx) => ctx.storage.session()?.refreshToken as string;

  it('loadSession lanza y el disco sigue fallando: Reintentar y authorizedCall no reenvían ni llaman a Google', async () => {
    const ctx = await setupLoadFailure('throws');
    ctx.storage.failAlways('loadSession');
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('loadSession lanza y el disco se recupera: la marca se persiste ANTES de Google', async () => {
    const ctx = await setupLoadFailure('throws');
    const old = oldOf(ctx);
    const seen: unknown[] = [];
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      seen.push(ctx.storage.session()?.refreshConsumed, ctx.storage.session()?.refreshToken);
      return { status: 'success', idToken: 'google-id-token' };
    });
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(seen).toEqual([true, old]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(logoutCalls(ctx)).toEqual([]);
  });

  it('versión futura PERSISTENTE: nunca reenvía, nunca llama a Google ni crea familias', async () => {
    const ctx = await signedIn({
      api: fakeApi({ refresh: jest.fn().mockRejectedValue(conflict409()) }),
    });
    ageToExpired(ctx);
    (ctx.storage.loadSession as jest.Mock).mockResolvedValue({ kind: 'unsupported' });
    const attempts = async () => {
      await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
      ctx.clock.advance(RECOVERY_COOLDOWN_MS + 1_000);
      await ctx.service.restore();
      ctx.clock.advance(RECOVERY_COOLDOWN_MS + 1_000);
    };
    await attempts();
    await attempts();
    await attempts();

    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(logoutCalls(ctx)).toEqual([]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });

  it('versión futura solo en la primera lectura: la marca se persiste antes de Google', async () => {
    const ctx = await setupLoadFailure('unsupported');
    const old = oldOf(ctx);
    const seen: unknown[] = [];
    (ctx.google.signInSilently as jest.Mock).mockImplementation(async () => {
      seen.push(ctx.storage.session()?.refreshConsumed, ctx.storage.session()?.refreshToken);
      return { status: 'success', idToken: 'google-id-token' };
    });
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(seen).toEqual([true, old]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(logoutCalls(ctx)).toEqual([]);
    expect(ctx.service.getState().status).toBe('authenticated');
  });
});

describe('onForeground: reactivación de la app (AppState)', () => {
  const stringify = (value: unknown) => JSON.stringify(value);

  it('access vigente fuera del margen: cero llamadas a la red', async () => {
    const ctx = await signedIn();
    await ctx.service.onForeground();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.api.getMe).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('degraded con access vigente: no usa la red', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    jest.clearAllMocks();
    ctx.clock.advance(100); // sigue dentro del margen pero antes del intervalo mínimo
    await ctx.service.onForeground();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
  });

  it('degraded cuyo access entra en el margen: renueva una sola vez tras el intervalo mínimo', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.authorizedCall(async (t) => t);
    jest.clearAllMocks();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: false });
  });

  it('access a 59 s de vencer: exactamente 1 api.refresh y 1 saveSession', async () => {
    const ctx = await signedIn();
    ageToMargin(ctx);
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  // Límite de isFresh(): el access es fresco solo si le quedan MÁS de EXPIRY_MARGIN_MS (60 s).
  // Con un access de 900 s, avanzar 900_000 - restante deja ese tiempo restante exacto.
  it.each([
    ['60_001 ms restantes: sigue fresco, cero red', 60_001, 0],
    ['60_000 ms restantes (límite exacto): renueva una sola vez', 60_000, 1],
    ['59_999 ms restantes: renueva una sola vez', 59_999, 1],
  ])('límite del margen proactivo, %s', async (_name, remaining, rotations) => {
    const ctx = await signedIn();
    ctx.clock.advance(900_000 - remaining);
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(rotations);
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(rotations);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('access vencido: exactamente 1 api.refresh', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('N authorizedCall concurrentes + onForeground: una sola rotación y un solo guardado', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    await Promise.all([
      ctx.service.authorizedCall(async (t) => t),
      ctx.service.authorizedCall(async (t) => t),
      ctx.service.authorizedCall(async (t) => t),
      ctx.service.onForeground(),
    ]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1);
  });

  it('onForeground dos veces a la vez: una sola rotación', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    await Promise.all([ctx.service.onForeground(), ctx.service.onForeground()]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('logout y onForeground concurrentes (logout primero): no reabre la sesión', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    const out = ctx.service.signOut();
    const fg = ctx.service.onForeground();
    await Promise.all([out, fg]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout y onForeground concurrentes (onForeground primero): no reabre la sesión', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    const refresh = controlledPromise<ReturnType<typeof refreshedTokens>>();
    (ctx.api.refresh as jest.Mock).mockReturnValueOnce(refresh.promise);
    const fg = ctx.service.onForeground();
    await flush();
    const out = ctx.service.signOut();
    refresh.resolve(refreshedTokens('late'));
    await Promise.all([fg, out]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('unauthenticated tras logout explícito: cero signInSilently y cero red', async () => {
    const ctx = await signedIn();
    await ctx.service.signOut();
    jest.clearAllMocks();
    await ctx.service.onForeground();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.google.signIn).not.toHaveBeenCalled();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.storage.loadSession).not.toHaveBeenCalled();
  });

  it('unauthenticated sin sesión (absent): no hace nada', async () => {
    const ctx = setup();
    await ctx.service.restore();
    jest.clearAllMocks();
    await ctx.service.onForeground();
    expect(ctx.storage.loadSession).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('initializing: no inicia nada', async () => {
    const ctx = setup({ stored: stored(600) });
    await ctx.service.onForeground();
    expect(ctx.storage.loadSession).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('initializing');
  });

  it('restore en vuelo: onForeground no lanza otro ciclo', async () => {
    const ctx = setup({ stored: stored(-10) });
    const refresh = controlledPromise<ReturnType<typeof refreshedTokens>>();
    (ctx.api.refresh as jest.Mock).mockReturnValueOnce(refresh.promise);
    const restoring = ctx.service.restore();
    await flush();
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    refresh.resolve(refreshedTokens('ok'));
    await restoring;
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState().status).toBe('authenticated');
  });

  it('signIn en vuelo: onForeground no hace nada', async () => {
    const ctx = setup();
    await ctx.service.restore();
    const gate = controlledPromise<{ status: 'cancelled' }>();
    (ctx.google.signIn as jest.Mock).mockReturnValueOnce(gate.promise);
    const signing = ctx.service.signIn();
    await flush();
    await ctx.service.onForeground();
    expect(ctx.storage.loadSession).toHaveBeenCalledTimes(1); // solo el restore inicial
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    gate.resolve({ status: 'cancelled' });
    await signing;
  });

  it('signIn en vuelo desde unavailable: onForeground no recupera y el signIn termina bien', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.service.getState().status).toBe('unavailable');
    jest.clearAllMocks();
    // Pasado el intervalo mínimo, solo `busy` impide que onForeground inicie una recuperación.
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    (ctx.google.signIn as jest.Mock).mockReturnValueOnce(gate.promise);
    const signing = ctx.service.signIn();
    await flush();
    expect(ctx.service.getState()).toMatchObject({ status: 'unavailable', busy: true });
    await ctx.service.onForeground();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.storage.loadSession).not.toHaveBeenCalled();
    gate.resolve({ status: 'success', idToken: 'google-id-token' });
    await signing;
    expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', busy: false });
  });

  it('unavailable por red: intenta una recuperación y, con la red restablecida, autentica', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.authorizedCall(async (t) => t).catch(() => undefined);
    expect(ctx.service.getState().status).toBe('unavailable');
    jest.clearAllMocks();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: false });
  });

  it('dos onForeground dentro de 5 s en unavailable: un solo intento de red', async () => {
    const refresh = jest.fn().mockRejectedValue(err('network'));
    const ctx = setup({ stored: stored(-10), api: fakeApi({ refresh }) });
    await ctx.service.restore();
    expect(ctx.service.getState().status).toBe('unavailable');
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    await ctx.service.onForeground();
    ctx.clock.advance(1_000);
    await ctx.service.onForeground();
    expect(refresh).toHaveBeenCalledTimes(2); // restore inicial + un solo onForeground
  });

  it('unavailable por almacenamiento: reintenta sin Google', async () => {
    const ctx = setup({ stored: stored(120) });
    ctx.storage.failNext('loadSession', 1);
    await ctx.service.restore();
    expect(ctx.service.getState().unavailableCause).toBe('storage');
    await ctx.service.onForeground();
    expect(ctx.service.getState().status).toBe('authenticated');
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
  });

  it('sesión unsupported: onForeground nunca llama a Google ni borra', async () => {
    const ctx = setup({ stored: { kind: 'unsupported' } });
    await ctx.service.restore();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
    expect(ctx.storage.isUnsupported()).toBe(true);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unavailable',
      unavailableCause: 'storage',
    });
  });

  describe('refreshConsumed', () => {
    const consumed = (seconds: number): StoredLoad => ({
      kind: 'session',
      session: { ...sessionWith(seconds, 'C'), refreshConsumed: true },
    });
    const sentTokens = (ctx: Ctx) =>
      (ctx.api.refresh as jest.Mock).mock.calls.map(([token]) => token as string);

    it('en memoria: jamás envía el token marcado a /auth/refresh; recupera con Google', async () => {
      const ctx = setup({ stored: consumed(600) });
      await ctx.service.restore();
      expect(ctx.service.getState().status).toBe('authenticated');
      ageToExpired(ctx);
      await ctx.service.onForeground();
      expect(sentTokens(ctx)).not.toContain(refreshTokenOf('RT-C'));
      expect(ctx.google.signInSilently).toHaveBeenCalledTimes(1);
      expect(ctx.api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
      expect(ctx.service.getState().status).toBe('authenticated');
    });

    it('tras reinicio con storage marcado: cero envíos y respeta el cooldown de Google', async () => {
      const google = fakeGoogle({ signInSilently: jest.fn().mockRejectedValue(err('network')) });
      const first = setup({ stored: consumed(-10), google });
      await first.service.restore(); // Google falla: unavailable, cooldown activo
      expect(first.google.signInSilently).toHaveBeenCalledTimes(1);
      // Reinicio del servicio sobre el mismo almacenamiento marcado.
      const restarted = first.make();
      await restarted.restore();
      first.clock.advance(RESTORE_MIN_INTERVAL_MS);
      await restarted.onForeground();
      expect(sentTokens(first)).toHaveLength(0);
      expect(first.google.signInSilently).toHaveBeenCalledTimes(2); // el reinicio no tiene cooldown
      first.clock.advance(RESTORE_MIN_INTERVAL_MS);
      await restarted.onForeground(); // dentro de los 60 s del último fallo
      expect(first.google.signInSilently).toHaveBeenCalledTimes(2);
      expect(sentTokens(first)).toHaveLength(0);
      first.clock.advance(RECOVERY_COOLDOWN_MS);
      await restarted.onForeground();
      expect(first.google.signInSilently).toHaveBeenCalledTimes(3);
    });
  });

  it('nunca lanza aunque el servicio falle por dentro', async () => {
    const ctx = await signedIn();
    ageToExpired(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
    (ctx.google.signInSilently as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(ctx.service.onForeground()).resolves.toBeUndefined();
    ctx.storage.failAlways('loadSession');
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await expect(ctx.service.onForeground()).resolves.toBeUndefined();
  });

  it('no registra tokens en console.*', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const ctx = await signedIn();
    ageToExpired(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.onForeground();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    spies.forEach((spy) => {
      expect(stringify(spy.mock.calls)).not.toMatch(/eyJ|RT-/);
    });
    jest.restoreAllMocks();
  });
});

describe('onForeground y restore con sesión degradada y access vigente (revalidación GET /me)', () => {
  const noRotation = (ctx: Ctx) => {
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
  };

  // Sesión degradada con el access de 600 s (fresco): el primer GET /me falló por red.
  async function degradedFresh(label = 'A'): Promise<Ctx> {
    const ctx = setup({ stored: stored(600, label) });
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.restore();
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    jest.clearAllMocks();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    return ctx;
  }

  it('/me correcto: exactamente 1 getMe, quita degraded y no toca refresh, Google ni disco', async () => {
    const ctx = await degradedFresh();
    await ctx.service.onForeground();
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    noRotation(ctx);
    expect(ctx.service.getState()).toMatchObject({
      status: 'authenticated',
      degraded: false,
      busy: false,
      user: USER,
      error: null,
      notice: null,
      unavailableCause: null,
    });
  });

  it.each([
    ['red', err('network')],
    ['timeout (kind network)', err('network')],
    ['429', err('server', 429)],
    ['500', err('server', 500)],
    ['503', err('server', 503)],
    ['401 (no verificable)', err('rejected', 401)],
  ])(
    '/me falla por %s: conserva sesión y degraded; no repite dentro de 5 s y sí después',
    async (_n, failure) => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(failure);
      await ctx.service.onForeground();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
      expect(ctx.service.getState()).toMatchObject({
        status: 'authenticated',
        degraded: true,
        busy: false,
      });
      noRotation(ctx);

      ctx.clock.advance(RESTORE_MIN_INTERVAL_MS - 1);
      await ctx.service.onForeground();
      await ctx.service.onForeground();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(1);

      ctx.clock.advance(1);
      await ctx.service.onForeground();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(2);
      expect(ctx.service.getState()).toMatchObject({ degraded: false });
      noRotation(ctx);
    },
  );

  it('401 en la comprobación proactiva: no rota con el access vigente ni destruye la sesión', async () => {
    const ctx = await degradedFresh();
    (ctx.api.getMe as jest.Mock).mockRejectedValue(err('rejected', 401));
    await ctx.service.onForeground();
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    noRotation(ctx);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    expect(ctx.storage.session()).not.toBeNull();
  });

  it('access en el margen (≤ 60 s): usa la renovación existente, una sola rotación y sin getMe', async () => {
    const ctx = await degradedFresh();
    ctx.clock.advance(600_000 - 59_000 - RESTORE_MIN_INTERVAL_MS);
    await Promise.all([ctx.service.onForeground(), ctx.service.onForeground()]);
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.getMe).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState()).toMatchObject({ degraded: false });
  });

  it('N foregrounds a la vez: una sola comprobación', async () => {
    const ctx = await degradedFresh();
    const gate = controlledPromise<typeof USER>();
    (ctx.api.getMe as jest.Mock).mockReturnValueOnce(gate.promise);
    const calls = [1, 2, 3, 4, 5].map(() => ctx.service.onForeground());
    await flush();
    expect(ctx.service.getState().busy).toBe(true);
    gate.resolve(USER);
    await Promise.all(calls);
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    noRotation(ctx);
  });

  it('restore() en vuelo: el foreground no lanza una segunda comprobación', async () => {
    const ctx = await degradedFresh();
    const gate = controlledPromise<typeof USER>();
    (ctx.api.getMe as jest.Mock).mockReturnValueOnce(gate.promise);
    const restoring = ctx.service.restore();
    await flush();
    const second = ctx.service.restore();
    await ctx.service.onForeground();
    gate.resolve(USER);
    await Promise.all([restoring, second]);
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
  });

  it('authorizedCall con renovación en vuelo: el foreground no abre otro ciclo', async () => {
    const ctx = await degradedFresh();
    ctx.clock.advance(600_000 - 59_000 - RESTORE_MIN_INTERVAL_MS);
    const gate = controlledPromise<ReturnType<typeof refreshedTokens>>();
    (ctx.api.refresh as jest.Mock).mockReturnValueOnce(gate.promise);
    const call = ctx.service.authorizedCall(async (t) => t);
    await flush();
    await ctx.service.onForeground();
    gate.resolve(refreshedTokens('B'));
    await call;
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.getMe).not.toHaveBeenCalled();
  });

  it('logout durante el GET /me: no reabre la sesión ni toca Google; almacenamiento vacío', async () => {
    const ctx = await degradedFresh();
    const gate = controlledPromise<typeof USER>();
    (ctx.api.getMe as jest.Mock).mockReturnValueOnce(gate.promise);
    const fg = ctx.service.onForeground();
    await flush();
    const out = ctx.service.signOut();
    gate.resolve(USER);
    await Promise.all([fg, out]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
      degraded: false,
      user: null,
    });
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout durante el GET /me que falla: tampoco modifica el estado', async () => {
    const ctx = await degradedFresh();
    const gate = controlledPromise<typeof USER>();
    (ctx.api.getMe as jest.Mock).mockReturnValueOnce(gate.promise);
    const fg = ctx.service.onForeground();
    await flush();
    const out = ctx.service.signOut();
    gate.reject(err('network'));
    await Promise.all([fg, out]);
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      signedOutReason: 'signed-out',
    });
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout antes del foreground: unauthenticated, cero red', async () => {
    const ctx = await degradedFresh();
    await ctx.service.signOut();
    jest.clearAllMocks();
    await ctx.service.onForeground();
    expect(ctx.api.getMe).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState().status).toBe('unauthenticated');
  });

  it('refreshConsumed + degraded: nunca envía el token consumido ni llama a Google', async () => {
    const consumed: StoredLoad = {
      kind: 'session',
      session: { ...sessionWith(600), refreshConsumed: true },
    };
    const ctx = setup({ stored: consumed });
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.restore();
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    jest.clearAllMocks();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.service.getState()).toMatchObject({ degraded: false });
  });

  it('restore() desde degraded con access vigente: revalida, no rota ni borra; el éxito quita degraded', async () => {
    const ctx = await degradedFresh();
    await ctx.service.restore();
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    noRotation(ctx);
    expect(ctx.service.getState()).toMatchObject({ degraded: false, status: 'authenticated' });
  });

  it('restore() desde degraded con 401 y fallos: conserva la sesión y respeta los 5 s', async () => {
    const ctx = await degradedFresh();
    (ctx.api.getMe as jest.Mock).mockRejectedValue(err('rejected', 401));
    await ctx.service.restore();
    await ctx.service.restore(); // dentro de 5 s
    expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
    noRotation(ctx);
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.restore();
    expect(ctx.api.getMe).toHaveBeenCalledTimes(2);
  });

  it('restore() desde degraded dentro del intervalo mínimo no llega a la red', async () => {
    const ctx = setup({ stored: stored(600) });
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.restore();
    jest.clearAllMocks();
    await ctx.service.restore();
    expect(ctx.api.getMe).not.toHaveBeenCalled();
  });

  it('sesión unsupported o de almacenamiento no disponible: nunca llama a Google', async () => {
    const ctx = setup({ stored: { kind: 'unsupported' } });
    await ctx.service.restore();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await ctx.service.onForeground();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.getMe).not.toHaveBeenCalled();
  });

  it('no registra tokens en console.* y onForeground nunca lanza', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const ctx = await degradedFresh();
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(ctx.service.onForeground()).resolves.toBeUndefined();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    await expect(ctx.service.onForeground()).resolves.toBeUndefined();
    spies.forEach((spy) => {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/eyJ|RT-/);
    });
    jest.restoreAllMocks();
  });
});

describe('recuperación degradada: respuestas tardías de /me y distinción 401 / red', () => {
  const noRotation = (ctx: Ctx) => {
    expect(ctx.api.refresh).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.api.exchangeGoogleToken).not.toHaveBeenCalled();
    expect(ctx.storage.saveSession).not.toHaveBeenCalled();
    expect(ctx.storage.clearAll).not.toHaveBeenCalled();
  };

  // Sesión degradada con el access de 600 s (fresco): el primer GET /me falló por red.
  async function degradedFresh(): Promise<Ctx> {
    const ctx = setup({ stored: stored(600) });
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.restore();
    expect(ctx.service.getState()).toMatchObject({ status: 'authenticated', degraded: true });
    jest.clearAllMocks();
    ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
    return ctx;
  }

  // Deja una revalidación /me en vuelo (compuerta abierta por el llamador).
  async function revalidating(ctx: Ctx) {
    const gate = controlledPromise<typeof USER>();
    (ctx.api.getMe as jest.Mock).mockReturnValueOnce(gate.promise);
    const restoring = ctx.service.restore();
    await flush();
    expect(ctx.service.getState().busy).toBe(true);
    return { gate, restoring };
  }

  // Lleva el access al margen de vencimiento sin que haya vencido.
  const toMargin = (ctx: Ctx) => ctx.clock.advance(600_000 - 59_000 - RESTORE_MIN_INTERVAL_MS);

  it('logout, signIn en vuelo y /me anterior que falla: busy se conserva y no reaparece la sesión vieja', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    const out = ctx.service.signOut();
    const google = controlledPromise<{ status: 'cancelled' }>();
    (ctx.google.signIn as jest.Mock).mockReturnValueOnce(google.promise);
    const signing = ctx.service.signIn();
    await flush();
    expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', busy: true });
    gate.reject(err('network'));
    await restoring;
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      busy: true,
      user: null,
      degraded: false,
    });
    google.resolve({ status: 'cancelled' });
    await Promise.all([out, signing]);
    expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', busy: false });
    expect(ctx.storage.isEmpty()).toBe(true);
  });

  it('logout, signIn en vuelo y /me anterior que responde 200: busy se conserva y no reaparece la sesión', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    const out = ctx.service.signOut();
    const google = controlledPromise<{ status: 'cancelled' }>();
    (ctx.google.signIn as jest.Mock).mockReturnValueOnce(google.promise);
    const signing = ctx.service.signIn();
    await flush();
    gate.resolve(USER);
    await restoring;
    expect(ctx.service.getState()).toMatchObject({
      status: 'unauthenticated',
      busy: true,
      user: null,
    });
    google.resolve({ status: 'cancelled' });
    await Promise.all([out, signing]);
    expect(ctx.service.getState().busy).toBe(false);
  });

  it('/me tardío 200 tras un ciclo real fallido por red: NO limpia el aviso degradado y libera busy', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    toMargin(ctx);
    (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
    await ctx.service.authorizedCall(async (t) => t);
    expect(ctx.service.getState()).toMatchObject({ degraded: true, busy: false });
    gate.resolve({ ...USER, name: 'Tardío' });
    await restoring;
    expect(ctx.service.getState()).toMatchObject({ degraded: true, busy: false, user: USER });
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
  });

  it('/me tardío 200 tras otra rotación (otro access): se descarta y no pisa el usuario publicado', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    toMargin(ctx);
    (ctx.api.refresh as jest.Mock).mockResolvedValueOnce(refreshedTokens('B'));
    await ctx.service.authorizedCall(async (t) => t);
    const afterRotation = ctx.service.getState();
    expect(afterRotation).toMatchObject({ degraded: false, busy: false });
    gate.resolve({ ...USER, name: 'Tardío' });
    await restoring;
    expect(ctx.service.getState()).toMatchObject({ degraded: false, busy: false, user: USER });
    expect(ctx.service.getState().user?.name).not.toBe('Tardío');
  });

  it('/me tardío con error tras otra rotación: no ensucia el estado ni deja busy', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    toMargin(ctx);
    (ctx.api.refresh as jest.Mock).mockResolvedValueOnce(refreshedTokens('B'));
    await ctx.service.authorizedCall(async (t) => t);
    gate.reject(err('rejected', 401));
    await restoring;
    expect(ctx.service.getState()).toMatchObject({ degraded: false, busy: false, error: null });
  });

  it('/me tardío 200 con un ciclo activo iniciado durante la revalidación: se descarta y el ciclo libera busy', async () => {
    const ctx = await degradedFresh();
    const { gate, restoring } = await revalidating(ctx);
    toMargin(ctx);
    const refreshGate = controlledPromise<ReturnType<typeof refreshedTokens>>();
    (ctx.api.refresh as jest.Mock).mockReturnValueOnce(refreshGate.promise);
    const call = ctx.service.authorizedCall(async (t) => t);
    await flush();
    gate.resolve({ ...USER, name: 'Tardío' });
    await restoring;
    // El resultado de /me no se aplica: el ciclo sigue siendo dueño del estado.
    expect(ctx.service.getState()).toMatchObject({ degraded: true, busy: true, user: USER });
    refreshGate.resolve(refreshedTokens('B'));
    await call;
    expect(ctx.service.getState()).toMatchObject({ degraded: false, busy: false, user: USER });
  });

  it('degradada con access a 59 s: restore() renueva (1 refresh, 0 getMe, 0 Google, 1 saveSession)', async () => {
    const ctx = await degradedFresh();
    toMargin(ctx);
    await ctx.service.restore();
    expect(ctx.api.refresh).toHaveBeenCalledTimes(1);
    expect(ctx.api.getMe).not.toHaveBeenCalled();
    expect(ctx.google.signInSilently).not.toHaveBeenCalled();
    expect(ctx.storage.saveSession).toHaveBeenCalledTimes(1);
    expect(ctx.service.getState()).toMatchObject({ degraded: false, busy: false });
  });

  describe('busy durante restore() degradado', () => {
    it('revalidación: true en vuelo; se libera en éxito y en fallo', async () => {
      const ctx = await degradedFresh();
      const first = await revalidating(ctx);
      first.gate.resolve(USER);
      await first.restoring;
      expect(ctx.service.getState()).toMatchObject({ busy: false, degraded: false });

      const ctx2 = await degradedFresh();
      const second = await revalidating(ctx2);
      second.gate.reject(err('server', 503));
      await second.restoring;
      expect(ctx2.service.getState()).toMatchObject({ busy: false, degraded: true });
    });

    it('rotación por margen: true mientras vuela el refresh; se libera en éxito y en fallo', async () => {
      const ctx = await degradedFresh();
      toMargin(ctx);
      const gate = controlledPromise<ReturnType<typeof refreshedTokens>>();
      (ctx.api.refresh as jest.Mock).mockReturnValueOnce(gate.promise);
      const restoring = ctx.service.restore();
      await flush();
      expect(ctx.service.getState().busy).toBe(true);
      gate.resolve(refreshedTokens('B'));
      await restoring;
      expect(ctx.service.getState()).toMatchObject({ busy: false, degraded: false });

      const ctx2 = await degradedFresh();
      toMargin(ctx2);
      const gate2 = controlledPromise<ReturnType<typeof refreshedTokens>>();
      (ctx2.api.refresh as jest.Mock).mockReturnValueOnce(gate2.promise);
      const restoring2 = ctx2.service.restore();
      await flush();
      expect(ctx2.service.getState().busy).toBe(true);
      gate2.reject(err('network'));
      await restoring2;
      expect(ctx2.service.getState()).toMatchObject({ busy: false, degraded: true });
    });

    it('logout durante la rotación degradada: busy queda en false y sin sesión', async () => {
      const ctx = await degradedFresh();
      toMargin(ctx);
      const gate = controlledPromise<ReturnType<typeof refreshedTokens>>();
      (ctx.api.refresh as jest.Mock).mockReturnValueOnce(gate.promise);
      const restoring = ctx.service.restore();
      await flush();
      expect(ctx.service.getState().busy).toBe(true);
      const out = ctx.service.signOut();
      gate.resolve(refreshedTokens('B'));
      await Promise.all([restoring, out]);
      expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', busy: false });
      expect(ctx.storage.isEmpty()).toBe(true);
    });
  });

  describe('restore() sin degradación no se bloquea por el intervalo de 5 s', () => {
    it('llamadas consecutivas inmediatas ejecutan getMe cada una', async () => {
      const ctx = setup({ stored: stored(600) });
      await ctx.service.restore();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(1); // la primera carga no cambia
      await ctx.service.restore();
      await ctx.service.restore();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(3);
      expect(ctx.service.getState()).toMatchObject({ degraded: false, busy: false });
    });

    it('tras un fallo previo ya recuperado, restore() inmediato vuelve a llamar a getMe', async () => {
      const ctx = await degradedFresh();
      await ctx.service.restore(); // éxito: sale de degraded
      expect(ctx.service.getState().degraded).toBe(false);
      jest.clearAllMocks();
      await ctx.service.restore();
      await ctx.service.restore();
      expect(ctx.api.getMe).toHaveBeenCalledTimes(2);
    });
  });

  describe('401 de /me con access vigente frente a fallos de red', () => {
    it('401: error=rejected, degraded, sesión conservada y sin rotar, Google ni disco', async () => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
      await ctx.service.restore();
      expect(ctx.service.getState()).toMatchObject({
        status: 'authenticated',
        degraded: true,
        busy: false,
        error: 'rejected',
        user: USER,
      });
      noRotation(ctx);
      expect(ctx.storage.session()).not.toBeNull();
    });

    it.each([
      ['red', err('network')],
      ['timeout', err('network')],
      ['429', err('server', 429)],
      ['500', err('server', 500)],
      ['503', err('server', 503)],
    ])('%s: degraded con error distinto de rejected', async (_n, failure) => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(failure);
      await ctx.service.restore();
      const state = ctx.service.getState();
      expect(state).toMatchObject({ status: 'authenticated', degraded: true, busy: false });
      expect(state.error).not.toBe('rejected');
      noRotation(ctx);
    });

    it('401 y después red: el error deja de ser rejected', async () => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock)
        .mockRejectedValueOnce(err('rejected', 401))
        .mockRejectedValueOnce(err('network'));
      await ctx.service.restore();
      expect(ctx.service.getState().error).toBe('rejected');
      ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
      await ctx.service.restore();
      expect(ctx.service.getState()).toMatchObject({ degraded: true, error: 'network' });
    });

    it('401 y después éxito: degraded y error se limpian', async () => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
      await ctx.service.restore();
      ctx.clock.advance(RESTORE_MIN_INTERVAL_MS);
      await ctx.service.restore();
      expect(ctx.service.getState()).toMatchObject({ degraded: false, error: null, busy: false });
    });

    it('401 y después un ciclo fallido por red: el error de rechazo no se arrastra', async () => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
      await ctx.service.restore();
      toMargin(ctx);
      (ctx.api.refresh as jest.Mock).mockRejectedValueOnce(err('network'));
      await ctx.service.restore();
      expect(ctx.service.getState()).toMatchObject({ degraded: true, error: null });
    });

    it('401 y después logout: el error no se filtra a la pantalla de acceso', async () => {
      const ctx = await degradedFresh();
      (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
      await ctx.service.restore();
      await ctx.service.signOut();
      expect(ctx.service.getState()).toMatchObject({ status: 'unauthenticated', error: null });
    });
  });

  describe('reintento concurrente con logout', () => {
    const expectClosed = (ctx: Ctx) => {
      expect(ctx.service.getState()).toMatchObject({
        status: 'unauthenticated',
        busy: false,
        user: null,
      });
      expect(ctx.google.signInSilently).not.toHaveBeenCalled();
      expect(ctx.storage.isEmpty()).toBe(true);
    };

    it('restore() y después logout', async () => {
      const ctx = await degradedFresh();
      const { gate, restoring } = await revalidating(ctx);
      const out = ctx.service.signOut();
      gate.resolve(USER);
      await Promise.all([restoring, out]);
      expectClosed(ctx);
      expect(ctx.service.getState().signedOutReason).toBe('signed-out');
    });

    it('logout y después restore()', async () => {
      const ctx = await degradedFresh();
      const out = ctx.service.signOut();
      const restoring = ctx.service.restore();
      await Promise.all([restoring, out]);
      expectClosed(ctx);
      expect(ctx.service.getState().signedOutReason).toBe('signed-out');
    });
  });

  it('no registra tokens en console.* ni en los mensajes nuevos', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const ctx = await degradedFresh();
    (ctx.api.getMe as jest.Mock).mockRejectedValueOnce(err('rejected', 401));
    await ctx.service.restore();
    spies.forEach((spy) => {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/eyJ|RT-/);
    });
    expect(DEGRADED_UNVERIFIED_MESSAGE).not.toMatch(/eyJ|RT-/);
    expect(DEGRADED_UNVERIFIED_MESSAGE).toBe(
      'No pudimos verificar tu sesión. Puedes reintentar más tarde',
    );
    jest.restoreAllMocks();
  });
});
