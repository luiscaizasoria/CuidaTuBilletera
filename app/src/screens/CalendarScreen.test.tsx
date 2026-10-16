import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { CalendarMonth, Page, ResourcesApi, Transaction } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import CalendarScreen from './CalendarScreen';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));
// Fecha local fija: el calendario no debe depender del reloj del dispositivo.
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-15',
}));

const acc = account({ id: 'acc-1', nombre: 'Efectivo' });

const monthOf = (accountId: string, month: string, days: CalendarMonth['days']): CalendarMonth => ({
  accountId,
  month,
  days,
});

const octoberDays: CalendarMonth['days'] = [
  { fecha: '2026-10-14', ingresos: 120000, gastos: 4550, cantidad: 2 },
  { fecha: '2026-10-15', ingresos: 0, gastos: 1500, cantidad: 1 },
];

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    getCalendar: jest.fn(async (_t, { accountId, month }) =>
      monthOf(accountId, month, month === '2026-10' ? octoberDays : []),
    ),
    listCategories: jest.fn(async () => pageOf([category({ id: 'cat-1', nombre: 'Comida' })])),
    listTransactions: jest.fn(async (_t, options) => ({
      items: [transaction({ id: 't1', fecha: options?.desde ?? '2026-10-15', nota: 'almuerzo' })],
      page: 1,
      pageSize: 20,
      total: 1,
    })),
    ...overrides,
  });
}

const handlers = {
  onViewChange: jest.fn(),
  onOpenTransaction: jest.fn(),
  onNewTransaction: jest.fn(),
};

const renderCalendar = (
  api = makeApi(),
  { month = '2026-10', day = '2026-10-15', acct = acc } = {},
) =>
  render(
    <CalendarScreen account={acct} api={api} initialMonth={month} initialDay={day} {...handlers} />,
  );

afterEach(() => jest.clearAllMocks());

