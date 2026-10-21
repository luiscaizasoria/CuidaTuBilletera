import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluarEntorno,
  evaluarVersion,
  leerJson,
  parsearArgumentos,
  quitarJsonc,
} from './verificar-version-prod.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'verificar-version-prod.js');
const base = mkdtempSync(path.join(tmpdir(), 'verif-version-'));
after(() => rmSync(base, { recursive: true, force: true }));

// Valores sintéticos (no son ids reales), salvo el UUID de DEV que se usa para el caso negativo.
const ID = '11111111-1111-4111-8111-111111111111';
const OTRO_ID = '22222222-2222-4222-8222-222222222222';
const SHA = 'a'.repeat(40);
const OTRO_SHA = 'b'.repeat(40);
const D1_PROD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const D1_DEV = 'ed52c4cb-a375-42a3-b0db-f1a2a4bab50a';
const WEB = '222-webprod.apps.googleusercontent.com';
const ANDROID = '222-androidprod.apps.googleusercontent.com';
const FECHA = '2026-10-01';

const config = () => ({
  compatibility_date: FECHA,
  env: {
    prod: {
      d1_databases: [{ binding: 'DB', database_name: 'controlgastos-db', database_id: D1_PROD }],
      vars: { GOOGLE_WEB_CLIENT_ID: WEB, GOOGLE_ANDROID_CLIENT_IDS: ANDROID },
    },
  },
});

const version = (cambios = {}) => ({
  id: ID,
  number: 7,
  metadata: { created_on: '2026-10-21T00:00:00Z', source: 'wrangler' },
  annotations: {
    'workers/tag': 'sha-aaaaaaa',
    'workers/message': `prep ${SHA} run 99`,
    'workers/triggered_by': 'version_upload',
  },
  resources: {
    script_runtime: { compatibility_date: FECHA, usage_model: 'standard' },
    bindings: [
      { name: 'DB', type: 'd1', id: D1_PROD, database_id: D1_PROD },
      { name: 'JWT_SECRET', type: 'secret_text' },
      { name: 'GOOGLE_WEB_CLIENT_ID', type: 'plain_text', text: WEB },
      { name: 'GOOGLE_ANDROID_CLIENT_IDS', type: 'plain_text', text: ANDROID },
    ],
  },
  ...cambios,
});

const sinTrafico = () => ({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  versions: [{ version_id: OTRO_ID, percentage: 100 }],
});
const activa = () => ({ versions: [{ version_id: ID, percentage: 100 }] });

const evaluar = (extra = {}) =>
  evaluarVersion({
    version: version(),
    deployment: sinTrafico(),
    config: config(),
    id: ID,
    sha: SHA,
    modo: 'preparar',
    ...extra,
  });

const conBindings = (fn) => {
  const v = version();
  v.resources.bindings = fn(v.resources.bindings);
  return v;
};

const cambiar = (nombre, cambios) => (lista) =>
  lista.map((b) => (b.name === nombre ? { ...b, ...cambios } : b));

describe('quitarJsonc y leerJson', () => {
  test('quita comentarios y comas finales sin tocar las cadenas', () => {
    const texto = '{ // c\n "a": "x//y,}", /* b */ "l": [1, 2,], }';
    assert.deepEqual(JSON.parse(quitarJsonc(texto)), { a: 'x//y,}', l: [1, 2] });
  });
  test('archivo inexistente, vacío o inválido es «no se pudo verificar»', () => {
    const vacio = path.join(base, 'vacio.json');
    const roto = path.join(base, 'roto.json');
    writeFileSync(vacio, '  \n');
    writeFileSync(roto, '{ no es json');
    for (const ruta of [path.join(base, 'no-existe.json'), vacio, roto]) {
      assert.match(leerJson(ruta).error, /NO SE PUDO VERIFICAR/);
    }
  });
});

