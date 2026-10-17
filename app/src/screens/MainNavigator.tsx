import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { todayLocal } from '../lib/dates';
import { clearExports } from '../lib/export-files';
import type { Account, ResourcesApi, Transaction } from '../lib/resources-api';
import { sizes } from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';
import { AccountContextBar, ArchivedNotice, BottomTabs, Fab } from './account-ui';
import AccountsScreen from './AccountsScreen';
import AccountSummaryTab from './AccountSummaryTab';
import CalendarScreen from './CalendarScreen';
import CategoriesScreen from './CategoriesScreen';
import HistoryScreen from './HistoryScreen';
import MoreScreen from './MoreScreen';
import {
  initialDetail,
  needsDetail,
  resolveBack,
  ROOT,
  type DetailState,
  type DetailViews,
  type NavState,
  type Route,
  type Tab,
} from './navigation';
import NewAccountScreen from './NewAccountScreen';
import ReportsScreen from './ReportsScreen';
import { AccountSwitcherSheet } from './sheets';
import TransactionFormScreen from './TransactionFormScreen';
import { Screen, Snackbar, useScreenMargin } from './ui';

const FAB_TABS: readonly Tab[] = ['cuenta', 'movimientos', 'calendario'];

// Navegación sin dependencias (docs/003, Decisiones R0 D1–D3 y R2 D1–D6): pila en estado local,
// Detalle de cuenta con la cuenta activa como fuente única y un solo listener de Atrás. Al cerrar
// sesión el navegador se desmonta: la pila, la cuenta activa y los datos no sobreviven.
export default function MainNavigator({ api }: { api: ResourcesApi }) {
  const { authorizedCall } = useAuth();
  const insets = useSystemInsets();
  const margin = useScreenMargin();
  const [nav, setNav] = useState<NavState>({ stack: ROOT, detail: null });
  const [snack, setSnack] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tabsHeight, setTabsHeight] = useState<number | null>(null);
  // Soporte de color e ícono de cuenta (docs/003 D12), solo en memoria: una vez true no vuelve a
  // false por una lista vacía o sin claves; solo un rechazo 400 de la API lo apaga y ya no se reactiva.
  const [appearanceSupported, setAppearanceSupported] = useState(false);
  const appearanceRejected = useRef(false);
  const noteAppearanceSupport = (supported: boolean | null) => {
    if (supported === true && !appearanceRejected.current) setAppearanceSupported(true);
  };
  const rejectAppearance = () => {
    appearanceRejected.current = true;
    setAppearanceSupported(false);
  };

  const navRef = useRef(nav);
  navRef.current = nav;
  const callRef = useRef({ api, authorizedCall });
  callRef.current = { api, authorizedCall };

  // Al cerrar sesión (o cambiar de usuario) el navegador se desmonta: se borran los archivos exportados.
  useEffect(() => clearExports, []);

  // Una sola suscripción; la lógica es la función pura `resolveBack`.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resolveBack(navRef.current) === null) return false; // raíz: sale de la app
      setNav((current) => resolveBack(current) ?? current);
      return true;
    });
    return () => subscription.remove();
  }, []);

  // Actualiza la cuenta activa solo si sigue siendo `accountId` (descarta respuestas tardías).
  const updateDetail = (accountId: string, change: (detail: DetailState) => DetailState) =>
    setNav((current) =>
      current.detail && current.detail.account.id === accountId
        ? { ...current, detail: change(current.detail) }
        : current,
    );

  const accountId = nav.detail?.account.id;
  const refreshKey = nav.detail?.refreshKey ?? 0;
  // Relectura del saldo tras una escritura (refreshKey > 0). Conserva el último saldo mientras lee.
  useEffect(() => {
    if (accountId === undefined || refreshKey === 0) return undefined;
    let cancelled = false;
    const isCurrent = () => !cancelled && navRef.current.detail?.account.id === accountId;
    updateDetail(accountId, (detail) => ({ ...detail, balance: 'refreshing' }));
    const { api: currentApi, authorizedCall: call } = callRef.current;
    call((token) => currentApi.getAccountBalance(token, accountId)).then(
      (result) => {
        if (!isCurrent() || result.accountId !== accountId) return;
        updateDetail(accountId, (detail) => ({
          ...detail,
          balance: 'ok',
          account: { ...detail.account, saldo: result.saldo, saldoInicial: result.saldoInicial },
        }));
      },
      () => {
        if (isCurrent()) updateDetail(accountId, (detail) => ({ ...detail, balance: 'error' }));
      },
    );
    return () => {
      cancelled = true;
    };
    // updateDetail solo usa setNav (estable).
  }, [accountId, refreshKey]);

  const push = (route: Route) =>
    setNav((current) => ({ ...current, stack: [...current.stack, route] }));
  const pop = () => setNav((current) => resolveBackStack(current));
  const goToAccounts = () => {
    setSwitcherOpen(false);
    setNav({ stack: ROOT, detail: null });
  };
  const openAccount = (account: Account) => {
    setArchivedOpen(false);
    setNav({ stack: [...ROOT, { name: 'detail' }], detail: initialDetail(account, todayLocal()) });
  };
  const setTab = (tab: Tab) =>
    setNav((current) =>
      current.detail ? { ...current, detail: { ...current.detail, tab } } : current,
    );
  const updateViews = (id: string, views: Partial<DetailViews>) =>
    updateDetail(id, (detail) => ({ ...detail, views: { ...detail.views, ...views } }));
  const retryBalance = (id: string) =>
    updateDetail(id, (detail) => ({ ...detail, refreshKey: detail.refreshKey + 1 }));
  const markArchived = (id: string) =>
    updateDetail(id, (detail) => ({ ...detail, account: { ...detail.account, archivada: true } }));
  const isActive = (id: string) => navRef.current.detail?.account.id === id;

  const route = nav.stack[nav.stack.length - 1] ?? ROOT[0]!;
  const detail = nav.detail;
  // Una ruta que necesita la cuenta activa sin tenerla vuelve a Mis cuentas.
  const orphan = needsDetail(route) && detail === null;
  useEffect(() => {
    if (orphan) setNav({ stack: ROOT, detail: null });
  }, [orphan]);

  let content: ReactNode;
  let snackOffset = 0;

  if (route.name === 'newAccount') {
    content = (
      <Screen>
        <NewAccountScreen
          api={api}
          appearanceSupported={appearanceSupported}
          onAppearanceRejected={rejectAppearance}
          onBack={pop}
          onCreated={(account) => {
            setNav({
              stack: [...ROOT, { name: 'detail' }],
              detail: initialDetail(account, todayLocal(), true),
            });
            setSnack('Cuenta creada. Ya puedes anotar movimientos.');
          }}
        />
      </Screen>
    );
  } else if (route.name === 'accounts' || detail === null) {
    content = (
      <Screen>
        <AccountsScreen
          api={api}
          onOpenAccount={openAccount}
          onCreateAccount={() => push({ name: 'newAccount' })}
          onNotify={setSnack}
          onAppearanceSupport={noteAppearanceSupport}
          initialArchivedOpen={archivedOpen}
        />
      </Screen>
    );
  } else {
    const { account } = detail;
    const openEdit = (transaction: Transaction) => {
      if (transaction.accountId !== account.id) return;
      push({ name: 'editTx', transaction });
    };

    if (route.name === 'detail') {
      const fabVisible = FAB_TABS.includes(detail.tab);
      const fabSpace = sizes.fab + 32 + (account.archivada ? 40 : 0);
      const bottomInset = fabVisible ? fabSpace : 0;
      const tabsRow =
        tabsHeight === null ? sizes.tabHeight : Math.max(0, tabsHeight - insets.bottom);
      snackOffset = tabsRow + (fabVisible ? sizes.fab + 16 : 0);
      content = (
        <Screen scroll={false} padded={false} bottomBar statusBar="surface">
          <AccountContextBar
            account={account}
            balance={detail.balance}
            variant="full"
            showBalance={detail.tab !== 'cuenta'}
            balanceWord={detail.tab === 'reportes' ? 'saldo actual' : 'saldo'}
            exitLabel="‹ Mis cuentas"
            exitAccessibilityLabel="Volver a Mis cuentas"
            onExit={goToAccounts}
            onRetry={() => retryBalance(account.id)}
            onOpenSwitcher={() => setSwitcherOpen(true)}
          />
          <View key={account.id} style={styles.flex}>
            {renderTab(detail, bottomInset)}
            {fabVisible ? (
              <Fab disabled={account.archivada} onPress={() => push({ name: 'newTx' })} />
            ) : null}
          </View>
          <BottomTabs
            active={detail.tab}
            onChange={setTab}
            onLayout={(event) => setTabsHeight(event.nativeEvent.layout.height)}
          />
          <AccountSwitcherSheet
            visible={switcherOpen}
            onClose={() => setSwitcherOpen(false)}
            api={api}
            currentId={account.archivada ? null : account.id}
            onSelect={(next) => {
              setSwitcherOpen(false);
              if (next.id === navRef.current.detail?.account.id) return;
              // Conserva la pestaña; reinicia vistas, saldo y relectura (sin datos de la anterior).
              setNav((current) => ({
                ...current,
                detail: {
                  ...initialDetail(next, todayLocal()),
                  tab: current.detail?.tab ?? 'cuenta',
                },
              }));
              AccessibilityInfo.announceForAccessibility?.(`Ahora estás en ${next.nombre}`);
            }}
            onSeeAll={goToAccounts}
            onAppearanceSupport={noteAppearanceSupport}
          />
        </Screen>
      );
    } else if (route.name === 'newTx' || route.name === 'editTx') {
      const transaction = route.name === 'editTx' ? route.transaction : undefined;
      content = (
        // `bottomBar`: el pie del formulario ya suma el margen inferior del sistema (una sola vez).
        <Screen scroll={false} padded={false} statusBar="surface" bottomBar>
          <AccountContextBar account={account} balance={detail.balance} variant="compact" />
          <View style={styles.flex}>
            <TransactionFormScreen
              key={`${account.id}:${transaction?.id ?? 'new'}`}
              account={account}
              api={api}
              transaction={transaction}
              initialFecha={route.name === 'newTx' ? route.fecha : undefined}
              onDone={(changed, message) => {
                if (message) setSnack(message);
                setNav((current) => {
                  const top = current.stack[current.stack.length - 1];
                  if (top?.name !== 'newTx' && top?.name !== 'editTx') return current;
                  const next = resolveBackStack(current);
                  return changed && next.detail && next.detail.account.id === account.id
                    ? {
                        ...next,
                        detail: { ...next.detail, refreshKey: next.detail.refreshKey + 1 },
                      }
                    : next;
                });
              }}
              onAccountArchived={markArchived}
            />
          </View>
        </Screen>
      );
    } else if (route.name === 'categories') {
      content = (
        <Screen scroll={false} padded={false} statusBar="surface">
          <AccountContextBar
            account={account}
            balance={detail.balance}
            variant="readOnly"
            exitLabel="‹ Más"
            exitAccessibilityLabel="Volver a Más"
            onExit={pop}
            onRetry={() => retryBalance(account.id)}
          />
          <View style={styles.flex}>
            <CategoriesScreen
              key={account.id}
              account={account}
              api={api}
              onAccountArchived={markArchived}
            />
          </View>
        </Screen>
      );
    } else {
      // historyFiltered (Movimientos filtrados desde Reportes; Atrás vuelve a Reportes).
      const filters = route.name === 'historyFiltered' ? route.filters : undefined;
      content = (
        <Screen scroll={false} padded={false} statusBar="surface">
          <AccountContextBar
            account={account}
            balance={detail.balance}
            variant="readOnly"
            exitLabel="‹ Reportes"
            exitAccessibilityLabel="Volver a Reportes"
            onExit={pop}
            onRetry={() => retryBalance(account.id)}
          />
          <View style={styles.flex}>
            <HistoryScreen
              key={account.id}
              account={account}
              api={api}
              initialFilters={filters}
              onOpenTransaction={openEdit}
            />
          </View>
        </Screen>
      );
    }

    // Solo se monta la pestaña activa; su estado vive en `detail.views` (R2 D5).
    function renderTab(current: DetailState, bottomInset: number): ReactNode {
      const { account: active, views } = current;
      // Modo consulta (docs/007 14.12): las pantallas reutilizadas no lo muestran por sí mismas.
      const archivedNotice = active.archivada ? (
        <View style={[styles.notice, { paddingHorizontal: margin }]}>
          <ArchivedNotice />
        </View>
      ) : null;
      switch (current.tab) {
        case 'movimientos':
          return (
            <>
              {archivedNotice}
              <HistoryScreen
                account={active}
                api={api}
                initialFilters={views.history}
                onFiltersChange={(history) => updateViews(active.id, { history })}
                onOpenTransaction={openEdit}
                bottomInset={bottomInset}
              />
            </>
          );
        case 'calendario':
          return (
            <>
              {archivedNotice}
              <CalendarScreen
                account={active}
                api={api}
                initialMonth={views.calendar.month}
                initialDay={views.calendar.day}
                onViewChange={(month, day) => updateViews(active.id, { calendar: { month, day } })}
                onOpenTransaction={openEdit}
                onNewTransaction={(fecha) => push({ name: 'newTx', fecha })}
                canCreate={!active.archivada}
                bottomInset={bottomInset}
              />
            </>
          );
        case 'reportes':
          return (
            <ReportsScreen
              account={active}
              api={api}
              initialView={views.reports}
              onViewChange={(reports) => updateViews(active.id, { reports })}
              onOpenHistory={(filters) => push({ name: 'historyFiltered', filters })}
            />
          );
        case 'mas':
          return (
            <MoreScreen
              api={api}
              account={active}
              appearanceSupported={appearanceSupported}
              onAppearanceRejected={rejectAppearance}
              onAccountUpdated={(updated) => {
                if (!isActive(updated.id)) return;
                updateDetail(updated.id, (d) => ({ ...d, account: updated }));
                setSnack('Cuenta actualizada');
              }}
              onArchived={(archived) => {
                if (!isActive(archived.id)) return;
                setArchivedOpen(true);
                setNav({ stack: ROOT, detail: null });
                setSnack(`${archived.nombre} archivada. La encuentras en Archivadas.`);
              }}
              onOpenCategories={() => push({ name: 'categories' })}
              onOpenExport={() => setTab('reportes')}
              onNotify={setSnack}
            />
          );
        default:
          return (
            <AccountSummaryTab
              api={api}
              account={active}
              balance={current.balance}
              onRetryBalance={() => retryBalance(active.id)}
              month={views.summaryMonth}
              onMonthChange={(summaryMonth) => updateViews(active.id, { summaryMonth })}
              onSeeAll={() => setTab('movimientos')}
              onOpenTransaction={openEdit}
              justCreated={current.justCreated}
              bottomInset={bottomInset}
            />
          );
      }
    }
  }

  return (
    <View style={styles.flex}>
      {content}
      <Snackbar
        message={snack}
        onDismiss={() => setSnack(null)}
        bottomOffset={snackOffset}
        testID="snackbar"
      />
    </View>
  );
}

// Retira la ruta superior (botones «‹» y fin del formulario); en la raíz no hace nada.
function resolveBackStack(current: NavState): NavState {
  if (current.stack.length <= 1) return current;
  const stack = current.stack.slice(0, -1);
  const top = stack[stack.length - 1];
  return { stack, detail: top && needsDetail(top) ? current.detail : null };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: { paddingHorizontal: 16 },
});
