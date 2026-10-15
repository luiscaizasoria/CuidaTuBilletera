import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { monthTitle, shiftMonth } from '../lib/calendar';
import { formatDateEs } from '../lib/dates';
import { clearExports, shareExport } from '../lib/export-files';
import { formatCents, formatCompactCents } from '../lib/money';
import {
  formatPercent,
  maxCents,
  monthRange,
  periodGroupFor,
  periodLabel,
  scaleUnits,
  shiftYear,
  validateRange,
  viewRange,
  type ReportMode,
  type ReportsView,
} from '../lib/reports';
import type {
  Account,
  ExportFormat,
  CategoryReport,
  CategoryReportGroup,
  PeriodReport,
  ReportSummary,
  ResourcesApi,
} from '../lib/resources-api';
import { resourceErrorMessage } from '../lib/resources-messages';
import type { HistoryFilters } from './HistoryScreen';
import { Button, Chip, ErrorBox, screenStyles as s } from './ui';

type LoadState =
  | { status: 'error'; key: string; message: string }
  | {
      status: 'ready';
      key: string;
      summary: ReportSummary;
      categories: CategoryReport;
      period: PeriodReport | null;
    };

interface ExportState {
  status: 'loading' | 'error';
  key: string;
  format: ExportFormat;
  message: string;
}

const EXPORT_MIME: Record<ExportFormat, string> = { csv: 'text/csv', pdf: 'application/pdf' };

const COLUMN_HEIGHT = 80;
const FALLBACK_COLOR = '#9e9e9e';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const MODES: { mode: ReportMode; label: string }[] = [
  { mode: 'month', label: 'Mes' },
  { mode: 'year', label: 'Año' },
  { mode: 'range', label: 'Rango' },
];

