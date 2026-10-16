import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, BackHandler, StyleSheet } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { colors } from '../theme/tokens';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import CategoriesScreen, { CATEGORY_COLORS } from './CategoriesScreen';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const items = [
  category({ id: 'c-eg', nombre: 'Comida', tipo: 'egreso' }),
  category({
    id: 'c-in',
    nombre: 'Sueldo',
    tipo: 'ingreso',
    color: '#43A047',
    descripcion: 'Mensual',
  }),
];
const renderScreen = (
  api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) }),
  acc = account(),
) => render(<CategoriesScreen account={acc} api={api} />);

function confirmWith(label: string) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

// R4: cada fila tiene un solo «⋮» que abre la hoja con las acciones.
const openMenu = async (name: string) => {
  await fireEvent.press(await screen.findByRole('button', { name: `Acciones de ${name}` }));
};
const showIngresos = async () => {
  await fireEvent.press(await screen.findByRole('radio', { name: 'Ingresos' }));
};

beforeEach(() => {
  mockWindow(360, 1);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('CategoriesScreen: estados', () => {
  it('muestra «Cargando categorías…» y luego la lista del segmento Gastos por defecto (criterios 1 y 31)', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    await renderScreen(fakeResourcesApi({ listCategories: jest.fn(() => gate.promise as never) }));
    expect(screen.getByTestId('categories-loading')).toBeTruthy();
    expect(screen.getByText('Cargando categorías…')).toBeTruthy();
    await act(async () => gate.resolve(pageOf(items)));
    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(screen.queryByText('Sueldo')).toBeNull();
    expect(screen.getByRole('header', { name: 'Categorías' })).toBeTruthy();
    expect(screen.queryByText(/Categorías de/)).toBeNull();
    expect(screen.getByRole('radio', { name: 'Gastos' }).props.accessibilityState.selected).toBe(
      true,
    );
    await showIngresos();
    expect(screen.getByText('Sueldo')).toBeTruthy();
    expect(screen.getByText('Mensual')).toBeTruthy();
    expect(screen.queryByText('Comida')).toBeNull();
    expect(screen.queryByText('Egresos')).toBeNull();
    expect(screen.queryByText(/egreso/i)).toBeNull();
  });

  it('un tipo sin categorías muestra el texto de vacío con su siguiente paso (criterio 31)', async () => {
    await renderScreen(
      fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([items[0]!])) }),
    );
    await screen.findByText('Comida');
    await showIngresos();
    expect(
      await screen.findByText('Aún no tienes categorías de ingreso. Crea la primera.'),
    ).toBeTruthy();
  });

  it('sin ninguna categoría muestra el vacío del tipo activo', async () => {
    await renderScreen(fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([])) }));
    expect(
      await screen.findByText('Aún no tienes categorías de gasto. Crea la primera.'),
    ).toBeTruthy();
  });

  it('con la cuenta archivada el vacío no invita a crear', async () => {
    await renderScreen(
      fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([])) }),
      account({ archivada: true }),
    );
    expect(await screen.findByText('Aún no tienes categorías de gasto.')).toBeTruthy();
  });

  it('error con Reintentar', async () => {
    const listCategories = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf(items));
    await renderScreen(fakeResourcesApi({ listCategories }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('Comida')).toBeTruthy();
  });

  it('404 al cargar se traduce a español', async () => {
    await renderScreen(
      fakeResourcesApi({
        listCategories: jest.fn().mockRejectedValue(new ApiRequestError(404, 'NOT_FOUND')),
      }),
    );
    expect(await screen.findByText(/El elemento ya no existe/)).toBeTruthy();
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderScreen(
      fakeResourcesApi({ listCategories: jest.fn(() => gate.promise as never) }),
    );
    await view.unmount();
    await act(async () => gate.resolve(pageOf(items)));
    expect(errors).not.toHaveBeenCalled();
  });

  it('consulta la cuenta indicada y alterna archivadas', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    expect(api.listCategories).toHaveBeenLastCalledWith('tok', 'acc-1', {
      pageSize: 100,
      incluirArchivadas: false,
    });
    await fireEvent(screen.getByLabelText('Mostrar archivadas'), 'valueChange', true);
    await waitFor(() =>
      expect(api.listCategories).toHaveBeenLastCalledWith('tok', 'acc-1', {
        pageSize: 100,
        incluirArchivadas: true,
      }),
    );
  });

  it('en una cuenta archivada no ofrece crear categorías', async () => {
    await renderScreen(undefined, account({ archivada: true }));
    await screen.findByText('Comida');
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).toBeNull();
    expect(screen.getByText(/Cuenta archivada/)).toBeTruthy();
  });

  it('cambiar account.id sin remontar no deja categorías de la cuenta anterior (criterio 39)', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    const listCategories = jest
      .fn()
      .mockResolvedValueOnce(pageOf(items))
      .mockReturnValueOnce(gate.promise as never);
    const api = fakeResourcesApi({ listCategories });
    const view = await renderScreen(api);
    await screen.findByText('Comida');
    await view.rerender(<CategoriesScreen account={account({ id: 'acc-2' })} api={api} />);
    expect(screen.queryByText('Comida')).toBeNull();
    expect(screen.getByTestId('categories-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageOf([category({ id: 'x', nombre: 'Otra' })])));
    expect(await screen.findByText('Otra')).toBeTruthy();
  });
});

