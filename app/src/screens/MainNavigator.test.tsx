// Navegador R2 (Mis cuentas -> Detalle con pestañas). Reescrito: Inicio y su selector de chips ya
// no existen. Se conservan como regresión la limpieza de exportaciones, la retirada del listener,
// Atrás en la raíz, la vista del Calendario tras editar, la de Reportes tras el Historial filtrado y
// el remontaje con otro usuario sin rastro.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, BackHandler } from 'react-native';
import { clearExports } from '../lib/export-files';
import { ApiRequestError, type AccountBalance, type ResourcesApi } from '../lib/resources-api';
import { account, category, fakeResourcesApi, pageOf, transaction } from '../resources-test-utils';
import { controlledPromise, mockWindow } from '../test-utils';
import MainNavigator from './MainNavigator';

jest.mock('../lib/export-files', () => ({
  clearExports: jest.fn(),
  ExportFileError: class ExportFileError extends Error {},
}));
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
}));
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana' },
    busy: false,
    degraded: false,
    unavailableCause: null,
    error: null,
    signOut: jest.fn(),
    restore: jest.fn(),
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

// BackHandler simulado: los listeners activos se llaman del más reciente al más antiguo.
type Handler = () => boolean | null | undefined;
let listeners: Handler[];
let added: number;
let removed: number;

beforeEach(() => {
  mockWindow();
  listeners = [];
  added = 0;
  removed = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const h = handler as Handler;
    listeners.push(h);
    added += 1;
    return {
      remove: () => {
        removed += 1;
        listeners = listeners.filter((item) => item !== h);
      },
    };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const dispatchBack = () => {
  for (let i = listeners.length - 1; i >= 0; i -= 1) if (listeners[i]!() === true) return true;
  return false;
};
const back = async () => {
  let handled = false;
  await act(async () => {
    handled = dispatchBack();
  });
  return handled;
};

const efectivo = account({ id: 'acc-1', nombre: 'Efectivo', saldo: 1250 });
const banco = account({ id: 'acc-2', nombre: 'Banco', saldo: 500 });
const comida = category({ id: 'cat-1', nombre: 'Comida' });

function makeApi(overrides: Partial<ResourcesApi> = {}) {
  return fakeResourcesApi({
    listAccounts: jest.fn(async () => pageOf([efectivo, banco])),
    listCategories: jest.fn(async () => pageOf([comida])),
    listTransactions: jest.fn(async (_t, options) =>
      pageOf([transaction({ id: 'tx-1', accountId: options.accountId, nota: 'almuerzo' })]),
    ),
    getAccountBalance: jest.fn(async (_t, accountId) => ({
      accountId,
      saldoInicial: 1250,
      ingresos: 0,
      gastos: 250,
      saldo: 1000,
    })),
    ...overrides,
  });
}

const cardName = (nombre: string, saldo: string) =>
  `${nombre}, saldo actual ${saldo}. Abrir cuenta`;
const openEfectivo = async () => {
  await fireEvent.press(
    await screen.findByRole('button', { name: cardName('Efectivo', '$12.50') }),
  );
  await screen.findByLabelText('Secciones de la cuenta');
};
const goTab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }));
const selectedTab = () =>
  screen.getAllByRole('tab').find((tab) => tab.props.accessibilityState.selected)?.props
    .accessibilityLabel;
const onAccounts = () => screen.findByRole('header', { name: 'Mis cuentas' });
const screens = () => screen.getAllByTestId('screen-top-inset');

