// Verifica una versión del Worker de PROD antes y después de activarla (docs/006, docs/011) y
// valida la protección del Environment de GitHub `production-activate`. Solo lectura local:
// trabaja con archivos JSON ya descargados por el workflow; no contacta con Cloudflare ni con
// GitHub y no necesita credenciales.
//
// Uso:
//   node scripts/verificar-version-prod.js --modo preparar|activar|activa \
//     --config api/wrangler.jsonc --version version.json --deployment deployment.json \
//     --id <UUID> [--sha <SHA de 40 hex>]
//   node scripts/verificar-version-prod.js --entorno entorno.json
//
// - `--version`: salida de `wrangler versions view <id> --json`.
// - `--deployment`: salida de `wrangler deployments status --json`.
// - `--entorno`: respuesta de `GET /repos/{repo}/environments/{name}` de la API de GitHub.
//
// Seguridad de la salida: solo se imprimen nombres y tipos de binding y mensajes. Nunca se
// imprimen valores de variables ni de secretos: de los valores solo se informa «coincide» o
// «no coincide».
//
// Códigos de salida: 0 correcto, 1 verificación fallida (incluye «no se pudo verificar»),
// 2 uso inválido.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MODOS = ['preparar', 'activar', 'activa'];
export const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const PATRON_SHA = /^[0-9a-f]{40}$/;
export const PREFIJO_MARCADOR = 'REEMPLAZAR_';
export const BINDINGS_ESPERADOS = [
  'DB',
  'JWT_SECRET',
  'GOOGLE_WEB_CLIENT_ID',
  'GOOGLE_ANDROID_CLIENT_IDS',
];

// ---------------------------------------------------------------- lectura de archivos

/**
 * Convierte texto JSONC (comentarios y comas finales) en JSON estándar sin tocar el contenido
 * de las cadenas. Duplica lo mínimo del formato que usa api/wrangler.jsonc.
 */
export function quitarJsonc(texto) {
  let sinComentarios = '';
  let enCadena = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    const siguiente = texto[i + 1];
    if (enCadena) {
      sinComentarios += c;
      if (c === '\\') {
        sinComentarios += siguiente ?? '';
        i += 1;
      } else if (c === '"') {
        enCadena = false;
      }
    } else if (c === '"') {
      enCadena = true;
      sinComentarios += c;
    } else if (c === '/' && siguiente === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      sinComentarios += '\n';
    } else if (c === '/' && siguiente === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i += 1;
      i += 1;
    } else {
      sinComentarios += c;
    }
  }
  let resultado = '';
  enCadena = false;
  for (let i = 0; i < sinComentarios.length; i += 1) {
    const c = sinComentarios[i];
    if (enCadena) {
      resultado += c;
      if (c === '\\') {
        resultado += sinComentarios[i + 1] ?? '';
        i += 1;
      } else if (c === '"') {
        enCadena = false;
      }
    } else if (c === '"') {
      enCadena = true;
      resultado += c;
    } else if (c === ',') {
      let j = i + 1;
      while (j < sinComentarios.length && /\s/.test(sinComentarios[j])) j += 1;
      if (sinComentarios[j] !== '}' && sinComentarios[j] !== ']') resultado += c;
    } else {
      resultado += c;
    }
  }
  return resultado;
}

/**
 * Lee un archivo JSON (o JSONC). Devuelve `{ datos }` o `{ error }`. Un archivo ilegible, vacío
 * o con JSON inválido es «no se pudo verificar», distinto de «ausente».
 */
