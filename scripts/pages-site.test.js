import { after, describe, test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = mkdtempSync(path.join(tmpdir(), 'pages-site-'));
after(() => {
  // Restaura permisos por si algún caso los dejó en 000.
  spawnSync('chmod', ['-R', 'u+rwX', base]);
  rmSync(base, { recursive: true, force: true });
});

const workflow = parse(readFileSync(path.join(RAIZ, '.github', 'workflows', 'pages.yml'), 'utf8'));
const paso = workflow.jobs.verificar.steps.find(
  (s) => s.name === 'Verificar el contenido de site/',
);
assert.ok(paso?.run, 'No se encontró el paso «Verificar el contenido de site/».');
const SCRIPT = path.join(base, 'verificar-site.sh');
writeFileSync(SCRIPT, paso.run);

const CORREO = 'luis.caiza.soria@gmail.com';
let n = 0;

// Copia temporal de site/ real; `cambiar` recibe su ruta para introducir un defecto.
const preparar = (cambiar) => {
  const dir = path.join(base, `site-${n++}`);
  cpSync(path.join(RAIZ, 'site'), dir, { recursive: true });
  if (cambiar) cambiar(dir);
  return dir;
};

// Igual que GitHub con `shell: bash`: bash -e -o pipefail <script>.
const ejecutar = (dir) => {
  const r = spawnSync('bash', ['-e', '-o', 'pipefail', SCRIPT], {
    env: { PATH: process.env.PATH, SITE_DIR: dir, CORREO_PERMITIDO: CORREO },
    encoding: 'utf8',
  });
  return { rc: r.status, salida: `${r.stdout}${r.stderr}` };
};

const falla = (cambiar, patron) => {
  const { rc, salida } = ejecutar(preparar(cambiar));
  assert.equal(rc, 1, salida);
  assert.notEqual(salida.trim(), '', 'La salida no debe estar vacía.');
  assert.match(salida, patron);
  assert.match(salida, /::error::La verificación de .* falló con \d+ problema\(s\)/);
};

const escribir = (rel, contenido) => (dir) => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), contenido);
};
const anexar = (rel, texto) => (dir) => {
  const f = path.join(dir, rel);
  writeFileSync(f, readFileSync(f, 'utf8') + texto);
};
const HTML = (cuerpo, lang = ' lang="es"') =>
  `<!doctype html>\n<html${lang}><head><title>t</title></head><body>${cuerpo}</body></html>\n`;

describe('paso «Verificar el contenido de site/» bajo bash -e -o pipefail', () => {
  test('el script es sintácticamente válido (bash -n)', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });

  test('(a) el site/ real pasa', () => {
    const { rc, salida } = ejecutar(preparar());
    assert.equal(rc, 0, salida);
    assert.match(salida, /Verificación de .* correcta\./);
  });

  test('(a) el directorio inexistente falla con mensaje', () => {
    const { rc, salida } = ejecutar(path.join(base, 'no-existe'));
    assert.equal(rc, 1);
    assert.match(salida, /::error::No existe el directorio/);
  });

  test('(b) archivo obligatorio ausente', () => {
    falla(
      (d) => rmSync(path.join(d, 'privacidad', 'index.html')),
      /::error::Falta .*privacidad\/index\.html/,
    );
    falla((d) => rmSync(path.join(d, '.nojekyll')), /::error::Falta .*\.nojekyll/);
  });

  test('(c) correo no autorizado', () => {
    falla(
      anexar('index.html', '<p>otro@example.com</p>\n'),
      /::error::Correo no permitido: otro@example\.com/,
    );
  });

  for (const [texto, desc] of [
    ['PENDIENTE', 'PENDIENTE'],
    ['mi.workers.dev', 'workers\\.dev'],
    ['http://ejemplo.org', 'http:// \\(usa https://\\)'],
    ['<script>x</script>', 'contenido activo o remoto'],
  ]) {
    test(`(d) texto prohibido: ${texto}`, () => {
      falla(
        anexar('index.html', `<p>${texto}</p>\n`),
        new RegExp(`::error::Texto prohibido \\(${desc}\\)`),
      );
    });
  }

  test('(e) archivo inesperado, directorio extra y enlace simbólico', () => {
    falla(escribir('app.js', 'x'), /::error::Archivo no permitido .*: app\.js/);
    falla(escribir('extra/a.html', HTML('<h1>x</h1>')), /::error::Directorio inesperado: extra/);
    falla(
      (d) => symlinkSync('index.html', path.join(d, 'enlace.html')),
      /::error::Enlace simbólico no permitido: enlace\.html/,
    );
  });

  test('(f) HTML sin lang="es"', () => {
    falla(
      escribir('privacidad/index.html', HTML('<h1>x</h1>', ' lang="en"')),
      /::error::.*falta lang="es"/,
    );
  });

  test('(g) HTML con cero y con varios <h1>', () => {
    falla(
      escribir('privacidad/index.html', HTML('<p>x</p>')),
      /::error::.*exactamente un <h1> \(tiene 0\)/,
    );
    falla(
      escribir('privacidad/index.html', HTML('<h1>a</h1><h1>b</h1>')),
      /::error::.*exactamente un <h1> \(tiene 2\)/,
    );
  });

  const esRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  test(
    '(h) fallo de lectura (permisos 000)',
    { skip: esRoot && 'se ejecuta como root: chmod 000 no impide leer' },
    () => {
      falla(
        (d) => chmodSync(path.join(d, 'privacidad', 'index.html'), 0o000),
        /::error::.*[Ee]rror de lectura/,
      );
    },
  );

  test('(i) archivo con bytes NUL', () => {
    falla(
      escribir('estilos.css', Buffer.from('a{}\u0000b{}')),
      /::error::Archivo con bytes NUL no permitido/,
    );
  });
});
