import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Las pruebas usan una base D1 LOCAL y efímera (Miniflare) declarada aquí con `d1Databases`.
// No se lee `env.dev` de wrangler.jsonc ni su `database_id`, así que las pruebas nunca pueden
// apuntar a controlgastos-db-dev ni a ninguna base remota. wrangler.jsonc tampoco declara
// un binding de producción.
//
// El esquema sale de api/migrations (única fuente): se lee aquí, en Node, y se entrega a
// las pruebas como el binding TEST_MIGRATIONS para aplicarlo con applyD1Migrations().
// La ruta es relativa al directorio de api/, igual que `configPath`.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          d1Databases: { DB: 'test-db' },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
