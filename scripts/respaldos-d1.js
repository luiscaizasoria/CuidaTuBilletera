// Auditoría y limpieza de respaldos manuales de D1 (política de retención).
//
// Política: retención máxima de 7 días naturales (objetivo operativo: 3), almacenamiento
// privado fuera del repositorio, registro sin datos personales y limpieza verificable.
// El borrado es operativo (unlink): no se garantiza el borrado físico irrecuperable.
//
// Uso (ejemplos con valores ficticios):
//   node scripts/respaldos-d1.js auditar --dir /ruta/privada/respaldos
//   node scripts/respaldos-d1.js registrar respaldo-db-ejemplo-20260101-vence-20260104.sql --dir ...
//   node scripts/respaldos-d1.js purgar --dir ... [--confirmar-purga=ELIMINAR-VENCIDOS]
//
// No ejecuta nada de forma automática y nunca imprime el contenido de los respaldos.
import {
  closeSync,
  constants,
  createReadStream,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VARIABLE_DIR = 'CUIDATUBILLETERA_RESPALDOS_DIR';
export const NOMBRE_REGISTRO = 'registro.tsv';
export const RETENCION_MAXIMA = 7;
export const RETENCION_OBJETIVO = 3;
export const BANDERA_PURGA = '--confirmar-purga=ELIMINAR-VENCIDOS';
export const PATRON_NOMBRE = /^respaldo-([a-z0-9-]{1,40})-(\d{8})-vence-(\d{8})\.sql$/;

const MS_DIA = 86_400_000;
const SEVERIDAD = { OK: 0, AVISO: 1, 'VENCE HOY': 2, VENCIDO: 3, ERROR: 4 };

// ---------------------------------------------------------------- funciones puras

/** Convierte AAAAMMDD en número de día UTC desde 1970, o null si no es una fecha real. */
export function parseFecha(texto) {
  if (typeof texto !== 'string' || !/^\d{8}$/.test(texto)) return null;
  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(4, 6));
  const dia = Number(texto.slice(6, 8));
  const ms = Date.UTC(anio, mes - 1, dia);
  const f = new Date(ms);
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) {
    return null;
  }
  return ms / MS_DIA;
}

/** Día UTC actual como número de día desde 1970. */
export function diaUtc(ahora = new Date()) {
  return Math.floor(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()) / MS_DIA,
  );
}

/** Analiza un nombre de archivo. Devuelve null si no cumple el patrón o las fechas no son reales. */
export function analizarNombre(nombre) {
  if (typeof nombre !== 'string') return null;
  const m = PATRON_NOMBRE.exec(nombre);
  if (!m) return null;
  const creado = parseFecha(m[2]);
  const vence = parseFecha(m[3]);
  if (creado === null || vence === null) return null;
  return { db: m[1], creadoTexto: m[2], venceTexto: m[3], creado, vence };
}

/** Un nombre de archivo válido para operar: patrón correcto, sin separadores ni "..". */
export function esNombreSeguro(nombre) {
  return (
    typeof nombre === 'string' &&
    !nombre.includes('/') &&
    !nombre.includes('\\') &&
    !nombre.includes('..') &&
    !nombre.includes('\0') &&
    analizarNombre(nombre) !== null
  );
}

/** Vencimiento efectivo: el menor entre el declarado y creación + tope duro de retención. */
export function vencimientoEfectivo(info) {
  return Math.min(info.vence, info.creado + RETENCION_MAXIMA);
}

