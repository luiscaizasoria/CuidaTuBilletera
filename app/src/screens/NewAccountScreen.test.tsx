// Crear cuenta (R2). Incluye los casos de creación que antes estaban en AccountsScreen.test.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, BackHandler, StyleSheet, TextInput } from 'react-native';
import { ApiRequestError } from '../lib/resources-api';
import { APPEARANCE_SAVE_ERROR } from '../lib/resources-messages';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { chooseIcon, controlledPromise, relaxTimeoutsForColdCache } from '../test-utils';
import NewAccountScreen, {
  BALANCE_TOO_BIG_ERROR,
  NEGATIVE_BALANCE_LABEL,
} from './NewAccountScreen';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const onBack = jest.fn();
const onCreated = jest.fn();
const renderScreen = (api = fakeResourcesApi()) =>
  render(<NewAccountScreen api={api} onBack={onBack} onCreated={onCreated} />);
const renderWithAppearance = (api = fakeResourcesApi(), onAppearanceRejected = jest.fn()) =>
  render(
    <NewAccountScreen
      api={api}
      onBack={onBack}
      onCreated={onCreated}
      appearanceSupported
      onAppearanceRejected={onAppearanceRejected}
    />,
  );
const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

// Listeners de Atrás capturados: el último registrado tiene prioridad, como en Android.
let backHandlers: (() => boolean | null | undefined)[];
const pressBack = () => backHandlers[backHandlers.length - 1]!();
const confirmButtons = () =>
  (Alert.alert as jest.Mock).mock.calls[0]![2] as { text: string; onPress?: () => void }[];

