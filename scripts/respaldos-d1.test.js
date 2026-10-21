import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANDERA_PURGA,
  analizarNombre,
  diaUtc,
  evaluarFechas,
  main,
  parseFecha,
  validarDirectorio,
} from './respaldos-d1.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REAL = path.resolve(AQUI, '..');
const SCRIPT = path.join(AQUI, 'respaldos-d1.js');
const AHORA = new Date(Date.UTC(2026, 9, 21, 12, 0, 0)); // 2026-10-21 UTC
const MARCA = 'MARCA-UNICA-NO-IMPRIMIR-7f3a9c';

const temporales = [];
function temporal(prefijo = 'respaldos-prueba-') {
  const d = mkdtempSync(path.join(tmpdir(), prefijo));
  temporales.push(d);
  return d;
}
after(() => {
  for (const d of temporales) rmSync(d, { recursive: true, force: true });
});

/** Fecha AAAAMMDD a `desplazamiento` días de AHORA. */
function fecha(desplazamiento) {
  const f = new Date(AHORA.getTime() + desplazamiento * 86_400_000);
  return f.toISOString().slice(0, 10).replaceAll('-', '');
}

function nombreRespaldo(creadoOffset, venceOffset, db = 'db-ejemplo') {
  return `respaldo-${db}-${fecha(creadoOffset)}-vence-${fecha(venceOffset)}.sql`;
}

function crearRespaldo(dir, creadoOffset, venceOffset, { registrar = true, contenido } = {}) {
  const nombre = nombreRespaldo(creadoOffset, venceOffset);
  const datos = contenido ?? `-- SQL ficticio ${MARCA}\nINSERT INTO t VALUES (1);\n`;
  writeFileSync(path.join(dir, nombre), datos, { mode: 0o600 });
  chmodSync(path.join(dir, nombre), 0o600);
  if (registrar) {
    const sha = createHash('sha256').update(datos).digest('hex');
    const linea = `${nombre}\t${sha}\t${fecha(creadoOffset)}\t${fecha(venceOffset)}\n`;
    writeFileSync(path.join(dir, 'registro.tsv'), linea, { flag: 'a', mode: 0o600 });
    chmodSync(path.join(dir, 'registro.tsv'), 0o600);
  }
  return nombre;
}

/** Directorio privado (0700) más un "repo" simulado distinto. */
function entorno() {
  const dir = temporal();
  chmodSync(dir, 0o700);
  const repo = temporal('repo-simulado-');
  return { dir, repo };
}

async function ejecutar(argv, repo, env = {}) {
  const out = [];
  const err = [];
  const codigo = await main(argv, {
    env,
    repoRoot: repo,
    ahora: AHORA,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
  });
  return { codigo, out: out.join('\n'), err: err.join('\n') };
}

describe('funciones puras', () => {
  test('parseFecha valida fechas reales', () => {
    assert.notEqual(parseFecha('20260228'), null);
    assert.equal(parseFecha('20260230'), null);
    assert.equal(parseFecha('2026-02-28'), null);
    assert.equal(parseFecha('20261301'), null);
  });

  test('analizarNombre acepta el patrón y rechaza variantes', () => {
    assert.notEqual(analizarNombre('respaldo-db-ejemplo-20261021-vence-20261024.sql'), null);
    assert.equal(analizarNombre('respaldo-DB-20261021-vence-20261024.sql'), null);
    assert.equal(analizarNombre('../respaldo-db-20261021-vence-20261024.sql'), null);
    assert.equal(analizarNombre('respaldo-db-20261021-vence-20261024.sql.bak'), null);
    assert.equal(analizarNombre(`respaldo-${'a'.repeat(41)}-20261021-vence-20261024.sql`), null);
  });

  test('evaluarFechas aplica retención y vencimiento', () => {
    const hoy = diaUtc(AHORA);
    const ev = (c, v) => evaluarFechas(analizarNombre(nombreRespaldo(c, v)), hoy);
    assert.equal(ev(0, 3).estado, 'OK');
    assert.equal(ev(-3, 0).estado, 'VENCE HOY');
    assert.equal(ev(-5, -1).estado, 'VENCIDO');
    assert.equal(ev(0, 8).estado, 'ERROR');
    assert.equal(ev(0, 4).estado, 'AVISO');
    assert.equal(ev(0, 7).estado, 'AVISO');
    assert.equal(ev(0, -1).estado, 'ERROR');
    assert.equal(ev(0, 3).dias, 3);
  });

  test('evaluarFechas aplica el tope duro de 7 días desde la creación', () => {
    const hoy = diaUtc(AHORA);
    const ev = (c, v) => evaluarFechas(analizarNombre(nombreRespaldo(c, v)), hoy);
    assert.equal(ev(-7, 300).estado, 'ERROR'); // retención excesiva
    assert.match(ev(-8, 300).notas.join(' '), /tope/);
    // el estado de fechas por sí solo ya es VENCIDO: sin ERROR de retención no puede darse,
    // por eso se verifica con retención válida en el límite
    assert.equal(ev(-7, 0).estado, 'VENCE HOY');
    assert.equal(ev(-8, 0).estado, 'ERROR'); // retención 8: el ERROR domina al VENCIDO
    assert.equal(ev(-7, 300).dias, 0);
    assert.equal(ev(-10, 300).dias, -3);
  });

  test('evaluarFechas marca la fecha de creación futura como ERROR', () => {
    const hoy = diaUtc(AHORA);
    const ev = evaluarFechas(analizarNombre(nombreRespaldo(2, 4)), hoy);
    assert.equal(ev.estado, 'ERROR');
    assert.match(ev.notas.join(' '), /futura/);
  });
});

