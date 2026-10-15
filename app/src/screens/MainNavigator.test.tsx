import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { account, fakeResourcesApi } from '../resources-test-utils';
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
});
