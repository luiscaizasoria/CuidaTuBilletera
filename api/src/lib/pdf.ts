// Generador puro de PDF 1.4 para la exportación de movimientos. Sin dependencias, sin acceso a
// datos ni HTTP. Texto en Helvetica (WinAnsiEncoding); el contenido se codifica a bytes propios,
// nunca con TextEncoder, y se escribe en una sola pasada sobre un buffer que crece por duplicación.
import { formatCents } from './csv';

export interface PdfRow {
  fecha: string;
  tipo: 'ingreso' | 'gasto';
  categoria: string;
  nota: string | null;
  monto: number;
}

export interface ExportPdfData {
  accountName: string;
  desde: string;
  hasta: string;
  tipo?: 'ingreso' | 'gasto';
  categoryName?: string;
  rows: readonly PdfRow[];
}

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const MARGIN = 40;
export const FONT_SIZE = 9;
export const LEADING = 12;
// Filas de la tabla por página. Con 56 filas el último renglón queda tan abajo que los totales
// pasan a una página nueva; con 55 todavía caben.
export const ROWS_PER_PAGE = 56;
export const NOTE_MAX_CHARS = 40;
export const CATEGORY_MAX_CHARS = 22;

const TOTALS_LINES = 3;
const X_FECHA = MARGIN;
const X_TIPO = 105;
const X_CATEGORIA = 160;
const X_NOTA = 270;
const X_MONTO_RIGHT = PAGE_WIDTH - MARGIN;
const X_PAGE_LABEL = 455;
const FIRST_ROW_Y = 730;
const ELLIPSIS = 0x85;

// ---------------------------------------------------------------------------------------------
// Codificación WinAnsi
// ---------------------------------------------------------------------------------------------

// Code points Unicode que WinAnsi ubica en 0x80-0x9F.
const WIN_ANSI_HIGH = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const SPACE = 0x20;
const QUESTION = 0x3f;

function winAnsiByte(codePoint: number): number {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
  if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) return SPACE; // controles
  if (codePoint === 0x2028 || codePoint === 0x2029) return SPACE;
  return WIN_ANSI_HIGH.get(codePoint) ?? QUESTION;
}

// Texto a bytes WinAnsi: controles y saltos pasan a espacio, los espacios repetidos se colapsan,
// los extremos se recortan y lo no representable (un code point, un par sustituto) pasa a "?".
// Con `maxChars` el texto largo se trunca y termina en "…" (0x85).
export function toWinAnsi(text: string, maxChars?: number): number[] {
  const out: number[] = [];
  for (const char of text) {
    const byte = winAnsiByte(char.codePointAt(0) as number);
    if (byte === SPACE && (out.length === 0 || out[out.length - 1] === SPACE)) continue;
    out.push(byte);
  }
  while (out.length > 0 && out[out.length - 1] === SPACE) out.pop();
  if (maxChars !== undefined && out.length > maxChars) {
    out.length = maxChars - 1;
    while (out.length > 0 && out[out.length - 1] === SPACE) out.pop();
    out.push(ELLIPSIS);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Buffer de bytes
// ---------------------------------------------------------------------------------------------

class ByteWriter {
  private buf = new Uint8Array(4096);
  length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buf.length) return;
    let capacity = this.buf.length * 2;
    while (capacity < this.length + extra) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(value: number): void {
    this.ensure(1);
    this.buf[this.length++] = value;
  }

  bytes(values: ArrayLike<number>): void {
    this.ensure(values.length);
    this.buf.set(values, this.length);
    this.length += values.length;
  }

  // Solo ASCII (estructura del PDF); nunca texto del usuario.
  ascii(text: string): void {
    this.ensure(text.length);
    for (let i = 0; i < text.length; i++) this.buf[this.length++] = text.charCodeAt(i);
  }

  view(): Uint8Array {
    return this.buf.subarray(0, this.length);
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

// ---------------------------------------------------------------------------------------------
// Contenido de página
// ---------------------------------------------------------------------------------------------

// Anchos Helvetica (1/1000 em) de los caracteres de un monto.
function amountWidth(text: string): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    units += ch === '-' ? 333 : ch === '.' ? 278 : 556;
  }
  return (units * FONT_SIZE) / 1000;
}

function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

class PageWriter {
  readonly out = new ByteWriter();

  // Escribe texto ya codificado en WinAnsi, escapando \ ( ).
  text(font: 1 | 2, x: number, y: number, size: number, encoded: readonly number[]): void {
    const o = this.out;
    o.ascii(`BT /F${font} ${size} Tf ${num(x)} ${num(y)} Td (`);
    for (const byte of encoded) {
      if (byte === 0x5c || byte === 0x28 || byte === 0x29) o.byte(0x5c);
      o.byte(byte);
    }
    o.ascii(') Tj ET\n');
  }

  line(font: 1 | 2, x: number, y: number, text: string, maxChars?: number, size = FONT_SIZE): void {
    this.text(font, x, y, size, toWinAnsi(text, maxChars));
  }

  amount(y: number, text: string, font: 1 | 2 = 1): void {
    this.line(font, X_MONTO_RIGHT - amountWidth(text), y, text);
  }
}

const TIPO_LABEL = { ingreso: 'Ingreso', gasto: 'Gasto' } as const;

function signedAmount(cents: number, negative: boolean): string {
  const text = formatCents(Math.abs(cents));
  return negative && cents !== 0 ? `-${text}` : text;
}

interface Totals {
  income: number;
  expense: number;
  balance: number;
}

function computeTotals(rows: readonly PdfRow[]): Totals {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.monto) || row.monto < 0) {
      throw new Error('buildExportPdf: monto no es un entero seguro no negativo');
    }
    if (row.tipo === 'ingreso') income += row.monto;
    else expense += row.monto;
    if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expense)) {
      throw new Error('buildExportPdf: total fuera del rango de enteros seguros');
    }
  }
  const balance = income - expense;
  if (!Number.isSafeInteger(balance)) {
    throw new Error('buildExportPdf: balance fuera del rango de enteros seguros');
  }
  return { income, expense, balance };
}

