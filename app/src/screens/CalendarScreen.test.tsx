import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { CalendarMonth, Page, ResourcesApi, Transaction } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { moduleColors, colors } from '../theme/tokens';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import CalendarScreen from './CalendarScreen';

relaxTimeoutsForColdCache();

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

beforeEach(() => {
  mockWindow(360, 1);
});

afterEach(() => jest.clearAllMocks());

describe('CalendarScreen', () => {
  it('carga el mes de la cuenta y muestra totales e indicadores diarios', async () => {
    const api = makeApi();
    await renderCalendar(api);
    // R4: el resumen del mes son tres SummaryTile con una sola etiqueta accesible.
    const summary = await screen.findByTestId('month-summary');
    expect(summary.props.accessibilityLabel).toBe(
      'Resumen de octubre: ingresos $1200.00, gastos $60.50, neto $1139.50',
    );
    expect(screen.getByText('+$1200.00')).toBeTruthy();
    expect(screen.getByText('-$60.50')).toBeTruthy();
    expect(screen.getByText('$1139.50')).toBeTruthy();
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
    const summary = await screen.findByTestId('month-summary');
    expect(summary.props.accessibilityLabel).toBe(
      'Resumen de octubre: ingresos no disponible, gastos $3.00, neto no disponible',
    );
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('-$3.00')).toBeTruthy();
  });

  it('las cabeceras empiezan en lunes y octubre 2026 empieza en jueves', async () => {
    await renderCalendar();
    await screen.findByTestId('month-summary');
    expect(
      screen.getAllByLabelText(/^(lunes|domingo)$/).map((n) => n.props.accessibilityLabel),
    ).toEqual(['lunes', 'domingo']);
    expect(screen.getByTestId('calendar-cell-2026-10-31')).toBeTruthy();
    expect(screen.queryByTestId('calendar-cell-2026-10-32')).toBeNull();
  });

  it('cambia de mes, notifica la vista y elige el día 1 si hoy no está en el mes', async () => {
    const api = makeApi();
    await renderCalendar(api);
    await screen.findByTestId('month-summary');
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy();
    expect(handlers.onViewChange).toHaveBeenLastCalledWith('2026-11', '2026-11-01');
    expect(api.getCalendar).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      month: '2026-11',
    });
    expect(await screen.findByText('No hay movimientos en este mes.')).toBeTruthy();
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
      await screen.findByText('Ingresos +$1200.00 · Gastos -$45.50 · Neto $1154.50'),
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
    expect(await screen.findByText('Este día no tiene movimientos registrados.')).toBeTruthy();
    // R4: un solo texto de día vacío (se eliminó «Sin movimientos este día»).
    expect(screen.queryByText('Sin movimientos este día')).toBeNull();
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
    expect(await screen.findByTestId('month-summary')).toBeTruthy();
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

  it('«+ Anotar en este día» recibe el día seleccionado y tocar un movimiento lo abre', async () => {
    await renderCalendar();
    await screen.findByText('almuerzo');
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    await fireEvent.press(screen.getByText('+ Anotar en este día'));
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
    await screen.findByTestId('month-summary');
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
    expect(await screen.findByText('No hay movimientos en este mes.')).toBeTruthy();
    await act(async () => slow.resolve(monthOf('acc-1', '2026-10', octoberDays)));
    expect(screen.getByText('No hay movimientos en este mes.')).toBeTruthy();
    expect(screen.queryByTestId('month-summary')).toBeNull();
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
    await screen.findByText('almuerzo');
    expect(screen.queryByText(/Calendario de/)).toBeNull();
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
  it('canCreate=false deshabilita «+ Anotar en este día»', async () => {
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
    const button = screen.getByRole('button', { name: 'Nuevo movimiento el 15 de octubre' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(handlers.onNewTransaction).not.toHaveBeenCalled();
  });

  it('por defecto «+ Anotar en este día» sigue habilitado', async () => {
    await renderCalendar();
    const button = screen.getByRole('button', { name: 'Nuevo movimiento el 15 de octubre' });
    expect(button.props.accessibilityState.disabled).toBe(false);
  });
});

describe('CalendarScreen: R4 (título, cuadrícula P-3 y estados de celda)', () => {
  const cell = (key: string) =>
    StyleSheet.flatten(screen.getByTestId(`calendar-cell-${key}`).props.style);

  it('el título es un encabezado «Calendario» sin el nombre de la cuenta (criterio 1)', async () => {
    await renderCalendar();
    await screen.findByTestId('month-summary');
    expect(screen.getByRole('header', { name: 'Calendario' })).toBeTruthy();
    expect(screen.queryByText(/Calendario de/)).toBeNull();
    expect(screen.queryByText('Efectivo')).toBeNull();
  });

  it('celdas de 52 dp y ancho por pantalla: ≥ 44 dp a 360 y ≥ 48 dp a 412 (criterio 15)', async () => {
    await renderCalendar();
    await screen.findByTestId('month-summary');
    const narrow = cell('2026-10-14');
    expect(narrow.height).toBe(52);
    expect(narrow.width).toBeCloseTo(44.3, 1);
    expect(narrow.borderWidth).toBe(2);
    mockWindow(412, 1);
    await renderCalendar();
    const wide = StyleSheet.flatten(screen.getByTestId('calendar-cell-2026-10-14').props.style);
    expect(wide.width).toBeGreaterThanOrEqual(48);
    expect(wide.height).toBe(52);
  });

  it('siete columnas con 3 dp de separación y lunes primero (criterio 16)', async () => {
    await renderCalendar();
    await screen.findByTestId('month-summary');
    const row = screen.getByTestId('calendar-cell-2026-10-14').parent!;
    const rowStyle = StyleSheet.flatten(row.props.style);
    expect(rowStyle.gap).toBe(3);
    expect(row.parent && StyleSheet.flatten(row.parent.props.style).gap).toBe(3);
    // Octubre de 2026 empieza en jueves: la primera semana tiene 3 huecos y 4 días.
    expect(screen.getByTestId('calendar-cell-2026-10-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-cell-2026-10-04')).toBeTruthy();
  });

  it('estados: reposo, hoy, elegida y hoy+elegida usan calStrong/calTile (criterio 16)', async () => {
    await renderCalendar(makeApi(), { day: '2026-10-14' });
    await screen.findByTestId('month-summary');
    const strong = moduleColors.calendario.strong;
    const tile = moduleColors.calendario.tile;
    // Reposo (sin movimientos): borde 2 border, fondo surface.
    expect(cell('2026-10-13')).toMatchObject({
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderWidth: 2,
    });
    // Hoy (15) sin elegir: borde calStrong.
    expect(cell('2026-10-15')).toMatchObject({
      borderColor: strong,
      backgroundColor: colors.surface,
      borderWidth: 2,
    });
    // Elegida (14): fondo calStrong, borde 2.
    expect(cell('2026-10-14')).toMatchObject({
      borderColor: strong,
      backgroundColor: strong,
      borderWidth: 2,
    });
    // Con movimientos y sin elegir no cambia el fondo de la celda.
    // Hoy + elegida: fondo calStrong y anillo calTile.
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-15'));
    expect(cell('2026-10-15')).toMatchObject({
      borderColor: tile,
      backgroundColor: strong,
      borderWidth: 2,
    });
    expect(cell('2026-10-14')).toMatchObject({
      borderColor: colors.border,
      backgroundColor: colors.surface,
    });
  });

  it('las cifras de la celda llevan signo, 10 sp y color de importe; la elegida las pone en blanco (criterio 16)', async () => {
    await renderCalendar(makeApi(), { day: '2026-10-14' });
    await screen.findByTestId('month-summary');
    const income = StyleSheet.flatten(screen.getByText('+1.2k').props.style);
    expect(income).toMatchObject({ fontSize: 10 });
    // 14 está elegida: cifras en blanco con su signo.
    expect(income.color).toBe(colors.white);
    expect(StyleSheet.flatten(screen.getByText('−45').props.style).color).toBe(colors.white);
    // 15 (no elegida): gastos en expenseText.
    expect(StyleSheet.flatten(screen.getByText('−15').props.style).color).toBe(colors.expenseText);
    expect(screen.getByText('−15').props.allowFontScaling).toBe(false);
  });

  it('hoy lleva «, hoy» y solo una celda está seleccionada (criterio 16)', async () => {
    await renderCalendar();
    await screen.findByTestId('month-summary');
    expect(screen.getByTestId('calendar-cell-2026-10-15').props.accessibilityLabel).toBe(
      '15 de octubre: ingresos $0.00, gastos $15.00, 1 movimiento, hoy',
    );
    const selected = screen
      .getAllByTestId(/^calendar-cell-/)
      .filter((node) => node.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    const after = screen
      .getAllByTestId(/^calendar-cell-/)
      .filter((node) => node.props.accessibilityState?.selected);
    expect(after.map((n) => n.props.testID)).toEqual(['calendar-cell-2026-10-14']);
  });
});

describe('CalendarScreen: R4 (mes, resumen y día)', () => {
  it('las flechas de mes anuncian el título, tienen 48 dp y respetan los límites (criterio 17)', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    await renderCalendar();
    await screen.findByTestId('month-summary');
    const prev = screen.getByRole('button', { name: 'Mes anterior' });
    expect(StyleSheet.flatten(prev.props.style)).toMatchObject({ width: 48, height: 48 });
    await fireEvent.press(prev);
    expect(announce).toHaveBeenLastCalledWith('Septiembre 2026');
    expect(handlers.onViewChange).toHaveBeenLastCalledWith('2026-09', '2026-09-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(announce).toHaveBeenLastCalledWith('Octubre 2026');
    expect(announce).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('header', { name: 'Octubre 2026' })).toBeTruthy();
    announce.mockRestore();
  });

  it('elegir un día no anuncia nada adicional y no mueve el foco (criterio 18)', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    await renderCalendar();
    await screen.findByTestId('month-summary');
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    expect(announce).not.toHaveBeenCalled();
    announce.mockRestore();
  });

  it('el resumen es un solo elemento accesible con tres SummaryTile en 2+1 (criterio 19)', async () => {
    await renderCalendar();
    const summary = await screen.findByTestId('month-summary');
    expect(summary.props.accessible).toBe(true);
    expect(screen.getByText('Resumen de octubre')).toBeTruthy();
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByText('Gastos')).toBeTruthy();
    expect(screen.getByText('Neto')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('+$1200.00').props.style).color).toBe(colors.income);
    expect(StyleSheet.flatten(screen.getByText('-$60.50').props.style).color).toBe(colors.expense);
  });

  it('un mes vacío muestra «No hay movimientos en este mes.» en lugar de las tarjetas (criterio 19)', async () => {
    await renderCalendar(makeApi(), { month: '2026-09', day: '2026-09-01' });
    expect(await screen.findByText('No hay movimientos en este mes.')).toBeTruthy();
    expect(screen.queryByTestId('month-summary')).toBeNull();
  });

  it('día con movimientos: línea de totales con signo; sin movimientos solo el texto de vacío (criterio 20)', async () => {
    const api = makeApi({
      listTransactions: jest.fn(async (_t, options) => ({
        items: options?.desde === '2026-10-14' ? [transaction({ id: 'a', nota: 'uno' })] : [],
        page: 1,
        pageSize: 20,
        total: options?.desde === '2026-10-14' ? 1 : 0,
      })),
    });
    await renderCalendar(api);
    await screen.findByText('Este día no tiene movimientos registrados.');
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-14'));
    expect(
      await screen.findByText('Ingresos +$1200.00 · Gastos -$45.50 · Neto $1154.50'),
    ).toBeTruthy();
    expect(screen.queryByText('Este día no tiene movimientos registrados.')).toBeNull();
    await fireEvent.press(screen.getByTestId('calendar-cell-2026-10-13'));
    expect(await screen.findByText('Este día no tiene movimientos registrados.')).toBeTruthy();
    expect(screen.queryByText(/^Ingresos \+/)).toBeNull();
    expect(screen.getByRole('header', { name: '13 de octubre' })).toBeTruthy();
  });

  it('«+ Anotar en este día» es secundario, no comparte etiqueta con el FAB y mide 48 dp (criterio 21)', async () => {
    await renderCalendar();
    await screen.findByText('almuerzo');
    const button = screen.getByRole('button', { name: 'Nuevo movimiento el 15 de octubre' });
    expect(screen.queryByRole('button', { name: 'Nuevo movimiento' })).toBeNull();
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      minHeight: 48,
      backgroundColor: colors.surface,
      borderColor: colors.brand700,
    });
    await fireEvent.press(button);
    expect(handlers.onNewTransaction).toHaveBeenCalledWith('2026-10-15');
  });

  it('con la cuenta archivada el botón del día no llama a onNewTransaction (criterio 21)', async () => {
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
    const button = screen.getByRole('button', { name: 'Nuevo movimiento el 15 de octubre' });
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('el error del mes y el del día son independientes y cada uno tiene su reintento (criterio 22)', async () => {
    const getCalendar = jest.fn().mockRejectedValue(new AuthError('server'));
    const listTransactions = jest.fn().mockRejectedValue(new AuthError('network'));
    await renderCalendar(makeApi({ getCalendar, listTransactions }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(screen.getByLabelText('Reintentar calendario')).toBeTruthy();
    expect(screen.getByLabelText('Reintentar movimientos del día')).toBeTruthy();
    // La cuadrícula sigue disponible aunque falle el mes.
    expect(screen.getByTestId('calendar-cell-2026-10-14')).toBeTruthy();
  });

  it('«Cargar más» del día dice «Cargando…» y bloquea el doble toque (criterio 22)', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({
        items: [transaction({ id: 'a', nota: 'uno' })],
        page: 1,
        pageSize: 20,
        total: 2,
      })
      .mockReturnValueOnce(gate.promise);
    await renderCalendar(makeApi({ listTransactions }));
    await screen.findByText('uno');
    const more = screen.getByText('Cargar más');
    await fireEvent.press(more);
    await fireEvent.press(more);
    expect(listTransactions).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('button', { name: 'Cargando…' }).props.accessibilityState.disabled,
    ).toBe(true);
    await act(async () =>
      gate.resolve({
        items: [transaction({ id: 'b', nota: 'dos' })],
        page: 2,
        pageSize: 20,
        total: 2,
      }),
    );
    expect(await screen.findByText('dos')).toBeTruthy();
  });

  it('cambiar de cuenta sin remontar no muestra datos de la anterior y vuelve a cargar (criterio B.7)', async () => {
    const monthGate = controlledPromise<CalendarMonth>();
    const dayGate = controlledPromise<Page<Transaction>>();
    const getCalendar = jest
      .fn()
      .mockResolvedValueOnce(monthOf('acc-1', '2026-10', octoberDays))
      .mockReturnValueOnce(monthGate.promise);
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce({
        items: [transaction({ id: 'old', nota: 'de la cuenta uno' })],
        page: 1,
        pageSize: 20,
        total: 1,
      })
      .mockReturnValueOnce(dayGate.promise);
    const api = makeApi({ getCalendar, listTransactions });
    const view = await renderCalendar(api);
    await screen.findByText('de la cuenta uno');
    await view.rerender(
      <CalendarScreen
        account={account({ id: 'acc-2', nombre: 'Banco' })}
        api={api}
        initialMonth="2026-10"
        initialDay="2026-10-15"
        {...handlers}
      />,
    );
    expect(screen.queryByText('de la cuenta uno')).toBeNull();
    expect(screen.queryByTestId('month-summary')).toBeNull();
    expect(screen.getByTestId('calendar-loading')).toBeTruthy();
    expect(screen.getByTestId('day-loading')).toBeTruthy();
    expect(getCalendar).toHaveBeenLastCalledWith('tok', { accountId: 'acc-2', month: '2026-10' });
  });
});

describe('R4 D6: margen lateral responsive (CalendarScreen)', () => {
  it.each([
    [360, 16],
    [412, 20],
  ])('a %s dp el contenedor usa %s dp de relleno', async (width, margin) => {
    mockWindow(width, 1);
    await renderCalendar();
    await screen.findByTestId('month-summary');
    const root = screen.toJSON() as unknown as {
      props: { style: import('react-native').ViewStyle };
    };
    expect(StyleSheet.flatten(root.props.style).padding).toBe(margin);
  });
});
