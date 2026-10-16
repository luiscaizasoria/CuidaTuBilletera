// Mis cuentas (R2). Reescritura parcial: los casos de estados se conservan con los textos nuevos;
// los de crear y renombrar pasaron a NewAccountScreen.test y MoreScreen.test, y los de archivar a
// MoreScreen.test (la lista ya no tiene acciones internas). Se trasladan aquí los casos útiles del
// antiguo HomeScreen.test (sesión degradada y no disponible, error con reintento, desmontaje, vacío).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError, type Page, type ResourcesApi } from '../lib/resources-api';
import { account, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import AccountsScreen, { ACCOUNTS_ERROR } from './AccountsScreen';

const mockAuthState: Record<string, unknown> = {};
const resetAuth = () =>
  Object.assign(mockAuthState, {
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana López' },
    busy: false,
    degraded: false,
    unavailableCause: null,
    error: null,
    signOut: jest.fn(),
    restore: jest.fn(),
  });
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

const open = jest.fn();
const create = jest.fn();
const notify = jest.fn();
const renderScreen = (api: ResourcesApi = fakeResourcesApi(), initialArchivedOpen = false) =>
  render(
    <AccountsScreen
      api={api}
      onOpenAccount={open}
      onCreateAccount={create}
      onNotify={notify}
      initialArchivedOpen={initialArchivedOpen}
    />,
  );
const withAccounts = (items: ReturnType<typeof account>[]) =>
  fakeResourcesApi({ listAccounts: jest.fn(async () => pageOf(items)) });

const two = [
  account({ id: 'acc-1', nombre: 'Efectivo', saldo: 123456 }),
  account({ id: 'acc-2', nombre: 'Banco', saldo: -2550 }),
];

beforeEach(() => {
  resetAuth();
  open.mockClear();
  create.mockClear();
  notify.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('AccountsScreen: estados', () => {
  it('carga: esqueleto sin cifras y «Cargando tus cuentas…»; luego las tarjetas', async () => {
    const gate = controlledPromise<Page<ReturnType<typeof account>>>();
    await renderScreen(fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise) }));
    expect(screen.getByTestId('accounts-loading')).toBeTruthy();
    expect(screen.getByText('Cargando tus cuentas…')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByTestId('accounts-total')).toBeNull();
    await act(async () => gate.resolve(pageOf(two)));
    expect(await screen.findByText('Efectivo')).toBeTruthy();
    expect(screen.queryByTestId('accounts-loading')).toBeNull();
  });

  it('pide todas las cuentas (con archivadas) en una sola lectura de page_size 100', async () => {
    const api = withAccounts(two);
    await renderScreen(api);
    await screen.findByText('Efectivo');
    expect(api.listAccounts).toHaveBeenCalledTimes(1);
    expect(api.listAccounts).toHaveBeenCalledWith('tok', {
      pageSize: 100,
      incluirArchivadas: true,
    });
  });

  it('tarjetas: nombre, «Saldo actual» y saldo con signo; etiqueta accesible completa', async () => {
    await renderScreen(withAccounts(two));
    expect(await screen.findByText('$1234.56')).toBeTruthy();
    expect(screen.getByText('-$25.50')).toBeTruthy();
    expect(screen.getAllByText('Saldo actual')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Banco, saldo actual -$25.50. Abrir cuenta' }),
    ).toBeTruthy();
    expect(screen.queryByText('Toca para ver tus movimientos')).toBeNull();
  });

  it('con una sola cuenta activa invita a tocarla y no muestra el Total', async () => {
    await renderScreen(withAccounts([account()]));
    expect(await screen.findByText('Toca para ver tus movimientos')).toBeTruthy();
    expect(screen.queryByTestId('accounts-total')).toBeNull();
  });

  it('Total con 2 o más activas: suma exacta (con negativos) y etiqueta accesible', async () => {
    await renderScreen(withAccounts(two));
    const total = await screen.findByTestId('accounts-total');
    expect(total.props.accessibilityLabel).toBe(
      'Total en tus cuentas, $1209.06, suma de 2 cuentas activas',
    );
    expect(screen.getByText('Suma de los saldos de 2 cuentas')).toBeTruthy();
    expect(screen.queryByText('No incluye cuentas archivadas')).toBeNull();
  });

  it('Total excluye las archivadas y lo indica', async () => {
    await renderScreen(
      withAccounts([
        ...two,
        account({ id: 'acc-3', nombre: 'Vieja', saldo: 99999, archivada: true }),
      ]),
    );
    const total = await screen.findByTestId('accounts-total');
    expect(total.props.accessibilityLabel).toContain('$1209.06');
    expect(screen.getByText('No incluye cuentas archivadas')).toBeTruthy();
  });

  it('vacío sin archivadas: explica qué es una cuenta y ofrece crear la primera', async () => {
    await renderScreen(withAccounts([]));
    expect(await screen.findByText('Todavía no tienes cuentas')).toBeTruthy();
    expect(screen.getByText(/efectivo, banco o tarjeta/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nueva cuenta' })).toBeNull();
    expect(screen.queryByText(/Archivadas/)).toBeNull();
    await fireEvent.press(screen.getByText('Crear mi primera cuenta'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('vacío con archivadas: mensaje propio, crear y la sección Archivadas', async () => {
    await renderScreen(withAccounts([account({ archivada: true })]));
    expect(await screen.findByText(/No tienes cuentas activas/)).toBeTruthy();
    expect(screen.getByText('Crear mi primera cuenta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archivadas (1)' })).toBeTruthy();
  });

  it('error: mensaje fijo en español (sin el del servidor) y Reintentar recarga', async () => {
    const listAccounts = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf([account()]));
    await renderScreen(fakeResourcesApi({ listAccounts }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(ACCOUNTS_ERROR);
    expect(screen.queryByTestId('accounts-total')).toBeNull();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('Efectivo')).toBeTruthy();
    expect(listAccounts).toHaveBeenCalledTimes(2);
  });

  it('un error de negocio inesperado también muestra el mensaje fijo', async () => {
    await renderScreen(
      fakeResourcesApi({
        listAccounts: jest.fn().mockRejectedValue(new ApiRequestError(418, 'RARO')),
      }),
    );
    expect(await screen.findByText(ACCOUNTS_ERROR)).toBeTruthy();
    expect(screen.queryByText(/RARO/)).toBeNull();
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<Page<ReturnType<typeof account>>>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderScreen(
      fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise) }),
    );
    await view.unmount();
    await act(async () => gate.resolve(pageOf([account()])));
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('AccountsScreen: acciones', () => {
  it('tocar la tarjeta abre la cuenta con los datos de GET /accounts', async () => {
    const api = withAccounts(two);
    await renderScreen(api);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Banco, saldo actual -$25.50. Abrir cuenta' }),
    );
    expect(open).toHaveBeenCalledWith(two[1]);
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('«+ Nueva cuenta» (etiqueta «Nueva cuenta») abre Crear cuenta', async () => {
    await renderScreen(withAccounts(two));
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('Archivadas: colapsada por defecto; al desplegar muestra Ver y Desarchivar', async () => {
    const vieja = account({ id: 'acc-9', nombre: 'Vieja', saldo: -100, archivada: true });
    await renderScreen(withAccounts([...two, vieja]));
    const toggle = await screen.findByRole('button', { name: 'Archivadas (1)' });
    expect(toggle.props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByText('Vieja')).toBeNull();
    await fireEvent.press(toggle);
    expect(
      screen.getByRole('button', { name: 'Archivadas (1)' }).props.accessibilityState.expanded,
    ).toBe(true);
    expect(screen.getByText('Vieja')).toBeTruthy();
    expect(screen.getByText('Archivada')).toBeTruthy();
    expect(screen.getByText('-$1.00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver Vieja' }));
    expect(open).toHaveBeenCalledWith(vieja);
  });

  it('initialArchivedOpen la muestra desplegada (tras archivar desde Más)', async () => {
    await renderScreen(
      withAccounts([...two, account({ id: 'x', nombre: 'Vieja', archivada: true })]),
      true,
    );
    expect(await screen.findByText('Vieja')).toBeTruthy();
  });

  it('desarchivar no pide confirmación, avisa y recarga la lista', async () => {
    const listAccounts = jest
      .fn()
      .mockResolvedValueOnce(pageOf([account({ archivada: true })]))
      .mockResolvedValueOnce(pageOf([account({ archivada: false })]));
    const api = fakeResourcesApi({ listAccounts });
    await renderScreen(api, true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Desarchivar Efectivo' }));
    await waitFor(() =>
      expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { archivada: false }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('Cuenta desarchivada');
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Toca para ver tus movimientos')).toBeTruthy();
  });

  it('desarchivar: ocupado mientras guarda (una sola llamada) y error en español', async () => {
    const gate = controlledPromise<ReturnType<typeof account>>();
    const api = fakeResourcesApi({
      listAccounts: jest.fn(async () => pageOf([account({ archivada: true })])),
      updateAccount: jest.fn(() => gate.promise),
    });
    await renderScreen(api, true);
    const button = await screen.findByRole('button', { name: 'Desarchivar Efectivo' });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(api.updateAccount).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Desarchivar Efectivo' }).props.accessibilityState,
    ).toEqual({ disabled: true, busy: true });
    await act(async () => gate.reject(new ApiRequestError(409, 'LIMIT_REACHED')));
    expect(await screen.findByText(/Alcanzaste el límite permitido/)).toBeTruthy();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('AccountsScreen: encabezado, perfil y sesión', () => {
  it('marca, saludo con el primer nombre (nunca el correo) y título como encabezado', async () => {
    await renderScreen();
    expect(screen.getByText('CuidaTuBilletera')).toBeTruthy();
    expect(screen.getByText('Hola, Ana')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
    expect(screen.queryByText('ana@example.com')).toBeNull();
    await screen.findByText('Efectivo');
  });

  it('sin nombre saluda solo con «Hola» y el avatar usa la inicial del correo', async () => {
    Object.assign(mockAuthState, { user: { id: 'u', email: 'beto@example.com' } });
    await renderScreen();
    expect(screen.getByText('Hola')).toBeTruthy();
    expect(screen.getByText('B', { includeHiddenElements: true })).toBeTruthy();
    await screen.findByText('Efectivo');
  });

  it('el avatar abre la hoja de perfil con nombre, correo y Cerrar sesión sin confirmación', async () => {
    await renderScreen();
    await screen.findByText('Efectivo');
    expect(screen.queryByText('ana@example.com')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
    expect(screen.getByText('Ana López')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('la hoja se cierra con «Cerrar», tocando fuera o con Atrás (onRequestClose)', async () => {
    await renderScreen();
    await screen.findByText('Efectivo');
    const avatar = screen.getByRole('button', { name: 'Tu perfil y sesión' });
    await fireEvent.press(avatar);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('ana@example.com')).toBeNull();

    await fireEvent.press(avatar);
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(screen.queryByText('ana@example.com')).toBeNull();

    await fireEvent.press(avatar);
    await fireEvent(screen.getByTestId('profile-sheet'), 'requestClose');
    expect(screen.queryByText('ana@example.com')).toBeNull();
  });

  it('sesión degradada: franja con Reintentar (restore) y la lista se carga igual', async () => {
    Object.assign(mockAuthState, { degraded: true });
    await renderScreen();
    expect(screen.getByText(/Sin conexión estable/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockAuthState.restore).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Efectivo')).toBeTruthy();
  });

  it('sesión degradada por 401: texto de verificación; Reintentar ocupado mientras restaura', async () => {
    Object.assign(mockAuthState, { degraded: true, error: 'rejected', busy: true });
    await renderScreen();
    expect(
      screen.getByText('No pudimos verificar tu sesión. Puedes reintentar más tarde'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' }).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    await screen.findByText('Efectivo');
  });

  it('sesión no disponible: no consulta la API; franja, Reintentar y Cerrar sesión visibles', async () => {
    Object.assign(mockAuthState, { status: 'unavailable', unavailableCause: 'network' });
    const api = fakeResourcesApi();
    await renderScreen(api);
    expect(screen.getByText('Sesión no disponible')).toBeTruthy();
    expect(screen.getByText(/No se pudo conectar con el servidor/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockAuthState.restore).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockAuthState.signOut).toHaveBeenCalled();
    expect(api.listAccounts).not.toHaveBeenCalled();
    expect(screen.queryByTestId('accounts-loading')).toBeNull();
  });
});
