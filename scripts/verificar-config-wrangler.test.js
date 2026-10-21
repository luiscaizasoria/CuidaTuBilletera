import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contarMarcadores,
  evaluarConfiguracion,
  parsearArgumentos,
  separarIds,
} from './verificar-config-wrangler.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'verificar-config-wrangler.js');
const base = mkdtempSync(path.join(tmpdir(), 'verif-wrangler-'));
after(() => rmSync(base, { recursive: true, force: true }));

// Valores sintéticos (no son ids reales).
const WEB_DEV = '111-webdev.apps.googleusercontent.com';
const AND_DEV = '111-androiddev.apps.googleusercontent.com';
const WEB_PROD = '222-webprod.apps.googleusercontent.com';
const AND_PROD = '222-androidprod.apps.googleusercontent.com';
const UUID_DEV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_PROD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function configuracion({ superior = {}, dev = {}, prod = {}, definitivo = false } = {}) {
  const sup = { name: 'controlgastos-api-sin-entorno', compatibility_date: '2026-10-01' };
  const d = {
    name: 'controlgastos-api-dev',
    main: 'src/index.ts',
    workers_dev: true,
    preview_urls: false,
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'controlgastos-db-dev',
        database_id: UUID_DEV,
        migrations_dir: 'migrations',
      },
    ],
    vars: { GOOGLE_WEB_CLIENT_ID: WEB_DEV, GOOGLE_ANDROID_CLIENT_ID: AND_DEV },
  };
  const p = {
    name: 'controlgastos-api',
    main: 'src/index.ts',
    workers_dev: true,
    preview_urls: false,
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'controlgastos-db',
        database_id: definitivo ? UUID_PROD : 'REEMPLAZAR_CON_ID_D1_PROD',
        migrations_dir: 'migrations',
      },
    ],
    vars: {
      GOOGLE_WEB_CLIENT_ID: definitivo ? WEB_PROD : 'REEMPLAZAR_CON_CLIENTE_WEB_PROD',
      GOOGLE_ANDROID_CLIENT_IDS: definitivo ? AND_PROD : 'REEMPLAZAR_CON_CLIENTES_ANDROID_PROD',
    },
  };
  return { env: { dev: { ...d, ...dev }, prod: { ...p, ...prod } }, ...sup, ...superior };
}

let n = 0;
function escribir(cfg) {
  n += 1;
  const ruta = path.join(base, `wrangler-${n}.jsonc`);
  writeFileSync(ruta, `// sintética\n${JSON.stringify(cfg, null, 2)}\n`);
  return ruta;
}

function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: RAIZ, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function fallaCon(cfg, fragmento, args = []) {
  const r = cli(['--config', escribir(cfg), ...args]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, fragmento);
}

describe('funciones puras', () => {
  test('contarMarcadores recorre objetos y listas', () => {
    assert.equal(contarMarcadores({ a: 'REEMPLAZAR_X', b: ['REEMPLAZAR_Y', 'ok'], c: 3 }), 2);
  });
  test('separarIds descarta vacíos y espacios', () => {
    assert.deepEqual(separarIds(' a, b ,,c '), ['a', 'b', 'c']);
    assert.deepEqual(separarIds(undefined), []);
  });
  test('esMarcador ignora mayúsculas y espacios iniciales', () => {
    assert.equal(contarMarcadores(['reemplazar_x', '  REEMPLAZAR_Y', 'Reemplazar_Z', 'otro']), 3);
  });
  test('parsearArgumentos', () => {
    assert.deepEqual(parsearArgumentos(['--estricto', '--config', 'x']).opciones, {
      config: 'x',
      estricto: true,
    });
    assert.ok(parsearArgumentos(['--config']).error);
    assert.ok(parsearArgumentos(['--otra']).error);
  });
  test('evaluarConfiguracion acepta una configuración válida', () => {
    const c = configuracion();
    const r = evaluarConfiguracion({
      superior: { name: c.name },
      dev: c.env.dev,
      prod: c.env.prod,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.pendientes, 3);
  });
  test('evaluarConfiguracion informa varios errores a la vez', () => {
    const c = configuracion();
    const r = evaluarConfiguracion({
      superior: { name: 'controlgastos-api', main: 'x' },
      dev: c.env.dev,
      prod: { ...c.env.prod, workers_dev: false },
    });
    assert.ok(r.errores.length >= 3);
  });
});

describe('CLI: casos positivos', () => {
  test('configuración sintética con marcadores pasa en modo normal', () => {
    const r = cli(['--config', escribir(configuracion())]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /marcadores pendientes: 3/);
  });
  test('configuración sintética definitiva pasa en modo estricto', () => {
    const r = cli(['--config', escribir(configuracion({ definitivo: true })), '--estricto']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /marcadores pendientes: 0/);
  });
  test('varios ids Android válidos pasan en estricto', () => {
    const cfg = configuracion({
      definitivo: true,
      prod: {
        vars: {
          GOOGLE_WEB_CLIENT_ID: WEB_PROD,
          GOOGLE_ANDROID_CLIENT_IDS: `${AND_PROD}, 333-otro.apps.googleusercontent.com`,
        },
      },
    });
    assert.equal(cli(['--config', escribir(cfg), '--estricto']).code, 0);
  });
  test('api/wrangler.jsonc real pasa en modo normal sin marcadores pendientes', () => {
    const r = cli([]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /marcadores pendientes: 0/);
  });
  test('api/wrangler.jsonc real pasa en estricto sin marcadores', () => {
    const r = cli(['--estricto']);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /REEMPLAZAR_/);
  });
});

