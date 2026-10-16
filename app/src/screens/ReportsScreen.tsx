import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useGuide, useGuides } from '../hooks/use-guides';
import { monthTitle, shiftMonth } from '../lib/calendar';
import { categoryFill } from '../lib/category-appearance';
import { formatDateEs, todayLocal } from '../lib/dates';
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
import { colors, radii, sizes, tabularNums, typography } from '../theme/tokens';
import { CategoryIcon } from './form-ui';
import DatePickerSheet from './DatePickerSheet';
import type { HistoryFilters } from './HistoryScreen';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorBox,
  LoadingState,
  MonthArrow,
  GuideCard,
  ScreenTitle,
  Segmented,
  SummaryTile,
  useScreenContainerStyle,
  screenStyles as s,
} from './ui';

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
// Mínimo visible de una barra con importe mayor que cero (solo presentación).
const MIN_BAR_DP = 4;
export const RANGE_MISSING_ERROR = 'Elige las fechas «Desde» y «Hasta».';
export const RANGE_ORDER_MESSAGE = 'La fecha «Desde» no puede ser posterior a «Hasta».';

const MODES: { mode: ReportMode; label: string }[] = [
  { mode: 'month', label: 'Mes' },
  { mode: 'year', label: 'Año' },
  { mode: 'range', label: 'Rango' },
];

const EMPTY_HINT: Record<ReportMode, string> = {
  month: 'otro mes',
  year: 'otro año',
  range: 'otro rango',
};