describe('validarDirectorio', () => {
  test('rechaza rutas relativas, inexistentes y archivos', () => {
    const { dir, repo } = entorno();
    assert.ok(validarDirectorio('relativa/ruta', repo).errores.length > 0);
    assert.ok(validarDirectorio(path.join(dir, 'no-existe'), repo).errores.length > 0);
    const archivo = path.join(dir, 'a.txt');
    writeFileSync(archivo, 'x');
    assert.ok(validarDirectorio(archivo, repo).errores.length > 0);
    assert.ok(validarDirectorio('', repo).errores.length > 0);
  });

  test('rechaza un directorio dentro del repositorio simulado', () => {
    const { repo } = entorno();
    const interno = path.join(repo, 'respaldos');
    mkdirSync(interno, { mode: 0o700 });
    const r = validarDirectorio(interno, repo);
    assert.ok(r.errores.some((e) => e.includes('repositorio')));
    assert.ok(validarDirectorio(repo, repo).errores.length > 0);
  });

  test('rechaza la raíz real del repositorio sin escribir en ella', () => {
    assert.ok(validarDirectorio(RAIZ_REAL, RAIZ_REAL).errores.length > 0);
    assert.ok(validarDirectorio(AQUI, RAIZ_REAL).errores.length > 0);
  });

  test('rechaza un enlace simbólico al directorio', () => {
    const { dir, repo } = entorno();
    const enlace = path.join(temporal(), 'enlace');
    symlinkSync(dir, enlace);
    assert.ok(validarDirectorio(enlace, repo).errores.some((e) => e.includes('enlace')));
  });

  test('permisos: 0700 correcto y 0755 señalado', () => {
    const { dir, repo } = entorno();
    assert.equal(validarDirectorio(dir, repo).permisos, false);
    chmodSync(dir, 0o755);
    const r = validarDirectorio(dir, repo);
    assert.deepEqual(r.errores, []);
    assert.equal(r.permisos, true);
  });
});