export function leerJson(ruta, { jsonc = false, leer = readFileSync } = {}) {
  let texto;
  try {
    texto = leer(ruta, 'utf8');
  } catch {
    return { error: `NO SE PUDO VERIFICAR: no se pudo leer el archivo ${ruta}.` };
  }
  if (typeof texto !== 'string' || texto.trim() === '') {
    return { error: `NO SE PUDO VERIFICAR: el archivo ${ruta} está vacío.` };
  }
  try {
    const datos = JSON.parse(jsonc ? quitarJsonc(texto) : texto);
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      return { error: `NO SE PUDO VERIFICAR: el contenido de ${ruta} no es un objeto JSON.` };
    }
    return { datos };
  } catch {
    return { error: `NO SE PUDO VERIFICAR: ${ruta} no contiene JSON válido.` };
  }
}

// ---------------------------------------------------------------- funciones puras

/** Extrae de la configuración de wrangler lo que debe reflejar la versión de PROD. */
export function extraerEsperadoProd(config) {
  const prod = config?.env?.prod ?? {};
  const base = (prod.d1_databases ?? []).find((d) => d?.binding === 'DB');
  return {
    databaseId: base?.database_id,
    webClientId: prod.vars?.GOOGLE_WEB_CLIENT_ID,
    androidClientIds: prod.vars?.GOOGLE_ANDROID_CLIENT_IDS,
    compatibilityDate: prod.compatibility_date ?? config?.compatibility_date,
  };
}

function contieneMarcador(valor) {
  if (typeof valor === 'string') return /^\s*reemplazar_/i.test(valor);
  if (Array.isArray(valor)) return valor.some(contieneMarcador);
  if (valor && typeof valor === 'object') return Object.values(valor).some(contieneMarcador);
  return false;
}

/** Versión de un elemento de `deployments status --json` (acepta `version_id` o `id`). */
const idDeVersionDespliegue = (v) => String(v?.version_id ?? v?.id ?? '');

/** Comprueba los bindings de la versión contra lo esperado. No revela valores. */
function verificarBindings(version, esperado, errores) {
  const bindings = version?.resources?.bindings;
  if (!Array.isArray(bindings)) {
    errores.push('La versión no incluye la lista de bindings (resources.bindings).');
    return;
  }
  const porNombre = new Map();
  for (const b of bindings) {
    const nombre = String(b?.name ?? '');
    if (porNombre.has(nombre)) errores.push(`Binding duplicado: ${nombre}.`);
    porNombre.set(nombre, b);
  }
  for (const nombre of porNombre.keys()) {
    if (!BINDINGS_ESPERADOS.includes(nombre)) {
      errores.push(
        `Binding no esperado en la versión: ${nombre} (tipo ${porNombre.get(nombre)?.type}).`,
      );
    }
  }
  const requerir = (nombre, tipo) => {
    const b = porNombre.get(nombre);
    if (!b) {
      errores.push(`Falta el binding ${nombre} (tipo esperado ${tipo}).`);
      return null;
    }
    if (b.type !== tipo) {
      errores.push(`El binding ${nombre} tiene tipo «${b.type}»; se esperaba «${tipo}».`);
      return null;
    }
    return b;
  };
  const d1 = requerir('DB', 'd1');
  if (d1) {
    const id = d1.id ?? d1.database_id;
    if (!esperado.databaseId || id !== esperado.databaseId) {
      errores.push(
        'El binding DB (d1) no apunta a la base de PROD de wrangler.jsonc (no coincide).',
      );
    }
  }
  requerir('JWT_SECRET', 'secret_text');
  for (const [nombre, valorConfig] of [
    ['GOOGLE_WEB_CLIENT_ID', esperado.webClientId],
    ['GOOGLE_ANDROID_CLIENT_IDS', esperado.androidClientIds],
  ]) {
    const b = requerir(nombre, 'plain_text');
    if (b && (typeof valorConfig !== 'string' || b.text !== valorConfig)) {
      errores.push(`El valor de ${nombre} (plain_text) no coincide con wrangler.jsonc.`);
    }
  }
  if (contieneMarcador(bindings.map((b) => b?.text ?? b?.id ?? ''))) {
    errores.push(`Algún binding contiene un marcador «${PREFIJO_MARCADOR}*».`);
  }
}