function pageCount(rowCount: number): number {
  const full = Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE));
  const onLast = rowCount - (full - 1) * ROWS_PER_PAGE;
  return totalsFit(onLast) ? full : full + 1;
}

// Los totales caben bajo la última fila si su último renglón queda sobre el margen inferior.
function totalsFit(rowsOnPage: number): boolean {
  const lastRowY = FIRST_ROW_Y - Math.max(0, rowsOnPage - 1) * LEADING;
  return lastRowY - LEADING * 1.5 - (TOTALS_LINES - 1) * LEADING >= MARGIN;
}

function drawHeader(
  page: PageWriter,
  data: ExportPdfData,
  pageNumber: number,
  pages: number,
): void {
  let y = PAGE_HEIGHT - MARGIN;
  page.line(2, MARGIN, y, 'Movimientos', undefined, 14);
  page.line(1, X_PAGE_LABEL, y, `Página ${pageNumber} de ${pages}`);
  y -= 18;
  page.line(1, MARGIN, y, `Cuenta: ${data.accountName}`, 90);
  y -= LEADING;
  page.line(1, MARGIN, y, `Período: ${data.desde} a ${data.hasta}`);
  const filters: string[] = [];
  if (data.tipo) filters.push(`Tipo: ${TIPO_LABEL[data.tipo]}`);
  if (data.categoryName !== undefined) filters.push(`Categoría: ${data.categoryName}`);
  if (filters.length > 0) {
    y -= LEADING;
    page.line(1, MARGIN, y, `Filtros: ${filters.join(' | ')}`, 100);
  }
  const tableY = FIRST_ROW_Y + LEADING;
  page.line(2, X_FECHA, tableY, 'Fecha');
  page.line(2, X_TIPO, tableY, 'Tipo');
  page.line(2, X_CATEGORIA, tableY, 'Categoría');
  page.line(2, X_NOTA, tableY, 'Nota');
  page.amount(tableY, 'Monto', 2);
}

function drawRow(page: PageWriter, row: PdfRow, y: number): void {
  page.line(1, X_FECHA, y, row.fecha);
  page.line(1, X_TIPO, y, TIPO_LABEL[row.tipo]);
  page.line(1, X_CATEGORIA, y, row.categoria, CATEGORY_MAX_CHARS);
  page.line(1, X_NOTA, y, row.nota ?? '', NOTE_MAX_CHARS);
  page.amount(y, signedAmount(row.monto, row.tipo === 'gasto'));
}

function drawTotals(page: PageWriter, totals: Totals, y: number): void {
  const entries: [string, string][] = [
    ['Total ingresos', signedAmount(totals.income, false)],
    ['Total gastos', signedAmount(totals.expense, true)],
    ['Balance', signedAmount(totals.balance, totals.balance < 0)],
  ];
  entries.forEach(([label, amount], index) => {
    const lineY = y - index * LEADING;
    page.line(2, X_NOTA, lineY, label);
    page.amount(lineY, amount, 2);
  });
}

// ---------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function buildExportPdf(data: ExportPdfData): Uint8Array {
  const totals = computeTotals(data.rows);
  const pages = pageCount(data.rows.length);
  const pageContents: Uint8Array[] = [];

  for (let p = 0; p < pages; p++) {
    const page = new PageWriter();
    drawHeader(page, data, p + 1, pages);
    const start = p * ROWS_PER_PAGE;
    const end = Math.min(start + ROWS_PER_PAGE, data.rows.length);
    let y = FIRST_ROW_Y;
    if (data.rows.length === 0) {
      page.line(1, MARGIN, y, 'Sin movimientos');
      y -= LEADING;
    }
    for (let i = start; i < end; i++, y -= LEADING) drawRow(page, data.rows[i] as PdfRow, y);
    if (p === pages - 1) drawTotals(page, totals, y - LEADING / 2);
    pageContents.push(page.out.result());
  }

  const out = new ByteWriter();
  const offsets: number[] = [];
  const beginObject = (id: number) => {
    offsets[id] = out.length;
    out.ascii(`${id} 0 obj\n`);
  };
  const endObject = () => out.ascii('endobj\n');

  out.ascii('%PDF-1.4\n%');
  out.bytes([0xe2, 0xe3, 0xcf, 0xd3]);
  out.ascii('\n');

  beginObject(1);
  out.ascii('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  beginObject(2);
  const kids = pageContents.map((_, i) => `${5 + 2 * i} 0 R`).join(' ');
  out.ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>\n`);
  endObject();

  beginObject(3);
  out.ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
  endObject();

  beginObject(4);
  out.ascii(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n',
  );
  endObject();

  pageContents.forEach((content, i) => {
    const pageId = 5 + 2 * i;
    const contentId = pageId + 1;
    beginObject(pageId);
    out.ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\n`,
    );
    endObject();
    beginObject(contentId);
    out.ascii(`<< /Length ${content.length} >>\nstream\n`);
    out.bytes(content);
    out.ascii('\nendstream\n');
    endObject();
  });

  const size = 5 + 2 * pages;
  const xrefOffset = out.length;
  out.ascii(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id++) out.ascii(`${pad(offsets[id] as number, 10)} 00000 n \n`);
  out.ascii(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return out.result();
}
