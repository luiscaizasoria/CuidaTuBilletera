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
  relaxTimeoutsForColdCache,
} from './test-utils';

relaxTimeoutsForColdCache();

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

// R2: solo cambia el recorrido (Mis cuentas es la pantalla inicial y Categorías vive en Más del
// Detalle de la cuenta). Las aserciones de aislamiento se conservan todas.
const card = (nombre: string) => new RegExp(`^${nombre}, saldo actual`);
const openProfile = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));

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
      // Mis cuentas de A y Mis cuentas de B (con compuerta). Ya no hay un Inicio aparte.
      .mockResolvedValueOnce(pageOf([account({ id: 'a-1', nombre: 'Cuenta de Ana' })]))
      .mockReturnValueOnce(gateB.promise);
    const resourcesApi = fakeResourcesApi({ listAccounts });

    await render(<App service={service} resourcesApi={resourcesApi} />);

    // Usuario A abre su cuenta y, desde Más, Categorías.
    await fireEvent.press(await screen.findByRole('button', { name: card('Cuenta de Ana') }));
    await fireEvent.press(await screen.findByRole('tab', { name: 'Más' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByRole('header', { name: 'Categorías' })).toBeTruthy();

    // Cierra sesión: vuelve al login y no queda nada de A.
    await act(async () => {
      await service.signOut();
    });
    expect(await screen.findByText('Continuar con Google')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();

    // Ingresa B: empieza en Mis cuentas (no en la pantalla de A) y su lista no muestra datos de A.
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(await screen.findByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Categorías' })).toBeNull();
    await openProfile();
    expect(screen.getByText(userB.email)).toBeTruthy();
    expect(screen.queryByText(USER.email)).toBeNull();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(await screen.findByTestId('accounts-loading')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();

    await act(async () =>
      gateB.resolve(pageOf([account({ id: 'b-1', nombre: 'Cuenta de Beto' })])),
    );
    expect(await screen.findByText('Cuenta de Beto')).toBeTruthy();
    expect(screen.queryByText(/Cuenta de Ana/)).toBeNull();
    // Una lectura por usuario (antes 4: Inicio y Cuentas de cada uno).
    expect(listAccounts).toHaveBeenCalledTimes(2);
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
    // Mis cuentas pide la lista al entrar (antes había que abrir Cuentas desde Inicio).
    expect(await screen.findByTestId('accounts-loading')).toBeTruthy();
    await act(async () => {
      await service.signOut();
    });
    await screen.findByText('Continuar con Google');
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
    // Semana de la cuenta Banco elegida por A y semana de la cuenta de B (con compuerta).
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({
        items: [transaction({ accountId: 'a-2', nota: 'Nota privada de Ana' })],
        page: 1,
        pageSize: 10,
        total: 1,
      })
      .mockReturnValueOnce(gateTx.promise);
    const resourcesApi = fakeResourcesApi({ listAccounts, listTransactions });

    await render(<App service={service} resourcesApi={resourcesApi} />);
    await fireEvent.press(await screen.findByRole('button', { name: card('Banco de Ana') }));
    expect(await screen.findByRole('button', { name: 'Cuenta Banco de Ana' })).toBeTruthy();
    expect(await screen.findByText('Nota privada de Ana')).toBeTruthy();

    await act(async () => {
      await service.signOut();
    });
    await screen.findByText('Continuar con Google');
    expect(screen.queryByText(/de Ana/)).toBeNull();
    expect(screen.queryByText('Nota privada de Ana')).toBeNull();

    await fireEvent.press(screen.getByText('Continuar con Google'));
    // B empieza en Mis cuentas (no dentro de la a-2 elegida por A) y sin movimientos de A.
    expect(await screen.findByText('Primera de Beto')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
    expect(screen.queryByTestId('context-bar')).toBeNull();
    expect(screen.queryByText('Nota privada de Ana')).toBeNull();
    expect(screen.queryByText(/de Ana/)).toBeNull();
    expect(listTransactions).toHaveBeenCalledTimes(1);
    // B abre la cuenta con el mismo id a-2: mientras carga no aparece nada de A.
    await fireEvent.press(screen.getByRole('button', { name: card('Segunda de Beto') }));
    expect(await screen.findByRole('button', { name: 'Cuenta Segunda de Beto' })).toBeTruthy();
    expect(screen.queryByText('Nota privada de Ana')).toBeNull();
    expect(screen.queryByText(/de Ana/)).toBeNull();
    await act(async () => gateTx.resolve({ items: [], page: 1, pageSize: 10, total: 0 }));
    expect(await screen.findByText('Esta semana no has anotado movimientos.')).toBeTruthy();
  });
});
