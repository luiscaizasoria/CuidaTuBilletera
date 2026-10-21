// Eliminar la cuenta de extremo a extremo con el servicio real y dobles de Google, API y
// almacenamiento (G1; ELIM-c, ELIM-g, ELIM-p, ELIM-r). Sin red ni módulos nativos.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import App from './App';
import { createAuthService } from './lib/auth-service';
import { fakeResourcesApi } from './resources-test-utils';
import {
  controlledPromise,
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  relaxTimeoutsForColdCache,
  storedSession,
  USER,
} from './test-utils';

relaxTimeoutsForColdCache();

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

const DELETED =
  'Tu cuenta y tus datos se eliminaron. Si vuelves a ingresar con Google, empezarás con una cuenta nueva y vacía.';

function setup(overrides: { api?: ReturnType<typeof fakeApi> } = {}) {
  const clock = fakeClock();
  const storage = fakeStorage({
    kind: 'session',
    session: storedSession({ accessToken: fakeJwt(600) }),
  });
  const google = fakeGoogle();
  const api = overrides.api ?? fakeApi();
  const onAccountDeleted = jest.fn(async () => undefined);
  const service = createAuthService({
    google,
    storage,
    api,
    onAccountDeleted,
    now: clock.now,
    sleep: clock.sleep,
    random: clock.random,
  });
  return { storage, google, api, service, onAccountDeleted };
}

async function openDeleteSheet() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Tu perfil y sesión' }));
  await fireEvent.press(
    within(screen.getByTestId('profile-sheet')).getByRole('button', {
      name: 'Eliminar mi cuenta y mis datos',
    }),
  );
  await screen.findByTestId('delete-account-sheet');
}

const confirm = async (text = 'eliminar') => {
  await fireEvent.changeText(screen.getByLabelText('Escribe ELIMINAR para confirmar'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
};

describe('App: eliminar la cuenta', () => {
  it('éxito: vuelve al Login con el aviso de éxito, limpia todo y Atrás no regresa', async () => {
    const { service, storage, google, api, onAccountDeleted } = setup();
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();

    expect(await screen.findByText(DELETED)).toBeTruthy();
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.queryByText(/cerrar la app/i)).toBeNull();
    expect(screen.queryByRole('header', { name: 'Mis cuentas' })).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"type":"Modal"');

    // ELIM-c: la API recibe el literal y el ID token de la reautenticación.
    expect(google.reauthenticate).toHaveBeenCalledTimes(1);
    expect(api.deleteAccount).toHaveBeenCalledWith(expect.any(String), 'google-id-token');
    expect(api.logout).not.toHaveBeenCalled();
    expect(storage.isEmpty()).toBe(true);
    expect(onAccountDeleted).toHaveBeenCalledWith(USER.id);
    expect(google.signOut).toHaveBeenCalled();

    // Atrás desde el Login no devuelve a pantallas protegidas.
    await act(async () => {
      (BackHandler as unknown as { mockPressBack?: () => void }).mockPressBack?.();
    });
    expect(screen.queryByRole('header', { name: 'Mis cuentas' })).toBeNull();
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
  });

  it('ELIM-p: volver a ingresar con Google quita el aviso y abre Mis cuentas', async () => {
    const { service } = setup();
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();
    await screen.findByText(DELETED);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(await screen.findByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
    expect(screen.queryByText(DELETED)).toBeNull();
  });

  it('sesión caducada (401 INVALID_TOKEN al primer intento): Login sin aviso de eliminación', async () => {
    const { AuthError } = jest.requireActual('./lib/auth-types');
    const api = fakeApi({
      deleteAccount: jest.fn().mockRejectedValue(new AuthError('rejected', 401, 'INVALID_TOKEN')),
    });
    const { service, storage } = setup({ api });
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();
    expect(await screen.findByText('Continuar con Google')).toBeTruthy();
    expect(screen.queryByText(DELETED)).toBeNull();
    expect(screen.getByText(/Tu sesión ya no está disponible/)).toBeTruthy();
    expect(storage.isEmpty()).toBe(true);
  });

  it('REAUTH_REQUIRED: la hoja sigue abierta con el mensaje y la sesión intacta', async () => {
    const { AuthError } = jest.requireActual('./lib/auth-types');
    const api = fakeApi({
      deleteAccount: jest.fn().mockRejectedValue(new AuthError('unknown', 401, 'REAUTH_REQUIRED')),
    });
    const { service, storage } = setup({ api });
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();
    expect(await screen.findByText(/Elige la cuenta con la que iniciaste sesión/)).toBeTruthy();
    expect(screen.getByTestId('delete-account-sheet')).toBeTruthy();
    expect(storage.session()).not.toBeNull();
  });

  it('incierto: «Comprobar y reintentar» sondea /me y, si ya no existe, termina en Login con éxito', async () => {
    const { AuthError } = jest.requireActual('./lib/auth-types');
    const api = fakeApi({
      deleteAccount: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    (api.getMe as jest.Mock).mockRejectedValue(new AuthError('rejected', 401, 'INVALID_TOKEN'));
    const { service, google } = setup({ api });
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();
    await fireEvent.press(await screen.findByRole('button', { name: 'Comprobar y reintentar' }));
    expect(await screen.findByText(DELETED)).toBeTruthy();
    // Sin segundo selector: la comprobación no pide cuenta de Google.
    expect(google.reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('durante la reautenticación muestra el progreso y, al confirmar Google, termina en Login', async () => {
    const gate = controlledPromise<{ status: 'success'; idToken: string }>();
    const { service, google } = setup();
    (google.reauthenticate as jest.Mock).mockReturnValue(gate.promise);
    await render(<App service={service} resourcesApi={fakeResourcesApi()} />);
    await openDeleteSheet();
    await confirm();
    expect(
      await screen.findByText('Elige tu cuenta de Google para verificar la cuenta'),
    ).toBeTruthy();
    await act(async () => {
      gate.resolve({ status: 'success', idToken: 'google-id-token' });
    });
    await waitFor(() => expect(screen.getByText(DELETED)).toBeTruthy());
  });
});
