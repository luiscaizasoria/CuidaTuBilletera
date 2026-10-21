import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Las pruebas usan una base D1 LOCAL y efímera (Miniflare) declarada aquí con `d1Databases`.
// Se usa wrangler.test.jsonc (mínimo, con `main`) y no wrangler.jsonc: el real no tiene `main`
// en el nivel superior (freno contra despliegue accidental). Así no se leen env.dev ni env.prod
// ni sus `database_id`, y las pruebas nunca pueden apuntar a una base remota.
//
// El esquema sale de api/migrations (única fuente): se lee aquí, en Node, y se entrega a
// las pruebas como el binding TEST_MIGRATIONS para aplicarlo con applyD1Migrations().
// La ruta es relativa al directorio de api/, igual que `configPath`.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          d1Databases: { DB: 'test-db' },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
