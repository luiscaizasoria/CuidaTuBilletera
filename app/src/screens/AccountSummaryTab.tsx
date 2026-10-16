// Pestaña Cuenta del Detalle (docs/007 §5.4): saldo, resumen del mes y movimientos de la semana.
// El saldo llega del contenedor (fuente única); los bloques cargan y fallan por separado.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader } from '../hooks/use-loader';
import { monthTitle, parseMonthKey, shiftMonth, monthKey, weekRange } from '../lib/calendar';
import { todayLocal } from '../lib/dates';
import { formatCents } from '../lib/money';
import { monthRange } from '../lib/reports';
import type { Account, ResourcesApi, Transaction, TransactionType } from '../lib/resources-api';
import { colors, depth, radii, shadows, sizes, tabularNums, typography } from '../theme/tokens';
import { ArchivedNotice, balanceText } from './account-ui';
import type { BalanceStatus } from './navigation';
import TransactionRow, { categoryMap } from './TransactionRow';
import { Button, Segmented } from './ui';

export const WEEK_LIMIT = 10;
const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

type WeekFilter = 'todos' | TransactionType;

export default function AccountSummaryTab({
  api,
  account,
  balance,
  onRetryBalance,
  month,
  onMonthChange,
  onSeeAll,
  onOpenTransaction,
  justCreated = false,
  bottomInset = 0,
}: {
  api: ResourcesApi;
  account: Account;
  balance: BalanceStatus;
  onRetryBalance: () => void;
  month: string; // AAAA-MM
  onMonthChange: (month: string) => void;
  onSeeAll: () => void;
  onOpenTransaction: (transaction: Transaction) => void;
  justCreated?: boolean;
  bottomInset?: number;
}) {
  const today = todayLocal();
  const ym = parseMonthKey(month) ?? parseMonthKey(today.slice(0, 7)) ?? { year: 2000, month: 1 };
  const prev = shiftMonth(ym.year, ym.month, -1);
  const next = shiftMonth(ym.year, ym.month, 1);
  const saldo = balanceText(account.saldo, balance);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: 16 + bottomInset }]}
    >
      {account.archivada ? <ArchivedNotice /> : null}

      <View testID="balance-card" style={[styles.balanceCard, shadows.raised]}>
        <View style={styles.band} {...hidden} />
        <View style={[styles.circle, styles.circleA]} {...hidden} />
        <View style={[styles.circle, styles.circleB]} {...hidden} />
        <Text style={styles.balanceLabel}>Saldo actual</Text>
        {balance === 'error' || saldo === null ? (
          <View style={styles.balanceError}>
            <Text accessibilityRole="alert" style={styles.balanceErrorText}>
              Saldo no disponible
            </Text>
            <Button
              label="Reintentar"
              accessibilityLabel="Reintentar saldo"
              variant="secondary"
              onPress={onRetryBalance}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.balanceAmount, tabularNums]}>{saldo}</Text>
            {balance === 'refreshing' ? (
              <Text style={styles.balanceRefreshing}>Actualizando…</Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.monthBar}>
        <MonthArrow
          label="‹"
          accessibilityLabel="Mes anterior"
          disabled={prev === null}
          onPress={() => prev && onMonthChange(monthKey(prev.year, prev.month))}
        />
        <Text accessibilityRole="header" style={styles.monthTitle}>
          {monthTitle(ym.year, ym.month)}
        </Text>
        <MonthArrow
          label="›"
          accessibilityLabel="Mes siguiente"
          disabled={next === null}
          onPress={() => next && onMonthChange(monthKey(next.year, next.month))}
        />
      </View>
      <MonthSummary api={api} accountId={account.id} year={ym.year} month={ym.month} />

      <WeekBlock
        api={api}
        account={account}
        today={today}
        justCreated={justCreated}
        onSeeAll={onSeeAll}
        onOpenTransaction={onOpenTransaction}
      />
    </ScrollView>
  );
}

// Flecha de mes: círculo de superficie de 40 dp dentro de una zona táctil de 48 dp.
function MonthArrow({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrowTouch, pressed && styles.arrowPressed]}
    >
      <View
        style={[styles.arrowCircle, shadows.card, disabled && styles.arrowDisabled]}
        {...hidden}
      >
        <Text style={styles.arrowText}>{label}</Text>
      </View>
    </Pressable>
  );
}

function MonthSummary({
  api,
  accountId,
  year,
  month,
}: {
  api: ResourcesApi;
  accountId: string;
  year: number;
  month: number;
}) {
  const { authorizedCall } = useAuth();
  const range = monthRange(year, month);
  const { state, reload } = useLoader(
    () => authorizedCall((token) => api.getReportSummary(token, { accountId, ...range })),
    `${accountId}|${range.desde}`,
  );
  if (state.status === 'loading') {
    return <ActivityIndicator size="small" testID="month-summary-loading" style={styles.spacer} />;
  }
  if (state.status === 'error') {
    return (
      <BlockError
        message="No pudimos cargar el resumen del mes."
        retryLabel="Reintentar resumen del mes"
        onRetry={reload}
      />
    );
  }
  const { ingresos, gastos } = state.data;
  return (
    <View style={styles.grid}>
      <View
        accessible
        accessibilityLabel={`Ingresos ${formatCents(ingresos)}`}
        style={[styles.flowCard, shadows.card]}
      >
        <View style={[styles.bubble, { backgroundColor: colors.incomeSoft }]} {...hidden}>
          <Text style={{ color: colors.incomeText, fontWeight: '800' }}>↑</Text>
        </View>
        <Text style={styles.small}>Ingresos</Text>
        <Text style={[styles.flowAmount, tabularNums, { color: colors.income }]}>
          +{formatCents(ingresos)}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={`Gastos ${formatCents(gastos)}`}
        style={[styles.flowCard, shadows.card]}
      >
        <View style={[styles.bubble, { backgroundColor: colors.expenseSoft }]} {...hidden}>
          <Text style={{ color: colors.expenseText, fontWeight: '800' }}>↓</Text>
        </View>
        <Text style={styles.small}>Gastos</Text>
        <Text style={[styles.flowAmount, tabularNums, { color: colors.expense }]}>
          -{formatCents(gastos)}
        </Text>
      </View>
    </View>
  );
}

