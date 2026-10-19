-- Migración 0005: categorías predeterminadas «Conciliación» (egreso e ingreso) para cuentas existentes
-- (Decisión 6.1 de docs/003; docs/001 §5).
--
-- Solo DATOS: no toca el esquema. Las cuentas nuevas las reciben de DEFAULT_CATEGORIES
-- (api/src/services/default-categories.ts); esta migración cubre las cuentas anteriores.
-- Idempotente y con guardas, por cuenta y por tipo, incluidas las cuentas y categorías archivadas:
--   1. No inserta si ya hay una categoría del mismo tipo cuyo nombre normalizado sea «conciliacion».
--      La normalización pasa a ASCII las vocales con tilde (á é í ó ú, en mayúscula y minúscula) y
--      quita la tilde combinante U+0301 (forma NFD); lower() de SQLite no convierte letras no ASCII,
--      por eso no basta. No modifica ninguna categoría existente.
--   2. No inserta si la cuenta ya tiene 60 categorías (MAX_CATEGORIES_PER_ACCOUNT, que cuenta las
--      archivadas). Cada tipo evalúa el conteo vigente: primero entra EGRESO y después INGRESO, así que
--      con 59 categorías solo entra la de egreso y con 60 ninguna.
-- Los valores deben coincidir con DEFAULT_CATEGORIES; una prueba lo comprueba.
-- id: UUID v4 en minúsculas generado en SQL (cumple el CHECK de 0002); la variante usa
-- random() & 3 (sin abs(), que desborda con el entero mínimo). Timestamps UTC con el formato fijo
-- del CHECK. No toca movimientos ni saldos. Sin BEGIN/COMMIT/PRAGMA.

INSERT INTO categories (id, account_id, nombre, descripcion, tipo, icono, color, archivada, created_at, updated_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || lower(substr(hex(randomblob(2)), 2)) || '-' ||
    substr('89ab', 1 + (random() & 3), 1) || lower(substr(hex(randomblob(2)), 2)) || '-' || lower(hex(randomblob(6))),
  a.id, 'Conciliación', NULL, 'egreso', 'exchange', '#6366F1', 0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.account_id = a.id AND c.tipo = 'egreso'
      AND lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(c.nombre, 'ó', 'o'), 'Ó', 'O'), 'á', 'a'), 'Á', 'A'), 'é', 'e'), 'É', 'E'), 'í', 'i'), 'Í', 'I'), 'ú', 'u'), 'Ú', 'U'), char(769), '')) = 'conciliacion')
  AND (SELECT count(*) FROM categories c WHERE c.account_id = a.id) < 60;

INSERT INTO categories (id, account_id, nombre, descripcion, tipo, icono, color, archivada, created_at, updated_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || lower(substr(hex(randomblob(2)), 2)) || '-' ||
    substr('89ab', 1 + (random() & 3), 1) || lower(substr(hex(randomblob(2)), 2)) || '-' || lower(hex(randomblob(6))),
  a.id, 'Conciliación', NULL, 'ingreso', 'exchange', '#6366F1', 0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.account_id = a.id AND c.tipo = 'ingreso'
      AND lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(c.nombre, 'ó', 'o'), 'Ó', 'O'), 'á', 'a'), 'Á', 'A'), 'é', 'e'), 'É', 'E'), 'í', 'i'), 'Í', 'I'), 'ú', 'u'), 'Ú', 'U'), char(769), '')) = 'conciliacion')
  AND (SELECT count(*) FROM categories c WHERE c.account_id = a.id) < 60;