describe('CalendarScreen', () => {
  it('carga el mes de la cuenta y muestra totales e indicadores diarios', async () => {
    const api = makeApi();
    await renderCalendar(api);
    expect(await screen.findByText(/Mes: Ingresos \$1200\.00/)).toBeTruthy();
    expect(screen.getByText(/Gastos \$60\.50/)).toBeTruthy();
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    expect(api.getCalendar).toHaveBeenCalledWith('tok', { accountId: 'acc-1', month: '2026-10' });
    const cell = screen.getByTestId('calendar-cell-2026-10-14');
    expect(cell.props.accessibilityLabel).toContain(
      'ingresos $1200.00, gastos $45.50, 2 movimientos',
    );
    expect(screen.getByText('+1.2k')).toBeTruthy();
    expect(screen.getByText('−45')).toBeTruthy();
    // Día sin movimientos: sin indicadores.
    expect(screen.getByTestId('calendar-cell-2026-10-13').props.accessibilityLabel).toBe(
      '13 de octubre',
    );
  });

  it('muestra «—» en los totales del mes si la suma no es un entero seguro', async () => {
    const big = Number.MAX_SAFE_INTEGER;
    const api = makeApi({
      getCalendar: jest.fn(async (_t, { accountId, month }) =>
        monthOf(accountId, month, [
          { fecha: '2026-10-14', ingresos: big, gastos: 100, cantidad: 1 },
          { fecha: '2026-10-15', ingresos: 1, gastos: 200, cantidad: 1 },
        ]),
      ),
    });
    await renderCalendar(api);
    expect(await screen.findByText('Mes: Ingresos — · Gastos $3.00 · Neto —')).toBeTruthy();
  });

  it('las cabeceras empiezan en lunes y octubre 2026 empieza en jueves', async () => {
    await renderCalendar();
    await screen.findByText(/Mes: Ingresos/);
    expect(
      screen.getAllByLabelText(/^(lunes|domingo)$/).map((n) => n.props.accessibilityLabel),
    ).toEqual(['lunes', 'domingo']);
    expect(screen.getByTestId('calendar-cell-2026-10-31')).toBeTruthy();
    expect(screen.queryByTestId('calendar-cell-2026-10-32')).toBeNull();
  });

  it('cambia de mes, notifica la vista y elige el día 1 si hoy no está en el mes', async () => {
    const api = makeApi();
    await renderCalendar(api);
    await screen.findByText(/Mes: Ingresos/);
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy();
    expect(handlers.onViewChange).toHaveBeenLastCalledWith('2026-11', '2026-11-01');
    expect(api.getCalendar).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      month: '2026-11',
    });
    expect(await screen.findByText('No hay movimientos en este mes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mes anterior'));
    expect(await screen.findByText('Octubre 2026')).toBeTruthy();
    expect(handlers.onViewChange).toHaveBeenLastCalledWith('2026-10', '2026-10-15');
  });

  it('limita la navegación a enero 2000 y diciembre 2100', async () => {
    await renderCalendar(makeApi(), { month: '2000-01', day: '2000-01-01' });
    await screen.findByText('Enero 2000');
    expect(screen.getByLabelText('Mes anterior').props.accessibilityState.disabled).toBe(true);
  });

  it('el límite superior deshabilita Mes siguiente', async () => {
    await renderCalendar(makeApi(), { month: '2100-12', day: '2100-12-31' });
    await screen.findByText('Diciembre 2100');
    expect(screen.getByLabelText('Mes siguiente').props.accessibilityState.disabled).toBe(true);
  });

  it('seleccionar un día muestra su detalle y consulta sus movimientos con desde=hasta', async () => {
    const api = makeApi();
    await renderCalendar(api);
    await screen.findByText('almuerzo');
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    expect(handlers.onViewChange).toHaveBeenLastCalledWith('2026-10', '2026-10-14');
    expect(
      await screen.findByText('Ingresos $1200.00 · Gastos $45.50 · Neto $1154.50'),
    ).toBeTruthy();
    expect(screen.getByText('14 de octubre')).toBeTruthy();
    expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2026-10-14',
      hasta: '2026-10-14',
      pageSize: 20,
      page: 1,
    });
    expect(screen.getByTestId('calendar-cell-2026-10-14').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('día sin movimientos: mensaje vacío', async () => {
    const api = makeApi({
      listTransactions: jest.fn(async () => pageOf<Transaction>([])),
    });
    await renderCalendar(api);
    expect(await screen.findByText('Este día no tiene movimientos registrados')).toBeTruthy();
  });

  it('Cargar más agrega la página siguiente sin duplicar ids', async () => {
    const first = [transaction({ id: 'a', nota: 'uno' }), transaction({ id: 'b', nota: 'dos' })];
    const second = [transaction({ id: 'b', nota: 'dos' }), transaction({ id: 'c', nota: 'tres' })];
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({ items: first, page: 1, pageSize: 20, total: 3 })
      .mockResolvedValueOnce({ items: second, page: 2, pageSize: 20, total: 3 });
    await renderCalendar(makeApi({ listTransactions }));
    await screen.findByText('uno');
    await fireEvent.press(screen.getByText('Cargar más'));
    expect(await screen.findByText('tres')).toBeTruthy();
    expect(screen.getAllByText('dos')).toHaveLength(1);
    expect(listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2026-10-15',
      hasta: '2026-10-15',
      pageSize: 20,
      page: 2,
    });
    expect(screen.queryByText('Cargar más')).toBeNull();
  });

  it('error al cargar más muestra el mensaje y conserva la lista', async () => {
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({
        items: [transaction({ id: 'a', nota: 'uno' })],
        page: 1,
        pageSize: 20,
        total: 2,
      })
      .mockRejectedValueOnce(new AuthError('network'));
    await renderCalendar(makeApi({ listTransactions }));
    await screen.findByText('uno');
    await fireEvent.press(screen.getByText('Cargar más'));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(screen.getByText('uno')).toBeTruthy();
    expect(screen.getByText('Cargar más')).toBeTruthy();
  });

  it('error del mes con reintento; la lista del día sigue visible', async () => {
    const getCalendar = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(monthOf('acc-1', '2026-10', octoberDays));
    await renderCalendar(makeApi({ getCalendar }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    expect(await screen.findByText('almuerzo')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar calendario'));
    expect(await screen.findByText(/Mes: Ingresos/)).toBeTruthy();
  });

  it('error de la lista del día con reintento', async () => {
    const listTransactions = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce({
        items: [transaction({ nota: 'ya cargó' })],
        page: 1,
        pageSize: 20,
        total: 1,
      });
    await renderCalendar(makeApi({ listTransactions }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar movimientos del día'));
    expect(await screen.findByText('ya cargó')).toBeTruthy();
  });

  it('Nuevo movimiento recibe el día seleccionado y tocar un movimiento lo abre', async () => {
    await renderCalendar();
    await screen.findByText('almuerzo');
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    await fireEvent.press(screen.getByText('Nuevo movimiento'));
    expect(handlers.onNewTransaction).toHaveBeenCalledWith('2026-10-14');
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    expect(handlers.onOpenTransaction).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('descarta la respuesta tardía de un día anterior', async () => {
    const slow = controlledPromise<Page<Transaction>>();
    const listTransactions = jest.fn(async (_t: string, options?: { desde?: string }) =>
      options?.desde === '2026-10-15'
        ? slow.promise
        : {
            items: [transaction({ id: 'x', nota: 'del catorce' })],
            page: 1,
            pageSize: 20,
            total: 1,
          },
    );
    await renderCalendar(makeApi({ listTransactions: listTransactions as never }));
    await screen.findByText(/Mes: Ingresos/);
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    expect(await screen.findByText('del catorce')).toBeTruthy();
    await act(async () =>
      slow.resolve({
        items: [transaction({ id: 'y', nota: 'tardío del quince' })],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    );
    expect(screen.queryByText('tardío del quince')).toBeNull();
    expect(screen.getByText('del catorce')).toBeTruthy();
  });

  it('descarta la respuesta tardía de un mes anterior', async () => {
    const slow = controlledPromise<CalendarMonth>();
    const getCalendar = jest.fn(
      async (_t: string, { accountId, month }: { accountId: string; month: string }) =>
        month === '2026-10' ? slow.promise : monthOf(accountId, month, []),
    );
    await renderCalendar(makeApi({ getCalendar: getCalendar as never }));
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(await screen.findByText('No hay movimientos en este mes')).toBeTruthy();
    await act(async () => slow.resolve(monthOf('acc-1', '2026-10', octoberDays)));
    expect(screen.getByText('No hay movimientos en este mes')).toBeTruthy();
    expect(screen.queryByText(/Mes: Ingresos/)).toBeNull();
  });

  it('una respuesta de Cargar más tras cambiar de día se descarta', async () => {
    const more = controlledPromise<Page<Transaction>>();
    const listTransactions = jest.fn(
      async (_t: string, options?: { desde?: string; page?: number }) => {
        if (options?.page === 2) return more.promise;
        return {
          items: [transaction({ id: `p-${options?.desde}`, nota: `primera ${options?.desde}` })],
          page: 1,
          pageSize: 20,
          total: 2,
        };
      },
    );
    await renderCalendar(makeApi({ listTransactions: listTransactions as never }));
    await screen.findByText('primera 2026-10-15');
    await fireEvent.press(screen.getByText('Cargar más'));
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    await screen.findByText('primera 2026-10-14');
    await act(async () =>
      more.resolve({
        items: [transaction({ id: 'late', nota: 'página tardía' })],
        page: 2,
        pageSize: 20,
        total: 2,
      }),
    );
    expect(screen.queryByText('página tardía')).toBeNull();
  });

  it('aislamiento entre cuentas: otra cuenta recarga y no mezcla datos', async () => {
    const api = makeApi();
    const view = await renderCalendar(api);
    await screen.findByText('almuerzo');
    const other = account({ id: 'acc-2', nombre: 'Banco' });
    await view.rerender(
      <CalendarScreen
        account={other}
        api={api}
        initialMonth="2026-10"
        initialDay="2026-10-15"
        {...handlers}
      />,
    );
    expect(await screen.findByText('Calendario de Banco')).toBeTruthy();
    expect(api.getCalendar).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-2',
      month: '2026-10',
    });
    expect(api.listTransactions).toHaveBeenLastCalledWith(
      'tok',
      expect.objectContaining({ accountId: 'acc-2' }),
    );
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<CalendarMonth>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderCalendar(makeApi({ getCalendar: jest.fn(() => gate.promise) }));
    await view.unmount();
    await act(async () => gate.resolve(monthOf('acc-1', '2026-10', octoberDays)));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('CalendarScreen: R2 (cuenta archivada y margen inferior)', () => {
  it('canCreate=false deshabilita «Nuevo movimiento» del día', async () => {
    await render(
      <CalendarScreen
        account={acc}
        api={makeApi()}
        initialMonth="2026-10"
        initialDay="2026-10-15"
        canCreate={false}
        {...handlers}
      />,
    );
    const button = screen.getByRole('button', { name: 'Nuevo movimiento' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(handlers.onNewTransaction).not.toHaveBeenCalled();
  });

  it('por defecto «Nuevo movimiento» sigue habilitado', async () => {
    await renderCalendar();
    const button = screen.getByRole('button', { name: 'Nuevo movimiento' });
    expect(button.props.accessibilityState.disabled).toBe(false);
  });
});
