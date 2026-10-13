import { fakeApi, fakeGoogle, fakeJwt, fakeStorage, NOW_MS, USER } from '../test-utils';
import { createAuthService } from './auth-service';
import { AuthError } from './auth-types';

function setup(
  opts: {
    stored?: string | null;
    google?: ReturnType<typeof fakeGoogle>;
    api?: ReturnType<typeof fakeApi>;
  } = {},
) {
  const storage = fakeStorage(opts.stored ?? null);
  const google = opts.google ?? fakeGoogle();
  const api = opts.api ?? fakeApi();
  const service = createAuthService({ google, storage, api, now: () => NOW_MS });
  return { storage, google, api, service };
}

describe('inicio de sesión', () => {
  it('con Google y la API correctos guarda solo el JWT propio y autentica', async () => {
    const { service, storage, api } = setup();
    await service.signIn();

    expect(api.exchangeGoogleToken).toHaveBeenCalledWith('google-id-token');
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: USER, busy: false });
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.value()).not.toBe('google-id-token');
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
      const google = fakeGoogle({
        signIn: jest.fn(async () => {
          throw new AuthError(kind);
        }),
      });
      const { service } = setup({ google });
      await service.signIn();

      expect(service.getState()).toMatchObject({ error: kind, busy: false });
      expect(service.getState().status).not.toBe('authenticated');
    },
  );

  it('si la API rechaza el token no guarda nada', async () => {
    const api = fakeApi({
      exchangeGoogleToken: jest.fn(async () => {
        throw new AuthError('rejected');
      }),
    });
    const { service, storage } = setup({ api });
    await service.signIn();

    expect(service.getState().error).toBe('rejected');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('ignora pulsaciones repetidas mientras hay un inicio en curso', async () => {
    let release: () => void = () => {};
    const google = fakeGoogle({
      signIn: jest.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: 'success', idToken: 'google-id-token' });
          }),
      ),
    });
    const { service } = setup({ google });
    const first = service.signIn();
    await service.signIn();
    expect(service.getState().busy).toBe(true);
    release();
    await first;

    expect(google.signIn).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('authenticated');
  });
});

describe('restauración de sesión', () => {
  it('sin JWT guardado queda no autenticado', async () => {
    const { service } = setup();
    expect(service.getState().status).toBe('initializing');
    await service.restore();
    expect(service.getState()).toMatchObject({ status: 'unauthenticated', error: null });
  });

  it('con un JWT vigente valida con GET /me y autentica sin tocar Google', async () => {
    const token = fakeJwt(600);
    const { service, api, google } = setup({ stored: token });
    await service.restore();

    expect(api.getMe).toHaveBeenCalledWith(token);
    expect(google.signInSilently).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: USER });
  });

  it('con un JWT expirado renueva en silencio con Google', async () => {
    const { service, api, google, storage } = setup({ stored: fakeJwt(-10) });
    await service.restore();

    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(api.exchangeGoogleToken).toHaveBeenCalledWith('google-id-token');
    expect(service.getState().status).toBe('authenticated');
    expect(storage.value()).not.toBe(fakeJwt(-10));
  });

  it('si Google no tiene credencial guardada limpia la sesión y vuelve al login', async () => {
    const google = fakeGoogle({
      signInSilently: jest.fn(async () => ({ status: 'no-saved-credential' })),
    });
    const { service, storage } = setup({ stored: fakeJwt(-10), google });
    await service.restore();

    expect(service.getState().status).toBe('unauthenticated');
    expect(storage.value()).toBeNull();
  });

  it('si GET /me da 401 renueva una vez y reintenta una vez', async () => {
    const getMe = jest
      .fn<Promise<typeof USER>, [string]>()
      .mockRejectedValueOnce(new AuthError('rejected'))
      .mockResolvedValueOnce(USER);
    const api = fakeApi({ getMe });
    const { service, google } = setup({ stored: fakeJwt(600), api });
    await service.restore();

    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(service.getState().status).toBe('authenticated');
  });

  it('no entra en un ciclo de reintentos si el 401 persiste', async () => {
    const getMe = jest.fn(async () => {
      throw new AuthError('rejected');
    });
    const { service, google, storage } = setup({ stored: fakeJwt(600), api: fakeApi({ getMe }) });
    await service.restore();

    expect(getMe).toHaveBeenCalledTimes(2);
    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('unauthenticated');
    expect(storage.value()).toBeNull();
  });

  it('sin red y con un JWT vigente conserva la sesión y la almacenada', async () => {
    const token = fakeJwt(600);
    const api = fakeApi({
      getMe: jest.fn(async () => {
        throw new AuthError('network');
      }),
    });
    const { service, storage } = setup({ stored: token, api });
    await service.restore();

    expect(service.getState()).toMatchObject({ status: 'authenticated', error: 'network' });
    expect(service.getState().user?.email).toBe(USER.email);
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it('sin red y con un JWT expirado no borra lo almacenado', async () => {
    const expired = fakeJwt(-10);
    const api = fakeApi({
      exchangeGoogleToken: jest.fn(async () => {
        throw new AuthError('network');
      }),
    });
    const { service, storage } = setup({ stored: expired, api });
    await service.restore();

    expect(service.getState()).toMatchObject({ status: 'unauthenticated', error: 'network' });
    expect(storage.value()).toBe(expired);
  });
});

describe('renovación', () => {
  it('las llamadas simultáneas comparten una sola renovación', async () => {
    const { service, google, api } = setup({ stored: fakeJwt(-10) });
    const results = await Promise.all([
      service.authorizedCall(async (t) => t),
      service.authorizedCall(async (t) => t),
      service.authorizedCall(async (t) => t),
    ]);

    expect(google.signInSilently).toHaveBeenCalledTimes(1);
    expect(api.exchangeGoogleToken).toHaveBeenCalledTimes(1);
    expect(new Set(results).size).toBe(1);
  });
});

describe('cierre de sesión', () => {
  it('limpia almacenamiento, Google y estado', async () => {
    const { service, storage, google } = setup();
    await service.signIn();
    await service.signOut();

    expect(storage.value()).toBeNull();
    expect(google.signOut).toHaveBeenCalledTimes(1);
    expect(service.getState()).toEqual({
      status: 'unauthenticated',
      user: null,
      busy: false,
      error: null,
    });
  });

  it('cierra la sesión local aunque falle Google', async () => {
    const google = fakeGoogle({
      signOut: jest.fn(async () => {
        throw new Error('fallo');
      }),
    });
    const { service, storage } = setup({ google });
    await service.signIn();
    await service.signOut();

    expect(service.getState().status).toBe('unauthenticated');
    expect(storage.value()).toBeNull();
  });

  it('una renovación en vuelo no reautentica después del logout', async () => {
    let release: () => void = () => {};
    const google = fakeGoogle({
      signInSilently: jest.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: 'success', idToken: 'google-id-token' });
          }),
      ),
    });
    const { service, storage } = setup({ stored: fakeJwt(-10), google });
    const restoring = service.restore();
    await Promise.resolve();
    await service.signOut();
    release();
    await restoring;
    await new Promise((r) => setTimeout(r, 0));

    expect(service.getState().status).toBe('unauthenticated');
    expect(storage.value()).toBeNull();
  });
});