describe('CategoriesScreen: fila y menú «⋮» (criterios 32 y 33)', () => {
  const withArchived = () =>
    fakeResourcesApi({
      listCategories: jest.fn(async () =>
        pageOf([
          category({
            id: 'c-long',
            nombre: 'Una categoría con un nombre largo que ocupa varias líneas en pantalla',
            descripcion: 'Descripción visible',
          }),
          category({ id: 'c-old', nombre: 'Viejo', archivada: true }),
        ]),
      ),
    });

  it('muestra ícono de 40 dp, nombre completo sin límite de líneas, descripción e insignia «Archivada»', async () => {
    await renderScreen(withArchived());
    const name = await screen.findByText(/Una categoría con un nombre largo/);
    expect(name.props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Descripción visible')).toBeTruthy();
    const icons = screen.getAllByTestId('category-icon', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icons[0]!.props.style)).toMatchObject({ width: 40, height: 40 });
    // La archivada: texto «Archivada» (no solo opacidad), fondo archivedRow e ícono atenuado.
    expect(screen.getByText('Archivada')).toBeTruthy();
    expect(StyleSheet.flatten(icons[1]!.props.style).opacity).toBe(0.5);
    expect(
      StyleSheet.flatten(screen.getByTestId('category-row-c-old').props.style).backgroundColor,
    ).toBe(colors.archivedRow);
  });

  it('«⋮» tiene 48 × 48 dp y la etiqueta «Acciones de {nombre}»', async () => {
    await renderScreen(withArchived());
    const more = await screen.findByRole('button', { name: 'Acciones de Viejo' });
    expect(StyleSheet.flatten(more.props.style)).toMatchObject({ width: 48, height: 48 });
  });

  it('la hoja trae Editar, Archivar/Desarchivar y Eliminar en ese orden, con Eliminar en danger', async () => {
    await renderScreen();
    await openMenu('Comida');
    expect(screen.getByRole('header', { name: 'Comida' })).toBeTruthy();
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel)
      .filter((l: string) => /^(Editar|Archivar|Eliminar) Comida$/.test(l));
    expect(labels).toEqual(['Editar Comida', 'Archivar Comida', 'Eliminar Comida']);
    const remove = screen.getByRole('button', { name: 'Eliminar Comida' });
    expect(StyleSheet.flatten(remove.props.style)).toMatchObject({
      borderColor: colors.expense,
      backgroundColor: colors.surface,
    });
    for (const name of ['Editar Comida', 'Archivar Comida']) {
      expect(StyleSheet.flatten(screen.getByRole('button', { name }).props.style)).toMatchObject({
        minHeight: 48,
        borderColor: colors.brand700,
      });
    }
  });

  it('la hoja de una archivada ofrece «Desarchivar»', async () => {
    await renderScreen(withArchived());
    await openMenu('Viejo');
    expect(screen.getByRole('button', { name: 'Desarchivar Viejo' })).toBeTruthy();
  });

  it('Atrás (onRequestClose) y «Cerrar» cierran la hoja', async () => {
    await renderScreen();
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('header', { name: 'Comida' })).toBeNull();
    await openMenu('Comida');
    await fireEvent(screen.getByTestId('category-menu'), 'requestClose');
    expect(screen.queryByRole('header', { name: 'Comida' })).toBeNull();
  });
});

