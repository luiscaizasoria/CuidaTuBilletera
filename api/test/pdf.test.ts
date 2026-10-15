import { describe, expect, it } from 'vitest';
import {
  buildExportPdf,
  NOTE_MAX_CHARS,
  ROWS_PER_PAGE,
  toWinAnsi,
  type ExportPdfData,
  type PdfRow,
} from '../src/lib/pdf';
import { inspectPdf, latin1 } from './pdf-helpers';

const row = (over: Partial<PdfRow> = {}): PdfRow => ({
  fecha: '2026-10-05',
  tipo: 'gasto',
  categoria: 'Comida',
  nota: null,
  monto: 1250,
  ...over,
});
const data = (rows: PdfRow[], over: Partial<ExportPdfData> = {}): ExportPdfData => ({
  accountName: 'Cuenta principal',
  desde: '2026-10-01',
  hasta: '2026-10-31',
  rows,
  ...over,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => row({ nota: `nota ${i + 1}` }));
const allText = (pdf: Uint8Array) => inspectPdf(pdf).pages.flat();

describe('buildExportPdf: estructura', () => {
  const cases: [string, ExportPdfData][] = [
    ['vacío', data([])],
    ['una fila', data([row()])],
    ['una página llena', data(many(ROWS_PER_PAGE - 1))],
    ['totales en página aparte', data(many(ROWS_PER_PAGE))],
    [
      'varias páginas',
      data(many(ROWS_PER_PAGE * 3 + 7), { tipo: 'gasto', categoryName: 'Comida' }),
    ],
  ];

  it.each(cases)('%s: PDF 1.4 bien formado', (_name, input) => {
    const bytes = buildExportPdf(input);
    const pdf = inspectPdf(bytes);

    expect(pdf.raw.startsWith('%PDF-1.4\n%')).toBe(true);
    expect([...bytes.slice(10, 14)]).toEqual([0xe2, 0xe3, 0xcf, 0xd3]);
    expect(bytes[14]).toBe(0x0a);
    expect(pdf.raw.endsWith('%%EOF\n')).toBe(true);

    // startxref apunta exactamente al byte de la palabra xref
    expect(pdf.startxref).toBe(pdf.xrefOffset);
    expect(pdf.raw.slice(pdf.startxref, pdf.startxref + 5)).toBe('xref\n');

    // /Size = número de entradas y trailer completo
    expect(pdf.size).toBe(5 + 2 * pdf.count);
    expect(pdf.xrefEntries).toHaveLength(pdf.size);
    expect(pdf.raw).toContain(`trailer\n<< /Size ${pdf.size} /Root 1 0 R >>\nstartxref`);

    // entradas de exactamente 20 bytes; la 0 es la cabecera de la lista libre
    for (const entry of pdf.xrefEntries) expect(entry.line).toHaveLength(20);
    expect(pdf.xrefEntries[0]?.line).toBe('0000000000 65535 f \n');

    // cada offset apunta a "N 0 obj"
    for (let id = 1; id < pdf.size; id++) {
      const entry = pdf.xrefEntries[id];
      expect(entry?.kind).toBe('n');
      expect(entry?.gen).toBe(0);
      expect(pdf.raw.slice(entry?.offset, (entry?.offset ?? 0) + `${id} 0 obj\n`.length)).toBe(
        `${id} 0 obj\n`,
      );
    }

    // /Length coincide con los bytes reales del stream
    expect(pdf.streams).toHaveLength(pdf.count);
    for (const stream of pdf.streams) expect(stream.declared).toBe(stream.actual);

    // /Count = páginas, Kids coherentes, cada Page referencia su Contents y las fuentes
    expect(pdf.pageIds).toHaveLength(pdf.count);
    expect(pdf.pageIds).toEqual(Array.from({ length: pdf.count }, (_, i) => 5 + 2 * i));
    pdf.pageIds.forEach((pageId) => {
      const body = pdf.objects.get(pageId)?.body ?? '';
      expect(body).toContain('/Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]');
      expect(body).toContain(`/Contents ${pageId + 1} 0 R`);
      expect(body).toContain('/F1 3 0 R /F2 4 0 R');
    });
    expect(pdf.objects.get(1)?.body).toContain('/Type /Catalog /Pages 2 0 R');
    expect(pdf.objects.get(3)?.body).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(pdf.objects.get(4)?.body).toContain('/BaseFont /Helvetica-Bold');
    expect(pdf.raw).not.toContain('NaN');
    expect(pdf.raw).not.toContain('undefined');
  });

  it('es determinista', () => {
    const a = buildExportPdf(data(many(10)));
    const b = buildExportPdf(data(many(10)));
    expect(latin1(a)).toBe(latin1(b));
  });
});

describe('buildExportPdf: contenido y paginación', () => {
  it('extrae título, cuenta, rango, filas y totales', () => {
    const text = allText(
      buildExportPdf(
        data([
          row({ tipo: 'ingreso', categoria: 'Sueldo', nota: 'Pago', monto: 150000 }),
          row({ nota: 'Almuerzo', monto: 1250 }),
        ]),
      ),
    );
    expect(text).toEqual(
      expect.arrayContaining([
        'Movimientos',
        'Página 1 de 1',
        'Cuenta: Cuenta principal',
        'Período: 2026-10-01 a 2026-10-31',
        'Fecha',
        'Tipo',
        'Categoría',
        'Nota',
        'Monto',
        'Ingreso',
        'Sueldo',
        'Pago',
        '1500.00',
        'Gasto',
        'Comida',
        'Almuerzo',
        '-12.50',
        'Total ingresos',
        'Total gastos',
        'Balance',
        '1487.50',
      ]),
    );
    expect(text.some((t) => t.startsWith('Filtros'))).toBe(false);
    expect(text).not.toContain('Sin movimientos');
  });

  it('muestra los filtros activos', () => {
    const both = allText(
      buildExportPdf(data([row()], { tipo: 'gasto', categoryName: 'Comida (casa)' })),
    );
    expect(both).toContain('Filtros: Tipo: Gasto | Categoría: Comida (casa)');
    expect(allText(buildExportPdf(data([row()], { tipo: 'ingreso' })))).toContain(
      'Filtros: Tipo: Ingreso',
    );
    expect(allText(buildExportPdf(data([row()], { categoryName: 'Ocio' })))).toContain(
      'Filtros: Categoría: Ocio',
    );
  });

  it('sin filas: una página con «Sin movimientos» y totales en cero', () => {
    const pdf = inspectPdf(buildExportPdf(data([])));
    expect(pdf.count).toBe(1);
    const text = pdf.pages[0] ?? [];
    expect(text).toContain('Sin movimientos');
    expect(text).toContain('Página 1 de 1');
    expect(text.filter((t) => t === '0.00')).toHaveLength(3);
  });

  it('ROWS_PER_PAGE filas por página; Y se calcula antes de emitir y la cabecera se repite', () => {
    const pdf = inspectPdf(buildExportPdf(data(many(ROWS_PER_PAGE + 1))));
    expect(pdf.count).toBe(2);
    pdf.pages.forEach((text, i) => {
      expect(text).toContain(`Página ${i + 1} de 2`);
      for (const header of ['Movimientos', 'Cuenta: Cuenta principal', 'Fecha', 'Monto']) {
        expect(text).toContain(header);
      }
    });
    const notes = (page: string[]) => page.filter((t) => /^nota \d+$/.test(t));
    expect(notes(pdf.pages[0] ?? [])).toHaveLength(ROWS_PER_PAGE);
    expect(notes(pdf.pages[1] ?? [])).toEqual([`nota ${ROWS_PER_PAGE + 1}`]);
    expect(pdf.pages[0]).not.toContain('Balance');
    expect(pdf.pages[1]).toContain('Balance');
  });

  it('la última fila de la última página lleva los totales si caben', () => {
    const pdf = inspectPdf(buildExportPdf(data(many(ROWS_PER_PAGE - 1))));
    expect(pdf.count).toBe(1);
    expect(pdf.pages[0]).toContain('Balance');
  });

  it('si los totales no caben van a una página nueva con la cabecera repetida', () => {
    const pdf = inspectPdf(buildExportPdf(data(many(ROWS_PER_PAGE))));
    expect(pdf.count).toBe(2);
    expect(pdf.pages[0]).not.toContain('Balance');
    expect(pdf.pages[1]).toEqual(
      expect.arrayContaining(['Página 2 de 2', 'Total ingresos', 'Balance']),
    );
    expect(pdf.pages[1]?.some((t) => /^nota \d+$/.test(t))).toBe(false);
    expect(pdf.pages[0]?.filter((t) => /^nota \d+$/.test(t))).toHaveLength(ROWS_PER_PAGE);
  });

  it('2000 filas generan ceil(2000 / ROWS_PER_PAGE) páginas y todas las filas', () => {
    const pdf = inspectPdf(buildExportPdf(data(many(2000))));
    expect(pdf.count).toBe(Math.ceil(2000 / ROWS_PER_PAGE));
    expect(pdf.pages.flat().filter((t) => /^nota \d+$/.test(t))).toHaveLength(2000);
  });
});

describe('buildExportPdf: totales', () => {
  const totalsOf = (rows: PdfRow[]) => {
    const text = allText(buildExportPdf(data(rows)));
    const at = text.indexOf('Total ingresos');
    return text.slice(at, at + 6);
  };

  it('suma ingresos y gastos; el gasto lleva «-»', () => {
    const rows = [
      row({ tipo: 'ingreso', monto: 100000 }),
      row({ tipo: 'gasto', monto: 25005 }),
      row({ tipo: 'gasto', monto: 5 }),
    ];
    expect(totalsOf(rows)).toEqual([
      'Total ingresos',
      '1000.00',
      'Total gastos',
      '-250.10',
      'Balance',
      '749.90',
    ]);
  });

  it('balance negativo se formatea con «-» y valor absoluto', () => {
    expect(totalsOf([row({ tipo: 'ingreso', monto: 100 }), row({ monto: 10050 })])).toEqual([
      'Total ingresos',
      '1.00',
      'Total gastos',
      '-100.50',
      'Balance',
      '-99.50',
    ]);
  });

  it('balance cero y gastos cero no llevan «-»', () => {
    expect(totalsOf([row({ tipo: 'ingreso', monto: 500 })])[3]).toBe('0.00');
    expect(totalsOf([row({ tipo: 'ingreso', monto: 500 }), row({ monto: 500 })])[5]).toBe('0.00');
  });

  it('enteros seguros grandes se suman sin perder precisión', () => {
    const big = Number.MAX_SAFE_INTEGER - 5;
    expect(
      totalsOf([row({ tipo: 'ingreso', monto: big }), row({ tipo: 'ingreso', monto: 5 })])[1],
    ).toBe('90071992547409.91');
  });

  it('rechaza montos o totales fuera de los enteros seguros', () => {
    const lanza = (rows: PdfRow[]) => () => buildExportPdf(data(rows));
    expect(lanza([row({ monto: Number.MAX_SAFE_INTEGER + 1 })])).toThrow(Error);
    expect(lanza([row({ monto: 1.5 })])).toThrow(Error);
    expect(lanza([row({ monto: -1 })])).toThrow(Error);
    expect(lanza([row({ monto: Number.NaN })])).toThrow(Error);
    const big = Number.MAX_SAFE_INTEGER - 1;
    expect(
      lanza([row({ tipo: 'ingreso', monto: big }), row({ tipo: 'ingreso', monto: 5 })]),
    ).toThrow(Error);
    expect(lanza([row({ tipo: 'gasto', monto: big }), row({ tipo: 'gasto', monto: 5 })])).toThrow(
      Error,
    );
  });
});

describe('toWinAnsi y escapado', () => {
  it('ASCII y Latin-1 directos (acentos, ñ, ¿, ¡)', () => {
    expect(toWinAnsi('Año ¿Qué? ¡Sí! áéíóú ÁÉÍÓÚ ü')).toEqual(
      [...'Año ¿Qué? ¡Sí! áéíóú ÁÉÍÓÚ ü'].map((c) => c.codePointAt(0)),
    );
    expect(toWinAnsi('ñ')).toEqual([0xf1]);
    expect(toWinAnsi('¿¡')).toEqual([0xbf, 0xa1]);
    expect(toWinAnsi('é')).toEqual([0xe9]);
  });

  it('mapea 0x80-0x9F de WinAnsi', () => {
    expect(toWinAnsi('€…“”‘’–—™•')).toEqual([
      0x80, 0x85, 0x93, 0x94, 0x91, 0x92, 0x96, 0x97, 0x99, 0x95,
    ]);
  });

  it('lo no representable pasa a «?» por code point (emoji = un solo «?»)', () => {
    expect(toWinAnsi('a😀b')).toEqual([0x61, 0x3f, 0x62]);
    expect(toWinAnsi('日本')).toEqual([0x3f, 0x3f]);
    expect(toWinAnsi('\ud800')).toEqual([0x3f]); // sustituto suelto
  });

  it('controles y saltos pasan a espacio, se colapsan y se recortan', () => {
    expect(toWinAnsi('a\r\nb\tc\u0000d\u0085e f')).toEqual(
      [...'a b c d e f'].map((c) => c.charCodeAt(0)),
    );
    expect(toWinAnsi('  a   b  ')).toEqual([0x61, 0x20, 0x62]);
    expect(toWinAnsi('\n\n')).toEqual([]);
    expect(toWinAnsi(' x')).toEqual([0xa0, 0x78]);
  });

  it('trunca con «…» (0x85) al exceder el máximo y no antes', () => {
    const exact = 'x'.repeat(NOTE_MAX_CHARS);
    expect(toWinAnsi(exact, NOTE_MAX_CHARS)).toHaveLength(NOTE_MAX_CHARS);
    expect(toWinAnsi(exact, NOTE_MAX_CHARS).includes(0x85)).toBe(false);
    const cut = toWinAnsi(exact + 'y', NOTE_MAX_CHARS);
    expect(cut).toHaveLength(NOTE_MAX_CHARS);
    expect(cut.at(-1)).toBe(0x85);
    expect(toWinAnsi('ab '.repeat(30), 10).at(-2)).not.toBe(0x20);
  });

  it('el PDF escapa paréntesis y backslash, sin saltos de línea en el texto', () => {
    const bytes = buildExportPdf(data([row({ nota: 'a(b)c\\d\ne', categoria: 'Ocio (x)' })]));
    const pdf = inspectPdf(bytes);
    expect(pdf.raw).toContain('(a\\(b\\)c\\\\d e)');
    expect(pdf.raw).toContain('(Ocio \\(x\\))');
    expect(pdf.pages[0]).toEqual(expect.arrayContaining(['a(b)c\\d e', 'Ocio (x)']));
    for (const stream of pdf.streams) expect(stream.declared).toBe(stream.actual);
  });

  it('los bytes de acentos, ñ, ¿, ¡, emoji y truncado salen en el PDF tal cual', () => {
    const long = `Compra de año ¿ñandú? ¡hola! ${'z'.repeat(60)}`;
    const bytes = buildExportPdf(
      data([row({ nota: long, categoria: 'Educación' }), row({ nota: 'rico 😀 ok' })], {
        accountName: 'Cuenta ñ',
      }),
    );
    const pdf = inspectPdf(bytes);
    const text = pdf.pages[0] ?? [];
    expect(text).toContain('Cuenta: Cuenta ñ');
    expect(text).toContain('Educación');
    expect(text).toContain('rico ? ok');
    const truncated = text.find((t) => t.startsWith('Compra de año')) as string;
    expect(truncated).toHaveLength(NOTE_MAX_CHARS);
    expect(truncated.startsWith('Compra de año ¿ñandú? ¡hola! zzz')).toBe(true);
    expect(truncated.endsWith('\u0085')).toBe(true);
    // el stream es WinAnsi, no UTF-8: «ñ» es el byte 0xF1 y no existe C3 B1
    expect(pdf.raw).toContain('(Cuenta: Cuenta ñ)');
    expect(pdf.raw).not.toContain('Ã±');
    expect(pdf.raw).not.toContain('ð'); // sin bytes UTF-8 del emoji (F0 9F ...)
    for (const stream of pdf.streams) expect(stream.declared).toBe(stream.actual);
  });

  it('la categoría larga se trunca y la nota nula queda vacía', () => {
    const text = allText(buildExportPdf(data([row({ categoria: 'C'.repeat(50), nota: null })])));
    expect(text.find((t) => t.startsWith('CCC'))).toHaveLength(22);
    expect(text).toContain('');
  });
});