/** Evalúa fechas de un nombre ya analizado frente al día actual. Pura. */
export function evaluarFechas(info, hoy) {
  const notas = [];
  let estado = 'OK';
  const sube = (nuevo) => {
    if (SEVERIDAD[nuevo] > SEVERIDAD[estado]) estado = nuevo;
  };
  const retencion = info.vence - info.creado;
  if (retencion < 0) {
    sube('ERROR');
    notas.push('el vencimiento es anterior a la creación');
  } else if (retencion > RETENCION_MAXIMA) {
    sube('ERROR');
    notas.push(`retención de ${retencion} días supera el máximo de ${RETENCION_MAXIMA}`);
  } else if (retencion > RETENCION_OBJETIVO) {
    sube('AVISO');
    notas.push(`retención de ${retencion} días supera el objetivo de ${RETENCION_OBJETIVO}`);
  }
  if (info.creado > hoy) {
    sube('ERROR');
    notas.push('la fecha de creación es futura');
  }
  const limite = vencimientoEfectivo(info);
  if (hoy > limite) {
    sube('VENCIDO');
    if (limite < info.vence)
      notas.push(`superó el tope de ${RETENCION_MAXIMA} días desde la creación`);
  } else if (hoy === limite) {
    sube('VENCE HOY');
  }
  return { estado, notas, dias: limite - hoy };
}

function dentroDe(base, objetivo) {
  const rel = path.relative(base, objetivo);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * Valida el directorio de respaldos. Pura respecto al estado del programa (solo lee el sistema
 * de archivos). `raizRepo` se recibe como parámetro para poder probarla con un repositorio simulado.
 * Devuelve { errores, permisos, real }: `errores` son fallos que impiden operar (uso inválido);
 * `permisos` es true si el modo permite acceso a grupo u otros.
 */
export function validarDirectorio(dir, raizRepo) {
  const errores = [];
  if (typeof dir !== 'string' || dir === '') {
    return { errores: ['no se indicó el directorio de respaldos'], permisos: false, real: null };
  }
  if (dir.includes('\0') || !path.isAbsolute(dir)) {
    return {
      errores: ['el directorio de respaldos debe ser una ruta absoluta'],
      permisos: false,
      real: null,
    };
  }
  let st;
  try {
    st = lstatSync(dir);
  } catch {
    return {
      errores: ['el directorio de respaldos no existe o no es accesible'],
      permisos: false,
      real: null,
    };
  }
  if (st.isSymbolicLink()) {
    return {
      errores: ['el directorio de respaldos no puede ser un enlace simbólico'],
      permisos: false,
      real: null,
    };
  }
  if (!st.isDirectory()) {
    return { errores: ['la ruta de respaldos no es un directorio'], permisos: false, real: null };
  }
  let real;
  try {
    real = realpathSync(dir);
    const repoReal = realpathSync(raizRepo);
    if (dentroDe(repoReal, real) || dentroDe(real, repoReal)) {
      errores.push(
        'el directorio de respaldos no puede estar dentro del repositorio (ni contenerlo)',
      );
    }
  } catch {
    errores.push('no se pudo resolver la ubicación del directorio de respaldos');
  }
  const permisos = (st.mode & 0o077) !== 0;
  return { errores, permisos, real: errores.length > 0 ? null : real };
}

/** Lee y analiza el registro. Devuelve { activos: Map, bajas: Set, malformadas: number[] }. */
export function leerRegistro(real) {
  const resultado = {
    activos: new Map(),
    bajas: new Set(),
    malformadas: [],
    existe: false,
    invalido: false,
  };
  const ruta = path.join(real, NOMBRE_REGISTRO);
  let st;
  try {
    st = lstatSync(ruta);
  } catch {
    return resultado;
  }
  resultado.existe = true;
  if (!st.isFile()) {
    resultado.invalido = true;
    return resultado;
  }
  const lineas = readFileSync(ruta, 'utf8').split('\n');
  lineas.forEach((linea, i) => {
    if (linea.trim() === '') return;
    const campos = linea.split('\t');
    if (campos.length !== 4) {
      resultado.malformadas.push(i + 1);
    } else if (campos[1] === 'baja') {
      resultado.bajas.add(campos[0]);
    } else if (/^[0-9a-f]{64}$/.test(campos[1])) {
      resultado.activos.set(campos[0], { sha256: campos[1], creado: campos[2], vence: campos[3] });
    } else {
      resultado.malformadas.push(i + 1);
    }
  });
  return resultado;
}

// ---------------------------------------------------------------- acceso al sistema de archivos

/** SHA-256 en streaming; nunca expone el contenido. */
export function hashArchivo(ruta) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const flujo = createReadStream(ruta);
    flujo.on('error', reject);
    flujo.on('data', (trozo) => h.update(trozo));
    flujo.on('end', () => resolve(h.digest('hex')));
  });
}

