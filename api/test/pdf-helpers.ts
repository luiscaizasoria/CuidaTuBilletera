// Inspección estructural mínima de un PDF 1.4 generado por buildExportPdf, solo para pruebas.

export interface PdfInspection {
  raw: string; // bytes como caracteres latin1 (un char = un byte)
  startxref: number;
  xrefOffset: number;
  size: number;
  xrefEntries: { offset: number; gen: number; kind: string; line: string }[];
  objects: Map<number, { offset: number; body: string }>;
  count: number;
  pageIds: number[];
  streams: { id: number; declared: number; actual: number; content: string }[];
  pages: string[][]; // textos (latin1, ya sin escapes) de cada página, en orden
}

export function latin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i] as number);
  return out;
}

export function inspectPdf(bytes: Uint8Array): PdfInspection {
  const raw = latin1(bytes);
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(raw)?.[1]);
  const xrefOffset = raw.lastIndexOf('\nxref\n') + 1;
  const xrefBlock = raw.slice(xrefOffset, raw.indexOf('trailer'));
  const [, header, ...entryLines] = xrefBlock.split('\n');
  const size = Number(/^0 (\d+)$/.exec(header as string)?.[1]);
  const body = entryLines.slice(0, size);
  const xrefEntries = body.map((line) => ({
    offset: Number(line.slice(0, 10)),
    gen: Number(line.slice(11, 16)),
    kind: line.slice(17, 18),
    line: line + '\n',
  }));

  const objects = new Map<number, { offset: number; body: string }>();
  for (let id = 1; id < size; id++) {
    const offset = (xrefEntries[id] as { offset: number }).offset;
    const end = raw.indexOf('endobj\n', offset);
    objects.set(id, { offset, body: raw.slice(offset, end + 7) });
  }

  const count = Number(/\/Count (\d+)/.exec((objects.get(2) as { body: string }).body)?.[1]);
  const kids = /\/Kids \[([^\]]*)\]/.exec((objects.get(2) as { body: string }).body)?.[1] ?? '';
  const pageIds = [...kids.matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));

  const streams: PdfInspection['streams'] = [];
  for (const [id, obj] of objects) {
    const m = /<< \/Length (\d+) >>\nstream\n/.exec(obj.body);
    if (!m) continue;
    const start = obj.body.indexOf('stream\n') + 7;
    const end = obj.body.lastIndexOf('\nendstream\n');
    streams.push({
      id,
      declared: Number(m[1]),
      actual: end - start,
      content: obj.body.slice(start, end),
    });
  }

  const pages = pageIds.map((pageId) => {
    const page = (objects.get(pageId) as { body: string }).body;
    const contentId = Number(/\/Contents (\d+) 0 R/.exec(page)?.[1]);
    const stream = streams.find((s) => s.id === contentId) as { content: string };
    return [...stream.content.matchAll(/\(((?:\\[\\()]|[^\\()])*)\) Tj/g)].map((m) =>
      (m[1] as string).replace(/\\([\\()])/g, '$1'),
    );
  });

  return { raw, startxref, xrefOffset, size, xrefEntries, objects, count, pageIds, streams, pages };
}
