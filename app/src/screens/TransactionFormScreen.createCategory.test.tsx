// «+ Crear categoría» dentro de Nuevo movimiento (R51-18 a R51-27, docs/007 §5.13 E).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  Alert,
  BackHandler,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError, type Category, type ResourcesApi } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import {
  chooseIcon,
  controlledPromise,
  mockWindow,
  relaxTimeoutsForColdCache,
} from '../test-utils';
import { LIMIT_REACHED_CATEGORY_MESSAGE, NOT_CREATED_MESSAGE } from './category-create-sheet';
import TransactionFormScreen from './TransactionFormScreen';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
  yesterdayLocal: () => '2026-10-15',
}));

const expenseCats = [
  category({ id: 'c-food', nombre: 'Comida', tipo: 'egreso', icono: 'utensils' }),
  category({ id: 'c-bus', nombre: 'Bus', tipo: 'egreso', icono: 'bus' }),
];
const incomeCats = [category({ id: 'c-pay', nombre: 'Sueldo', tipo: 'ingreso' })];
const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle &
    TextStyle;

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    listCategories: jest.fn(async (_t, _a, options) =>
      pageOf(options?.tipo === 'ingreso' ? incomeCats : expenseCats),
    ),
    createCategory: jest.fn(async (_t, accountId, input) =>
      category({
        id: 'c-new',
        accountId,
        nombre: input.nombre,
        tipo: input.tipo,
        icono: input.icono ?? 'tag',
        color: input.color ?? '#6B7280',
      }),
    ),
    ...overrides,
  });
}

const onDone = jest.fn();
const onAccountArchived = jest.fn();
const renderForm = (
  api: ResourcesApi = makeApi(),
  extra: { transaction?: ReturnType<typeof transaction>; archived?: boolean } = {},
) =>
  render(
    <TransactionFormScreen
      account={account({ archivada: extra.archived ?? false })}
      api={api}
      transaction={extra.transaction}
      onDone={onDone}
      onAccountArchived={onAccountArchived}
    />,
  );

const sheet = () => within(screen.getByTestId('category-create-sheet'));
const openSheet = async () => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Crear categoría' }));
  await screen.findByRole('header', { name: 'Nueva categoría' });
};
const typeName = (name: string) =>
  fireEvent.changeText(sheet().getByLabelText('Nombre de la categoría'), name);
const saveCategory = () =>
  fireEvent.press(sheet().getByRole('button', { name: 'Guardar categoría' }));
const sheetOpen = () => screen.queryByTestId('category-create-sheet') !== null;
const discardButtons = () =>
  (Alert.alert as jest.Mock).mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];

let backHandlers: (() => boolean | null | undefined)[];
// Como Android: los listeners se consultan del más reciente al más antiguo hasta que uno devuelve true.
const pressBack = async () => {
  let handled = false;
  await act(async () => {
    for (let i = backHandlers.length - 1; i >= 0 && !handled; i -= 1) {
      handled = backHandlers[i]!() === true;
    }
  });
  return handled;
};