describe('evaluarVersion: casos positivos', () => {
  test('candidata válida sin tráfico (preparar)', () => {
    assert.deepEqual(evaluar(), []);
  });
  test('candidata válida sin tráfico (activar)', () => {
    assert.deepEqual(evaluar({ modo: 'activar' }), []);
  });
  test('modo activa no exige --sha ni comprueba las anotaciones', () => {
    const v = version({ annotations: {} });
    assert.deepEqual(
      evaluar({ modo: 'activa', sha: undefined, version: v, deployment: activa() }),
      [],
    );
  });
  test('fixture fiel al formato real de wrangler (claves id, number, metadata, annotations, resources)', () => {
    const real = version();
    assert.deepEqual(Object.keys(real).sort(), [
      'annotations',
      'id',
      'metadata',
      'number',
      'resources',
    ]);
    assert.equal(real.annotations['workers/triggered_by'], 'version_upload');
    assert.deepEqual(evaluar({ version: real }), []);
  });
  test('modo activa correcto con el 100 %', () => {
    assert.deepEqual(evaluar({ modo: 'activa', deployment: activa() }), []);
  });
});

describe('evaluarVersion: casos negativos', () => {
  test('falta JWT_SECRET', () => {
    const v = conBindings((l) => l.filter((b) => b.name !== 'JWT_SECRET'));
    assert.match(evaluar({ version: v }).join('\n'), /Falta el binding JWT_SECRET/);
  });
  test('JWT_SECRET con tipo incorrecto', () => {
    const v = conBindings(cambiar('JWT_SECRET', { type: 'plain_text', text: 'x' }));
    assert.match(evaluar({ version: v }).join('\n'), /JWT_SECRET tiene tipo «plain_text»/);
  });
  test('D1 incorrecta (la de DEV)', () => {
    const v = conBindings(cambiar('DB', { id: D1_DEV }));
    assert.match(evaluar({ version: v }).join('\n'), /DB \(d1\) no apunta a la base de PROD/);
  });
  test('OAuth Web incorrecto', () => {
    const v = conBindings(
      cambiar('GOOGLE_WEB_CLIENT_ID', { text: '111-otro.apps.googleusercontent.com' }),
    );
    assert.match(evaluar({ version: v }).join('\n'), /GOOGLE_WEB_CLIENT_ID.*no coincide/);
  });
  test('OAuth Android incorrecto', () => {
    const v = conBindings(
      cambiar('GOOGLE_ANDROID_CLIENT_IDS', { text: '111-dev.apps.googleusercontent.com' }),
    );
    assert.match(evaluar({ version: v }).join('\n'), /GOOGLE_ANDROID_CLIENT_IDS.*no coincide/);
  });
  test('binding extra', () => {
    const v = conBindings((l) => [...l, { name: 'EXTRA', type: 'plain_text', text: 'x' }]);
    assert.match(evaluar({ version: v }).join('\n'), /Binding no esperado en la versión: EXTRA/);
  });
  test('marcador REEMPLAZAR_ en un binding', () => {
    const v = conBindings(cambiar('GOOGLE_WEB_CLIENT_ID', { text: 'REEMPLAZAR_CLIENTE' }));
    assert.match(evaluar({ version: v }).join('\n'), /marcador «REEMPLAZAR_\*»/);
  });
  test('ID de versión distinto del esperado', () => {
    assert.match(
      evaluar({ version: version({ id: OTRO_ID }) }).join('\n'),
      /no coincide con el ID esperado/,
    );
  });
  test('ID esperado mal formado', () => {
    assert.match(evaluar({ id: 'no-es-uuid' }).join('\n'), /no es un UUID/);
  });
  test('SHA esperado mal formado', () => {
    assert.match(evaluar({ sha: 'abc123' }).join('\n'), /SHA completo/);
  });
  test('SHA no autorizado', () => {
    assert.match(evaluar({ sha: OTRO_SHA }).join('\n'), /SHA autorizado/);
  });
  test('mensaje sin el espacio final del SHA no se acepta', () => {
    const v = version({
      annotations: { 'workers/message': `prep ${SHA}`, 'workers/triggered_by': 'version_upload' },
    });
    assert.match(evaluar({ version: v }).join('\n'), /SHA autorizado/);
  });
  test('versión no originada con version_upload', () => {
    const v = version({
      annotations: { 'workers/message': `prep ${SHA} run 1`, 'workers/triggered_by': 'deployment' },
    });
    assert.match(evaluar({ version: v }).join('\n'), /version_upload/);
  });
  test('intento de activar una versión distinta de la verificada', () => {
    const errores = evaluar({ modo: 'activar', id: OTRO_ID, version: version() });
    assert.match(errores.join('\n'), /no coincide con el ID esperado/);
  });
  test('versión que ya tiene tráfico (preparar y activar)', () => {
    const parcial = {
      versions: [
        { version_id: ID, percentage: 10 },
        { version_id: OTRO_ID, percentage: 90 },
      ],
    };
    assert.match(evaluar({ deployment: parcial }).join('\n'), /ya recibe tráfico/);
    assert.match(evaluar({ modo: 'activar', deployment: parcial }).join('\n'), /ya recibe tráfico/);
  });
  test('activar una versión que ya es la activa', () => {
    assert.match(evaluar({ modo: 'activar', deployment: activa() }).join('\n'), /ya es la activa/);
  });
  test('compatibility_date distinta', () => {
    const v = version();
    v.resources.script_runtime.compatibility_date = '2025-01-01';
    assert.match(evaluar({ version: v }).join('\n'), /compatibility_date/);
  });
  test('modo activa incorrecto: otra versión al 100 % o tráfico parcial', () => {
    assert.match(evaluar({ modo: 'activa' }).join('\n'), /100 %/);
    const parcial = {
      versions: [
        { version_id: ID, percentage: 50 },
        { version_id: OTRO_ID, percentage: 50 },
      ],
    };
    assert.match(evaluar({ modo: 'activa', deployment: parcial }).join('\n'), /100 %/);
  });
  test('despliegue sin lista de versiones o con lista vacía: no se pudo verificar', () => {
    for (const modo of ['preparar', 'activar', 'activa']) {
      assert.match(evaluar({ modo, deployment: {} }).join('\n'), /NO SE PUDO VERIFICAR/);
      assert.match(
        evaluar({ modo, deployment: { versions: [] } }).join('\n'),
        /NO SE PUDO VERIFICAR/,
      );
    }
  });
  test('percentage ausente, null, vacío o no numérico: no se pudo verificar en todos los modos', () => {
    for (const modo of ['preparar', 'activar', 'activa']) {
      for (const percentage of [undefined, null, '', '100', 'abc', NaN]) {
        const entrada =
          percentage === undefined ? { version_id: ID } : { version_id: ID, percentage };
        const r = evaluar({ modo, deployment: { versions: [entrada] } }).join('\n');
        assert.match(r, /NO SE PUDO VERIFICAR/, `${modo} ${String(percentage)}`);
      }
    }
  });
  test('preparar y activar exigen --sha', () => {
    for (const modo of ['preparar', 'activar']) {
      assert.match(evaluar({ modo, sha: undefined }).join('\n'), /exige --sha/);
    }
  });
});

