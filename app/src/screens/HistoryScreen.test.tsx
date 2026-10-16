import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { Page, ResourcesApi, Transaction } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { colors } from '../theme/tokens';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import HistoryScreen from './HistoryScreen';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

// Fecha local fija: «Hoy» y «Ayer» no deben depender del reloj del dispositivo.
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-15',
}));

const cats = [
  category({ id: 'c-food', nombre: 'Comida', tipo: 'egreso' }),
  category({ id: 'c-old', nombre: 'Antigua', tipo: 'egreso', archivada: true }),
  category({ id: 'c-pay', nombre: 'Sueldo', tipo: 'ingreso' }),
];

const txs = (from: number, to: number): Transaction[] =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    transaction({
      id: `tx-${from + i}`,
      categoryId: 'c-food',
      nota: `mov ${from + i}`,
      fecha: '2026-10-10',
    }),
  );

const pageResult = (items: Transaction[], page: number, total: number): Page<Transaction> => ({
  items,
  page,
  pageSize: 20,
  total,
});

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    listCategories: jest.fn(async () => pageOf(cats)),
    listTransactions: jest.fn(async () => pageResult(txs(1, 3), 1, 3)),
    ...overrides,
  });
}

const onOpen = jest.fn();
const renderScreen = (api = makeApi()) =>
  render(<HistoryScreen account={account()} api={api} onOpenTransaction={onOpen} />);

beforeEach(() => {
  mockWindow(360, 1);
});

afterEach(() => {
  onOpen.mockClear();
  jest.restoreAllMocks();
});

// Abre el panel plegable de filtros (cerrado por defecto desde R4).
const openFilters = async () => {
  await fireEvent.press(screen.getByRole('button', { name: /^Filtros/ }));
};

// Elige una fecha en el selector abierto (mes de hoy: octubre de 2026).
const pickDay = async (day: number) => {
  await fireEvent.press(
    screen.getByRole('button', { name: new RegExp(`^${day} de octubre de 2026`) }),
  );
};

