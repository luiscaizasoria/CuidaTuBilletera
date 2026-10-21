// Verifica los invariantes de api/wrangler.jsonc (docs/011): nivel superior centinela, entorno
// DEV y entorno PROD separados. Solo lectura local: usa `unstable_readConfig` de wrangler,
// no contacta con Cloudflare ni necesita credenciales.
//
// Uso:
//   node scripts/verificar-config-wrangler.js [--config <ruta>] [--estricto]
//
// Modo normal: acepta los marcadores `REEMPLAZAR_*` (informa cuántos quedan).
// Modo --estricto (despliegue): exige valores definitivos y ningún marcador.
//
// Códigos de salida: 0 cumple, 1 incumple algún invariante, 2 uso inválido.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NOMBRE_CENTINELA = 'controlgastos-api-sin-entorno';
export const NOMBRE_PROD = 'controlgastos-api';
export const NOMBRE_DEV = 'controlgastos-api-dev';
export const D1_PROD = 'controlgastos-db';
export const D1_DEV = 'controlgastos-db-dev';
export const PREFIJO_MARCADOR = 'REEMPLAZAR_';
export const MAXIMO_IDS_ANDROID = 4;
export const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const PATRON_CLIENTE_GOOGLE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
export const PATRON_CLAVE_SOSPECHOSA = /SECRET|TOKEN|PASSWORD|PRIVATE|KEY/i;

// ---------------------------------------------------------------- funciones puras

const definido = (valor) => valor !== undefined && valor !== null;

function vacio(valor) {
  if (!definido(valor)) return true;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === 'object') return Object.keys(valor).length === 0;
  if (typeof valor === 'string') return valor === '';
  return false;
}

export const esMarcador = (valor) => typeof valor === 'string' && /^\s*reemplazar_/i.test(valor);

/** Cuenta los textos que empiezan por `REEMPLAZAR_` en cualquier parte de un valor. */
export function contarMarcadores(valor) {
  if (typeof valor === 'string') return esMarcador(valor) ? 1 : 0;
  if (Array.isArray(valor)) return valor.reduce((n, v) => n + contarMarcadores(v), 0);
  if (valor && typeof valor === 'object') {
    return Object.values(valor).reduce((n, v) => n + contarMarcadores(v), 0);
  }
  return 0;
}

/** Separa una lista de ids separados por comas, sin vacíos. */
export function separarIds(valor) {
  if (typeof valor !== 'string') return [];
  return valor
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
}

/** Separa por comas conservando los elementos vacíos (como hace la API). */
export function separarIdsSinFiltrar(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return [];
  return valor.split(',').map((id) => id.trim());
}

function idsAndroid(vars) {
  return [
    ...separarIds(vars?.GOOGLE_ANDROID_CLIENT_IDS),
    ...separarIds(vars?.GOOGLE_ANDROID_CLIENT_ID),
  ];
}

function verificarSuperior(superior, errores) {
  if (superior.name === NOMBRE_PROD) {
    errores.push(`Nivel superior: el nombre no puede ser «${NOMBRE_PROD}» (nombre de PROD).`);
  } else if (superior.name !== NOMBRE_CENTINELA) {
    errores.push(
      `Nivel superior: el nombre debe ser el centinela «${NOMBRE_CENTINELA}» (actual: «${superior.name}»).`,
    );
  }
  if (definido(superior.main)) errores.push('Nivel superior: no debe definir `main`.');
  if (!vacio(superior.d1_databases)) {
    errores.push('Nivel superior: `d1_databases` debe estar vacío.');
  }
  if (!vacio(superior.vars)) errores.push('Nivel superior: no debe definir `vars`.');
  if (!vacio(superior.routes) || !vacio(superior.route)) {
    errores.push('Nivel superior: no debe definir `routes`.');
  }
  if (!vacio(superior.observability)) {
    errores.push('Nivel superior: no debe definir `observability`.');
  }
}

function verificarDev(dev, errores) {
  if (dev.name !== NOMBRE_DEV) {
    errores.push(`DEV: el nombre debe ser «${NOMBRE_DEV}» (actual: «${dev.name}»).`);
  }
  const d1 = dev.d1_databases ?? [];
  if (d1.length !== 1 || d1[0]?.database_name !== D1_DEV) {
    errores.push(`DEV: debe tener exactamente 1 D1 con database_name «${D1_DEV}».`);
  }
}

