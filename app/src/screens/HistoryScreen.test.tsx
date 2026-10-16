import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { Page, ResourcesApi, Transaction } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import HistoryScreen from './HistoryScreen';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
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

afterEach(() => {
  onOpen.mockClear();
  jest.restoreAllMocks();
});

describe('HistoryScreen: estados', () => {
  it('muestra carga, luego los movimientos con categoría y monto con signo', async () => {
    const gate = controlledPromise<Page<Transaction>>();
    await renderScreen(makeApi({ listTransactions: jest.fn(() => gate.promise) }));
    expect(screen.getByTestId('history-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageResult([transaction({ nota: 'almuerzo' })], 1, 1)));
    expect(await screen.findByText('almuerzo')).toBeTruthy();
    expect(screen.getByText('-$15.00')).toBeTruthy();
    expect(screen.getByText('14/10/2026')).toBeTruthy();
    expect(screen.getByText('Historial de Efectivo')).toBeTruthy();
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
    expect(await screen.findByText('Aún no hay movimientos en esta cuenta')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('No hay movimientos con estos filtros')).toBeTruthy();
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
    expect(
      screen.getByRole('button', { name: 'Cargar más' }).props.accessibilityState.disabled,
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

  it('el rango válido se envía como desde y hasta', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-10-01');
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-10-31');
    await fireEvent.press(screen.getByText('Aplicar rango'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
        desde: '2026-10-01',
        hasta: '2026-10-31',
      }),
    );
  });

  it('rango inválido o desde > hasta se rechaza en el cliente', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    const calls = api.listTransactions.mock.calls.length;

    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-02-30');
    await fireEvent.press(screen.getByText('Aplicar rango'));
    expect(await screen.findByText(/fechas válidas/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-10-31');
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-10-01');
    await fireEvent.press(screen.getByText('Aplicar rango'));
    expect(await screen.findByText(/no puede ser posterior/)).toBeTruthy();
    expect(api.listTransactions.mock.calls.length).toBe(calls);
  });

  it('Limpiar filtros vuelve a la consulta sin filtros', async () => {
    const api = makeApi();
    await renderScreen(api);
    await screen.findByText('mov 1');
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-10-01');
    await fireEvent.press(screen.getByText('Limpiar filtros'));
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(screen.getByLabelText('Desde').props.value).toBe('');
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

  it('consulta ya filtrada por categoría y rango, y rellena los campos de fecha', async () => {
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
    expect(screen.getByLabelText('Desde').props.value).toBe('2026-10-01');
    expect(screen.getByLabelText('Hasta').props.value).toBe('2026-10-31');
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
    expect(screen.getByLabelText('Desde').props.value).toBe('');
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
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenLastCalledWith({ tipo: 'gasto', categoryId: 'c-food' }),
    );
    await fireEvent.press(screen.getByText('Limpiar filtros'));
    await waitFor(() => expect(onFiltersChange).toHaveBeenLastCalledWith({}));
  });
});