describe('CategoriesScreen: acciones', () => {
  it('crea una categoría con tipo y color de la paleta, con el tipo del segmento activo', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await showIngresos();
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    // El tipo parte del segmento activo.
    expect(screen.getByRole('radio', { name: 'Ingreso' }).props.accessibilityState.selected).toBe(
      true,
    );
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), ' Extras ');
    await fireEvent.press(screen.getByLabelText('Color Azul'));
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith('tok', 'acc-1', {
        nombre: 'Extras',
        tipo: 'ingreso',
        color: '#1E88E5',
      }),
    );
    await waitFor(() => expect(api.listCategories).toHaveBeenCalledTimes(2));
  });

  it('el tipo se puede cambiar al crear y el valor interno sigue siendo egreso/ingreso', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith('tok', 'acc-1', {
        nombre: 'Ocio',
        tipo: 'egreso',
      }),
    );
  });

  it('exige un nombre y no llama a la API', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.press(screen.getByText('Guardar'));
    expect(screen.getByText('Escribe un nombre.')).toBeTruthy();
    expect(api.createCategory).not.toHaveBeenCalled();
  });

  it('409 por nombre repetido se muestra en español y conserva el formulario', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      createCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_NAME_TAKEN')),
    });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comida');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/Ya existe una categoría de ese tipo/)).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la categoría')).toBeTruthy();
  });

  it('LIMIT_REACHED conserva su mensaje actual', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      createCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'LIMIT_REACHED')),
    });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Otra');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la categoría')).toBeTruthy();
  });

  it('editar envía solo los campos modificados (descripción vacía -> null) y muestra el tipo fijo', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await showIngresos();
    await openMenu('Sueldo');
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Sueldo' }));
    expect(screen.getByLabelText('Nombre de la categoría').props.value).toBe('Sueldo');
    expect(screen.queryByRole('radio', { name: 'Ingreso' })).toBeNull(); // el tipo es inmutable
    expect(screen.getByText('Tipo: Ingreso (no se puede cambiar)')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Editar categoría' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Descripción'), '');
    await fireEvent.press(screen.getByLabelText('Color Rojo'));
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-in', {
        descripcion: null,
        color: '#E53935',
      }),
    );
  });

  it('archiva y desarchiva desde la hoja sin confirmación', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () =>
        pageOf([items[0]!, category({ id: 'c-old', nombre: 'Viejo', archivada: true })]),
      ),
    });
    await renderScreen(api);
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar Comida' }));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-eg', { archivada: true }),
    );
    await openMenu('Viejo');
    await fireEvent.press(screen.getByRole('button', { name: 'Desarchivar Viejo' }));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-old', { archivada: false }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación con el aviso de irreversibilidad (criterio 35)', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Comida' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Eliminar categoría',
      '¿Eliminar «Comida»? Esta acción no se puede deshacer.',
      expect.any(Array),
    );
    expect(api.deleteCategory).not.toHaveBeenCalled();
  });

  it('eliminar confirmado llama a la API y recarga', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    confirmWith('Eliminar');
    await renderScreen(api);
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Comida' }));
    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('tok', 'c-eg'));
    await waitFor(() => expect(api.listCategories).toHaveBeenCalledTimes(2));
  });

  it('CATEGORY_IN_USE muestra el aviso con [Archivar «nombre»], que archiva (criterio 35)', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      deleteCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_IN_USE')),
    });
    confirmWith('Eliminar');
    await renderScreen(api);
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Comida' }));
    expect(
      await screen.findByText(
        'Esta categoría tiene movimientos, por eso no se puede eliminar. Puedes archivarla: no aparecerá al anotar movimientos nuevos, pero tu historial se conserva.',
      ),
    ).toBeTruthy();
    // El mensaje corto de resources-messages no se duplica.
    expect(screen.queryByText(/no puede eliminarse/)).toBeNull();
    expect(screen.getByText('Comida')).toBeTruthy();
    const archive = screen.getByRole('button', { name: 'Archivar «Comida»' });
    expect(StyleSheet.flatten(archive.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(archive);
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-eg', { archivada: true }),
    );
    await waitFor(() => expect(screen.queryByText(/por eso no se puede eliminar/)).toBeNull());
  });

  it('deshabilita «⋮» durante una mutación', async () => {
    const gate = controlledPromise<void>();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      deleteCategory: jest.fn(() => gate.promise),
    });
    confirmWith('Eliminar');
    await renderScreen(api);
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar Comida' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Acciones de Comida' }).props.accessibilityState
          .disabled,
      ).toBe(true),
    );
    expect(api.deleteCategory).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Acciones de Comida' }).props.accessibilityState
          .disabled,
      ).toBe(false),
    );
  });
});