type RangeField = 'desde' | 'hasta';
type SeriesView = 'chart' | 'table';

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
  const containerStyle = useScreenContainerStyle();
  const [view, setView] = useState<ReportsView>(initialView);
  // Fechas elegidas en el modo Rango; se aplican al tocar «Aplicar».
  const [pending, setPending] = useState({ desde: initialView.desde, hasta: initialView.hasta });
  const [picker, setPicker] = useState<RangeField | null>(null);
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
  // Vista de la serie (Gráfico/Tabla): vive aquí para no reiniciarse al cambiar de período o reintentar.
  const [seriesView, setSeriesView] = useState<SeriesView>('chart');

  // Defensa propia ante un cambio de cuenta sin remontar: se descartan estados de la anterior.
  const [shownAccountId, setShownAccountId] = useState(account.id);
  if (shownAccountId !== account.id) {
    setShownAccountId(account.id);
    setState(null);
    setExportState(null);
    setRangeError(null);
    setPicker(null);
    setSeriesView('chart');
  }

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

  // Guía solo con el resultado cargado y el período sin movimientos (docs/007 §5.12.C).
  const { dismiss } = useGuides();
  const { guide, dismissGuide } = useGuide(
    ['reportes'],
    shown !== null && shown.status !== 'error' && shown.summary.cantidad === 0,
  );

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
      setPending({ desde: base.desde, hasta: base.hasta });
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
    if (pending.desde === '' || pending.hasta === '') {
      setRangeError(RANGE_MISSING_ERROR);
      return;
    }
    const result = validateRange(pending.desde, pending.hasta);
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
    <ScrollView style={containerStyle} keyboardShouldPersistTaps="handled">
      <ScreenTitle title="Reportes" module="reportes" />
      {guide ? <GuideCard guide={guide} onDismiss={dismissGuide} /> : null}

      <Segmented
        tone="reportes"
        accessibilityLabel="Período del reporte"
        value={view.mode}
        onChange={selectMode}
        options={MODES.map(({ mode, label }) => ({
          value: mode,
          label,
          accessibilityLabel: `Modo ${label}`,
        }))}
      />

      {title !== null ? (
        <View style={styles.periodBar}>
          <MonthArrow
            glyph="‹"
            label={`${unit} anterior`}
            disabled={prevDisabled}
            onPress={() => shiftPeriod(-1)}
          />
          <Text accessibilityRole="header" style={styles.periodTitle}>
            {title}
          </Text>
          <MonthArrow
            glyph="›"
            label={`${unit} siguiente`}
            disabled={nextDisabled}
            onPress={() => shiftPeriod(1)}
          />
        </View>
      ) : (
        <View style={styles.rangeBlock}>
          <View style={styles.rangeRow}>
            {(['desde', 'hasta'] as const).map((field) => (
              <DateField
                key={field}
                testID={`report-${field}`}
                label={field === 'desde' ? 'Desde' : 'Hasta'}
                value={pending[field]}
                display={formatDateEs(pending[field])}
                onPress={() => setPicker(field)}
              />
            ))}
          </View>
          {rangeError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {rangeError}
            </Text>
          ) : null}
          <View style={styles.applyRow}>
            <Button label="Aplicar" onPress={applyRange} />
          </View>
          {range ? (
            <Text style={styles.rangeCaption}>
              Del {formatDateEs(range.desde)} al {formatDateEs(range.hasta)}
            </Text>
          ) : null}
        </View>
      )}

      <DatePickerSheet
        visible={picker !== null}
        value={picker ? pending[picker] : ''}
        today={todayLocal()}
        onSelect={(date) => {
          if (picker) setPending((previous) => ({ ...previous, [picker]: date }));
          setRangeError(null);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      {range === null ? null : shown === null ? (
        <LoadingState text="Calculando tu resumen…" testID="reports-loading" />
      ) : shown.status === 'error' ? (
        <ErrorBox
          message={shown.message}
          onRetry={() => setReload((n) => n + 1)}
          retryAccessibilityLabel="Reintentar reportes"
        />
      ) : shown.summary.cantidad === 0 ? (
        <EmptyState
          module="reportes"
          art="reportes"
          message={`Sin movimientos en este período. Prueba con ${EMPTY_HINT[view.mode]}.`}
        />
      ) : (
        <ReportContent
          summary={shown.summary}
          categories={shown.categories}
          period={shown.period}
          onOpenHistory={(filters) => {
            dismiss('reportes');
            onOpenHistory(filters);
          }}
          exportState={exportState !== null && exportState.key === loadKey ? exportState : null}
          onExport={(format) => exportAs(shown.summary, format)}
          seriesView={seriesView}
          onSeriesViewChange={setSeriesView}
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
  seriesView,
  onSeriesViewChange,
}: {
  summary: ReportSummary;
  categories: CategoryReport;
  period: PeriodReport | null;
  onOpenHistory: (filters: HistoryFilters) => void;
  exportState: ExportState | null;
  onExport: (format: ExportFormat) => void;
  seriesView: SeriesView;
  onSeriesViewChange: (view: SeriesView) => void;
}) {
  const { desde, hasta } = summary;
  const { fontScale } = useWindowDimensions();
  const loadingExport = exportState?.status === 'loading';
  return (
    <View>
      <View style={styles.cards}>
        <Pressable
          testID="report-card-ingresos"
          accessibilityRole="button"
          accessibilityLabel={`Ingresos ${formatCents(summary.ingresos)}. Ver movimientos`}
          onPress={() => onOpenHistory({ tipo: 'ingreso', desde, hasta })}
          style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
        >
          <SummaryTile
            kind="income"
            label="Ingresos"
            value={`+${formatCents(summary.ingresos)}`}
            hint="Ver movimientos ›"
          />
        </Pressable>
        <Pressable
          testID="report-card-gastos"
          accessibilityRole="button"
          accessibilityLabel={`Gastos ${formatCents(summary.gastos)}. Ver movimientos`}
          onPress={() => onOpenHistory({ tipo: 'gasto', desde, hasta })}
          style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
        >
          <SummaryTile
            kind="expense"
            label="Gastos"
            value={`-${formatCents(summary.gastos)}`}
            hint="Ver movimientos ›"
          />
        </Pressable>
      </View>
      <View
        testID="report-card-balance"
        accessible
        accessibilityLabel={`Balance ${formatCents(summary.balance)}`}
        style={styles.balance}
      >
        <SummaryTile kind="neutral" label="Balance" value={formatCents(summary.balance)} wide />
      </View>

      <CategoryBreakdown
        title="Gastos por categoría"
        glyph="↓"
        emptyText="Sin gastos en este período"
        noun="gastos"
        group={categories.gastos}
        onOpen={(categoryId) => onOpenHistory({ categoryId, desde, hasta })}
      />
      <CategoryBreakdown
        title="Ingresos por categoría"
        glyph="↑"
        emptyText="Sin ingresos en este período"
        noun="ingresos"
        group={categories.ingresos}
        onOpen={(categoryId) => onOpenHistory({ categoryId, desde, hasta })}
      />

      {period ? (
        <PeriodSeries
          report={period}
          seriesView={seriesView}
          onSeriesViewChange={onSeriesViewChange}
        />
      ) : null}

      <View style={styles.exportSection}>
        <Text accessibilityRole="header" style={styles.groupTitle}>
          Exportar este período
        </Text>
        <Text style={styles.exportText}>
          Descarga los movimientos de este período en un archivo para guardarlo o compartirlo.
        </Text>
        <View style={[styles.exportButtons, fontScale >= 1.3 && styles.exportButtonsColumn]}>
          <View style={styles.exportButton}>
            <Button
              label={loadingExport && exportState.format === 'csv' ? 'Exportando…' : 'Exportar CSV'}
              accessibilityLabel="Exportar CSV"
              disabled={loadingExport}
              onPress={() => onExport('csv')}
            />
          </View>
          <View style={styles.exportButton}>
            <Button
              label={loadingExport && exportState.format === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
              accessibilityLabel="Exportar PDF"
              disabled={loadingExport}
              onPress={() => onExport('pdf')}
            />
          </View>
        </View>
        {loadingExport ? (
          <ActivityIndicator
            testID="export-loading"
            color={colors.brand700}
            style={styles.exportSpinner}
          />
        ) : null}
        {exportState?.status === 'error' ? (
          <ErrorBox
            message={exportState.message}
            onRetry={() => onExport(exportState.format)}
            retryLabel="Reintentar exportación"
            retryAccessibilityLabel="Reintentar exportación"
          />
        ) : null}
      </View>
    </View>
  );
}

function CategoryBreakdown({
  title,
  glyph,
  emptyText,
  noun,
  group,
  onOpen,
}: {
  title: string;
  glyph: string;
  emptyText: string;
  noun: string;
  group: CategoryReportGroup;
  onOpen: (categoryId: string) => void;
}) {
  const max = maxCents(group.items.map((item) => item.total));
  const income = glyph === '↑';
  return (
    <View>
      <View style={styles.groupHeader}>
        <View
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[
            styles.groupBubble,
            { backgroundColor: income ? colors.incomeSoft : colors.expenseSoft },
          ]}
        >
          <Text
            style={[
              styles.groupBubbleGlyph,
              { color: income ? colors.incomeText : colors.expenseText },
            ]}
          >
            {glyph}
          </Text>
        </View>
        <Text accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </Text>
      </View>
      {group.items.length === 0 ? (
        <Text style={s.muted}>{emptyText}</Text>
      ) : (
        <Card style={styles.groupCard}>
          {group.items.map((item, index) => {
            const percent = formatPercent(item.total, group.total);
            // Solo presentación: el ancho es proporcional a la categoría mayor del grupo.
            const width = percent === null ? 0 : scaleUnits(item.total, max, 1000) / 10;
            return (
              <Pressable
                key={item.categoryId}
                testID={`report-category-${item.categoryId}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}${item.archivada ? ' (archivada)' : ''}: ${formatCents(item.total)}${percent ? `, ${percent} de los ${noun}` : ''}. Ver movimientos`}
                onPress={() => onOpen(item.categoryId)}
                style={({ pressed }) => [
                  styles.categoryRow,
                  index > 0 && styles.categoryDivider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.categoryTop}>
                  <CategoryIcon
                    icono={item.icono}
                    color={item.color}
                    size={32}
                    dimmed={item.archivada}
                  />
                  <Text style={styles.categoryName} numberOfLines={2} ellipsizeMode="clip">
                    {item.nombre}
                    {item.archivada ? ' (archivada)' : ''}
                  </Text>
                  <Text style={styles.categoryTotal}>{formatCents(item.total)}</Text>
                </View>
                {percent !== null ? (
                  <View style={styles.categoryBottom}>
                    <Text style={styles.percent}>{percent}</Text>
                    <View
                      importantForAccessibility="no"
                      accessibilityElementsHidden
                      style={styles.barTrack}
                    >
                      <View
                        testID={`report-bar-${item.categoryId}`}
                        style={[
                          styles.bar,
                          {
                            width: `${width}%`,
                            backgroundColor: categoryFill(item.color),
                          },
                          item.total > 0 && { minWidth: MIN_BAR_DP },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      )}
    </View>
  );
}

function PeriodSeries({
  report,
  seriesView,
  onSeriesViewChange,
}: {
  report: PeriodReport;
  seriesView: SeriesView;
  onSeriesViewChange: (view: SeriesView) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const max = maxCents(report.points.flatMap((point) => [point.ingresos, point.gastos]));
  const height = (value: number) => {
    const units = scaleUnits(value, max, COLUMN_HEIGHT);
    return value > 0 ? Math.max(units, MIN_BAR_DP) : 0;
  };
  const stacked = fontScale >= 1.15;
  return (
    <Card style={styles.seriesCard}>
      <Text accessibilityRole="header" style={styles.groupTitle}>
        {report.group === 'month' ? 'Evolución mensual' : 'Evolución anual'}
      </Text>
      <View style={styles.seriesToggle}>
        <Segmented
          accessibilityLabel="Vista de la evolución"
          value={seriesView}
          onChange={onSeriesViewChange}
          options={[
            { value: 'chart', label: 'Gráfico' },
            { value: 'table', label: 'Tabla' },
          ]}
        />
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.income }]} />
          <Text style={styles.legendText}>↑ Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.expense }]} />
          <Text style={styles.legendText}>↓ Gastos</Text>
        </View>
      </View>

      {seriesView === 'chart' ? (
        <>
          <ScrollView
            testID="period-scroll"
            horizontal
            showsHorizontalScrollIndicator
            onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
            onContentSizeChange={(width) => setContentWidth(width)}
          >
            {report.points.map((point) => (
              <View
                key={point.periodo}
                testID={`report-period-${point.periodo}`}
                accessible
                accessibilityLabel={`${periodLabel(point.periodo)}: ingresos ${formatCents(point.ingresos)}, gastos ${formatCents(point.gastos)}`}
                style={styles.column}
              >
                <Text allowFontScaling={false} style={[styles.amount, styles.income]}>
                  +{formatCompactCents(point.ingresos)}
                </Text>
                <Text allowFontScaling={false} style={[styles.amount, styles.expense]}>
                  −{formatCompactCents(point.gastos)}
                </Text>
                <View style={styles.bars}>
                  <View
                    testID={`report-period-ingresos-${point.periodo}`}
                    style={[
                      styles.periodBarFill,
                      { backgroundColor: colors.income, height: height(point.ingresos) },
                    ]}
                  />
                  <View
                    testID={`report-period-gastos-${point.periodo}`}
                    style={[
                      styles.periodBarFill,
                      { backgroundColor: colors.expense, height: height(point.gastos) },
                    ]}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.periodLabel}>
                  {periodLabel(point.periodo)}
                </Text>
              </View>
            ))}
          </ScrollView>
          {contentWidth > layoutWidth && layoutWidth > 0 ? (
            <Text style={styles.scrollHint}>Desliza para ver más períodos.</Text>
          ) : null}
        </>
      ) : (
        <View testID="period-table">
          {!stacked ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableHead, styles.tablePeriod]}>Período</Text>
              <Text style={[styles.tableHead, styles.tableCell]}>Ingresos</Text>
              <Text style={[styles.tableHead, styles.tableCell]}>Gastos</Text>
              <Text style={[styles.tableHead, styles.tableCell]}>Balance</Text>
            </View>
          ) : null}
          {report.points.map((point) => {
            const label = `${periodLabel(point.periodo)}: ingresos ${formatCents(point.ingresos)}, gastos ${formatCents(point.gastos)}, balance ${formatCents(point.balance)}`;
            const balanceStyle = [styles.tableValue, point.balance < 0 && styles.expense];
            return (
              <View
                key={point.periodo}
                testID={`report-table-${point.periodo}`}
                accessible
                accessibilityLabel={label}
                style={[styles.tableRow, styles.tableRowDivider, stacked && styles.tableStacked]}
              >
                {stacked ? (
                  <>
                    <View style={styles.tableTop}>
                      <Text style={styles.tablePeriodText}>{periodLabel(point.periodo)}</Text>
                      <Text style={[balanceStyle, styles.tableBalanceStrong]}>
                        {formatCents(point.balance)}
                      </Text>
                    </View>
                    <Text style={styles.tableDetail}>
                      Ingresos +{formatCents(point.ingresos)} · Gastos -{formatCents(point.gastos)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tablePeriodText, styles.tablePeriod]}>
                      {periodLabel(point.periodo)}
                    </Text>
                    <Text style={[styles.tableValue, styles.tableCell, styles.income]}>
                      {formatCents(point.ingresos)}
                    </Text>
                    <Text style={[styles.tableValue, styles.tableCell, styles.expense]}>
                      {formatCents(point.gastos)}
                    </Text>
                    <Text style={[balanceStyle, styles.tableCell, styles.tableBalanceStrong]}>
                      {formatCents(point.balance)}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchMin,
    marginTop: 8,
  },
  periodTitle: {
    ...typography.h2,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  rangeBlock: { marginTop: 12 },
  rangeRow: { flexDirection: 'row', gap: 8 },
  applyRow: { marginTop: 8, alignItems: 'flex-start' },
  rangeCaption: { ...typography.small, color: colors.text2, textAlign: 'center', marginTop: 8 },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText, marginTop: 4 },
  cards: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cardButton: { flex: 1, minHeight: sizes.touchMin },
  balance: { marginTop: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
  },
  groupBubble: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBubbleGlyph: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  groupTitle: { ...typography.h2, color: colors.text, flexShrink: 1 },
  groupCard: { paddingVertical: 0, paddingHorizontal: 12 },
  categoryRow: { minHeight: 56, paddingVertical: 8, justifyContent: 'center' },
  categoryDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  categoryTotal: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 0,
    ...tabularNums,
  },
  categoryBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 40 },
  percent: { ...typography.small, fontWeight: '700', color: colors.text2, minWidth: 52 },
  barTrack: {
    flex: 1,
    height: sizes.categoryBar,
    borderRadius: sizes.categoryBar / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  bar: { height: sizes.categoryBar, borderRadius: sizes.categoryBar / 2 },
  seriesCard: { marginTop: 24, padding: 12 },
  seriesToggle: { marginTop: 8 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { ...typography.small, fontWeight: '700', color: colors.text },
  column: { width: 56, alignItems: 'center', marginRight: 4 },
  bars: {
    height: COLUMN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodBarFill: { width: 18, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  periodLabel: { fontSize: 12, lineHeight: 16, marginTop: 4, color: colors.text2 },
  amount: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  income: { color: colors.incomeText },
  expense: { color: colors.expenseText },
  scrollHint: { ...typography.small, color: colors.text3, marginTop: 8 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  tableStacked: { flexDirection: 'column', alignItems: 'stretch' },
  tableTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tableHead: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.text2 },
  tablePeriod: { flex: 1.2 },
  tableCell: { flex: 1, textAlign: 'right' },
  tablePeriodText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.text },
  tableValue: { fontSize: 14, lineHeight: 20, color: colors.text, ...tabularNums },
  tableBalanceStrong: { fontWeight: '700' },
  tableDetail: { ...typography.small, color: colors.text2 },
  exportSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportText: { ...typography.body, color: colors.text2, marginTop: 4, marginBottom: 12 },
  exportButtons: { flexDirection: 'row', gap: 8 },
  exportButtonsColumn: { flexDirection: 'column' },
  exportButton: { flex: 1 },
  exportSpinner: { alignSelf: 'center', marginTop: 8 },
});
