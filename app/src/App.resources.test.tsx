import { act, fireEvent, render, screen } from '@testing-library/react-native';

import App from './App';
import { createAuthService } from './lib/auth-service';
import { account, fakeResourcesApi, pageOf, transaction } from './resources-test-utils';
import {
  controlledPromise,
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  refreshTokenOf,
  REFRESH_EXPIRES_AT,
  storedSession,
  USER,
} from './test-utils';

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

describe('App: aislamiento de datos entre usuarios', () => {
  it('tras cerrar sesión e ingresar otro usuario no aparecen datos ni pantallas del anterior', async () => {
    const userB = { id: 'sub-2', email: 'beto@example.com', name: 'Beto' };
    const clock = fakeClock();
    const storage = fakeStorage({
      kind: 'session',
      session: storedSession({ accessToken: fakeJwt(600) }),
    });
    const api = fakeApi({
      exchangeGoogleToken: jest.fn(async () => ({
        accessToken: fakeJwt(900, userB, 'b'),
        expiresIn: 900,
        refreshToken: refreshTokenOf('RT-b'),
        refreshExpiresAt: REFRESH_EXPIRES_AT,
        user: userB,
      })),
    });
    const service = createAuthService({
      google: fakeGoogle(),
      storage,
      api,
      now: clock.now,
      sleep: clock.sleep,
      random: clock.random,
    });

    const gateB = controlledPromise<ReturnType<typeof pageOf<ReturnType<typeof account>>>>();
    const listAccounts = jest
      .fn()
      // Inicio de A, pantalla Cuentas de A, Inicio de B y pantalla Cuentas de B (con compuerta).
      .mockResolvedValueOnce(pageOf([account({ id: 'a-1', nombre: 'Cuenta de Ana' })]))
      .mockResolvedValueOnce(pageOf([account({ id: 'a-1', nombre: 'Cuenta de Ana' })]))
      .mockResolvedValueOnce(pageOf([account({ id: 'b-0', nombre: 'Inicio de Beto' })]))
      .mockReturnValueOnce(gateB.promise);
    const resourcesApi = fakeResourcesApi({ listAccounts });

    await render(<App service={service} resourcesApi={resourcesApi} />);

    // Usuario A abre Cuentas y Categorías.
    await fireEvent.press(await screen.findByText('Cuentas'));
    await fireEvent.press(await screen.findByLabelText('Abrir Cuenta de Ana'));
    expect(await screen.findByText('Categorías de Cuenta de Ana')).toBeTruthy();

    // Cierra sesión: vuelve al login y no queda nada de A.
    await act(async () => {
      await service.signOut();
    });
    expect(await screen.findByText('Ingresar con Google')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();

    // Ingresa B: empieza en Inicio (no en la pantalla de A) y su lista no muestra datos de A.
    await fireEvent.press(screen.getByText('Ingresar con Google'));
    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText(userB.email)).toBeTruthy();
    expect(screen.queryByText(USER.email)).toBeNull();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();

    await fireEvent.press(screen.getByText('Cuentas'));
    expect(await screen.findByTestId('accounts-loading')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();

    await act(async () =>
      gateB.resolve(pageOf([account({ id: 'b-1', nombre: 'Cuenta de Beto' })])),
    );
    expect(await screen.findByText('Cuenta de Beto')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();
    expect(listAccounts).toHaveBeenCalledTimes(4);
  });

  it('una respuesta tardía del usuario anterior no se muestra tras desmontar', async () => {
    const clock = fakeClock();
    const storage = fakeStorage({
      kind: 'session',
      session: storedSession({ accessToken: fakeJwt(600) }),
    });
    const service = createAuthService({
      google: fakeGoogle(),
      storage,
      api: fakeApi(),
      now: clock.now,
      sleep: clock.sleep,
      random: clock.random,
    });
    const late = controlledPromise<ReturnType<typeof pageOf<ReturnType<typeof account>>>>();
    const resourcesApi = fakeResourcesApi({ listAccounts: jest.fn(() => late.promise) });

    await render(<App service={service} resourcesApi={resourcesApi} />);
    await fireEvent.press(await screen.findByText('Cuentas'));
    await act(async () => {
      await service.signOut();
    });
    await screen.findByText('Ingresar con Google');
    await act(async () => late.resolve(pageOf([account({ nombre: 'Cuenta tardía' })])));
    expect(screen.queryByText('Cuenta tardía')).toBeNull();
  });

  it('movimientos y cuenta elegida de A no se filtran a B tras cerrar sesión', async () => {
    const userB = { id: 'sub-2', email: 'beto@example.com', name: 'Beto' };
    const clock = fakeClock();
    const storage = fakeStorage({
      kind: 'session',
      session: storedSession({ accessToken: fakeJwt(600) }),
    });
    const api = fakeApi({
      exchangeGoogleToken: jest.fn(async () => ({
        accessToken: fakeJwt(900, userB, 'b'),
        expiresIn: 900,
        refreshToken: refreshTokenOf('RT-b'),
        refreshExpiresAt: REFRESH_EXPIRES_AT,
        user: userB,
      })),
    });
    const service = createAuthService({
      google: fakeGoogle(),
      storage,
      api,
      now: clock.now,
      sleep: clock.sleep,
      random: clock.random,
    });

    const gateTx = controlledPromise<{
      items: never[];
      page: number;
      pageSize: number;
      total: number;
    }>();
    const listAccounts = jest
      .fn()
      .mockResolvedValueOnce(
        pageOf([
          account({ id: 'a-1', nombre: 'Efectivo de Ana' }),
          account({ id: 'a-2', nombre: 'Banco de Ana', saldo: 777 }),
        ]),
      )
      .mockResolvedValueOnce(
        pageOf([
          account({ id: 'a-1', nombre: 'Primera de Beto' }),
          account({ id: 'a-2', nombre: 'Segunda de Beto' }),
        ]),
      );
    // Inicio de A con la primera cuenta, Inicio de A con Banco (tras elegirla) y Inicio de B (con compuerta).
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({ items: [], page: 1, pageSize: 10, total: 0 })
      .mockResolvedValueOnce({
        items: [transaction({ accountId: 'a-2', nota: 'Nota privada de Ana' })],
        page: 1,
        pageSize: 10,
        total: 1,
      })
      .mockReturnValueOnce(gateTx.promise);
    const resourcesApi = fakeResourcesApi({ listAccounts, listTransactions });

    await render(<App service={service} resourcesApi={resourcesApi} />);
    await fireEvent.press(await screen.findByLabelText('Cuenta Banco de Ana'));
    expect(await screen.findByText('Saldo de Banco de Ana')).toBeTruthy();
    expect(await screen.findByText('Nota privada de Ana')).toBeTruthy();

    await act(async () => {
      await service.signOut();
    });
    await screen.findByText('Ingresar con Google');
    expect(screen.queryByText(/de Ana/)).toBeNull();
    expect(screen.queryByText('Nota privada de Ana')).toBeNull();

    await fireEvent.press(screen.getByText('Ingresar con Google'));
    // B empieza con su primera cuenta (no con la a-2 elegida por A) y sin movimientos de A.
    expect(await screen.findByText('Saldo de Primera de Beto')).toBeTruthy();
    expect(screen.queryByText('Nota privada de Ana')).toBeNull();
    expect(screen.queryByText(/de Ana/)).toBeNull();
    await act(async () => gateTx.resolve({ items: [], page: 1, pageSize: 10, total: 0 }));
    expect(await screen.findByText('Aún no hay movimientos en esta cuenta')).toBeTruthy();
  });
});