describe('auditar', () => {
  test('todo correcto: salida 0', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 3);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.match(r.out, /OK/);
    assert.match(r.out, /quedan 3 d/);
  });

  test('auditar es el subcomando predeterminado y acepta la variable de entorno', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 3);
    const r = await ejecutar([], repo, { CUIDATUBILLETERA_RESPALDOS_DIR: dir });
    assert.equal(r.codigo, 0);
  });

  test('sin directorio: salida 2', async () => {
    const { repo } = entorno();
    const r = await ejecutar(['auditar'], repo);
    assert.equal(r.codigo, 2);
  });

  test('VENCE HOY no falla', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, -3, 0);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.match(r.out, /VENCE HOY/);
  });

  test('VENCIDO: salida 1', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, -5, -1);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /VENCIDO/);
  });

  test('vence - creado = 8: ERROR', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 8);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /ERROR/);
  });

  test('vence - creado entre 4 y 7: AVISO sin fallo', async () => {
    for (const dias of [4, 7]) {
      const { dir, repo } = entorno();
      crearRespaldo(dir, 0, dias);
      const r = await ejecutar(['auditar', '--dir', dir], repo);
      assert.equal(r.codigo, 0, `retención ${dias}`);
      assert.match(r.out, /AVISO/);
    }
  });

  test('nombre inválido: ERROR', async () => {
    const { dir, repo } = entorno();
    writeFileSync(path.join(dir, 'respaldo-malo.sql'), 'x');
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /patrón/);
  });

  test('enlace simbólico: ERROR y no se sigue', async () => {
    const { dir, repo } = entorno();
    const fuera = temporal();
    const destino = path.join(fuera, 'secreto.txt');
    writeFileSync(destino, MARCA);
    symlinkSync(destino, path.join(dir, nombreRespaldo(0, 3)));
    symlinkSync(fuera, path.join(dir, 'carpeta-enlazada'));
    mkdirSync(path.join(dir, 'subdirectorio'));
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /enlace simbólico/);
    assert.match(r.out, /directorio/);
    assert.doesNotMatch(r.out, /sin línea en el registro/);
    assert.ok(!r.out.includes(MARCA));
  });

  test('archivo y registro con permisos abiertos: AVISO', async () => {
    const { dir, repo } = entorno();
    const nombre = crearRespaldo(dir, 0, 3);
    chmodSync(path.join(dir, nombre), 0o644);
    chmodSync(path.join(dir, 'registro.tsv'), 0o644);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.equal((r.out.match(/permisos del archivo demasiado abiertos/g) ?? []).length, 2);
    assert.match(r.out, /2 AVISO/);
  });

  test('respaldo con vence lejano pero creado hace más de 7 días: VENCIDO y ERROR', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, -8, 300);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /supera el máximo/);
    assert.match(r.out, /superó el tope/);
    assert.match(r.out, /vencido hace 1 d/);
    assert.match(r.out, /1 ERROR/);
  });

  test('creado en el futuro: ERROR', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 2, 4);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /futura/);
  });

  test('permisos 0755: ERROR; 0700: OK', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 3);
    chmodSync(dir, 0o755);
    const malo = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(malo.codigo, 1);
    assert.match(malo.out, /permisos demasiado abiertos/);
    chmodSync(dir, 0o700);
    const bueno = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(bueno.codigo, 0);
    assert.equal(lstatSync(dir).mode & 0o077, 0);
  });

  test('directorio dentro del repositorio simulado: salida 2', async () => {
    const { repo } = entorno();
    const interno = path.join(repo, 'respaldos');
    mkdirSync(interno, { mode: 0o700 });
    const r = await ejecutar(['auditar', '--dir', interno], repo);
    assert.equal(r.codigo, 2);
  });

  test('hash distinto: ERROR', async () => {
    const { dir, repo } = entorno();
    const nombre = crearRespaldo(dir, 0, 3);
    writeFileSync(path.join(dir, nombre), '-- contenido modificado');
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.out, /hash no coincide/);
  });

  test('sin registro: AVISO; registro sin archivo: AVISO', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 3, { registrar: false });
    const nombre = crearRespaldo(dir, -1, 2);
    rmSync(path.join(dir, nombre));
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.match(r.out, /sin línea en el registro/);
    assert.match(r.out, /registrado pero el archivo no existe/);
  });

  test('la salida no incluye el contenido ni rutas absolutas', async () => {
    const { dir, repo } = entorno();
    crearRespaldo(dir, 0, 3);
    crearRespaldo(dir, -5, -1);
    const r = await ejecutar(['auditar', '--dir', dir], repo);
    const todo = `${r.out}\n${r.err}`;
    assert.ok(!todo.includes(MARCA));
    assert.ok(!todo.includes(dir));
    assert.ok(!todo.includes(tmpdir()));
  });
});

