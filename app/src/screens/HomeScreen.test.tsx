import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { Page, ResourcesApi, Transaction } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import HomeScreen from './HomeScreen';

const mockAuthState = {
  status: 'authenticated',
  user: { id: 'u', email: 'ana@example.com', name: 'Ana' },
  busy: false,
  degraded: false,
  unavailableCause: null,
  error: null,
  signOut: jest.fn(),
  restore: jest.fn(),
};
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

const accounts = [
  account({ id: 'acc-1', nombre: 'Efectivo', saldo: 123456 }),
  account({ id: 'acc-2', nombre: 'Banco', saldo: -2550 }),
];

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    listAccounts: jest.fn(async () => pageOf(accounts)),
    listCategories: jest.fn(async () => pageOf([category({ id: 'cat-1', nombre: 'Comida' })])),
    listTransactions: jest.fn(async () => ({
      items: [transaction({ id: 't1', nota: 'almuerzo' })],
      page: 1,
      pageSize: 10,
      total: 1,
    })),
    ...overrides,
  });
}

const handlers = {
  onSelectAccount: jest.fn(),
  onNewTransaction: jest.fn(),
  onOpenHistory: jest.fn(),
  onOpenCalendar: jest.fn(),
  onEditTransaction: jest.fn(),
};
const onOpenAccounts = jest.fn();

const renderHome = (api = makeApi(), selectedAccountId: string | null = null) =>
  render(
    <HomeScreen
      api={api}
      onOpenAccounts={onOpenAccounts}
      dashboard={{ selectedAccountId, ...handlers }}
    />,
  );

beforeEach(() => {
  Object.assign(mockAuthState, { status: 'authenticated', degraded: false, error: null });
});
afterEach(() => jest.clearAllMocks());

describe('HomeScreen: panel', () => {
  it('muestra la primera cuenta por defecto, su saldo y sus movimientos recientes', async () => {
    const api = makeApi();
    await renderHome(api);
    expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
    expect(screen.getByText('$1234.56')).toBeTruthy();
    expect(await screen.findByText('almuerzo')).toBeTruthy();
    expect(screen.getByText('-$15.00')).toBeTruthy();
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(api.listAccounts).toHaveBeenCalledWith('tok', { pageSize: 100 });
    expect(api.listTransactions).toHaveBeenCalledWith('tok', { accountId: 'acc-1', pageSize: 10 });
    expect(api.listCategories).toHaveBeenCalledWith('tok', 'acc-1', {
      incluirArchivadas: true,
      pageSize: 100,
    });
  });

  it('conserva sesión, correo, Cuentas y Cerrar sesión', async () => {
    await renderHome();
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cuentas'));
    expect(onOpenAccounts).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(mockAuthState.signOut).toHaveBeenCalled();
  });

  it('usa la cuenta seleccionada y el selector la cambia; el saldo sale de account.saldo', async () => {
    const api = makeApi();
    await renderHome(api, 'acc-2');
    expect(await screen.findByText('Saldo de Banco')).toBeTruthy();
    expect(screen.getByText('-$25.50')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Cuenta Banco' }).props.accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Cuenta Efectivo' }));
    expect(handlers.onSelectAccount).toHaveBeenCalledWith('acc-1');
  });

  it('cambiar la cuenta elegida recarga los movimientos de esa cuenta', async () => {
    const api = makeApi();
    const view = await renderHome(api, 'acc-1');
    await screen.findByText('almuerzo');
    await view.rerender(
      <HomeScreen
        api={api}
        onOpenAccounts={onOpenAccounts}
        dashboard={{ selectedAccountId: 'acc-2', ...handlers }}
      />,
    );
    await screen.findByText('Saldo de Banco');
    expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-2',
      pageSize: 10,
    });
  });

  it('una cuenta seleccionada que ya no existe cae a la primera', async () => {
    await renderHome(makeApi(), 'acc-desaparecida');
    expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
  });

  it('ignora cuentas archivadas', async () => {
    const api = makeApi({
      listAccounts: jest.fn(async () =>
        pageOf([account({ id: 'x', nombre: 'Vieja', archivada: true }), accounts[1]!]),
      ),
    });
    await renderHome(api, 'x');
    expect(await screen.findByText('Saldo de Banco')).toBeTruthy();
    expect(screen.queryByText('Saldo de Vieja')).toBeNull();
  });

  it('Nuevo movimiento y Ver historial reciben la cuenta elegida', async () => {
    await renderHome(makeApi(), 'acc-2');
    await fireEvent.press(await screen.findByText('Nuevo movimiento'));
    expect(handlers.onNewTransaction).toHaveBeenCalledWith(accounts[1]);
    await fireEvent.press(screen.getByText('Ver historial'));
    expect(handlers.onOpenHistory).toHaveBeenCalledWith(accounts[1]);
  });

  it('tocar un movimiento reciente lo abre para edición', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    expect(handlers.onEditTransaction).toHaveBeenCalledWith(
      accounts[0],
      expect.objectContaining({ id: 't1' }),
    );
  });

  it('sin cuentas: estado vacío con acceso a crear cuenta', async () => {
    const api = makeApi({ listAccounts: jest.fn(async () => pageOf([])) });
    await renderHome(api);
    expect(await screen.findByText(/No tienes cuentas activas/)).toBeTruthy();
    expect(screen.queryByText('Nuevo movimiento')).toBeNull();
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(onOpenAccounts).toHaveBeenCalledTimes(1);
    expect(api.listTransactions).not.toHaveBeenCalled();
  });

  it('cuenta sin movimientos: mensaje vacío', async () => {
    const api = makeApi({
      listTransactions: jest.fn(async () => ({ items: [], page: 1, pageSize: 10, total: 0 })),
    });
    await renderHome(api);
    expect(await screen.findByText('Aún no hay movimientos en esta cuenta')).toBeTruthy();
  });
});

describe('HomeScreen: carga y errores', () => {
  it('indicador de carga y luego contenido', async () => {
    const gate = controlledPromise<Page<ReturnType<typeof account>>>();
    await renderHome(makeApi({ listAccounts: jest.fn(() => gate.promise) }));
    expect(screen.getByTestId('home-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageOf(accounts)));
    expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
  });

  it('error al listar cuentas con reintento, sin romper Cerrar sesión', async () => {
    const listAccounts = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf(accounts));
    await renderHome(makeApi({ listAccounts }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    expect(screen.getByText('Cerrar sesión')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar carga'));
    expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
  });

  it('error al listar movimientos conserva el saldo y permite reintentar', async () => {
    const listTransactions = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce({
        items: [transaction({ nota: 'ya cargó' })],
        page: 1,
        pageSize: 10,
        total: 1,
      } satisfies Page<Transaction>);
    await renderHome(makeApi({ listTransactions }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(screen.getByText('$1234.56')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar carga'));
    expect(await screen.findByText('ya cargó')).toBeTruthy();
  });

  it('sesión degradada: sigue mostrando Reintentar de sesión y el panel', async () => {
    Object.assign(mockAuthState, { degraded: true });
    await renderHome();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(mockAuthState.restore).toHaveBeenCalled();
    expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
  });

  it('sesión no disponible: no consulta la API y ofrece Reintentar', async () => {
    Object.assign(mockAuthState, { status: 'unavailable' });
    const api = makeApi();
    await renderHome(api);
    expect(screen.getByText('Sesión no disponible')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    expect(api.listAccounts).not.toHaveBeenCalled();
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<Page<ReturnType<typeof account>>>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderHome(makeApi({ listAccounts: jest.fn(() => gate.promise) }));
    await view.unmount();
    await act(async () => gate.resolve(pageOf(accounts)));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