beforeEach(() => {
  onBack.mockClear();
  onCreated.mockClear();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean);
    return { remove: jest.fn() };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
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
    const gate = controlledPromise<{ account: ReturnType<typeof account>; categories: [] }>();
    const api = fakeResourcesApi({ createAccount: jest.fn(() => gate.promise) });
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const button = screen.getByRole('button', { name: 'Creando…' });
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(api.createAccount).toHaveBeenCalledTimes(1);
    expect(pressBack()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => gate.resolve({ account: account({ id: 'n' }), categories: [] }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }));
  });

  it('G16: nombre vacío muestra «Escribe un nombre.» con rol alert y enfoca el campo', async () => {
    const api = fakeResourcesApi();
    (TextInput.prototype.focus as jest.Mock).mockClear();
    await renderScreen(api);
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escribe un nombre.');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(TextInput.prototype.focus).toHaveBeenCalledTimes(1);
    expect(api.createAccount).not.toHaveBeenCalled();
    // El error desaparece al editar el campo.
    await type('Nombre de la cuenta', 'B');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R3 D8: el campo conserva lo escrito o pegado tal cual', async () => {
    await renderScreen();
    for (const text of ['1e5', 'a1b2.3,45', '1,234.56', '-5']) {
      await type('Saldo inicial', text);
      expect(screen.getByLabelText('Saldo inicial').props.value).toBe(text);
    }
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Saldo inicial').props.maxLength).toBe(24);
  });

  it.each([
    ['1000', 100000],
    ['12.50', 1250],
    ['12,50', 1250],
    ['.5', 50],
    ['5.', 500],
    ['0.07', 7],
    ['0.1', 10],
    ['12345678901234', 1_234_567_890_123_400],
    ['99999999999999', null],
  ])(
    'R3 D8: saldo %j se envía como %s centavos (null = demasiado grande)',
    async (typed, cents) => {
      const api = fakeResourcesApi();
      await renderScreen(api);
      await type('Nombre de la cuenta', 'Banco');
      await type('Saldo inicial', typed);
      await fireEvent.press(screen.getByText('Crear cuenta'));
      if (cents === null) {
        expect(screen.getByRole('alert')).toHaveTextContent(BALANCE_TOO_BIG_ERROR);
        expect(api.createAccount).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(onCreated).toHaveBeenCalled());
        expect(api.createAccount).toHaveBeenCalledWith('tok', {
          nombre: 'Banco',
          saldoInicial: cents,
        });
      }
    },
  );

  it.each([
    ['1.000', 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.'],
    ['1,234', 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.'],
    ['1,234.56', 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.'],
    ['1.234,56', 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.'],
    ['1.234.567', 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.'],
    ['1234.567', 'Usa como máximo 2 decimales, por ejemplo 12.50.'],
    ['1e5', 'Escribe solo números, por ejemplo 12.50.'],
    ['-5', 'Escribe solo números, por ejemplo 12.50.'],
    ['abc', 'Escribe solo números, por ejemplo 12.50.'],
  ])('R3 D8: saldo %j se rechaza con su mensaje, sin llamar a la API', async (typed, message) => {
    const api = fakeResourcesApi();
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    announce.mockClear();
    (TextInput.prototype.focus as jest.Mock).mockClear();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await type('Saldo inicial', typed);
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const alert = screen.getByRole('alert');
    expect(alert.props.children).toBe(message);
    expect(announce).toHaveBeenCalledWith(message);
    expect(TextInput.prototype.focus).toHaveBeenCalled();
    expect(api.createAccount).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Saldo inicial').props.value).toBe(typed);
    await type('Saldo inicial', '12.50');
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledTimes(1);
  });

  it('R3 D8: el signo lo da solo el interruptor; «-» escrito se rechaza', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await type('Saldo inicial', '-5');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe solo números, por ejemplo 12.50.');
    expect(api.createAccount).not.toHaveBeenCalled();
  });

  it('G16: saldo de 14 enteros dentro del tope se crea tal cual (en centavos)', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Grande');
    await type('Saldo inicial', '90071992547409.91');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', {
      nombre: 'Grande',
      saldoInicial: 9_007_199_254_740_991,
    });
  });

  it('G16: saldo sobre el tope de la API muestra el error y no llama', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Grande');
    await type('Saldo inicial', '99999999999999.99');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(screen.getByRole('alert')).toHaveTextContent(BALANCE_TOO_BIG_ERROR);
    expect(BALANCE_TOO_BIG_ERROR).toBe('El saldo inicial es demasiado grande. Revisa la cifra.');
    expect(api.createAccount).not.toHaveBeenCalled();
    await type('Saldo inicial', '1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('G16: «Es un saldo en contra» es un checkbox de 48 dp que aplica el signo y el prefijo «-$»', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    const toggle = screen.getByRole('checkbox', { name: NEGATIVE_BALANCE_LABEL });
    expect(NEGATIVE_BALANCE_LABEL).toBe('Es un saldo en contra (debo dinero)');
    expect(toggle.props.accessibilityState.checked).toBe(false);
    expect(StyleSheet.flatten(toggle.props.style).minHeight).toBe(48);
    expect(screen.getByText('$', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(toggle);
    expect(
      screen.getByRole('checkbox', { name: NEGATIVE_BALANCE_LABEL }).props.accessibilityState
        .checked,
    ).toBe(true);
    expect(screen.getByText('-$', { includeHiddenElements: true })).toBeTruthy();
    // El campo nunca escribe el signo.
    await type('Saldo inicial', '12.50');
    expect(screen.getByLabelText('Saldo inicial').props.value).toBe('12.50');
    await type('Nombre de la cuenta', 'Tarjeta');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', {
      nombre: 'Tarjeta',
      saldoInicial: -1250,
    });
  });

  it('G16: saldo en contra sin importe o con 0 no envía saldo negativo', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Tarjeta');
    await fireEvent.press(screen.getByRole('checkbox', { name: NEGATIVE_BALANCE_LABEL }));
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Tarjeta' });
    api.createAccount.mockClear();
    await type('Saldo inicial', '0');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(api.createAccount).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Tarjeta', saldoInicial: 0 });
  });

  it('G16: el signo en contra cuenta como cambio sin guardar', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: NEGATIVE_BALANCE_LABEL }));
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('G11: sin texto, «‹» sale sin diálogo y Atrás no se intercepta; el espacio en blanco no cuenta', async () => {
    await renderScreen();
    await type('Nombre de la cuenta', '   ');
    await type('Saldo inicial', '');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(pressBack()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each([
    ['«‹»', () => fireEvent.press(screen.getByRole('button', { name: 'Volver' }))],
    ['Atrás', async () => void pressBack()],
  ])('G16: salir con %s con texto pide confirmar (nombre o saldo)', async (_name, leave) => {
    for (const [label, value] of [
      ['Nombre de la cuenta', 'Banco'],
      ['Saldo inicial', '5'],
    ] as const) {
      (Alert.alert as jest.Mock).mockClear();
      onBack.mockClear();
      const view = await renderScreen();
      await type(label, value);
      await leave();
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        '¿Descartar esta cuenta?',
        'Lo que escribiste se perderá.',
        [
          expect.objectContaining({ text: 'Seguir editando', style: 'cancel' }),
          expect.objectContaining({ text: 'Descartar', style: 'destructive' }),
        ],
        expect.objectContaining({ cancelable: true }),
      );
      expect(onBack).not.toHaveBeenCalled();
      await view.unmount();
    }
  });

  it('G12: [Seguir editando] conserva lo escrito y [Descartar] vuelve a Mis cuentas', async () => {
    await renderScreen();
    await type('Nombre de la cuenta', 'Banco');
    expect(pressBack()).toBe(true);
    await act(async () => confirmButtons()[0]!.onPress!());
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre de la cuenta').props.value).toBe('Banco');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    const buttons = (Alert.alert as jest.Mock).mock.calls[1]![2] as { onPress?: () => void }[];
    await act(async () => buttons[1]!.onPress!());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('G14: crear con éxito entrega la cuenta sin diálogo', async () => {
    await renderScreen();
    await type('Nombre de la cuenta', 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('roles y etiquetas: «Volver» de 48 dp, campos con etiqueta, foco visible en el nombre', async () => {
    await renderScreen();
    const back = StyleSheet.flatten(screen.getByRole('button', { name: 'Volver' }).props.style);
    expect([back.width, back.height]).toEqual([48, 48]);
    expect(screen.getByLabelText('Nombre de la cuenta')).toBeTruthy();
    expect(screen.getByLabelText('Saldo inicial')).toBeTruthy();
    expect(screen.getByText(/Déjalo vacío si empiezas en 0/)).toBeTruthy();
    const field = screen.getByLabelText('Nombre de la cuenta');
    await fireEvent(field, 'focus');
    expect(JSON.stringify(screen.toJSON())).toContain('"backgroundColor":"#D3EBF0"'); // halo brand100
    await fireEvent(field, 'blur');
    expect(JSON.stringify(screen.toJSON())).not.toContain('"backgroundColor":"#D3EBF0"');
  });

  it('mientras crea, el checkbox y los campos se bloquean', async () => {
    const gate = controlledPromise<{ account: ReturnType<typeof account>; categories: [] }>();
    const api = fakeResourcesApi({ createAccount: jest.fn(() => gate.promise) });
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(screen.getByLabelText('Nombre de la cuenta').props.editable).toBe(false);
    expect(screen.getByLabelText('Saldo inicial').props.editable).toBe(false);
    expect(
      screen.getByRole('checkbox', { name: NEGATIVE_BALANCE_LABEL }).props.accessibilityState
        .disabled,
    ).toBe(true);
    await act(async () => gate.resolve({ account: account({ id: 'n' }), categories: [] }));
  });

  it('UXQA-R3-01: red perdida al crear muestra «No pudimos confirmar si se creó…»; un 4xx no', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderScreen(api);
    await type('Nombre de la cuenta', 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const alert = await screen.findByText(
      'No pudimos confirmar si se creó. Revisa Mis cuentas antes de volver a intentar.',
    );
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByText(/No se pudo conectar/)).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('UXQA-R3-08: los errores de campo se anuncian una vez y el error de envío es polite', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    announce.mockClear();
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new ApiRequestError(409, 'LIMIT_REACHED')),
    });
    await renderScreen(api);
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Escribe un nombre.');
    await type('Nombre de la cuenta', 'Otra');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const message = await screen.findByText(/Alcanzaste el límite permitido/);
    expect(message.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('NewAccountScreen: apariencia (docs/007 §5.14, CTA-01..13)', () => {
  const pick = (name: string) =>
    name.startsWith('Ícono ') && name !== 'Ícono predeterminado'
      ? chooseIcon(name.slice('Ícono '.length), screen)
      : fireEvent.press(screen.getByRole('radio', { name }));
  const create = async (name = 'Banco') => {
    await type('Nombre de la cuenta', name);
    await fireEvent.press(screen.getByText('Crear cuenta'));
  };

  it('CTA-01: con soporte se muestra Apariencia después de la ayuda del saldo y antes de Crear', async () => {
    await renderWithAppearance();
    expect(screen.getByRole('header', { name: 'Apariencia' })).toBeTruthy();
    expect(screen.getByTestId('account-preview')).toBeTruthy();
    const text = JSON.stringify(screen.toJSON());
    expect(text.indexOf('Después no se puede cambiar')).toBeLessThan(text.indexOf('Apariencia'));
    expect(text.indexOf('Apariencia')).toBeLessThan(text.indexOf('Crear cuenta'));
  });

  it('CTA-02/03: sin soporte (o lista vacía) el bloque no existe y el POST no lleva color ni ícono', async () => {
    const api = fakeResourcesApi();
    await renderScreen(api);
    expect(screen.queryByText('Apariencia')).toBeNull();
    expect(screen.queryByTestId('appearance-block')).toBeNull();
    await create();
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const body = api.createAccount.mock.calls[0]![1];
    expect(body).toEqual({ nombre: 'Banco' });
    expect('color' in body).toBe(false);
    expect('icono' in body).toBe(false);
  });

  it('CTA-04: elegir «limón» envía la clave `limon` sin tilde', async () => {
    const api = fakeResourcesApi();
    await renderWithAppearance(api);
    await pick('Color limón');
    expect(screen.getByText('Color: Limón')).toBeTruthy();
    await create();
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', { nombre: 'Banco', color: 'limon' });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ color: 'limon' }));
  });

  it('elegir color e ícono los envía junto con el saldo', async () => {
    const api = fakeResourcesApi();
    await renderWithAppearance(api);
    await pick('Color rosa');
    await pick('Ícono Viajes');
    await type('Saldo inicial', '10');
    await create('Viaje');
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenCalledWith('tok', {
      nombre: 'Viaje',
      saldoInicial: 1000,
      color: 'rosa',
      icono: 'plane',
    });
  });

  it('CTA-05: sin tocar Apariencia no se envía color ni ícono; volver a Predeterminado tampoco', async () => {
    const api = fakeResourcesApi();
    await renderWithAppearance(api);
    await pick('Color rosa');
    await pick('Color predeterminado');
    await create();
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const body = api.createAccount.mock.calls[0]![1];
    expect(body).toEqual({ nombre: 'Banco' });
    expect('color' in body || 'icono' in body).toBe(false);
  });

  it('CTA-09: la vista previa sigue al nombre, color e ícono al instante', async () => {
    await renderWithAppearance();
    expect(screen.getByText('El color se asigna al crear la cuenta')).toBeTruthy();
    await type('Nombre de la cuenta', 'Tarjeta Visa');
    expect(screen.getByTestId('account-preview').props.accessibilityLabel).toBe(
      'Vista previa de la cuenta Tarjeta Visa, color predeterminado, ícono predeterminado',
    );
    expect(
      within(screen.getByTestId('account-preview')).getByText('💳', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    await pick('Color celeste');
    await pick('Ícono Banco');
    expect(screen.getByTestId('account-preview').props.accessibilityLabel).toBe(
      'Vista previa de la cuenta Tarjeta Visa, color celeste, ícono Banco',
    );
    expect(screen.queryByText('El color se asigna al crear la cuenta')).toBeNull();
  });

  it('CTA-11: elegir solo un color activa el aviso de descarte; con Predeterminado no', async () => {
    await renderWithAppearance();
    await pick('Color lavanda');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      '¿Descartar esta cuenta?',
      'Lo que escribiste se perderá.',
      expect.any(Array),
      expect.anything(),
    );
    expect(onBack).not.toHaveBeenCalled();
    (Alert.alert as jest.Mock).mockClear();
    await pick('Color predeterminado');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('elegir solo un ícono también activa el aviso de descarte (Atrás)', async () => {
    await renderWithAppearance();
    await pick('Ícono Hogar');
    expect(pressBack()).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('CTA-12: mientras se guarda las opciones quedan inertes y hay un solo envío', async () => {
    const gate = controlledPromise<{ account: ReturnType<typeof account>; categories: [] }>();
    const api = fakeResourcesApi({ createAccount: jest.fn(() => gate.promise) });
    await renderWithAppearance(api);
    await pick('Color rosa');
    await create();
    for (const radio of screen.getAllByRole('radio', { hidden: true })) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
    await fireEvent.press(screen.getByRole('radio', { name: 'Color limón', hidden: true }));
    await fireEvent.press(screen.getByRole('button', { name: 'Creando…' }));
    expect(api.createAccount).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Color: Rosa')).toBeTruthy();
    await act(async () => gate.resolve({ account: account({ id: 'n' }), categories: [] }));
  });

  it('CTA-13: un fallo de red al crear conserva la selección y no reenvía a ciegas', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderWithAppearance(api);
    await pick('Color rosa');
    await pick('Ícono Regalos');
    await create();
    expect(await screen.findByText(/No pudimos confirmar si se creó/)).toBeTruthy();
    expect(screen.getByText('Color: Rosa')).toBeTruthy();
    expect(screen.getByText('Ícono: Regalos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear cuenta' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    expect(api.createAccount).toHaveBeenCalledTimes(1);
  });

  it('400 de validación con apariencia: no reintenta, oculta el bloque, avisa y notifica al navegador', async () => {
    const rejected = jest.fn();
    const api = fakeResourcesApi({
      createAccount: jest
        .fn()
        .mockRejectedValueOnce(new ApiRequestError(400, 'VALIDATION_ERROR'))
        .mockResolvedValue({ account: account({ id: 'n' }), categories: [] }),
    });
    await renderWithAppearance(api, rejected);
    await pick('Color rosa');
    await create();
    expect(await screen.findByText(APPEARANCE_SAVE_ERROR)).toBeTruthy();
    expect(api.createAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('appearance-block')).toBeNull();
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    // El siguiente intento manual ya no lleva apariencia.
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createAccount).toHaveBeenLastCalledWith('tok', { nombre: 'Banco' });
    // Sin apariencia visible Atrás ya no la cuenta como cambio.
  });

  it('un 400 sin apariencia en el cuerpo conserva el mensaje y el bloque', async () => {
    const api = fakeResourcesApi({
      createAccount: jest.fn().mockRejectedValue(new ApiRequestError(400, 'VALIDATION_ERROR')),
    });
    await renderWithAppearance(api);
    await create();
    expect(await screen.findByText(/Los datos enviados|inesperado/)).toBeTruthy();
    expect(screen.getByTestId('appearance-block')).toBeTruthy();
  });
});