describe('registrar', () => {
  test('registra un archivo nuevo y rechaza el duplicado', async () => {
    const { dir, repo } = entorno();
    const nombre = crearRespaldo(dir, 0, 3, { registrar: false });
    const r1 = await ejecutar(['registrar', nombre, '--dir', dir], repo);
    assert.equal(r1.codigo, 0);
    const linea = readFileSync(path.join(dir, 'registro.tsv'), 'utf8').trim().split('\t');
    assert.equal(linea.length, 4);
    assert.equal(linea[0], nombre);
    assert.match(linea[1], /^[0-9a-f]{64}$/);
    const antes = readFileSync(path.join(dir, 'registro.tsv'), 'utf8');
    const r2 = await ejecutar(['registrar', nombre, '--dir', dir], repo);
    assert.equal(r2.codigo, 1);
    assert.equal(readFileSync(path.join(dir, 'registro.tsv'), 'utf8'), antes);
    const aud = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(aud.codigo, 0);
    assert.ok(!`${r1.out}${r2.err}${aud.out}`.includes(MARCA));
  });

  test('rechaza rutas, separadores y ..', async () => {
    const { dir, repo } = entorno();
    const nombre = crearRespaldo(dir, 0, 3, { registrar: false });
    for (const malo of [
      path.join(dir, nombre),
      `../${nombre}`,
      `sub/${nombre}`,
      '..',
      'otro.sql',
    ]) {
      const r = await ejecutar(['registrar', malo, '--dir', dir], repo);
      assert.equal(r.codigo, 2, malo);
    }
    assert.equal(existsSync(path.join(dir, 'registro.tsv')), false);
  });

  test('no registra un enlace simbólico', async () => {
    const { dir, repo } = entorno();
    const fuera = path.join(temporal(), 'x.sql');
    writeFileSync(fuera, 'x');
    const nombre = nombreRespaldo(0, 3);
    symlinkSync(fuera, path.join(dir, nombre));
    const r = await ejecutar(['registrar', nombre, '--dir', dir], repo);
    assert.equal(r.codigo, 1);
  });

  test('registro.tsv como enlace simbólico: falla sin escribir en el centinela', async () => {
    const { dir, repo } = entorno();
    const nombre = crearRespaldo(dir, 0, 3, { registrar: false });
    const centinela = path.join(temporal(), 'centinela.txt');
    writeFileSync(centinela, 'intacto\n');
    symlinkSync(centinela, path.join(dir, 'registro.tsv'));
    const r = await ejecutar(['registrar', nombre, '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.equal(readFileSync(centinela, 'utf8'), 'intacto\n');
  });
});

describe('purgar', () => {
  test('sin bandera es solo simulación', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1);
    const r = await ejecutar(['purgar', '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.match(r.out, /Simulación/);
    assert.ok(existsSync(path.join(dir, vencido)));
  });

  test('una bandera incorrecta no borra', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1);
    const r = await ejecutar(['purgar', '--confirmar-purga=SI', '--dir', dir], repo);
    assert.equal(r.codigo, 2);
    assert.ok(existsSync(path.join(dir, vencido)));
  });

  test('con bandera borra solo vencidos', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1);
    const venceHoy = crearRespaldo(dir, -3, 0);
    const vigente = crearRespaldo(dir, 0, 3);
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.equal(existsSync(path.join(dir, vencido)), false);
    assert.ok(existsSync(path.join(dir, venceHoy)));
    assert.ok(existsSync(path.join(dir, vigente)));
    assert.match(r.out, /borrado operativo/);
    assert.match(r.out, /no se garantiza el borrado físico/i);
    assert.ok(!r.out.includes(MARCA));
    const registro = readFileSync(path.join(dir, 'registro.tsv'), 'utf8');
    assert.ok(registro.includes(`${vencido}\t`));
    assert.match(registro, new RegExp(`${vencido}\\tbaja\\t20261021\\t-`));
    const aud = await ejecutar(['auditar', '--dir', dir], repo);
    assert.equal(aud.codigo, 0);
    assert.doesNotMatch(aud.out, /registrado pero el archivo no existe/);
  });

  test('no toca enlaces ni archivos con nombre inválido o con ../', async () => {
    const { dir, repo } = entorno();
    const fuera = temporal();
    const destino = path.join(fuera, nombreRespaldo(-5, -1));
    writeFileSync(destino, MARCA);
    symlinkSync(destino, path.join(dir, nombreRespaldo(-5, -1)));
    writeFileSync(path.join(dir, 'otro-archivo.txt'), 'x');
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.ok(existsSync(destino));
    assert.ok(existsSync(path.join(dir, 'otro-archivo.txt')));
    assert.match(r.out, /candidatos a eliminar: 0/);
  });

  test('no sale del directorio con nombres con ../', async () => {
    const { dir, repo } = entorno();
    const hermano = path.join(temporal(), 'ext');
    mkdirSync(hermano);
    const nombre = nombreRespaldo(-5, -1);
    writeFileSync(path.join(hermano, nombre), 'x');
    const dentro = path.join(dir, 'sub');
    mkdirSync(dentro, { mode: 0o700 });
    const relativo = path.relative(dentro, path.join(hermano, nombre));
    const r = await ejecutar(['registrar', relativo, '--dir', dentro], repo);
    assert.equal(r.codigo, 2);
    assert.ok(existsSync(path.join(hermano, nombre)));
  });

  test('con permisos abiertos no opera (código 2)', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1);
    chmodSync(dir, 0o755);
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 2);
    assert.ok(existsSync(path.join(dir, vencido)));
    const reg = await ejecutar(['registrar', vencido, '--dir', dir], repo);
    assert.equal(reg.codigo, 2);
  });

  test('registro.tsv como enlace simbólico: no borra nada ni escribe fuera', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1, { registrar: false });
    const centinela = path.join(temporal(), 'centinela.txt');
    writeFileSync(centinela, 'intacto\n');
    symlinkSync(centinela, path.join(dir, 'registro.tsv'));
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 1);
    assert.match(r.err, /no es un archivo regular; no se elimina nada/);
    assert.ok(existsSync(path.join(dir, vencido)));
    assert.equal(readFileSync(centinela, 'utf8'), 'intacto\n');
  });

  test('respeta el tope de 7 días desde la creación aunque vence sea posterior', async () => {
    const { dir, repo } = entorno();
    const excedido = crearRespaldo(dir, -8, 300);
    const enLimite = crearRespaldo(dir, -7, 300);
    const sim = await ejecutar(['purgar', '--dir', dir], repo);
    assert.match(sim.out, /candidatos a eliminar: 1/);
    assert.ok(existsSync(path.join(dir, excedido)));
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.equal(existsSync(path.join(dir, excedido)), false);
    assert.ok(existsSync(path.join(dir, enLimite)));
  });

  test('si se borra pero falla registrar la baja, lo indica y sale con 1', async () => {
    const { dir, repo } = entorno();
    const vencido = crearRespaldo(dir, -5, -1);
    chmodSync(path.join(dir, 'registro.tsv'), 0o400);
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    chmodSync(path.join(dir, 'registro.tsv'), 0o600);
    if (process.getuid?.() === 0) return; // root ignora los permisos
    assert.equal(r.codigo, 1);
    assert.equal(existsSync(path.join(dir, vencido)), false);
    assert.match(r.out, /Eliminado, pero no se pudo registrar la baja/);
  });

  test('un archivo con nombre ajeno al patrón nunca se purga', async () => {
    const { dir, repo } = entorno();
    writeFileSync(path.join(dir, 'respaldo-malo-20200101.sql'), 'x');
    const r = await ejecutar(['purgar', BANDERA_PURGA, '--dir', dir], repo);
    assert.equal(r.codigo, 0);
    assert.ok(existsSync(path.join(dir, 'respaldo-malo-20200101.sql')));
  });
});

describe('línea de comandos', () => {
  test('--help imprime la ayuda', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Uso: node scripts\/respaldos-d1\.js/);
  });

  test('auditar --dir sobre un directorio temporal', () => {
    const { dir } = entorno();
    crearRespaldo(dir, 0, 3);
    const r = spawnSync(process.execPath, [SCRIPT, 'auditar', '--dir', dir], { encoding: 'utf8' });
    assert.ok(!`${r.stdout}${r.stderr}`.includes(MARCA));
    assert.ok(!`${r.stdout}${r.stderr}`.includes(dir));
    assert.ok([0, 1].includes(r.status));
  });

  test('sin directorio devuelve 2', () => {
    const entornoLimpio = { ...process.env };
    delete entornoLimpio.CUIDATUBILLETERA_RESPALDOS_DIR;
    const r = spawnSync(process.execPath, [SCRIPT, 'auditar'], {
      encoding: 'utf8',
      env: entornoLimpio,
    });
    assert.equal(r.status, 2);
  });
});