describe('CLI: uso inválido', () => {
  test('argumento desconocido devuelve 2', () => {
    assert.equal(cli(['--nada']).code, 2);
  });
  test('--config sin ruta devuelve 2', () => {
    assert.equal(cli(['--config']).code, 2);
  });
  test('archivo inexistente devuelve 1', () => {
    const r = cli(['--config', path.join(base, 'no-existe.jsonc')]);
    assert.equal(r.code, 1, r.out);
  });
});

describe('CLI: nivel superior', () => {
  test('main en el nivel superior', () =>
    fallaCon(
      configuracion({ superior: { main: 'src/index.ts' } }),
      /Nivel superior: no debe definir `main`/,
    ));
  test('nombre del nivel superior distinto del centinela', () =>
    fallaCon(configuracion({ superior: { name: 'otro' } }), /centinela/));
  test('nombre del nivel superior igual al de PROD', () =>
    fallaCon(configuracion({ superior: { name: 'controlgastos-api' } }), /nombre de PROD/));
  test('d1_databases en el nivel superior', () =>
    fallaCon(
      configuracion({
        superior: { d1_databases: [{ binding: 'DB', database_name: 'x', database_id: 'y' }] },
      }),
      /d1_databases.*vacío/,
    ));
  test('vars en el nivel superior', () =>
    fallaCon(configuracion({ superior: { vars: { A: '1' } } }), /no debe definir `vars`/));
  test('routes en el nivel superior', () =>
    fallaCon(
      configuracion({ superior: { routes: ['ejemplo.test/*'] } }),
      /no debe definir `routes`/,
    ));
  test('observability en el nivel superior', () =>
    fallaCon(configuracion({ superior: { observability: { enabled: true } } }), /observability/));
});

describe('CLI: DEV', () => {
  test('nombre de DEV incorrecto', () =>
    fallaCon(configuracion({ dev: { name: 'otro' } }), /DEV: el nombre/));
  test('D1 de DEV incorrecta', () =>
    fallaCon(
      configuracion({
        dev: { d1_databases: [{ binding: 'DB', database_name: 'x', database_id: UUID_DEV }] },
      }),
      /DEV: debe tener exactamente 1 D1/,
    ));
});