function verificarEstructuraProd(prod, errores) {
  if (prod.name !== NOMBRE_PROD) {
    errores.push(`PROD: el nombre debe ser «${NOMBRE_PROD}» (actual: «${prod.name}»).`);
  }
  if (!definido(prod.main) || prod.main === '') errores.push('PROD: falta `main`.');
  if (prod.workers_dev !== true) errores.push('PROD: `workers_dev` debe ser true.');
  if (prod.preview_urls !== false) errores.push('PROD: `preview_urls` debe ser false.');
  if (!vacio(prod.routes) || !vacio(prod.route)) errores.push('PROD: no debe definir `routes`.');
  if (!vacio(prod.triggers?.crons)) errores.push('PROD: no debe definir `triggers`.');
  if (definido(prod.account_id)) errores.push('PROD: no debe definir `account_id`.');
  if (!vacio(prod.observability)) errores.push('PROD: no debe definir `observability`.');
}

function verificarD1Prod(prod, dev, errores) {
  const d1 = prod.d1_databases ?? [];
  if (d1.length !== 1) {
    errores.push(`PROD: debe tener exactamente 1 D1 (actual: ${d1.length}).`);
    return;
  }
  const [base] = d1;
  if (base.binding !== 'DB') errores.push('PROD: la D1 debe tener binding «DB».');
  if (base.database_name !== D1_PROD) {
    errores.push(`PROD: la D1 debe tener database_name «${D1_PROD}».`);
  }
  if (base.migrations_dir !== 'migrations') {
    errores.push('PROD: la D1 debe tener migrations_dir «migrations».');
  }
  for (const baseDev of dev.d1_databases ?? []) {
    if (baseDev.database_name === base.database_name) {
      errores.push('PROD: database_name coincide con el de DEV.');
    }
    if (definido(baseDev.database_id) && baseDev.database_id === base.database_id) {
      errores.push('PROD: database_id coincide con el de DEV.');
    }
  }
}

function verificarVarsProd(prod, dev, errores) {
  const vars = prod.vars ?? {};
  for (const clave of ['GOOGLE_WEB_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_IDS']) {
    if (!definido(vars[clave]) || vars[clave] === '')
      errores.push(`PROD: falta la variable ${clave}.`);
  }
  if ('GOOGLE_ANDROID_CLIENT_ID' in vars) {
    errores.push('PROD: no debe existir GOOGLE_ANDROID_CLIENT_ID (usa GOOGLE_ANDROID_CLIENT_IDS).');
  }
  for (const [clave, valor] of Object.entries(vars)) {
    if (PATRON_CLAVE_SOSPECHOSA.test(clave)) {
      errores.push(
        `PROD: la variable «${clave}» tiene nombre de secreto; los secretos no van en vars.`,
      );
    }
    const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
    for (const prohibido of ['localhost', '127.0.0.1', '-dev']) {
      if (texto.includes(prohibido)) {
        errores.push(`PROD: el valor de «${clave}» contiene «${prohibido}».`);
      }
    }
  }
  const webProd = vars.GOOGLE_WEB_CLIENT_ID;
  const webDev = dev.vars?.GOOGLE_WEB_CLIENT_ID;
  if (definido(webProd) && webProd !== '' && webProd === webDev) {
    errores.push('PROD: GOOGLE_WEB_CLIENT_ID es el mismo que el de DEV.');
  }
  const androidDev = new Set(idsAndroid(dev.vars));
  const androidProd = separarIds(vars.GOOGLE_ANDROID_CLIENT_IDS);
  if (androidProd.some((id) => androidDev.has(id))) {
    errores.push('PROD: un id Android de PROD coincide con uno de DEV.');
  }
  if (typeof webProd === 'string' && webProd !== '' && androidDev.has(webProd)) {
    errores.push('PROD: GOOGLE_WEB_CLIENT_ID coincide con un id Android de DEV.');
  }
  if (typeof webDev === 'string' && webDev !== '' && androidProd.includes(webDev)) {
    errores.push('PROD: un id Android de PROD coincide con el cliente Web de DEV.');
  }
}

