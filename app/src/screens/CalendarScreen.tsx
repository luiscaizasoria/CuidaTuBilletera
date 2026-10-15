import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import {
  MONTH_NAMES,
  buildMonthGrid,
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
import { Button, ErrorBox, screenStyles as s } from './ui';

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
}: {
  account: Account;
  api: ResourcesApi;
  initialMonth: string;
  initialDay: string;
  onViewChange: (month: string, day: string) => void;
  onOpenTransaction: (transaction: Transaction) => void;
  onNewTransaction: (fecha: string) => void;
}) {
  const { authorizedCall } = useAuth();
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
    if (next) changeView(next, defaultDay(next.year, next.month, today));
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
  const showTotal = (cents: number | null) => (cents === null ? '—' : formatCents(cents));

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        Calendario de {account.nombre}
      </Text>

      <View style={styles.monthBar}>
        <Button
          label="‹"
          accessibilityLabel="Mes anterior"
          disabled={prevDisabled}
          onPress={() => goToMonth(-1)}
        />
        <Text accessibilityRole="header" style={styles.monthTitle}>
          {monthTitle(ym.year, ym.month)}
        </Text>
        <Button
          label="›"
          accessibilityLabel="Mes siguiente"
          disabled={nextDisabled}
          onPress={() => goToMonth(1)}
        />
      </View>

      <View style={styles.weekRow}>
        {weekdayHeaders().map((header, index) => (
          <Text
            key={index}
            accessibilityLabel={header.long}
            style={styles.weekHeader}
            allowFontScaling={false}
          >
            {header.short}
          </Text>
        ))}
      </View>
      {grid.map((week, row) => (
        <View key={row} style={styles.weekRow}>
          {week.map((cellDay, col) => {
            if (cellDay === null) return <View key={col} style={styles.cell} />;
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
                style={[
                  styles.cell,
                  styles.cellActive,
                  isToday && styles.cellToday,
                  selected && styles.cellSelected,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.dayNumber, isToday && styles.todayText]}
                >
                  {cellDay}
                </Text>
                {entry && entry.ingresos > 0 ? (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.amount, styles.income]}
                  >
                    +{formatCompactCents(entry.ingresos)}
                  </Text>
                ) : null}
                {entry && entry.gastos > 0 ? (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.amount, styles.expense]}
                  >
                    −{formatCompactCents(entry.gastos)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {month === null ? (
        <ActivityIndicator size="small" testID="calendar-loading" style={styles.spacer} />
      ) : month.status === 'error' ? (
        <ErrorBox
          message={month.message}
          onRetry={() => setMonthReload((n) => n + 1)}
          retryAccessibilityLabel="Reintentar calendario"
        />
      ) : (
        <>
          {entries.size === 0 ? (
            <Text style={s.muted}>No hay movimientos en este mes</Text>
          ) : (
            <Text style={s.rowSubtitle}>
              Mes: Ingresos {showTotal(totals.ingresos)} · Gastos {showTotal(totals.gastos)} · Neto{' '}
              {showTotal(totals.neto)}
            </Text>
          )}
        </>
      )}

      <Text accessibilityRole="header" style={s.section}>
        {selectedParsed ? dayLabel(selectedParsed.day, selectedParsed.month) : day}
      </Text>
      {month?.status === 'ready' ? (
        <Text>
          {selectedEntry
            ? `Ingresos ${formatCents(selectedEntry.ingresos)} · Gastos ${formatCents(selectedEntry.gastos)} · Neto ${formatCents(selectedEntry.ingresos - selectedEntry.gastos)}`
            : 'Sin movimientos este día'}
        </Text>
      ) : null}
      <View style={s.actions}>
        <Button label="Nuevo movimiento" variant="primary" onPress={() => onNewTransaction(day)} />
      </View>

      {dayData === null ? (
        <ActivityIndicator size="large" testID="day-loading" style={styles.spacer} />
      ) : dayData.status === 'error' ? (
        <ErrorBox
          message={dayData.message}
          onRetry={() => setDayReload((n) => n + 1)}
          retryAccessibilityLabel="Reintentar movimientos del día"
        />
      ) : dayData.items.length === 0 ? (
        <Text style={s.muted}>Este día no tiene movimientos registrados</Text>
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
            <Button label="Cargar más" disabled={loadingMore} onPress={() => void loadMore()} />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: '#555555',
    paddingVertical: 4,
  },
  cell: { flex: 1, minHeight: 56, margin: 1, padding: 2, alignItems: 'center' },
  cellActive: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 6 },
  cellToday: { borderColor: '#1a73e8' },
  cellSelected: { backgroundColor: '#e8f0fe', borderColor: '#1a73e8', borderWidth: 2 },
  dayNumber: { fontSize: 14, fontWeight: '600' },
  todayText: { color: '#1a73e8' },
  amount: { fontSize: 10 },
  income: { color: '#2e7d32' },
  expense: { color: '#b3261e' },
  spacer: { marginVertical: 12 },
  error: { color: '#b3261e', marginBottom: 4 },
});
