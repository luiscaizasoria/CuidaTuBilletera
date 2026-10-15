import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader } from '../hooks/use-loader';
import { isValidDateString } from '../lib/dates';
import {
  type Account,
  type ResourcesApi,
  type Transaction,
  type TransactionType,
} from '../lib/resources-api';
import { mergeById } from '../lib/list-utils';
import { resourceErrorMessage } from '../lib/resources-messages';
import TransactionRow, { categoryMap } from './TransactionRow';
import { Button, Chip, ErrorBox, screenStyles as s } from './ui';

export const HISTORY_PAGE_SIZE = 20;

interface Filters {
  tipo: TransactionType | null;
  categoryId: string | null;
  desde: string;
  hasta: string;
}

const NO_FILTERS: Filters = { tipo: null, categoryId: null, desde: '', hasta: '' };

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: Transaction[]; page: number; total: number };

export default function HistoryScreen({
  account,
  api,
  onOpenTransaction,
}: {
  account: Account;
  api: ResourcesApi;
  onOpenTransaction: (transaction: Transaction) => void;
}) {
  const { authorizedCall } = useAuth();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [desdeText, setDesdeText] = useState('');
  const [hastaText, setHastaText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  // Identifica la consulta vigente: una respuesta de una consulta anterior se descarta.
  const generation = useRef(0);

  const categories = useLoader(
    () =>
      authorizedCall((token) =>
        api.listCategories(token, account.id, { incluirArchivadas: true, pageSize: 100 }),
      ),
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

  // Cambiar un filtro (o reintentar) reinicia a la página 1.
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
  }, [filters, reloadCount]);

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

  function setTipo(tipo: TransactionType | null) {
    const known = categories.state.status === 'ready' ? categories.state.data.items : [];
    setFilters((previous) => {
      // Una categoría de otro tipo daría una lista vacía: se limpia al cambiar el tipo.
      const category = known.find((c) => c.id === previous.categoryId);
      const compatible =
        tipo === null ||
        category === undefined ||
        category.tipo === (tipo === 'gasto' ? 'egreso' : 'ingreso');
      return { ...previous, tipo, categoryId: compatible ? previous.categoryId : null };
    });
  }

  function applyRange() {
    const desde = desdeText.trim();
    const hasta = hastaText.trim();
    if (
      (desde !== '' && !isValidDateString(desde)) ||
      (hasta !== '' && !isValidDateString(hasta))
    ) {
      setRangeError('Escribe fechas válidas con formato AAAA-MM-DD (años 2000 a 2100).');
      return;
    }
    if (desde !== '' && hasta !== '' && desde > hasta) {
      setRangeError('La fecha «Desde» no puede ser posterior a «Hasta».');
      return;
    }
    setRangeError(null);
    setFilters((previous) => ({ ...previous, desde, hasta }));
  }

  function clearFilters() {
    setDesdeText('');
    setHastaText('');
    setRangeError(null);
    setFilters(NO_FILTERS);
  }

  const allCategories = categories.state.status === 'ready' ? categories.state.data.items : [];
  const byId = categoryMap(allCategories);
  const visibleCategories = allCategories.filter(
    (c) => filters.tipo === null || c.tipo === (filters.tipo === 'gasto' ? 'egreso' : 'ingreso'),
  );
  const hasMore = list.status === 'ready' && list.items.length < list.total;
  const filtered = filters !== NO_FILTERS;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        Historial de {account.nombre}
      </Text>

      <Text style={s.section}>Tipo</Text>
      <View style={s.actions} accessibilityRole="radiogroup">
        <Chip label="Todos" selected={filters.tipo === null} onPress={() => setTipo(null)} />
        <Chip label="Gastos" selected={filters.tipo === 'gasto'} onPress={() => setTipo('gasto')} />
        <Chip
          label="Ingresos"
          selected={filters.tipo === 'ingreso'}
          onPress={() => setTipo('ingreso')}
        />
      </View>

      <Text style={s.section}>Categoría</Text>
      {categories.state.status === 'error' ? (
        <ErrorBox message={categories.state.message} onRetry={categories.reload} />
      ) : (
        <View style={s.actions} accessibilityRole="radiogroup">
          <Chip
            label="Todas"
            accessibilityLabel="Todas las categorías"
            selected={filters.categoryId === null}
            onPress={() => setFilters((previous) => ({ ...previous, categoryId: null }))}
          />
          {visibleCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.nombre}
              accessibilityLabel={`Filtrar por ${category.nombre}`}
              selected={filters.categoryId === category.id}
              onPress={() => setFilters((previous) => ({ ...previous, categoryId: category.id }))}
            />
          ))}
        </View>
      )}

      <Text style={s.section}>Rango de fechas</Text>
      <View style={styles.rangeRow}>
        <TextInput
          accessibilityLabel="Desde"
          placeholder="Desde AAAA-MM-DD"
          value={desdeText}
          onChangeText={setDesdeText}
          maxLength={10}
          autoCapitalize="none"
          style={[s.input, styles.rangeInput]}
        />
        <TextInput
          accessibilityLabel="Hasta"
          placeholder="Hasta AAAA-MM-DD"
          value={hastaText}
          onChangeText={setHastaText}
          maxLength={10}
          autoCapitalize="none"
          style={[s.input, styles.rangeInput]}
        />
      </View>
      {rangeError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {rangeError}
        </Text>
      ) : null}
      <View style={s.actions}>
        <Button label="Aplicar rango" onPress={applyRange} />
        <Button label="Limpiar filtros" onPress={clearFilters} />
      </View>

      <Text accessibilityRole="header" style={s.section}>
        Movimientos
      </Text>
      {list.status === 'loading' ? (
        <ActivityIndicator size="large" testID="history-loading" />
      ) : list.status === 'error' ? (
        <ErrorBox message={list.message} onRetry={() => setReloadCount((n) => n + 1)} />
      ) : list.items.length === 0 ? (
        <Text style={s.muted}>
          {filtered
            ? 'No hay movimientos con estos filtros'
            : 'Aún no hay movimientos en esta cuenta'}
        </Text>
      ) : (
        <>
          {list.items.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              category={byId.get(transaction.categoryId)}
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
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeInput: { flex: 1 },
  error: { color: '#b3261e', marginBottom: 4 },
});
