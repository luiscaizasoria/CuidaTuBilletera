import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import {
  CALENDAR_CELL_GAP,
  MONTH_NAMES,
  buildMonthGrid,
  calendarCellWidth,
  dateKey,
  defaultDay,
  initialMonthFor,
  monthKey,
  monthTitle,
  monthTotals,
  parseDateKey,
  parseMonthKey,
  shiftMonth,
  weekdayHeaders,
  type YearMonth,
} from '../lib/calendar';
import { todayLocal } from '../lib/dates';
import { mergeById } from '../lib/list-utils';
import { formatCents, formatCompactCents } from '../lib/money';
import type {
  Account,
  CalendarDay,
  CalendarMonth,
  Category,
  ResourcesApi,
  Transaction,
} from '../lib/resources-api';
import { resourceErrorMessage } from '../lib/resources-messages';
import TransactionRow, { categoryMap } from './TransactionRow';
import { colors, moduleColors, radii, sizes, typography } from '../theme/tokens';
import {
  Button,
  Card,
  ErrorBox,
  MonthArrow,
  ScreenTitle,
  SummaryTile,
  useScreenContainerStyle,
  screenStyles as s,
} from './ui';

export const CALENDAR_PAGE_SIZE = 20;

type MonthState =
  | { status: 'loading' }
  | { status: 'error'; key: string; message: string }
  | { status: 'ready'; key: string; data: CalendarMonth };

type DayState =
  | { status: 'loading' }
  | { status: 'error'; key: string; message: string }
  | {
      status: 'ready';
      key: string;
      items: Transaction[];
      page: number;
      total: number;
      categories: Map<string, Category>;
    };

const plural = (count: number) => `${count} ${count === 1 ? 'movimiento' : 'movimientos'}`;

function dayLabel(day: number, month: number): string {
  return `${day} de ${MONTH_NAMES[month - 1]!.toLowerCase()}`;
}

function cellLabel(day: number, month: number, entry: CalendarDay | undefined, today: boolean) {
  const base = dayLabel(day, month);
  const suffix = today ? ', hoy' : '';
  if (!entry) return `${base}${suffix}`;
  return `${base}: ingresos ${formatCents(entry.ingresos)}, gastos ${formatCents(entry.gastos)}, ${plural(entry.cantidad)}${suffix}`;
}

// Mes y día iniciales: los recibidos si son válidos; si no, el mes de hoy y su día por defecto.
function initialView(initialMonth: string, initialDay: string, today: string) {
  const ym: YearMonth = parseMonthKey(initialMonth) ?? initialMonthFor(today);
  const parsed = parseDateKey(initialDay);
  const day =
    parsed && parsed.year === ym.year && parsed.month === ym.month
      ? initialDay
      : defaultDay(ym.year, ym.month, today);
  return { ym, day };
}