export default function ReportsScreen({
  account,
  api,
  initialView,
  onViewChange,
  onOpenHistory,
}: {
  account: Account;
  api: ResourcesApi;
  initialView: ReportsView;
  onViewChange: (view: ReportsView) => void;
  onOpenHistory: (filters: HistoryFilters) => void;
}) {
  const { authorizedCall } = useAuth();
  const [view, setView] = useState<ReportsView>(initialView);
  const [desdeText, setDesdeText] = useState(initialView.desde);
  const [hastaText, setHastaText] = useState(initialView.hasta);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState | null>(null);
  const [reload, setReload] = useState(0);
  // Identifica la consulta vigente: una respuesta anterior se descarta.
  const generation = useRef(0);
  // Exportación: la guarda evita doble toque; los bytes nunca se guardan en estado.
  const exporting = useRef(false);
  const mounted = useRef(true);
  const loadKeyRef = useRef<string | null>(null);
  const [exportState, setExportState] = useState<ExportState | null>(null);

  const range = viewRange(view);
  const group = range ? periodGroupFor(view.mode, range) : null;
  const loadKey = range
    ? `${account.id}|${range.desde}|${range.hasta}|${group ?? '-'}|${reload}`
    : null;

  const callRef = useRef({ api, authorizedCall });
  useEffect(() => {
    callRef.current = { api, authorizedCall };
    loadKeyRef.current = loadKey;
  });
  useEffect(() => {
    mounted.current = true;
    // Descarta archivos exportados en sesiones anteriores.
    clearExports();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (loadKey === null || range === null) return undefined;
    let cancelled = false;
    generation.current += 1;
    const current = generation.current;
    const { api: currentApi, authorizedCall: call } = callRef.current;
    const options = { accountId: account.id, desde: range.desde, hasta: range.hasta };
    call(async (token) => {
      const [summary, categories, period] = await Promise.all([
        currentApi.getReportSummary(token, options),
        currentApi.getReportByCategory(token, options),
        group ? currentApi.getReportByPeriod(token, { ...options, group }) : Promise.resolve(null),
      ]);
      return { summary, categories, period };
    }).then(
      (data) => {
        if (!cancelled && current === generation.current) {
          setState({ status: 'ready', key: loadKey, ...data });
        }
      },
      (error: unknown) => {
        if (!cancelled && current === generation.current) {
          setState({ status: 'error', key: loadKey, message: resourceErrorMessage(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // `range` y `group` derivan de loadKey.
  }, [loadKey, account.id]);

  // Un estado de otra consulta (otro período, modo o cuenta) cuenta como «cargando».
  const shown = state !== null && state.key === loadKey ? state : null;

  function exportAs(summary: ReportSummary, format: ExportFormat) {
    if (exporting.current || loadKey === null) return;
    exporting.current = true;
    const key = loadKey;
    const { desde, hasta } = summary;
    const { api: currentApi, authorizedCall: call } = callRef.current;
    clearExports();
    setExportState({ status: 'loading', key, format, message: '' });
    call((token) => currentApi.exportFile(token, { accountId: account.id, desde, hasta, format }))
      .then(async (bytes) => {
        // Si cambió la pantalla o el período, se descarta sin compartir.
        if (!mounted.current || loadKeyRef.current !== key) {
          if (mounted.current) setExportState(null);
          return;
        }
        await shareExport({
          bytes,
          name: `movimientos_${desde}_${hasta}.${format}`,
          mimeType: EXPORT_MIME[format],
        });
        // Android no informa si el usuario envió o canceló: no se afirma ningún resultado.
        if (mounted.current) setExportState(null);
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        setExportState(
          loadKeyRef.current === key
            ? { status: 'error', key, format, message: resourceErrorMessage(error) }
            : null,
        );
      })
      .finally(() => {
        exporting.current = false;
      });
  }

  function changeView(next: ReportsView) {
    setView(next);
    onViewChange(next);
  }

  function selectMode(mode: ReportMode) {
    if (mode === view.mode) return;
    if (mode === 'range') {
      // Parte del período que se estaba viendo.
      const base = range ?? monthRange(view.year, view.month);
      setDesdeText(base.desde);
      setHastaText(base.hasta);
      setRangeError(null);
      changeView({ ...view, mode, desde: base.desde, hasta: base.hasta });
      return;
    }
    changeView({ ...view, mode });
  }

  function shiftPeriod(delta: number) {
    if (view.mode === 'month') {
      const next = shiftMonth(view.year, view.month, delta);
      if (next) changeView({ ...view, year: next.year, month: next.month });
    } else if (view.mode === 'year') {
      const year = shiftYear(view.year, delta);
      if (year !== null) changeView({ ...view, year });
    }
  }

  function applyRange() {
    const result = validateRange(desdeText, hastaText);
    if (result.error !== null) {
      setRangeError(result.error);
      return;
    }
    setRangeError(null);
    changeView({ ...view, desde: result.range.desde, hasta: result.range.hasta });
  }

  const prevDisabled =
    view.mode === 'month'
      ? shiftMonth(view.year, view.month, -1) === null
      : shiftYear(view.year, -1) === null;
  const nextDisabled =
    view.mode === 'month'
      ? shiftMonth(view.year, view.month, 1) === null
      : shiftYear(view.year, 1) === null;
  const unit = view.mode === 'month' ? 'Mes' : 'Año';
  const title =
    view.mode === 'month'
      ? monthTitle(view.year, view.month)
      : view.mode === 'year'
        ? String(view.year)
        : null;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        Reportes de {account.nombre}
      </Text>

      <View style={s.actions} accessibilityRole="radiogroup">
        {MODES.map(({ mode, label }) => (
          <Chip
            key={mode}
            label={label}
            accessibilityLabel={`Modo ${label}`}
            selected={view.mode === mode}
            onPress={() => selectMode(mode)}
          />
        ))}
      </View>

      {title !== null ? (
        <View style={styles.periodBar}>
          <Button
            label="‹"
            accessibilityLabel={`${unit} anterior`}
            disabled={prevDisabled}
            onPress={() => shiftPeriod(-1)}
          />
          <Text accessibilityRole="header" style={styles.periodTitle}>
            {title}
          </Text>
          <Button
            label="›"
            accessibilityLabel={`${unit} siguiente`}
            disabled={nextDisabled}
            onPress={() => shiftPeriod(1)}
          />
        </View>
      ) : (
        <View>
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
            <Button label="Aplicar" onPress={applyRange} />
          </View>
          {range ? (
            <Text style={s.rowSubtitle}>
              Del {formatDateEs(range.desde)} al {formatDateEs(range.hasta)}
            </Text>
          ) : null}
        </View>
      )}

      {shown === null ? (
        <ActivityIndicator size="large" testID="reports-loading" style={styles.spacer} />
      ) : shown.status === 'error' ? (
        <ErrorBox
          message={shown.message}
          onRetry={() => setReload((n) => n + 1)}
          retryAccessibilityLabel="Reintentar reportes"
        />
      ) : shown.summary.cantidad === 0 ? (
        <Text style={s.muted}>Sin movimientos en este período</Text>
      ) : (
        <ReportContent
          summary={shown.summary}
          categories={shown.categories}
          period={shown.period}
          onOpenHistory={onOpenHistory}
          exportState={exportState !== null && exportState.key === loadKey ? exportState : null}
          onExport={(format) => exportAs(shown.summary, format)}
        />
      )}
    </ScrollView>
  );
}

function ReportContent({
  summary,
  categories,
  period,
  onOpenHistory,
  exportState,
  onExport,
}: {
  summary: ReportSummary;
  categories: CategoryReport;
  period: PeriodReport | null;
  onOpenHistory: (filters: HistoryFilters) => void;
  exportState: ExportState | null;
  onExport: (format: ExportFormat) => void;
}) {
  const { desde, hasta } = summary;
  const loadingExport = exportState?.status === 'loading';
  return (
    <View>
      <View style={styles.cards}>
        <Pressable
          testID="report-card-ingresos"
          accessibilityRole="button"
          accessibilityLabel={`Ingresos ${formatCents(summary.ingresos)}. Ver movimientos`}
          onPress={() => onOpenHistory({ tipo: 'ingreso', desde, hasta })}
          style={styles.card}
        >
          <Text style={s.rowSubtitle}>Ingresos</Text>
          <Text style={[styles.cardValue, styles.income]}>{formatCents(summary.ingresos)}</Text>
        </Pressable>
        <Pressable
          testID="report-card-gastos"
          accessibilityRole="button"
          accessibilityLabel={`Gastos ${formatCents(summary.gastos)}. Ver movimientos`}
          onPress={() => onOpenHistory({ tipo: 'gasto', desde, hasta })}
          style={styles.card}
        >
          <Text style={s.rowSubtitle}>Gastos</Text>
          <Text style={[styles.cardValue, styles.expense]}>{formatCents(summary.gastos)}</Text>
        </Pressable>
        <View
          testID="report-card-balance"
          accessible
          accessibilityLabel={`Balance ${formatCents(summary.balance)}`}
          style={styles.card}
        >
          <Text style={s.rowSubtitle}>Balance</Text>
          <Text style={styles.cardValue}>{formatCents(summary.balance)}</Text>
        </View>
      </View>

      <View style={s.actions}>
        <Button
          label={loadingExport && exportState.format === 'csv' ? 'Exportando…' : 'Exportar CSV'}
          accessibilityLabel="Exportar CSV"
          disabled={loadingExport}
          onPress={() => onExport('csv')}
        />
        <Button
          label={loadingExport && exportState.format === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
          accessibilityLabel="Exportar PDF"
          disabled={loadingExport}
          onPress={() => onExport('pdf')}
        />
        {loadingExport ? (
          <ActivityIndicator testID="export-loading" style={styles.exportSpinner} />
        ) : null}
      </View>
      {exportState?.status === 'error' ? (
        <ErrorBox
          message={exportState.message}
          onRetry={() => onExport(exportState.format)}
          retryLabel="Reintentar exportación"
          retryAccessibilityLabel="Reintentar exportación"
        />
      ) : null}

      <CategoryBreakdown
        title="Gastos por categoría"
        emptyText="Sin gastos en este período"
        noun="gastos"
        group={categories.gastos}
        onOpen={(categoryId) => onOpenHistory({ categoryId, desde, hasta })}
      />
      <CategoryBreakdown
        title="Ingresos por categoría"
        emptyText="Sin ingresos en este período"
        noun="ingresos"
        group={categories.ingresos}
        onOpen={(categoryId) => onOpenHistory({ categoryId, desde, hasta })}
      />

      {period ? <PeriodSeries report={period} /> : null}
    </View>
  );
}

function CategoryBreakdown({
  title,
  emptyText,
  noun,
  group,
  onOpen,
}: {
  title: string;
  emptyText: string;
  noun: string;
  group: CategoryReportGroup;
  onOpen: (categoryId: string) => void;
}) {
  const max = maxCents(group.items.map((item) => item.total));
  return (
    <View>
      <Text accessibilityRole="header" style={s.section}>
        {title}
      </Text>
      {group.items.length === 0 ? (
        <Text style={s.muted}>{emptyText}</Text>
      ) : (
        group.items.map((item) => {
          const percent = formatPercent(item.total, group.total);
          const width = percent === null ? 0 : scaleUnits(item.total, max, 1000) / 10;
          const color = HEX_COLOR.test(item.color) ? item.color : FALLBACK_COLOR;
          return (
            <Pressable
              key={item.categoryId}
              testID={`report-category-${item.categoryId}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.nombre}${item.archivada ? ' (archivada)' : ''}: ${formatCents(item.total)}${percent ? `, ${percent} de los ${noun}` : ''}. Ver movimientos`}
              onPress={() => onOpen(item.categoryId)}
              style={s.row}
            >
              <View style={styles.categoryHeader}>
                <Text style={[s.rowTitle, styles.categoryName]} numberOfLines={1}>
                  {item.nombre}
                  {item.archivada ? ' (archivada)' : ''}
                </Text>
                <Text style={s.rowTitle}>{formatCents(item.total)}</Text>
              </View>
              {percent !== null ? (
                <>
                  <Text style={s.rowSubtitle}>{percent}</Text>
                  <View style={styles.barTrack}>
                    <View
                      testID={`report-bar-${item.categoryId}`}
                      style={[styles.bar, { width: `${width}%`, backgroundColor: color }]}
                    />
                  </View>
                </>
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function PeriodSeries({ report }: { report: PeriodReport }) {
  const max = maxCents(report.points.flatMap((point) => [point.ingresos, point.gastos]));
  const height = (value: number) => {
    const units = scaleUnits(value, max, COLUMN_HEIGHT);
    return value > 0 ? Math.max(units, 2) : 0;
  };
  return (
    <View>
      <Text accessibilityRole="header" style={s.section}>
        {report.group === 'month' ? 'Evolución mensual' : 'Evolución anual'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        {report.points.map((point) => (
          <View
            key={point.periodo}
            testID={`report-period-${point.periodo}`}
            accessible
            accessibilityLabel={`${periodLabel(point.periodo)}: ingresos ${formatCents(point.ingresos)}, gastos ${formatCents(point.gastos)}`}
            style={styles.column}
          >
            <View style={styles.bars}>
              <View
                testID={`report-period-ingresos-${point.periodo}`}
                style={[styles.periodBarFill, styles.incomeBg, { height: height(point.ingresos) }]}
              />
              <View
                testID={`report-period-gastos-${point.periodo}`}
                style={[styles.periodBarFill, styles.expenseBg, { height: height(point.gastos) }]}
              />
            </View>
            <Text allowFontScaling={false} style={styles.periodLabel}>
              {periodLabel(point.periodo)}
            </Text>
            <Text allowFontScaling={false} style={[styles.amount, styles.income]}>
              +{formatCompactCents(point.ingresos)}
            </Text>
            <Text allowFontScaling={false} style={[styles.amount, styles.expense]}>
              −{formatCompactCents(point.gastos)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  periodTitle: { fontSize: 18, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rangeInput: { flex: 1 },
  error: { color: '#b3261e', marginBottom: 4 },
  exportSpinner: { alignSelf: 'center' },
  spacer: { marginVertical: 16 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  card: {
    flexGrow: 1,
    flexBasis: 100,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
  },
  cardValue: { fontSize: 18, fontWeight: '700' },
  income: { color: '#2e7d32' },
  expense: { color: '#b3261e' },
  incomeBg: { backgroundColor: '#2e7d32' },
  expenseBg: { backgroundColor: '#b3261e' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  categoryName: { flex: 1 },
  barTrack: { height: 8, backgroundColor: '#eeeeee', borderRadius: 4, marginTop: 6 },
  bar: { height: 8, borderRadius: 4 },
  column: { width: 56, alignItems: 'center', marginRight: 4 },
  bars: { height: COLUMN_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  periodBarFill: { width: 18, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  periodLabel: { fontSize: 11, marginTop: 4, color: '#555555' },
  amount: { fontSize: 10 },
});
