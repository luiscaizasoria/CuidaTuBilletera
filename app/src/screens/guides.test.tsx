// R5: guías contextuales y estados vacíos ilustrados (docs/007 §5.12; criterios J6 a J19).
// Las pantallas se prueban con el proveedor real y un almacén de guías en memoria.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, AccessibilityInfo, Animated, BackHandler, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';
import { guideRecord, memoryGuideStorage } from '../guides-test-utils';
import { GuidesProvider } from '../hooks/use-guides';
import { AuthError } from '../lib/auth-types';
import { guideById } from '../lib/guides';
import { account, category, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { controlledPromise, flush, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import AccountsScreen from './AccountsScreen';
import AccountSummaryTab from './AccountSummaryTab';
import CalendarScreen from './CalendarScreen';
import CategoriesScreen from './CategoriesScreen';
import MainNavigator from './MainNavigator';
import MoreScreen, { HELP_RESET_DONE, HELP_RESET_ERROR } from './MoreScreen';
import NewAccountScreen from './NewAccountScreen';
import ReportsScreen from './ReportsScreen';
import TransactionFormScreen from './TransactionFormScreen';
import { EmptyState, GuideCard } from './ui';

relaxTimeoutsForColdCache();

const mockAuthState: Record<string, unknown> = {};
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));
jest.mock('../lib/export-files', () => ({
  clearExports: jest.fn(),
  ExportFileError: class ExportFileError extends Error {},
}));
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-16',
  yesterdayLocal: () => '2026-10-15',
}));

const KEY = 'guias_v1_u';
const acc = account({ id: 'acc-1', nombre: 'Efectivo' });
const archived = account({ id: 'acc-1', nombre: 'Efectivo', archivada: true });
const noop = () => undefined;

type Storage = ReturnType<typeof memoryGuideStorage>;
const withGuides = (ui: ReactElement, storage: Storage, userId = 'u') => (
  <GuidesProvider userId={userId} storage={storage}>
    {ui}
  </GuidesProvider>
);
const guideOf = (id: string) => screen.queryByTestId(`guide-${id}`);
const seenIn = (storage: Storage, key = KEY) =>
  storage.data.has(key) ? (JSON.parse(storage.data.get(key)!).vistas as string[]) : [];
const settle = () => act(async () => flush(40));
const closeButton = () => screen.getByRole('button', { name: 'Cerrar ayuda' });

beforeEach(() => {
  mockWindow(360, 1);
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
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: noop }));
});
afterEach(() => jest.restoreAllMocks());

describe('GuideCard (J10, J18)', () => {
  const guide = guideById('calendario');

  it('tinte del módulo, 💡 decorativo, texto, ✕ de 48 dp y Entendido de 48 dp', async () => {
    const onDismiss = jest.fn();
    await render(<GuideCard guide={guide} onDismiss={onDismiss} />);
    expect(screen.getByText(guide.text)).toBeTruthy();
    const card = StyleSheet.flatten(screen.getByTestId('guide-calendario').props.style);
    expect(card.backgroundColor).toBe('#DCEBFF');
    expect(card.borderRadius).toBe(16);
    const bulb = screen.getByText('💡', { includeHiddenElements: true });
    let node = bulb.parent;
    while (node && node.props.importantForAccessibility === undefined) node = node.parent;
    expect(node?.props.importantForAccessibility).toBe('no');
    const close = closeButton();
    const closeStyle = StyleSheet.flatten(close.props.style);
    expect(closeStyle.minWidth).toBeGreaterThanOrEqual(48);
    expect(closeStyle.minHeight).toBeGreaterThanOrEqual(48);
    expect(
      StyleSheet.flatten(screen.getByRole('button', { name: 'Entendido' }).props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
    await fireEvent.press(close);
    await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('no es región viva ni alerta', async () => {
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    const props = screen.getByTestId('guide-calendario').props;
    expect(props.accessibilityLiveRegion).toBeUndefined();
    expect(props.accessibilityRole).toBeUndefined();
  });

  it('con movimiento reducido no anima y queda visible', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    await settle();
    expect(screen.getByText(guide.text)).toBeTruthy();
  });

  // UXQA-R5-02: nace transparente (sin parpadeo) y aparece sin animar o con fundido de 180 ms.
  const opacityNow = () =>
    StyleSheet.flatten(screen.getByTestId('guide-calendario').props.style).opacity;

  it('movimiento reducido: nace en 0 y pasa directo a 1 sin animación', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const gate = controlledPromise<boolean>();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(gate.promise);
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    expect(opacityNow()).toBe(0);
    await act(async () => gate.resolve(true));
    expect(opacityNow()).toBe(1);
    expect(timing).not.toHaveBeenCalled();
  });

  it('sin movimiento reducido: nace en 0 y se anima 180 ms con el controlador nativo', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    expect(opacityNow()).toBe(0);
    await settle();
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }),
    );
  });

  it('si no se puede consultar el movimiento reducido, queda visible', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('x'));
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    await settle();
    expect(opacityNow()).toBe(1);
  });

  it('fuente ≥ 130 %: Entendido a ancho completo; ≥ 175 %: sin 💡 pero la guía se conserva', async () => {
    mockWindow(360, 1.3);
    const view = await render(<GuideCard guide={guide} onDismiss={noop} />);
    const wrapper = screen.getByRole('button', { name: 'Entendido' }).parent!;
    expect(StyleSheet.flatten(wrapper.props.style).alignSelf).toBe('stretch');
    await view.unmount();
    mockWindow(360, 2);
    await render(<GuideCard guide={guide} onDismiss={noop} />);
    expect(screen.queryByText('💡', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText(guide.text)).toBeTruthy();
    expect(closeButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeTruthy();
  });
});

