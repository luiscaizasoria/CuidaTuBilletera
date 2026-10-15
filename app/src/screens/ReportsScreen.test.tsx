import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import { ExportFileError, clearExports, shareExport } from '../lib/export-files';
import { ApiRequestError } from '../lib/resources-api';
import type { CategoryReport, PeriodReport, ReportSummary } from '../lib/resources-api';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { controlledPromise } from '../test-utils';
import ReportsScreen from './ReportsScreen';
import type { ReportsView } from '../lib/reports';

jest.mock('../lib/export-files', () => ({
  ...jest.requireActual('../lib/export-files'),
  clearExports: jest.fn(),
  shareExport: jest.fn(async () => undefined),
}));

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

const acc = account({ id: 'acc-1', nombre: 'Efectivo' });
const OCT: ReportsView = { mode: 'month', year: 2026, month: 10, desde: '', hasta: '' };

type Opts = { accountId: string; desde: string; hasta: string };

const summaryOf = (o: Opts, extra: Partial<ReportSummary> = {}): ReportSummary => ({
  ...o,
  ingresos: 120000,
  gastos: 4550,
  balance: 115450,
  cantidad: 3,
  ...extra,
});

const categoriesOf = (o: Opts): CategoryReport => ({
  ...o,
  ingresos: {
    total: 120000,
    items: [
      {
        categoryId: 'c-pay',
        nombre: 'Sueldo',
        icono: 'tag',
        color: '#2E7D32',
        archivada: false,
        total: 120000,
        cantidad: 1,
      },
    ],
  },
  gastos: {
    total: 4550,
    items: [
      {
        categoryId: 'c-food',
        nombre: 'Comida',
        icono: 'tag',
        color: '#E53935',
        archivada: false,
        total: 3033,
        cantidad: 2,
      },
      {
        categoryId: 'c-old',
        nombre: 'Antigua',
        icono: 'tag',
        color: 'no-es-color',
        archivada: true,
        total: 1517,
        cantidad: 1,
      },
    ],
  },
});

const emptyCategories = (o: Opts): CategoryReport => ({
  ...o,
  ingresos: { total: 0, items: [] },
  gastos: { total: 0, items: [] },
});

function makeApi(overrides = {}) {
  return fakeResourcesApi({
    getReportSummary: jest.fn(async (_t, o) => summaryOf(o)),
    getReportByCategory: jest.fn(async (_t, o) => categoriesOf(o)),
    getReportByPeriod: jest.fn(async (_t, o): Promise<PeriodReport> => ({
      ...o,
      points: [
        { periodo: '2026-01', ingresos: 200, gastos: 100, balance: 100, cantidad: 2 },
        { periodo: '2026-02', ingresos: 0, gastos: 0, balance: 0, cantidad: 0 },
        { periodo: '2026-03', ingresos: 100, gastos: 400, balance: -300, cantidad: 1 },
      ],
    })),
    ...overrides,
  });
}

const onViewChange = jest.fn();
const onOpenHistory = jest.fn();
const renderReports = (api = makeApi(), view: ReportsView = OCT, acct = acc) =>
  render(
    <ReportsScreen
      account={acct}
      api={api}
      initialView={view}
      onViewChange={onViewChange}
      onOpenHistory={onOpenHistory}
    />,
  );

afterEach(() => jest.clearAllMocks());