describe('evaluarEntorno', () => {
  const protegido = () => ({
    protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User' }] }],
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  });
  test('entorno protegido', () => {
    assert.deepEqual(evaluarEntorno(protegido()), []);
  });
  test('ramas protegidas también cumple', () => {
    const e = protegido();
    e.deployment_branch_policy = { protected_branches: true, custom_branch_policies: false };
    assert.deepEqual(evaluarEntorno(e), []);
  });
  test('sin revisores o con lista vacía falla', () => {
    assert.match(
      evaluarEntorno({ ...protegido(), protection_rules: [] }).join('\n'),
      /required_reviewers/,
    );
    const vacio = {
      ...protegido(),
      protection_rules: [{ type: 'required_reviewers', reviewers: [] }],
    };
    assert.match(evaluarEntorno(vacio).join('\n'), /required_reviewers/);
  });
  test('sin política de ramas falla', () => {
    assert.match(
      evaluarEntorno({ ...protegido(), deployment_branch_policy: null }).join('\n'),
      /ramas/,
    );
    const todas = { protected_branches: false, custom_branch_policies: false };
    assert.match(
      evaluarEntorno({ ...protegido(), deployment_branch_policy: todas }).join('\n'),
      /ramas/,
    );
  });
  test('entorno sin ninguna protección', () => {
    assert.equal(evaluarEntorno({}).length, 2);
  });
});