describe('EmptyState con ilustración (J17, J18)', () => {
  it('la ilustración es decorativa, de 96 dp y sin etiqueta', async () => {
    await render(<EmptyState module="movimientos" art="filtros" message="Vacío" />);
    const art = screen.getByTestId('empty-art', { includeHiddenElements: true });
    expect(art.props.importantForAccessibility).toBe('no');
    expect(art.props.accessibilityElementsHidden).toBe(true);
    expect(art.props.accessibilityLabel).toBeUndefined();
    expect(StyleSheet.flatten(art.props.style)).toMatchObject({ width: 96, height: 96 });
    expect(art.props.resizeMode).toBe('contain');
  });

  it('con fontScale 1.75 y 2 no hay ilustración, y el texto y la acción siguen', async () => {
    for (const scale of [1.75, 2]) {
      mockWindow(360, scale);
      const onAction = jest.fn();
      const view = await render(
        <EmptyState
          module="movimientos"
          art="reportes"
          title="Título"
          message="Mensaje"
          actionLabel="Acción"
          onAction={onAction}
        />,
      );
      expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('Título')).toBeTruthy();
      expect(screen.getByText('Mensaje')).toBeTruthy();
      const action = screen.getByRole('button', { name: 'Acción' });
      expect(StyleSheet.flatten(action.parent!.props.style).alignSelf).toBe('stretch');
      expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(48);
      await view.unmount();
    }
  });

  it('compact no lleva dibujo', async () => {
    await render(<EmptyState module="calendario" compact art="movimientos" message="Sin nada" />);
    expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Sin nada')).toBeTruthy();
  });
});