describe('HistoryScreen: estados', () => {
  it('muestra carga, luego los movimientos con categoría y monto con signo', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    await renderScreen(makeApi({ listTransactions: jest.fn(() => gate.promise) }));
    expect(screen.getByTestId('history-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageResult([transaction({ nota: 'almuerzo' })], 1, 1)));
    expect(await screen.findByText('almuerzo')).toBeTruthy();
    expect(screen.getByText('-$15.00')).toBeTruthy();
    // R4: la fecha va en el encabezado del día (no en cada fila) y el título no lleva la cuenta.
    expect(screen.getByRole('header', { name: 'Ayer' })).toBeTruthy();
    expect(screen.queryByText('14/10/2026')).toBeNull();
    expect(screen.getByRole('header', { name: 'Movimientos' })).toBeTruthy();
    expect(screen.queryByText(/Historial de/)).toBeNull();
  });

  it('primera consulta: página 1 con page_size 20 y la cuenta', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    expect(api.listTransactions).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      page: 1,
      pageSize: 20,
    });
    expect(api.listCategories).toHaveBeenCalledWith('tok', 'acc-1', {
      incluirArchivadas: true,
      pageSize: 100,
    });
  });

  it('vacío sin filtros y vacío con filtros', async () => {
    const api = makeApi({ listTransactions: jest.fn(async () => pageResult([], 1, 0)) });
    await renderScreen(api);
    expect(
      await screen.findByText('Aún no hay movimientos. Cuando anotes el primero, aparecerá aquí.'),
    ).toBeTruthy();
    expect(screen.queryByText('Limpiar filtros')).toBeNull();
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('Ningún movimiento coincide con estos filtros.')).toBeTruthy();
  });

  it('error con Reintentar', async () => {
    const listTransactions = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(pageResult(txs(1, 1), 1, 1));
    await renderScreen(makeApi({ listTransactions }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('mov 1')).toBeTruthy();
    expect(listTransactions).toHaveBeenCalledTimes(2);
  });

  it('tocar un movimiento lo abre para edición', async () => {
    await renderScreen();
    await screen.findByText('mov 2');
    await fireEvent.press(screen.getAllByLabelText(/Editar movimiento de Comida/)[0]!);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' }));
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderScreen(makeApi({ listTransactions: jest.fn(() => gate.promise) }));
    await view.unmount();
    await act(async () => gate.resolve(pageResult(txs(1, 1), 1, 1)));
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('HistoryScreen: paginación', () => {
  it('«Cargar más» concatena, pide la página siguiente y se oculta al completar', async () => {
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 25))
      .mockResolvedValueOnce(pageResult(txs(21, 25), 2, 25));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    await fireEvent.press(screen.getByText('Cargar más'));
    expect(await screen.findByText('mov 25')).toBeTruthy();
    expect(screen.getByText('mov 1')).toBeTruthy();
    expect(listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      page: 2,
      pageSize: 20,
    });
    expect(screen.queryByText('Cargar más')).toBeNull();
  });

  it('no muestra «Cargar más» cuando ya están todos', async () => {
    await renderScreen();
    await screen.findByText('mov 3');
    expect(screen.queryByText('Cargar más')).toBeNull();
  });

  it('deduplica por id si la página siguiente repite filas', async () => {
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 22))
      .mockResolvedValueOnce(pageResult([...txs(20, 20), ...txs(21, 22)], 2, 22));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    await fireEvent.press(screen.getByText('Cargar más'));
    await screen.findByText('mov 22');
    expect(screen.getAllByText('mov 20')).toHaveLength(1);
    // 22 de 22: ya no hay más.
    expect(screen.queryByText('Cargar más')).toBeNull();
  });

  it('doble toque en «Cargar más» pide una sola página', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 40))
      .mockReturnValueOnce(gate.promise);
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    const more = screen.getByText('Cargar más');
    await fireEvent.press(more);
    await fireEvent.press(more);
    expect(listTransactions).toHaveBeenCalledTimes(2);
    // R4: mientras trabaja el botón dice «Cargando…» y queda bloqueado.
    expect(
      screen.getByRole('button', { name: 'Cargando…' }).props.accessibilityState.disabled,
    ).toBe(true);
    await act(async () => gate.resolve(pageResult(txs(21, 40), 2, 40)));
    expect(await screen.findByText('mov 40')).toBeTruthy();
  });

  it('un error al cargar más conserva la lista y permite reintentar', async () => {
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 30))
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageResult(txs(21, 30), 2, 30));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    await fireEvent.press(screen.getByText('Cargar más'));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    expect(screen.getByText('mov 1')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cargar más'));
    expect(await screen.findByText('mov 30')).toBeTruthy();
  });

  it('cambiar un filtro mientras se carga más descarta la respuesta vieja', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 40))
      .mockReturnValueOnce(gate.promise)
      .mockResolvedValueOnce(pageResult([transaction({ id: 'f-1', nota: 'filtrado' })], 1, 1));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    await fireEvent.press(screen.getByText('Cargar más'));
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('filtrado')).toBeTruthy();
    await act(async () => gate.resolve(pageResult(txs(21, 40), 2, 40)));
    expect(screen.queryByText('mov 40')).toBeNull();
    expect(screen.getByText('filtrado')).toBeTruthy();
    expect(screen.queryByText('Cargar más')).toBeNull();
  });
});