/**
 * Evalúa una versión candidata o activa. Devuelve la lista de errores (vacía si cumple).
 * `modo`: `preparar` y `activar` exigen que la versión no tenga tráfico; `activa` exige que
 * reciba el 100 %.
 */
export function evaluarVersion({ version, deployment, config, id, sha, modo }) {
  const errores = [];
  if (!MODOS.includes(modo)) {
    errores.push(`Modo no válido: ${modo}.`);
    return errores;
  }
  if (typeof id !== 'string' || !PATRON_UUID.test(id)) {
    errores.push('El ID de versión esperado no es un UUID bien formado.');
    return errores;
  }
  const exigeSha = modo === 'preparar' || modo === 'activar';
  if (exigeSha && !sha) {
    errores.push(`El modo ${modo} exige --sha (SHA completo autorizado).`);
  } else if (sha && !PATRON_SHA.test(sha)) {
    errores.push('El SHA esperado no es un SHA completo de 40 caracteres hexadecimales.');
  }

  if (version?.id !== id) {
    errores.push('El ID de la versión leída no coincide con el ID esperado.');
  }
  const esperado = extraerEsperadoProd(config);
  verificarBindings(version, esperado, errores);

  const fecha = version?.resources?.script_runtime?.compatibility_date;
  if (!esperado.compatibilityDate || fecha !== esperado.compatibilityDate) {
    errores.push('La compatibility_date de la versión no coincide con wrangler.jsonc.');
  }

  if (sha) {
    const anotaciones = version?.annotations ?? {};
    const mensaje = anotaciones['workers/message'];
    if (typeof mensaje !== 'string' || !mensaje.includes(`prep ${sha} `)) {
      errores.push('La versión no fue preparada con el SHA autorizado (workers/message).');
    }
    if (anotaciones['workers/triggered_by'] !== 'version_upload') {
      errores.push('La versión no se originó con «version_upload» (workers/triggered_by).');
    }
  }

  const versiones = Array.isArray(deployment?.versions) ? deployment.versions : [];
  const porcentajesValidos =
    versiones.length > 0 &&
    versiones.every((v) => typeof v?.percentage === 'number' && Number.isFinite(v.percentage));
  if (!porcentajesValidos) {
    errores.push(
      'NO SE PUDO VERIFICAR: el despliegue no incluye una lista de versiones con porcentajes numéricos.',
    );
    return errores;
  }
  const entradas = versiones.filter((v) => idDeVersionDespliegue(v) === id);
  const conTrafico = entradas.filter((v) => Number(v.percentage) > 0);
  if (modo === 'activa') {
    if (!entradas.some((v) => Number(v.percentage) === 100)) {
      errores.push('La versión no aparece en el despliegue activo con el 100 % del tráfico.');
    }
  } else if (conTrafico.length > 0) {
    errores.push(
      modo === 'activar' && conTrafico.some((v) => Number(v.percentage) === 100)
        ? 'La versión ya es la activa (100 % del tráfico): no hay nada que activar.'
        : 'La versión ya recibe tráfico en un despliegue: debe estar sin tráfico.',
    );
  }
  return errores;
}

/**
 * Valida la respuesta de `GET /repos/{repo}/environments/{name}`: exige al menos una regla
 * `required_reviewers` con un revisor o más y una política de ramas (personalizada o solo
 * ramas protegidas).
 */
export function evaluarEntorno(entorno) {
  const errores = [];
  const reglas = Array.isArray(entorno?.protection_rules) ? entorno.protection_rules : [];
  const conRevisores = reglas.some(
    (r) => r?.type === 'required_reviewers' && Array.isArray(r.reviewers) && r.reviewers.length > 0,
  );
  if (!conRevisores) {
    errores.push('El Environment no tiene una regla required_reviewers con al menos 1 revisor.');
  }
  const politica = entorno?.deployment_branch_policy;
  if (
    !politica ||
    (politica.custom_branch_policies !== true && politica.protected_branches !== true)
  ) {
    errores.push(
      'El Environment no restringe las ramas (deployment_branch_policy sin ramas personalizadas ni protegidas).',
    );
  }
  return errores;
}