function nombreVisible(nombre) {
  const limpio = nombre.replace(/[^A-Za-z0-9._-]/g, '?');
  return limpio.length > 60 ? `${limpio.slice(0, 60)}...` : limpio;
}

function modoAbierto(ruta) {
  try {
    return (lstatSync(ruta).mode & 0o077) !== 0;
  } catch {
    return false;
  }
}

/** Audita el directorio ya validado. Solo lectura. */
export async function auditarDirectorio(real, hoy) {
  const filas = [];
  const registro = leerRegistro(real);
  const vistos = new Set();
  const entradas = readdirSync(real).sort();

  for (const nombre of entradas) {
    if (nombre === NOMBRE_REGISTRO) {
      if (registro.invalido) {
        filas.push({
          nombre: NOMBRE_REGISTRO,
          estado: 'ERROR',
          dias: null,
          notas: ['el registro no es un archivo regular'],
        });
      } else if (registro.existe && modoAbierto(path.join(real, nombre))) {
        filas.push({
          nombre: NOMBRE_REGISTRO,
          estado: 'AVISO',
          dias: null,
          notas: ['permisos del archivo demasiado abiertos (se recomienda 0600)'],
        });
      }
      continue;
    }
    vistos.add(nombre);
    let st;
    try {
      st = lstatSync(path.join(real, nombre));
    } catch {
      filas.push({
        nombre: nombreVisible(nombre),
        estado: 'ERROR',
        dias: null,
        notas: ['no se pudo leer la entrada'],
      });
      continue;
    }
    if (!st.isFile()) {
      const tipo = st.isSymbolicLink()
        ? 'enlace simbólico'
        : st.isDirectory()
          ? 'directorio'
          : 'entrada especial';
      filas.push({
        nombre: nombreVisible(nombre),
        estado: 'ERROR',
        dias: null,
        notas: [`${tipo}: no es un archivo regular (no se sigue)`],
      });
      continue;
    }
    const info = analizarNombre(nombre);
    if (!info) {
      filas.push({
        nombre: nombreVisible(nombre),
        estado: 'ERROR',
        dias: null,
        notas: ['el nombre no cumple el patrón obligatorio'],
      });
      continue;
    }
    const ev = evaluarFechas(info, hoy);
    let estado = ev.estado;
    const notas = [...ev.notas];
    const elevar = (nuevo) => {
      if (SEVERIDAD[nuevo] > SEVERIDAD[estado]) estado = nuevo;
    };
    if ((st.mode & 0o077) !== 0) {
      elevar('AVISO');
      notas.push('permisos del archivo demasiado abiertos (se recomienda 0600)');
    }
    const reg = registro.activos.get(nombre);
    if (!reg) {
      elevar('AVISO');
      notas.push('sin línea en el registro');
    } else {
      try {
        const sha = await hashArchivo(path.join(real, nombre));
        if (sha !== reg.sha256) {
          elevar('ERROR');
          notas.push('el hash no coincide con el registro');
        }
      } catch {
        elevar('ERROR');
        notas.push('no se pudo calcular el hash');
      }
    }
    filas.push({ nombre, estado, dias: ev.dias, notas });
  }

  for (const nombre of registro.activos.keys()) {
    if (!vistos.has(nombre) && !registro.bajas.has(nombre)) {
      filas.push({
        nombre: nombreVisible(nombre),
        estado: 'AVISO',
        dias: null,
        notas: ['registrado pero el archivo no existe'],
      });
    }
  }
  for (const n of registro.malformadas) {
    filas.push({
      nombre: `${NOMBRE_REGISTRO}:${n}`,
      estado: 'ERROR',
      dias: null,
      notas: ['línea del registro malformada'],
    });
  }
  return filas;
}