describe('CategoriesScreen: formulario (criterios 34 y 36)', () => {
  const open = async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    return api;
  };

  it('siete colores de 76 dp de ancho y 72 dp de alto mínimo, «✓» y texto «Color: …» al elegir; el valor enviado no cambia', async () => {
    await open();
    expect(screen.getByText('Color: sin elegir (se asigna uno por defecto)')).toBeTruthy();
    const options = screen.getAllByRole('radio', { name: /^Color / });
    expect(options).toHaveLength(7);
    const optionStyle = StyleSheet.flatten(options[0]!.props.style);
    expect(optionStyle).toMatchObject({ width: 76, minHeight: 72 });
    expect(optionStyle.height).toBeUndefined();
    expect(CATEGORY_COLORS.map((c) => c.value)).toEqual([
      '#E53935',
      '#FB8C00',
      '#FDD835',
      '#43A047',
      '#1E88E5',
      '#8E24AA',
      '#757575',
    ]);
    expect(screen.queryByText('✓', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Color Naranja' }));
    expect(screen.getByText('Color: Naranja')).toBeTruthy();
    expect(screen.getAllByText('✓', { includeHiddenElements: true })).toHaveLength(1);
    expect(
      screen.getByRole('radio', { name: 'Color Naranja' }).props.accessibilityState.selected,
    ).toBe(true);
  });

  it('la vista previa refleja el nombre escrito y el color elegido', async () => {
    await open();
    expect(screen.getByText('Nombre de la categoría')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByRole('radio', { name: 'Color Morado' }));
    expect(screen.getByText('Vista previa')).toBeTruthy();
    expect(screen.getAllByText('Ocio').length).toBeGreaterThanOrEqual(1);
    const previewIcon = screen
      .getAllByTestId('category-icon', { includeHiddenElements: true })
      .find((node) => StyleSheet.flatten(node.props.style).width === 32);
    expect(StyleSheet.flatten(previewIcon!.props.style).backgroundColor).toBe('#8E24AA');
  });

  it('Guardar dice «Guardando…» y se bloquea mientras trabaja', async () => {
    const gate = controlledPromise<never>();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      createCategory: jest.fn(() => gate.promise),
    });
    await renderScreen(api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Guardar'));
    const saving = await screen.findByText('Guardando…');
    expect(saving).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar' }).props.accessibilityState.disabled).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.createCategory).toHaveBeenCalledTimes(1);
    await act(async () => gate.reject(new ApiRequestError(409, 'CATEGORY_NAME_TAKEN')));
  });

  it('Cancelar sin cambios cierra el formulario sin diálogo', async () => {
    await open();
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByRole('header', { name: 'Nueva categoría' })).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('Cancelar con cambios pide confirmación con los textos de «nueva categoría»', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '¿Descartar esta categoría?',
      'Lo que escribiste se perderá.',
      expect.any(Array),
      expect.anything(),
    );
    expect(screen.getByRole('header', { name: 'Nueva categoría' })).toBeTruthy();
  });

  it('descartar desde el diálogo cierra el formulario', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    confirmWith('Descartar');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByRole('header', { name: 'Nueva categoría' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Categorías' })).toBeTruthy();
  });

  it('editar con cambios usa los textos de «descartar los cambios»', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Comida' }));
    await fireEvent.press(screen.getByText('Cancelar')); // sin cambios: sin diálogo
    expect(Alert.alert).not.toHaveBeenCalled();
    await openMenu('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Comida' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comidas');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '¿Descartar los cambios?',
      'Los cambios que hiciste no se guardarán.',
      expect.any(Array),
      expect.anything(),
    );
  });

  describe('botón Atrás', () => {
    // Captura los listeners de Atrás; el más reciente se consulta primero (como en Android).
    const captureBack = () => {
      const handlers: (() => boolean)[] = [];
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
        _event: string,
        handler: () => boolean,
      ) => {
        handlers.push(handler);
        return {
          remove: () => {
            const index = handlers.indexOf(handler);
            if (index >= 0) handlers.splice(index, 1);
          },
        };
      }) as never);
      return async () => {
        let handled = false;
        await act(async () => {
          for (const handler of [...handlers].reverse()) {
            if (handler()) {
              handled = true;
              break;
            }
          }
        });
        return handled;
      };
    };

    it('con el formulario abierto y sin cambios cierra el formulario y no la pantalla', async () => {
      const back = captureBack();
      await open();
      expect(await back()).toBe(true);
      expect(screen.queryByRole('header', { name: 'Nueva categoría' })).toBeNull();
      expect(screen.getByRole('header', { name: 'Categorías' })).toBeTruthy();
      // Con la lista visible Atrás ya no se consume aquí: lo resuelve el navegador (→ Más).
      expect(await back()).toBe(false);
    });

    it('con cambios pide confirmación en lugar de cerrar', async () => {
      const back = captureBack();
      await open();
      await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
      expect(await back()).toBe(true);
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('header', { name: 'Nueva categoría' })).toBeTruthy();
    });

    it('guardando, Atrás se ignora', async () => {
      const gate = controlledPromise<never>();
      const back = captureBack();
      const api = fakeResourcesApi({
        listCategories: jest.fn(async () => pageOf(items)),
        createCategory: jest.fn(() => gate.promise),
      });
      await renderScreen(api);
      await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
      await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
      await fireEvent.press(screen.getByText('Guardar'));
      await screen.findByText('Guardando…');
      expect(await back()).toBe(true);
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(screen.getByRole('header', { name: 'Nueva categoría' })).toBeTruthy();
      await act(async () => gate.reject(new ApiRequestError(409, 'CATEGORY_NAME_TAKEN')));
    });
  });
});