export default function CalendarScreen({
  account,
  api,
  initialMonth,
  initialDay,
  onViewChange,
  onOpenTransaction,
  onNewTransaction,
  canCreate = true,
  bottomInset,
}: {
  account: Account;
  api: ResourcesApi;
  initialMonth: string;
  initialDay: string;
  onViewChange: (month: string, day: string) => void;
  onOpenTransaction: (transaction: Transaction) => void;
  onNewTransaction: (fecha: string) => void;
  // false con la cuenta archivada: «Nuevo movimiento» del día queda deshabilitado.
  canCreate?: boolean;
  // Margen inferior extra del contenido (p. ej. para no quedar bajo el botón flotante).
  bottomInset?: number;
}) {
  const { authorizedCall } = useAuth();
  const containerStyle = useScreenContainerStyle();
  const { width: windowWidth } = useWindowDimensions();
  const cellWidth = calendarCellWidth(windowWidth);
  const today = todayLocal();
  const [view, setView] = useState(() => initialView(initialMonth, initialDay, today));
  const [monthState, setMonthState] = useState<MonthState>({ status: 'loading' });
  const [dayState, setDayState] = useState<DayState>({ status: 'loading' });
  const [monthReload, setMonthReload] = useState(0);
  const [dayReload, setDayReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  // Identifica la consulta vigente del día: una respuesta anterior se descarta.
  const generation = useRef(0);

  const { ym, day } = view;
  const currentMonthKey = monthKey(ym.year, ym.month);
  const monthLoadKey = `${account.id}|${currentMonthKey}|${monthReload}`;
  const dayLoadKey = `${account.id}|${day}|${dayReload}`;

  const callRef = useRef({ api, authorizedCall });
  useEffect(() => {
    callRef.current = { api, authorizedCall };
  });

  // Carga A: totales del mes.
  useEffect(() => {
    let cancelled = false;
    const { api: currentApi, authorizedCall: call } = callRef.current;
    call((token) =>
      currentApi.getCalendar(token, { accountId: account.id, month: currentMonthKey }),
    ).then(
      (data) => {
        if (!cancelled) setMonthState({ status: 'ready', key: monthLoadKey, data });
      },
      (error: unknown) => {
        if (!cancelled) {
          setMonthState({
            status: 'error',
            key: monthLoadKey,
            message: resourceErrorMessage(error),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [account.id, currentMonthKey, monthLoadKey]);

  // Carga B: primera página del día y categorías.
  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setMoreError(null);
    setLoadingMore(false);
    const { api: currentApi, authorizedCall: call } = callRef.current;
    call(async (token) => {
      const [page, categories] = await Promise.all([
        currentApi.listTransactions(token, {
          accountId: account.id,
          desde: day,
          hasta: day,
          pageSize: CALENDAR_PAGE_SIZE,
          page: 1,
        }),
        currentApi.listCategories(token, account.id, { incluirArchivadas: true, pageSize: 100 }),
      ]);
      return { page, categories: categoryMap(categories.items) };
    }).then(
      ({ page, categories }) => {
        if (!cancelled) {
          setDayState({
            status: 'ready',
            key: dayLoadKey,
            items: page.items,
            page: page.page,
            total: page.total,
            categories,
          });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setDayState({ status: 'error', key: dayLoadKey, message: resourceErrorMessage(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [account.id, day, dayLoadKey]);

  // Un estado de otra consulta (otro mes, día o cuenta) cuenta como «cargando».
  const month =
    monthState.status !== 'loading' && monthState.key === monthLoadKey ? monthState : null;
  const dayData = dayState.status !== 'loading' && dayState.key === dayLoadKey ? dayState : null;

  const entries = new Map<string, CalendarDay>();
  if (month?.status === 'ready')
    for (const entry of month.data.days) entries.set(entry.fecha, entry);
  const selectedEntry = entries.get(day);

  function changeView(nextYm: YearMonth, nextDay: string) {
    setView({ ym: nextYm, day: nextDay });
    onViewChange(monthKey(nextYm.year, nextYm.month), nextDay);
  }

  function goToMonth(delta: number) {
    const next = shiftMonth(ym.year, ym.month, delta);
    if (next) {
      changeView(next, defaultDay(next.year, next.month, today));
      // El foco queda en la flecha: se anuncia el mes nuevo (docs/007 §5.11 D.1).
      AccessibilityInfo.announceForAccessibility?.(monthTitle(next.year, next.month));
    }
  }

  async function loadMore() {
    if (dayData?.status !== 'ready' || loadingMore) return;
    const current = generation.current;
    const nextPage = dayData.page + 1;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await authorizedCall((token) =>
        api.listTransactions(token, {
          accountId: account.id,
          desde: day,
          hasta: day,
          pageSize: CALENDAR_PAGE_SIZE,
          page: nextPage,
        }),
      );
      if (current !== generation.current) return;
      setDayState((previous) =>
        previous.status === 'ready' && previous.key === dayLoadKey
          ? {
              ...previous,
              items: mergeById(previous.items, result.items),
              page: result.page,
              total: result.total,
            }
          : previous,
      );
    } catch (error) {
      if (current === generation.current) setMoreError(resourceErrorMessage(error));
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  }

  const grid = buildMonthGrid(ym.year, ym.month);
  const prevDisabled = shiftMonth(ym.year, ym.month, -1) === null;
  const nextDisabled = shiftMonth(ym.year, ym.month, 1) === null;
  const selectedParsed = parseDateKey(day);
  const hasMore = dayData?.status === 'ready' && dayData.items.length < dayData.total;

  const totals = monthTotals([...entries.values()]);
  const monthName = MONTH_NAMES[ym.month - 1]!.toLowerCase();
  const income = totals.ingresos === null ? '—' : `+${formatCents(totals.ingresos)}`;
  const expense = totals.gastos === null ? '—' : `-${formatCents(totals.gastos)}`;
  const net = totals.neto === null ? '—' : formatCents(totals.neto);
  const spoken = (cents: number | null) => (cents === null ? 'no disponible' : formatCents(cents));
  const dayTitle = selectedParsed ? dayLabel(selectedParsed.day, selectedParsed.month) : day;
  const cellSize = { width: cellWidth, height: sizes.calendarCellHeight };

  return (
    <ScrollView
      style={containerStyle}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={bottomInset ? { paddingBottom: bottomInset } : undefined}
    >
      <ScreenTitle title="Calendario" module="calendario" />

      <View style={styles.monthBar}>
        <MonthArrow
          glyph="‹"
          label="Mes anterior"
          disabled={prevDisabled}
          onPress={() => goToMonth(-1)}
        />
        <Text accessibilityRole="header" style={styles.monthTitle}>
          {monthTitle(ym.year, ym.month)}
        </Text>
        <MonthArrow
          glyph="›"
          label="Mes siguiente"
          disabled={nextDisabled}
          onPress={() => goToMonth(1)}
        />
      </View>

      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {weekdayHeaders().map((header, index) => (
            <Text
              key={index}
              accessibilityLabel={header.long}
              style={[styles.weekHeader, { width: cellWidth }]}
              allowFontScaling={false}
            >
              {header.short}
            </Text>
          ))}
        </View>
        {grid.map((week, row) => (
          <View key={row} style={styles.weekRow}>
            {week.map((cellDay, col) => {
              if (cellDay === null) return <View key={col} style={cellSize} />;
              const key = dateKey(ym.year, ym.month, cellDay);
              const entry = entries.get(key);
              const selected = key === day;
              const isToday = key === today;
              return (
                <Pressable
                  key={col}
                  testID={`calendar-cell-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={cellLabel(cellDay, ym.month, entry, isToday)}
                  accessibilityState={{ selected }}
                  onPress={() => changeView(ym, key)}
                  style={({ pressed }) => [
                    styles.cell,
                    cellSize,
                    isToday && styles.cellToday,
                    selected && styles.cellSelected,
                    isToday && selected && styles.cellTodaySelected,
                    pressed && styles.cellPressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.dayNumber,
                      isToday && styles.dayNumberToday,
                      selected && styles.onSelected,
                    ]}
                  >
                    {cellDay}
                  </Text>
                  {entry && entry.ingresos > 0 ? (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.amount, selected ? styles.onSelected : styles.income]}
                    >
                      +{formatCompactCents(entry.ingresos)}
                    </Text>
                  ) : null}
                  {entry && entry.gastos > 0 ? (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.amount, selected ? styles.onSelected : styles.expense]}
                    >
                      −{formatCompactCents(entry.gastos)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {month === null ? (
        <ActivityIndicator
          size="small"
          color={colors.brand700}
          testID="calendar-loading"
          style={styles.spacer}
        />
      ) : month.status === 'error' ? (
        <View style={styles.block}>
          <ErrorBox
            message={month.message}
            onRetry={() => setMonthReload((n) => n + 1)}
            retryAccessibilityLabel="Reintentar calendario"
          />
        </View>
      ) : entries.size === 0 ? (
        <Text style={[s.muted, styles.block]}>No hay movimientos en este mes.</Text>
      ) : (
        <View
          testID="month-summary"
          accessible
          accessibilityLabel={`Resumen de ${monthName}: ingresos ${spoken(totals.ingresos)}, gastos ${spoken(totals.gastos)}, neto ${spoken(totals.neto)}`}
          style={styles.block}
        >
          <Text style={styles.summaryTitle}>Resumen de {monthName}</Text>
          <View style={styles.summaryRow}>
            <SummaryTile kind="income" label="Ingresos" value={income} />
            <SummaryTile kind="expense" label="Gastos" value={expense} />
          </View>
          <View style={styles.summaryNet}>
            <SummaryTile kind="neutral" label="Neto" value={net} wide />
          </View>
        </View>
      )}

      <Card style={[styles.dayCard, styles.block]}>
        <Text accessibilityRole="header" style={styles.dayTitle}>
          {dayTitle}
        </Text>
        {month?.status === 'ready' && selectedEntry ? (
          <Text
            style={styles.dayTotals}
            accessibilityLabel={`Ingresos ${formatCents(selectedEntry.ingresos)}, gastos ${formatCents(selectedEntry.gastos)}, neto ${formatCents(selectedEntry.ingresos - selectedEntry.gastos)}`}
          >
            <Text style={styles.dayIncome}>Ingresos +{formatCents(selectedEntry.ingresos)}</Text>
            <Text style={styles.daySeparator}> · </Text>
            <Text style={styles.dayExpense}>Gastos -{formatCents(selectedEntry.gastos)}</Text>
            <Text style={styles.daySeparator}> · </Text>
            <Text style={styles.dayNet}>
              Neto {formatCents(selectedEntry.ingresos - selectedEntry.gastos)}
            </Text>
          </Text>
        ) : null}
        {dayData?.status === 'ready' && dayData.items.length === 0 ? (
          <Text style={styles.dayEmpty}>Este día no tiene movimientos registrados.</Text>
        ) : null}
        <View style={styles.dayAction}>
          <Button
            label="+ Anotar en este día"
            accessibilityLabel={`Nuevo movimiento el ${dayTitle}`}
            disabled={!canCreate}
            onPress={() => onNewTransaction(day)}
          />
        </View>
      </Card>

      <View style={styles.rows}>
        {dayData === null ? (
          <ActivityIndicator
            size="large"
            color={colors.brand700}
            testID="day-loading"
            style={styles.spacer}
          />
        ) : dayData.status === 'error' ? (
          <ErrorBox
            message={dayData.message}
            onRetry={() => setDayReload((n) => n + 1)}
            retryAccessibilityLabel="Reintentar movimientos del día"
          />
        ) : (
          <>
            {dayData.items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                category={dayData.categories.get(transaction.categoryId)}
                onPress={() => onOpenTransaction(transaction)}
              />
            ))}
            {moreError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {moreError}
              </Text>
            ) : null}
            {hasMore ? (
              <Button
                label={loadingMore ? 'Cargando…' : 'Cargar más'}
                busy={loadingMore}
                onPress={() => void loadMore()}
              />
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const calendario = moduleColors.calendario;

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchMin,
    marginBottom: 8,
  },
  monthTitle: {
    ...typography.h2,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  grid: { gap: CALENDAR_CELL_GAP },
  weekRow: { flexDirection: 'row', gap: CALENDAR_CELL_GAP },
  weekHeader: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text2,
  },
  // Borde 2 siempre presente: los cambios de estado no mueven el diseño.
  cell: {
    paddingHorizontal: 0,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  cellToday: { borderColor: calendario.strong },
  cellSelected: { backgroundColor: calendario.strong, borderColor: calendario.strong },
  cellTodaySelected: { borderColor: calendario.tile },
  cellPressed: { opacity: 0.85 },
  dayNumber: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: colors.text },
  dayNumberToday: { fontWeight: '800' },
  onSelected: { color: colors.white },
  amount: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  income: { color: colors.incomeText },
  expense: { color: colors.expenseText },
  block: { marginTop: 16 },
  summaryTitle: { ...typography.brandLabel, color: colors.text, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryNet: { marginTop: 8 },
  dayCard: { padding: 12 },
  dayTitle: { ...typography.h2, color: colors.text },
  dayTotals: { ...typography.small, marginTop: 4 },
  dayIncome: { fontWeight: '700', color: colors.incomeText },
  dayExpense: { fontWeight: '700', color: colors.expenseText },
  dayNet: { fontWeight: '700', color: colors.text },
  daySeparator: { color: colors.text2 },
  dayEmpty: { ...typography.small, color: colors.text2, marginTop: 4 },
  dayAction: { marginTop: 12 },
  rows: { marginTop: 8 },
  spacer: { marginVertical: 12 },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText, marginBottom: 4 },
});
