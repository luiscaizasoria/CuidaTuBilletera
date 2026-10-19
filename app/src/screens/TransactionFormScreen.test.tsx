// Formulario de movimiento (R3). Cubre los criterios G1 a G19 de docs/007 §5.5.1; G20 está en
// lib/money.test.ts y el comportamiento de Atrás con el navegador en MainNavigator.test.tsx.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, BackHandler, StyleSheet, TextInput } from 'react-native';
import { ApiRequestError, type ResourcesApi } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise, relaxTimeoutsForColdCache } from '../test-utils';
import TransactionFormScreen from './TransactionFormScreen';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));
// Hoy y ayer fijos: el selector de fecha y los chips no dependen del reloj.
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
  yesterdayLocal: () => '2026-10-15',
}));

const YESTERDAY = '2026-10-15';

const expenseCats = [
  category({ id: 'c-food', nombre: 'Comida', tipo: 'egreso', icono: 'utensils', color: '#F97316' }),
  category({ id: 'c-bus', nombre: 'Bus', tipo: 'egreso', icono: 'bus', color: '#3B82F6' }),
  category({ id: 'c-misc', nombre: 'Otros gastos', tipo: 'egreso', icono: 'ellipsis' }),
];
const incomeCats = [category({ id: 'c-pay', nombre: 'Sueldo', tipo: 'ingreso' })];

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    listCategories: jest.fn(async (_t, _a, options) =>
      pageOf(
        options?.incluirArchivadas
          ? [...expenseCats, ...incomeCats]
          : options?.tipo === 'ingreso'
            ? incomeCats
            : expenseCats,
      ),
    ),
    ...overrides,
  });
}

const onDone = jest.fn();
const onAccountArchived = jest.fn();
const renderForm = (
  api = makeApi(),
  tx?: ReturnType<typeof transaction>,
  extra: { initialFecha?: string } = {},
) =>
  render(
    <TransactionFormScreen
      account={account()}
      api={api}
      transaction={tx}
      onDone={onDone}
      onAccountArchived={onAccountArchived}
      {...extra}
    />,
  );

const typeInto = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);
const pressSave = (label = 'Guardar gasto') => fireEvent.press(screen.getByText(label));

function confirmWith(label: string) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

// Captura los listeners de Atrás (el último registrado tiene prioridad, como en Android).
let backHandlers: (() => boolean | null | undefined)[];
let removedListeners: number;
const pressBack = () => backHandlers[backHandlers.length - 1]!();

