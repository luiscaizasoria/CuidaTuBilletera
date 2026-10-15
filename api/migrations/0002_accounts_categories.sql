-- Migración 0002: cuentas y categorías (Fase 2B.1, Decisión 2B.1 de docs/003).
--
-- Mismas convenciones que 0001 (ver su cabecera): UUID en minúsculas como TEXT con el mismo
-- CHECK, timestamps TEXT en UTC con formato fijo (los genera la API) y sin BEGIN/COMMIT/PRAGMA.
-- No incluye `transactions`: llega en la Fase 3. Una migración aplicada nunca se modifica.
--
-- Los límites de largo de este archivo se repiten en api/src/lib/limits.ts; una prueba
-- comprueba que coinciden.

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id TEXT NOT NULL PRIMARY KEY
    CHECK (length(id) = 36 AND length(replace(id, '-', '')) = 32 AND id NOT GLOB '*[^0-9a-f-]*'
      AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-'),
  user_id TEXT NOT NULL
    REFERENCES users (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL
    CHECK (length(trim(nombre)) BETWEEN 1 AND 60 AND nombre = trim(nombre)),
  -- Centavos. Entero estricto dentro del rango seguro de JavaScript (Number.MAX_SAFE_INTEGER).
  saldo_inicial INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(saldo_inicial) = 'integer' AND saldo_inicial BETWEEN -9007199254740991 AND 9007199254740991),
  archivada INTEGER NOT NULL DEFAULT 0
    CHECK (archivada IN (0, 1)),
  created_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  updated_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at)
);

CREATE INDEX ix_accounts_user ON accounts (user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id TEXT NOT NULL PRIMARY KEY
    CHECK (length(id) = 36 AND length(replace(id, '-', '')) = 32 AND id NOT GLOB '*[^0-9a-f-]*'
      AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-'),
  account_id TEXT NOT NULL
    REFERENCES accounts (id) ON DELETE CASCADE
    CHECK (length(account_id) = 36 AND length(replace(account_id, '-', '')) = 32 AND account_id NOT GLOB '*[^0-9a-f-]*'
      AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-'
      AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-'),
  nombre TEXT NOT NULL
    CHECK (length(trim(nombre)) BETWEEN 1 AND 40 AND nombre = trim(nombre)),
  descripcion TEXT
    CHECK (descripcion IS NULL OR (length(trim(descripcion)) BETWEEN 1 AND 200 AND descripcion = trim(descripcion))),
  -- Inmutable después de crear la categoría: lo impone la API (PATCH no lo admite).
  tipo TEXT NOT NULL
    CHECK (tipo IN ('ingreso', 'egreso')),
  icono TEXT NOT NULL
    CHECK (length(icono) BETWEEN 1 AND 40),
  -- '#RRGGBB' con hexadecimales en mayúsculas (la API normaliza).
  color TEXT NOT NULL
    CHECK (length(color) = 7 AND substr(color, 1, 1) = '#' AND substr(color, 2) NOT GLOB '*[^0-9A-F]*'),
  archivada INTEGER NOT NULL DEFAULT 0
    CHECK (archivada IN (0, 1)),
  created_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  updated_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at)
);

-- Nombre único por cuenta y tipo, sin distinguir mayúsculas ASCII (NOCASE no cubre las
-- letras con tilde: la API normaliza el resto antes de insertar). También sirve como índice
-- de categories(account_id, tipo).
CREATE UNIQUE INDEX ux_categories_account_tipo_nombre
  ON categories (account_id, tipo, nombre COLLATE NOCASE);