describe('HistoryScreen: filtros', () => {
  it('el tipo se envía a la API y reinicia a la página 1', async () => {
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(txs(1, 20), 1, 40))
      .mockResolvedValueOnce(pageResult(txs(21, 40), 2, 40))
      .mockResolvedValue(pageResult([transaction({ nota: 'solo gastos' })], 1, 1));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 20');
    await fireEvent.press(screen.getByText('Cargar más'));
    await screen.findByText('mov 40');

    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('solo gastos')).toBeTruthy();
    expect(screen.queryByText('mov 1')).toBeNull();
    expect(listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      page: 1,
      pageSize: 20,
      tipo: 'gasto',
    });
  });

  it('la categoría (incluidas archivadas) se envía como categoryId', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(await screen.findByLabelText('Filtrar por Antigua'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        categoryId: 'c-old',
      }),
    );
  });

  it('las categorías se filtran por tipo y se limpia una incompatible', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(await screen.findByLabelText('Filtrar por Comida'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingresos' }));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        tipo: 'ingreso',
      }),
    );
    expect(screen.queryByLabelText('Filtrar por Comida')).toBeNull();
    expect(screen.getByLabelText('Filtrar por Sueldo')).toBeTruthy();
  });

  it('el rango se elige con el selector y se envía como desde y hasta', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    expect(screen.queryByPlaceholderText(/AAAA-MM-DD/)).toBeNull();
    expect(screen.queryByText('Aplicar rango')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Desde: sin elegir' }));
    expect(screen.getByRole('header', { name: 'Elige una fecha' })).toBeTruthy();
    await pickDay(1);
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        desde: '2026-10-01',
      }),
    );
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hasta: sin elegir' }));
    await pickDay(31);
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        desde: '2026-10-01',
        hasta: '2026-10-31',
      }),
    );
    expect(screen.getByRole('button', { name: 'Desde: 01/10/2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hasta: 31/10/2026' })).toBeTruthy();
  });

  it('una fecha que invierte el rango no llama a la API, cierra la hoja y explica el motivo', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(screen.getByRole('button', { name: 'Hasta: sin elegir' }));
    await pickDay(1);
    await waitFor(() => expect(api.listTransactions).toHaveBeenCalledTimes(2));
    const calls = api.listTransactions.mock.calls.length;

    await fireEvent.press(screen.getByRole('button', { name: 'Desde: sin elegir' }));
    await pickDay(31);
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert.props.children).toBe('La fecha «Desde» no puede ser posterior a «Hasta».');
    expect(api.listTransactions.mock.calls.length).toBe(calls);
    // El botón conserva su valor anterior.
    expect(screen.getByRole('button', { name: 'Desde: sin elegir' })).toBeTruthy();

    // El mensaje se quita al elegir una fecha válida.
    await fireEvent.press(screen.getByRole('button', { name: 'Desde: sin elegir' }));
    await pickDay(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Limpiar filtros vuelve a la consulta sin filtros', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Desde: sin elegir' }));
    await pickDay(1);
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith(
        'tok',
        expect.objectContaining({ tipo: 'gasto', desde: '2026-10-01' }),
      ),
    );
    await fireEvent.press(screen.getByText('Limpiar filtros'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(screen.getByRole('button', { name: 'Desde: sin elegir' })).toBeTruthy();
    expect(screen.queryByTestId('active-filters')).toBeNull();
  });
});

