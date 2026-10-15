-- Migración 0001: usuarios y refresh tokens (Fase 2A).
--
-- Convenciones (docs/001-CONSTITUCION.md §5 y docs/002-CONVENCIONES.md):
--   * Los identificadores son UUID en minúsculas guardados como TEXT. Se validan sin un
--     GLOB largo porque D1 limita la longitud de los patrones LIKE/GLOB (error
--     "LIKE or GLOB pattern too complex"): longitud, guiones en su posición y caracteres hex.
--   * Los timestamps son TEXT en UTC con formato fijo AAAA-MM-DDTHH:MM:SS.sssZ
--     (el de Date.prototype.toISOString), por lo que se pueden comparar como texto.
--     La validación `strftime(...) IS columna` rechaza fechas imposibles y formatos
--     distintos; se usa IS para que un resultado NULL (fecha inválida) también falle.
--   * Las fechas las genera el código de la API (reloj inyectable), no la base.
--   * No contiene BEGIN/COMMIT ni PRAGMA: D1 aplica cada migración por su cuenta.
--
-- Una migración aplicada nunca se modifica: los cambios van en una migración nueva.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id TEXT NOT NULL PRIMARY KEY
    CHECK (length(id) = 36 AND length(replace(id, '-', '')) = 32 AND id NOT GLOB '*[^0-9a-f-]*'
      AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-'),
  -- Identidad estable del usuario en Google. El correo puede cambiar, por eso no es único.
  google_sub TEXT NOT NULL UNIQUE
    CHECK (length(trim(google_sub)) > 0),
  email TEXT NOT NULL
    CHECK (length(trim(email)) > 0),
  nombre TEXT
    CHECK (nombre IS NULL OR length(trim(nombre)) > 0),
  currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency = 'USD'),
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free')),
  plan_expires_at TEXT
    CHECK (plan_expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', plan_expires_at) IS plan_expires_at),
  created_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  updated_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at)
);

-- ---------------------------------------------------------------------------
-- refresh_tokens
-- ---------------------------------------------------------------------------
-- Una familia (family_id) es una sesión independiente de un dispositivo. En cada
-- renovación el token vigente se revoca con motivo 'rotated' y se inserta su sucesor
-- en la misma familia, así que una familia tiene como máximo un token activo y
-- el número de sesiones de un usuario es su número de tokens activos.
-- Nunca se guarda el token original: solo su hash SHA-256 en hexadecimal.
CREATE TABLE refresh_tokens (
  id TEXT NOT NULL PRIMARY KEY
    CHECK (length(id) = 36 AND length(replace(id, '-', '')) = 32 AND id NOT GLOB '*[^0-9a-f-]*'
      AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-'),
  user_id TEXT NOT NULL
    REFERENCES users (id) ON DELETE CASCADE,
  family_id TEXT NOT NULL
    CHECK (length(family_id) = 36 AND length(replace(family_id, '-', '')) = 32 AND family_id NOT GLOB '*[^0-9a-f-]*'
      AND substr(family_id, 9, 1) = '-' AND substr(family_id, 14, 1) = '-'
      AND substr(family_id, 19, 1) = '-' AND substr(family_id, 24, 1) = '-'),
  -- SHA-256 del token en hexadecimal minúscula (64 caracteres).
  token_hash TEXT NOT NULL UNIQUE
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  expires_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS expires_at),
  revoked_at TEXT
    CHECK (revoked_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at) IS revoked_at),
  revoked_reason TEXT
    CHECK (revoked_reason IS NULL OR revoked_reason IN ('rotated', 'logout', 'evicted', 'reuse')),
  -- Sucesor de un token rotado. La referencia se verifica al final de la transacción
  -- porque la rotación revoca el token antiguo antes de insertar el sucesor.
  -- Que el sucesor pertenezca al mismo user_id y family_id NO lo impone la base: un CHECK
  -- no puede consultar otras filas, y una FK compuesta exigiría un índice único extra en
  -- cada token y no admite ON DELETE SET NULL (pondría en NULL user_id y family_id, que
  -- son NOT NULL). Se garantiza en la lógica de rotación: el INSERT del sucesor copia
  -- user_id y family_id con INSERT ... SELECT desde la fila que se está reemplazando, y
  -- ningún otro código escribe replaced_by. Pruebas específicas obligatorias en la API.
  replaced_by TEXT
    REFERENCES refresh_tokens (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at),
  updated_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at),

  -- Consistencia de la revocación: un token activo tiene revoked_at y revoked_reason
  -- en NULL; uno revocado tiene ambos informados. Cada lado de la igualdad vale 0 o 1,
  -- nunca NULL, por lo que la regla no puede pasar por un resultado desconocido.
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
  -- Solo un token rotado tiene sucesor.
  CHECK (replaced_by IS NULL OR revoked_reason IS 'rotated'),
  -- Un token no puede sucederse a sí mismo.
  CHECK (replaced_by IS NULL OR replaced_by <> id),
  -- No se comparan revoked_at ni updated_at con created_at: los relojes de distintas
  -- instancias del Worker pueden diferir y rechazarían rotaciones legítimas.
  CHECK (expires_at > created_at)
);

-- Impide más de un token activo por familia (garantía de la rotación). También sirve
-- para revocar una familia completa.
CREATE UNIQUE INDEX ux_refresh_tokens_family_active
  ON refresh_tokens (family_id)
  WHERE revoked_at IS NULL;

-- Sesiones activas de un usuario ordenadas por último uso: el created_at del token
-- activo es el momento de su última renovación. Sirve para contar sesiones y para
-- expulsar la menos recientemente utilizada.
CREATE INDEX ix_refresh_tokens_user_active
  ON refresh_tokens (user_id, created_at)
  WHERE revoked_at IS NULL;
