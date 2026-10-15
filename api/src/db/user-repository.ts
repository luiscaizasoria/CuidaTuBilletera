// Acceso a D1 de la tabla users. Solo persistencia: sin JWT, sin HTTP y sin Hono.
// El reloj llega como parámetro (now) y los identificadores los genera quien llama.

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  nombre: string | null;
  currency: string;
  plan: string;
  plan_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertUserInput {
  // Id candidato (UUID). Solo se usa si el google_sub no existe; el id de un usuario existente se conserva.
  id: string;
  google_sub: string;
  email: string;
  nombre: string | null;
  now: Date;
}

export type UpsertUserResult = { status: 'upserted'; user: UserRow; created: boolean };

const USER_COLUMNS =
  'id, google_sub, email, nombre, currency, plan, plan_expires_at, created_at, updated_at';

// Una sola sentencia atómica. El UPDATE del conflicto solo se ejecuta si cambió el correo o el
// nombre efectivo (IS NOT trata NULL como un valor), así que sin cambios no hay escritura y
// updated_at permanece estable. Si Google no entrega un nombre válido (excluded.nombre NULL) se
// conserva el guardado; un nombre válido distinto lo reemplaza. Con google_sub concurrente, UNIQUE(google_sub) deja una única fila.
export const UPSERT_USER_SQL = `INSERT INTO users (id, google_sub, email, nombre, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?5)
ON CONFLICT (google_sub) DO UPDATE SET
  email = excluded.email,
  nombre = COALESCE(excluded.nombre, users.nombre),
  updated_at = excluded.updated_at
WHERE users.email IS NOT excluded.email
  OR users.nombre IS NOT COALESCE(excluded.nombre, users.nombre)`;

export const SELECT_USER_BY_GOOGLE_SUB_SQL = `SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?1`;
export const SELECT_USER_BY_ID_SQL = `SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`;

// Un nombre vacío no cumple el CHECK de la tabla: se guarda como NULL.
function normalizeNombre(nombre: string | null): string | null {
  const trimmed = nombre?.trim();
  return trimmed ? trimmed : null;
}

// Crea o actualiza por google_sub. `created` es verdadero solo si la fila final conserva el id
// candidato: ante carreras del mismo google_sub gana una sola inserción y las demás devuelven false.
export async function upsertUserByGoogleSub(
  db: D1Database,
  input: UpsertUserInput,
): Promise<UpsertUserResult> {
  const [, selected] = await db.batch<UserRow>([
    db
      .prepare(UPSERT_USER_SQL)
      .bind(
        input.id,
        input.google_sub,
        input.email,
        normalizeNombre(input.nombre),
        input.now.toISOString(),
      ),
    db.prepare(SELECT_USER_BY_GOOGLE_SUB_SQL).bind(input.google_sub),
  ]);
  const user = selected?.results[0];
  if (!user) {
    throw new Error('upsertUserByGoogleSub: el usuario no existe tras el upsert');
  }
  return { status: 'upserted', user, created: user.id === input.id };
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare(SELECT_USER_BY_ID_SQL).bind(id).first<UserRow>();
}