describe('HistoryScreen: filtros iniciales', () => {
  const renderWith = async (
    initialFilters: Parameters<typeof HistoryScreen>[0]['initialFilters'],
  ) => {
    const api = makeApi();
    await render(
      <HistoryScreen
        account={account()}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={initialFilters}
      />,
    );
    return api;
  };

  it('consulta ya filtrada por categoría y rango, con un chip por filtro y el panel cerrado', async () => {
    const api = await renderWith({
      categoryId: 'c-food',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    await screen.findByText('mov 1');
    expect(api.listTransactions).toHaveBeenCalledTimes(1);
    expect(api.listTransactions).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      page: 1,
      pageSize: 20,
      categoryId: 'c-food',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    expect(screen.queryByTestId('filters-panel')).toBeNull();
    expect(await screen.findByLabelText('Quitar filtro: Comida')).toBeTruthy();
    expect(screen.getByLabelText('Quitar filtro: Desde 01/10/2026')).toBeTruthy();
    expect(screen.getByLabelText('Quitar filtro: Hasta 31/10/2026')).toBeTruthy();
    await openFilters();
    expect(screen.getByRole('button', { name: 'Desde: 01/10/2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hasta: 31/10/2026' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Filtrar por Comida' }).props.accessibilityState.selected,
    ).toBe(true);
  });

  it('filtra por tipo y Limpiar filtros los quita', async () => {
    const api = await renderWith({ tipo: 'gasto', desde: '2026-10-01', hasta: '2026-10-31' });
    await screen.findByText('mov 1');
    expect(api.listTransactions).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ tipo: 'gasto', desde: '2026-10-01' }),
    );
    await openFilters();
    expect(screen.getByRole('radio', { name: 'Gastos' }).props.accessibilityState.selected).toBe(
      true,
    );
    await fireEvent.press(screen.getByText('Limpiar filtros'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(screen.getByRole('button', { name: 'Desde: sin elegir' })).toBeTruthy();
  });

  it('sin initialFilters se comporta como antes (sin filtros)', async () => {
    const api = await renderWith(undefined);
    await screen.findByText('mov 1');
    expect(api.listTransactions).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      page: 1,
      pageSize: 20,
    });
  });
});

describe('HistoryScreen: R2 (filtros conservados por el contenedor)', () => {
  it('onFiltersChange recibe los filtros iniciales y cada cambio, solo con los activos', async () => {
    const onFiltersChange = jest.fn();
    await render(
      <HistoryScreen
        account={account()}
        api={makeApi()}
        onOpenTransaction={onOpen}
        initialFilters={{ categoryId: 'c-food' }}
        onFiltersChange={onFiltersChange}
      />,
    );
    await screen.findByText('mov 1');
    expect(onFiltersChange).toHaveBeenLastCalledWith({ categoryId: 'c-food' });
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenLastCalledWith({ tipo: 'gasto', categoryId: 'c-food' }),
    );
    await fireEvent.press(screen.getByText('Limpiar filtros'));
    await waitFor(() => expect(onFiltersChange).toHaveBeenLastCalledWith({}));
  });
});

describe('HistoryScreen: R4 (filtros plegables y chips activos)', () => {
  it('el panel está cerrado por defecto y «Filtros» anuncia su estado (criterio 3)', async () => {
    await renderScreen();
    await screen.findByText('mov 1');
    expect(screen.queryByTestId('filters-panel')).toBeNull();
    const button = screen.getByRole('button', { name: 'Filtros, ninguno activo' });
    expect(button.props.accessibilityState.expanded).toBe(false);
    expect(screen.getByText('Filtros')).toBeTruthy();
    expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(button);
    expect(screen.getByTestId('filters-panel')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Filtros, ninguno activo' }).props.accessibilityState
        .expanded,
    ).toBe(true);
  });

  it('«Filtros (N)» cuenta los grupos activos y no más de tres (criterio 3)', async () => {
    const api = makeApi();
    await render(
      <HistoryScreen
        account={account()}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={{
          tipo: 'gasto',
          categoryId: 'c-food',
          desde: '2026-10-01',
          hasta: '2026-10-31',
        }}
      />,
    );
    await screen.findByText('mov 1');
    expect(screen.getByText('Filtros (3)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filtros, 3 activos' })).toBeTruthy();
  });

  it('cada chip «Quitar filtro» quita solo su filtro y relee la página 1 (criterio 4)', async () => {
    const api = makeApi();
    await render(
      <HistoryScreen
        account={account()}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={{ tipo: 'gasto', categoryId: 'c-food', desde: '2026-10-01' }}
      />,
    );
    await screen.findByText('mov 1');
    const chips = screen.getByTestId('active-filters');
    expect(chips).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar filtro: Gastos' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtro: Gastos' }));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        categoryId: 'c-food',
        desde: '2026-10-01',
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtro: Desde 01/10/2026' }));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        categoryId: 'c-food',
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtro: Comida' }));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(screen.queryByTestId('active-filters')).toBeNull();
  });

  it('elegir un tipo limpia una categoría de otro tipo y «Todas» limpia la categoría (criterio 5)', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(await screen.findByLabelText('Filtrar por Comida'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith(
        'tok',
        expect.objectContaining({ categoryId: 'c-food' }),
      ),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Todas las categorías' }));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it('los chips de categoría marcan las archivadas y el panel no tiene campos de texto de fecha', async () => {
    await renderScreen();
    await screen.findByText('mov 1');
    await openFilters();
    expect(screen.getByText('Antigua (archivada)')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/AAAA-MM-DD/)).toBeNull();
    expect(screen.queryByLabelText('Desde')).toBeNull();
    // Chips sm de 36 dp con zona táctil ampliada (P-1).
    const chip = screen.getByRole('radio', { name: 'Filtrar por Comida' });
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(36);
    expect(chip.props.hitSlop).toEqual({ top: 6, bottom: 6 });
  });

  it('«Limpiar filtros» del estado vacío restablece y relee sin filtros (criterio 7)', async () => {
    const listTransactions = jest.fn().mockImplementation(async (_t, options) => ({
      items: options.tipo ? [] : txs(1, 1),
      page: 1,
      pageSize: 20,
      total: options.tipo ? 0 : 1,
    }));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('mov 1');
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('Ningún movimiento coincide con estos filtros.')).toBeTruthy();
    // Panel abierto y vacío: dos «Limpiar filtros»; se usa el del estado vacío (botón secundario).
    const clear = screen.getAllByRole('button', { name: 'Limpiar filtros' });
    expect(clear).toHaveLength(2);
    await fireEvent.press(clear[1]!);
    expect(await screen.findByText('mov 1')).toBeTruthy();
    expect(listTransactions).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      page: 1,
      pageSize: 20,
    });
  });
});

