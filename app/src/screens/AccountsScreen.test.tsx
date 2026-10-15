import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError } from '../lib/resources-api';
import { account, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import AccountsScreen from './AccountsScreen';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const open = jest.fn();
const renderScreen = (api = fakeResourcesApi()) =>
  render(<AccountsScreen api={api} onOpenAccount={open} />);

beforeEach(() => {
  open.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('AccountsScreen: estados', () => {
  it('loading mientras carga', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    await renderScreen(fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise as never) }));
    expect(screen.getByTestId('accounts-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageOf([account()])));
    expect(await screen.findByText('Efectivo')).toBeTruthy();
    expect(screen.queryByTestId('accounts-loading')).toBeNull();
  });

  it('ready: nombre y saldo inicial formateado', async () => {
    await renderScreen(
      fakeResourcesApi({
        listAccounts: jest.fn(async () => pageOf([account({ saldoInicial: -250 })])),
      }),
    );
    expect(await screen.findByText('Efectivo')).toBeTruthy();
    expect(screen.getByText('Saldo inicial -$2.50')).toBeTruthy();
  });

  it('empty: invita a crear la primera cuenta', async () => {
    await renderScreen(fakeResourcesApi({ listAccounts: jest.fn(async () => pageOf([])) }));
    expect(await screen.findByText('Crea tu primera cuenta')).toBeTruthy();
  });

  it('error: mensaje en español sin el message del servidor y Reintentar recarga', async () => {
    const listAccounts = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(pageOf([account()]));
    await renderScreen(fakeResourcesApi({ listAccounts }));
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('Efectivo')).toBeTruthy();
    expect(listAccounts).toHaveBeenCalledTimes(2);
  });

  it('error de negocio inesperado muestra el mensaje genérico', async () => {
    await renderScreen(
      fakeResourcesApi({
        listAccounts: jest.fn().mockRejectedValue(new ApiRequestError(418, 'RARO')),
      }),
    );
    expect(await screen.findByText(/Ocurrió un error inesperado/)).toBeTruthy();
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderScreen(
      fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise as never) }),
    );
    await view.unmount();
    await act(async () => gate.resolve(pageOf([account()])));
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('AccountsScreen: acciones', () => {
  it('pide cuentas con page_size 100 y alterna «Mostrar archivadas»', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await screen.findByText('Efectivo');
    expect(api.listAccounts).toHaveBeenLastCalledWith('tok', {
      pageSize: 100,
      incluirArchivadas: false,
    });
    await fireEvent(screen.getByLabelText('Mostrar archivadas'), 'valueChange', true);
    await waitFor(() =>
      expect(api.listAccounts).toHaveBeenLastCalledWith('tok', {
        pageSize: 100,
        incluirArchivadas: true,
      }),
    );
  });

  it('tocar la fila abre las categorías de esa cuenta', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Abrir Efectivo'));
    expect(open).toHaveBeenCalledWith(account());
  });

  it('crea una cuenta con saldo inicial en centavos y recarga la lista', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await screen.findByText('Efectivo');
    await fireEvent.press(screen.getByText('Nueva cuenta'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), '  Banco ');
    await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '12,50');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith('tok', {
        nombre: 'Banco',
        saldoInicial: 1250,
      }),
    );
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Nombre de la cuenta')).toBeNull();
  });

  it('crea sin saldo inicial: no lo envía', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await screen.findByText('Efectivo');
    await fireEvent.press(screen.getByText('Nueva cuenta'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Ahorros');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Ahorros' }),
    );
  });

  it('valida nombre y saldo antes de llamar a la API', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await screen.findByText('Efectivo');
    await fireEvent.press(screen.getByText('Nueva cuenta'));
    await fireEvent.press(screen.getByText('Guardar'));
    expect(screen.getByText('Escribe un nombre.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Banco');
    await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '1.234');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(screen.getByText(/El saldo inicial no es válido/)).toBeTruthy();
    expect(api.createAccount).not.toHaveBeenCalled();
  });

  it('cancelar cierra el formulario', async () => {
    await renderScreen();
    await screen.findByText('Efectivo');
    await fireEvent.press(screen.getByText('Nueva cuenta'));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByLabelText('Nombre de la cuenta')).toBeNull();
  });

  it('renombra una cuenta enviando solo el nombre', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Renombrar Efectivo'));
    expect(screen.getByLabelText('Nombre de la cuenta').props.value).toBe('Efectivo');
    expect(screen.queryByLabelText('Saldo inicial')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Billetera');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { nombre: 'Billetera' }),
    );
  });

  it('archivar pide confirmación y no llama a la API si se cancela', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Archivar Efectivo'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(api.updateAccount).not.toHaveBeenCalled();
  });

  it('archivar confirmado envía archivada true y recarga', async () => {
    const api = fakeResourcesApi();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Archivar')?.onPress?.();
    });
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Archivar Efectivo'));
    await waitFor(() =>
      expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { archivada: true }),
    );
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalledTimes(2));
  });

  it('desarchivar no pide confirmación', async () => {
    const api = fakeResourcesApi({
      listAccounts: jest.fn(async () => pageOf([account({ archivada: true })])),
    });
    await renderScreen(api);
    expect(await screen.findByText('Archivada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Desarchivar Efectivo'));
    await waitFor(() =>
      expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { archivada: false }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('deshabilita los botones mientras corre una mutación', async () => {
    const gate = controlledPromise<ReturnType<typeof account>>();
    const api = fakeResourcesApi({ updateAccount: jest.fn(() => gate.promise as never) });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Archivar')?.onPress?.();
    });
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Archivar Efectivo'));
    await waitFor(() =>
      expect(screen.getByLabelText('Renombrar Efectivo').props.accessibilityState.disabled).toBe(
        true,
      ),
    );
    expect(screen.getByText('Nueva cuenta')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Archivar Efectivo'));
    expect(api.updateAccount).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(account({ archivada: true })));
    await waitFor(() =>
      expect(screen.getByLabelText('Renombrar Efectivo').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
  });

  it('un error de la API (límite) se muestra en español', async () => {
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new ApiRequestError(409, 'LIMIT_REACHED')),
    });
    await renderScreen(api);
    await screen.findByText('Efectivo');
    await fireEvent.press(screen.getByText('Nueva cuenta'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Otra');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/Alcanzaste el límite permitido/)).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la cuenta')).toBeTruthy();
  });
});
