// Selector de ícono de categoría (R51-12 a R51-17, docs/007 §5.13 D) en la pantalla Categorías.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CATEGORY_ICON_OPTIONS } from '../lib/category-appearance';
import { account, category, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { chooseIcon, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import CategoriesScreen from './CategoriesScreen';
import { iconColumns } from './icon-picker-sheet';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle &
    TextStyle;
const items = [
  category({ id: 'c-food', nombre: 'Comida', icono: 'utensils', color: '#E53935' }),
  category({ id: 'c-old', nombre: 'Antigua', icono: 'icono-viejo', color: '#43A047' }),
];

function makeApi(overrides = {}) {
  return fakeResourcesApi({
    listCategories: jest.fn(async () => pageOf(items)),
    createCategory: jest.fn(async (_t, accountId, input) =>
      category({ id: 'new', accountId, nombre: input.nombre, tipo: input.tipo }),
    ),
    updateCategory: jest.fn(async (_t, id) => category({ id })),
    ...overrides,
  });
}
const renderScreen = (api = makeApi()) =>
  render(<CategoriesScreen account={account()} api={api} />);
const openCreate = async () => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
};
const openEdit = async (name: string) => {
  await fireEvent.press(await screen.findByRole('button', { name: `Acciones de ${name}` }));
  await fireEvent.press(screen.getByRole('button', { name: `Editar ${name}` }));
};
const pickIcon = (name: string) => chooseIcon(name, screen);
const iconRow = () => screen.getByRole('button', { name: /^Ícono .*, cambiar$/ });

beforeEach(() => {
  mockWindow(360, 1);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('selector de ícono: fila y hoja (R51-13, R5.1b)', () => {
  it('el formulario muestra una sola fila «Ícono» y ninguna rejilla; sin elegir al crear', async () => {
    await renderScreen();
    await openCreate();
    expect(screen.getByText('Ícono')).toBeTruthy();
    expect(screen.queryByTestId('icon-grid')).toBeNull();
    expect(screen.queryAllByRole('radio', { name: /^Ícono / })).toHaveLength(0);
    expect(iconRow().props.accessibilityLabel).toBe('Ícono predeterminado, cambiar');
    expect(screen.getByText('Ícono: sin elegir (se usa la etiqueta)')).toBeTruthy();
    expect(flat(iconRow()).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('elegir uno actualiza la fila y la vista previa; elegir otro lo reemplaza', async () => {
    await renderScreen();
    await openCreate();
    await pickIcon('Café');
    expect(iconRow().props.accessibilityLabel).toBe('Ícono Café, cambiar');
    expect(screen.getByText('Ícono: Café')).toBeTruthy();
    await pickIcon('Auto');
    expect(screen.getByText('Ícono: Auto')).toBeTruthy();
    expect(screen.queryByText('Ícono: Café')).toBeNull();
  });

  it.each([
    [320, 1, 5],
    [360, 1, 5],
    [412, 1, 6],
    [360, 2, 4],
  ])('columnas de la hoja a %s dp con fuente %s = %s', async (width, fontScale, expected) => {
    mockWindow(width, fontScale);
    await renderScreen();
    await openCreate();
    await fireEvent.press(iconRow());
    const cell = flat(screen.getAllByRole('radio', { name: /^Ícono / })[0]!).width as number;
    const available = width - 48;
    expect(iconColumns(available, fontScale)).toBe(expected);
    expect(cell).toBe(Math.floor((available - 8 * (expected - 1)) / expected));
  });

  it('iconColumns acota entre 4 y 6', () => {
    expect(iconColumns(100, 1)).toBe(4);
    expect(iconColumns(272, 1)).toBe(5);
    expect(iconColumns(900, 1)).toBe(6);
  });
});

describe('crear con ícono (R51-14)', () => {
  it('sin elegir ícono no se envía `icono`', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openCreate();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Gym');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    expect(api.createCategory.mock.calls[0]![2]).toEqual({ nombre: 'Gym', tipo: 'egreso' });
  });

  it('elegir ícono y color envía su slug y la vista previa los refleja', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openCreate();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Gym');
    await pickIcon('Deporte');
    await fireEvent.press(screen.getByRole('radio', { name: 'Color Azul' }));
    const previews = screen.getAllByTestId('category-icon', { includeHiddenElements: true });
    const preview = previews[0]!;
    expect(
      within(preview).getByText(CATEGORY_ICON_OPTIONS.find((o) => o.slug === 'dumbbell')!.glyph, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.createCategory.mock.calls[0]![2]).toEqual({
      nombre: 'Gym',
      tipo: 'egreso',
      color: '#1E88E5',
      icono: 'dumbbell',
    });
  });

  it('sin ícono la vista previa muestra 🏷️', async () => {
    await renderScreen();
    await openCreate();
    const previews = screen.getAllByTestId('category-icon', { includeHiddenElements: true });
    expect(within(previews[0]!).getByText('🏷️', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('editar (R51-15, R51-16, R51-17)', () => {
  it('R51-15: un ícono del catálogo llega preseleccionado', async () => {
    await renderScreen();
    await openEdit('Comida');
    expect(iconRow().props.accessibilityLabel).toBe('Ícono Comida, cambiar');
    expect(screen.getByText('Ícono: Comida')).toBeTruthy();
    await fireEvent.press(iconRow());
    const selected = screen
      .getAllByRole('radio', { name: /^Ícono / })
      .filter((r) => r.props.accessibilityState.selected);
    expect(selected.map((r) => r.props.accessibilityLabel)).toEqual(['Ícono Comida']);
  });

  it('R51-15: un slug fuera del catálogo queda sin selección, vista previa 🏷️ y sin envío', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openEdit('Antigua');
    expect(iconRow().props.accessibilityLabel).toBe('Ícono predeterminado, cambiar');
    expect(screen.getByText('Ícono: sin elegir (se usa la etiqueta)')).toBeTruthy();
    const previews = screen.getAllByTestId('category-icon', { includeHiddenElements: true });
    expect(within(previews[0]!).getByText('🏷️', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Antigua 2');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.updateCategory.mock.calls[0]![2]).toEqual({ nombre: 'Antigua 2' });
  });

  it('R51-16: sin tocar el ícono no se incluye `icono`; cambiarlo lo incluye', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openEdit('Comida');
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comidas');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.updateCategory.mock.calls[0]![2]).toEqual({ nombre: 'Comidas' });
  });

  it('R51-16: elegir otro ícono envía solo el slug nuevo', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openEdit('Comida');
    await pickIcon('Café');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.updateCategory.mock.calls[0]![2]).toEqual({ icono: 'coffee' });
  });

  it('R51-16: el ícono actual no se puede «usar» otra vez (PATCH vacío como hoy)', async () => {
    const api = makeApi();
    await renderScreen(api);
    await openEdit('Comida');
    await fireEvent.press(iconRow());
    expect(
      screen.getByRole('button', { name: 'Usar este ícono' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(
      within(screen.getByTestId('icon-picker-footer')).getByRole('button', { name: 'Cancelar' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await act(async () => undefined);
    expect(api.updateCategory.mock.calls[0]![2]).toEqual({});
  });

  it('R51-17: cambiar solo el ícono ensucia el formulario; volver al inicial lo limpia', async () => {
    await renderScreen();
    await openEdit('Comida');
    await pickIcon('Café');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[0]![0]).toBe('¿Descartar los cambios?');
    (Alert.alert as jest.Mock).mockClear();
    await pickIcon('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(screen.queryByRole('header', { name: 'Editar categoría' })).toBeNull();
  });

  it('al crear, elegir un ícono cuenta para el descarte', async () => {
    await renderScreen();
    await openCreate();
    await pickIcon('Café');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect((Alert.alert as jest.Mock).mock.calls[0]![0]).toBe('¿Descartar esta categoría?');
  });
});