describe('HistoryScreen: R4 (agrupación, contador y filas)', () => {
  const headers = () =>
    screen
      .getAllByRole('header')
      .map((node) => node.props.children as string)
      .filter((text) => text !== 'Movimientos');

  it('agrupa por día en el orden recibido: Hoy, Ayer y fecha larga (criterio 8)', async () => {
    const items = [
      transaction({ id: 'a', fecha: '2026-10-15', nota: 'hoy 1' }),
      transaction({ id: 'b', fecha: '2026-10-15', nota: 'hoy 2' }),
      transaction({ id: 'c', fecha: '2026-10-14', nota: 'ayer 1' }),
      transaction({ id: 'd', fecha: '2026-10-10', nota: 'antes 1' }),
    ];
    await renderScreen(makeApi({ listTransactions: jest.fn(async () => pageResult(items, 1, 4)) }));
    await screen.findByText('hoy 1');
    expect(headers()).toEqual(['Hoy', 'Ayer', 'Sábado 10 de octubre']);
  });

  it('un día que continúa en la página 2 no repite su encabezado (criterio 8)', async () => {
    const first = [
      transaction({ id: 'a', fecha: '2026-10-15', nota: 'p1 a' }),
      transaction({ id: 'b', fecha: '2026-10-14', nota: 'p1 b' }),
    ];
    const second = [
      transaction({ id: 'c', fecha: '2026-10-14', nota: 'p2 c' }),
      transaction({ id: 'd', fecha: '2025-12-31', nota: 'p2 d' }),
    ];
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(pageResult(first, 1, 4))
      .mockResolvedValueOnce(pageResult(second, 2, 4));
    await renderScreen(makeApi({ listTransactions }));
    await screen.findByText('p1 b');
    await fireEvent.press(screen.getByText('Cargar más'));
    await screen.findByText('p2 d');
    expect(headers()).toEqual(['Hoy', 'Ayer', 'Miércoles 31 de diciembre de 2025']);
  });

  it('el contador usa el total de la API, singular y oculto al cargar o en error (criterio 10)', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockReturnValueOnce(gate.promise)
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValue(pageResult(txs(1, 20), 1, 25));
    await renderScreen(makeApi({ listTransactions }));
    expect(screen.queryByText(/movimientos?$/)).toBeNull();
    await act(async () => gate.resolve(pageResult(txs(1, 1), 1, 1)));
    expect(await screen.findByText('1 movimiento')).toBeTruthy();
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(screen.queryByText(/^\d+ movimientos?$/)).toBeNull();
    await fireEvent.press(screen.getByText('Reintentar'));
    // 20 cargados de 25 en la API: el contador no es la cantidad cargada.
    expect(await screen.findByText('25 movimientos')).toBeTruthy();
  });

  it('la fila muestra nombre completo, nota, importe con signo y etiqueta con tipo e importe (criterio 9)', async () => {
    const longName = 'Categoría de nombre muy largo para pruebas';
    const api = makeApi({
      listCategories: jest.fn(async () =>
        pageOf([
          category({ id: 'c-long', nombre: longName, tipo: 'egreso' }),
          category({ id: 'c-pay', nombre: 'Sueldo', tipo: 'ingreso' }),
        ]),
      ),
      listTransactions: jest.fn(async () =>
        pageResult(
          [
            transaction({ id: 'g', categoryId: 'c-long', monto: 650, nota: 'Almuerzo con Ana' }),
            transaction({ id: 'i', categoryId: 'c-pay', tipo: 'ingreso', monto: 80000 }),
          ],
          1,
          2,
        ),
      ),
    });
    await renderScreen(api);
    const name = await screen.findByText(longName);
    expect(name.props.numberOfLines).toBe(2);
    expect(name.props.ellipsizeMode).toBe('clip');
    const note = screen.getByText('Almuerzo con Ana');
    expect(note.props.numberOfLines).toBe(2);
    const expense = screen.getByText('-$6.50');
    const income = screen.getByText('+$800.00');
    expect(StyleSheet.flatten(expense.props.style).color).toBe(colors.expenseText);
    expect(StyleSheet.flatten(income.props.style).color).toBe(colors.incomeText);
    expect(StyleSheet.flatten(expense.props.style).flexShrink).toBe(0);
    // Sin fecha dentro del grupo.
    expect(screen.queryByText(/\d\d\/\d\d\/\d{4}/)).toBeNull();
    const row = screen.getByRole('button', {
      name: `Editar movimiento de ${longName} del 14/10/2026: gasto de $6.50, nota: Almuerzo con Ana`,
    });
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(56);
    expect(
      screen.getByRole('button', {
        name: 'Editar movimiento de Sueldo del 14/10/2026: ingreso de $800.00',
      }),
    ).toBeTruthy();
    await fireEvent.press(row);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'g' }));
  });
});

