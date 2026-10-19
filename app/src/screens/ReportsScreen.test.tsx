import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import { ExportFileError, clearExports, shareExport } from '../lib/export-files';
import { ApiRequestError } from '../lib/resources-api';
import type { CategoryReport, PeriodReport, ReportSummary } from '../lib/resources-api';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { colors, moduleColors } from '../theme/tokens';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import ReportsScreen from './ReportsScreen';
import type { ReportsView } from '../lib/reports';

relaxTimeoutsForColdCache();

jest.mock('../lib/export-files', () => ({
  ...jest.requireActual('../lib/export-files'),
  clearExports: jest.fn(),
  shareExport: jest.fn(async () => undefined),
}));

// Fecha local fija: el selector de fechas abre en el mes de hoy.
jest.mock('../lib/dates', () => ({
  ...jest.requireActual('../lib/dates'),
  todayLocal: () => '2026-10-15',
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

// El primer render del archivo transforma en frío los módulos de React Native (en CI no hay caché de
// Jest) y puede pasar de los 5 s de una prueba. Se paga una vez aquí, con límite propio, para que
// ninguna prueba cargue con ese costo.
beforeAll(async () => {
  const view = await renderReports();
  await view.findByTestId('report-card-ingresos');
  view.unmount();
  jest.clearAllMocks();
}, 60_000);

beforeEach(() => {
  mockWindow(360, 1);
});

afterEach(() => jest.clearAllMocks());

// Elige una fecha en el selector: abre el campo, navega desde el mes inicial hasta el de la fecha
// y toca el día (el selector abre en el mes de la fecha ya elegida o, si no hay, en el de hoy).
async function pickDate(field: 'Desde' | 'Hasta', from: string, target: string) {
  const current = screen.getByRole('button', { name: new RegExp(`^${field}: `) });
  await fireEvent.press(current);
  const months = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
  const diff = months(target) - months(from);
  for (let i = 0; i < Math.abs(diff); i += 1) {
    await fireEvent.press(
      screen.getByRole('button', { name: diff < 0 ? 'Mes anterior' : 'Mes siguiente' }),
    );
  }
  const day = Number(target.slice(8, 10));
  const names = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const name = names[Number(target.slice(5, 7)) - 1];
  await fireEvent.press(
    screen.getByRole('button', { name: new RegExp(`^${day} de ${name} de ${target.slice(0, 4)}`) }),
  );
}

describe('ReportsScreen: presentación', () => {
  it('modo Mes: consulta summary y by-category del mes, sin serie', async () => {
    const api = makeApi();
    await renderReports(api);
    expect(await screen.findByRole('header', { name: 'Reportes' })).toBeTruthy();
    expect(screen.queryByText(/Reportes de/)).toBeNull();
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
    expect(screen.getByText('+$1200.00')).toBeTruthy();
  });

  it('balance negativo se muestra con signo', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) =>
        summaryOf(o, { ingresos: 0, gastos: 1250, balance: -1250 }),
      ),
    });
    await renderReports(api);
    // Gastos (-$12.50) y Balance (-$12.50): la cifra de Balance va en `text` también si es negativa.
    expect(await screen.findAllByText('-$12.50')).toHaveLength(2);
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
    expect(
      screen.getByTestId('report-bar-c-food', { includeHiddenElements: true }).props.style,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: '100%', backgroundColor: '#E53935' }),
      ]),
    );
    expect(
      screen.getByTestId('report-bar-c-old', { includeHiddenElements: true }).props.style,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: '50%', backgroundColor: '#6B7280' }),
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

  it('Rango: parte del período visto, se elige con el selector y usa serie mensual', async () => {
    const api = makeApi();
    await renderReports(api);
    await screen.findByTestId('report-card-ingresos');
    await fireEvent.press(screen.getByRole('radio', { name: 'Modo Rango' }));
    expect(screen.getByRole('button', { name: 'Desde: 01/10/2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hasta: 31/10/2026' })).toBeTruthy();
    expect(screen.queryByLabelText('Desde')).toBeNull();
    expect(screen.queryByPlaceholderText(/AAAA-MM-DD/)).toBeNull();
    await pickDate('Desde', '2026-10-01', '2026-01-15');
    await pickDate('Hasta', '2026-10-31', '2026-03-20');
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
    expect(screen.getByText('Del 15/01/2026 al 20/03/2026')).toBeTruthy();
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

  it('Rango sin fechas o con desde > hasta: mensaje y sin consulta nueva', async () => {
    const api = makeApi();
    await renderReports(api, { ...OCT, mode: 'range', desde: '', hasta: '' });
    // Sin rango elegido no se consulta nada.
    expect(api.getReportSummary).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(screen.getByText('Elige las fechas «Desde» y «Hasta».')).toBeTruthy();
    expect(api.getReportSummary).not.toHaveBeenCalled();

    await pickDate('Desde', '2026-10-15', '2026-03-01');
    await pickDate('Hasta', '2026-10-15', '2026-02-01');
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(screen.getByText('La fecha «Desde» no puede ser posterior a «Hasta».')).toBeTruthy();
    expect(api.getReportSummary).not.toHaveBeenCalled();

    // Corregir una fecha limpia el error y un rango válido consulta el resumen, las categorías y la serie.
    await pickDate('Hasta', '2026-02-01', '2026-03-02');
    expect(screen.queryByText(/no puede ser posterior/)).toBeNull();
    await fireEvent.press(screen.getByText('Aplicar'));
    await waitFor(() =>
      expect(api.getReportSummary).toHaveBeenLastCalledWith('tok', {
        accountId: 'acc-1',
        desde: '2026-03-01',
        hasta: '2026-03-02',
      }),
    );
    expect(api.getReportByCategory).toHaveBeenCalled();
    expect(api.getReportByPeriod).toHaveBeenCalled();
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
    expect(
      await screen.findByText('Sin movimientos en este período. Prueba con otro mes.'),
    ).toBeTruthy();
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
    expect(await screen.findByText('+$7.77')).toBeTruthy();
    await act(async () =>
      slow.resolve(
        summaryOf(
          { accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' },
          { ingresos: 999900 },
        ),
      ),
    );
    expect(screen.getByText('+$7.77')).toBeTruthy();
    expect(screen.queryByText('+$9999.00')).toBeNull();
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
    expect(await screen.findByRole('header', { name: 'Reportes' })).toBeTruthy();
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
    await screen.findByText('Sin movimientos en este período. Prueba con otro mes.');
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

describe('ReportsScreen: R4 (título, período y resumen)', () => {
  it('Modo es un Segmented tono reportes con etiquetas «Modo Mes/Año/Rango» y Mes por defecto (criterio 23)', async () => {
    await renderReports();
    await screen.findByTestId('report-card-ingresos');
    const labels = screen.getAllByRole('radio').map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['Modo Mes', 'Modo Año', 'Modo Rango']);
    const month = screen.getByRole('radio', { name: 'Modo Mes' });
    expect(month.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(month.props.style)).toMatchObject({
      backgroundColor: moduleColors.reportes.tile,
      minHeight: 48,
    });
  });

  it('las flechas de período miden 48 dp y respetan los límites (criterio 23)', async () => {
    await renderReports(makeApi(), { ...OCT, year: 2000, month: 1 });
    await screen.findByTestId('report-card-ingresos');
    const prev = screen.getByRole('button', { name: 'Mes anterior' });
    expect(StyleSheet.flatten(prev.props.style)).toMatchObject({ width: 48, height: 48 });
    expect(prev.props.accessibilityState.disabled).toBe(true);
  });

  it('Ingresos y Gastos son botones con «Ver movimientos ›»; Balance es texto sin color de módulo (criterio 25)', async () => {
    await renderReports();
    const income = await screen.findByTestId('report-card-ingresos');
    expect(income.props.accessibilityRole).toBe('button');
    expect(screen.getAllByText('Ver movimientos ›')).toHaveLength(2);
    expect(StyleSheet.flatten(screen.getAllByText('Ver movimientos ›')[0]!.props.style).color).toBe(
      colors.brand700,
    );
    expect(StyleSheet.flatten(income.props.style).minHeight).toBeGreaterThanOrEqual(48);
    const balance = screen.getByTestId('report-card-balance');
    expect(balance.props.accessibilityRole).toBeUndefined();
    expect(balance.props.accessible).toBe(true);
    expect(StyleSheet.flatten(screen.getByText('$1154.50').props.style).color).toBe(colors.text);
  });

  it('el Balance negativo va en `text`, no en expenseText (criterio 25)', async () => {
    const api = makeApi({
      getReportSummary: jest.fn(async (_t, o) =>
        summaryOf(o, { ingresos: 0, gastos: 1250, balance: -1250 }),
      ),
    });
    await renderReports(api);
    await screen.findByTestId('report-card-balance');
    const values = screen.getAllByText('-$12.50');
    const colorsUsed = values.map((n) => StyleSheet.flatten(n.props.style).color);
    expect(colorsUsed).toContain(colors.text);
  });
});

describe('ReportsScreen: R4 (barras por categoría)', () => {
  it('fila con ícono de 32 dp, nombre de dos líneas sin elipsis, total, porcentaje y barra decorativa (criterio 26)', async () => {
    await renderReports();
    const name = await screen.findByText('Comida');
    expect(name.props.numberOfLines).toBe(2);
    expect(name.props.ellipsizeMode).toBe('clip');
    expect(screen.getByText('66.7%')).toBeTruthy();
    expect(screen.getByText('$30.33')).toBeTruthy();
    const icons = screen.getAllByTestId('category-icon', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icons[0]!.props.style)).toMatchObject({ width: 32, height: 32 });
    const bar = screen.getByTestId('report-bar-c-food', { includeHiddenElements: true });
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({ height: 10, borderRadius: 5 });
    expect(bar.parent!.props.importantForAccessibility).toBe('no');
    expect(StyleSheet.flatten(bar.parent!.props.style)).toMatchObject({
      height: 10,
      backgroundColor: colors.border,
    });
    expect(screen.getByTestId('report-category-c-food').props.accessibilityLabel).toBe(
      'Comida: $30.33, 66.7% de los gastos. Ver movimientos',
    );
  });

  it('un importe pequeño conserva un mínimo visible de 4 dp (criterio 26)', async () => {
    const api = makeApi({
      getReportByCategory: jest.fn(async (_t, o) => ({
        ...emptyCategories(o),
        gastos: {
          total: 100001,
          items: [
            {
              categoryId: 'g',
              nombre: 'Grande',
              icono: 'tag',
              color: '#E53935',
              archivada: false,
              total: 100000,
              cantidad: 1,
            },
            {
              categoryId: 'p',
              nombre: 'Pequeña',
              icono: 'tag',
              color: '#E53935',
              archivada: false,
              total: 1,
              cantidad: 1,
            },
          ],
        },
      })),
    });
    await renderReports(api);
    const tiny = await screen.findByTestId('report-bar-p', { includeHiddenElements: true });
    expect(StyleSheet.flatten(tiny.props.style)).toMatchObject({ width: '0%', minWidth: 4 });
  });

  it('el nombre largo de 40 caracteres no usa numberOfLines de 1 (criterio 26)', async () => {
    const long = 'N'.repeat(40);
    const api = makeApi({
      getReportByCategory: jest.fn(async (_t, o) => ({
        ...emptyCategories(o),
        gastos: {
          total: 10,
          items: [
            {
              categoryId: 'l',
              nombre: long,
              icono: 'tag',
              color: '#E53935',
              archivada: false,
              total: 10,
              cantidad: 1,
            },
          ],
        },
      })),
    });
    await renderReports(api);
    expect((await screen.findByText(long)).props.numberOfLines).toBe(2);
  });
});

describe('ReportsScreen: R4 (serie, leyenda y tabla)', () => {
  const yearView: ReportsView = { ...OCT, mode: 'year' };

  it('la serie trae leyenda «↑ Ingresos / ↓ Gastos» y el aviso de desplazamiento solo si hace falta (criterio 27)', async () => {
    await renderReports(makeApi(), yearView);
    await screen.findByText('Evolución mensual');
    expect(screen.getByText('↑ Ingresos')).toBeTruthy();
    expect(screen.getByText('↓ Gastos')).toBeTruthy();
    expect(screen.queryByText('Desliza para ver más períodos.')).toBeNull();
    const scroller = screen.getByTestId('period-scroll');
    await fireEvent(scroller, 'layout', { nativeEvent: { layout: { width: 200 } } });
    await fireEvent(scroller, 'contentSizeChange', 900, 120);
    expect(screen.getByText('Desliza para ver más períodos.')).toBeTruthy();
  });

  it('las columnas conservan su etiqueta y las cifras no escalan con la fuente (criterio 27)', async () => {
    await renderReports(makeApi(), yearView);
    await screen.findByText('Evolución mensual');
    expect(screen.getByTestId('report-period-2026-01').props.accessibilityLabel).toBe(
      'Ene 26: ingresos $2.00, gastos $1.00',
    );
    expect(screen.getByText('+2').props.allowFontScaling).toBe(false);
    expect(StyleSheet.flatten(screen.getByText('Ene 26').props.style).fontSize).toBe(12);
    // Ingresos a la izquierda, Gastos a la derecha.
    const bars = screen.getByTestId('report-period-ingresos-2026-01').parent!.children;
    expect((bars[0] as unknown as { props: { testID: string } }).props.testID).toBe(
      'report-period-ingresos-2026-01',
    );
    expect((bars[1] as unknown as { props: { testID: string } }).props.testID).toBe(
      'report-period-gastos-2026-01',
    );
  });

  it('«Tabla» muestra una fila por período con los valores de la API y su etiqueta (criterio 27)', async () => {
    await renderReports(makeApi(), yearView);
    await screen.findByText('Evolución mensual');
    expect(screen.getByRole('radio', { name: 'Gráfico' }).props.accessibilityState.selected).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Tabla' }));
    expect(screen.queryByTestId('report-period-2026-01')).toBeNull();
    expect(screen.getByText('Período')).toBeTruthy();
    expect(screen.getByTestId('report-table-2026-03').props.accessibilityLabel).toBe(
      'Mar 26: ingresos $1.00, gastos $4.00, balance -$3.00',
    );
    expect(screen.getByTestId('report-table-2026-01').props.accessibilityLabel).toBe(
      'Ene 26: ingresos $2.00, gastos $1.00, balance $1.00',
    );
    expect(screen.getAllByTestId(/^report-table-/)).toHaveLength(3);
    await fireEvent.press(screen.getByRole('radio', { name: 'Gráfico' }));
    expect(screen.getByTestId('report-period-2026-01')).toBeTruthy();
  });

  it('con fuente ≥ 115 % la tabla se apila en dos líneas (criterio 43)', async () => {
    mockWindow(360, 1.3);
    await renderReports(makeApi(), yearView);
    await screen.findByText('Evolución mensual');
    await fireEvent.press(screen.getByRole('radio', { name: 'Tabla' }));
    expect(screen.queryByText('Período')).toBeNull();
    expect(screen.getByText('Ingresos +$1.00 · Gastos -$4.00')).toBeTruthy();
  });
});

describe('ReportsScreen: R4 (exportación al final y estados)', () => {
  it('«Exportar este período» va después del desglose y de la serie, con su texto de alcance (criterio 28)', async () => {
    await renderReports(makeApi(), { ...OCT, mode: 'year' });
    await screen.findByText('Exportar este período');
    expect(screen.getByRole('header', { name: 'Exportar este período' })).toBeTruthy();
    expect(
      screen.getByText(
        'Descarga los movimientos de este período en un archivo para guardarlo o compartirlo.',
      ),
    ).toBeTruthy();
    const headers = screen.getAllByRole('header').map((n) => n.props.children);
    const order = [
      'Gastos por categoría',
      'Ingresos por categoría',
      'Evolución mensual',
      'Exportar este período',
    ];
    const positions = order.map((text) => headers.indexOf(text));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(screen.getByLabelText('Exportar CSV')).toBeTruthy();
    expect(screen.getByLabelText('Exportar PDF')).toBeTruthy();
  });

  it('los botones de exportar son secundarios y de 48 dp (criterio 28)', async () => {
    await renderReports();
    const csv = await screen.findByLabelText('Exportar CSV');
    expect(StyleSheet.flatten(csv.props.style)).toMatchObject({
      minHeight: 48,
      backgroundColor: colors.surface,
      borderColor: colors.brand700,
    });
  });

  it('carga con «Calculando tu resumen…» (criterio 29)', async () => {
    const gate = controlledPromise<ReportSummary>();
    await renderReports(makeApi({ getReportSummary: jest.fn(() => gate.promise) }));
    expect(screen.getByText('Calculando tu resumen…')).toBeTruthy();
    expect(screen.getByTestId('reports-loading')).toBeTruthy();
    await act(async () => gate.resolve(summaryOf({ accountId: 'acc-1', desde: '', hasta: '' })));
  });

  it('vacío según el modo (criterio 29)', async () => {
    const empty = {
      getReportSummary: jest.fn(async (_t: string, o: Opts) => summaryOf(o, { cantidad: 0 })),
      getReportByCategory: jest.fn(async (_t: string, o: Opts) => emptyCategories(o)),
    };
    const view = await renderReports(makeApi(empty), { ...OCT, mode: 'year' });
    expect(
      await screen.findByText('Sin movimientos en este período. Prueba con otro año.'),
    ).toBeTruthy();
    await view.unmount();
    await renderReports(makeApi(empty), {
      ...OCT,
      mode: 'range',
      desde: '2026-01-01',
      hasta: '2026-02-01',
    });
    expect(
      await screen.findByText('Sin movimientos en este período. Prueba con otro rango.'),
    ).toBeTruthy();
  });

  it('el error usa ErrorBox con «Reintentar reportes» y no deja datos anteriores (criterio 29)', async () => {
    const getReportSummary = jest
      .fn()
      .mockResolvedValueOnce(
        summaryOf({ accountId: 'acc-1', desde: '2026-10-01', hasta: '2026-10-31' }),
      )
      .mockRejectedValueOnce(new AuthError('server'));
    await renderReports(makeApi({ getReportSummary }));
    await screen.findByTestId('report-card-ingresos');
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    const message = await screen.findByText(/El servidor no está disponible/);
    expect(StyleSheet.flatten(message.parent!.props.style).backgroundColor).toBe(
      colors.expenseSoft,
    );
    expect(screen.queryByTestId('report-card-ingresos')).toBeNull();
    expect(screen.getByLabelText('Reintentar reportes')).toBeTruthy();
  });

  it('cambiar account.id sin remontar descarta lo anterior y consulta la cuenta nueva (criterio 39)', async () => {
    const gate = controlledPromise<ReportSummary>();
    const getReportSummary = jest
      .fn()
      .mockImplementationOnce(async (_t: string, o: Opts) => summaryOf(o))
      .mockReturnValueOnce(gate.promise);
    const api = makeApi({ getReportSummary });
    const view = await renderReports(api);
    await screen.findByTestId('report-card-ingresos');
    await view.rerender(
      <ReportsScreen
        account={account({ id: 'acc-9', nombre: 'Ahorros' })}
        api={api}
        initialView={OCT}
        onViewChange={onViewChange}
        onOpenHistory={onOpenHistory}
      />,
    );
    expect(screen.queryByTestId('report-card-ingresos')).toBeNull();
    expect(screen.queryByText('Sueldo')).toBeNull();
    expect(screen.getByText('Calculando tu resumen…')).toBeTruthy();
    expect(getReportSummary).toHaveBeenLastCalledWith(
      'tok',
      expect.objectContaining({ accountId: 'acc-9' }),
    );
    await act(async () => gate.resolve(summaryOf({ accountId: 'acc-9', desde: '', hasta: '' })));
  });
});

describe('ReportsScreen: R4 (vista de la serie, UXQA-R4-02)', () => {
  it('Tabla se conserva al cambiar de período y al reintentar tras un error', async () => {
    const base = makeApi();
    const getReportSummary = jest
      .fn()
      .mockImplementationOnce(base.getReportSummary)
      .mockImplementationOnce(base.getReportSummary)
      .mockRejectedValueOnce(new AuthError('server'))
      .mockImplementation(base.getReportSummary);
    await renderReports(makeApi({ getReportSummary }), { ...OCT, mode: 'year' });
    await screen.findByText('Evolución mensual');
    await fireEvent.press(screen.getByRole('radio', { name: 'Tabla' }));
    await fireEvent.press(screen.getByLabelText('Año anterior'));
    await screen.findByTestId('report-table-2026-01');
    expect(screen.queryByTestId('report-period-2026-01')).toBeNull();
    // Un error y «Reintentar reportes» tampoco la reinician.
    await fireEvent.press(screen.getByLabelText('Año anterior'));
    await fireEvent.press(await screen.findByLabelText('Reintentar reportes'));
    await screen.findByText('Evolución mensual');
    expect(screen.getByRole('radio', { name: 'Tabla' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('report-table-2026-01')).toBeTruthy();
  });
});

describe('R4 D6: margen lateral responsive (ReportsScreen)', () => {
  it.each([
    [360, 16],
    [412, 20],
  ])('a %s dp el contenedor usa %s dp de relleno', async (width, margin) => {
    mockWindow(width, 1);
    await renderReports();
    await screen.findByTestId('report-card-ingresos');
    const root = screen.toJSON() as unknown as {
      props: { style: import('react-native').ViewStyle };
    };
    expect(StyleSheet.flatten(root.props.style).padding).toBe(margin);
  });
});