describe('MainNavigator: regresión', () => {
  it('al desmontarse (cierre de sesión o cambio de usuario) limpia los archivos exportados', async () => {
    const view = await render(<MainNavigator api={makeApi()} />);
    (clearExports as jest.Mock).mockClear();
    await view.unmount();
    expect(clearExports).toHaveBeenCalledTimes(1);
  });

  it('una sola suscripción a Atrás, que se retira al desmontar', async () => {
    const view = await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Calendario');
    await goTab('Reportes');
    expect(added).toBe(1);
    await view.unmount();
    expect(removed).toBe(1);
    expect(listeners).toHaveLength(0);
  });

  it('en Mis cuentas Atrás no se intercepta (sale de la app, no cierra sesión)', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await onAccounts();
    expect(await back()).toBe(false);
    expect(screen.getByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
  });

  it('el Calendario conserva el mes y el día tras editar un movimiento', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Calendario');
    await fireEvent.press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy();
    await fireEvent.press(await screen.findByTestId('calendar-cell-2026-11-20'));
    await fireEvent.press((await screen.findAllByLabelText(/Editar movimiento de Comida/))[0]!);
    expect(await screen.findByText('Editar movimiento')).toBeTruthy();
    await back();
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-cell-2026-11-20').props.accessibilityState.selected).toBe(
      true,
    );
    expect(selectedTab()).toBe('Calendario');
  });

  it('Reportes -> Historial filtrado y Atrás conserva el modo y el período', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) => ({
        ...o,
        ingresos: 0,
        gastos: 1500,
        balance: -1500,
        cantidad: 1,
      })),
      getReportByCategory: jest.fn(async (_t, o) => ({
        ...o,
        ingresos: { total: 0, items: [] },
        gastos: {
          total: 1500,
          items: [
            {
              categoryId: 'cat-1',
              nombre: 'Comida',
              icono: 'tag',
              color: '#E53935',
              archivada: false,
              total: 1500,
              cantidad: 1,
            },
          ],
        },
      })),
    });
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Reportes');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Modo Año' }));
    await fireEvent.press(await screen.findByLabelText('Año anterior'));
    await fireEvent.press(await screen.findByTestId('report-category-cat-1'));
    expect(await screen.findByText('Historial de Efectivo')).toBeTruthy();
    expect(screen.queryByLabelText('Secciones de la cuenta')).toBeNull();
    expect(screen.getByRole('button', { name: 'Volver a Reportes' })).toBeTruthy();
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          desde: '2025-01-01',
          hasta: '2025-12-31',
        }),
      ),
    );
    expect(await back()).toBe(true);
    expect(await screen.findByText('Reportes de Efectivo')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Modo Año' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByText('2025')).toBeTruthy();
    // Atrás: Reportes -> Cuenta -> Mis cuentas -> sale.
    expect(await back()).toBe(true);
    expect(selectedTab()).toBe('Cuenta');
    expect(await back()).toBe(true);
    await onAccounts();
    expect(await back()).toBe(false);
  });

  it('tras desmontar y remontar con otro usuario no queda rastro de la sesión anterior', async () => {
    const first = await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Calendario');
    await screen.findByText('Calendario de Efectivo');
    await first.unmount();

    const otherApi = makeApi({
      listAccounts: jest.fn(async () => pageOf([account({ id: 'acc-7', nombre: 'Ahorros' })])),
    });
    await render(<MainNavigator api={otherApi} />);
    expect(await screen.findByText('Ahorros')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Mis cuentas' })).toBeTruthy();
    expect(screen.queryByText(/Calendario de/)).toBeNull();
    expect(screen.queryByText(/Banco|Efectivo/)).toBeNull();
    expect(otherApi.getCalendar).not.toHaveBeenCalled();
    expect(await back()).toBe(false);
  });
});