describe('HistoryScreen: R4 (estados y cuenta)', () => {
  it('muestra «Cargando movimientos…» mientras carga (criterio 11)', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    await renderScreen(makeApi({ listTransactions: jest.fn(() => gate.promise) }));
    expect(screen.getByText('Cargando movimientos…')).toBeTruthy();
    expect(screen.getByTestId('history-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageResult([], 1, 0)));
  });

  it('el error de carga usa ErrorBox con fondo expenseSoft y Reintentar (criterio 11)', async () => {
    await renderScreen(
      makeApi({ listTransactions: jest.fn().mockRejectedValue(new AuthError('server')) }),
    );
    const message = await screen.findByText(/El servidor no está disponible/);
    expect(message.props.accessibilityRole).toBe('alert');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    const box = message.parent!;
    expect(StyleSheet.flatten(box.props.style).backgroundColor).toBe(colors.expenseSoft);
  });

  it('una respuesta tardía de un filtro anterior no pisa la lista actual (criterio 12)', async () => {
    const slow = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(
        pageResult([transaction({ id: 'n', nota: 'del filtro nuevo' })], 1, 1),
      );
    await renderScreen(makeApi({ listTransactions }));
    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('del filtro nuevo')).toBeTruthy();
    await act(async () =>
      slow.resolve(pageResult([transaction({ id: 'o', nota: 'respuesta vieja' })], 1, 1)),
    );
    expect(screen.queryByText('respuesta vieja')).toBeNull();
    expect(screen.getByText('del filtro nuevo')).toBeTruthy();
  });

  it('cambiar account.id sin remontar no deja rastro de la cuenta anterior (criterio 13)', async () => {
    const second = controlledPromise<Page<Transaction>>();
    const listTransactions = jest
      .fn()
      .mockResolvedValueOnce(
        pageResult([transaction({ id: 'old', nota: 'de la cuenta uno' })], 1, 1),
      )
      .mockReturnValueOnce(second.promise);
    const api = makeApi({ listTransactions });
    const view = await render(
      <HistoryScreen
        account={account()}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={{ tipo: 'gasto' }}
      />,
    );
    await screen.findByText('de la cuenta uno');
    expect(screen.getByLabelText('Quitar filtro: Gastos')).toBeTruthy();

    await view.rerender(
      <HistoryScreen
        account={account({ id: 'acc-2', nombre: 'Banco' })}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={{ tipo: 'gasto' }}
      />,
    );
    expect(screen.queryByText('de la cuenta uno')).toBeNull();
    expect(screen.queryByText('1 movimiento')).toBeNull();
    expect(screen.getByText('Cargando movimientos…')).toBeTruthy();
    // Los filtros de la cuenta anterior también se descartan.
    expect(screen.queryByLabelText('Quitar filtro: Gastos')).toBeNull();
    await waitFor(() =>
      expect(listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-2',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(api.listCategories).toHaveBeenLastCalledWith('tok', 'acc-2', {
      incluirArchivadas: true,
      pageSize: 100,
    });
    await act(async () =>
      second.resolve(
        pageResult([transaction({ id: 'new', accountId: 'acc-2', nota: 'de Banco' })], 1, 1),
      ),
    );
    expect(await screen.findByText('de Banco')).toBeTruthy();
  });
});

