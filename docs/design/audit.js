/* global process, console, document, getComputedStyle, CATS, render */
// Auditoría automática del prototipo en 360 y 412 px: elementos interactivos, zonas táctiles (docs/007 §10),
// desbordamiento horizontal y textos sin nombre accesible. Sin conclusiones visuales: solo mediciones.
// Uso:  source /home/node/herramientas-qa/env.sh
//       node docs/design/audit.js [--out <dir>] [--widths 360,412]
// Salida: <dir>/audit.json y <dir>/audit.md (por defecto QA_HOME/salidas). Código 1 si hay incumplimientos.
// Criterio táctil: data-hit="48" -> alto y ancho >= 48 px; data-hit="extended" -> ::after >= 48 px de alto.
// Los incumplimientos se reportan tal cual; las excepciones aceptadas viven en EXCEPCIONES (con motivo).
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, QA_HOME, loadPlaywright, openPage, goTo } from './render.js';

const MIN = 48;
const TOL = 0.5;
// Elementos que no son objetivo táctil independiente (celdas cubiertas por el control padre, etc.).
// Excepción aprobada P-3 (docs/007 §10, paso 346): celdas de día del calendario con 7 columnas en pantallas pequeñas.
// Condiciones: act cday, alto >= 48, ancho >= 44, ancho de pantalla < 400 y sin solape con la celda vecina.
const EXCEPCIONES = [
  { id: 'P-3', act: 'cday', slug: 'calendario', maxAncho: 400, minW: 44, minH: 48, motivo: 'Calendario de 7 columnas a <400 dp: ancho geométrico 44.3 dp, alto 52' },
];
// Estados secundarios que se miden además de cada pantalla (docs/010 §6): panel de filtros y rango de Reportes.
const ESTADOS = [
  { slug: 'movimientos-filtros', route: 'account:movimientos', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'movimientos' }, { act: 'filt' }] },
  { slug: 'nuevo-movimiento-nombres-largos', route: 'newTx', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'newtx' }],
    // Nombres de categoría de hasta 40 caracteres (límite de la API), inyectados solo en la medición.
    inyectar: () => { CATS[2].nombre = 'Entretenimiento y ocio familiar'; CATS[4].nombre = 'Educación y capacitación continua'; CATS[6].nombre = 'Transporte público urbano y taxis'; render(); } },
  { slug: 'reportes-rango', route: 'account:reportes', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'reportes' }, { act: 'rm', v: 'rango' }] },
];

