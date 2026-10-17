// R5.1 en el navegador: «+ Crear categoría» no abandona el formulario ni permite cambiar de cuenta
// (R51-18, R51-21, R51-24) y la ruta `categories` ya no tiene variante «desde el formulario».
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import { account, category, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import MainNavigator from './MainNavigator';
import { resolveBack, ROOT, type Route } from './navigation';

relaxTimeoutsForColdCache();

jest.mock('../lib/export-files', () => ({
  clearExports: jest.fn(),
  ExportFileError: class ExportFileError extends Error {},
}));
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
}));
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
let listeners: Handler[];
const back = async () => {
  let handled = false;
  await act(async () => {
    for (let i = listeners.length - 1; i >= 0 && !handled; i -= 1)
      handled = listeners[i]!() === true;
  });
  return handled;
};

const efectivo = account({ id: 'acc-1', nombre: 'Efectivo', saldo: 1250 });
const banco = account({ id: 'acc-2', nombre: 'Banco', saldo: 500 });
const makeApi = () =>
  fakeResourcesApi({
    listAccounts: jest.fn(async () => pageOf([efectivo, banco])),
    listCategories: jest.fn(async () => pageOf([category({ id: 'cat-1', nombre: 'Comida' })])),
  });

const openForm = async () => {
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Efectivo, saldo actual $12.50. Abrir cuenta' }),
  );
  await screen.findByLabelText('Secciones de la cuenta');
  await fireEvent.press(
    await screen.findByRole('button', { name: /Nuevo movimiento|Anotar|Agregar/ }),
  );
};

beforeEach(() => {
  mockWindow();
  listeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const h = handler as Handler;
    listeners.push(h);
    return { remove: () => (listeners = listeners.filter((item) => item !== h)) };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('MainNavigator: Nuevo movimiento con «+ Crear categoría»', () => {
  it('con el formulario abierto no hay selector de cuenta y la hoja no cambia la ruta', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openForm();
    expect(await screen.findByRole('header', { name: 'Nuevo movimiento' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Cambiar de cuenta/ })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Crear categoría' }));
    await screen.findByRole('header', { name: 'Nueva categoría' });
    expect(screen.queryByRole('button', { name: /Cambiar de cuenta/ })).toBeNull();
    expect(screen.getByRole('header', { name: 'Nuevo movimiento' })).toBeTruthy();
  });

  it('Atrás con la hoja abierta la cierra y no sale del formulario; el siguiente Atrás sí lo cierra', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openForm();
    await fireEvent.press(await screen.findByRole('button', { name: 'Crear categoría' }));
    await screen.findByRole('header', { name: 'Nueva categoría' });
    expect(await back()).toBe(true);
    expect(screen.queryByRole('header', { name: 'Nueva categoría' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Nuevo movimiento' })).toBeTruthy();
    expect(await back()).toBe(true);
    await screen.findByLabelText('Secciones de la cuenta');
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('navigation: la ruta categories es única', () => {
  it('Atrás desde Categorías vuelve a la pila anterior (sin variante fromForm)', () => {
    const route: Route = { name: 'categories' };
    expect(Object.keys(route)).toEqual(['name']);
    const next = resolveBack({
      stack: [...ROOT, { name: 'detail' }, route],
      detail: null,
    });
    expect(next?.stack.at(-1)).toEqual({ name: 'detail' });
  });
});
