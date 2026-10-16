/* global process, console */
// Verificación de contraste WCAG 2.x y de distinguibilidad de la paleta de docs/008 (§2 y §3).
// Uso: node docs/design/contrast.js            -> tablas Markdown
//      node docs/design/contrast.js --check    -> además sale con código 1 si algún par no cumple
// Sin dependencias. Las capas semitransparentes (tarjeta de saldo, manchas decorativas del fondo,
// píldora de saldo) se calculan con mezcla alfa sobre el color sólido, igual que una View con opacity.
// Iteración 3: paleta «alegre» (fondos casi blancos, color por módulo, paleta de cuentas).
'use strict';

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const L = (h) => { const c = hex2rgb(h).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Capa `top` con opacidad `alpha` sobre `base`.
const over = (top, alpha, base) => { const t = hex2rgb(top), b = hex2rgb(base); return rgb2hex(t.map((v, i) => v * alpha + b[i] * (1 - alpha))); };
// Oscurece un color (mezcla con negro) en pasos de 1 % hasta que el blanco alcance `min` sobre él.
const darkenForWhite = (h, min) => { let k = 0, c = h; while (ratio('#FFFFFF', c) < min && k < 100) { k++; c = over('#000000', k / 100, h); } return { color: c, k }; };

// ---------- tokens (deben coincidir con docs/008 §11 y con :root del prototipo) ----------
const T = {
  // marca (verde azulado del ícono; solo acción primaria, FAB, tarjeta de saldo, foco)
  brand800: '#0B4A46', brand700: '#0F5F5A', brand500: '#1F8A80', brand100: '#D3EBF0', brandInk: '#0B4A46', onBrandSoft: '#E6F7F4',
  // superficies y texto
  bg: '#FFFBF5', surface: '#FFFFFF', segBg: '#F3EEE6', text: '#17211F', text2: '#4B5653', text3: '#5F6B68', border: '#EEE7DC', borderStrong: '#7E8A86',
  // semánticos
  income: '#12804A', incomeText: '#0E6A3D', incomeSoft: '#D9F4E4',
  expense: '#D13A2F', expenseText: '#B42A20', expenseSoft: '#FFE1D9',
  // acento
  yellow: '#FFC93C', yellowSoft: '#FFF1C2', yellowText: '#6B4E00',
  // color por módulo (docs/007 §3.6)
  cuentaTile: '#D3EBF0', cuentaInk: '#0B4A46',
  movTile: '#FFEDA6', movInk: '#5C4000', movStrong: '#F5A524',
  calTile: '#DCEBFF', calInk: '#174C86', calStrong: '#2563C9',
  repTile: '#ECE4FF', repInk: '#4E2DA3',
  masTile: '#E3E8EF', masInk: '#334155',
};
// Paleta de cuentas (docs/007 §5.2.4): fondo de tarjeta (card) y mosaico del ícono (tile). Excluye verde de ingreso,
// coral de gasto y marca. Orden = índice de hash(id) mod 6.
const ACC = [
  ['aguamarina', '#E3F6F8', '#BDE9EF'],
  ['lavanda', '#F0EBFF', '#D9CCFF'],
  ['albaricoque', '#FFF0E0', '#FFD6A8'],
  ['celeste', '#E7F1FF', '#C5DBFF'],
  ['rosa', '#FDEAF2', '#F8CADD'],
  ['limón', '#FFF6D6', '#FFE58A'],
];
// Tarjeta de saldo: base brand700 + banda diagonal brand500 al 35 % + círculo blanco al 8 % (peor caso: ambos apilados).
const heroBand = over(T.brand500, 0.35, T.brand700);
const heroWorst = over('#FFFFFF', 0.08, heroBand);
const heroCircle = over('#FFFFFF', 0.08, T.brand700);
// Saldo de la barra de contexto (neutra): píldora segBg sólida.
// Manchas decorativas del fondo (Mis cuentas y bienvenida): círculos con opacidad sobre bg. Peor caso = las tres apiladas.
const BLOB = { yellow: ['#FFD966', 0.35], peach: ['#FFB59A', 0.25], sky: ['#9CC4FF', 0.25] };
const blobY = over(BLOB.yellow[0], BLOB.yellow[1], T.bg);
const blobP = over(BLOB.peach[0], BLOB.peach[1], T.bg);
const blobS = over(BLOB.sky[0], BLOB.sky[1], T.bg);
const blobWorst = over(BLOB.sky[0], BLOB.sky[1], over(BLOB.peach[0], BLOB.peach[1], blobY));
// Círculo blanco decorativo al 45 % sobre la tarjeta de cuenta (esquina derecha).
const accDeco = (card) => over('#FFFFFF', 0.45, card);

const pairs = [
  // texto general
  ['Texto principal sobre fondo cálido', T.text, T.bg],
  ['Texto principal sobre tarjeta', T.text, T.surface],
  ['Texto secundario sobre tarjeta', T.text2, T.surface],
  ['Texto secundario sobre fondo cálido', T.text2, T.bg],
  ['Ayuda/placeholder sobre tarjeta', T.text3, T.surface],
  ['Ayuda/placeholder sobre fondo cálido', T.text3, T.bg],
  // manchas decorativas del fondo (peor caso apilado)
  ['Título sobre manchas apiladas (peor caso)', T.text, blobWorst],
  ['Texto secundario sobre manchas apiladas (peor caso)', T.text2, blobWorst],
  ['brandInk (marca «CuidaTuBilletera») sobre manchas (peor caso)', T.brandInk, blobWorst],
  ['Texto secundario sobre mancha amarilla', T.text2, blobY],
  ['Texto secundario sobre mancha melocotón', T.text2, blobP],
  ['Texto secundario sobre mancha celeste', T.text2, blobS],
  // marca
  ['Blanco sobre brand700 (botón primario, FAB)', '#FFFFFF', T.brand700],
  ['Blanco sobre brand800 (botón presionado)', '#FFFFFF', T.brand800],
  ['brand700 como enlace sobre tarjeta', T.brand700, T.surface],
  ['brand700 como enlace sobre fondo cálido', T.brand700, T.bg],
  ['Subtítulo onBrandSoft sobre brand700', T.onBrandSoft, T.brand700],
  ['Blanco sobre tarjeta de saldo: banda brand500 35 %', '#FFFFFF', heroBand],
  ['Blanco sobre tarjeta de saldo: banda + círculo 8 % (peor caso)', '#FFFFFF', heroWorst],
  ['onBrandSoft sobre tarjeta de saldo (peor caso)', T.onBrandSoft, heroWorst],
  ['onBrandSoft sobre círculo 8 % sin banda', T.onBrandSoft, heroCircle],
  ['Texto oscuro sobre amarillo («+» del FAB, moneda)', T.text, T.yellow],
  ['Segmentado neutro: text2 sobre segBg', T.text2, T.segBg],
  ['Segmentado neutro: texto sobre tarjeta (opción elegida)', T.text, T.surface],
  ['Aviso breve: blanco sobre texto principal (snackbar)', '#FFFFFF', T.text],
  // barra de contexto (neutra, superficie blanca)
  ['Barra: texto (nombre, ‹ Mis cuentas) sobre superficie', T.text, T.surface],
  ['Barra: texto principal sobre píldora de saldo segBg', T.text, T.segBg],
  ['Barra: saldo negativo expenseText sobre píldora segBg', T.expenseText, T.segBg],
  ['Barra: «Archivada» yellowText sobre yellowSoft', T.yellowText, T.yellowSoft],
  ['Barra: «Saldo no disponible» expenseText sobre superficie', T.expenseText, T.surface],
  // semánticos
  ['Ingreso (importe) sobre tarjeta', T.income, T.surface],
  ['Ingreso (importe) sobre fondo cálido', T.income, T.bg],
  ['incomeText sobre incomeSoft (burbuja ↑, Ingreso elegido)', T.incomeText, T.incomeSoft],
  ['Gasto (importe) sobre tarjeta', T.expense, T.surface],
  ['Gasto (importe) sobre fondo cálido', T.expense, T.bg],
  ['expenseText sobre expenseSoft (burbuja ↓, Gasto elegido)', T.expenseText, T.expenseSoft],
  ['Blanco sobre expense (Anular/Archivar sólido)', '#FFFFFF', T.expense],
  ['yellowText sobre yellowSoft (aviso, guía)', T.yellowText, T.yellowSoft],
  // color por módulo: mosaico del título, píldora de pestaña, acentos
  ['cuentaInk sobre cuentaTile (Cuenta)', T.cuentaInk, T.cuentaTile],
  ['movInk sobre movTile (Movimientos, ámbar)', T.movInk, T.movTile],
  ['calInk sobre calTile (Calendario)', T.calInk, T.calTile],
  ['repInk sobre repTile (Reportes, segmentado elegido)', T.repInk, T.repTile],
  ['masInk sobre masTile (Más, Categorías)', T.masInk, T.masTile],
  ['cuentaInk sobre barra blanca (pestaña activa)', T.cuentaInk, T.surface],
  ['movInk sobre barra blanca (pestaña activa)', T.movInk, T.surface],
  ['calInk sobre barra blanca (pestaña activa)', T.calInk, T.surface],
  ['repInk sobre barra blanca (pestaña activa)', T.repInk, T.surface],
  ['masInk sobre barra blanca (pestaña activa)', T.masInk, T.surface],
  ['Blanco sobre calStrong (día elegido del calendario)', '#FFFFFF', T.calStrong],
  ['Pestaña inactiva (text2) sobre barra blanca', T.text2, T.surface],
  // componentes (3:1)
  ['Borde de campo sobre tarjeta (componente 3:1)', T.borderStrong, T.surface, 3],
  ['Borde de campo sobre fondo cálido (componente 3:1)', T.borderStrong, T.bg, 3],
  ['Borde de foco brand700 sobre tarjeta (componente 3:1)', T.brand700, T.surface, 3],
  ['Borde Gasto elegido (expense) sobre expenseSoft (3:1)', T.expense, T.expenseSoft, 3],
  ['Borde Ingreso elegido (income) sobre incomeSoft (3:1)', T.income, T.incomeSoft, 3],
  ['Borde «hoy» calStrong sobre tarjeta (3:1)', T.calStrong, T.surface, 3],
  ['Borde chip activo movInk sobre movTile (3:1)', T.movInk, T.movTile, 3],
  ['Botón primario brand700 sobre fondo cálido (componente 3:1)', T.brand700, T.bg, 3],
];
// Tarjetas de cuenta: textos sobre el fondo de la tarjeta y sobre el círculo decorativo.
for (const [n, card] of ACC) {
  pairs.push([`Cuenta ${n}: texto principal sobre tarjeta`, T.text, card]);
  pairs.push([`Cuenta ${n}: text2 («Saldo actual», ›) sobre tarjeta`, T.text2, card]);
  pairs.push([`Cuenta ${n}: saldo negativo expenseText sobre tarjeta`, T.expenseText, card]);
  pairs.push([`Cuenta ${n}: text2 sobre círculo decorativo 45 %`, T.text2, accDeco(card)]);
}

const check = process.argv.includes('--check');
let fails = 0, minText = 99, minComp = 99;
let md = '| Par (texto sobre fondo) | Texto | Fondo | Ratio | Resultado |\n| --- | --- | --- | --- | --- |\n';
for (const [n, f, b, min = 4.5] of pairs) {
  const r = ratio(f, b), ok = r >= min;
  if (!ok) fails++;
  if (min === 3) minComp = Math.min(minComp, r); else minText = Math.min(minText, r);
  md += `| ${n} | \`${f}\` | \`${b}\` | ${r.toFixed(2)}:1 | ${ok ? (min === 3 ? 'Cumple 3:1' : 'Cumple') : 'NO CUMPLE'} |\n`;
}
console.log(md);
console.log(`Colores compuestos: banda=${heroBand} banda+círculo=${heroWorst} círculo=${heroCircle} manchas: amarilla=${blobY} melocotón=${blobP} celeste=${blobS} apiladas=${blobWorst}`);
console.log(`Pares: ${pairs.length}. Mínimo texto: ${minText.toFixed(2)}:1. Mínimo componente: ${minComp.toFixed(2)}:1.`);

// ---------- distinguibilidad (docs/007 §3.6): módulo frente a semántica de dinero ----------
// Simulación de protanopia/deuteranopia (Viénot, Brettel y Mollon 1999, en RGB lineal) y diferencia ΔE76 en CIELAB.
// Umbral orientativo: ΔE >= 20 = claramente distinto. No sustituye la regla de no usar solo color (texto, signo, icono).
const toLin = (h) => hex2rgb(h).map(lin);
const fromLin = (c) => c.map((v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
const SIM = {
  normal: (c) => c,
  protan: ([r, g, b]) => [0.11238 * r + 0.88762 * g, 0.11238 * r + 0.88762 * g, 0.00401 * r - 0.00401 * g + b],
  deutan: ([r, g, b]) => [0.29275 * r + 0.70725 * g, 0.29275 * r + 0.70725 * g, -0.02234 * r + 0.02234 * g + b],
};
const lab = (rgb255) => {
  const [r, g, b] = rgb255.map((v) => lin(Math.max(0, Math.min(255, v))));
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a, b, mode) => { const A = lab(fromLin(SIM[mode](toLin(a)))), B = lab(fromLin(SIM[mode](toLin(b)))); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const dpairs = [
  ['Marca brand700 frente a ingreso income', T.brand700, T.income],
  ['Mosaico Cuenta cuentaTile frente a incomeSoft', T.cuentaTile, T.incomeSoft],
  ['Ámbar movStrong frente a gasto expense', T.movStrong, T.expense],
  ['Mosaico ámbar movTile frente a expenseSoft', T.movTile, T.expenseSoft],
  ['Tinta ámbar movInk frente a expenseText', T.movInk, T.expenseText],
];
let mdd = '\n| Par (distinguibilidad) | A | B | ΔE normal | ΔE protanopia | ΔE deuteranopia | Resultado |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const [n, a, b] of dpairs) {
  const v = ['normal', 'protan', 'deutan'].map((m) => dE(a, b, m)), ok = Math.min(...v) >= 20;
  mdd += `| ${n} | \`${a}\` | \`${b}\` | ${v[0].toFixed(1)} | ${v[1].toFixed(1)} | ${v[2].toFixed(1)} | ${ok ? 'Distinto' : 'Cercano: apoyarse en texto/icono'} |\n`;
}
console.log(mdd);

// ---------- categorías ----------
// Color de la API como fondo del cuadrado; glifo blanco solo si blanco >= 3:1 (objeto gráfico, WCAG 1.4.11).
// Si no llega, se oscurece el fondo (mezcla con negro) hasta 3:1 => token catFill.
const cats = [
  ['Alimentación', '#F97316'], ['Transporte', '#3B82F6'], ['Servicios básicos', '#EAB308'], ['Salud', '#EF4444'],
  ['Educación', '#8B5CF6'], ['Hogar', '#14B8A6'], ['Entretenimiento', '#EC4899'], ['Otros gastos', '#6B7280'],
  ['Sueldo', '#22C55E'], ['Ventas', '#06B6D4'], ['Otros ingresos', '#84CC16'],
];
let mdc = '\n| Categoría | Color API | Blanco sobre API | Glifo blanco directo | `catFill` | Blanco sobre `catFill` | Oscuro `#17211F` sobre API |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const [n, c] of cats) {
  const w = ratio('#FFFFFF', c), d = darkenForWhite(c, 3.0), dk = ratio(T.text, c);
  if (ratio('#FFFFFF', d.color) < 3) fails++;
  mdc += `| ${n} | \`${c}\` | ${w.toFixed(2)}:1 | ${w >= 3 ? 'Sí' : 'No'} | \`${d.color}\`${d.k ? ` (−${d.k} %)` : ''} | ${ratio('#FFFFFF', d.color).toFixed(2)}:1 | ${dk.toFixed(2)}:1 |\n`;
}
console.log(mdc);
if (check && fails) { console.error(`Pares que no cumplen: ${fails}`); process.exit(1); }