// Se ejecuta en el navegador.
function medir({ MIN, TOL }) {
  const phone = document.getElementById('phone').getBoundingClientRect();
  const screen = document.getElementById('screen');
  const items = [];
  document.querySelectorAll('#phone [data-hit]').forEach((el) => {
    // Un campo de texto se activa tocando su fila (etiqueta/campo): se mide el contenedor, no el <input>.
    const box = el.tagName === 'INPUT' ? el.closest('label, .field, .inp, .fld') || el.parentElement : el;
    const r = box.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const mode = el.getAttribute('data-hit');
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    let h = r.height, w = r.width;
    if (mode === 'extended') {
      const a = getComputedStyle(el, '::after');
      h = parseFloat(a.height) || h;
      w = Math.max(w, parseFloat(a.width) || 0);
    }
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('data-act') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    items.push({
      tag: el.tagName.toLowerCase(), act: el.getAttribute('data-act'), name, mode,
      grupo: el.getAttribute('data-hit-group'), w: +w.toFixed(1), h: +h.toFixed(1),
      ok: h >= MIN - TOL && w >= MIN - TOL,
      sinNombre: !((el.labels && el.labels.length && el.labels[0].textContent.trim()) || el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('title') || el.getAttribute('placeholder')),
    });
  });
  // Desbordamiento horizontal: contenido del teléfono más ancho que el teléfono, o elementos fuera de su borde.
  const inner = document.querySelector('#screen .screen-in');
  const scrollers = [inner, ...inner.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible');
  const fuera = [];
  inner.querySelectorAll('*').forEach((e) => {
    const r = e.getBoundingClientRect();
    // Solo se descartan los elementos decorativos (aria-hidden y fondos): un contenido recortado por un ancestro
    // con overflow también es defecto (queda cortado a la vista del usuario).
    if (r.width && r.right > phone.right - 8 + 1) {
      const recortado = !!e.closest('[aria-hidden="true"], .blob, .deco, .band, .circ');
      if (!recortado) fuera.push({ el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), texto: (e.textContent || '').trim().slice(0, 30), right: +(r.right - phone.right).toFixed(1), left: +(r.left - phone.left).toFixed(1) });
    }
  });
  // Texto truncado (elipsis/recorte) y etiquetas de pestaña que se solapan: el nombre visible debe leerse completo.
  const truncados = [];
  inner.querySelectorAll('*').forEach((e) => {
    if (e.closest('[aria-hidden="true"]') || e.children.length) return;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== 'visible' && (e.textContent || '').trim()) {
      // Truncado permitido solo si el texto completo es consultable: title/aria-label propio o de un ancestro cercano.
      const full = (e.textContent || '').trim();
      const holder = e.closest('[title], [aria-label]');
      const acc = !!holder && ((holder.getAttribute('title') || '') + ' ' + (holder.getAttribute('aria-label') || '')).includes(full);
      truncados.push({ texto: full.slice(0, 30), accesible: acc });
    }
  });
  // Recorte vertical (line-clamp u overflow oculto con contenido que no cabe) y palabras partidas a mitad de palabra.
  inner.querySelectorAll('*').forEach((e) => {
    if (e.closest('[aria-hidden="true"]') || e.children.length) return;
    const txt = (e.textContent || '').trim();
    if (!txt) return;
    const cs = getComputedStyle(e);
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    if ((clamp || cs.overflowY !== 'visible') && e.scrollHeight > e.clientHeight + 1) {
      const holder = e.closest('[title], [aria-label]');
      const acc = !!holder && ((holder.getAttribute('title') || '') + ' ' + (holder.getAttribute('aria-label') || '')).includes(txt);
      // Un recorte vertical (line-clamp) nunca se acepta: los nombres deben verse completos (docs/007 §10); la accesibilidad no lo compensa.
      truncados.push({ texto: `recorte vertical: «${txt.slice(0, 30)}»`, accesible: false, vertical: true, accesibleFull: acc });
    }
    const node = e.firstChild;
    // Con elipsis o line-clamp el truncado ya se evalúa arriba (accesibilidad del texto completo); aquí solo palabras que se parten al envolver.
    if (node && node.nodeType === 3 && !clamp && cs.textOverflow !== 'ellipsis') {
      let pos = 0;
      for (const w of node.textContent.split(/(\s+)/)) {
        if (w.trim().length > 3) {
          const rg = document.createRange();
          rg.setStart(node, pos); rg.setEnd(node, pos + w.length);
          if (rg.getClientRects().length > 1) truncados.push({ texto: `palabra partida: «${w}»`, accesible: false });
        }
        pos += w.length;
      }
    }
  });
  const rects = [...inner.querySelectorAll('.tabs button')].map((b) => {
    const rg = document.createRange();
    rg.selectNodeContents(b.lastChild);
    return { t: b.textContent.trim(), r: rg.getBoundingClientRect() };
  });
  for (let i = 1; i < rects.length; i++) {
    if (rects[i].r.left < rects[i - 1].r.right - 0.5) truncados.push({ texto: `pestañas solapadas: «${rects[i - 1].t}» y «${rects[i].t}»`, accesible: false });
  }
  return {
    interactivos: items,
    truncados,
    desbordeHorizontal: inner.scrollWidth > inner.clientWidth + 1,
    scrollWidth: inner.scrollWidth, clientWidth: inner.clientWidth,
    fueraDelBorde: fuera.slice(0, 10),
    _scrollers: scrollers.length,
    botonesSinNombre: items.filter((i) => i.sinNombre).length,
    hayScreen: !!screen,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
  const out = path.resolve(opt('--out', path.join(QA_HOME, 'salidas')));
  const widths = opt('--widths', '360,412').split(',').map(Number);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const resultados = [];
  for (const w of widths) {
    for (const sc of [...SCREENS, ...ESTADOS]) {
      const page = await openPage(browser, w);
      let r;
      try {
        await goTo(page, sc);
        if (sc.inyectar) await page.evaluate(sc.inyectar);
        r = await page.evaluate(medir, { MIN, TOL });
      } catch (e) {
        r = { error: e.message };
      }
      await page.close();
      resultados.push({ slug: sc.slug, ancho: w, ...r });
    }
  }
  await browser.close();

  let incumple = 0;
  const resumen = { excepcionesAprobadas: 0, truncadosPermitidos: 0 };
  const detalleOk = [];
  const lineas = ['# Auditoría del prototipo (automática)', '', `Generado: ${new Date().toISOString()}. Umbral táctil: ${MIN} px (zona efectiva). Solo mediciones en Chromium; no sustituye a Android real.`, '', '| Pantalla | Ancho | Interactivos | Táctiles <48 | Desborde horizontal | Fuera de borde | Sin nombre | Truncados |', '|---|---|---|---|---|---|---|---|'];
  const detalle = [];
  for (const r of resultados) {
    if (r.error) { incumple++; lineas.push(`| ${r.slug} | ${r.ancho} | ERROR: ${r.error} ||||||`); continue; }
    const cubierto = (i) => EXCEPCIONES.some((e) => e.act === i.act && e.slug === r.slug && r.ancho < e.maxAncho && i.w >= e.minW && i.h >= e.minH);
    const fallan = r.interactivos.filter((i) => !i.ok);
    const malos = fallan.filter((i) => !cubierto(i));
    const aprobados = fallan.length - malos.length;
    const truncBloq = r.truncados.filter((t) => !t.accesible);
    const truncOk = r.truncados.length - truncBloq.length;
    resumen.excepcionesAprobadas += aprobados;
    resumen.truncadosPermitidos += truncOk;
    if (truncOk) detalleOk.push(`- ${r.slug} @${r.ancho}: ${truncOk} texto(s) truncado(s) con nombre completo accesible: ${r.truncados.filter((t) => t.accesible).map((t) => '«' + t.texto + '»').join(', ')}`);
    if (aprobados) detalleOk.push(`- ${r.slug} @${r.ancho}: ${aprobados} celdas con excepción aprobada P-3 (44.3×52 dp)`);
    incumple += malos.length + (r.desbordeHorizontal ? 1 : 0) + r.fueraDelBorde.length + r.botonesSinNombre + truncBloq.length;
    lineas.push(`| ${r.slug} | ${r.ancho} | ${r.interactivos.length} | ${malos.length} | ${r.desbordeHorizontal ? `SÍ (${r.scrollWidth}>${r.clientWidth})` : 'no'} | ${r.fueraDelBorde.length} | ${r.botonesSinNombre} | ${truncBloq.length} |`);
    malos.forEach((m) => detalle.push(`- ${r.slug} @${r.ancho}: <${m.tag}> «${m.name}» (${m.act || '-'}) mide ${m.w}×${m.h}${m.grupo ? ` [${m.grupo}]` : ''}, modo ${m.mode}`));
    truncBloq.forEach((t) => detalle.push(`- ${r.slug} @${r.ancho}: texto truncado sin nombre accesible, o solapado: «${t.texto}»`));
    r.interactivos.filter((i) => i.sinNombre).forEach((i) => detalle.push(`- ${r.slug} @${r.ancho}: <${i.tag}> (${i.act || '-'}) sin nombre accesible`));
    r.fueraDelBorde.forEach((f) => detalle.push(`- ${r.slug} @${r.ancho}: fuera del borde <${f.el}> «${f.texto}» (derecha ${f.right}, izquierda ${f.left})`));
  }
  if (detalle.length) lineas.push('', '## Incumplimientos', '', ...detalle);
  if (detalleOk.length) lineas.push('', '## Aceptados (no cuentan como incumplimiento)', '', ...detalleOk);
  lineas.push('', `Excepciones aprobadas: ${resumen.excepcionesAprobadas}. Truncados permitidos y accesibles: ${resumen.truncadosPermitidos}.`);
  lineas.push('', `Total de incumplimientos: ${incumple}.`);
  fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify({ umbral: MIN, widths, resultados }, null, 2));
  fs.writeFileSync(path.join(out, 'audit.md'), lineas.join('\n') + '\n');
  console.log(lineas.join('\n'));
  process.exit(incumple ? 1 : 0);
}
main();
