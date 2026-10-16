/* global process, console, document */
// Renderiza el prototipo HTML (docs/design/prototipo/index.html) con Playwright/Chromium y captura pantallas.
// Uso:  source /home/node/herramientas-qa/env.sh
//       node docs/design/render.js [--out <dir>] [--widths 360,412] [--only <slug,slug>]
// Salida: <dir>/<pantalla>-<ancho>.png (nomenclatura de docs/010 §6) y <dir>/render.json.
// Por defecto escribe fuera del repo (QA_HOME/salidas/capturas): no sobrescribe docs/design/capturas/ (aprobadas).
// Sin dependencias del proyecto: Playwright vive en QA_HOME (ver docs/010 §8), nunca en app/ ni api/.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROTO = path.join(__dirname, 'prototipo', 'index.html');
export const QA_HOME = process.env.QA_HOME || '/home/node/herramientas-qa';
const DEFAULT_WIDTHS = [360, 412];
export const HEIGHT = 800;

// Recorrido: cada paso hace clic con `data-act` (y opcionalmente data-id / data-v / data-t) y deja una pantalla.
// Es la navegación aprobada de docs/007 §3 (Mis cuentas -> cuenta -> pestañas -> Nuevo movimiento / Categorías).
export const SCREENS = [
  { slug: 'bienvenida', route: 'login', steps: [] },
  { slug: 'mis-cuentas', route: 'accounts', steps: [{ act: 'login' }] },
  { slug: 'crear-cuenta', route: 'newAcc', steps: [{ act: 'login' }, { act: 'newacc' }] },
  { slug: 'detalle', route: 'account:cuenta', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }] },
  { slug: 'movimientos', route: 'account:movimientos', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'movimientos' }] },
  { slug: 'calendario', route: 'account:calendario', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'calendario' }] },
  { slug: 'reportes', route: 'account:reportes', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'reportes' }] },
  { slug: 'mas', route: 'account:mas', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'mas' }] },
  { slug: 'categorias', route: 'cats', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'tab', t: 'mas' }, { act: 'cats' }] },
  { slug: 'nuevo-movimiento', route: 'newTx', steps: [{ act: 'login' }, { act: 'open', id: 'a1' }, { act: 'newtx' }] },
];

export function loadPlaywright() {
  try {
    return createRequire(path.join(QA_HOME, 'x.js'))('playwright');
  } catch {
    console.error(`No se encontró Playwright. Ejecuta: source ${QA_HOME}/env.sh (ver docs/010 §8).`);
    process.exit(2);
  }
}

export const sel = (s) => {
  let q = `#phone [data-act="${s.act}"]`;
  if (s.id) q += `[data-id="${s.id}"]`;
  if (s.t) q += `[data-t="${s.t}"]`;
  if (s.v) q += `[data-v="${s.v}"]`;
  return q;
};

export async function openPage(browser, width) {
  const page = await browser.newPage({ viewport: { width: width + 80, height: HEIGHT + 80 }, deviceScaleFactor: 1 });
  await page.goto('file://' + PROTO);
  // El teléfono del prototipo usa --w para el ancho lógico del dispositivo (dp equivalentes a px CSS).
  await page.evaluate(([w, h]) => {
    const p = document.getElementById('phone');
    p.style.setProperty('--w', w + 'px');
    p.style.setProperty('--h', h + 'px');
  }, [width, HEIGHT]);
  return page;
}

export async function goTo(page, screen) {
  for (const s of screen.steps) {
    await page.click(sel(s));
  }
  const route = await page.getAttribute('#screen .screen-in', 'data-route');
  if (route !== screen.route) throw new Error(`Ruta inesperada para ${screen.slug}: ${route} (esperada ${screen.route})`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
  const out = path.resolve(opt('--out', path.join(QA_HOME, 'salidas', 'capturas')));
  const widths = opt('--widths', DEFAULT_WIDTHS.join(',')).split(',').map(Number);
  const only = opt('--only', '') ? opt('--only', '').split(',') : null;
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const report = { generado: new Date().toISOString(), prototipo: PROTO, widths, capturas: [] };
  let fallos = 0;
  for (const w of widths) {
    for (const sc of SCREENS.filter((s) => !only || only.includes(s.slug))) {
      const page = await openPage(browser, w);
      const file = path.join(out, `${sc.slug}-${w}.png`);
      try {
        await goTo(page, sc);
        await page.locator('#phone').screenshot({ path: file });
        report.capturas.push({ slug: sc.slug, ancho: w, archivo: file, ok: true });
      } catch (e) {
        fallos++;
        report.capturas.push({ slug: sc.slug, ancho: w, ok: false, error: e.message });
      }
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'render.json'), JSON.stringify(report, null, 2));
  console.log(`Capturas: ${report.capturas.filter((c) => c.ok).length} ok, ${fallos} con error -> ${out}`);
  process.exit(fallos ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
