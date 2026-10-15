-- Migración 0003: movimientos (Fase 3, Decisión 3.1 de docs/003).
--
-- Mismas convenciones que 0001 y 0002: UUID en minúsculas como TEXT con el mismo CHECK,
-- timestamps TEXT en UTC con formato fijo (los genera la API) y sin BEGIN/COMMIT/PRAGMA.
-- Una migración aplicada nunca se modifica.
--
-- Sin user_id: la propiedad se verifica siempre mediante accounts.user_id. El saldo nunca se
-- guarda: se calcula con agregados. `ajuste` (conciliación) llegará en una migración posterior
-- que reconstruya la tabla. Un futuro borrado físico de cuentas o usuarios debe borrar antes
-- los movimientos (la categoría los protege con RESTRICT).
--
-- Los límites de este archivo se repiten en api/src/lib/limits.ts; una prueba comprueba que
-- coinciden.

CREATE TABLE transactions (
  id TEXT NOT NULL PRIMARY KEY
    CHECK (length(id) = 36 AND length(replace(id, '-', '')) = 32 AND id NOT GLOB '*[^0-9a-f-]*'
      AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-'),
  account_id TEXT NOT NULL
    REFERENCES accounts (id) ON DELETE CASCADE
    CHECK (length(account_id) = 36 AND length(replace(account_id, '-', '')) = 32 AND account_id NOT GLOB '*[^0-9a-f-]*'
      AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-'
      AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-'),
  category_id TEXT NOT NULL
    REFERENCES categories (id) ON DELETE RESTRICT
    CHECK (length(category_id) = 36 AND length(replace(category_id, '-', '')) = 32 AND category_id NOT GLOB '*[^0-9a-f-]*'
      AND substr(category_id, 9, 1) = '-' AND substr(category_id, 14, 1) = '-'
      AND substr(category_id, 19, 1) = '-' AND substr(category_id, 24, 1) = '-'),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('ingreso', 'gasto')),
  -- Centavos, siempre positivos: el signo lo da `tipo`.
  monto INTEGER NOT NULL
    CHECK (typeof(monto) = 'integer' AND monto BETWEEN 1 AND 99999999999),
  -- AAAA-MM-DD válida en el calendario, entre 2000 y 2100 (las fechas futuras se permiten).
  fecha TEXT NOT NULL
    CHECK (length(fecha) = 10 AND date(fecha) IS fecha AND fecha BETWEEN '2000-01-01' AND '2100-12-31'),
  nota TEXT
    CHECK (nota IS NULL OR (length(nota) BETWEEN 1 AND 500 AND nota = trim(nota))),
  -- Anulación lógica: la información histórica no se elimina.
  deleted_at TEXT
    CHECK (deleted_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS deleted_at),
  created_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  updated_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at)
);

CREATE INDEX ix_transactions_account_fecha ON transactions (account_id, fecha);
CREATE INDEX ix_transactions_account_category ON transactions (account_id, category_id);