function verificarEstricto(superior, dev, prod, errores) {
  const [base] = prod.d1_databases ?? [];
  if (!PATRON_UUID.test(base?.database_id ?? '')) {
    errores.push('Estricto: PROD database_id debe ser un UUID válido.');
  }
  const vars = prod.vars ?? {};
  const web = vars.GOOGLE_WEB_CLIENT_ID;
  if (typeof web !== 'string' || !PATRON_CLIENTE_GOOGLE.test(web)) {
    errores.push(
      'Estricto: GOOGLE_WEB_CLIENT_ID de PROD no tiene el formato de un cliente de Google.',
    );
  }
  const ids = separarIdsSinFiltrar(vars.GOOGLE_ANDROID_CLIENT_IDS);
  if (ids.length === 0) errores.push('Estricto: GOOGLE_ANDROID_CLIENT_IDS de PROD está vacío.');
  if (ids.includes('')) {
    errores.push(
      'Estricto: GOOGLE_ANDROID_CLIENT_IDS contiene elementos vacíos (coma doble, inicial o final).',
    );
  }
  if (ids.length > MAXIMO_IDS_ANDROID) {
    errores.push(
      `Estricto: GOOGLE_ANDROID_CLIENT_IDS admite como máximo ${MAXIMO_IDS_ANDROID} ids.`,
    );
  }
  if (new Set(ids).size !== ids.length) {
    errores.push('Estricto: GOOGLE_ANDROID_CLIENT_IDS contiene ids duplicados.');
  }
  for (const id of ids) {
    if (!PATRON_CLIENTE_GOOGLE.test(id)) {
      errores.push('Estricto: un id Android de PROD no tiene el formato de un cliente de Google.');
      break;
    }
  }
  if (typeof web === 'string' && ids.includes(web)) {
    errores.push('Estricto: el id Web de PROD no puede estar en la lista de ids Android.');
  }
  const restantes = contarMarcadores(superior) + contarMarcadores(dev) + contarMarcadores(prod);
  if (restantes > 0) {
    errores.push(
      `Estricto: quedan ${restantes} marcadores «${PREFIJO_MARCADOR}*» en la configuración.`,
    );
  }
}

/**
 * Evalúa los tres entornos ya resueltos (`superior`, `dev`, `prod`).
 * Devuelve `{ errores, pendientes }`; no cumple si `errores` no está vacío.
 */
export function evaluarConfiguracion({ superior, dev, prod }, { estricto = false } = {}) {
  const errores = [];
  verificarSuperior(superior ?? {}, errores);
  verificarDev(dev ?? {}, errores);
  verificarEstructuraProd(prod ?? {}, errores);
  verificarD1Prod(prod ?? {}, dev ?? {}, errores);
  verificarVarsProd(prod ?? {}, dev ?? {}, errores);
  if (estricto) verificarEstricto(superior ?? {}, dev ?? {}, prod ?? {}, errores);
  const pendientes = contarMarcadores(superior) + contarMarcadores(dev) + contarMarcadores(prod);
  return { errores, pendientes };
}

export function parsearArgumentos(argv) {
  const opciones = { config: null, estricto: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--estricto') {
      opciones.estricto = true;
    } else if (arg === '--config') {
      const valor = argv[i + 1];
      if (!valor || valor.startsWith('--')) return { error: 'Falta la ruta después de --config.' };
      opciones.config = valor;
      i += 1;
    } else {
      return { error: `Argumento no reconocido: ${arg}` };
    }
  }
  return { opciones };
}

// ---------------------------------------------------------------- CLI

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_POR_DEFECTO = path.join(RAIZ, 'api', 'wrangler.jsonc');

export async function leerEntornos(rutaConfig) {
  const { unstable_readConfig: leer } = await import('wrangler');
  const resolver = (env) => leer({ config: rutaConfig, env }, { hideWarnings: true });
  return { superior: resolver(undefined), dev: resolver('dev'), prod: resolver('prod') };
}

export async function main(argv, salida = console, leer = leerEntornos) {
  const { opciones, error } = parsearArgumentos(argv);
  if (error) {
    salida.error(
      `${error}\nUso: node scripts/verificar-config-wrangler.js [--config <ruta>] [--estricto]`,
    );
    return 2;
  }
  const ruta = path.resolve(opciones.config ?? CONFIG_POR_DEFECTO);
  let entornos;
  try {
    entornos = await leer(ruta);
  } catch (e) {
    salida.error(`No se pudo leer la configuración de wrangler (${ruta}): ${e.message}`);
    return 1;
  }
  const { errores, pendientes } = evaluarConfiguracion(entornos, { estricto: opciones.estricto });
  salida.log(`Configuración: ${ruta}`);
  salida.log(`Modo: ${opciones.estricto ? 'estricto' : 'normal'}`);
  if (errores.length > 0) {
    for (const e of errores) salida.error(`ERROR: ${e}`);
    salida.error(`La configuración de wrangler incumple ${errores.length} invariante(s).`);
    return 1;
  }
  salida.log(`marcadores pendientes: ${pendientes}`);
  salida.log('La configuración de wrangler cumple los invariantes.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
