// Crear cuenta (R2). Incluye los casos de creación que antes estaban en AccountsScreen.test.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { ApiRequestError } from '../lib/resources-api';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import NewAccountScreen, { BALANCE_ERROR } from './NewAccountScreen';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const onBack = jest.fn();
const onCreated = jest.fn();
const renderScreen = (api = fakeResourcesApi()) =>
  render(<NewAccountScreen api={api} onBack={onBack} onCreated={onCreated} />);
const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

beforeEach(() => {
  onBack.mockClear();
  onCreated.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('NewAccountScreen', () => {
  it('estructura: Volver, título, campos con etiquetas, teclado decimal y ayuda', async () => {
    await renderScreen();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Nueva cuenta' })).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la cuenta').props.placeholder).toBe(
      'Efectivo, Banco, Tarjeta…',
    );
    expect(screen.getByText('Saldo inicial (opcional)')).toBeTruthy();
    expect(screen.getByLabelText('Saldo inicial').props.keyboardType).toBe('decimal-pad');
    expect(screen.getByText(/Después no se puede cambiar/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeTruthy();
  });

  it('«‹» vuelve a Mis cuentas sin preguntar', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('crea con saldo inicial en centavos y entrega la cuenta creada', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', '  Banco ');
    await type('Saldo inicial', '12,50');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Banco', saldoInicial: 1250 });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-new', nombre: 'Banco' }),
    );
  });

  it('saldo vacío equivale a 0: no se envía', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Ahorros');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Ahorros' }),
    );
  });

  it('valida nombre y saldo antes de llamar a la API', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre.');
    await type('Nombre de la cuenta', 'Banco');
    await type('Saldo inicial', '1.234');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(screen.getByRole('alert')).toHaveTextContent(BALANCE_ERROR);
    expect(api.createAccount).not.toHaveBeenCalled();
  });

  it('error de la API en español; conserva lo escrito', async () => {
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new ApiRequestError(409, 'LIMIT_REACHED')),
    });
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Otra');
    await type('Saldo inicial', '5');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(await screen.findByText(/Alcanzaste el límite permitido/)).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la cuenta').props.value).toBe('Otra');
    expect(screen.getByLabelText('Saldo inicial').props.value).toBe('5');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('guardando: «Creando…», ocupado, una sola llamada y Atrás ignorado', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, handler) => {
      handlers.push(handler as () => boolean);
      return { remove: jest.fn() };
    });
    const gate = controlledPromise<{ account: ReturnType<typeof account>; categories: [] }>();
    const api = fakeResourcesApi({ createAccount: jest.fn(() => gate.promise) });
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const button = screen.getByRole('button', { name: 'Creando…' });
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(api.createAccount).toHaveBeenCalledTimes(1);
    expect(handlers[handlers.length - 1]!()).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => gate.resolve({ account: account({ id: 'n' }), categories: [] }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }));
  });
});