describe('CategoriesScreen: ayuda al llegar desde el formulario de movimiento (criterio 38)', () => {
  it('con fromForm muestra la frase; sin él no', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    const view = await render(<CategoriesScreen account={account()} api={api} fromForm />);
    expect(screen.getByText('Crea una categoría y vuelve para anotar tu movimiento.')).toBeTruthy();
    await view.unmount();
    await renderScreen(api);
    expect(screen.queryByText(/Crea una categoría y vuelve/)).toBeNull();
  });
});

describe('CategoriesScreen: R2 (409 ACCOUNT_ARCHIVED)', () => {
  const archivedError = () => new ApiRequestError(409, 'ACCOUNT_ARCHIVED');

  it('crear con 409 ACCOUNT_ARCHIVED avisa al contenedor con el id de la cuenta', async () => {
    const onAccountArchived = jest.fn();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      createCategory: jest.fn().mockRejectedValue(archivedError()),
    });
    await render(
      <CategoriesScreen account={account()} api={api} onAccountArchived={onAccountArchived} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/La cuenta está archivada/)).toBeTruthy();
    expect(onAccountArchived).toHaveBeenCalledWith('acc-1');
  });

  it('desarchivar con 409 ACCOUNT_ARCHIVED también avisa', async () => {
    const onAccountArchived = jest.fn();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () =>
        pageOf([category({ id: 'c-v', nombre: 'Viejo', archivada: true })]),
      ),
      updateCategory: jest.fn().mockRejectedValue(archivedError()),
    });
    await render(
      <CategoriesScreen account={account()} api={api} onAccountArchived={onAccountArchived} />,
    );
    await openMenu('Viejo');
    await fireEvent.press(screen.getByRole('button', { name: 'Desarchivar Viejo' }));
    await waitFor(() => expect(onAccountArchived).toHaveBeenCalledWith('acc-1'));
  });

  it('otros errores no avisan', async () => {
    const onAccountArchived = jest.fn();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      createCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_NAME_TAKEN')),
    });
    await render(
      <CategoriesScreen account={account()} api={api} onAccountArchived={onAccountArchived} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comida');
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/Ya existe una categoría/);
    expect(onAccountArchived).not.toHaveBeenCalled();
  });
});

describe('CategoriesScreen: selector de color con fuente ampliada (R4 D6)', () => {
  it('con fuente al 200 % las opciones no tienen alto fijo y el nombre completo sigue en el árbol', async () => {
    mockWindow(360, 2);
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Comida');
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    for (const option of CATEGORY_COLORS) {
      const radio = screen.getByRole('radio', { name: `Color ${option.name}` });
      const style = StyleSheet.flatten(radio.props.style);
      expect(style.height).toBeUndefined();
      expect(style.minHeight).toBe(72);
      // El nombre no se trunca ni se limita a una línea.
      const label = screen.getByText(option.name);
      expect(label.props.numberOfLines).toBeUndefined();
    }
  });
});

describe('R4 D6: margen lateral responsive (CategoriesScreen)', () => {
  it.each([
    [360, 16],
    [412, 20],
  ])('a %s dp el contenedor usa %s dp de relleno', async (width, margin) => {
    mockWindow(width, 1);
    await renderScreen();
    await screen.findByText('Comida');
    const root = screen.toJSON() as unknown as {
      props: { style: import('react-native').ViewStyle };
    };
    expect(StyleSheet.flatten(root.props.style).padding).toBe(margin);
  });
});
