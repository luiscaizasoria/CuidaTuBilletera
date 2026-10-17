// Pestaña Más (R2). Incluye renombrar y archivar, que antes se probaban en AccountsScreen.test.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError, type ResourcesApi } from '../lib/resources-api';
import { APPEARANCE_SAVE_ERROR } from '../lib/resources-messages';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { controlledPromise, relaxTimeoutsForColdCache } from '../test-utils';
import MoreScreen from './MoreScreen';

relaxTimeoutsForColdCache();

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
  it('título, secciones CUENTA, AYUDA y SESIÓN, correo y sin eliminar ni conciliar', async () => {
    await renderMore();
    expect(screen.getByRole('header', { name: 'Más' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'CUENTA' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'AYUDA' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'SESIÓN' })).toBeTruthy();
    expect(screen.getByText('Conectado como')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.queryByText(/Eliminar/)).toBeNull();
    expect(screen.queryByText(/Conciliar/)).toBeNull();
    // R5: «Ver ayudas otra vez» existe y vive en Ayuda, no en Opciones avanzadas.
    expect(screen.getByText('Ver ayudas otra vez')).toBeTruthy();
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

describe('MoreScreen: apariencia en Datos de cuenta (docs/007 §5.14, CTA-01..13)', () => {
  const rejected = jest.fn();
  const renderSupported = (api: ResourcesApi = fakeResourcesApi(), acc = account()) =>
    render(
      <MoreScreen
        api={api}
        account={acc}
        appearanceSupported
        onAppearanceRejected={rejected}
        {...handlers}
      />,
    );
  const openEditor = () => fireEvent.press(screen.getByRole('button', { name: 'Datos de cuenta' }));
  const pick = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));
  const save = () => fireEvent.press(screen.getByText('Guardar cambios'));
  const saved = (nombre = 'Efectivo') => account({ nombre, color: 'rosa', icono: 'bank' });

  beforeEach(() => rejected.mockClear());

  it('CTA-01: con soporte muestra Apariencia después del aviso del saldo y la vista previa con el color real', async () => {
    await renderSupported();
    expect(screen.queryByText('Apariencia')).toBeNull();
    await openEditor();
    expect(screen.getByRole('header', { name: 'Apariencia' })).toBeTruthy();
    const json = JSON.stringify(screen.toJSON());
    expect(json.indexOf('El saldo inicial no se puede cambiar')).toBeLessThan(
      json.indexOf('Apariencia'),
    );
    expect(screen.queryByText('El color se asigna al crear la cuenta')).toBeNull();
  });

  it('CTA-02: sin soporte no hay bloque y el PATCH solo lleva el nombre', async () => {
    const api = fakeResourcesApi();
    await renderMore(api, account({ color: 'rosa' }));
    await openEditor();
    expect(screen.queryByTestId('appearance-block')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Otra');
    await save();
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalled());
    const body = api.updateAccount.mock.calls[0]![2];
    expect(body).toEqual({ nombre: 'Otra' });
    expect('color' in body || 'icono' in body).toBe(false);
  });

  it('preselecciona lo guardado; null es Predeterminado y una clave desconocida también', async () => {
    await renderSupported(fakeResourcesApi(), saved());
    await openEditor();
    expect(
      screen.getByRole('radio', { name: 'Color rosa' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'Ícono Banco' }).props.accessibilityState.selected,
    ).toBe(true);
    screen.unmount();
  });

  it('clave guardada desconocida: se ve Predeterminado', async () => {
    await renderSupported(fakeResourcesApi(), account({ color: 'nuevo', icono: 'cohete' }));
    await openEditor();
    expect(
      screen.getByRole('radio', { name: 'Color predeterminado' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'Ícono predeterminado' }).props.accessibilityState.selected,
    ).toBe(true);
  });

  it('CTA-06: cambiar solo el color envía solo `color`', async () => {
    const api = fakeResourcesApi();
    await renderSupported(api, saved());
    await openEditor();
    await pick('Color limón');
    await save();
    await waitFor(() => expect(handlers.onAccountUpdated).toHaveBeenCalledTimes(1));
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { color: 'limon' });
  });

  it('cambiar nombre e ícono envía ambos y nada más', async () => {
    const api = fakeResourcesApi();
    await renderSupported(api, saved());
    await openEditor();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), ' Ahorros ');
    await pick('Ícono Ahorros');
    await save();
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalled());
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', {
      nombre: 'Ahorros',
      icono: 'money-bag',
    });
  });

  it('CTA-07: de un valor guardado a Predeterminado envía null', async () => {
    const api = fakeResourcesApi();
    await renderSupported(api, saved());
    await openEditor();
    await pick('Color predeterminado');
    await pick('Ícono predeterminado');
    await save();
    await waitFor(() => expect(api.updateAccount).toHaveBeenCalled());
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { color: null, icono: null });
  });

  it('CTA-07/08: de null a Predeterminado no envía nada: sin PATCH y el editor se pliega', async () => {
    const api = fakeResourcesApi();
    await renderSupported(api);
    await openEditor();
    await pick('Color rosa');
    await pick('Color predeterminado');
    await save();
    expect(api.updateAccount).not.toHaveBeenCalled();
    expect(handlers.onAccountUpdated).not.toHaveBeenCalled();
    expect(screen.queryByTestId('appearance-block')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Datos de cuenta' }).props.accessibilityState.expanded,
    ).toBe(false);
  });

  it('CTA-08: sin cambios (ni nombre ni apariencia) no hay PATCH ni aviso', async () => {
    const api = fakeResourcesApi();
    await renderSupported(api, saved());
    await openEditor();
    await save();
    expect(api.updateAccount).not.toHaveBeenCalled();
    expect(handlers.onAccountUpdated).not.toHaveBeenCalled();
  });

  it('sin soporte y sin cambios de nombre tampoco hay PATCH', async () => {
    const api = fakeResourcesApi();
    await renderMore(api);
    await openEditor();
    await save();
    expect(api.updateAccount).not.toHaveBeenCalled();
  });

  it('CTA-09: la vista previa usa el color real de la cuenta y cambia al instante', async () => {
    await renderSupported(fakeResourcesApi(), account({ id: 'acc-1', nombre: 'Banco' }));
    await openEditor();
    const label = () => screen.getByTestId('account-preview').props.accessibilityLabel;
    expect(label()).toBe(
      'Vista previa de la cuenta Banco, color predeterminado, ícono predeterminado',
    );
    await pick('Color celeste');
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Banco Pichincha');
    expect(label()).toBe(
      'Vista previa de la cuenta Banco Pichincha, color celeste, ícono predeterminado',
    );
  });

  it('plegar el editor descarta lo no guardado, sin aviso de descarte', async () => {
    await renderSupported(fakeResourcesApi(), saved());
    await openEditor();
    await pick('Color limón');
    await openEditor();
    await openEditor();
    expect(
      screen.getByRole('radio', { name: 'Color rosa' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('CTA-12: mientras guarda las opciones quedan inertes y hay un solo PATCH', async () => {
    const gate = controlledPromise<ReturnType<typeof account>>();
    const api = fakeResourcesApi({ updateAccount: jest.fn(() => gate.promise) });
    await renderSupported(api, saved());
    await openEditor();
    await pick('Color limón');
    await save();
    for (const radio of screen.getAllByRole('radio', { hidden: true })) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
    await fireEvent.press(screen.getByRole('radio', { name: 'Color celeste', hidden: true }));
    await save();
    expect(api.updateAccount).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(saved()));
  });

  it('CTA-13: fallo de red conserva la selección y muestra el texto de la especificación', async () => {
    const api = fakeResourcesApi({
      updateAccount: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderSupported(api, saved());
    await openEditor();
    await pick('Color limón');
    await save();
    expect(await screen.findByText(APPEARANCE_SAVE_ERROR)).toBeTruthy();
    expect(screen.getByText('Color: Limón')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: false }));
    expect(handlers.onAccountUpdated).not.toHaveBeenCalled();
  });

  it('400 de validación con apariencia: no reintenta, oculta el bloque y avisa', async () => {
    const api = fakeResourcesApi({
      updateAccount: jest.fn().mockRejectedValue(new ApiRequestError(400, 'INVALID_REQUEST')),
    });
    await renderSupported(api, saved());
    await openEditor();
    await pick('Color limón');
    await save();
    expect(await screen.findByText(APPEARANCE_SAVE_ERROR)).toBeTruthy();
    expect(api.updateAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('appearance-block')).toBeNull();
    expect(rejected).toHaveBeenCalledTimes(1);
  });
});