describe('Mis cuentas (J7, J8, J9, J17, J19)', () => {
  const renderAccounts = (api: ReturnType<typeof fakeResourcesApi>, storage: Storage, props = {}) =>
    render(
      withGuides(
        <AccountsScreen api={api} onOpenAccount={noop} onCreateAccount={noop} {...props} />,
        storage,
      ),
    );
  const withList = (items: ReturnType<typeof account>[]) =>
    fakeResourcesApi({ listAccounts: jest.fn(async () => pageOf(items)) });

  it('sin cuentas: guía + vacío; Entendido la descarta, la guarda y no vuelve al re-montar', async () => {
    const storage = memoryGuideStorage();
    const api = withList([]);
    const view = await renderAccounts(api, storage);
    expect(await screen.findByText('Todavía no tienes cuentas')).toBeTruthy();
    expect(await screen.findByTestId('guide-cuentas-vacio')).toBeTruthy();
    expect(guideById('cuentas-vacio').text).toBe(
      'Bienvenido. Empieza creando una cuenta: puede ser tu efectivo, tu banco o tu tarjeta.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));
    expect(guideOf('cuentas-vacio')).toBeNull();
    await settle();
    expect(seenIn(storage)).toEqual(['cuentas-vacio']);
    await view.unmount();
    await renderAccounts(api, storage);
    await screen.findByText('Todavía no tienes cuentas');
    await settle();
    expect(guideOf('cuentas-vacio')).toBeNull();
  });

  it('el vacío conserva el círculo con emoji (sin alcancía), título, mensaje y botón de 52 dp', async () => {
    const create = jest.fn();
    await renderAccounts(withList([]), memoryGuideStorage(), { onCreateAccount: create });
    await screen.findByText('Todavía no tienes cuentas');
    expect(screen.getByText('🐷', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByText('Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.'),
    ).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Crear mi primera cuenta' });
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(52);
    await fireEvent.press(button);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('solo archivadas: texto exacto, botón «Crear mi primera cuenta» y sin guía de bienvenida', async () => {
    const create = jest.fn();
    await renderAccounts(withList([account({ id: 'a', archivada: true })]), memoryGuideStorage(), {
      onCreateAccount: create,
    });
    expect(
      await screen.findByText(
        'No tienes cuentas activas. Puedes crear una o desarchivar una de las anteriores.',
      ),
    ).toBeTruthy();
    await settle();
    expect(guideOf('cuentas-vacio')).toBeNull();
    expect(guideOf('cuentas-lista')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear mi primera cuenta' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('con dos o más cuentas activas muestra cuentas-lista; abrir una cuenta la descarta', async () => {
    const storage = memoryGuideStorage();
    const open = jest.fn();
    await renderAccounts(
      withList([account({ id: 'a', nombre: 'Efectivo' }), account({ id: 'b', nombre: 'Banco' })]),
      storage,
      { onOpenAccount: open },
    );
    expect(await screen.findByTestId('guide-cuentas-lista')).toBeTruthy();
    expect(screen.getByText('Toca una cuenta para anotar sus gastos e ingresos.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Efectivo, saldo actual/ }));
    expect(open).toHaveBeenCalled();
    expect(guideOf('cuentas-lista')).toBeNull();
    await settle();
    expect(seenIn(storage)).toEqual(['cuentas-lista']);
  });

  it('con una sola cuenta no hay guía y se conserva la pista de la tarjeta (D5)', async () => {
    await renderAccounts(withList([account()]), memoryGuideStorage());
    expect(await screen.findByText('Toca para ver tus movimientos')).toBeTruthy();
    await settle();
    expect(screen.queryByTestId(/^guide-/)).toBeNull();
  });

  it('en carga y con error no hay guía', async () => {
    const gate = controlledPromise<ReturnType<typeof pageOf>>();
    const loading = await renderAccounts(
      fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise as never) }),
      memoryGuideStorage(),
    );
    await settle();
    expect(screen.getByTestId('accounts-loading')).toBeTruthy();
    expect(screen.queryByTestId(/^guide-/)).toBeNull();
    await loading.unmount();
    await renderAccounts(
      fakeResourcesApi({
        listAccounts: jest.fn(async () => {
          throw new AuthError('network');
        }),
      }),
      memoryGuideStorage(),
    );
    await screen.findByText('Reintentar');
    await settle();
    expect(screen.queryByTestId(/^guide-/)).toBeNull();
  });

  it('J5: si el almacén falla, la guía descartada no reaparece y no se muestra error', async () => {
    const storage = memoryGuideStorage();
    storage.setFailRead(true);
    storage.setFailWrite(true);
    await renderAccounts(withList([]), storage);
    await screen.findByTestId('guide-cuentas-vacio');
    await fireEvent.press(closeButton());
    await settle();
    expect(guideOf('cuentas-vacio')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('J6: mientras la lectura está pendiente no hay guía', async () => {
    const storage = memoryGuideStorage({ [KEY]: guideRecord() });
    const release = storage.holdReads();
    await renderAccounts(withList([]), storage);
    await screen.findByText('Todavía no tienes cuentas');
    await settle();
    expect(guideOf('cuentas-vacio')).toBeNull();
    await act(async () => release());
    expect(await screen.findByTestId('guide-cuentas-vacio')).toBeTruthy();
  });

  it('ya descartada, no aparece', async () => {
    await renderAccounts(withList([]), memoryGuideStorage({ [KEY]: guideRecord('cuentas-vacio') }));
    await screen.findByText('Todavía no tienes cuentas');
    await settle();
    expect(guideOf('cuentas-vacio')).toBeNull();
  });
});

describe('Crear cuenta y Nuevo movimiento (J8, J11)', () => {
  it('cuenta-crear aparece siempre y guardar la cuenta marca cuentas-vacio y cuenta-crear', async () => {
    const storage = memoryGuideStorage();
    const onCreated = jest.fn();
    await render(
      withGuides(
        <NewAccountScreen api={fakeResourcesApi()} onBack={noop} onCreated={onCreated} />,
        storage,
      ),
    );
    expect(await screen.findByTestId('guide-cuenta-crear')).toBeTruthy();
    expect(
      screen.getByText(
        'El saldo inicial es lo que ya tienes hoy. Si no estás seguro, déjalo vacío.',
      ),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre de la cuenta'), 'Banco');
    await fireEvent.press(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await settle();
    expect(seenIn(storage)).toEqual(['cuentas-vacio', 'cuenta-crear']);
  });

  const renderForm = (
    storage: Storage,
    props: Partial<Parameters<typeof TransactionFormScreen>[0]> = {},
  ) =>
    render(
      withGuides(
        <TransactionFormScreen account={acc} api={fakeResourcesApi()} onDone={noop} {...props} />,
        storage,
      ),
    );

  it('movimiento-nuevo solo al crear con cuenta activa; guardar marca movimiento-nuevo y cuenta-detalle', async () => {
    const storage = memoryGuideStorage();
    const onDone = jest.fn();
    await renderForm(storage, { onDone });
    expect(await screen.findByTestId('guide-movimiento-nuevo')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '12,50');
    await fireEvent.press(await screen.findByLabelText('Categoría Comida'));
    await fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true, expect.any(String)));
    await settle();
    expect(seenIn(storage)).toEqual(['cuenta-detalle', 'movimiento-nuevo']);
  });

  it('no aparece al editar ni con la cuenta archivada', async () => {
    const storage = memoryGuideStorage();
    const { transaction } = jest.requireActual('../resources-test-utils');
    const edit = await renderForm(storage, { transaction: transaction() });
    await settle();
    expect(guideOf('movimiento-nuevo')).toBeNull();
    await edit.unmount();
    await renderForm(storage, { account: archived });
    await settle();
    expect(guideOf('movimiento-nuevo')).toBeNull();
  });
});

describe('Pestaña Cuenta (J8, J12, J17)', () => {
  const summary = (cantidad: number) =>
    jest.fn(async (_t: string, o: { accountId: string; desde: string; hasta: string }) => ({
      ...o,
      ingresos: cantidad ? 1000 : 0,
      gastos: 0,
      balance: 0,
      cantidad,
    }));
  const renderTab = (api: ReturnType<typeof fakeResourcesApi>, storage: Storage, props = {}) =>
    render(
      withGuides(
        <AccountSummaryTab
          api={api}
          account={acc}
          balance="ok"
          onRetryBalance={noop}
          month="2026-10"
          onMonthChange={noop}
          onSeeAll={noop}
          onOpenTransaction={noop}
          {...props}
        />,
        storage,
      ),
    );

  it('sin movimientos en semana ni mes: guía + vacío con ilustración y textos exactos', async () => {
    await renderTab(fakeResourcesApi({ getReportSummary: summary(0) }), memoryGuideStorage());
    expect(await screen.findByTestId('guide-cuenta-detalle')).toBeTruthy();
    expect(
      screen.getByText(
        'Aquí ves cuánto tienes y lo que has anotado. Toca + para registrar un gasto o un ingreso.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Esta semana no has anotado movimientos.')).toBeTruthy();
    expect(screen.getByText('Toca + para registrar el primero.')).toBeTruthy();
    expect(screen.getByTestId('empty-art', { includeHiddenElements: true })).toBeTruthy();
  });

  it('recién creada: título y mensaje de «Tu cuenta está lista.»', async () => {
    await renderTab(fakeResourcesApi(), memoryGuideStorage(), { justCreated: true });
    expect(await screen.findByText('Tu cuenta está lista.')).toBeTruthy();
    expect(screen.getByText('Anota tu primer gasto o ingreso con el botón +.')).toBeTruthy();
  });

  it('con movimientos en el mes, o en la semana, o archivada, no hay guía', async () => {
    const withWeek = fakeResourcesApi({
      getReportSummary: summary(0),
      listTransactions: jest.fn(async () =>
        pageOf([jest.requireActual('../resources-test-utils').transaction()]),
      ),
    });
    const a = await renderTab(withWeek, memoryGuideStorage());
    await screen.findByText('Saldo actual');
    await settle();
    expect(guideOf('cuenta-detalle')).toBeNull();
    await a.unmount();
    const b = await renderTab(
      fakeResourcesApi({ getReportSummary: summary(2) }),
      memoryGuideStorage(),
    );
    await settle();
    expect(guideOf('cuenta-detalle')).toBeNull();
    await b.unmount();
    await renderTab(fakeResourcesApi({ getReportSummary: summary(0) }), memoryGuideStorage(), {
      account: archived,
    });
    await settle();
    expect(guideOf('cuenta-detalle')).toBeNull();
    expect(screen.getByText('Esta semana no has anotado movimientos.')).toBeTruthy();
    expect(screen.queryByText('Toca + para registrar el primero.')).toBeNull();
  });

  it('semana filtrada sin resultados: texto exacto, sin ilustración', async () => {
    await renderTab(fakeResourcesApi({ getReportSummary: summary(0) }), memoryGuideStorage());
    await screen.findByText('Esta semana no has anotado movimientos.');
    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(await screen.findByText('Esta semana no tienes gastos anotados.')).toBeTruthy();
    expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
  });
});

describe('Calendario (J8, J17, J19)', () => {
  const days = [{ fecha: '2026-10-14', ingresos: 1000, gastos: 0, cantidad: 1 }];
  const renderCalendar = (api: ReturnType<typeof fakeResourcesApi>, storage: Storage, acct = acc) =>
    render(
      withGuides(
        <CalendarScreen
          account={acct}
          api={api}
          initialMonth="2026-10"
          initialDay="2026-10-15"
          onViewChange={noop}
          onOpenTransaction={noop}
          onNewTransaction={noop}
          canCreate={!acct.archivada}
        />,
        storage,
      ),
    );

  it('mes sin movimientos: guía y vacíos compactos con textos exactos, sin ilustración', async () => {
    const onNew = jest.fn();
    const storage = memoryGuideStorage();
    await render(
      withGuides(
        <CalendarScreen
          account={acc}
          api={fakeResourcesApi()}
          initialMonth="2026-10"
          initialDay="2026-10-15"
          onViewChange={noop}
          onOpenTransaction={noop}
          onNewTransaction={onNew}
        />,
        storage,
      ),
    );
    expect(await screen.findByTestId('guide-calendario')).toBeTruthy();
    expect(
      screen.getByText(
        'Los días con movimientos muestran sus importes. Toca un día para ver el detalle.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('No hay movimientos en este mes.')).toBeTruthy();
    expect(await screen.findByText('Este día no tiene movimientos registrados.')).toBeTruthy();
    expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByText('+ Anotar en este día'));
    expect(onNew).toHaveBeenCalledWith('2026-10-15');
  });

  it('con movimientos, con la cuenta archivada o con error no hay guía', async () => {
    const withData = fakeResourcesApi({
      getCalendar: jest.fn(async (_t, { accountId, month }) => ({ accountId, month, days })),
    });
    const a = await renderCalendar(withData, memoryGuideStorage());
    await screen.findByTestId('month-summary');
    await settle();
    expect(guideOf('calendario')).toBeNull();
    await a.unmount();
    const b = await renderCalendar(fakeResourcesApi(), memoryGuideStorage(), archived);
    await screen.findByText('No hay movimientos en este mes.');
    await settle();
    expect(guideOf('calendario')).toBeNull();
    await b.unmount();
    await renderCalendar(
      fakeResourcesApi({
        getCalendar: jest.fn(async () => {
          throw new AuthError('network');
        }),
      }),
      memoryGuideStorage(),
    );
    await screen.findByLabelText('Reintentar calendario');
    await settle();
    expect(guideOf('calendario')).toBeNull();
  });

  it('tocar un día con movimientos la descarta', async () => {
    // Mes con datos en otro mes: la guía se ve en el vacío y el toque en un día con datos la descarta.
    const api = fakeResourcesApi({
      getCalendar: jest.fn(async (_t, { accountId, month }) => ({
        accountId,
        month,
        days: month === '2026-10' ? [] : days,
      })),
    });
    const storage = memoryGuideStorage();
    await renderCalendar(api, storage);
    await screen.findByTestId('guide-calendario');
    await fireEvent.press(closeButton());
    expect(guideOf('calendario')).toBeNull();
    await settle();
    expect(seenIn(storage)).toEqual(['calendario']);
  });
});

describe('Reportes (J8, J17)', () => {
  const view = { mode: 'month', year: 2026, month: 10, desde: '', hasta: '' } as const;
  const renderReports = (api: ReturnType<typeof fakeResourcesApi>, storage: Storage) =>
    render(
      withGuides(
        <ReportsScreen
          account={acc}
          api={api}
          initialView={view}
          onViewChange={noop}
          onOpenHistory={noop}
        />,
        storage,
      ),
    );

  it('período sin movimientos: guía arriba, vacío con ilustración debajo', async () => {
    await renderReports(fakeResourcesApi(), memoryGuideStorage());
    expect(await screen.findByTestId('guide-reportes')).toBeTruthy();
    expect(
      screen.getByText(
        'Aquí ves cuánto entró y cuánto salió en un período. Toca una barra o un total para ver sus movimientos.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Sin movimientos en este período\. Prueba con otro mes/)).toBeTruthy();
    expect(screen.getByTestId('empty-art', { includeHiddenElements: true })).toBeTruthy();
  });

  it('con movimientos o con error no hay guía', async () => {
    const withData = fakeResourcesApi({
      getReportSummary: jest.fn(async (_t, o) => ({
        ...o,
        ingresos: 1000,
        gastos: 0,
        balance: 1000,
        cantidad: 1,
      })),
    });
    const a = await renderReports(withData, memoryGuideStorage());
    await screen.findByText('Ingresos');
    await settle();
    expect(guideOf('reportes')).toBeNull();
    await a.unmount();
    await renderReports(
      fakeResourcesApi({
        getReportSummary: jest.fn(async () => {
          throw new AuthError('network');
        }),
      }),
      memoryGuideStorage(),
    );
    await screen.findByLabelText('Reintentar reportes');
    await settle();
    expect(guideOf('reportes')).toBeNull();
  });
});

describe('Categorías (J8, J17)', () => {
  const renderCategories = (
    api: ReturnType<typeof fakeResourcesApi>,
    storage: Storage,
    acct = acc,
  ) => render(withGuides(<CategoriesScreen account={acct} api={api} />, storage));

  it('con la lista cargada y cuenta activa: guía; crear una categoría la descarta', async () => {
    const storage = memoryGuideStorage();
    const api = fakeResourcesApi();
    await renderCategories(api, storage);
    expect(await screen.findByTestId('guide-categorias')).toBeTruthy();
    expect(
      screen.getByText(
        'Las categorías ordenan tus gastos e ingresos. Puedes cambiarles el nombre y el color.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Ocio');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalled());
    await waitFor(() => expect(guideOf('categorias')).toBeNull());
    await settle();
    expect(seenIn(storage)).toEqual(['categorias']);
  });

  it('vacío de categorías conserva el círculo con 🏷️ (sin etiqueta ilustrada) y textos exactos', async () => {
    const empty = fakeResourcesApi({ listCategories: jest.fn(async () => pageOf([])) });
    const a = await renderCategories(empty, memoryGuideStorage());
    expect(
      await screen.findByText('Aún no tienes categorías de gasto. Crea la primera.'),
    ).toBeTruthy();
    // El título de la pantalla y el círculo del vacío.
    expect(screen.getAllByText('🏷️', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByTestId('empty-art', { includeHiddenElements: true })).toBeNull();
    await a.unmount();
    await renderCategories(empty, memoryGuideStorage(), archived);
    expect(await screen.findByText('Aún no tienes categorías de gasto.')).toBeTruthy();
    await settle();
    expect(guideOf('categorias')).toBeNull();
  });

  it('en carga o con error no hay guía', async () => {
    await renderCategories(
      fakeResourcesApi({
        listCategories: jest.fn(async () => {
          throw new AuthError('network');
        }),
      }),
      memoryGuideStorage(),
    );
    await screen.findByText('Reintentar');
    await settle();
    expect(guideOf('categorias')).toBeNull();
  });
});

describe('Más: «Ver ayudas otra vez» (J13, J14)', () => {
  const renderMore = (storage: Storage, onNotify = jest.fn()) =>
    render(
      withGuides(
        <MoreScreen
          api={fakeResourcesApi()}
          account={acc}
          onAccountUpdated={noop}
          onArchived={noop}
          onOpenCategories={noop}
          onOpenExport={noop}
          onNotify={onNotify}
        />,
        storage,
      ),
    );

  it('sección Ayuda entre Cuenta y Sesión con título, subtítulo, 56 dp y rol de botón', async () => {
    await renderMore(memoryGuideStorage());
    const headers = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headers.indexOf('AYUDA')).toBe(headers.indexOf('CUENTA') + 1);
    expect(headers.indexOf('SESIÓN')).toBe(headers.indexOf('AYUDA') + 1);
    const row = screen.getByRole('button', { name: 'Ver ayudas otra vez' });
    expect(row.props.accessibilityHint).toBe('Vuelve a mostrar las guías que cerraste.');
    expect(screen.getByText('Vuelve a mostrar las guías que cerraste.')).toBeTruthy();
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(56);
  });

  it('vacía las vistas, avisa y no pide confirmación', async () => {
    const storage = memoryGuideStorage({ [KEY]: guideRecord('calendario', 'reportes') });
    const onNotify = jest.fn();
    await renderMore(storage, onNotify);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver ayudas otra vez' }));
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(HELP_RESET_DONE));
    expect(HELP_RESET_DONE).toBe('Listo. Verás las ayudas otra vez.');
    expect(JSON.parse(storage.data.get(KEY)!)).toEqual({ v: 1, vistas: [] });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(screen.queryByText(HELP_RESET_ERROR)).toBeNull();
  });

  it('busy: deshabilitada mientras guarda y un doble toque produce una sola escritura', async () => {
    const storage = memoryGuideStorage({ [KEY]: guideRecord('calendario') });
    await renderMore(storage);
    await settle();
    const gate = controlledPromise();
    const originalWrite = storage.write;
    storage.write = jest.fn(async (k: string, v: string) => {
      await gate.promise;
      return originalWrite(k, v);
    });
    const row = screen.getByRole('button', { name: 'Ver ayudas otra vez' });
    await fireEvent.press(row);
    await fireEvent.press(row);
    const busyRow = screen.getByRole('button', { name: 'Ver ayudas otra vez' });
    expect(busyRow.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId('row-busy')).toBeTruthy();
    await act(async () => gate.resolve());
    await settle();
    expect(storage.write).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Ver ayudas otra vez' }).props.accessibilityState,
    ).not.toMatchObject({ busy: true });
  });

  it('error: muestra el mensaje exacto, no avisa de éxito y la fila se reactiva', async () => {
    const storage = memoryGuideStorage({ [KEY]: guideRecord('calendario') });
    const onNotify = jest.fn();
    await renderMore(storage, onNotify);
    await settle();
    storage.setFailWrite(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver ayudas otra vez' }));
    expect(await screen.findByText(HELP_RESET_ERROR)).toBeTruthy();
    expect(HELP_RESET_ERROR).toBe('No pudimos restablecer las ayudas. Inténtalo de nuevo.');
    expect(onNotify).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Ver ayudas otra vez' }).props.accessibilityState,
    ).not.toMatchObject({ disabled: true });
    storage.setFailWrite(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver ayudas otra vez' }));
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(HELP_RESET_DONE));
    expect(screen.queryByText(HELP_RESET_ERROR)).toBeNull();
  });

  it('con fuente ≥ 175 % oculta el mosaico 💡 pero conserva la fila', async () => {
    mockWindow(360, 2);
    await renderMore(memoryGuideStorage());
    expect(screen.queryByText('💡', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver ayudas otra vez' })).toBeTruthy();
  });
});

describe('Navegador: cambio de cuenta y reinicio sin recargar (J12, J13, J15, J16)', () => {
  const efectivo = account({ id: 'acc-1', nombre: 'Efectivo', saldo: 1250 });
  const banco = account({ id: 'acc-2', nombre: 'Banco', saldo: 500 });
  const makeApi = () =>
    fakeResourcesApi({
      listAccounts: jest.fn(async () => pageOf([efectivo, banco])),
      listCategories: jest.fn(async () => pageOf([category()])),
    });
  const tab = (name: string) => screen.getByRole('tab', { name });

  it('descartar en una cuenta no reaparece al cambiar de cuenta o de pestaña; «Ver ayudas» las trae sin recargar', async () => {
    const storage = memoryGuideStorage();
    await render(withGuides(<MainNavigator api={makeApi()} />, storage));
    // Mis cuentas con dos cuentas: cuentas-lista; abrir una la descarta.
    await screen.findByTestId('guide-cuentas-lista');
    await fireEvent.press(await screen.findByRole('button', { name: /Efectivo, saldo actual/ }));
    await screen.findByLabelText('Secciones de la cuenta');
    expect(guideOf('cuentas-lista')).toBeNull();

    // Calendario vacío: guía; se descarta.
    await fireEvent.press(tab('Calendario'));
    await screen.findByTestId('guide-calendario');
    await fireEvent.press(closeButton());
    expect(guideOf('calendario')).toBeNull();

    // Otra cuenta (selector) y otra pestaña y vuelta: no reaparece.
    await fireEvent.press(screen.getByRole('button', { name: /^Cuenta Efectivo/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: /^Banco/ }));
    await screen.findByText('No hay movimientos en este mes.');
    await settle();
    expect(guideOf('calendario')).toBeNull();
    await fireEvent.press(tab('Reportes'));
    await screen.findByTestId('guide-reportes');
    await fireEvent.press(tab('Calendario'));
    await settle();
    expect(guideOf('calendario')).toBeNull();

    // Más > Ver ayudas otra vez: efecto inmediato, el aviso sale en el Snackbar del navegador.
    await fireEvent.press(tab('Más'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver ayudas otra vez' }));
    expect(await screen.findByText(HELP_RESET_DONE)).toBeTruthy();
    await fireEvent.press(tab('Calendario'));
    expect(await screen.findByTestId('guide-calendario')).toBeTruthy();
    expect(seenIn(storage)).toEqual([]);
  });

  it('cambio de usuario: otro usuario monta su propia clave y no ve los ids del anterior', async () => {
    const storage = memoryGuideStorage({
      guias_v1_u: guideRecord('cuentas-lista'),
      guias_v1_otro: guideRecord(),
    });
    const api = makeApi();
    const view = await render(withGuides(<MainNavigator api={api} />, storage, 'u'));
    await screen.findByRole('button', { name: /Efectivo, saldo actual/ });
    await settle();
    expect(guideOf('cuentas-lista')).toBeNull();
    await view.rerender(withGuides(<MainNavigator key="otro" api={api} />, storage, 'otro'));
    expect(await screen.findByTestId('guide-cuentas-lista')).toBeTruthy();
    await fireEvent.press(closeButton());
    await settle();
    expect(seenIn(storage, 'guias_v1_otro')).toEqual(['cuentas-lista']);
    expect(seenIn(storage, 'guias_v1_u')).toEqual(['cuentas-lista']);
  });
});