function formatearFila(f) {
  let dias = '';
  if (f.dias !== null) {
    dias = f.dias >= 0 ? `quedan ${f.dias} d` : `vencido hace ${-f.dias} d`;
  }
  return [f.nombre, f.estado, dias, f.notas.join('; ')].filter((x) => x !== '').join(' | ');
}

function resumir(filas) {
  const cuenta = { OK: 0, AVISO: 0, 'VENCE HOY': 0, VENCIDO: 0, ERROR: 0 };
  for (const f of filas) cuenta[f.estado] += 1;
  const partes = Object.entries(cuenta).map(([k, v]) => `${v} ${k}`);
  return { cuenta, texto: `Resumen: ${filas.length} entrada(s): ${partes.join(', ')}.` };
}

/** Clasifica un archivo para la purga, de forma independiente del hash. */
export function clasificarParaPurga(real, nombre, hoy) {
  if (!esNombreSeguro(nombre)) return { purgable: false, razon: 'nombre no permitido' };
  const info = analizarNombre(nombre);
  const ruta = path.join(real, nombre);
  let st;
  try {
    st = lstatSync(ruta);
  } catch {
    return { purgable: false, razon: 'no existe' };
  }
  if (!st.isFile()) return { purgable: false, razon: 'no es un archivo regular' };
  let rutaReal;
  try {
    rutaReal = realpathSync(ruta);
  } catch {
    return { purgable: false, razon: 'no se pudo resolver' };
  }
  if (path.dirname(rutaReal) !== real)
    return { purgable: false, razon: 'fuera del directorio autorizado' };
  if (!(hoy > vencimientoEfectivo(info))) return { purgable: false, razon: 'no vencido' };
  return { purgable: true, razon: '', ruta };
}