describe('CLI: PROD', () => {
  test('nombre de PROD incorrecto', () =>
    fallaCon(configuracion({ prod: { name: 'controlgastos-api-prod' } }), /PROD: el nombre/));
  test('falta main', () => fallaCon(configuracion({ prod: { main: undefined } }), /falta `main`/));
  test('workers_dev ausente', () =>
    fallaCon(configuracion({ prod: { workers_dev: undefined } }), /workers_dev/));
  test('preview_urls true', () =>
    fallaCon(configuracion({ prod: { preview_urls: true } }), /preview_urls/));
  test('routes en PROD', () =>
    fallaCon(
      configuracion({ prod: { routes: ['ejemplo.test/*'] } }),
      /PROD: no debe definir `routes`/,
    ));
  test('triggers en PROD', () =>
    fallaCon(configuracion({ prod: { triggers: { crons: ['0 * * * *'] } } }), /triggers/));
  test('account_id en PROD', () =>
    fallaCon(configuracion({ prod: { account_id: 'abc' } }), /account_id/));
  test('observability en PROD', () =>
    fallaCon(
      configuracion({ prod: { observability: { enabled: true } } }),
      /PROD: no debe definir `observability`/,
    ));
  test('dos D1 en PROD', () => {
    const c = configuracion();
    fallaCon(
      configuracion({
        prod: {
          d1_databases: [
            ...c.env.prod.d1_databases,
            { ...c.env.prod.d1_databases[0], binding: 'DB2' },
          ],
        },
      }),
      /exactamente 1 D1/,
    );
  });
  test('binding incorrecto', () => {
    const c = configuracion();
    fallaCon(
      configuracion({ prod: { d1_databases: [{ ...c.env.prod.d1_databases[0], binding: 'BD' }] } }),
      /binding/,
    );
  });
  test('migrations_dir incorrecto', () => {
    const c = configuracion();
    fallaCon(
      configuracion({
        prod: { d1_databases: [{ ...c.env.prod.d1_databases[0], migrations_dir: 'm' }] },
      }),
      /migrations_dir/,
    );
  });
  test('D1 de PROD igual a la de DEV', () => {
    const c = configuracion();
    fallaCon(configuracion({ prod: { d1_databases: c.env.dev.d1_databases } }), /database_name/);
  });
  test('database_id de PROD igual al de DEV', () => {
    const c = configuracion();
    fallaCon(
      configuracion({
        prod: { d1_databases: [{ ...c.env.prod.d1_databases[0], database_id: UUID_DEV }] },
      }),
      /database_id coincide/,
    );
  });
  test('GOOGLE_ANDROID_CLIENT_ID presente en PROD', () => {
    const c = configuracion();
    fallaCon(
      configuracion({ prod: { vars: { ...c.env.prod.vars, GOOGLE_ANDROID_CLIENT_ID: AND_PROD } } }),
      /GOOGLE_ANDROID_CLIENT_ID \(usa/,
    );
  });
  test('falta GOOGLE_WEB_CLIENT_ID', () =>
    fallaCon(
      configuracion({ prod: { vars: { GOOGLE_ANDROID_CLIENT_IDS: AND_PROD } } }),
      /falta la variable GOOGLE_WEB_CLIENT_ID/,
    ));
  test('falta GOOGLE_ANDROID_CLIENT_IDS', () =>
    fallaCon(
      configuracion({ prod: { vars: { GOOGLE_WEB_CLIENT_ID: WEB_PROD } } }),
      /falta la variable GOOGLE_ANDROID_CLIENT_IDS/,
    ));
  for (const clave of ['API_SECRET', 'TOKEN_X', 'DB_PASSWORD', 'PRIVATE_Z', 'JWT_KEY']) {
    test(`clave sospechosa ${clave}`, () => {
      const c = configuracion();
      fallaCon(
        configuracion({ prod: { vars: { ...c.env.prod.vars, [clave]: 'x' } } }),
        /nombre de secreto/,
      );
    });
  }
  for (const valor of ['http://localhost:8787', 'http://127.0.0.1', 'abc-dev.workers.dev']) {
    test(`valor prohibido ${valor}`, () => {
      const c = configuracion();
      fallaCon(configuracion({ prod: { vars: { ...c.env.prod.vars, OTRA: valor } } }), /contiene/);
    });
  }
  test('id Web de PROD igual al de DEV', () =>
    fallaCon(
      configuracion({
        prod: { vars: { GOOGLE_WEB_CLIENT_ID: WEB_DEV, GOOGLE_ANDROID_CLIENT_IDS: AND_PROD } },
      }),
      /mismo que el de DEV/,
    ));
  test('id Android de PROD presente en DEV', () =>
    fallaCon(
      configuracion({
        prod: {
          vars: {
            GOOGLE_WEB_CLIENT_ID: WEB_PROD,
            GOOGLE_ANDROID_CLIENT_IDS: `${AND_PROD},${AND_DEV}`,
          },
        },
      }),
      /id Android de PROD coincide/,
    ));
});

describe('CLI: comparaciones cruzadas PROD/DEV', () => {
  test('id Web de PROD igual a un id Android de DEV (variable heredada)', () =>
    fallaCon(
      configuracion({
        prod: { vars: { GOOGLE_WEB_CLIENT_ID: AND_DEV, GOOGLE_ANDROID_CLIENT_IDS: AND_PROD } },
      }),
      /WEB_CLIENT_ID coincide con un id Android de DEV/,
    ));
  test('id Web de PROD igual a un id de GOOGLE_ANDROID_CLIENT_IDS de DEV', () =>
    fallaCon(
      configuracion({
        dev: { vars: { GOOGLE_WEB_CLIENT_ID: WEB_DEV, GOOGLE_ANDROID_CLIENT_IDS: AND_DEV } },
        prod: { vars: { GOOGLE_WEB_CLIENT_ID: AND_DEV, GOOGLE_ANDROID_CLIENT_IDS: AND_PROD } },
      }),
      /WEB_CLIENT_ID coincide con un id Android de DEV/,
    ));
  test('id Android de PROD igual al cliente Web de DEV', () =>
    fallaCon(
      configuracion({
        prod: { vars: { GOOGLE_WEB_CLIENT_ID: WEB_PROD, GOOGLE_ANDROID_CLIENT_IDS: WEB_DEV } },
      }),
      /coincide con el cliente Web de DEV/,
    ));
});

describe('CLI: modo estricto', () => {
  const definitivo = (prod) => configuracion({ definitivo: true, prod });
  const vars = (v) => ({
    vars: { GOOGLE_WEB_CLIENT_ID: WEB_PROD, GOOGLE_ANDROID_CLIENT_IDS: AND_PROD, ...v },
  });
  test('marcadores pendientes fallan', () =>
    fallaCon(configuracion(), /quedan \d+ marcadores/, ['--estricto']));
  test('database_id que no es UUID', () => {
    const c = configuracion({ definitivo: true });
    fallaCon(
      definitivo({ d1_databases: [{ ...c.env.prod.d1_databases[0], database_id: 'no-es-uuid' }] }),
      /UUID/,
      ['--estricto'],
    );
  });
  test('id Web mal formado', () =>
    fallaCon(
      definitivo(vars({ GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' })),
      /GOOGLE_WEB_CLIENT_ID de PROD no tiene el formato/,
      ['--estricto'],
    ));
  test('id Android mal formado', () =>
    fallaCon(
      definitivo(vars({ GOOGLE_ANDROID_CLIENT_IDS: 'abc' })),
      /id Android de PROD no tiene el formato/,
      ['--estricto'],
    ));
  test('ids Android duplicados', () =>
    fallaCon(
      definitivo(vars({ GOOGLE_ANDROID_CLIENT_IDS: `${AND_PROD},${AND_PROD}` })),
      /duplicados/,
      ['--estricto'],
    ));
  test('más de 4 ids Android', () => {
    const ids = [1, 2, 3, 4, 5].map((i) => `9${i}-a.apps.googleusercontent.com`).join(',');
    fallaCon(definitivo(vars({ GOOGLE_ANDROID_CLIENT_IDS: ids })), /máximo 4/, ['--estricto']);
  });
  test('id Web dentro de la lista Android', () =>
    fallaCon(
      definitivo(vars({ GOOGLE_ANDROID_CLIENT_IDS: `${AND_PROD},${WEB_PROD}` })),
      /no puede estar en la lista/,
      ['--estricto'],
    ));
  for (const lista of [
    `${AND_PROD},,333-otro.apps.googleusercontent.com`,
    `${AND_PROD},`,
    `,${AND_PROD}`,
  ]) {
    test(`elementos vacíos en la lista Android «${lista}»`, () =>
      fallaCon(
        definitivo(vars({ GOOGLE_ANDROID_CLIENT_IDS: lista })),
        /contiene elementos vacíos/,
        ['--estricto'],
      ));
  }
  test('marcador en minúsculas en una variable extra de PROD', () =>
    fallaCon(definitivo(vars({ OTRA: ' reemplazar_algo' })), /quedan 1 marcadores/, [
      '--estricto',
    ]));
  test('marcador en una variable extra de PROD', () =>
    fallaCon(definitivo(vars({ OTRA: 'REEMPLAZAR_ALGO' })), /quedan 1 marcadores/, ['--estricto']));
  test('el modo normal acepta marcador en variable extra', () => {
    const r = cli(['--config', escribir(definitivo(vars({ OTRA: 'REEMPLAZAR_ALGO' })))]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /marcadores pendientes: 1/);
  });
});