function WeekBlock({
  api,
  account,
  today,
  justCreated,
  onSeeAll,
  onOpenTransaction,
}: {
  api: ResourcesApi;
  account: Account;
  today: string;
  justCreated: boolean;
  onSeeAll: () => void;
  onOpenTransaction: (transaction: Transaction) => void;
}) {
  const { authorizedCall } = useAuth();
  const [filter, setFilter] = useState<WeekFilter>('todos');
  const week = weekRange(today);
  const { state, reload } = useLoader(
    () =>
      authorizedCall(async (token) => {
        const [page, categories] = await Promise.all([
          api.listTransactions(token, {
            accountId: account.id,
            ...(week ? { desde: week.desde, hasta: week.hasta } : {}),
            ...(filter !== 'todos' ? { tipo: filter } : {}),
            page: 1,
            pageSize: WEEK_LIMIT,
          }),
          api.listCategories(token, account.id, { incluirArchivadas: true, pageSize: 100 }),
        ]);
        return { items: page.items, categories: categoryMap(categories.items) };
      }),
    `${account.id}|${week?.desde ?? ''}|${filter}`,
  );

  return (
    <View>
      <View style={styles.weekHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Esta semana
        </Text>
        <Button
          label="Ver todo ›"
          accessibilityLabel="Ver todo"
          variant="link"
          onPress={onSeeAll}
        />
      </View>
      <Segmented
        accessibilityLabel="Filtrar semana"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'gasto', label: 'Gastos' },
          { value: 'ingreso', label: 'Ingresos' },
        ]}
      />
      <View style={styles.weekList}>
        {state.status === 'loading' ? (
          <ActivityIndicator size="small" testID="week-loading" style={styles.spacer} />
        ) : state.status === 'error' ? (
          <BlockError
            message="No pudimos cargar los movimientos de la semana."
            retryLabel="Reintentar movimientos de la semana"
            onRetry={reload}
          />
        ) : state.data.items.length === 0 ? (
          <WeekEmpty filter={filter} justCreated={justCreated} archived={account.archivada} />
        ) : (
          state.data.items.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              category={state.data.categories.get(transaction.categoryId)}
              onPress={() => onOpenTransaction(transaction)}
            />
          ))
        )}
      </View>
    </View>
  );
}

function WeekEmpty({
  filter,
  justCreated,
  archived,
}: {
  filter: WeekFilter;
  justCreated: boolean;
  archived: boolean;
}) {
  if (filter !== 'todos') {
    return (
      <Text style={styles.emptyTitle}>
        Esta semana no tienes {filter === 'gasto' ? 'gastos' : 'ingresos'} anotados.
      </Text>
    );
  }
  if (justCreated) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Tu cuenta está lista.</Text>
        <Text style={styles.small}>Anota tu primer gasto o ingreso con el botón +.</Text>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Esta semana no has anotado movimientos.</Text>
      {archived ? null : <Text style={styles.small}>Toca + para registrar el primero.</Text>}
    </View>
  );
}

function BlockError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.blockError}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {message}
      </Text>
      <Button
        label="Reintentar"
        accessibilityLabel={retryLabel}
        variant="primary"
        onPress={onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  spacer: { marginVertical: 12 },
  small: { ...typography.small, color: colors.text2 },
  balanceCard: {
    backgroundColor: colors.brand700,
    borderRadius: radii.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    minHeight: sizes.balanceCardMin,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    width: 300,
    height: 110,
    borderRadius: 55,
    right: -90,
    top: -34,
    backgroundColor: depth.bandColor,
    opacity: depth.bandOpacity,
    transform: [{ rotate: depth.bandRotate }],
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: depth.circleColor,
    opacity: depth.circleOpacity,
  },
  circleA: { width: 120, height: 120, left: -40, bottom: -60 },
  circleB: { width: 70, height: 70, right: 24, bottom: -30 },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: colors.onBrandSoft },
  balanceAmount: { ...typography.amountXl, color: colors.white },
  balanceRefreshing: { ...typography.small, color: colors.onBrandSoft },
  balanceError: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  balanceErrorText: { ...typography.body, fontWeight: '700', color: colors.expenseText },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  arrowTouch: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowPressed: { opacity: 0.85 },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.5 },
  arrowText: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text },
  monthTitle: { ...typography.h2, color: colors.text },
  grid: { flexDirection: 'row', gap: 12 },
  flowCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  bubble: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowAmount: { fontSize: 19, lineHeight: 24, fontWeight: '800' },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  weekList: { marginTop: 12 },
  empty: { gap: 4, paddingVertical: 12 },
  emptyTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  blockError: { alignItems: 'center', padding: 12, gap: 8 },
  errorText: { ...typography.body, color: colors.expenseText, textAlign: 'center' },
});