beforeEach(() => {
  onDone.mockClear();
  onAccountArchived.mockClear();
  (TextInput.prototype.focus as jest.Mock).mockClear();
  backHandlers = [];
  removedListeners = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean);
    return { remove: () => (removedListeners += 1) };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('TransactionFormScreen: nuevo movimiento', () => {
  it('G1: orden Tipo, Categoría, Monto, Fecha, Detalle y pie con Guardar', async () => {
    await renderForm();
    await screen.findByLabelText('Categoría Comida');
    const tree = JSON.stringify(screen.toJSON());
    const at = (needle: string) => tree.indexOf(needle);
    const positions = [
      '"accessibilityLabel":"Tipo"',
      '"accessibilityLabel":"Categoría"',
      '"accessibilityLabel":"Monto"',
      `"accessibilityLabel":"Fecha: 16/10/2026"`,
      '"accessibilityLabel":"Detalle"',
      '"testID":"transaction-form-footer"',
    ].map(at);
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('G2: el monto no recibe foco al abrir; teclado decimal, prefijo «$» y sin Fecha de texto', async () => {
    await renderForm();
    const monto = screen.getByLabelText('Monto');
    expect(monto.props.autoFocus).toBeFalsy();
    expect(monto.props.keyboardType).toBe('decimal-pad');
    expect(monto.props.placeholder).toBe('0.00');
    expect(TextInput.prototype.focus).not.toHaveBeenCalled();
    expect(screen.getByText('$', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByLabelText('Fecha')).toBeNull(); // no hay campo de texto libre
    expect(screen.getByRole('radio', { name: 'Gasto' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(await screen.findByLabelText('Categoría Comida')).toBeTruthy();
  });

  it('crea un gasto: envía centavos, tipo, categoría, fecha y detalle; vuelve al terminar', async () => {
    const api = makeApi();
    await renderForm(api);
    await typeInto('Monto', '12,50');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Ayer' }));
    await typeInto('Detalle', '  almuerzo  ');
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true, 'Gasto de $12.50 guardado en Comida'); // hubo cambio: el contenedor relee el saldo
    expect(api.createTransaction).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      categoryId: 'c-food',
      tipo: 'gasto',
      monto: 1250,
      fecha: YESTERDAY,
      nota: 'almuerzo',
    });
  });

  it('crea un ingreso sin detalle (no envía nota) y el botón dice «Guardar ingreso»', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await typeInto('Monto', '100');
    await fireEvent.press(await screen.findByLabelText('Categoría Sueldo'));
    await pressSave('Guardar ingreso');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const input = api.createTransaction.mock.calls[0]![1];
    expect(input).toMatchObject({ tipo: 'ingreso', categoryId: 'c-pay', monto: 10000 });
    expect(input).not.toHaveProperty('nota');
  });

  it('carga categorías activas del tipo (gasto=egreso) y recarga y limpia al cambiar de tipo', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    expect(api.listCategories).toHaveBeenLastCalledWith('tok', 'acc-1', {
      pageSize: 100,
      tipo: 'egreso',
    });
    expect(screen.queryByLabelText('Categoría Sueldo')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    expect(await screen.findByLabelText('Categoría Sueldo')).toBeTruthy();
    expect(api.listCategories).toHaveBeenLastCalledWith('tok', 'acc-1', {
      pageSize: 100,
      tipo: 'ingreso',
    });
    expect(screen.queryByLabelText('Categoría Comida')).toBeNull();

    // G6: la categoría anterior se descartó y falta elegir otra.
    await typeInto('Monto', '5');
    await pressSave('Guardar ingreso');
    expect(await screen.findByText('Elige una categoría.')).toBeTruthy();
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('no muestra categorías archivadas', async () => {
    const api = makeApi({
      listCategories: jest.fn(async () =>
        pageOf([
          category({ id: 'a', nombre: 'Activa' }),
          category({ id: 'b', nombre: 'Vieja', archivada: true }),
        ]),
      ),
    });
    await renderForm(api);
    expect(await screen.findByLabelText('Categoría Activa')).toBeTruthy();
    expect(screen.queryByLabelText('Categoría Vieja')).toBeNull();
  });

  it('rejilla de 2 columnas con ícono de categoría; la elegida lleva el tinte del tipo y «✓»', async () => {
    await renderForm();
    const food = await screen.findByLabelText('Categoría Comida');
    // Tres categorías: dos filas (2 + 1) y 3 íconos (ocultos a lectores).
    expect(screen.getAllByTestId('category-icon', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getByText('🍽️', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('⋯', { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(food.props.style).minHeight).toBe(56);
    expect(StyleSheet.flatten(food.props.style).borderColor).toBe('#EEE7DC');
    await fireEvent.press(food);
    const selected = screen.getByLabelText('Categoría Comida');
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(selected.props.style)).toMatchObject({
      backgroundColor: '#FFE1D9',
      borderColor: '#D13A2F',
    });
    expect(within(selected).getByText(/✓/, { includeHiddenElements: true })).toBeTruthy();
    // Ingreso: tinte verde.
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await fireEvent.press(await screen.findByLabelText('Categoría Sueldo'));
    expect(StyleSheet.flatten(screen.getByLabelText('Categoría Sueldo').props.style)).toMatchObject(
      { backgroundColor: '#D9F4E4', borderColor: '#12804A' },
    );
  });

  const MSG_THOUSANDS = 'Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.';
  const MSG_CHARS = 'Escribe solo números, por ejemplo 12.50.';
  const MSG_DECIMALS = 'Usa como máximo 2 decimales, por ejemplo 12.50.';

  it('R3 D8: el campo conserva lo escrito o pegado tal cual (nada se descarta en silencio)', async () => {
    await renderForm();
    for (const text of ['1e5', 'a1b2.3,45', '1,234.56', '-5', '12.345']) {
      await typeInto('Monto', text);
      expect(screen.getByLabelText('Monto').props.value).toBe(text);
    }
    expect(screen.queryByRole('alert')).toBeNull(); // sin errores mientras se escribe
    expect(screen.getByLabelText('Monto').props.maxLength).toBe(24);
  });

  it.each([
    ['1000', 100000],
    ['1234', 123400],
    ['12.50', 1250],
    ['12,50', 1250],
    ['.5', 50],
    ['5.', 500],
    ['0.07', 7],
    ['0.1', 10],
    ['999999999.99', 99_999_999_999],
  ])('R3 D8: monto válido %j se envía como %i centavos', async (typed, cents) => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', typed);
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].monto).toBe(cents);
  });

  it.each([
    ['1.000', MSG_THOUSANDS],
    ['1,234', MSG_THOUSANDS],
    ['12.345', MSG_THOUSANDS],
    ['1,234.56', MSG_THOUSANDS],
    ['1.234,56', MSG_THOUSANDS],
    ['1.234.567', MSG_THOUSANDS],
    ['1234.567', MSG_DECIMALS],
    ['1e5', MSG_CHARS],
    ['abc', MSG_CHARS],
    ['-5', MSG_CHARS],
    ['a1b2.3,45', MSG_CHARS],
    ['1 000', MSG_CHARS],
    ['1000000000', 'El monto máximo es $999999999.99.'],
  ])(
    'R3 D8: monto %j se rechaza con su mensaje, enfoca el campo y no llama a la API',
    async (typed, message) => {
      const api = makeApi();
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined);
      announce.mockClear();
      await renderForm(api);
      await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
      await typeInto('Monto', typed);
      await pressSave();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert.props.children).toBe(message);
      expect(TextInput.prototype.focus).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith(message);
      expect(JSON.stringify(screen.toJSON())).toContain('"borderColor":"#D13A2F"');
      expect(api.createTransaction).not.toHaveBeenCalled();
      // El texto mostrado sigue siendo lo escrito y el error se borra al editar el campo.
      expect(screen.getByLabelText('Monto').props.value).toBe(typed);
      await typeInto('Monto', '12.50');
      expect(screen.queryByRole('alert')).toBeNull();
      await pressSave();
      await waitFor(() => expect(onDone).toHaveBeenCalled());
      expect(api.createTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('G5: monto vacío o cero al guardar muestra el error, enfoca el campo y no llama a la API', async () => {
    const api = makeApi();
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    for (const value of ['', '0', '0.00', '.']) {
      (TextInput.prototype.focus as jest.Mock).mockClear();
      announce.mockClear();
      await typeInto('Monto', value);
      await pressSave();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ingresa un monto mayor a cero, por ejemplo 12.50.');
      expect(TextInput.prototype.focus).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith('Ingresa un monto mayor a cero, por ejemplo 12.50.');
    }
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('G6: sin categoría muestra «Elige una categoría.» y lo anuncia antes que el error de monto', async () => {
    const api = makeApi();
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    const setFocus = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => undefined);
    setFocus.mockClear();
    announce.mockClear(); // en jest-expo ya es un mock: se limpian llamadas de otras pruebas
    // Sin renderer nativo `findNodeHandle` devuelve null: se simula un identificador.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(7);
    await renderForm(api);
    await screen.findByLabelText('Categoría Comida');
    await pressSave();
    const messages = (await screen.findAllByRole('alert')).map((node) => node.props.children);
    expect(messages).toEqual([
      'Elige una categoría.',
      'Ingresa un monto mayor a cero, por ejemplo 12.50.',
    ]);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Elige una categoría.');
    expect(setFocus).toHaveBeenCalledTimes(1); // el foco va al mensaje de la rejilla
    expect(TextInput.prototype.focus).not.toHaveBeenCalled();
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('G7: el error de un campo desaparece al editarlo, sin tocar el de los demás', async () => {
    await renderForm();
    await screen.findByLabelText('Categoría Comida');
    await pressSave();
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    await typeInto('Monto', '5');
    expect(screen.queryByText(/monto mayor a cero/)).toBeNull();
    expect(screen.getByText('Elige una categoría.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Categoría Comida'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('el campo de monto con error cambia el borde a expense', async () => {
    await renderForm();
    await pressSave();
    await screen.findByText(/monto mayor a cero/);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('"borderColor":"#D13A2F"');
    expect(tree).not.toContain('#b3261e');
  });

  it('acepta el monto máximo 999999999.99', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '999999999.99');
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].monto).toBe(99_999_999_999);
  });

  it('G8: Hoy preseleccionado; «Ayer» fija ayer; «Hoy» vuelve', async () => {
    await renderForm();
    const chip = (name: string) => screen.getByRole('radio', { name });
    expect(chip('Hoy').props.accessibilityState.selected).toBe(true);
    expect(chip('Ayer').props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText('Fecha: 16/10/2026')).toBeTruthy();
    await fireEvent.press(chip('Ayer'));
    expect(chip('Ayer').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Fecha: 15/10/2026')).toBeTruthy();
    await fireEvent.press(chip('Hoy'));
    expect(screen.getByLabelText('Fecha: 16/10/2026')).toBeTruthy();
  });

  it('G8: «Otra fecha…» abre el selector; elegir un día cambia la fecha y cierra', async () => {
    const api = makeApi();
    await renderForm(api);
    expect(screen.queryByTestId('date-picker')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Otra fecha' }));
    expect(screen.getByRole('header', { name: 'Elige una fecha' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Octubre 2026' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '3 de octubre de 2026' }));
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    // La fecha elegida no es hoy ni ayer: el tercer chip la muestra como elegida.
    const custom = screen.getByRole('radio', { name: 'Otra fecha, 03/10/2026' });
    expect(custom.props.accessibilityState.selected).toBe(true);
    expect(within(custom).getByText('03/10/2026')).toBeTruthy();
    expect(screen.getByLabelText('Fecha: 03/10/2026')).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].fecha).toBe('2026-10-03');
  });

  it('G8: Atrás (cierre de la hoja) y «Cerrar» no cambian la fecha', async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole('radio', { name: 'Otra fecha' }));
    await fireEvent(screen.getByTestId('date-picker'), 'requestClose');
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    expect(screen.getByLabelText('Fecha: 16/10/2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Otra fecha' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Otra fecha' }));
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(screen.queryByRole('header', { name: 'Elige una fecha' })).toBeNull();
    expect(screen.getByLabelText('Fecha: 16/10/2026')).toBeTruthy();
  });

  it('G8: initialFecha válida queda preseleccionada; una inválida usa hoy', async () => {
    const view = await renderForm(makeApi(), undefined, { initialFecha: '2026-09-30' });
    expect(screen.getByLabelText('Fecha: 30/09/2026')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Otra fecha, 30\/09\/2026/ })).toBeTruthy();
    await view.unmount();
    await renderForm(makeApi(), undefined, { initialFecha: '2026-02-31' });
    expect(screen.getByLabelText('Fecha: 16/10/2026')).toBeTruthy();
  });

  it('G17: «Detalle (opcional)» con contador 0/500 y maxLength 500; el contador se resalta desde 450', async () => {
    const api = makeApi();
    await renderForm(api);
    expect(screen.getByText('Detalle (opcional)')).toBeTruthy();
    expect(screen.queryByText('Nota (opcional)')).toBeNull();
    expect(screen.getByText('0/500')).toBeTruthy();
    expect(screen.getByLabelText('Detalle').props.maxLength).toBe(500);
    expect(StyleSheet.flatten(screen.getByText('0/500').props.style).fontWeight).not.toBe('700');
    await typeInto('Detalle', 'n'.repeat(450));
    expect(StyleSheet.flatten(screen.getByText('450/500').props.style).fontWeight).toBe('700');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await typeInto('Detalle', 'n'.repeat(500));
    expect(screen.getByText('500/500')).toBeTruthy();
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].nota).toHaveLength(500);
  });

  it('G9: doble toque en Guardar produce una sola llamada', async () => {
    const gate = controlledPromise<ReturnType<typeof transaction>>();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise) });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    const save = screen.getByText('Guardar gasto');
    await fireEvent.press(save);
    await fireEvent.press(screen.getByText('Guardando…'));
    await fireEvent.press(save);
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => gate.resolve(transaction()));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('G10: durante el guardado todo queda bloqueado, Atrás devuelve true sin diálogo; tras un fallo se rehabilita', async () => {
    const gate = controlledPromise<ReturnType<typeof transaction>>();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise) });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await typeInto('Detalle', 'hola');
    await pressSave();

    const save = screen.getByRole('button', { name: 'Guardando…' });
    expect(save.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.getByLabelText('Monto').props.editable).toBe(false);
    expect(screen.getByLabelText('Detalle').props.editable).toBe(false);
    for (const name of ['Cancelar', 'Cerrar formulario']) {
      expect(screen.getByRole('button', { name }).props.accessibilityState.disabled).toBe(true);
    }
    for (const name of ['Gasto', 'Ingreso', 'Hoy', 'Ayer', 'Otra fecha', 'Categoría Bus']) {
      expect(screen.getByRole('radio', { name }).props.accessibilityState.disabled).toBe(true);
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar formulario' }));
    expect(pressBack()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    const { AuthError } = jest.requireActual('../lib/auth-types');
    await act(async () => gate.reject(new AuthError('network')));
    expect(await screen.findByText(/No pudimos confirmar si se guardó/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar gasto' }).props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(screen.getByLabelText('Monto').props.editable).toBe(true);
    expect(screen.getByLabelText('Monto').props.value).toBe('5');
    expect(screen.getByLabelText('Detalle').props.value).toBe('hola');
    expect(screen.getByLabelText('Categoría Comida').props.accessibilityState.selected).toBe(true);
  });

  it.each([
    ['CATEGORY_ARCHIVED', 409, /categoría está archivada/],
    ['CATEGORY_MISMATCH', 409, /no corresponde a esta cuenta o al tipo/],
    ['ACCOUNT_ARCHIVED', 409, /Esta cuenta está archivada, por eso no se guardó/],
    ['NOT_FOUND', 404, /ya no existe/],
    ['INVALID_REQUEST', 400, /no son válidos/],
  ])(
    'error %s se muestra en español, no cierra y no reintenta el POST',
    async (code, status, text) => {
      const api = makeApi({
        createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(status, code)),
      });
      await renderForm(api);
      await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
      await typeInto('Monto', '5');
      await pressSave();
      expect(await screen.findByText(text)).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
      expect(api.createTransaction).toHaveBeenCalledTimes(1);
      // R2: solo ACCOUNT_ARCHIVED avisa al contenedor de que la cuenta está archivada.
      if (code === 'ACCOUNT_ARCHIVED') expect(onAccountArchived).toHaveBeenCalledWith('acc-1');
      else expect(onAccountArchived).not.toHaveBeenCalled();
      // El botón vuelve a estar disponible (con la cuenta archivada se sustituye por «Volver a la cuenta»).
      if (code === 'ACCOUNT_ARCHIVED') {
        expect(screen.queryByRole('button', { name: 'Guardar gasto' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Volver a la cuenta' })).toBeTruthy();
      } else {
        expect(
          screen.getByRole('button', { name: 'Guardar gasto' }).props.accessibilityState.disabled,
        ).toBe(false);
      }
    },
  );

  it('G19: tras un 409 de categoría obsoleta limpia la selección, recarga y avisa', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    const before = api.listCategories.mock.calls.length;
    await pressSave();
    await screen.findByText(/categoría está archivada/);
    expect(await screen.findByText('Esa categoría cambió. Elige otra.')).toBeTruthy();
    await waitFor(() => expect(api.listCategories.mock.calls.length).toBe(before + 1));
    expect(screen.getByLabelText('Categoría Comida').props.accessibilityState.selected).toBe(false);
    await pressSave();
    expect(await screen.findByText('Elige una categoría.')).toBeTruthy();
    expect(screen.queryByText('Esa categoría cambió. Elige otra.')).toBeNull();
  });

  it('error de red no cierra el formulario y el mensaje es una alerta sobre el botón', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    const message = await screen.findByText(/No pudimos confirmar si se guardó/);
    expect(message.props.accessibilityRole).toBe('alert');
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    expect(
      within(screen.getByTestId('transaction-form-footer')).getByText(/No pudimos confirmar/),
    ).toBe(message);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('error al cargar categorías con Reintentar', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const listCategories = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf(expenseCats));
    await renderForm(makeApi({ listCategories }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByLabelText('Categoría Comida')).toBeTruthy();
  });

  it('G18 (R5.1, R51-19): sin categorías del tipo muestra el aviso nuevo y [+ Crear categoría]', async () => {
    const listCategories = jest.fn().mockResolvedValue(pageOf([]));
    await renderForm(makeApi({ listCategories }));
    expect(
      await screen.findByText(
        'No tienes categorías de gasto activas. Crea una para anotar este movimiento.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Más > Categorías/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ir a Categorías' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Crear categoría' })).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('G17: el pie con Guardar y Cancelar no es descendiente del ScrollView del formulario', async () => {
    await renderForm();
    await screen.findByLabelText('Categoría Comida');
    const scroll = screen.getByTestId('transaction-form-scroll');
    const footer = screen.getByTestId('transaction-form-footer');
    expect(within(scroll).queryByTestId('transaction-form-footer')).toBeNull();
    expect(within(scroll).queryByText('Guardar gasto')).toBeNull();
    expect(within(scroll).queryByText('Cancelar')).toBeNull();
    expect(within(footer).getByText('Guardar gasto')).toBeTruthy();
    expect(within(footer).getByText('Cancelar')).toBeTruthy();
    // Guardar es el botón alto (52 dp) y Cancelar el ghost de 48 dp.
    const saveStyle = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Guardar gasto' }).props.style,
    );
    expect(saveStyle.minHeight).toBe(52);
    expect(
      StyleSheet.flatten(screen.getByRole('button', { name: 'Cancelar' }).props.style).minHeight,
    ).toBe(48);
  });

  it('G17: roles, etiquetas y objetivos táctiles de 48 dp o más', async () => {
    await renderForm();
    await screen.findByLabelText('Categoría Comida');
    expect(screen.getByRole('header', { name: 'Nuevo movimiento' })).toBeTruthy();
    expect(screen.getByLabelText('Tipo').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Categoría').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Fecha: 16/10/2026').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Monto')).toBeTruthy();
    expect(screen.getByLabelText('Detalle')).toBeTruthy();
    const heights = (names: string[], role: 'radio' | 'button') =>
      names.map((name) => {
        const style = StyleSheet.flatten(screen.getByRole(role, { name }).props.style);
        return style.minHeight ?? style.height;
      });
    expect(heights(['Gasto', 'Ingreso', 'Hoy', 'Ayer', 'Otra fecha'], 'radio')).toEqual([
      48, 48, 48, 48, 48,
    ]);
    expect(heights(['Categoría Comida', 'Categoría Bus'], 'radio')).toEqual([56, 56]);
    const close = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Cerrar formulario' }).props.style,
    );
    expect([close.width, close.height]).toEqual([48, 48]);
  });

  it('G8: celdas y flechas del selector de fecha de 48 dp; límites 2000 y 2100', async () => {
    await renderForm(makeApi(), undefined, { initialFecha: '2100-12-15' });
    await fireEvent.press(screen.getByRole('radio', { name: /Otra fecha/ }));
    const cell = StyleSheet.flatten(
      screen.getByRole('button', { name: '15 de diciembre de 2100' }).props.style,
    );
    expect(cell.height).toBe(48);
    for (const name of ['Mes anterior', 'Mes siguiente']) {
      const arrow = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect([arrow.width, arrow.height]).toEqual([48, 48]);
    }
    // Diciembre 2100: no hay mes siguiente.
    expect(
      screen.getByRole('button', { name: 'Mes siguiente' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('header', { name: 'Diciembre 2100' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '15 de diciembre de 2100' }).props.accessibilityState
        .selected,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('header', { name: 'Noviembre 2100' })).toBeTruthy();
  });

  it('G8: el selector marca hoy, navega por meses y llega a enero de 2000', async () => {
    await renderForm(makeApi(), undefined, { initialFecha: '2000-02-10' });
    await fireEvent.press(screen.getByRole('radio', { name: /Otra fecha/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('header', { name: 'Enero 2000' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Mes anterior' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '31 de enero de 2000' }));
    expect(screen.getByLabelText('Fecha: 31/01/2000')).toBeTruthy();
  });

  it('G8: el selector indica «hoy» para el día actual', async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole('radio', { name: 'Otra fecha' }));
    expect(screen.getByRole('button', { name: '16 de octubre de 2026, hoy' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '16 de octubre de 2026, hoy' }).props.accessibilityState
        .selected,
    ).toBe(true); // además de ser hoy, es la fecha elegida
  });

  it('G11: Cancelar, «✕» y Atrás sin cambios salen sin diálogo; los prefijados no cuentan', async () => {
    const api = makeApi();
    await renderForm(api, undefined, { initialFecha: '2026-09-30' });
    await screen.findByLabelText('Categoría Comida');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(onDone).toHaveBeenLastCalledWith(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar formulario' }));
    expect(onDone).toHaveBeenCalledTimes(2);
    // Atrás sin cambios no se intercepta: el navegador resuelve la salida.
    expect(pressBack()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(api.createTransaction).not.toHaveBeenCalled();
    expect(screen.queryByText('Anular movimiento')).toBeNull();
  });

  const dirtyActions: [string, () => unknown][] = [
    ['Cancelar', () => fireEvent.press(screen.getByText('Cancelar'))],
    ['«✕»', () => fireEvent.press(screen.getByRole('button', { name: 'Cerrar formulario' }))],
    ['Atrás', () => act(async () => void pressBack())],
  ];
  const dirtyChanges: [string, () => unknown][] = [
    ['monto', () => typeInto('Monto', '5')],
    ['detalle', () => typeInto('Detalle', 'x')],
    ['categoría', () => fireEvent.press(screen.getByLabelText('Categoría Comida'))],
    ['fecha', () => fireEvent.press(screen.getByRole('radio', { name: 'Ayer' }))],
  ];
  describe.each(dirtyActions)('G12: salir con %s', (_name, leave) => {
    it.each(dirtyChanges)('con cambios en %s pide confirmar y no sale', async (_field, change) => {
      await renderForm();
      await screen.findByLabelText('Categoría Comida');
      await change();
      await leave();
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        '¿Descartar este movimiento?',
        'Lo que escribiste se perderá.',
        [
          expect.objectContaining({ text: 'Seguir editando', style: 'cancel' }),
          expect.objectContaining({ text: 'Descartar', style: 'destructive' }),
        ],
        expect.objectContaining({ cancelable: true, onDismiss: expect.any(Function) }),
      );
      expect(onDone).not.toHaveBeenCalled();
    });

    it('[Seguir editando] conserva los datos y [Descartar] llama a onDone(false)', async () => {
      await renderForm();
      await screen.findByLabelText('Categoría Comida');
      await typeInto('Monto', '7.5');
      await leave();
      let buttons = (Alert.alert as jest.Mock).mock.calls[0]![2] as { onPress?: () => void }[];
      await act(async () => buttons[0]!.onPress!());
      expect(onDone).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Monto').props.value).toBe('7.5');
      // Tras seguir editando se puede volver a intentar.
      await leave();
      expect(Alert.alert).toHaveBeenCalledTimes(2);
      buttons = (Alert.alert as jest.Mock).mock.calls[1]![2] as { onPress?: () => void }[];
      await act(async () => buttons[1]!.onPress!());
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith(false);
    });
  });

  it('Atrás con cambios devuelve true; cerrar el diálogo fuera equivale a Seguir editando', async () => {
    await renderForm();
    await typeInto('Monto', '5');
    expect(pressBack()).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    // Segundo Atrás con el diálogo abierto: no se abre otro.
    expect(pressBack()).toBe(true);
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const options = (Alert.alert as jest.Mock).mock.calls[0]![3] as { onDismiss: () => void };
    await act(async () => options.onDismiss());
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).toHaveBeenCalledTimes(2);
  });

  it('G13: escribir y borrar, o cambiar de Gasto a Ingreso y volver, no cuenta como cambio', async () => {
    await renderForm();
    await screen.findByLabelText('Categoría Comida');
    await typeInto('Monto', '5');
    await typeInto('Monto', '');
    await typeInto('Detalle', 'x');
    await typeInto('Detalle', '   ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Ayer' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Hoy' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Gasto' }));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('G14: guardar con éxito sale sin diálogo', async () => {
    await renderForm();
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(true, 'Gasto de $5.00 guardado en Comida'),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('G14: tras un 409 ACCOUNT_ARCHIVED Cancelar y Atrás salen sin preguntar', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    await screen.findByText(/Esta cuenta está archivada, por eso no se guardó/);
    expect(pressBack()).toBe(false); // el navegador sale
    await fireEvent.press(screen.getByText('Volver a la cuenta'));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('registra una sola suscripción a Atrás y la retira al desmontar', async () => {
    const view = await renderForm();
    await screen.findByLabelText('Categoría Comida');
    expect(backHandlers).toHaveLength(1);
    await view.unmount();
    expect(removedListeners).toBe(1);
  });
});

describe('TransactionFormScreen: edición y anulación', () => {
  const tx = transaction({
    id: 'tx-9',
    categoryId: 'c-food',
    monto: 1250,
    fecha: '2026-10-10',
    nota: 'original',
  });

  it('G15: precarga, deja tipo y categoría de solo lectura y no recarga por tipo', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    expect(screen.getByRole('header', { name: 'Editar movimiento' })).toBeTruthy();
    expect(screen.getByLabelText('Monto').props.value).toBe('12.50');
    expect(screen.getByLabelText('Fecha: 10/10/2026')).toBeTruthy();
    expect(screen.getByLabelText('Detalle').props.value).toBe('original');
    expect(screen.getByLabelText('Tipo: Gasto')).toHaveTextContent('Gasto');
    expect(screen.queryByRole('radio', { name: 'Ingreso' })).toBeNull();
    expect(await screen.findByLabelText('Categoría: Comida')).toHaveTextContent('Comida');
    expect(screen.getAllByTestId('category-icon', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByLabelText('Categoría Bus')).toBeNull();
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Otra fecha, 10/10/2026' })).toBeTruthy();
  });

  it('«Anular movimiento» va dentro del scroll, al final, no en el pie', async () => {
    await renderForm(makeApi(), tx);
    const scroll = screen.getByTestId('transaction-form-scroll');
    expect(within(scroll).getByText('Anular movimiento')).toBeTruthy();
    expect(
      within(screen.getByTestId('transaction-form-footer')).queryByText('Anular movimiento'),
    ).toBeNull();
  });

  it('envía solo los campos modificados', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(api.updateTransaction).toHaveBeenCalledWith('tok', 'tx-9', { monto: 2000 });
  });

  it('modifica fecha y detalle; detalle vacío envía null', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ayer' }));
    await typeInto('Detalle', '   ');
    await pressSave('Guardar cambios');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.updateTransaction).toHaveBeenCalledWith('tok', 'tx-9', {
      fecha: YESTERDAY,
      nota: null,
    });
  });

  it('sin cambios no llama a la API y vuelve', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await pressSave('Guardar cambios');
    expect(api.updateTransaction).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false); // editar sin cambios no relee el saldo
  });

  it('valida el monto también al editar', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Monto', '0');
    await pressSave('Guardar cambios');
    expect(await screen.findByText(/monto mayor a cero/)).toBeTruthy();
    expect(api.updateTransaction).not.toHaveBeenCalled();
  });

  it('movimiento anulado (409) se explica en español', async () => {
    const voided = makeApi({
      updateTransaction: jest
        .fn()
        .mockRejectedValue(new ApiRequestError(409, 'TRANSACTION_VOIDED')),
    });
    await renderForm(voided, tx);
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    expect(await screen.findByText(/ya fue anulado/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('404 al guardar se explica en español', async () => {
    const api = makeApi({
      updateTransaction: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
    });
    await renderForm(api, tx);
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    expect(await screen.findByText(/ya no existe/)).toBeTruthy();
  });

  it('G15: el diálogo de descarte usa el texto de «cambios»; 12.5 y 12.50 son lo mismo', async () => {
    await renderForm(makeApi(), tx);
    await typeInto('Monto', '12.5');
    await typeInto('Detalle', '  original ');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(false);
    onDone.mockClear();
    await typeInto('Monto', '12.51');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '¿Descartar los cambios?',
      'Los cambios que hiciste no se guardarán.',
      expect.any(Array),
      expect.any(Object),
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('anular pide confirmación: cancelar no llama a la API', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Anular movimiento'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Anular movimiento',
      expect.stringContaining('Anular'),
      expect.any(Array),
    );
    expect(api.deleteTransaction).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('G14: anular confirmado llama a deleteTransaction y vuelve sin diálogo de descarte', async () => {
    confirmWith('Anular');
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Monto', '99'); // aunque haya cambios, anular no pregunta por descartar
    await fireEvent.press(screen.getByText('Anular movimiento'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true);
    expect(api.deleteTransaction).toHaveBeenCalledWith('tok', 'tx-9');
    expect(Alert.alert).toHaveBeenCalledTimes(1); // solo la confirmación de anular
  });

  it('anular con 404 se trata como ya anulado', async () => {
    confirmWith('Anular');
    const api = makeApi({
      deleteTransaction: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
    });
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Anular movimiento'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('anular con error de servidor muestra el mensaje y no cierra', async () => {
    confirmWith('Anular');
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = makeApi({
      deleteTransaction: jest.fn().mockRejectedValue(new AuthError('server')),
    });
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Anular movimiento'));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('TransactionFormScreen: R2 (cuenta archivada)', () => {
  it('409 ACCOUNT_ARCHIVED: avisa con el id de la cuenta y no cierra', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    expect(
      await screen.findByText(/Esta cuenta está archivada, por eso no se guardó/),
    ).toBeTruthy();
    expect(onAccountArchived).toHaveBeenCalledTimes(1);
    expect(onAccountArchived).toHaveBeenCalledWith('acc-1');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('un 409 al editar (no es crear) no marca la cuenta como archivada', async () => {
    const api = makeApi({
      updateTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await renderForm(api, transaction({ id: 'tx-9', categoryId: 'c-food' }));
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    await screen.findByText(/La cuenta está archivada/);
    expect(onAccountArchived).not.toHaveBeenCalled();
  });
});

describe('TransactionFormScreen: defectos de UX QA de R3', () => {
  const LOST =
    'No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.';

  it('UXQA-R3-01: red, 5xx o fallo desconocido al crear muestran el texto de respuesta perdida', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    for (const error of [
      new AuthError('network'),
      new AuthError('server'),
      new ApiRequestError(503, 'X'),
      new Error('x'),
    ]) {
      const api = makeApi({ createTransaction: jest.fn().mockRejectedValue(error) });
      const view = await renderForm(api);
      await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
      await typeInto('Monto', '5');
      await pressSave();
      const message = await screen.findByText(LOST);
      expect(message.props.accessibilityRole).toBe('alert');
      expect(screen.queryByText(/inténtalo de nuevo/i)).toBeNull();
      expect(screen.queryByText(/No se pudo conectar/)).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
      await view.unmount();
    }
  });

  it('UXQA-R3-01: un 4xx de validación garantiza que no se guardó y no usa el texto de respuesta perdida', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(400, 'INVALID_REQUEST')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    expect(await screen.findByText(/no son válidos/)).toBeTruthy();
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('UXQA-R3-01: el texto de respuesta perdida se retira al volver a guardar', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const createTransaction = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(transaction());
    await renderForm(makeApi({ createTransaction }));
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    await screen.findByText(LOST);
    await pressSave();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('UXQA-R3-01: al editar, un fallo de red conserva el mensaje genérico (editar no duplica)', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = makeApi({
      updateTransaction: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderForm(api, transaction({ id: 'tx-9', categoryId: 'c-food' }));
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('UXQA-R3-05: Tipo y Categoría de solo lectura llevan el valor en la etiqueta accesible', async () => {
    await renderForm(makeApi(), transaction({ id: 'tx-9', categoryId: 'c-food', tipo: 'gasto' }));
    expect(screen.getByLabelText('Tipo: Gasto')).toHaveTextContent('Gasto');
    expect(await screen.findByLabelText('Categoría: Comida')).toHaveTextContent('Comida');
    expect(screen.queryByLabelText('Tipo')).toBeNull();
  });

  it('UXQA-R3-06: 409 ACCOUNT_ARCHIVED muestra el texto de §3.5.3, [Volver a la cuenta] y sin Guardar', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await pressSave();
    expect(
      await screen.findByText(
        'Esta cuenta está archivada, por eso no se guardó el movimiento. Desarchívala desde Mis cuentas para anotar movimientos.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Guardar gasto')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a la cuenta' }));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('UXQA-R3-02: el éxito entrega el aviso con tipo, importe y categoría (gasto e ingreso)', async () => {
    await renderForm();
    await typeInto('Monto', '12,50');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await pressSave();
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(true, 'Gasto de $12.50 guardado en Comida'),
    );
  });

  it('UXQA-R3-02: ingreso equivalente', async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await typeInto('Monto', '100');
    await fireEvent.press(await screen.findByLabelText('Categoría Sueldo'));
    await pressSave('Guardar ingreso');
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(true, 'Ingreso de $100.00 guardado en Sueldo'),
    );
  });

  it('UXQA-R3-02: editar y anular no emiten aviso de creación', async () => {
    const api = makeApi();
    await renderForm(api, transaction({ id: 'tx-9', categoryId: 'c-food' }));
    await typeInto('Monto', '20');
    await pressSave('Guardar cambios');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
  });
});
