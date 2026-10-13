import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from './App';
import { createAuthService } from './lib/auth-service';
import { AuthError } from './lib/auth-types';
import { fakeApi, fakeGoogle, fakeJwt, fakeStorage, NOW_MS, USER } from './test-utils';

// Los módulos nativos no existen en Jest: se sustituyen por dobles.
jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

function setup(opts: Parameters<typeof fakeStorage>[0] = null, google = fakeGoogle()) {
  const storage = fakeStorage(opts);
  const service = createAuthService({ google, storage, api: fakeApi(), now: () => NOW_MS });
  return { storage, google, service };
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
    const { service } = setup(fakeJwt(600));
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
    expect(storage.value()).not.toBeNull();

    await fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(await screen.findByText('Ingresar con Google')).toBeTruthy();
    expect(storage.value()).toBeNull();
  });

  it('cancelar el login no muestra error', async () => {
    const google = fakeGoogle({ signIn: jest.fn(async () => ({ status: 'cancelled' })) });
    const { service } = setup(null, google);
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
    const { service } = setup(null, google);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    expect(await screen.findByText(/Google Play Services/)).toBeTruthy();
  });

  it('durante el inicio muestra carga y no permite pulsar de nuevo', async () => {
    const google = fakeGoogle({ signIn: jest.fn(() => new Promise(() => {})) });
    const { service } = setup(null, google);
    await render(<App service={service} />);
    await fireEvent.press(await screen.findByText('Ingresar con Google'));

    expect(await screen.findByTestId('login-loading')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(google.signIn).toHaveBeenCalledTimes(1);
  });
});
