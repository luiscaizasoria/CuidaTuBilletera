-- Migración 0004: personalización de cuenta (color e ícono), D12 de docs/003.
--
-- Aditiva: solo añade dos columnas nullable a `accounts`, sin default y sin tocar filas, claves
-- ni otras tablas. Las cuentas existentes quedan en NULL (apariencia predeterminada de la app).
--
-- Guardan IDENTIFICADORES de catálogo (p. ej. 'aguamarina', 'piggy-bank'), no valores hex ni
-- rutas. La API es la autoridad del catálogo (enum de Zod en api/src/lib/account-appearance.ts);
-- D1 solo restringe la forma (largo 1..20 y caracteres [a-z0-9-]) para poder ampliar el catálogo
-- sin reconstruir `accounts`, que tiene claves foráneas entrantes. Sin BEGIN/COMMIT/PRAGMA.

ALTER TABLE accounts ADD COLUMN color TEXT
  CHECK (color IS NULL OR (typeof(color) = 'text' AND length(color) BETWEEN 1 AND 20 AND color NOT GLOB '*[^a-z0-9-]*'));

ALTER TABLE accounts ADD COLUMN icono TEXT
  CHECK (icono IS NULL OR (typeof(icono) = 'text' AND length(icono) BETWEEN 1 AND 20 AND icono NOT GLOB '*[^a-z0-9-]*'));
