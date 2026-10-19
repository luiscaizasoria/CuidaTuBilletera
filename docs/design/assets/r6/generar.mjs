/* global process, console */
// Regenera los PNG nativos de R6 desde src/*.svg (vectorial -> 1024 nativos).
// Uso (desde la raiz del repo): node docs/design/assets/r6/generar.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const dir = dirname(fileURLToPath(import.meta.url));
const svg = (n) => readFileSync(join(dir, 'src', n));
const S = 1024;

const render = (file, size) => sharp(svg(file), { density: (72 * size) / S }).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// Circulo minimo envolvente aproximado (Badoiu-Clarkson) de los pixeles con alfa > 10 %.
function circuloEnvolvente(data, w) {
  const pts = [];
  for (let y = 0; y < w; y += 1) for (let x = 0; x < w; x += 1) if (data[(y * w + x) * 4 + 3] > 26) pts.push([x + 0.5, y + 0.5]);
  let cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  let cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  for (let i = 1; i <= 3000; i += 1) {
    let best = pts[0], d = -1;
    for (const p of pts) { const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (dd > d) { d = dd; best = p; } }
    cx += (best[0] - cx) / (i + 1); cy += (best[1] - cy) / (i + 1);
  }
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
  return { cx, cy, r };
}

// Devuelve el motivo escalado para caber en un circulo de `diametro` px centrado en el lienzo.
async function motivoEnCirculo(file, diametro) {
  const base = await render(file, S);
  const { cx, cy, r } = circuloEnvolvente(base.data, S);
  const k = diametro / 2 / (r + 1.5); // 1,5 px de holgura por el suavizado
  const n = Math.round(S * k);
  const kk = n / S; if (process.env.DEBUG) console.log(file, "escala", kk.toFixed(3));
  let png = await sharp(svg(file), { density: (72 * n) / S }).resize(n, n).png().toBuffer();
  let left = Math.round(S / 2 - cx * kk), top = Math.round(S / 2 - cy * kk);
  // si el lienzo escalado excede 1024, se recorta a la zona visible (el arte queda dentro)
  const x0 = Math.max(0, -left), y0 = Math.max(0, -top);
  const w = Math.min(n - x0, S - Math.max(0, left)), h = Math.min(n - y0, S - Math.max(0, top));
  png = await sharp(png).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  left = Math.max(0, left); top = Math.max(0, top);
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: png, left, top }]).png().toBuffer();
}

const out = (n) => join(dir, n);
const fondo = await sharp(svg('fondo.svg'), { density: 72 }).resize(S, S).png().toBuffer();

// 1. icon.png: RGB sin alfa; motivo al ~92 % de su tamano natural sobre el degradado.
{
  const m = await motivoEnCirculo('motivo.svg', 860);
  await sharp(fondo).composite([{ input: m }]).removeAlpha().png({ compressionLevel: 9 }).toFile(out('icon.png'));
}
// 2. foreground adaptable: circulo seguro 628 px.
await sharp(await motivoEnCirculo('motivo.svg', 624)).png({ compressionLevel: 9 }).toFile(out('adaptive-icon-foreground.png'));
// 3. monocromatico: mismo recuadro seguro; se fuerza blanco puro (alfa = cobertura).
{
  const { data, info } = await sharp(await motivoEnCirculo('motivo-mono.svg', 624)).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(out('adaptive-icon-monochrome.png'));
}
// 4. splash: circulo de 640 px.
await sharp(await motivoEnCirculo('motivo.svg', 636)).png({ compressionLevel: 9 }).toFile(out('splash-icon.png'));
console.log('R6: PNG generados en', dir);