export function parsearArgumentos(argv) {
  const opciones = {};
  const conValor = {
    '--config': 'config',
    '--version': 'version',
    '--deployment': 'deployment',
    '--id': 'id',
    '--sha': 'sha',
    '--modo': 'modo',
    '--entorno': 'entorno',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const clave = conValor[argv[i]];
    if (!clave) return { error: `Argumento no reconocido: ${argv[i]}` };
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--')) {
      return { error: `Falta el valor después de ${argv[i]}.` };
    }
    opciones[clave] = valor;
    i += 1;
  }
  if (opciones.entorno) {
    const otras = Object.keys(opciones).filter((k) => k !== 'entorno');
    if (otras.length > 0) return { error: '--entorno no se combina con otras opciones.' };
    return { opciones };
  }
  if (!MODOS.includes(opciones.modo)) {
    return { error: `Falta --modo o no es válido (${MODOS.join('|')}).` };
  }
  for (const requerida of ['config', 'version', 'deployment', 'id']) {
    if (!opciones[requerida]) return { error: `Falta --${requerida}.` };
  }
  if (opciones.modo !== 'activa' && !opciones.sha) {
    return { error: `El modo ${opciones.modo} exige --sha.` };
  }
  return { opciones };
}

// ---------------------------------------------------------------- CLI

const USO =
  'Uso: node scripts/verificar-version-prod.js --modo preparar|activar|activa --config <wrangler.jsonc> ' +
  '--version <archivo> --deployment <archivo> --id <UUID> [--sha <SHA>]\n' +
  '     node scripts/verificar-version-prod.js --entorno <archivo>';

export function main(argv, salida = console, leer = readFileSync) {
  const { opciones, error } = parsearArgumentos(argv);
  if (error) {
    salida.error(`${error}\n${USO}`);
    return 2;
  }
  const fallos = (lista, resumen) => {
    for (const e of lista) salida.error(`ERROR: ${e}`);
    salida.error(resumen);
    return 1;
  };

  if (opciones.entorno) {
    const { datos, error: errLectura } = leerJson(opciones.entorno, { leer });
    if (errLectura)
      return fallos([errLectura], 'No se pudo verificar la protección del Environment.');
    const errores = evaluarEntorno(datos);
    if (errores.length > 0) {
      return fallos(errores, 'El Environment no está protegido: la fase ACTIVAR queda bloqueada.');
    }
    salida.log('El Environment tiene revisores requeridos y política de ramas.');
    return 0;
  }

  const lecturas = {
    config: leerJson(opciones.config, { jsonc: true, leer }),
    version: leerJson(opciones.version, { leer }),
    deployment: leerJson(opciones.deployment, { leer }),
  };
  const ilegibles = Object.values(lecturas)
    .filter((l) => l.error)
    .map((l) => l.error);
  if (ilegibles.length > 0) return fallos(ilegibles, 'No se pudo verificar la versión.');

  const errores = evaluarVersion({
    version: lecturas.version.datos,
    deployment: lecturas.deployment.datos,
    config: lecturas.config.datos,
    id: opciones.id,
    sha: opciones.sha,
    modo: opciones.modo,
  });
  if (errores.length > 0) {
    return fallos(
      errores,
      `La versión ${opciones.id} incumple ${errores.length} comprobación(es).`,
    );
  }
  salida.log(`Modo: ${opciones.modo}`);
  salida.log(`Bindings verificados: ${BINDINGS_ESPERADOS.join(', ')} (sin mostrar valores).`);
  salida.log(`La versión ${opciones.id} cumple todas las comprobaciones.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