describe('ReportsScreen: presentación', () => {
  it('modo Mes: consulta summary y by-category del mes, sin serie', async () => {
    const api = makeApi();
    await renderReports(api);
    expect(await screen.findByText('Reportes de Efectivo')).toBeTruthy();
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    await screen.findByTestId('report-card-ingresos');
    const o = { accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' };
    expect(api.getReportSummary).toHaveBeenCalledWith('tok', o);
    expect(api.getReportByCategory).toHaveBeenCalledWith('tok', o);
    expect(api.getReportByPeriod).not.toHaveBeenCalled();
    expect(screen.queryByText('Evolución mensual')).toBeNull();
  });

  it('tarjetas con formato monetario y accesibilidad', async () => {
    await renderReports();
    expect((await screen.findByTestId('report-card-ingresos')).props.accessibilityLabel).toBe(
      'Ingresos $1200.00. Ver movimientos',
    );
    expect(screen.getByTestId('report-card-gastos').props.accessibilityLabel).toContain('$45.50');
    expect(screen.getByTestId('report-card-balance').props.accessibilityLabel).toBe(
      'Balance $1154.50',
    );
    expect(screen.getByText('$1154.50')).toBeTruthy();
  });

  it('balance negativo se muestra con signo', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) =>
        summaryOf(o, { ingresos: 0, gastos: 1250, balance: -1250 }),
      ),
    });
    await renderReports(api);
    expect(await screen.findByText('-$12.50')).toBeTruthy();
  });

  it('desglose por categoría: importes, porcentaje exacto, archivada y barras', async () => {
    await renderReports();
    await screen.findByText('Gastos por categoría');
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.getByText('$30.33')).toBeTruthy();
    expect(screen.getByText('66.7%')).toBeTruthy();
    expect(screen.getByText('33.3%')).toBeTruthy();
    expect(screen.getByText('Antigua (archivada)')).toBeTruthy();
    expect(screen.getByText('100.0%')).toBeTruthy(); // Sueldo, único ingreso
    // Ancho de barra relativo al mayor del grupo (3033 = 100%; 1517/3033 = 50.0%).
    expect(screen.getByTestId('report-bar-c-food').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: '100%', backgroundColor: '#E53935' }),
      ]),
    );
    expect(screen.getByTestId('report-bar-c-old').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: '50%', backgroundColor: '#9e9e9e' }),
      ]),
    );
    expect(screen.getByTestId('report-category-c-old').props.accessibilityLabel).toContain(
      'Antigua (archivada): $15.17, 33.3% de los gastos',
    );
  });

  it('grupo con total 0: mensaje y sin barra ni porcentaje', async () => {
    const api = makeApi({
      getReportByCategory: jest.fn(async (_t, o) => ({
        ...categoriesOf(o),
        ingresos: { total: 0, items: [] },
      })),
    });
    await renderReports(api);
    expect(await screen.findByText('Sin ingresos en este período')).toBeTruthy();
    expect(screen.queryByTestId('report-bar-c-pay')).toBeNull();
  });

  it('importes muy grandes no pierden exactitud en el porcentaje', async () => {
    const big = Number.MAX_SAFE_INTEGER;
    const api = makeApi({
      getReportByCategory: jest.fn(async (_t, o) => ({
        ...emptyCategories(o),
        gastos: {
          total: big,
          items: [
            {
              categoryId: 'c-big',
              nombre: 'Grande',
              icono: 'tag',
              color: '#000000',
              archivada: false,
              total: big,
              cantidad: 1,
            },
          ],
        },
      })),
    });
    await renderReports(api);
    expect(await screen.findByText('100.0%')).toBeTruthy();
  });
});