describe('parsearArgumentos', () => {
  test('requiere modo válido y archivos', () => {
    assert.ok(parsearArgumentos([]).error);
    assert.ok(parsearArgumentos(['--modo', 'otro']).error);
    assert.ok(parsearArgumentos(['--modo', 'preparar', '--id', ID]).error);
    assert.ok(parsearArgumentos(['--raro']).error);
    const comunes = ['--config', 'c', '--version', 'v', '--deployment', 'd', '--id', ID];
    assert.match(parsearArgumentos(['--modo', 'preparar', ...comunes]).error, /--sha/);
    assert.match(parsearArgumentos(['--modo', 'activar', ...comunes]).error, /--sha/);
    assert.ok(parsearArgumentos(['--modo', 'activa', ...comunes]).opciones);
    assert.ok(parsearArgumentos(['--entorno']).error);
    assert.ok(parsearArgumentos(['--entorno', 'e.json', '--id', ID]).error);
  });
});

describe('CLI', () => {
  let n = 0;
  function escribir(contenido) {
    n += 1;
    const ruta = path.join(base, `archivo-${n}.json`);
    writeFileSync(ruta, typeof contenido === 'string' ? contenido : JSON.stringify(contenido));
    return ruta;
  }
  function cli(args) {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: RAIZ, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
  }
  const argumentos = (v, d, modo = 'preparar') => [
    '--modo',
    modo,
    '--config',
    escribir(`// jsonc\n${JSON.stringify(config())}\n`),
    '--version',
    v,
    '--deployment',
    d,
    '--id',
    ID,
    '--sha',
    SHA,
  ];

  test('candidata válida: salida 0 y sin valores de bindings', () => {
    const r = cli(argumentos(escribir(version()), escribir(sinTrafico())));
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, new RegExp(WEB));
    assert.doesNotMatch(r.out, new RegExp(D1_PROD));
  });
  test('modo activa correcto', () => {
    const r = cli(argumentos(escribir(version()), escribir(activa()), 'activa'));
    assert.equal(r.code, 0, r.out);
  });
  test('un fallo no imprime valores de secretos', () => {
    const v = conBindings(cambiar('JWT_SECRET', { type: 'plain_text', text: 'valor-secreto-123' }));
    const r = cli(argumentos(escribir(v), escribir(sinTrafico())));
    assert.equal(r.code, 1, r.out);
    assert.doesNotMatch(r.out, /valor-secreto-123/);
  });
  test('archivo de versión vacío o JSON inválido: no se pudo verificar (1)', () => {
    for (const contenido of ['', '{ roto']) {
      const r = cli(argumentos(escribir(contenido), escribir(sinTrafico())));
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /NO SE PUDO VERIFICAR/);
    }
  });
  test('archivo de versión inexistente: no se pudo verificar (1)', () => {
    const r = cli(argumentos(path.join(base, 'nada.json'), escribir(sinTrafico())));
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /NO SE PUDO VERIFICAR/);
  });
  test('preparar sin --sha es uso inválido (2)', () => {
    const args = argumentos(escribir(version()), escribir(sinTrafico()));
    const sinSha = args.slice(0, args.indexOf('--sha'));
    assert.equal(cli(sinSha).code, 2);
  });
  test('uso inválido da 2', () => {
    assert.equal(cli(['--modo', 'preparar']).code, 2);
  });
  test('--entorno: protegido 0, sin protección 1, ilegible 1', () => {
    const ok = escribir({
      protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User' }] }],
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    });
    assert.equal(cli(['--entorno', ok]).code, 0);
    const r = cli(['--entorno', escribir({ protection_rules: [] })]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /ACTIVAR queda bloqueada/);
    assert.equal(cli(['--entorno', escribir('')]).code, 1);
  });
  test('la config real del repositorio se puede leer como JSONC', () => {
    const real = path.join(RAIZ, 'api', 'wrangler.jsonc');
    const r = leerJson(real, { jsonc: true });
    assert.ok(r.datos?.env?.prod, r.error);
  });
});