describe('MainNavigator: Mis cuentas, Crear cuenta y Detalle', () => {
  it('tocar una cuenta abre su Detalle en la pestaña Cuenta con el saldo de GET /accounts', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    expect(selectedTab()).toBe('Cuenta');
    expect(screen.getByText('$12.50')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver a Mis cuentas' })).toBeTruthy();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('«‹ Mis cuentas» vuelve a la lista y la recarga', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Reportes');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a Mis cuentas' }));
    await onAccounts();
    await screen.findByText('Banco');
    expect(api.listAccounts).toHaveBeenCalledTimes(2);
  });

  it('Crear cuenta: entra al Detalle con el aviso y «Tu cuenta está lista»; Atrás vuelve a Mis cuentas', async () => {
    const api = makeApi({ listTransactions: jest.fn(async () => pageOf([])) });
    await render(<MainNavigator api={api} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    expect(screen.getByRole('header', { name: 'Nueva cuenta' })).toBeTruthy();
    expect(screen.queryByTestId('context-bar')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Ahorros');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    expect(await screen.findByText('Cuenta creada. Ya puedes anotar movimientos.')).toBeTruthy();
    expect(selectedTab()).toBe('Cuenta');
    expect(await screen.findByText('Tu cuenta está lista.')).toBeTruthy();
    // Crear cuenta se reemplazó por el Detalle: Atrás va directo a Mis cuentas.
    expect(await back()).toBe(true);
    await onAccounts();
    expect(screen.queryByRole('header', { name: 'Nueva cuenta' })).toBeNull();
  });

  it('Crear cuenta: Atrás y «‹» vuelven a Mis cuentas sin preguntar', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    expect(await back()).toBe(true);
    await onAccounts();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    await onAccounts();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('abrir una cuenta desde la lista no arrastra el aviso de cuenta nueva', async () => {
    await render(
      <MainNavigator api={makeApi({ listTransactions: jest.fn(async () => pageOf([])) })} />,
    );
    await openEfectivo();
    expect(await screen.findByText('Esta semana no has anotado movimientos.')).toBeTruthy();
    expect(screen.queryByText('Tu cuenta está lista.')).toBeNull();
  });
});

describe('MainNavigator: pestañas y Atrás', () => {
  it('las cinco pestañas; FAB solo en Cuenta, Movimientos y Calendario', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    const expectations: [string, boolean, RegExp | string][] = [
      ['Movimientos', true, 'Historial de Efectivo'],
      ['Calendario', true, 'Calendario de Efectivo'],
      ['Reportes', false, 'Reportes de Efectivo'],
      ['Más', false, 'Datos de cuenta'],
      ['Cuenta', true, 'Saldo actual'],
    ];
    for (const [tab, fab, text] of expectations) {
      await goTab(tab);
      expect(await screen.findByText(text)).toBeTruthy();
      expect(selectedTab()).toBe(tab);
      expect(screen.queryByTestId('fab') !== null).toBe(fab);
    }
  });

  it('recorrer las pestañas no relee el saldo ni la lista de cuentas', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    for (const tab of ['Movimientos', 'Calendario', 'Reportes', 'Más', 'Cuenta']) await goTab(tab);
    expect(api.getAccountBalance).not.toHaveBeenCalled();
    expect(api.listAccounts).toHaveBeenCalledTimes(1);
  });

  it('la barra muestra el saldo en las pestañas distintas de Cuenta', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    expect(screen.getByRole('button', { name: 'Cuenta Efectivo' })).toBeTruthy();
    await goTab('Movimientos');
    expect(screen.getByRole('button', { name: 'Cuenta Efectivo, saldo $12.50' })).toBeTruthy();
    await goTab('Reportes');
    expect(
      screen.getByRole('button', { name: 'Cuenta Efectivo, saldo actual $12.50' }),
    ).toBeTruthy();
  });

  it('Atrás: otra pestaña -> Cuenta -> Mis cuentas', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Movimientos');
    expect(await back()).toBe(true);
    expect(selectedTab()).toBe('Cuenta');
    expect(await back()).toBe(true);
    await onAccounts();
    expect(await back()).toBe(false);
  });

  it('Atrás: Categorías -> Más', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByText('Categorías de Efectivo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver a Más' })).toBeTruthy();
    expect(await back()).toBe(true);
    expect(selectedTab()).toBe('Más');
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Volver a Más' }));
    expect(selectedTab()).toBe('Más');
  });

  it('Exportar (Más) cambia a la pestaña Reportes', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Exportar' }));
    expect(selectedTab()).toBe('Reportes');
  });

  it('Atrás: Nuevo movimiento -> pestaña de origen, sin preguntar ni releer', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Calendario');
    await fireEvent.press(screen.getByTestId('fab'));
    expect(await screen.findByLabelText('Monto')).toBeTruthy();
    expect(screen.queryByLabelText('Secciones de la cuenta')).toBeNull();
    // Barra compacta de solo lectura sobre el formulario.
    expect(screen.getByLabelText('Cuenta Efectivo, saldo $12.50')).toHaveTextContent(
      'Efectivo · $12.50',
    );
    expect(await back()).toBe(true);
    expect(selectedTab()).toBe('Calendario');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('Atrás se ignora mientras el formulario guarda', async () => {
    const gate = controlledPromise<ReturnType<typeof transaction>>();
    const api = makeApi({ createTransaction: jest.fn(() => gate.promise) });
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await fireEvent.press(screen.getByTestId('fab'));
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '5');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await back()).toBe(true);
    expect(screen.getByLabelText('Monto')).toBeTruthy();
    await act(async () => gate.resolve(transaction()));
    await waitFor(() => expect(screen.queryByLabelText('Monto')).toBeNull());
    expect(selectedTab()).toBe('Cuenta');
  });

  it('un movimiento de otra cuenta no abre Editar', async () => {
    const api = makeApi({
      listTransactions: jest.fn(async () => pageOf([transaction({ accountId: 'otra' })])),
    });
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    expect(screen.queryByText('Editar movimiento')).toBeNull();
  });
});

