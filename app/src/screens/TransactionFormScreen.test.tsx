import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import { todayLocal, yesterdayLocal } from '../lib/dates';
import { ApiRequestError, type ResourcesApi } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import TransactionFormScreen from './TransactionFormScreen';

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const expenseCats = [
  category({ id: 'c-food', nombre: 'Comida', tipo: 'egreso' }),
  category({ id: 'c-bus', nombre: 'Bus', tipo: 'egreso' }),
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
const renderForm = (api = makeApi(), tx?: ReturnType<typeof transaction>) =>
  render(
    <TransactionFormScreen
      account={account()}
      api={api}
      transaction={tx}
      onDone={onDone}
      onAccountArchived={onAccountArchived}
    />,
  );

const typeInto = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

function confirmWith(label: string) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeEach(() => {
  onDone.mockClear();
  onAccountArchived.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('TransactionFormScreen: nuevo movimiento', () => {
  it('orden: monto primero con foco y teclado numérico, tipo gasto por defecto, fecha de hoy', async () => {
    await renderForm();
    const monto = screen.getByLabelText('Monto');
    expect(monto.props.autoFocus).toBe(true);
    expect(monto.props.keyboardType).toBe('decimal-pad');
    expect(screen.getByLabelText('Fecha').props.value).toBe(todayLocal());
    expect(screen.getByRole('radio', { name: 'Gasto' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByLabelText('Nota').props.maxLength).toBe(500);
    expect(await screen.findByLabelText('Categoría Comida')).toBeTruthy();
  });

  it('crea un gasto: envía centavos, tipo, categoría, fecha y nota; vuelve al terminar', async () => {
    const api = makeApi();
    await renderForm(api);
    await typeInto('Monto', '12,50');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Fecha', '2026-10-01');
    await typeInto('Nota', '  almuerzo  ');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true); // R2: hubo cambio, el contenedor relee el saldo
    expect(api.createTransaction).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      categoryId: 'c-food',
      tipo: 'gasto',
      monto: 1250,
      fecha: '2026-10-01',
      nota: 'almuerzo',
    });
  });

  it('crea un ingreso sin nota (no envía nota)', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await typeInto('Monto', '100');
    await fireEvent.press(await screen.findByLabelText('Categoría Sueldo'));
    await fireEvent.press(screen.getByText('Guardar'));
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

    // La categoría anterior se descartó: guardar exige elegir otra.
    await typeInto('Monto', '5');
    await fireEvent.press(screen.getByText('Guardar'));
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

  it.each([
    ['vacío', ''],
    ['cero', '0'],
    ['cero decimal', '0.00'],
    ['negativo', '-5'],
    ['texto', 'abc'],
    ['tres decimales', '1.234'],
    ['miles', '1,000.00'],
    ['exceso del máximo', '1000000000'],
  ])('monto inválido (%s) no llama a la API', async (_name, value) => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', value);
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('acepta el monto máximo 999999999.99', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '999999999.99');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].monto).toBe(99_999_999_999);
  });

  it.each(['2026-02-30', '1999-12-31', '2101-01-01', '2026-1-1', 'hoy', ''])(
    'fecha inválida %j no llama a la API',
    async (value) => {
      const api = makeApi();
      await renderForm(api);
      await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
      await typeInto('Monto', '5');
      await typeInto('Fecha', value);
      await fireEvent.press(screen.getByText('Guardar'));
      expect(await screen.findByText(/fecha válida con formato AAAA-MM-DD/)).toBeTruthy();
      expect(api.createTransaction).not.toHaveBeenCalled();
    },
  );

  it('los botones Hoy y Ayer usan la fecha local', async () => {
    await renderForm();
    await typeInto('Fecha', '2020-01-01');
    await fireEvent.press(screen.getByText('Ayer'));
    expect(screen.getByLabelText('Fecha').props.value).toBe(yesterdayLocal());
    await fireEvent.press(screen.getByText('Hoy'));
    expect(screen.getByLabelText('Fecha').props.value).toBe(todayLocal());
  });

  it('la nota admite exactamente 500 caracteres', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await typeInto('Nota', 'n'.repeat(500));
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.createTransaction.mock.calls[0]![1].nota).toHaveLength(500);
    expect(screen.getByLabelText('Nota').props.maxLength).toBe(500);
  });

  it('doble toque: una sola llamada y botones deshabilitados mientras guarda', async () => {
    const gate = controlledPromise<ReturnType<typeof transaction>>();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise) });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    const save = screen.getByText('Guardar');
    await fireEvent.press(save);
    await fireEvent.press(save);
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardar' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => gate.resolve(transaction()));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['CATEGORY_ARCHIVED', 409, /categoría está archivada/],
    ['CATEGORY_MISMATCH', 409, /no corresponde a esta cuenta o al tipo/],
    ['ACCOUNT_ARCHIVED', 409, /La cuenta está archivada/],
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
      await fireEvent.press(screen.getByText('Guardar'));
      expect(await screen.findByText(text)).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
      expect(api.createTransaction).toHaveBeenCalledTimes(1);
      // R2: solo ACCOUNT_ARCHIVED avisa al contenedor de que la cuenta está archivada.
      if (code === 'ACCOUNT_ARCHIVED') expect(onAccountArchived).toHaveBeenCalledWith('acc-1');
      else expect(onAccountArchived).not.toHaveBeenCalled();
      // El botón vuelve a estar disponible.
      expect(
        screen.getByRole('button', { name: 'Guardar' }).props.accessibilityState.disabled,
      ).toBe(false);
    },
  );

  it('tras CATEGORY_ARCHIVED recarga las categorías y limpia la selección', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    const before = api.listCategories.mock.calls.length;
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/categoría está archivada/);
    await waitFor(() => expect(api.listCategories.mock.calls.length).toBe(before + 1));
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('Elige una categoría.')).toBeTruthy();
  });

  it('error de red no cierra el formulario', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new AuthError('network')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('error al cargar categorías con Reintentar; sin categorías muestra aviso', async () => {
    const { AuthError } = jest.requireActual('../lib/auth-types');
    const listCategories = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf([]));
    await renderForm(makeApi({ listCategories }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText(/No hay categorías activas de este tipo/)).toBeTruthy();
  });

  it('Cancelar vuelve sin llamar a la API', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(onDone).toHaveBeenCalledWith(false); // R2: sin cambio, no se relee el saldo
    expect(api.createTransaction).not.toHaveBeenCalled();
    expect(screen.queryByText('Anular movimiento')).toBeNull();
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

  it('precarga, deja tipo y categoría de solo lectura y no recarga por tipo', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    expect(screen.getByText('Editar movimiento')).toBeTruthy();
    expect(screen.getByLabelText('Monto').props.value).toBe('12.50');
    expect(screen.getByLabelText('Fecha').props.value).toBe('2026-10-10');
    expect(screen.getByLabelText('Nota').props.value).toBe('original');
    expect(screen.queryByRole('radio', { name: 'Ingreso' })).toBeNull();
    expect(await screen.findByLabelText('Categoría')).toHaveTextContent('Comida');
    expect(screen.queryByLabelText('Categoría Bus')).toBeNull();
  });

  it('envía solo los campos modificados', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Monto', '20');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(api.updateTransaction).toHaveBeenCalledWith('tok', 'tx-9', { monto: 2000 });
  });

  it('modifica fecha y nota; nota vacía envía null', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Fecha', '2026-10-11');
    await typeInto('Nota', '   ');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.updateTransaction).toHaveBeenCalledWith('tok', 'tx-9', {
      fecha: '2026-10-11',
      nota: null,
    });
  });

  it('sin cambios no llama a la API y vuelve', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Guardar'));
    expect(api.updateTransaction).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false); // R2: editar sin cambios no relee el saldo
  });

  it('valida monto y fecha también al editar', async () => {
    const api = makeApi();
    await renderForm(api, tx);
    await typeInto('Monto', '0');
    await typeInto('Fecha', '2026-02-31');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/monto mayor a cero/)).toBeTruthy();
    expect(screen.getByText(/fecha válida/)).toBeTruthy();
    expect(api.updateTransaction).not.toHaveBeenCalled();
  });

  it('movimiento anulado (409) y no encontrado (404) se explican en español', async () => {
    const voided = makeApi({
      updateTransaction: jest
        .fn()
        .mockRejectedValue(new ApiRequestError(409, 'TRANSACTION_VOIDED')),
    });
    await renderForm(voided, tx);
    await typeInto('Monto', '20');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/ya fue anulado/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('404 al guardar se explica en español', async () => {
    const api = makeApi({
      updateTransaction: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
    });
    await renderForm(api, tx);
    await typeInto('Monto', '20');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/ya no existe/)).toBeTruthy();
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

  it('anular confirmado llama a deleteTransaction y vuelve', async () => {
    confirmWith('Anular');
    const api = makeApi();
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Anular movimiento'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true);
    expect(api.deleteTransaction).toHaveBeenCalledWith('tok', 'tx-9');
  });

  it('anular con 404 se trata como ya anulado', async () => {
    confirmWith('Anular');
    const api = makeApi({
      deleteTransaction: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
    });
    await renderForm(api, tx);
    await fireEvent.press(screen.getByText('Anular movimiento'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith(true); // «ya anulado» cuenta como cambio
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

describe('TransactionFormScreen: R2 (Atrás mientras guarda y cuenta archivada)', () => {
  it('mientras guarda, Atrás se ignora; al terminar se retira el listener', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    let removed = 0;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, handler) => {
      handlers.push(handler as () => boolean);
      return { remove: () => (removed += 1) };
    });
    const gate = controlledPromise<ReturnType<typeof transaction>>();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise) });
    await renderForm(api);
    expect(handlers).toHaveLength(0);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!()).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => gate.resolve(transaction()));
    expect(removed).toBe(1);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('409 ACCOUNT_ARCHIVED: avisa con el id de la cuenta y no cierra', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await typeInto('Monto', '5');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/La cuenta está archivada/)).toBeTruthy();
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
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/La cuenta está archivada/);
    expect(onAccountArchived).not.toHaveBeenCalled();
  });
});