describe('ReportsScreen: modos y período', () => {
  it('Mes: ‹ › cambia el mes, consulta el rango correcto y avisa la vista', async () => {
    const api = makeApi();
    await renderReports(api, { ...OCT, month: 2, year: 2024 });
    await screen.findByTestId('report-card-ingresos');
    expect(api.getReportSummary).toHaveBeenLastCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2024-02-01',
      hasta: '2024-02-29',
    });
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(await screen.findByText('Marzo 2024')).toBeTruthy();
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        desde: '2024-03-01',
        hasta: '2024-03-31',
      }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ year: 2024, month: 3 }),
    );
  });

  it('Mes: límites 2000-01 y 2100-12 deshabilitan los botones', async () => {
    await renderReports(makeApi(), { ...OCT, year: 2000, month: 1 });
    expect(screen.getByLabelText('Mes anterior').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Mes siguiente').props.accessibilityState.disabled).toBe(false);
    await screen.findByTestId('report-card-ingresos');
  });

  it('Año: consulta el año completo e incluye la serie mensual con ceros', async () => {
    const api = makeApi();
    await renderReports(api);
    await screen.findByTestId('report-card-ingresos');
    await fireEvent.press(screen.getByRole('radio', { name: 'Modo Año' }));
    expect(await screen.findByText('Evolución mensual')).toBeTruthy();
    const o = { accountId: 'acc-1', desde: '2026-01-01', hasta: '2026-12-31' };
    expect(api.getReportByPeriod).toHaveBeenLastCalledWith('tok', { ...o, group: 'month' });
    expect(screen.getByText('2026')).toBeTruthy();
    // Escala al máximo (400 = 80 px); el período sin datos no dibuja columnas.
    const px = (id: string) => screen.getByTestId(id).props.style;
    expect(px('report-period-gastos-2026-03')).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 80 })]),
    );
    expect(px('report-period-ingresos-2026-01')).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 40 })]),
    );
    expect(px('report-period-gastos-2026-02')).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 0 })]),
    );
    expect(screen.getByTestId('report-period-2026-03').props.accessibilityLabel).toBe(
      'Mar 26: ingresos $1.00, gastos $4.00',
    );
    expect(screen.getByText('+2')).toBeTruthy();
    expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'year' }));
  });

  it('Año: ‹ cambia de año', async () => {
    const api = makeApi();
    await renderReports(api, { ...OCT, mode: 'year' });
    await screen.findByTestId('report-card-ingresos');
    await fireEvent.press(screen.getByLabelText('Año anterior'));
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        desde: '2025-01-01',
        hasta: '2025-12-31',
      }),
    );
  });

  it('Rango: parte del período visto, aplica uno nuevo y usa serie mensual', async () => {
    const api = makeApi();
    await renderReports(api);
    await screen.findByTestId('report-card-ingresos');
    await fireEvent.press(screen.getByRole('radio', { name: 'Modo Rango' }));
    expect(screen.getByLabelText('Desde').props.value).toBe('2026-10-01');
    expect(screen.getByLabelText('Hasta').props.value).toBe('2026-10-31');
    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-01-15');
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-03-20');
    await fireEvent.press(screen.getByText('Aplicar'));
    await waitFor(() =>
      expect(api.getReportByPeriod).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        desde: '2026-01-15',
        hasta: '2026-03-20',
        group: 'month',
      }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'range', desde: '2026-01-15', hasta: '2026-03-20' }),
    );
  });

  it('Rango de más de 120 meses agrupa por año', async () => {
    const api = makeApi();
    await renderReports(api, {
      ...OCT,
      mode: 'range',
      desde: '2000-01-01',
      hasta: '2100-12-31',
    });
    await screen.findByTestId('report-card-ingresos');
    expect(api.getReportByPeriod).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ group: 'year' }),
    );
  });

  it('Rango inválido o desde > hasta: error y sin consulta nueva', async () => {
    const api = makeApi();
    await renderReports(api, { ...OCT, mode: 'range', desde: '2026-01-01', hasta: '2026-01-31' });
    await screen.findByTestId('report-card-ingresos');
    const calls = api.getReportSummary.mock.calls.length;
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-02-30');
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(await screen.findByText(/formato AAAA-MM-DD/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '');
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(screen.getByText(/formato AAAA-MM-DD/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Desde'), '2026-03-01');
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-02-01');
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(screen.getByText(/no puede ser posterior/)).toBeTruthy();
    expect(api.getReportSummary.mock.calls.length).toBe(calls);
    // Corregir el rango limpia el error.
    await fireEvent.changeText(screen.getByLabelText('Hasta'), '2026-03-02');
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(screen.queryByText(/no puede ser posterior/)).toBeNull();
  });
});

describe('ReportsScreen: estados', () => {
  it('muestra carga y luego el contenido', async () => {
    const gate = controlledPromise<ReportSummary>();
    const api = makeApi({ getReportSummary: jest.fn(() => gate.promise) });
    await renderReports(api);
    expect(screen.getByTestId('reports-loading')).toBeTruthy();
    await act(async () =>
      gate.resolve(summaryOf({ accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' })),
    );
    expect(await screen.findByTestId('report-card-ingresos')).toBeTruthy();
    expect(screen.queryByTestId('reports-loading')).toBeNull();
  });

  it('período sin movimientos: mensaje vacío', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) =>
        summaryOf(o, { ingresos: 0, gastos: 0, balance: 0, cantidad: 0 }),
      ),
      getReportByCategory: jest.fn(async (_t, o) => emptyCategories(o)),
    });
    await renderReports(api);
    expect(await screen.findByText('Sin movimientos en este período')).toBeTruthy();
    expect(screen.queryByTestId('report-card-ingresos')).toBeNull();
  });

  it('error con Reintentar: vuelve a consultar y muestra los datos', async () => {
    const summary = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('server', 500))
      .mockImplementation(async (_t: string, o: Opts) => summaryOf(o));
    const api = makeApi({ getReportSummary: summary });
    await renderReports(api);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('report-card-ingresos')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar reportes'));
    expect(await screen.findByTestId('report-card-ingresos')).toBeTruthy();
    expect(summary).toHaveBeenCalledTimes(2);
  });

  it('un fallo en by-category o en la serie también es un error único', async () => {
    const api = makeApi({
      getReportByPeriod: jest.fn(async () => {
        throw new AuthError('server', 500);
      }),
    });
    await renderReports(api, { ...OCT, mode: 'year' });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('report-card-gastos')).toBeNull();
  });

  it('descarta la respuesta de un período anterior que llega tarde', async () => {
    const slow = controlledPromise<ReportSummary>();
    const summary = jest.fn(async (_t: string, o: Opts) =>
      o.desde === '2026-10-01'
        ? slow.promise
        : summaryOf(o, { ingresos: 777, balance: 777 - 4550 }),
    );
    // gastos fijos 4550: balance coherente solo importa para el parser real, aquí es un doble.
    const api = makeApi({ getReportSummary: summary });
    await renderReports(api);
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(await screen.findByText('$7.77')).toBeTruthy();
    await act(async () =>
      slow.resolve(
        summaryOf(
          { accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' },
          { ingresos: 999900 },
        ),
      ),
    );
    expect(screen.getByText('$7.77')).toBeTruthy();
    expect(screen.queryByText('$9999.00')).toBeNull();
  });

  it('no actualiza el estado tras desmontar', async () => {
    const gate = controlledPromise<ReportSummary>();
    const api = makeApi({ getReportSummary: jest.fn(() => gate.promise) });
    const view = await renderReports(api);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await view.unmount();
    await act(async () =>
      gate.resolve(summaryOf({ accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' })),
    );
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('ReportsScreen: navegación al historial', () => {
  it('tocar una categoría abre el historial con categoryId y el rango', async () => {
    await renderReports();
    await fireEvent.press(await screen.findByTestId('report-category-c-food'));
    expect(onOpenHistory).toHaveBeenCalledWith({
      categoryId: 'c-food',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('tocar la tarjeta de gastos o ingresos filtra por tipo y rango', async () => {
    await renderReports();
    await fireEvent.press(await screen.findByTestId('report-card-gastos'));
    expect(onOpenHistory).toHaveBeenLastCalledWith({
      tipo: 'gasto',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    await fireEvent.press(screen.getByTestId('report-card-ingresos'));
    expect(onOpenHistory).toHaveBeenLastCalledWith({
      tipo: 'ingreso',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });
});

describe('ReportsScreen: cuenta y sesión', () => {
  it('cambio de cuenta (remontado) consulta la nueva cuenta sin restos de la anterior', async () => {
    const api = makeApi();
    const first = await renderReports(api);
    await screen.findByText('Sueldo');
    await first.unmount();
    const other = account({ id: 'acc-9', nombre: 'Ahorros' });
    const otherApi = makeApi({
      getReportByCategory: jest.fn(async (_t, o) => emptyCategories(o)),
      getReportSummary: jest.fn(async (_t, o) => summaryOf(o, { ingresos: 5, balance: 5 - 4550 })),
    });
    await renderReports(otherApi, OCT, other);
    expect(await screen.findByText('Reportes de Ahorros')).toBeTruthy();
    await screen.findByTestId('report-card-ingresos');
    expect(screen.queryByText('Sueldo')).toBeNull();
    expect(screen.queryByText('Efectivo')).toBeNull();
    for (const call of otherApi.getReportSummary.mock.calls)
      expect(call[1].accountId).toBe('acc-9');
    expect(api.getReportSummary).toHaveBeenCalledTimes(1);
  });
});

describe('ReportsScreen: exportar archivos', () => {
  const CSV_BYTES = new Uint8Array([0xef, 0xbb, 0xbf, 0x66, 0x0d, 0x0a]);
  const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const share = shareExport as jest.MockedFunction<typeof shareExport>;
  const clear = clearExports as jest.MockedFunction<typeof clearExports>;

  const exportApi = (impl?: () => Promise<Uint8Array>) =>
    makeApi({ exportFile: jest.fn(impl ?? (async () => CSV_BYTES)) });

  it('muestra los botones CSV y PDF bajo los totales, sin texto «pendiente»', async () => {
    await renderReports();
    expect(await screen.findByLabelText('Exportar CSV')).toBeTruthy();
    expect(screen.getByLabelText('Exportar PDF')).toBeTruthy();
    expect(screen.queryByText(/pendiente/i)).toBeNull();
  });

  it('no se ofrece cuando el período no tiene movimientos', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) => summaryOf(o, { cantidad: 0 })),
      getReportByCategory: jest.fn(async (_t, o) => emptyCategories(o)),
    });
    await renderReports(api);
    await screen.findByText('Sin movimientos en este período');
    expect(screen.queryByLabelText('Exportar CSV')).toBeNull();
    expect(screen.queryByLabelText('Exportar PDF')).toBeNull();
  });

  it('limpia la caché de exportaciones al montar', async () => {
    await renderReports();
    await screen.findByLabelText('Exportar CSV');
    expect(clear).toHaveBeenCalled();
  });

  it('CSV (Mes): pide format=csv, limpia y entrega bytes, nombre y mimeType exactos', async () => {
    const api = exportApi();
    await renderReports(api);
    clear.mockClear();
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(api.exportFile).toHaveBeenCalledWith('tok', {
      accountId: 'acc-1',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      format: 'csv',
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      bytes: CSV_BYTES,
      name: 'movimientos_2026-10-01_2026-10-31.csv',
      mimeType: 'text/csv',
    });
  });

  it('PDF: pide format=pdf y entrega application/pdf con extensión .pdf', async () => {
    const api = exportApi(async () => PDF_BYTES);
    await renderReports(api);
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(api.exportFile).toHaveBeenCalledWith('tok', expect.objectContaining({ format: 'pdf' }));
    expect(share).toHaveBeenCalledWith({
      bytes: PDF_BYTES,
      name: 'movimientos_2026-10-01_2026-10-31.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('usa el rango de los modos Año y Rango', async () => {
    const year = exportApi();
    const first = await renderReports(year, { ...OCT, mode: 'year' });
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(year.exportFile).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ desde: '2026-01-01', hasta: '2026-12-31' }),
    );
    await first.unmount();
    const range = exportApi();
    await renderReports(range, { ...OCT, mode: 'range', desde: '2026-02-03', hasta: '2026-04-05' });
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'movimientos_2026-02-03_2026-04-05.pdf' }),
    );
  });

  it('cargando: ambos botones deshabilitados, «Exportando…» y el doble toque no duplica', async () => {
    const gate = controlledPromise<Uint8Array>();
    const api = exportApi(() => gate.promise);
    await renderReports(api);
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    expect(await screen.findByText('Exportando…')).toBeTruthy();
    expect(screen.getByTestId('export-loading')).toBeTruthy();
    expect(screen.getByLabelText('Exportar PDF').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Exportar CSV').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Exportar PDF'));
    await fireEvent.press(screen.getByLabelText('Exportar CSV'));
    expect(api.exportFile).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(PDF_BYTES));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('export-loading')).toBeNull());
    expect(screen.getByText('Exportar CSV')).toBeTruthy();
    expect(screen.getByText('Exportar PDF')).toBeTruthy();
    // No se afirma éxito: Android no informa si se compartió.
    expect(screen.queryByText(/exportado|enviado|compartido|listo/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tope 400: mensaje específico, sin compartir, reintentable con el mismo formato', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiRequestError(400, 'EXPORT_TOO_LARGE'))
      .mockResolvedValue(PDF_BYTES);
    await renderReports(makeApi({ exportFile: fn }));
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    expect(
      await screen.findByText(
        'El rango tiene más de 2000 movimientos; elige un período más corto.',
      ),
    ).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Reintentar exportación'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][1]).toEqual(expect.objectContaining({ format: 'pdf' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('404, 401, red y desconocido muestran error por causa y no comparten', async () => {
    const cases: [unknown, RegExp][] = [
      [new ApiRequestError(404, 'NOT_FOUND'), /ya no existe/],
      [new AuthError('rejected', 401), /verificar tu sesión/],
      [new AuthError('network'), /No se pudo conectar/],
      [new AuthError('server', 503), /servidor no está disponible/],
      [new AuthError('unknown'), /error inesperado/],
    ];
    for (const [error, text] of cases) {
      const view = await renderReports(makeApi({ exportFile: jest.fn().mockRejectedValue(error) }));
      await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
      expect(await screen.findByText(text)).toBeTruthy();
      await view.unmount();
    }
    expect(share).not.toHaveBeenCalled();
  });

  it('error al escribir: «No se pudo preparar el archivo», reintentable', async () => {
    share.mockRejectedValueOnce(new ExportFileError('EXPORT_WRITE_FAILED'));
    await renderReports(exportApi());
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    expect(await screen.findByText(/No se pudo preparar el archivo/)).toBeTruthy();
    expect(screen.getByLabelText('Exportar CSV').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByLabelText('Reintentar exportación'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('módulo nativo ausente: mensaje de versión desactualizada', async () => {
    share.mockRejectedValueOnce(new ExportFileError('EXPORT_UNAVAILABLE'));
    await renderReports(exportApi());
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    expect(
      await screen.findByText(
        'Esta versión de la app no admite compartir archivos; instala la versión actualizada.',
      ),
    ).toBeTruthy();
  });

  it('cualquier otro fallo al compartir muestra error genérico reintentable', async () => {
    share.mockRejectedValueOnce(new Error('SharingInProgress'));
    await renderReports(exportApi());
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    expect(await screen.findByText(/error inesperado/)).toBeTruthy();
    expect(screen.getByLabelText('Exportar CSV').props.accessibilityState.disabled).toBe(false);
  });

  it('cambio de período durante la exportación: se descarta sin compartir', async () => {
    const gate = controlledPromise<Uint8Array>();
    await renderReports(exportApi(() => gate.promise));
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    await act(async () => gate.resolve(CSV_BYTES));
    expect(share).not.toHaveBeenCalled();
    expect(await screen.findByText('Noviembre 2026')).toBeTruthy();
  });

  it('cambio de cuenta durante la exportación: la respuesta obsoleta no comparte', async () => {
    const gate = controlledPromise<Uint8Array>();
    const view = await renderReports(exportApi(() => gate.promise));
    await fireEvent.press(await screen.findByLabelText('Exportar PDF'));
    await view.rerender(
      <ReportsScreen
        account={account({ id: 'acc-2', nombre: 'Otra' })}
        api={makeApi()}
        initialView={OCT}
        onViewChange={onViewChange}
        onOpenHistory={onOpenHistory}
      />,
    );
    await act(async () => gate.resolve(PDF_BYTES));
    expect(share).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('Exportar PDF')).toBeTruthy();
    expect(screen.getByLabelText('Exportar PDF').props.accessibilityState.disabled).toBe(false);
  });

  it('volver al período original tras descartar la exportación no deja el botón bloqueado', async () => {
    const gate = controlledPromise<Uint8Array>();
    await renderReports(exportApi(() => gate.promise));
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    await act(async () => gate.resolve(CSV_BYTES));
    await fireEvent.press(await screen.findByLabelText('Mes anterior'));
    const button = await screen.findByLabelText('Exportar CSV');
    expect(button.props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('Exportando…')).toBeNull();
    expect(share).not.toHaveBeenCalled();
  });

  it('desmontaje (logout o cambio de usuario): no comparte ni actualiza estado', async () => {
    const gate = controlledPromise<Uint8Array>();
    const view = await renderReports(exportApi(() => gate.promise));
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await view.unmount();
    await act(async () => gate.resolve(CSV_BYTES));
    expect(share).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    // Un usuario nuevo parte limpio: sin estado de exportación ni mensajes previos.
    await renderReports(exportApi(), OCT, account({ id: 'acc-2', nombre: 'Otra' }));
    expect(await screen.findByLabelText('Exportar CSV')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Exportando…')).toBeNull();
  });

  it('no escribe en la consola datos financieros', async () => {
    const spies = (['log', 'warn', 'error'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    await renderReports(exportApi());
    await fireEvent.press(await screen.findByLabelText('Exportar CSV'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('Comida');
      expect(JSON.stringify(spy.mock.calls)).not.toContain('1500');
      spy.mockRestore();
    }
  });
});