describe('MainNavigator: saldo como fuente única', () => {
  const saveExpense = async () => {
    await fireEvent.press(screen.getByTestId('fab'));
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '2.50');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await fireEvent.press(screen.getByText('Guardar'));
  };

  it('guardar (changed=true) relee el saldo exactamente una vez y lo muestra', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await saveExpense();
    expect(await screen.findByText('$10.00')).toBeTruthy();
    expect(api.getAccountBalance).toHaveBeenCalledTimes(1);
    expect(api.getAccountBalance).toHaveBeenCalledWith('tok', 'acc-1');
    await goTab('Movimientos');
    expect(screen.getByRole('button', { name: 'Cuenta Efectivo, saldo $10.00' })).toBeTruthy();
    expect(api.getAccountBalance).toHaveBeenCalledTimes(1);
  });

  it('Cancelar o editar sin cambios (changed=false) no relee', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await fireEvent.press(screen.getByTestId('fab'));
    await fireEvent.press(await screen.findByText('Cancelar'));
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    await fireEvent.press(await screen.findByText('Guardar'));
    await screen.findByLabelText('Secciones de la cuenta');
    expect(api.updateTransaction).not.toHaveBeenCalled();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('anular relee el saldo', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Anular')?.onPress?.();
    });
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    await fireEvent.press(await screen.findByText('Anular movimiento'));
    await waitFor(() => expect(api.getAccountBalance).toHaveBeenCalledTimes(1));
  });

  it('error de saldo: «Saldo no disponible» sin $0.00; Reintentar vuelve a leer', async () => {
    const getAccountBalance = jest
      .fn()
      .mockRejectedValueOnce(new ApiRequestError(404, 'NOT_FOUND'))
      .mockResolvedValueOnce({
        accountId: 'acc-1',
        saldoInicial: 1250,
        ingresos: 0,
        gastos: 250,
        saldo: 1000,
      });
    await render(<MainNavigator api={makeApi({ getAccountBalance })} />);
    await openEfectivo();
    await saveExpense();
    await goTab('Movimientos');
    expect(await screen.findByText('Saldo no disponible')).toBeTruthy();
    expect(screen.queryByText('$0.00')).toBeNull();
    expect(screen.queryByText('$12.50')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar saldo' }));
    expect(await screen.findByText('$10.00')).toBeTruthy();
    expect(getAccountBalance).toHaveBeenCalledTimes(2);
  });

  it('mientras relee conserva el último saldo con indicador', async () => {
    const gate = controlledPromise<AccountBalance>();
    await render(
      <MainNavigator api={makeApi({ getAccountBalance: jest.fn(() => gate.promise) })} />,
    );
    await openEfectivo();
    await saveExpense();
    await goTab('Movimientos');
    expect(
      await screen.findByRole('button', {
        name: 'Cuenta Efectivo, saldo $12.50, actualizando saldo',
      }),
    ).toBeTruthy();
    await act(async () =>
      gate.resolve({
        accountId: 'acc-1',
        saldoInicial: 1250,
        ingresos: 0,
        gastos: 250,
        saldo: 1000,
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Cuenta Efectivo, saldo $10.00' }),
    ).toBeTruthy();
  });

  it('una respuesta tardía del saldo de A no se aplica tras cambiar a B', async () => {
    const gate = controlledPromise<AccountBalance>();
    await render(
      <MainNavigator api={makeApi({ getAccountBalance: jest.fn(() => gate.promise) })} />,
    );
    await openEfectivo();
    await saveExpense();
    await goTab('Movimientos');
    await fireEvent.press(await screen.findByRole('button', { name: /^Cuenta Efectivo/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Banco, saldo $5.00' }));
    expect(await screen.findByRole('button', { name: 'Cuenta Banco, saldo $5.00' })).toBeTruthy();
    await act(async () =>
      gate.resolve({
        accountId: 'acc-1',
        saldoInicial: 1250,
        ingresos: 0,
        gastos: 99999,
        saldo: -98749,
      }),
    );
    expect(screen.getByRole('button', { name: 'Cuenta Banco, saldo $5.00' })).toBeTruthy();
    expect(screen.queryByText('-$987.49')).toBeNull();
  });

  it('409 ACCOUNT_ARCHIVED marca la cuenta como archivada (modo consulta)', async () => {
    const api = makeApi({
      createTransaction: jest.fn().mockRejectedValue(new ApiRequestError(409, 'ACCOUNT_ARCHIVED')),
    });
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await saveExpense();
    expect(await screen.findByText(/La cuenta está archivada/)).toBeTruthy();
    expect(screen.getByText('Archivada')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancelar'));
    await screen.findByLabelText('Secciones de la cuenta');
    expect(screen.getByTestId('fab').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Cuenta archivada: no admite movimientos nuevos')).toBeTruthy();
    expect(screen.getByText(/pero no anotar movimientos/)).toBeTruthy();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });
});

describe('MainNavigator: selector rápido de cuenta', () => {
  it('cambiar de cuenta conserva la pestaña, reinicia la vista y lo anuncia', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    announce.mockClear(); // en jest-expo ya es un mock: se limpian llamadas de otras pruebas
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Calendario');
    await fireEvent.press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    await screen.findByText('Noviembre 2026');
    await fireEvent.press(screen.getByRole('button', { name: /^Cuenta Efectivo/ }));
    expect(screen.getByRole('header', { name: 'Cambiar de cuenta' })).toBeTruthy();
    const current = await screen.findByRole('radio', { name: 'Efectivo, saldo $12.50' });
    expect(current.props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Banco, saldo $5.00' }));
    expect(await screen.findByText('Calendario de Banco')).toBeTruthy();
    expect(selectedTab()).toBe('Calendario');
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    expect(screen.queryByText(/Efectivo/)).toBeNull();
    expect(announce).toHaveBeenCalledWith('Ahora estás en Banco');
    await waitFor(() =>
      expect(api.getCalendar).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-2',
        month: '2026-10',
      }),
    );
  });

  it('elegir la cuenta actual no hace nada; «Ver todas mis cuentas» vuelve a la lista', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    announce.mockClear(); // en jest-expo ya es un mock: se limpian llamadas de otras pruebas
    await render(<MainNavigator api={makeApi()} />);
    await openEfectivo();
    await goTab('Movimientos');
    await fireEvent.press(screen.getByRole('button', { name: /^Cuenta Efectivo/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Efectivo, saldo $12.50' }));
    expect(selectedTab()).toBe('Movimientos');
    expect(announce).not.toHaveBeenCalled();
    expect(screen.queryByRole('header', { name: 'Cambiar de cuenta' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Cuenta Efectivo/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver todas mis cuentas' }));
    await onAccounts();
  });
});

describe('MainNavigator: Más (renombrar y archivar)', () => {
  it('renombrar actualiza la barra con la respuesta del PATCH, sin releer el saldo', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Datos de cuenta' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Billetera');
    await fireEvent.press(screen.getByText('Guardar cambios'));
    expect(await screen.findByText('Nombre actualizado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cuenta Billetera, saldo $12.50' })).toBeTruthy();
    expect(api.getAccountBalance).not.toHaveBeenCalled();
  });

  it('archivar con confirmación vuelve a Mis cuentas con Archivadas desplegada y el aviso', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Archivar')?.onPress?.();
    });
    const listAccounts = jest
      .fn()
      .mockResolvedValueOnce(pageOf([efectivo, banco]))
      .mockResolvedValueOnce(pageOf([{ ...efectivo, archivada: true }, banco]));
    const api = makeApi({ listAccounts });
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar cuenta' }));
    expect(
      await screen.findByText('Efectivo archivada. La encuentras en Archivadas.'),
    ).toBeTruthy();
    await onAccounts();
    expect(api.updateAccount).toHaveBeenCalledWith('tok', 'acc-1', { archivada: true });
    expect(
      (await screen.findByRole('button', { name: 'Archivadas (1)' })).props.accessibilityState
        .expanded,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Ver Efectivo' })).toBeTruthy();
    expect(await back()).toBe(false);
  });

  it('cancelar el archivado no llama al PATCH y se queda en Más', async () => {
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await openEfectivo();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Archivar cuenta' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(api.updateAccount).not.toHaveBeenCalled();
    expect(selectedTab()).toBe('Más');
  });

  it('una cuenta archivada se abre en modo consulta desde Archivadas', async () => {
    const api = makeApi({
      listAccounts: jest.fn(async () => pageOf([efectivo, { ...banco, archivada: true }])),
    });
    await render(<MainNavigator api={api} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Archivadas (1)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver Banco' }));
    await screen.findByLabelText('Secciones de la cuenta');
    expect(screen.getByText('Archivada')).toBeTruthy();
    expect(screen.getByTestId('fab').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('fab'));
    expect(screen.queryByLabelText('Monto')).toBeNull();
    // Aviso de modo consulta en Cuenta, Movimientos, Calendario y Más (no en Reportes).
    for (const [tab, shown] of [
      ['Movimientos', true],
      ['Calendario', true],
      ['Más', true],
      ['Reportes', false],
      ['Cuenta', true],
    ] as const) {
      await goTab(tab);
      expect(screen.queryByText(/pero no anotar movimientos/) !== null).toBe(shown);
    }
    // Editar sigue permitido.
    await fireEvent.press(await screen.findByLabelText(/Editar movimiento de Comida/));
    expect(await screen.findByText('Editar movimiento')).toBeTruthy();
  });
});

describe('MainNavigator: un solo Screen por ruta y Snackbar', () => {
  it('cada ruta tiene exactamente un Screen', async () => {
    await render(<MainNavigator api={makeApi()} />);
    await onAccounts();
    expect(screens()).toHaveLength(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    expect(screens()).toHaveLength(1);
    await back();
    await openEfectivo();
    for (const tab of ['Movimientos', 'Calendario', 'Reportes', 'Más', 'Cuenta']) {
      await goTab(tab);
      expect(screens()).toHaveLength(1);
    }
    await fireEvent.press(screen.getByTestId('fab'));
    await screen.findByLabelText('Monto');
    expect(screens()).toHaveLength(1);
    await back();
    await goTab('Más');
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await screen.findByText('Categorías de Efectivo');
    expect(screens()).toHaveLength(1);
  });

  it('el aviso se coloca sobre las pestañas y el botón flotante en el Detalle', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const api = makeApi();
    await render(<MainNavigator api={api} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Ahorros');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    const snackbar = await screen.findByTestId('snackbar');
    // tabHeight (62) + FAB (56 + 16) + 8 de separación; el margen del sistema es 0 en Jest.
    expect(snackbar).toHaveStyle({ bottom: 62 + 56 + 16 + 8 });
  });
});
