import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthError } from '../lib/auth-types';
import { ApiRequestError } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import CategoriesScreen from './CategoriesScreen';

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

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('CategoriesScreen: estados', () => {
  it('loading y luego ready con secciones Ingresos y Egresos', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    await renderScreen(fakeResourcesApi({ listCategories: jest.fn(() => gate.promise as never) }));
    expect(screen.getByTestId('categories-loading')).toBeTruthy();
    await act(async () => gate.resolve(pageOf(items)));
    expect(await screen.findByText('Ingresos')).toBeTruthy();
    expect(screen.getByText('Egresos')).toBeTruthy();
    expect(screen.getByText('Sueldo')).toBeTruthy();
    expect(screen.getByText('Mensual')).toBeTruthy();
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.getByText('Categorías de Efectivo')).toBeTruthy();
  });

  it('una sección vacía muestra «Sin categorías»', async () => {
    await renderScreen(
      fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([items[0]!])) }),
    );
    expect(await screen.findByText('Sin categorías')).toBeTruthy();
  });

  it('empty', async () => {
    await renderScreen(fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([])) }));
    expect(await screen.findByText('Esta cuenta no tiene categorías')).toBeTruthy();
  });

  it('error con Reintentar', async () => {
    const listCategories = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server'))
      .mockResolvedValueOnce(pageOf(items));
    await renderScreen(fakeResourcesApi({ listCategories }));
    expect(await screen.findByText(/El servidor no está disponible/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(await screen.findByText('Sueldo')).toBeTruthy();
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
    await screen.findByText('Sueldo');
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
    await screen.findByText('Sueldo');
    expect(screen.queryByText('Nueva categoría')).toBeNull();
    expect(screen.getByText(/Cuenta archivada/)).toBeTruthy();
  });
});

describe('CategoriesScreen: acciones', () => {
  it('crea una categoría con tipo y color de la paleta', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Sueldo');
    await fireEvent.press(screen.getByText('Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), ' Extras ');
    await fireEvent.press(screen.getByLabelText('Tipo ingreso'));
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

  it('crea sin color ni descripción: no los envía y el tipo por defecto es egreso', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Sueldo');
    await fireEvent.press(screen.getByText('Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith('tok', 'acc-1', {
        nombre: 'Ocio',
        tipo: 'egreso',
      }),
    );
  });

  it('exige un nombre', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await screen.findByText('Sueldo');
    await fireEvent.press(screen.getByText('Nueva categoría'));
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
    await screen.findByText('Sueldo');
    await fireEvent.press(screen.getByText('Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comida');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/Ya existe una categoría de ese tipo/)).toBeTruthy();
    expect(screen.getByLabelText('Nombre de la categoría')).toBeTruthy();
  });

  it('editar envía solo los campos modificados (descripción vacía -> null)', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Editar Sueldo'));
    expect(screen.getByLabelText('Nombre de la categoría').props.value).toBe('Sueldo');
    expect(screen.queryByLabelText('Tipo ingreso')).toBeNull(); // el tipo es inmutable
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

  it('archiva y desarchiva sin confirmación', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () =>
        pageOf([items[0]!, category({ id: 'c-old', nombre: 'Viejo', archivada: true })]),
      ),
    });
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Archivar Comida'));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-eg', { archivada: true }),
    );
    await fireEvent.press(await screen.findByLabelText('Desarchivar Viejo'));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith('tok', 'c-old', { archivada: false }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación con el aviso de irreversibilidad', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Eliminar Comida'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Eliminar categoría',
      expect.stringContaining('Esta acción no se puede deshacer'),
      expect.any(Array),
    );
    expect(api.deleteCategory).not.toHaveBeenCalled();
  });

  it('eliminar confirmado llama a la API y recarga', async () => {
    const api = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf(items)) });
    confirmWith('Eliminar');
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Eliminar Comida'));
    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('tok', 'c-eg'));
    await waitFor(() => expect(api.listCategories).toHaveBeenCalledTimes(2));
  });

  it('eliminar con 409 CATEGORY_IN_USE muestra el mensaje en español', async () => {
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      deleteCategory: jest.fn().mockRejectedValue(new ApiRequestError(409, 'CATEGORY_IN_USE')),
    });
    confirmWith('Eliminar');
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Eliminar Comida'));
    expect(await screen.findByText(/tiene movimientos y no puede eliminarse/)).toBeTruthy();
    expect(screen.getByText('Comida')).toBeTruthy();
  });

  it('deshabilita los botones durante una mutación', async () => {
    const gate = controlledPromise<void>();
    const api = fakeResourcesApi({
      listCategories: jest.fn(async () => pageOf(items)),
      deleteCategory: jest.fn(() => gate.promise),
    });
    confirmWith('Eliminar');
    await renderScreen(api);
    await fireEvent.press(await screen.findByLabelText('Eliminar Comida'));
    await waitFor(() =>
      expect(screen.getByLabelText('Editar Comida').props.accessibilityState.disabled).toBe(true),
    );
    await fireEvent.press(screen.getByLabelText('Eliminar Sueldo'));
    expect(api.deleteCategory).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
    await waitFor(() =>
      expect(screen.getByLabelText('Editar Comida').props.accessibilityState.disabled).toBe(false),
    );
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
    await fireEvent.press(await screen.findByText('Nueva categoría'));
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
    await fireEvent.press(await screen.findByLabelText('Desarchivar Viejo'));
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
    await fireEvent.press(await screen.findByText('Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Comida');
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/Ya existe una categoría/);
    expect(onAccountArchived).not.toHaveBeenCalled();
  });
});
