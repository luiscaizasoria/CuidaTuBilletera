import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from './App';
import { createAuthService } from './lib/auth-service';
import { AuthError } from './lib/auth-types';
import {
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  storedSession,
  USER,
} from './test-utils';

// Los módulos nativos no existen en Jest: se sustituyen por dobles.
jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

const valid = (): Parameters<typeof fakeStorage>[0] => ({
  kind: 'session',
  session: storedSession({ accessToken: fakeJwt(600) }),
});

function setup(
  initial: Parameters<typeof fakeStorage>[0] = { kind: 'empty' },
  google = fakeGoogle(),
  api = fakeApi(),
) {
  const clock = fakeClock();
  const storage = fakeStorage(initial);
  const service = createAuthService({
    google,
    storage,
    api,
    now: clock.now,
    sleep: clock.sleep,
    random: clock.random,
  });
  return { storage, google, api, service, clock };
}

describe('App', () => {
  it('sin configuración pública muestra el aviso de configuración incompleta', async () => {
    await render(<App />);
    expect(screen.getByText('Configuración incompleta')).toBeTruthy();
  });

  it('mientras restaura la sesión muestra el indicador de carga', async () => {
    const { service } = setup();
    jest.spyOn(service, 'restore').mockReturnValue(new Promise(() => {}));
    await render(<App service={service} />);
    expect(screen.getByTestId('app-loading')).toBeTruthy();
  });

  it('sin sesión guardada muestra el login', async () => {
    const { service } = setup();
    await render(<App service={service} />);
    expect(await screen.findByText('Ingresar con Google')).toBeTruthy();
    expect(screen.getByText('CuidaTuBilletera')).toBeTruthy();
  });

  it('con una sesión válida guardada entra directo a la pantalla principal', async () => {
    const { service } = setup(valid());
    await render(<App service={service} />);
    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText(USER.email)).toBeTruthy();
    expect(screen.getByText(USER.name!)).toBeTruthy();
  });

  it('el login exitoso lleva a la pantalla principal y cerrar sesión regresa al login', async () => {
    const { service, storage } = setup();
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(storage.session()).not.toBeNull();

    await fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(await screen.findByText('Ingresar con Google')).toBeTruthy();
    expect(storage.isEmpty()).toBe(true);
  });

  it('cancelar el login no muestra error', async () => {
    const google = fakeGoogle({ signIn: jest.fn(async () => ({ status: 'cancelled' })) });
    const { service } = setup(undefined, google);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    await waitFor(() => expect(google.signIn).toHaveBeenCalled());
    expect(screen.getByText('Ingresar con Google')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('muestra un mensaje comprensible si Google falla', async () => {
    const google = fakeGoogle({
      signIn: jest.fn(async () => {
        throw new AuthError('play-services');
      }),
    });
    const { service } = setup(undefined, google);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    expect(await screen.findByText(/Google Play Services/)).toBeTruthy();
  });

  it('durante el inicio muestra carga y no permite pulsar de nuevo', async () => {
    const google = fakeGoogle({ signIn: jest.fn(() => new Promise(() => {})) });
    const { service } = setup(undefined, google);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    expect(await screen.findByTestId('login-loading')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(google.signIn).toHaveBeenCalledTimes(1);
  });

  it('tras un cierre de sesión no confirmado muestra el aviso en el login', async () => {
    const api = fakeApi({ logout: jest.fn().mockRejectedValue(new AuthError('network')) });
    const { service } = setup(valid(), fakeGoogle(), api);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Cerrar sesión'));

    expect(await screen.findByText(/no pudimos confirmarlo con el servidor/)).toBeTruthy();
    expect(screen.getByText(/hasta 7 días sin uso/)).toBeTruthy();
    expect(screen.getByText('Ingresar con Google')).toBeTruthy();
  });

  it('si no se pudo borrar el almacenamiento muestra el aviso de almacenamiento seguro', async () => {
    const { service, storage } = setup(valid());
    await render(<App service={service} />);
    await screen.findByText('Sesión iniciada');
    storage.failAlways('clearAll');
    await fireEvent.press(screen.getByText('Cerrar sesión'));

    expect(await screen.findByText(/No se pudo borrar por completo la sesión/)).toBeTruthy();
  });

  it('el aviso de cierre desaparece al volver a iniciar sesión', async () => {
    const api = fakeApi({ logout: jest.fn().mockRejectedValue(new AuthError('network')) });
    const { service } = setup(valid(), fakeGoogle(), api);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Cerrar sesión'));
    await screen.findByText(/no pudimos confirmarlo/);
    await fireEvent.press(screen.getByText('Ingresar con Google'));

    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.queryByText(/no pudimos confirmarlo/)).toBeNull();
  });

  it('sin red y con un access vigente muestra la sesión con un aviso de modo degradado', async () => {
    const api = fakeApi({ getMe: jest.fn().mockRejectedValue(new AuthError('network')) });
    const { service } = setup(valid(), fakeGoogle(), api);
    await render(<App service={service} />);

    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText(/Sin conexión estable/)).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });

  describe('sesión degradada: botón Reintentar', () => {
    const degradedApp = async (getMe: jest.Mock) => {
      const ctx = setup(valid(), fakeGoogle(), fakeApi({ getMe }));
      await render(<App service={ctx.service} />);
      await screen.findByText(/Sin conexión estable/);
      ctx.clock.advance(5_000);
      return ctx;
    };

    it('éxito: llama a la recuperación y desaparecen el aviso y el botón', async () => {
      const getMe = jest
        .fn()
        .mockRejectedValueOnce(new AuthError('network'))
        .mockResolvedValue(USER);
      const ctx = await degradedApp(getMe);
      expect(ctx.api.getMe).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByText('Reintentar'));
      await waitFor(() => expect(screen.queryByText(/Sin conexión estable/)).toBeNull());
      expect(ctx.api.getMe).toHaveBeenCalledTimes(2); // una sola comprobación por pulsación
      expect(ctx.api.refresh).not.toHaveBeenCalled();
      expect(screen.queryByText('Reintentar')).toBeNull();
      expect(screen.getByText('Sesión iniciada')).toBeTruthy();
    });

    it('fallo: conserva la sesión, el aviso y el botón', async () => {
      const getMe = jest.fn().mockRejectedValue(new AuthError('network'));
      const ctx = await degradedApp(getMe);
      await fireEvent.press(screen.getByText('Reintentar'));
      await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
      expect(screen.getByText('Sesión iniciada')).toBeTruthy();
      expect(screen.getByText(/Sin conexión estable/)).toBeTruthy();
      expect(screen.getByText('Reintentar')).toBeTruthy();
      expect(ctx.storage.session()).not.toBeNull();
    });

    it('queda deshabilitado mientras hay una operación en curso', async () => {
      let release!: (user: typeof USER) => void;
      const pending = new Promise<typeof USER>((resolve) => {
        release = resolve;
      });
      const getMe = jest
        .fn()
        .mockRejectedValueOnce(new AuthError('network'))
        .mockReturnValue(pending);
      await degradedApp(getMe);
      await fireEvent.press(screen.getByText('Reintentar'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled(),
      );
      await fireEvent.press(screen.getByText('Reintentar'));
      expect(getMe).toHaveBeenCalledTimes(2);
      release(USER);
      await waitFor(() => expect(screen.queryByText('Reintentar')).toBeNull());
    });

    const UNVERIFIED = 'No pudimos verificar tu sesión. Puedes reintentar más tarde';

    it('401 de /me con access vigente: muestra el texto de verificación, no el de conectividad, y conserva Reintentar', async () => {
      const getMe = jest
        .fn()
        .mockRejectedValueOnce(new AuthError('network'))
        .mockRejectedValueOnce(new AuthError('rejected', 401));
      const ctx = await degradedApp(getMe);
      await fireEvent.press(screen.getByText('Reintentar'));
      expect(await screen.findByText(UNVERIFIED)).toBeTruthy();
      expect(screen.queryByText(/Sin conexión estable/)).toBeNull();
      expect(screen.getByText('Reintentar')).toBeTruthy();
      expect(screen.getByText('Sesión iniciada')).toBeTruthy();
      expect(ctx.api.refresh).not.toHaveBeenCalled();
      expect(ctx.storage.session()).not.toBeNull();
    });

    it('401 y después fallo de red: vuelve el texto de conectividad', async () => {
      const getMe = jest
        .fn()
        .mockRejectedValueOnce(new AuthError('network'))
        .mockRejectedValueOnce(new AuthError('rejected', 401))
        .mockRejectedValueOnce(new AuthError('server', 503));
      const ctx = await degradedApp(getMe);
      await fireEvent.press(screen.getByText('Reintentar'));
      await screen.findByText(UNVERIFIED);
      ctx.clock.advance(5_000);
      await fireEvent.press(screen.getByText('Reintentar'));
      expect(await screen.findByText(/Sin conexión estable/)).toBeTruthy();
      expect(screen.queryByText(UNVERIFIED)).toBeNull();
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });

    it('401 y después éxito: desaparecen el aviso y el botón', async () => {
      const getMe = jest
        .fn()
        .mockRejectedValueOnce(new AuthError('network'))
        .mockRejectedValueOnce(new AuthError('rejected', 401))
        .mockResolvedValue(USER);
      const ctx = await degradedApp(getMe);
      await fireEvent.press(screen.getByText('Reintentar'));
      await screen.findByText(UNVERIFIED);
      ctx.clock.advance(5_000);
      await fireEvent.press(screen.getByText('Reintentar'));
      await waitFor(() => expect(screen.queryByText(UNVERIFIED)).toBeNull());
      expect(screen.queryByText(/Sin conexión estable/)).toBeNull();
      expect(screen.queryByText('Reintentar')).toBeNull();
    });

    it('sin degradación no hay botón Reintentar', async () => {
      const { service } = setup(valid());
      await render(<App service={service} />);
      await screen.findByText('Sesión iniciada');
      expect(screen.queryByText('Reintentar')).toBeNull();
    });
  });

  it('no disponible: no muestra el login, ofrece Reintentar y se recupera', async () => {
    const refresh = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValue({
        accessToken: fakeJwt(900),
        expiresIn: 900,
        refreshToken: 'R'.repeat(43),
        refreshExpiresAt: '2026-11-13T12:00:00.000Z',
      });
    const expired: Parameters<typeof fakeStorage>[0] = {
      kind: 'session',
      session: storedSession({ accessToken: fakeJwt(-10) }),
    };
    const { service, clock } = setup(expired, fakeGoogle(), fakeApi({ refresh }));
    await render(<App service={service} />);

    expect(await screen.findByText('Sesión no disponible')).toBeTruthy();
    clock.advance(5_000); // intervalo mínimo entre reintentos que llegan a la red
    expect(screen.getByText(/No se pudo conectar con el servidor/)).toBeTruthy();
    expect(screen.queryByText('Ingresar con Google')).toBeNull();

    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('no disponible por almacenamiento: mensaje propio y botón Reintentar', async () => {
    const { service } = setup({ kind: 'unsupported' });
    await render(<App service={service} />);
    expect(await screen.findByText(/almacenamiento seguro de este dispositivo/)).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});

describe('mensajes de pantalla por causa', () => {
  const expired = (): Parameters<typeof fakeStorage>[0] => ({
    kind: 'session',
    session: storedSession({ accessToken: fakeJwt(-10) }),
  });
  const invalidRefresh = () => new AuthError('rejected', 401, 'INVALID_REFRESH_TOKEN');

  it.each([
    ['play-services', /Google Play Services/],
    ['config', /configuración de acceso con Google es incorrecta/],
    ['unknown', /Ocurrió un error inesperado/],
  ] as const)('Home no disponible por "%s": texto propio y Reintentar', async (kind, text) => {
    const google = fakeGoogle({ signInSilently: jest.fn().mockRejectedValue(new AuthError(kind)) });
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) });
    const { service } = setup(expired(), google, api);
    await render(<App service={service} />);

    expect(await screen.findByText('Sesión no disponible')).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(/servidor no está disponible/)).toBeNull();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });

  it('Home no disponible por red: texto de conexión', async () => {
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(new AuthError('network')) });
    const { service } = setup(expired(), fakeGoogle(), api);
    await render(<App service={service} />);
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy();
  });

  it('Home no disponible por servidor: texto de servidor', async () => {
    const api = fakeApi({ refresh: jest.fn().mockRejectedValue(new AuthError('server', 503)) });
    const { service } = setup(expired(), fakeGoogle(), api);
    await render(<App service={service} />);
    expect(await screen.findByText(/El servidor no está disponible por ahora/)).toBeTruthy();
  });

  it('Home no disponible por almacenamiento: texto de almacenamiento', async () => {
    const { service } = setup({ kind: 'unsupported' });
    await render(<App service={service} />);
    expect(await screen.findByText(/No se pudo leer la sesión del almacenamiento/)).toBeTruthy();
  });

  describe('LoginScreen: motivo de cierre', () => {
    const revokedSetup = (storageFailsToClear = false) => {
      const google = fakeGoogle({
        signInSilently: jest.fn(async () => ({ status: 'no-saved-credential' as const })),
      });
      const api = fakeApi({ refresh: jest.fn().mockRejectedValue(invalidRefresh()) });
      const ctx = setup(expired(), google, api);
      if (storageFailsToClear) ctx.storage.failAlways('clearAll');
      return ctx;
    };
    const REVOKED_TEXT = 'Tu sesión ya no está disponible en este dispositivo. Ingresa con Google.';

    it("sesión 'revoked': texto neutro, sin afirmar revocación remota", async () => {
      const { service } = revokedSetup();
      await render(<App service={service} />);

      expect(await screen.findByText(REVOKED_TEXT)).toBeTruthy();
      expect(screen.queryByText(/revoc/i)).toBeNull();
      expect(screen.getByText('Ingresar con Google')).toBeTruthy();
    });

    it("sin sesión 'absent' o tras un cierre voluntario no hay aviso", async () => {
      const { service } = setup();
      await render(<App service={service} />);
      await screen.findByText('Ingresar con Google');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('prioridad: un error más específico reemplaza al motivo de cierre', async () => {
      const { service, google } = revokedSetup();
      (google.signIn as jest.Mock).mockRejectedValue(new AuthError('play-services'));
      await render(<App service={service} />);
      await screen.findByText(REVOKED_TEXT);
      await fireEvent.press(screen.getByText('Ingresar con Google'));

      expect(await screen.findByText(/Google Play Services/)).toBeTruthy();
      expect(screen.queryByText(REVOKED_TEXT)).toBeNull();
    });

    it('prioridad: el aviso de almacenamiento reemplaza al motivo de cierre', async () => {
      const { service } = revokedSetup(true);
      await render(<App service={service} />);

      expect(await screen.findByText(/No se pudo borrar por completo la sesión/)).toBeTruthy();
      expect(screen.queryByText(REVOKED_TEXT)).toBeNull();
    });

    it("cambio de cuenta: sale el error 'conflict' y no el motivo de cierre", async () => {
      const api = fakeApi({
        refresh: jest.fn().mockRejectedValue(invalidRefresh()),
        exchangeGoogleToken: jest.fn().mockResolvedValue({
          accessToken: fakeJwt(900),
          expiresIn: 900,
          refreshToken: 'O'.repeat(43),
          refreshExpiresAt: '2026-11-13T12:00:00.000Z',
          user: { id: 'sub-2', email: 'beto@example.com' },
        }),
      });
      const { service } = setup(expired(), fakeGoogle(), api);
      await render(<App service={service} />);

      expect(await screen.findByText(/La cuenta de Google cambió/)).toBeTruthy();
      expect(screen.queryByText(REVOKED_TEXT)).toBeNull();
    });
  });
});
