import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader } from '../hooks/use-loader';
import { dayGroupTitle } from '../lib/calendar';
import { formatDateEs, todayLocal } from '../lib/dates';
import {
  type Account,
  type ResourcesApi,
  type Transaction,
  type TransactionType,
} from '../lib/resources-api';
import { mergeById } from '../lib/list-utils';
import { resourceErrorMessage } from '../lib/resources-messages';
import { colors, typography } from '../theme/tokens';
import DatePickerSheet from './DatePickerSheet';
import TransactionRow, { categoryMap } from './TransactionRow';
import {
  Button,
  Card,
  Chip,
  DateField,
  EmptyState,
  ErrorBox,
  LoadingState,
  ScreenTitle,
  Segmented,
  useScreenContainerStyle,
} from './ui';

export const HISTORY_PAGE_SIZE = 20;

export interface HistoryFilters {
  tipo?: TransactionType;
  categoryId?: string;
  desde?: string;
  hasta?: string;
}

interface Filters {
  tipo: TransactionType | null;
  categoryId: string | null;
  desde: string;
  hasta: string;
}

const NO_FILTERS: Filters = { tipo: null, categoryId: null, desde: '', hasta: '' };

// Filtros internos -> filtros de navegación (solo los activos).
function toHistoryFilters(filters: Filters): HistoryFilters {
  return {
    ...(filters.tipo ? { tipo: filters.tipo } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.desde ? { desde: filters.desde } : {}),
    ...(filters.hasta ? { hasta: filters.hasta } : {}),
  };
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: Transaction[]; page: number; total: number };

export const RANGE_ORDER_ERROR = 'La fecha «Desde» no puede ser posterior a «Hasta».';

type RangeField = 'desde' | 'hasta';

const pluralMovimientos = (total: number) =>
  `${total} ${total === 1 ? 'movimiento' : 'movimientos'}`;