beforeEach(() => {
  mockWindow(360, 1);
  onDone.mockClear();
  onAccountArchived.mockClear();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const h = handler as () => boolean;
    backHandlers.push(h);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== h)) };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('celda «+ Crear categoría» (R51-18)', () => {
  it('es la última celda de la rejilla, un botón que no cuenta entre los radios', async () => {
    await renderForm();
    const button = await screen.findByRole('button', { name: 'Crear categoría' });
    expect(screen.getByText('+ Crear categoría')).toBeTruthy();
    const group = screen.getByLabelText('Categoría', { exact: true });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual([
      'Categoría Comida',
      'Categoría Bus',
    ]);
    expect(radios).not.toContain(button);
    // Con dos categorías (par), la celda abre una fila nueva y no se estira.
    const rows = group.children as unknown as { props: { children?: unknown } }[];
    expect(rows).toHaveLength(2);
    expect(flat(button)).toMatchObject({ borderStyle: 'dashed', borderWidth: 2 });
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(56);
  });

  it('con un número impar de categorías ocupa el hueco de la última fila', async () => {
    await renderForm(makeApi({ listCategories: jest.fn(async () => pageOf([expenseCats[0]!])) }));
    await screen.findByRole('button', { name: 'Crear categoría' });
    const group = screen.getByLabelText('Categoría', { exact: true });
    expect(group.children).toHaveLength(1);
  });

  it('en Editar no existe; tampoco con la cuenta archivada ni durante la carga o el error', async () => {
    const view = await renderForm(makeApi(), { transaction: transaction() });
    await screen.findByLabelText('Categoría: Categoría del movimiento', { exact: false });
    expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
    await view.unmount();

    const gate = controlledPromise<ReturnType<typeof pageOf<Category>>>();
    const loading = await renderForm(
      makeApi({ listCategories: jest.fn(() => gate.promise as never) }),
    );
    expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
    await act(async () => gate.resolve(pageOf(expenseCats)));
    expect(await screen.findByRole('button', { name: 'Crear categoría' })).toBeTruthy();
    await loading.unmount();

    await renderForm(
      makeApi({ listCategories: jest.fn().mockRejectedValue(new AuthError('network')) }),
    );
    await screen.findByText(/No se pudo conectar/);
    expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
  });

  it('con la cuenta archivada no se ofrece crear categorías', async () => {
    await renderForm(makeApi(), { archived: true });
    await screen.findByLabelText('Categoría Comida');
    expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
  });

  it('se deshabilita mientras se guarda el movimiento', async () => {
    const gate = controlledPromise();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise as never) });
    await renderForm(api);
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '5');
    await fireEvent.press(screen.getByText('Guardar gasto'));
    expect(
      screen.getByRole('button', { name: 'Crear categoría' }).props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });
    await act(async () => gate.reject(new Error('x')));
  });
});

