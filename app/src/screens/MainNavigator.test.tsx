import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import MainNavigator from './MainNavigator';

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
});