function agregarLinea(real, linea) {
  const ruta = path.join(real, NOMBRE_REGISTRO);
  let prefijo = '';
  try {
    const lectura = openSync(ruta, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const contenido = readFileSync(lectura, 'utf8');
      if (contenido !== '' && !contenido.endsWith('\n')) prefijo = '\n';
    } finally {
      closeSync(lectura);
    }
  } catch {
    // el registro aún no existe (o es un enlace: la apertura de escritura fallará): modo privado
  }
  // O_NOFOLLOW: nunca se sigue un enlace simbólico al escribir el registro.
  const fd = openSync(
    ruta,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeSync(fd, `${prefijo}${linea}\n`);
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------- comandos

export async function comandoAuditar(real, { hoy, permisos, out }) {
  const filas = await auditarDirectorio(real, hoy);
  if (permisos) {
    filas.unshift({
      nombre: '(directorio)',
      estado: 'ERROR',
      dias: null,
      notas: [
        'permisos demasiado abiertos: debe ser sin acceso para grupo/otros (p. ej. 0700); este script no los cambia',
      ],
    });
  }
  for (const f of filas) out(formatearFila(f));
  const { cuenta, texto } = resumir(filas);
  out(texto);
  return cuenta.ERROR > 0 || cuenta.VENCIDO > 0 ? 1 : 0;
}

export async function comandoRegistrar(real, nombre, { hoy, out, err }) {
  if (!esNombreSeguro(nombre ?? '')) {
    err(
      'Error: indique solo un nombre de archivo válido (respaldo-<db>-<AAAAMMDD>-vence-<AAAAMMDD>.sql), sin rutas.',
    );
    return 2;
  }
  const info = analizarNombre(nombre);
  const ev = evaluarFechas(info, hoy);
  if (ev.estado === 'ERROR') {
    err(`Error: ${ev.notas.join('; ')}. No se registra.`);
    return 1;
  }
  let st;
  try {
    st = lstatSync(path.join(real, nombre));
  } catch {
    err('Error: el archivo no existe en el directorio de respaldos.');
    return 1;
  }
  if (!st.isFile()) {
    err('Error: la entrada no es un archivo regular.');
    return 1;
  }
  const registro = leerRegistro(real);
  if (registro.invalido) {
    err('Error: el registro no es un archivo regular.');
    return 1;
  }
  if (registro.activos.has(nombre) || registro.bajas.has(nombre)) {
    err('Error: ese nombre ya consta en el registro; no se sobrescribe.');
    return 1;
  }
  const sha = await hashArchivo(path.join(real, nombre));
  try {
    agregarLinea(real, [nombre, sha, info.creadoTexto, info.venceTexto].join('\t'));
  } catch {
    err('Error: no se pudo escribir en el registro (¿no es un archivo regular?). No se registra.');
    return 1;
  }
  out(`Registrado: ${nombre}`);
  return 0;
}

export function comandoPurgar(real, { hoy, confirmado, ahora, out, err = () => {} }) {
  if (leerRegistro(real).invalido) {
    err('Error: el registro no es un archivo regular; no se elimina nada.');
    return 1;
  }
  const candidatos = [];
  for (const nombre of readdirSync(real).sort()) {
    if (nombre === NOMBRE_REGISTRO) continue;
    const c = clasificarParaPurga(real, nombre, hoy);
    if (c.purgable) candidatos.push(nombre);
  }
  out(`Respaldos vencidos candidatos a eliminar: ${candidatos.length}`);
  for (const n of candidatos) out(`  - ${n}`);
  if (!confirmado) {
    out(`Simulación: no se eliminó nada. Para eliminar use ${BANDERA_PURGA}`);
    return 0;
  }
  const fechaBaja = ahora.toISOString().slice(0, 10).replaceAll('-', '');
  let eliminados = 0;
  let fallos = 0;
  for (const nombre of candidatos) {
    // Se vuelve a verificar justo antes de borrar.
    const c = clasificarParaPurga(real, nombre, hoy);
    if (!c.purgable) {
      fallos += 1;
      out(`  Omitido: ${nombre} (${c.razon})`);
      continue;
    }
    try {
      unlinkSync(c.ruta);
    } catch {
      fallos += 1;
      out(`  Error al eliminar: ${nombre}`);
      continue;
    }
    eliminados += 1;
    try {
      agregarLinea(real, [nombre, 'baja', fechaBaja, '-'].join('\t'));
    } catch {
      fallos += 1;
      out(`  Eliminado, pero no se pudo registrar la baja: ${nombre}`);
    }
  }
  out(`Eliminados: ${eliminados}. Omitidos o con error: ${fallos}.`);
  out(
    'Aviso: es un borrado operativo (se quitó el archivo del directorio). No se garantiza el borrado ' +
      'físico irrecuperable en SSD, WSL2 ni en copias, instantáneas o papelera que existan fuera de este directorio.',
  );
  return fallos > 0 ? 1 : 0;
}

export const AYUDA = `Uso: node scripts/respaldos-d1.js [auditar|registrar|purgar] [opciones]

Subcomandos:
  auditar                 (predeterminado) revisa los respaldos; solo lectura.
  registrar <nombre>      agrega al registro el hash de un respaldo del directorio (solo el nombre).
  purgar                  simula la eliminación de respaldos vencidos; con
                          ${BANDERA_PURGA}
                          los elimina (borrado operativo, sin garantía de borrado físico).

Opciones:
  --dir <ruta>            directorio privado de respaldos (ruta absoluta, fuera del repositorio,
                          sin acceso para grupo/otros). Alternativa: variable ${VARIABLE_DIR}.
                          Ejemplo ficticio: --dir /ruta/privada/respaldos
  --help                  muestra esta ayuda.

Nombre obligatorio: respaldo-<db>-<AAAAMMDD>-vence-<AAAAMMDD>.sql (fechas UTC).
Retención máxima ${RETENCION_MAXIMA} días naturales; objetivo recomendado ${RETENCION_OBJETIVO}.
Un respaldo se considera vencido al superar el menor entre su "vence" y creación + ${RETENCION_MAXIMA} días.
Un archivo con nombre ajeno al patrón nunca se purga ni se cuenta como respaldo (comportamiento
seguro; auditar lo señala como ERROR). El borrado es operativo (unlink), no físico.
Códigos de salida: 0 correcto; 1 hay VENCIDO o ERROR (auditar), el registro no es un archivo
regular o falló una operación; 2 uso, directorio inválido o permisos del directorio demasiado
abiertos al registrar o purgar (auditar los señala como ERROR con código 1).
No se ejecuta nada de forma automática y nunca se imprime el contenido de los respaldos.`;

/** Analiza los argumentos. Pura. */
export function parsearArgumentos(argv) {
  const r = {
    subcomando: null,
    dir: null,
    ayuda: false,
    confirmado: false,
    posicionales: [],
    error: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') r.ayuda = true;
    else if (a === '--dir') {
      i += 1;
      if (i >= argv.length) r.error = 'falta el valor de --dir';
      else r.dir = argv[i];
    } else if (a.startsWith('--dir=')) r.dir = a.slice('--dir='.length);
    else if (a === BANDERA_PURGA) r.confirmado = true;
    else if (a.startsWith('--')) r.error = `opción desconocida: ${nombreVisible(a.split('=')[0])}`;
    else if (r.subcomando === null) r.subcomando = a;
    else r.posicionales.push(a);
  }
  if (r.subcomando === null) r.subcomando = 'auditar';
  return r;
}

/** Punto de entrada probable sin shell: devuelve el código de salida. */
export async function main(argv, opciones = {}) {
  const {
    env = {},
    repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    ahora = new Date(),
    out = (t) => console.log(t),
    err = (t) => console.error(t),
  } = opciones;
  const args = parsearArgumentos(argv);
  if (args.ayuda) {
    out(AYUDA);
    return 0;
  }
  if (args.error || !['auditar', 'registrar', 'purgar'].includes(args.subcomando)) {
    err(
      `Error: ${args.error ?? `subcomando desconocido: ${nombreVisible(args.subcomando)}`}. Use --help.`,
    );
    return 2;
  }
  const maxPos = args.subcomando === 'registrar' ? 1 : 0;
  if (args.posicionales.length > maxPos) {
    err('Error: argumentos sobrantes. Use --help.');
    return 2;
  }
  const dir = args.dir ?? env[VARIABLE_DIR];
  const v = validarDirectorio(dir, repoRoot);
  if (v.errores.length > 0) {
    for (const e of v.errores) err(`Error: ${e}.`);
    err(`Indique --dir <ruta> o la variable ${VARIABLE_DIR}.`);
    return 2;
  }
  const hoy = diaUtc(ahora);
  if (args.subcomando === 'auditar') {
    return comandoAuditar(v.real, { hoy, permisos: v.permisos, out });
  }
  if (v.permisos) {
    err(
      'Error: permisos del directorio demasiado abiertos (se exige sin acceso para grupo/otros). No se opera.',
    );
    return 2;
  }
  if (args.subcomando === 'registrar') {
    return comandoRegistrar(v.real, args.posicionales[0], { hoy, out, err });
  }
  return comandoPurgar(v.real, { hoy, confirmado: args.confirmado, ahora, out, err });
}

const esPrincipal =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esPrincipal) {
  main(process.argv.slice(2), { env: process.env }).then(
    (codigo) => process.exit(codigo),
    () => {
      console.error('Error inesperado.');
      process.exit(2);
    },
  );
}