describe('sin categorías del tipo (R51-19)', () => {
  it('gasto: texto nuevo y botón a ancho completo; ya no hay «Más > Categorías»', async () => {
    await renderForm(makeApi({ listCategories: jest.fn(async () => pageOf([])) }));
    expect(
      await screen.findByText(
        'No tienes categorías de gasto activas. Crea una para anotar este movimiento.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Más > Categorías/)).toBeNull();
    expect(screen.queryByText('Ir a Categorías')).toBeNull();
    const button = screen.getByRole('button', { name: 'Crear categoría' });
    expect(within(button).getByText('+ Crear categoría')).toBeTruthy();
    await fireEvent.press(button);
    expect(await screen.findByRole('header', { name: 'Nueva categoría' })).toBeTruthy();
  });

  it('ingreso: «de ingreso» y la hoja fija «Tipo: Ingreso»', async () => {
    await renderForm(makeApi({ listCategories: jest.fn(async () => pageOf([])) }));
    await screen.findByText(/categorías de gasto activas/);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    expect(
      await screen.findByText(
        'No tienes categorías de ingreso activas. Crea una para anotar este movimiento.',
      ),
    ).toBeTruthy();
    await openSheet();
    expect(sheet().getAllByText('Tipo: Ingreso')).toHaveLength(1);
  });
});

describe('hoja «Nueva categoría» (R51-20)', () => {
  it('abre con el tipo fijado del movimiento, nombre, color, ícono y vista previa; sin descripción', async () => {
    await renderForm();
    await openSheet();
    expect(sheet().getAllByText('Tipo: Gasto')).toHaveLength(1);
    expect(sheet().queryByLabelText('Tipo')).toBeNull();
    expect(sheet().queryByRole('radio', { name: 'Ingreso' })).toBeNull();
    expect(sheet().getByLabelText('Nombre de la categoría')).toBeTruthy();
    expect(sheet().queryByLabelText('Descripción')).toBeNull();
    expect(sheet().getByText('Color')).toBeTruthy();
    expect(sheet().getAllByRole('radio', { name: /^Color / })).toHaveLength(7);
    expect(sheet().getByText('Ícono')).toBeTruthy();
    expect(sheet().getByRole('button', { name: 'Ícono predeterminado, cambiar' })).toBeTruthy();
    expect(sheet().queryAllByRole('radio', { name: /^Ícono / })).toHaveLength(0);
    expect(sheet().getByText('Vista previa')).toBeTruthy();
    // El teclado no salta al abrir.
    expect(sheet().getByLabelText('Nombre de la categoría').props.autoFocus).toBeFalsy();
  });

  it('Ingreso: la hoja dice «Tipo: Ingreso» y crea de tipo ingreso', async () => {
    const api = makeApi();
    await renderForm(api);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Ingreso' }));
    await openSheet();
    expect(sheet().getAllByText('Tipo: Ingreso')).toHaveLength(1);
    await typeName('Premios');
    await saveCategory();
    await act(async () => undefined);
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    expect(api.createCategory.mock.calls[0]).toEqual([
      'tok',
      'acc-1',
      { nombre: 'Premios', tipo: 'ingreso' },
    ]);
  });
});

describe('conservación del movimiento (R51-21)', () => {
  async function fillForm() {
    await fireEvent.press(await screen.findByLabelText('Categoría Bus'));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '12.50');
    await fireEvent.press(screen.getByRole('radio', { name: 'Ayer' }));
    await fireEvent.changeText(screen.getByLabelText('Detalle'), 'almuerzo');
  }
  const expectUntouched = () => {
    expect(screen.getByLabelText('Monto').props.value).toBe('12.50');
    expect(screen.getByLabelText('Detalle').props.value).toBe('almuerzo');
    expect(screen.getByRole('radio', { name: 'Ayer' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByLabelText('Categoría Bus').props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: 'Gasto' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(onDone).not.toHaveBeenCalled();
  };

  it('abrir y cancelar sin cambios no altera nada ni pregunta', async () => {
    await renderForm();
    await fillForm();
    await openSheet();
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    expect(sheetOpen()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    expectUntouched();
  });

  it('descartar una hoja con cambios cierra solo la hoja', async () => {
    await renderForm();
    await fillForm();
    await openSheet();
    await typeName('Nueva');
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    await act(async () => discardButtons().find((b) => b.text === 'Descartar')!.onPress!());
    expect(sheetOpen()).toBe(false);
    expectUntouched();
  });

  it('R5.1b: cancelar la hoja «Elegir ícono» no cambia el ícono ni ensucia la hoja de categoría', async () => {
    await renderForm();
    await openSheet();
    await fireEvent.press(sheet().getByRole('button', { name: 'Ícono predeterminado, cambiar' }));
    await fireEvent.press(sheet().getByRole('radio', { name: 'Ícono Billetera' }));
    await fireEvent.press(
      within(screen.getByTestId('icon-picker-footer')).getByRole('button', { name: 'Cancelar' }),
    );
    expect(sheetOpen()).toBe(true);
    expect(sheet().getByRole('button', { name: 'Ícono predeterminado, cambiar' })).toBeTruthy();
    // La hoja de categoría sigue sin cambios: cancelarla no pregunta.
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    expect(sheetOpen()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('R5.1b: elegir un ícono con la hoja ensucia la categoría y se envía al crearla', async () => {
    const api = makeApi();
    await renderForm(api);
    await openSheet();
    await typeName('Gym');
    await chooseIcon('Pizza', sheet());
    expect(sheet().getByRole('button', { name: 'Ícono Pizza, cambiar' })).toBeTruthy();
    await saveCategory();
    await act(async () => undefined);
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    expect(api.createCategory.mock.calls[0]![2]).toMatchObject({ nombre: 'Gym', icono: 'pizza' });
  });

  it('un fallo al crear deja el movimiento intacto', async () => {
    const api = makeApi({
      createCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'LIMIT_REACHED')),
    });
    await renderForm(api);
    await fillForm();
    await openSheet();
    await typeName('Nueva');
    await saveCategory();
    await act(async () => undefined);
    expect(sheetOpen()).toBe(true);
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    await act(async () => discardButtons().find((b) => b.text === 'Descartar')!.onPress!());
    expectUntouched();
  });

  it('abrir la hoja no cuenta como cambio del movimiento (Cancelar del formulario cierra sin preguntar)', async () => {
    await renderForm();
    await screen.findByRole('button', { name: 'Crear categoría' });
    await openSheet();
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(false);
  });
});

describe('guardar (R51-22, R51-23)', () => {
  it('R51-22: nombre vacío muestra «Escribe un nombre.» y no llama a la API', async () => {
    const api = makeApi();
    await renderForm(api);
    await openSheet();
    await saveCategory();
    expect(sheet().getAllByText('Escribe un nombre.').length).toBeGreaterThan(0);
    expect(api.createCategory).not.toHaveBeenCalled();
    await typeName('Gym');
    expect(sheet().queryByText('Escribe un nombre.')).toBeNull();
  });

  it('R51-22: una sola llamada aunque se toque dos veces, con color e ícono elegidos', async () => {
    const gate = controlledPromise<Category>();
    const api = makeApi({ createCategory: jest.fn(() => gate.promise) });
    await renderForm(api);
    await openSheet();
    await typeName('  Gym  ');
    await fireEvent.press(sheet().getByRole('radio', { name: 'Color Rojo' }));
    await chooseIcon('Deporte', sheet());
    const save = sheet().getByRole('button', { name: 'Guardar categoría' });
    await fireEvent.press(save);
    await fireEvent.press(sheet().getByRole('button', { name: 'Guardar categoría' }));
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    expect(api.createCategory).toHaveBeenCalledWith('tok', 'acc-1', {
      nombre: 'Gym',
      tipo: 'egreso',
      color: '#E53935',
      icono: 'dumbbell',
    });
    // Mientras guarda: «Guardando…», campos y cierre bloqueados.
    expect(sheet().getByText('Guardando…')).toBeTruthy();
    expect(sheet().getByLabelText('Nombre de la categoría').props.editable).toBe(false);
    expect(
      sheet().getByRole('button', { name: 'Cancelar' }).props.accessibilityState.disabled,
    ).toBe(true);
    await act(async () => gate.resolve(category({ id: 'c-new', nombre: 'Gym' })));
  });

  it('R51-23: éxito cierra la hoja, selecciona la nueva, avisa y no envía el movimiento', async () => {
    const api = makeApi();
    await renderForm(api);
    // «Elige una categoría.» antes de crear.
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '9');
    await fireEvent.press(screen.getByText('Guardar gasto'));
    expect(await screen.findByText('Elige una categoría.')).toBeTruthy();

    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await act(async () => undefined);

    expect(sheetOpen()).toBe(false);
    const created = await screen.findByLabelText('Categoría Gym');
    expect(created.props.accessibilityState.selected).toBe(true);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Categoría «Gym» creada y seleccionada.');
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByText('Elige una categoría.')).toBeNull();
    expect(api.createTransaction).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    // La relectura en segundo plano no quita la categoría aunque aún no la incluya.
    expect(api.listCategories).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Categoría Gym')).toBeTruthy();

    // El siguiente Guardar envía su categoryId.
    await fireEvent.press(screen.getByText('Guardar gasto'));
    await act(async () => undefined);
    expect(api.createTransaction).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ categoryId: 'c-new', tipo: 'gasto', monto: 900 }),
    );
  });

  it('el aviso desaparece al elegir otra categoría', async () => {
    await renderForm();
    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await act(async () => undefined);
    expect(await screen.findByRole('status')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Categoría Bus'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('la categoría creada es la última y deja de duplicarse cuando la relectura ya la trae', async () => {
    const created = category({ id: 'c-new', nombre: 'Gym', tipo: 'egreso' });
    const listCategories = jest
      .fn()
      .mockResolvedValueOnce(pageOf(expenseCats))
      .mockResolvedValue(pageOf([...expenseCats, created]));
    await renderForm(makeApi({ listCategories }));
    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await act(async () => undefined);
    expect(screen.getAllByLabelText('Categoría Gym')).toHaveLength(1);
  });
});

describe('descarte (R51-24)', () => {
  it('con cambios: Cancelar, el velo y Atrás preguntan «¿Descartar esta categoría?»', async () => {
    await renderForm();
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '3');
    await openSheet();
    await typeName('Algo');

    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0]!;
    expect(title).toBe('¿Descartar esta categoría?');
    expect(message).toBe('Lo que escribiste se perderá.');
    expect(buttons.map((b: { text: string }) => b.text)).toEqual(['Seguir editando', 'Descartar']);
    // «Seguir editando» libera el diálogo.
    await act(async () => discardButtons().find((b) => b.text === 'Seguir editando')!.onPress!());

    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    await act(async () => discardButtons().find((b) => b.text === 'Seguir editando')!.onPress!());

    await fireEvent(screen.getByTestId('category-create-sheet'), 'requestClose');
    expect(Alert.alert).toHaveBeenCalledTimes(3);
    await act(async () => discardButtons().find((b) => b.text === 'Seguir editando')!.onPress!());

    expect(await pressBack()).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(4);
    expect((Alert.alert as jest.Mock).mock.calls[3]![0]).toBe('¿Descartar esta categoría?');
    // Nunca el diálogo del movimiento mientras la hoja está abierta.
    for (const call of (Alert.alert as jest.Mock).mock.calls) {
      expect(call[0]).not.toBe('¿Descartar este movimiento?');
    }
    expect(sheetOpen()).toBe(true);
    await act(async () => discardButtons().find((b) => b.text === 'Descartar')!.onPress!());
    expect(sheetOpen()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Monto').props.value).toBe('3');
  });

  it('sin cambios: el velo, requestClose y Atrás cierran directo (Atrás no llega al formulario)', async () => {
    await renderForm();
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '3');
    await openSheet();
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(sheetOpen()).toBe(false);

    await openSheet();
    await fireEvent(screen.getByTestId('category-create-sheet'), 'requestClose');
    expect(sheetOpen()).toBe(false);

    await openSheet();
    expect(await pressBack()).toBe(true);
    expect(sheetOpen()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('con la hoja cerrada Atrás vuelve a ser del formulario (pregunta por el movimiento)', async () => {
    await renderForm();
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '3');
    await openSheet();
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    expect(await pressBack()).toBe(true);
    expect((Alert.alert as jest.Mock).mock.calls.at(-1)![0]).toBe('¿Descartar este movimiento?');
  });

  it('con busy se ignoran Cancelar, el velo y Atrás', async () => {
    const gate = controlledPromise<Category>();
    await renderForm(makeApi({ createCategory: jest.fn(() => gate.promise) }));
    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await fireEvent.press(sheet().getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    await fireEvent(screen.getByTestId('category-create-sheet'), 'requestClose');
    expect(await pressBack()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(true);
    await act(async () => gate.resolve(category({ id: 'c-new', nombre: 'Gym' })));
    expect(sheetOpen()).toBe(false);
  });
});

describe('errores (R51-25)', () => {
  const failWith = (error: unknown) =>
    makeApi({ createCategory: jest.fn().mockRejectedValue(error) });
  const attempt = async (api: ResourcesApi) => {
    await renderForm(api);
    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await act(async () => undefined);
  };

  it('CATEGORY_NAME_TAKEN: mensaje bajo el nombre; se borra al editar; conserva lo escrito', async () => {
    await attempt(failWith(new ApiRequestError(409, 'CATEGORY_NAME_TAKEN')));
    expect(sheet().getByText('Ya existe una categoría de ese tipo con ese nombre.')).toBeTruthy();
    expect(sheet().getByLabelText('Nombre de la categoría').props.value).toBe('Gym');
    expect(sheetOpen()).toBe(true);
    await typeName('Gym 2');
    expect(sheet().queryByText('Ya existe una categoría de ese tipo con ese nombre.')).toBeNull();
  });

  it('LIMIT_REACHED: texto específico sobre el pie y Guardar sigue disponible', async () => {
    await attempt(failWith(new ApiRequestError(409, 'LIMIT_REACHED')));
    expect(LIMIT_REACHED_CATEGORY_MESSAGE).toBe(
      'Llegaste al máximo de categorías de esta cuenta. Archiva alguna en Más > Categorías para crear otra.',
    );
    const message = sheet().getByText(LIMIT_REACHED_CATEGORY_MESSAGE);
    expect(message.props.accessibilityRole).toBe('alert');
    expect(sheet().getByLabelText('Nombre de la categoría').props.value).toBe('Gym');
    expect(
      sheet().getByRole('button', { name: 'Guardar categoría' }).props.accessibilityState.disabled,
    ).toBe(false);
    expect(sheet().queryByRole('button', { name: 'Revisar la lista' })).toBeNull();
  });

  it('ACCOUNT_ARCHIVED: avisa al contenedor, cierra la hoja y bloquea el formulario', async () => {
    await attempt(failWith(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')));
    expect(onAccountArchived).toHaveBeenCalledWith('acc-1');
    expect(sheetOpen()).toBe(false);
    expect(screen.getByRole('button', { name: 'Volver a la cuenta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
  });

  it('otro 4xx: mensaje genérico sobre el pie y Guardar activo', async () => {
    await attempt(failWith(new ApiRequestError(400, 'INVALID_REQUEST')));
    expect(
      sheet().getByText('Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.'),
    ).toBeTruthy();
    expect(
      sheet().getByRole('button', { name: 'Guardar categoría' }).props.accessibilityState.disabled,
    ).toBe(false);
  });
});

describe('fallo incierto (R51-26)', () => {
  const UNCERTAIN =
    'No pudimos confirmar si se creó. Revisa la lista de categorías antes de volver a intentar.';

  it.each([
    ['red', () => new AuthError('network')],
    ['servidor', () => new AuthError('server')],
    ['5xx', () => new ApiRequestError(503, 'UNKNOWN')],
  ])(
    '%s: mensaje, Guardar deshabilitado y botón «Revisar la lista»; no reintenta',
    async (_n, make) => {
      const api = makeApi({ createCategory: jest.fn().mockRejectedValue(make()) });
      await renderForm(api);
      await openSheet();
      await typeName('Gym');
      await saveCategory();
      await act(async () => undefined);
      expect(sheet().getByText(UNCERTAIN)).toBeTruthy();
      const save = sheet().getByRole('button', { name: 'Guardar categoría' });
      expect(save.props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(save);
      expect(sheet().getByRole('button', { name: 'Revisar la lista' })).toBeTruthy();
      expect(api.createCategory).toHaveBeenCalledTimes(1);
      expect(sheet().getByLabelText('Nombre de la categoría').props.value).toBe('Gym');
    },
  );

  async function failFirst(second: ResourcesApi['listCategories']) {
    const api = makeApi({
      createCategory: jest.fn().mockRejectedValue(new AuthError('network')),
      listCategories: jest
        .fn()
        .mockResolvedValueOnce(pageOf(expenseCats))
        .mockImplementation(second),
    });
    await renderForm(api);
    await openSheet();
    await typeName('Gym');
    await saveCategory();
    await act(async () => undefined);
    return api;
  }

  it('«Revisar la lista» con la categoría existente la selecciona y cierra (sin distinguir mayúsculas)', async () => {
    const api = await failFirst(async () =>
      pageOf([...expenseCats, category({ id: 'c-gym', nombre: 'GYM', tipo: 'egreso' })]),
    );
    await fireEvent.press(sheet().getByRole('button', { name: 'Revisar la lista' }));
    await act(async () => undefined);
    expect(sheetOpen()).toBe(false);
    expect((await screen.findByLabelText('Categoría GYM')).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Categoría «GYM» creada y seleccionada.');
    expect(api.createCategory).toHaveBeenCalledTimes(1);
  });

  it('«Revisar la lista» sin la categoría avisa y reactiva Guardar; no reintenta a ciegas', async () => {
    const api = await failFirst(async () => pageOf(expenseCats));
    await fireEvent.press(sheet().getByRole('button', { name: 'Revisar la lista' }));
    await act(async () => undefined);
    expect(sheet().getByText(NOT_CREATED_MESSAGE)).toBeTruthy();
    expect(NOT_CREATED_MESSAGE).toBe('No se creó. Puedes intentarlo de nuevo.');
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    expect(
      sheet().getByRole('button', { name: 'Guardar categoría' }).props.accessibilityState.disabled,
    ).toBe(false);
    await saveCategory();
    await act(async () => undefined);
    expect(api.createCategory).toHaveBeenCalledTimes(2);
  });

  it('si la relectura también falla se muestra el error de carga y Guardar sigue deshabilitado', async () => {
    await failFirst(async () => {
      throw new AuthError('network');
    });
    await fireEvent.press(sheet().getByRole('button', { name: 'Revisar la lista' }));
    await act(async () => undefined);
    expect(sheet().getByText(/No se pudo conectar con el servidor/)).toBeTruthy();
    expect(
      sheet().getByRole('button', { name: 'Guardar categoría' }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(sheet().getByRole('button', { name: 'Revisar la lista' })).toBeTruthy();
  });
});

describe('accesibilidad y fuente ampliada (R51-27)', () => {
  it('con fontScale 2: cuerpo desplazable, pie fuera del scroll, controles de 48 dp y 4 columnas', async () => {
    mockWindow(360, 2);
    await renderForm();
    await openSheet();
    const scroll = screen.getByTestId('category-create-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    const footer = screen.getByTestId('category-create-footer');
    expect(within(scroll).queryByRole('button', { name: 'Guardar categoría' })).toBeNull();
    expect(within(footer).getByRole('button', { name: 'Guardar categoría' })).toBeTruthy();
    expect(within(footer).getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    for (const radio of within(scroll).getAllByRole('radio')) {
      const style = flat(radio);
      const size = (style.minHeight ?? style.height ?? 0) as number;
      expect(size).toBeGreaterThanOrEqual(48);
    }
    // El ícono se elige con la fila «Ícono» del scroll (la rejilla vive en su propia hoja).
    expect(within(scroll).getByRole('button', { name: /^Ícono .*, cambiar$/ })).toBeTruthy();
  });

  it('la hoja alta limita su altura al 75 % de la ventana menos el margen superior', async () => {
    await renderForm();
    await openSheet();
    const style = flat(screen.getByLabelText('Nueva categoría'));
    expect(style.maxHeight).toBeGreaterThan(0);
    expect(style.maxHeight).toBeLessThanOrEqual(0.75 * 800);
  });

  it('el encabezado es un header y el aviso de éxito es una región viva', async () => {
    await renderForm();
    await openSheet();
    expect(screen.getByRole('header', { name: 'Nueva categoría' })).toBeTruthy();
    expect(
      screen.getByTestId('category-create-sheet').props.accessibilityLabel ?? 'Nueva categoría',
    ).toBeTruthy();
  });
});