export default function HistoryScreen({
  account,
  api,
  onOpenTransaction,
  initialFilters,
  onFiltersChange,
  bottomInset,
}: {
  account: Account;
  api: ResourcesApi;
  onOpenTransaction: (transaction: Transaction) => void;
  // Filtros con los que abre la pantalla (p. ej. desde Reportes). Solo se leen al montar.
  initialFilters?: HistoryFilters;
  // Notifica los filtros aplicados para conservarlos fuera de la pantalla (pestaña Movimientos).
  onFiltersChange?: (filters: HistoryFilters) => void;
  // Margen inferior extra del contenido (p. ej. para no quedar bajo el botón flotante).
  bottomInset?: number;
}) {
  const { authorizedCall } = useAuth();
  const containerStyle = useScreenContainerStyle();
  const [filters, setFilters] = useState<Filters>(() =>
    initialFilters
      ? {
          tipo: initialFilters.tipo ?? null,
          categoryId: initialFilters.categoryId ?? null,
          desde: initialFilters.desde ?? '',
          hasta: initialFilters.hasta ?? '',
        }
      : NO_FILTERS,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [picker, setPicker] = useState<RangeField | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  // Identifica la consulta vigente: una respuesta de una consulta anterior se descarta.
  const generation = useRef(0);

  // Defensa propia ante un cambio de cuenta sin remontar (docs/007 §5.11 B.7): se descartan filtros,
  // lista y mensajes en el mismo render, así que nunca se ve un dato de la cuenta anterior.
  const [shownAccountId, setShownAccountId] = useState(account.id);
  if (shownAccountId !== account.id) {
    setShownAccountId(account.id);
    setFilters(NO_FILTERS);
    setPanelOpen(false);
    setPicker(null);
    setRangeError(null);
    setList({ status: 'loading' });
    setLoadingMore(false);
    setMoreError(null);
  }

  const categories = useLoader(
    () =>
      authorizedCall(async (token) => ({
        accountId: account.id,
        ...(await api.listCategories(token, account.id, {
          incluirArchivadas: true,
          pageSize: 100,
        })),
      })),
    `history-categories:${account.id}`,
  );

  const fetchPage = useCallback(
    (page: number, active: Filters) =>
      authorizedCall((token) =>
        api.listTransactions(token, {
          accountId: account.id,
          page,
          pageSize: HISTORY_PAGE_SIZE,
          ...(active.tipo ? { tipo: active.tipo } : {}),
          ...(active.categoryId ? { categoryId: active.categoryId } : {}),
          ...(active.desde ? { desde: active.desde } : {}),
          ...(active.hasta ? { hasta: active.hasta } : {}),
        }),
      ),
    [account.id, api, authorizedCall],
  );
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  });

  const onFiltersChangeRef = useRef(onFiltersChange);
  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange;
  });
  useEffect(() => {
    onFiltersChangeRef.current?.(toHistoryFilters(filters));
  }, [filters]);

  // Cambiar un filtro, la cuenta (o reintentar) reinicia a la página 1.
  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setList({ status: 'loading' });
    setMoreError(null);
    setLoadingMore(false);
    fetchPageRef.current(1, filters).then(
      (result) => {
        if (!cancelled) {
          setList({ status: 'ready', items: result.items, page: result.page, total: result.total });
        }
      },
      (error: unknown) => {
        if (!cancelled) setList({ status: 'error', message: resourceErrorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filters, reloadCount, account.id]);

  async function loadMore() {
    if (list.status !== 'ready' || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await fetchPage(list.page + 1, filters);
      if (current !== generation.current) return;
      setList((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
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

  const categoryData =
    categories.state.status === 'ready' && categories.state.data.accountId === account.id
      ? categories.state.data
      : null;
  const allCategories = categoryData?.items ?? [];

  function setTipo(tipo: TransactionType | null) {
    setFilters((previous) => {
      // Una categoría de otro tipo daría una lista vacía: se limpia al cambiar el tipo.
      const category = allCategories.find((c) => c.id === previous.categoryId);
      const compatible =
        tipo === null ||
        category === undefined ||
        category.tipo === (tipo === 'gasto' ? 'egreso' : 'ingreso');
      return { ...previous, tipo, categoryId: compatible ? previous.categoryId : null };
    });
  }

  // Elegir una fecha aplica el filtro al instante. Si invierte el rango no se aplica: la hoja se
  // cierra, el botón conserva su valor anterior y se explica el motivo.
  function pickDate(field: RangeField, date: string) {
    setPicker(null);
    const next = { ...filters, [field]: date };
    if (next.desde !== '' && next.hasta !== '' && next.desde > next.hasta) {
      setRangeError(RANGE_ORDER_ERROR);
      return;
    }
    setRangeError(null);
    setFilters(next);
  }

  function clearFilters() {
    setRangeError(null);
    setFilters(NO_FILTERS);
  }

  const byId = categoryMap(allCategories);
  const visibleCategories = allCategories.filter(
    (c) => filters.tipo === null || c.tipo === (filters.tipo === 'gasto' ? 'egreso' : 'ingreso'),
  );
  const hasMore = list.status === 'ready' && list.items.length < list.total;
  const today = todayLocal();

  // Grupos activos (máximo 3: tipo, categoría y rango) y chips de filtro activo.
  const hasRange = filters.desde !== '' || filters.hasta !== '';
  const activeGroups = [filters.tipo !== null, filters.categoryId !== null, hasRange].filter(
    Boolean,
  ).length;
  const filtered = activeGroups > 0;
  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  if (filters.tipo) {
    activeChips.push({
      key: 'tipo',
      label: filters.tipo === 'gasto' ? 'Gastos' : 'Ingresos',
      remove: () => setFilters((previous) => ({ ...previous, tipo: null })),
    });
  }
  if (filters.categoryId) {
    activeChips.push({
      key: 'categoria',
      // Sin el nombre (categorías sin cargar o con error) el texto es neutro y verdadero.
      label: byId.get(filters.categoryId)?.nombre ?? 'Categoría seleccionada',
      remove: () => setFilters((previous) => ({ ...previous, categoryId: null })),
    });
  }
  if (filters.desde) {
    activeChips.push({
      key: 'desde',
      label: `Desde ${formatDateEs(filters.desde)}`,
      remove: () => {
        setRangeError(null);
        setFilters((previous) => ({ ...previous, desde: '' }));
      },
    });
  }
  if (filters.hasta) {
    activeChips.push({
      key: 'hasta',
      label: `Hasta ${formatDateEs(filters.hasta)}`,
      remove: () => {
        setRangeError(null);
        setFilters((previous) => ({ ...previous, hasta: '' }));
      },
    });
  }

  // Agrupación por día sobre la lista ya fusionada, en el orden recibido de la API.
  const groups: { fecha: string; items: Transaction[] }[] = [];
  if (list.status === 'ready') {
    for (const transaction of list.items) {
      const last = groups[groups.length - 1];
      if (last && last.fecha === transaction.fecha) last.items.push(transaction);
      else groups.push({ fecha: transaction.fecha, items: [transaction] });
    }
  }

  const rangeValue = (field: RangeField) => filters[field];
  const rangeLabel = (field: RangeField) => (field === 'desde' ? 'Desde' : 'Hasta');

  return (
    <ScrollView
      style={containerStyle}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={bottomInset ? { paddingBottom: bottomInset } : undefined}
    >
      <ScreenTitle title="Movimientos" module="movimientos" />
      {list.status === 'ready' && list.total > 0 ? (
        <Text style={styles.counter}>{pluralMovimientos(list.total)}</Text>
      ) : null}

      <View style={styles.filtersButton}>
        <Button
          label={activeGroups > 0 ? `Filtros (${activeGroups})` : 'Filtros'}
          accessibilityLabel={
            activeGroups > 0 ? `Filtros, ${activeGroups} activos` : 'Filtros, ninguno activo'
          }
          suffix={panelOpen ? '▴' : '▾'}
          expanded={panelOpen}
          onPress={() => setPanelOpen((open) => !open)}
        />
      </View>

      {panelOpen ? (
        <Card testID="filters-panel" style={styles.panel}>
          <Text style={styles.groupLabel}>Tipo</Text>
          <Segmented
            tone="movimientos"
            accessibilityLabel="Tipo"
            value={filters.tipo ?? 'todos'}
            onChange={(value) => setTipo(value === 'todos' ? null : value)}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'gasto', label: 'Gastos' },
              { value: 'ingreso', label: 'Ingresos' },
            ]}
          />

          <Text style={styles.groupLabel}>Categoría</Text>
          {categories.state.status === 'error' ? (
            <ErrorBox message={categories.state.message} onRetry={categories.reload} />
          ) : (
            <View style={styles.chips} accessibilityRole="radiogroup">
              <Chip
                size="sm"
                tone="movimientos"
                label="Todas"
                accessibilityLabel="Todas las categorías"
                selected={filters.categoryId === null}
                onPress={() => setFilters((previous) => ({ ...previous, categoryId: null }))}
              />
              {visibleCategories.map((category) => (
                <Chip
                  key={category.id}
                  size="sm"
                  tone="movimientos"
                  label={category.archivada ? `${category.nombre} (archivada)` : category.nombre}
                  accessibilityLabel={`Filtrar por ${category.nombre}`}
                  selected={filters.categoryId === category.id}
                  onPress={() =>
                    setFilters((previous) => ({ ...previous, categoryId: category.id }))
                  }
                />
              ))}
            </View>
          )}

          <Text style={styles.groupLabel}>Rango de fechas</Text>
          <View style={styles.rangeRow}>
            {(['desde', 'hasta'] as const).map((field) => {
              const value = rangeValue(field);
              return (
                <DateField
                  key={field}
                  testID={`filter-${field}`}
                  label={rangeLabel(field)}
                  value={value}
                  display={formatDateEs(value)}
                  onPress={() => setPicker(field)}
                />
              );
            })}
          </View>
          {rangeError ? (
            <View style={styles.rangeErrorRow}>
              <Text importantForAccessibility="no" accessibilityElementsHidden style={styles.error}>
                ⚠
              </Text>
              <Text accessibilityRole="alert" style={[styles.error, styles.rangeErrorText]}>
                {rangeError}
              </Text>
            </View>
          ) : null}

          {filtered ? (
            <View style={styles.panelFooter}>
              <Button label="Limpiar filtros" variant="ghost" onPress={clearFilters} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {activeChips.length > 0 ? (
        <View style={styles.activeChips} testID="active-filters">
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              size="sm"
              tone="movimientos"
              role="button"
              check={false}
              selected
              label={chip.label}
              suffix="✕"
              accessibilityLabel={`Quitar filtro: ${chip.label}`}
              onPress={chip.remove}
            />
          ))}
        </View>
      ) : null}

      {!panelOpen && filters.categoryId && categories.state.status === 'error' ? (
        <View style={styles.categoriesNotice}>
          <Text accessibilityRole="alert" style={styles.error}>
            No pudimos cargar los nombres de las categorías. {categories.state.message}
          </Text>
          <Button
            label="Reintentar"
            accessibilityLabel="Reintentar categorías"
            onPress={categories.reload}
          />
        </View>
      ) : null}

      <DatePickerSheet
        visible={picker !== null}
        value={picker ? rangeValue(picker) : ''}
        today={today}
        onSelect={(date) => picker && pickDate(picker, date)}
        onClose={() => setPicker(null)}
      />

      {list.status === 'loading' ? (
        <LoadingState text="Cargando movimientos…" testID="history-loading" />
      ) : list.status === 'error' ? (
        <ErrorBox message={list.message} onRetry={() => setReloadCount((n) => n + 1)} />
      ) : list.items.length === 0 ? (
        filtered ? (
          <EmptyState
            module="movimientos"
            art="filtros"
            message="Ningún movimiento coincide con estos filtros."
            actionLabel="Limpiar filtros"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            module="movimientos"
            art="movimientos"
            title="Aún no hay movimientos"
            message="Cuando anotes el primero, aparecerá aquí."
          />
        )
      ) : (
        <>
          {groups.map((group, index) => (
            <View key={`${index}-${group.fecha}`}>
              <Text accessibilityRole="header" style={styles.dayHeader}>
                {dayGroupTitle(group.fecha, today)}
              </Text>
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={byId.get(transaction.categoryId)}
                  onPress={() => onOpenTransaction(transaction)}
                />
              ))}
            </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  counter: { ...typography.small, color: colors.text2, marginBottom: 12 },
  filtersButton: { alignSelf: 'flex-start' },
  panel: { marginTop: 8, padding: 12 },
  groupLabel: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  rangeRow: { flexDirection: 'row', gap: 8 },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText, marginTop: 4 },
  rangeErrorRow: { flexDirection: 'row', gap: 4 },
  rangeErrorText: { flexShrink: 1 },
  categoriesNotice: { marginTop: 8, gap: 8, alignItems: 'flex-start' },
  panelFooter: { marginTop: 8, alignItems: 'flex-start' },
  activeChips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12, marginTop: 12 },
  dayHeader: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
});