describe('HistoryScreen: R4 (categorías sin cargar o con error, UXQA-R4-03)', () => {
  it('con categorías fallidas el chip dice «Categoría seleccionada» y el error se ve sin abrir el panel', async () => {
    const listCategories = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(pageOf(cats));
    const api = makeApi({ listCategories });
    await render(
      <HistoryScreen
        account={account()}
        api={api}
        onOpenTransaction={onOpen}
        initialFilters={{ categoryId: 'c-food' }}
      />,
    );
    await screen.findByText('mov 1');
    expect(await screen.findByLabelText('Quitar filtro: Categoría seleccionada')).toBeTruthy();
    expect(screen.queryByLabelText('Quitar filtro: Categoría')).toBeNull();
    expect(screen.queryByTestId('filters-panel')).toBeNull();
    expect(await screen.findByText(/No pudimos cargar los nombres de las categorías/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar categorías' }));
    // Tras el reintento aparece el nombre real y desaparece el aviso.
    expect(await screen.findByLabelText('Quitar filtro: Comida')).toBeTruthy();
    expect(screen.queryByText(/No pudimos cargar los nombres/)).toBeNull();
  });

  it('sin filtro de categoría el error de categorías no ocupa espacio fuera del panel', async () => {
    const api = makeApi({ listCategories: jest.fn().mockRejectedValue(new AuthError('network')) });
    await renderScreen(api);
    await screen.findByText('mov 1');
    expect(screen.queryByText(/No pudimos cargar los nombres/)).toBeNull();
  });
});

describe('R4 D6: margen lateral responsive (HistoryScreen)', () => {
  it.each([
    [360, 16],
    [412, 20],
  ])('a %s dp el contenedor usa %s dp de relleno', async (width, margin) => {
    mockWindow(width, 1);
    await renderScreen();
    await screen.findByText('mov 1');
    const root = screen.toJSON() as unknown as {
      props: { style: import('react-native').ViewStyle };
    };
    expect(StyleSheet.flatten(root.props.style).padding).toBe(margin);
  });
});
