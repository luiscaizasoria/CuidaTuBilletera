// Pestaña Más (R2). Incluye renombrar y archivar, que antes se probaban en AccountsScreen.test.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError, type ResourcesApi } from '../lib/resources-api';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import MoreScreen from './MoreScreen';

const mockAuthState: Record<string, unknown> = {};
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

const handlers = {
  onAccountUpdated: jest.fn(),
  onArchived: jest.fn(),
  onOpenCategories: jest.fn(),
  onOpenExport: jest.fn(),
};
const renderMore = (api: ResourcesApi = fakeResourcesApi(), acc = account()) =>
  render(<MoreScreen api={api} account={acc} {...handlers} />);

function confirmWith(label: string) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeEach(() => {
  Object.assign(mockAuthState, {
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana' },
    busy: false,
    degraded: false,
    unavailableCause: null,
    error: null,
    signOut: jest.fn(),
    restore: jest.fn(),
  });
  Object.values(handlers).forEach((fn) => fn.mockClear());
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('MoreScreen: estructura y navegación', () => {
  it('título, secciones CUENTA y SESIÓN, correo y sin eliminar ni conciliar', async () => {
    await renderMore();
    expect(screen.getByRole('header', { name: 'Más' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'CUENTA' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'SESIÓN' })).toBeTruthy();
    expect(screen.getByText('Conectado como')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.queryByText(/Eliminar/)).toBeNull();
    expect(screen.queryByText(/Conciliar/)).toBeNull();
    expect(screen.queryByText(/Ver ayudas otra vez/)).toBeNull();
  });

  it('Categorías y Exportar navegan', async () => {
    await renderMore();
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    expect(handlers.onOpenCategories).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Exportar' }));
    expect(handlers.onOpenExport).toHaveBeenCalledTimes(1);
  });

  it('Cerrar sesión sin confirmación', async () => {
    await renderMore();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('cuenta archivada: aviso de consulta', async () => {
    await renderMore(fakeResourcesApi(), account({ archivada: true }));
    expect(
      screen.getByText(/Puedes consultar su historial, pero no anotar movimientos/),
    ).toBeTruthy();
  });

  it('sesión degradada: la misma franja con Reintentar', async () => {
    Object.assign(mockAuthState, { degraded: true });
    await renderMore();
    expect(screen.getByText(/Sin conexión estable/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockAuthState.restore).toHaveBeenCalled();
  });
});

describe('MoreScreen: datos de cuenta (renombrar)', () => {
  const openEditor = async () => {
    const row = screen.getByRole('button', { name: 'Datos de cuenta' });
    expect(row.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(row);
    expect(
      screen.getByRole('button', { name: 'Datos de cuenta' }).props.accessibilityState.expanded,
    ).toBe(true);
  };

  it('despliega el nombre actual y la ayuda; guardar envía solo el nombre', async () => {
    const api = fakeResourcesApi();
    await renderMore(api);
    await openEditor();
    expect(screen.getByLabelText('Nombre de la cuenta').props.value).toBe('Efectivo');
    expect(screen.getByText(/El saldo inicial no se puede cambiar/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), ' Billetera ');
    await fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(handlers.onAccountUpdated).toHaveBeenCalledTimes(1));
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { nombre: 'Billetera' });
    // El contenedor recibe la respuesta del PATCH; no se relee el saldo.
    expect(handlers.onAccountUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', nombre: 'Billetera' }),
    );
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('nombre vacío: aviso sin llamar a la API', async () => {
    const api = fakeResourcesApi();
    await renderMore(api);
    await openEditor();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), '  ');
    await fireEvent.press(screen.getByText('Guardar cambios'));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un nombre.');
    expect(api.updateAccount).not.toHaveBeenCalled();
  });

  it('error en línea y ocupado mientras guarda', async () => {
    const gate = controlledPromise<ReturnType<typeof account>>();
    const api = fakeResourcesApi({ updateAccount: jest.fn(() => gate.promise) });
    await renderMore(api);
    await openEditor();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Otra');
    await fireEvent.press(screen.getByText('Guardar cambios'));
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }).props.accessibilityState,
    ).toEqual({
      disabled: true,
      busy: true,
    });
    await act(async () => gate.reject(new AuthError('network')));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(handlers.onAccountUpdated).not.toHaveBeenCalled();
  });
});

describe('MoreScreen: opciones avanzadas (archivar)', () => {
  const openAdvanced = async () => {
    const toggle = screen.getByRole('button', { name: 'Opciones avanzadas' });
    expect(toggle.props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByText('Archivar cuenta')).toBeNull();
    await fireEvent.press(toggle);
  };

  it('archivar pide confirmación con el nombre; Cancelar no llama al PATCH', async () => {
    const api = fakeResourcesApi();
    await renderMore(api);
    await openAdvanced();
    expect(screen.getByText(/Su historial se conserva/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar cuenta' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Archivar cuenta',
      '¿Archivar «Efectivo»? Dejará de aparecer en tu lista y no podrás anotarle movimientos. Podrás desarchivarla cuando quieras.',
      [
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
        expect.objectContaining({ text: 'Archivar', style: 'destructive' }),
      ],
    );
    expect(api.updateAccount).not.toHaveBeenCalled();
  });

  it('confirmado: PATCH archivada true y entrega la cuenta archivada', async () => {
    confirmWith('Archivar');
    const api = fakeResourcesApi();
    await renderMore(api);
    await openAdvanced();
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar cuenta' }));
    await waitFor(() => expect(handlers.onArchived).toHaveBeenCalledTimes(1));
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { archivada: true });
    expect(handlers.onArchived).toHaveBeenCalledWith(expect.objectContaining({ archivada: true }));
  });

  it('error al archivar: mensaje en línea y se queda', async () => {
    confirmWith('Archivar');
    const api = fakeResourcesApi({
      updateAccount: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
    });
    await renderMore(api);
    await openAdvanced();
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar cuenta' }));
    expect(await screen.findByText(/ya no existe/)).toBeTruthy();
    expect(handlers.onArchived).not.toHaveBeenCalled();
  });

  it('cuenta ya archivada: lo explica y no ofrece archivar', async () => {
    await renderMore(fakeResourcesApi(), account({ archivada: true }));
    await openAdvanced();
    expect(screen.getByText(/Esta cuenta ya está archivada/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archivar cuenta' })).toBeNull();
  });
});
