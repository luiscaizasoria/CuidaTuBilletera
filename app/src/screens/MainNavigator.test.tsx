import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { clearExports } from '../lib/export-files';
import MainNavigator from './MainNavigator';

jest.mock('../lib/export-files', () => ({ clearExports: jest.fn() }));

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana' },
    busy: false,
    degraded: false,
    unavailableCause: null,
    error: null,
    signOut: jest.fn(),
    restore: jest.fn(),
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

type Handler = () => boolean | null | undefined;
let handlers: Handler[];
let removed: number;

beforeEach(() => {
  handlers = [];
  removed = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler as Handler);
    return { remove: () => (removed += 1) };
  });
});
afterEach(() => jest.restoreAllMocks());

const pressBack = () => handlers[handlers.length - 1]!();

describe('MainNavigator', () => {
  it('al desmontarse (cierre de sesión o cambio de usuario) limpia los archivos exportados', async () => {
    const view = await render(<MainNavigator api={fakeResourcesApi()} />);
    (clearExports as jest.Mock).mockClear();
    await view.unmount();
    expect(clearExports).toHaveBeenCalledTimes(1);
  });

  it('Inicio -> Cuentas -> Categorías y atrás regresa paso a paso', async () => {
    await render(<MainNavigator api={fakeResourcesApi()} />);
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cuentas'));
    expect(await screen.findByText('Efectivo')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Abrir Efectivo'));
    expect(await screen.findByText('Categorías de Efectivo')).toBeTruthy();

    let handled = false;
    await act(async () => {
      handled = pressBack() === true;
    });
    expect(handled).toBe(true);
    expect(await screen.findByText('Saldo inicial $12.50')).toBeTruthy();

    await act(async () => {
      handled = pressBack() === true;
    });
    expect(handled).toBe(true);
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
  });

  it('en Inicio el botón atrás no se intercepta (cierra la app)', async () => {
    await render(<MainNavigator api={fakeResourcesApi()} />);
    expect(pressBack()).toBe(false);
  });

  it('al desmontar retira el listener de BackHandler', async () => {
    const view = await render(<MainNavigator api={fakeResourcesApi()} />);
    const before = removed;
    await view.unmount();
    expect(removed).toBeGreaterThan(before);
  });

  it('carga las categorías de la cuenta elegida', async () => {
    const api = fakeResourcesApi({
      listAccounts: jest.fn(async () => ({
        items: [account({ id: 'acc-9', nombre: 'Banco' })],
        page: 1,
        pageSize: 100,
        total: 1,
      })),
    });
    await render(<MainNavigator api={api} />);
    await fireEvent.press(screen.getByText('Cuentas'));
    await fireEvent.press(await screen.findByLabelText('Abrir Banco'));
    await screen.findByText('Categorías de Banco');
    expect(api.listCategories).toHaveBeenCalledWith('tok', 'acc-9', expect.any(Object));
  });

  describe('movimientos', () => {
    const twoAccounts = [
      account({ id: 'acc-1', nombre: 'Efectivo' }),
      account({ id: 'acc-2', nombre: 'Banco', saldo: 500 }),
    ];
    const apiWithTx = () =>
      fakeResourcesApi({
        listAccounts: jest.fn(async () => pageOf(twoAccounts)),
        listCategories: jest.fn(async () => pageOf([category({ id: 'cat-1', nombre: 'Comida' })])),
        listTransactions: jest.fn(async (_t, options) => ({
          items: [transaction({ id: 'tx-1', accountId: options.accountId, nota: 'almuerzo' })],
          page: 1,
          pageSize: 10,
          total: 1,
        })),
      });
    const back = async () => {
      await act(async () => {
        pressBack();
      });
    };

    it('Inicio -> Nuevo movimiento y atrás vuelve a Inicio recargando', async () => {
      const api = apiWithTx();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Nuevo movimiento'));
      expect(await screen.findByLabelText('Monto')).toBeTruthy();
      await back();
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
      expect(api.listAccounts).toHaveBeenCalledTimes(2);
    });

    it('guardar en el formulario vuelve a Inicio y recarga los movimientos', async () => {
      const api = apiWithTx();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Nuevo movimiento'));
      await fireEvent.changeText(screen.getByLabelText('Monto'), '5');
      await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
      const before = (api.listTransactions as jest.Mock).mock.calls.length;
      await fireEvent.press(screen.getByText('Guardar'));
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
      expect(api.createTransaction).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect((api.listTransactions as jest.Mock).mock.calls.length).toBeGreaterThan(before),
      );
    });

    it('la cuenta elegida se conserva al ir a una pantalla y volver', async () => {
      const api = apiWithTx();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Cuenta Banco' }));
      expect(await screen.findByText('Saldo de Banco')).toBeTruthy();
      await fireEvent.press(screen.getByText('Ver historial'));
      expect(await screen.findByText('Historial de Banco')).toBeTruthy();
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-2',
        page: 1,
        pageSize: 20,
      });
      await back();
      expect(await screen.findByText('Saldo de Banco')).toBeTruthy();
    });

    it('Historial -> editar movimiento -> atrás -> atrás, paso a paso', async () => {
      const api = apiWithTx();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Ver historial'));
      await screen.findByText('Historial de Efectivo');
      const historyCalls = (api.listTransactions as jest.Mock).mock.calls.length;
      await fireEvent.press((await screen.findAllByLabelText(/Editar movimiento de Comida/))[0]!);
      expect(await screen.findByText('Editar movimiento')).toBeTruthy();
      expect(screen.getByText('Anular movimiento')).toBeTruthy();

      await back();
      expect(await screen.findByText('Historial de Efectivo')).toBeTruthy();
      // Al volver se recarga desde la página 1.
      await waitFor(() =>
        expect((api.listTransactions as jest.Mock).mock.calls.length).toBeGreaterThan(historyCalls),
      );
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      });

      await back();
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
      expect(pressBack()).toBe(false);
    });

    it('editar desde un reciente en Inicio abre el formulario de edición', async () => {
      await render(<MainNavigator api={apiWithTx()} />);
      await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
      expect(await screen.findByText('Editar movimiento')).toBeTruthy();
      expect(screen.getByLabelText('Nota').props.value).toBe('almuerzo');
    });

    it('anular desde la edición vuelve a la pantalla anterior', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.text === 'Anular')?.onPress?.();
      });
      const api = apiWithTx();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
      await fireEvent.press(await screen.findByText('Anular movimiento'));
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
      expect(api.deleteTransaction).toHaveBeenCalledWith('tok', 'tx-1');
    });
  });
  describe('calendario', () => {
    const twoAccounts = [
      account({ id: 'acc-1', nombre: 'Efectivo' }),
      account({ id: 'acc-2', nombre: 'Banco', saldo: 500 }),
    ];
    const apiWithCalendar = (accounts = twoAccounts) =>
      fakeResourcesApi({
        listAccounts: jest.fn(async () => pageOf(accounts)),
        getCalendar: jest.fn(async (_t, { accountId, month }) => ({
          accountId,
          month,
          days: [],
        })),
      });
    const back = async () => {
      await act(async () => {
        pressBack();
      });
    };

    it('abre el calendario desde Inicio con la cuenta mostrada', async () => {
      const api = apiWithCalendar();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Ver calendario'));
      expect(await screen.findByText('Calendario de Efectivo')).toBeTruthy();
      await waitFor(() =>
        expect(api.getCalendar).toHaveBeenCalledWith('tok', {
          accountId: 'acc-1',
          month: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      );
    });

    it('conserva la cuenta seleccionada al abrir el calendario', async () => {
      const api = apiWithCalendar();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Cuenta Banco' }));
      await screen.findByText('Saldo de Banco');
      await fireEvent.press(screen.getByText('Ver calendario'));
      expect(await screen.findByText('Calendario de Banco')).toBeTruthy();
      await waitFor(() => expect(api.getCalendar).toHaveBeenCalled());
      for (const call of api.getCalendar.mock.calls) expect(call[1].accountId).toBe('acc-2');
    });

    it('el botón Atrás de Android vuelve del calendario a Inicio', async () => {
      await render(<MainNavigator api={apiWithCalendar()} />);
      await fireEvent.press(await screen.findByText('Ver calendario'));
      await screen.findByText('Calendario de Efectivo');
      let handled = false;
      await act(async () => {
        handled = pressBack() === true;
      });
      expect(handled).toBe(true);
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
      expect(screen.queryByText('Calendario de Efectivo')).toBeNull();
      expect(pressBack()).toBe(false);
    });

    it('tras desmontar y remontar con otro usuario no queda rastro de la sesión anterior', async () => {
      const first = await render(<MainNavigator api={apiWithCalendar()} />);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Cuenta Banco' }));
      await fireEvent.press(await screen.findByText('Ver calendario'));
      await screen.findByText('Calendario de Banco');
      await first.unmount();

      const otherApi = apiWithCalendar([account({ id: 'acc-7', nombre: 'Ahorros' })]);
      await render(<MainNavigator api={otherApi} />);
      expect(await screen.findByText('Saldo de Ahorros')).toBeTruthy();
      expect(screen.queryByText(/Calendario de/)).toBeNull();
      expect(screen.queryByText(/Banco|Efectivo/)).toBeNull();
      expect(otherApi.getCalendar).not.toHaveBeenCalled();
      // La pila vuelve a Inicio: Atrás no se intercepta.
      expect(pressBack()).toBe(false);
      await back();
    });
  });

  describe('reportes', () => {
    const twoAccounts = [
      account({ id: 'acc-1', nombre: 'Efectivo' }),
      account({ id: 'acc-2', nombre: 'Banco', saldo: 500 }),
    ];
    const cats = (o: { accountId: string; desde: string; hasta: string }) => ({
      ...o,
      ingresos: { total: 0, items: [] },
      gastos: {
        total: 1500,
        items: [
          {
            categoryId: 'cat-1',
            nombre: 'Comida',
            icono: 'tag',
            color: '#E53935',
            archivada: false,
            total: 1500,
            cantidad: 1,
          },
        ],
      },
    });
    const apiWithReports = (accounts = twoAccounts) =>
      fakeResourcesApi({
        listAccounts: jest.fn(async () => pageOf(accounts)),
        getReportSummary: jest.fn(async (_t, o) => ({
          ...o,
          ingresos: 0,
          gastos: 1500,
          balance: -1500,
          cantidad: 1,
        })),
        getReportByCategory: jest.fn(async (_t, o) => cats(o)),
      });
    const back = async () => {
      await act(async () => {
        pressBack();
      });
    };

    it('abre Reportes desde Inicio con la cuenta elegida', async () => {
      const api = apiWithReports();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Cuenta Banco' }));
      await fireEvent.press(await screen.findByText('Reportes'));
      expect(await screen.findByText('Reportes de Banco')).toBeTruthy();
      await waitFor(() => expect(api.getReportSummary).toHaveBeenCalled());
      for (const call of api.getReportSummary.mock.calls) expect(call[1].accountId).toBe('acc-2');
    });

    it('tocar una categoría abre el Historial filtrado y Atrás conserva el modo y el período', async () => {
      const api = apiWithReports();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Reportes'));
      await fireEvent.press(await screen.findByRole('radio', { name: 'Modo Año' }));
      await fireEvent.press(await screen.findByLabelText('Año anterior'));
      await fireEvent.press(await screen.findByTestId('report-category-cat-1'));
      expect(await screen.findByText('Historial de Efectivo')).toBeTruthy();
      await waitFor(() =>
        expect(api.listTransactions).toHaveBeenCalledWith(
          'tok',
          expect.objectContaining({
            accountId: 'acc-1',
            categoryId: 'cat-1',
            desde: expect.stringMatching(/^\d{4}-01-01$/),
            hasta: expect.stringMatching(/^\d{4}-12-31$/),
          }),
        ),
      );
      await back();
      expect(await screen.findByText('Reportes de Efectivo')).toBeTruthy();
      expect(
        screen.getByRole('radio', { name: 'Modo Año' }).props.accessibilityState.selected,
      ).toBe(true);
      const expectedYear = String(new Date().getFullYear() - 1);
      expect(screen.getByText(expectedYear)).toBeTruthy();
      await back();
      expect(await screen.findByText('Saldo de Efectivo')).toBeTruthy();
    });

    it('el Historial abierto desde Inicio no trae filtros', async () => {
      const api = apiWithReports();
      await render(<MainNavigator api={api} />);
      await fireEvent.press(await screen.findByText('Ver historial'));
      await screen.findByText('Historial de Efectivo');
      await waitFor(() => expect(api.listTransactions).toHaveBeenCalled());
      expect(api.listTransactions).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        page: 1,
        pageSize: 20,
      });
    });

    it('tras desmontar y remontar con otro usuario no queda rastro de Reportes', async () => {
      const first = await render(<MainNavigator api={apiWithReports()} />);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Cuenta Banco' }));
      await fireEvent.press(await screen.findByText('Reportes'));
      await screen.findByText('Reportes de Banco');
      await screen.findByText('Comida');
      await first.unmount();

      const otherApi = apiWithReports([account({ id: 'acc-7', nombre: 'Ahorros' })]);
      await render(<MainNavigator api={otherApi} />);
      expect(await screen.findByText('Saldo de Ahorros')).toBeTruthy();
      expect(screen.queryByText(/Reportes de/)).toBeNull();
      expect(screen.queryByText('Comida')).toBeNull();
      expect(otherApi.getReportSummary).not.toHaveBeenCalled();
      expect(pressBack()).toBe(false);
      await back();
    });
  });
});
