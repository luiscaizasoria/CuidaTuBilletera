import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { ResourcesApi } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import AccountSummaryTab from './AccountSummaryTab';
import type { BalanceStatus } from './navigation';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));
// Viernes 16 de octubre de 2026: la semana va del lunes 12 al domingo 18.
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
}));

const handlers = {
  onRetryBalance: jest.fn(),
  onMonthChange: jest.fn(),
  onSeeAll: jest.fn(),
  onOpenTransaction: jest.fn(),
};

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    getReportSummary: jest.fn(async (_t, o) => ({
      ...o,
      ingresos: 150000,
      gastos: 4550,
      balance: 145450,
      cantidad: 3,
    })),
    listCategories: jest.fn(async () => pageOf([category({ id: 'cat-1', nombre: 'Comida' })])),
    listTransactions: jest.fn(async () =>
      pageOf([transaction({ id: 't1', nota: 'almuerzo', fecha: '2026-10-14' })]),
    ),
    ...overrides,
  });
}

const renderTab = (
  api: ResourcesApi = makeApi(),
  {
    acc = account({ saldo: 123456 }),
    balance = 'ok' as BalanceStatus,
    justCreated = false,
    month = '2026-10',
  } = {},
) =>
  render(
    <AccountSummaryTab
      api={api}
      account={acc}
      balance={balance}
      month={month}
      justCreated={justCreated}
      {...handlers}
    />,
  );

afterEach(() => jest.clearAllMocks());

describe('AccountSummaryTab: saldo', () => {
  it('tarjeta «Saldo actual» con el saldo del contenedor (sin llamar a /balance)', async () => {
    const api = makeApi();
    await renderTab(api);
    expect(screen.getByText('Saldo actual')).toBeTruthy();
    expect(screen.getByText('$1234.56')).toBeTruthy();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
    await screen.findByText('almuerzo');
  });

  it('actualizando: conserva la cifra y muestra «Actualizando…»', async () => {
    await renderTab(makeApi(), { balance: 'refreshing' });
    expect(screen.getByText('$1234.56')).toBeTruthy();
    expect(screen.getByText('Actualizando…')).toBeTruthy();
    await screen.findByText('almuerzo');
  });

  it('error: «Saldo no disponible» con Reintentar; nunca $0.00 ni la cifra vieja', async () => {
    await renderTab(makeApi(), { balance: 'error' });
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Saldo no disponible');
    expect(screen.queryByText('$1234.56')).toBeNull();
    expect(screen.queryByText('$0.00')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar saldo' }));
    expect(handlers.onRetryBalance).toHaveBeenCalledTimes(1);
    await screen.findByText('almuerzo');
  });

  it('cuenta archivada: aviso de modo consulta', async () => {
    await renderTab(makeApi(), { acc: account({ archivada: true }) });
    expect(screen.getByText(/no anotar movimientos/)).toBeTruthy();
    await screen.findByText('almuerzo');
  });
});

describe('AccountSummaryTab: resumen del mes', () => {
  it('Ingresos y Gastos del mes visible con GET /reports/summary', async () => {
    const api = makeApi();
    await renderTab(api);
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    expect(await screen.findByLabelText('Ingresos $1500.00')).toBeTruthy();
    expect(screen.getByLabelText('Gastos $45.50')).toBeTruthy();
    expect(api.getReportSummary).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('Mes anterior y siguiente avisan al contenedor (mes independiente del Calendario)', async () => {
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(handlers.onMonthChange).toHaveBeenLastCalledWith('2026-09');
    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(handlers.onMonthChange).toHaveBeenLastCalledWith('2026-11');
    await screen.findByText('almuerzo');
  });

  it('usa el mes recibido', async () => {
    const api = makeApi();
    await renderTab(api, { month: '2026-02' });
    expect(screen.getByText('Febrero 2026')).toBeTruthy();
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ desde: '2026-02-01', hasta: '2026-02-28' }),
      ),
    );
  });

  it('error del resumen: bloque propio con reintento; la semana se muestra igual', async () => {
    const getReportSummary = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockImplementation(async (_t, o) => ({
        ...o,
        ingresos: 0,
        gastos: 0,
        balance: 0,
        cantidad: 0,
      }));
    await renderTab(makeApi({ getReportSummary }));
    expect(await screen.findByText('No pudimos cargar el resumen del mes.')).toBeTruthy();
    expect(await screen.findByText('almuerzo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar resumen del mes' }));
    expect(await screen.findByLabelText('Ingresos $0.00')).toBeTruthy();
  });
});

describe('AccountSummaryTab: esta semana', () => {
  it('lista de lunes a domingo, máximo 10, y tocar abre Editar', async () => {
    const api = makeApi();
    await renderTab(api);
    expect(screen.getByRole('header', { name: 'Esta semana' })).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    expect(handlers.onOpenTransaction).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    expect(api.listTransactions).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2026-10-12',
      hasta: '2026-10-18',
      page: 1,
      pageSize: 10,
    });
  });

  it('flechas de mes: zona táctil de 48 dp y «Ver todo» como enlace de marca', async () => {
    await renderTab(makeApi());
    const prev = screen.getByRole('button', { name: 'Mes anterior' });
    expect(prev).toHaveStyle({ width: 48, height: 48 });
    expect(screen.getByText('Ver todo ›')).toHaveStyle({ color: '#0F5F5A', fontWeight: '700' });
  });

  it('«Ver todo» lleva a Movimientos', async () => {
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todo' }));
    expect(handlers.onSeeAll).toHaveBeenCalledTimes(1);
    await screen.findByText('almuerzo');
  });

  it('filtro Gastos/Ingresos (Todos por defecto) consulta por tipo', async () => {
    const api = makeApi({ listTransactions: jest.fn(async () => pageOf([])) });
    await renderTab(api);
    const todos = screen.getByRole('radio', { name: 'Todos' });
    expect(todos.props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('Esta semana no tienes gastos anotados.')).toBeTruthy();
    expect(api.listTransactions).toHaveBeenLastCalledWith(
      'tok',
      expect.objectContaining({ tipo: 'gasto' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingresos' }));
    expect(await screen.findByText('Esta semana no tienes ingresos anotados.')).toBeTruthy();
  });

  it('semana vacía: invita a usar +', async () => {
    await renderTab(makeApi({ listTransactions: jest.fn(async () => pageOf([])) }));
    expect(await screen.findByText('Esta semana no has anotado movimientos.')).toBeTruthy();
    expect(screen.getByText('Toca + para registrar el primero.')).toBeTruthy();
    expect(screen.queryByText('Tu cuenta está lista.')).toBeNull();
  });

  it('cuenta recién creada: «Tu cuenta está lista.»', async () => {
    await renderTab(makeApi({ listTransactions: jest.fn(async () => pageOf([])) }), {
      justCreated: true,
    });
    expect(await screen.findByText('Tu cuenta está lista.')).toBeTruthy();
    expect(screen.getByText('Anota tu primer gasto o ingreso con el botón +.')).toBeTruthy();
  });

  it('error de la semana: bloque propio con reintento', async () => {
    const listTransactions = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(pageOf([transaction({ id: 't2', nota: 'ya cargó' })]));
    await renderTab(makeApi({ listTransactions }));
    expect(await screen.findByText('No pudimos cargar los movimientos de la semana.')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Reintentar movimientos de la semana' }),
    );
    expect(await screen.findByText('ya cargó')).toBeTruthy();
  });
});
