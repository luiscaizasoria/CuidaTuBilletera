/* global process, console */
// Verificación reproducible del prototipo: navegación entre pantallas, contraste (contrast.js --check), captura
// (render.js) y auditoría (audit.js). Genera un informe único con el resultado de cada comprobación.
// Uso:  source /home/node/herramientas-qa/env.sh
//       node docs/design/verify.js [--out <dir>]      (por defecto QA_HOME/salidas)
// Código de salida: 0 todo cumple; 1 hay incumplimientos. NO prueba Android real (docs/010 niveles R y D).
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { QA_HOME, loadPlaywright, openPage, sel } from './render.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(QA_HOME, 'salidas'));
fs.mkdirSync(out, { recursive: true });

// Navegación aprobada (docs/007 §3): [pasos de clic, ruta esperada tras cada paso].
const NAV = [
  ['Bienvenida -> Mis cuentas', [{ act: 'login' }], 'accounts'],
  ['Mis cuentas -> Detalle (Efectivo)', [{ act: 'open', id: 'a1' }], 'account:cuenta'],
  ['Pestaña Movimientos', [{ act: 'tab', t: 'movimientos' }], 'account:movimientos'],
  ['Pestaña Calendario', [{ act: 'tab', t: 'calendario' }], 'account:calendario'],
  ['Pestaña Reportes', [{ act: 'tab', t: 'reportes' }], 'account:reportes'],
  ['Pestaña Más', [{ act: 'tab', t: 'mas' }], 'account:mas'],
  ['Más -> Categorías', [{ act: 'cats' }], 'cats'],
  ['Categorías -> Más (Atrás)', [{ act: 'backMore' }], 'account:mas'],
  ['Pestaña Cuenta', [{ act: 'tab', t: 'cuenta' }], 'account:cuenta'],
  ['Nuevo movimiento', [{ act: 'newtx' }], 'newTx'],
  ['Cancelar -> vuelve a la pestaña de origen', [{ act: 'cancelTx' }], 'account:cuenta'],
  ['‹ Mis cuentas', [{ act: 'toAccounts' }], 'accounts'],
  ['Crear cuenta', [{ act: 'newacc' }], 'newAcc'],
];

async function navegacion(browser, width) {
  const page = await openPage(browser, width);
  const res = [];
  for (const [nombre, pasos, esperada] of NAV) {
    let ruta = null, error = null;
    try {
      for (const p of pasos) await page.click(sel(p), { timeout: 3000 });
      ruta = await page.getAttribute('#screen .screen-in', 'data-route');
    } catch (e) { error = e.message.split('\n')[0]; }
    res.push({ nombre, ancho: width, esperada, ruta, ok: !error && ruta === esperada, error });
  }
  await page.close();
  return res;
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: process.env });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const nav = [...(await navegacion(browser, 360)), ...(await navegacion(browser, 412))];
await browser.close();

const contraste = run('node', [path.join(here, 'contrast.js'), '--check']);
const captura = run('node', [path.join(here, 'render.js'), '--out', path.join(out, 'capturas')]);
const auditoria = run('node', [path.join(here, 'audit.js'), '--out', out]);
const totalAudit = (auditoria.out.match(/Total de incumplimientos: (\d+)/) || [])[1];

const L = ['# Informe de verificación del prototipo', '', `Generado: ${new Date().toISOString()}. Chromium vía Playwright (${QA_HOME}). No incluye Android real.`, '', '| Comprobación | Resultado |', '|---|---|'];
const navFail = nav.filter((n) => !n.ok);
L.push(`| Navegación (${nav.length} pasos, 360 y 412) | ${navFail.length ? 'FALLA ' + navFail.length : 'cumple'} |`);
L.push(`| Contraste (contrast.js --check) | ${contraste.code === 0 ? 'cumple' : 'FALLA'} |`);
L.push(`| Capturas (render.js) | ${captura.code === 0 ? 'ok: ' + (captura.out.match(/Capturas: (.*) ->/) || [])[1] : 'FALLA'} |`);
L.push(`| Auditoría (audit.js): táctil, desborde, fuera de borde | ${auditoria.code === 0 ? 'cumple' : 'FALLA: ' + totalAudit + ' incumplimientos (ver audit.md)'} |`);
if (navFail.length) L.push('', '## Navegación fallida', ...navFail.map((n) => `- ${n.nombre} @${n.ancho}: esperaba ${n.esperada}, obtuvo ${n.ruta}${n.error ? ' (' + n.error + ')' : ''}`));
fs.writeFileSync(path.join(out, 'verify.md'), L.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'verify.json'), JSON.stringify({ nav, contraste: contraste.code, captura: captura.code, auditoria: auditoria.code, totalAudit }, null, 2));
console.log(L.join('\n'));
process.exit(navFail.length || contraste.code || captura.code || auditoria.code ? 1 : 0);
