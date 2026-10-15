// Acceso a D1 de la tabla refresh_tokens. Solo persistencia: sin JWT, sin HTTP y sin Hono.
// El repositorio no genera tokens ni calcula hashes: recibe ids y hashes ya hechos, y nunca
// los registra ni los incluye en mensajes de error ni en los resultados que no los necesiten.
// El reloj llega como parámetro (now).

export const MAX_ACTIVE_SESSIONS = 5;

export type RevokedReason = 'rotated' | 'logout' | 'evicted' | 'reuse';

// --------------------------------------------------------------------------------------
// Login: nueva familia + expulsión determinista
// --------------------------------------------------------------------------------------

// Expirados: "vigente" es revoked_at IS NULL AND expires_at > now. Un token activo ya vencido
// no cuenta para el límite, no se expulsa y permanece inerte (no hay purga en 2A.1).
// Se expulsa por SQL dentro del batch, sin leer antes en JS: se revocan las vigentes del usuario
// que sobren para dejar MAX_ACTIVE_SESSIONS - 1 (el nuevo token ocupa el último lugar), en orden
// created_at ASC, id ASC (el id desempata de forma determinista cuando created_at coincide).
// MAX(0, ...) evita un LIMIT negativo, que SQLite interpreta como "sin límite".
export const EVICT_SESSIONS_SQL = `UPDATE refresh_tokens
   SET revoked_at = ?2, revoked_reason = 'evicted', updated_at = ?2
 WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2
   AND id IN (
     SELECT id FROM refresh_tokens
      WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2
      ORDER BY created_at ASC, id ASC
      LIMIT MAX(0, (SELECT count(*) FROM refresh_tokens
                     WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2) - ?3))`;

export const INSERT_SESSION_TOKEN_SQL = `INSERT INTO refresh_tokens
  (id, user_id, family_id, token_hash, expires_at, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`;

export interface CreateSessionFamilyInput {
  userId: string;
  familyId: string;
  tokenId: string;
  tokenHash: string;
  now: Date;
  expiresAt: Date;
}

export type CreateSessionFamilyResult = { status: 'created'; evictedCount: number };

// Un solo db.batch() (transacción de D1, que serializa las escrituras): expulsa y luego inserta.
// Ante logins concurrentes del mismo usuario cada batch ve el resultado del anterior, así que
// siempre quedan MAX_ACTIVE_SESSIONS vigentes. Si el INSERT falla se revierte también la expulsión.
export async function createSessionFamily(
  db: D1Database,
  input: CreateSessionFamilyInput,
): Promise<CreateSessionFamilyResult> {
  const now = input.now.toISOString();
  const [evict] = await db.batch([
    db.prepare(EVICT_SESSIONS_SQL).bind(input.userId, now, MAX_ACTIVE_SESSIONS - 1),
    db
      .prepare(INSERT_SESSION_TOKEN_SQL)
      .bind(
        input.tokenId,
        input.userId,
        input.familyId,
        input.tokenHash,
        input.expiresAt.toISOString(),
        now,
      ),
  ]);
  return { status: 'created', evictedCount: evict?.meta.changes ?? 0 };
}

// --------------------------------------------------------------------------------------
// Búsqueda por hash
// --------------------------------------------------------------------------------------

// family_live (solo para tokens rotados): la familia conserva algún token vigente. El sub-SELECT
// filtra solo por family_id para usar el índice parcial único de familias no revocadas.
export const FIND_TOKEN_BY_HASH_SQL = `SELECT id, user_id, family_id, expires_at, revoked_at, revoked_reason, replaced_by,
  CASE WHEN revoked_reason = 'rotated' THEN EXISTS (SELECT 1 FROM refresh_tokens f WHERE f.family_id = refresh_tokens.family_id AND f.revoked_at IS NULL AND f.expires_at > ?2) END AS family_live
  FROM refresh_tokens WHERE token_hash = ?1`;

interface TokenRef {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: string;
}

export type FindRefreshTokenResult =
  | ({ status: 'active' } & TokenRef)
  | ({ status: 'expired' } & TokenRef)
  | ({
      status: 'rotated';
      revoked_at: string;
      // null si el sucesor se borró (ON DELETE SET NULL).
      replaced_by: string | null;
      // La familia sigue teniendo un token vigente (no revocada ni vencida).
      family_live: boolean;
    } & TokenRef)
  | ({
      status: 'revoked';
      revoked_at: string;
      revoked_reason: 'logout' | 'evicted' | 'reuse';
    } & TokenRef)
  | { status: 'not_found' };

interface TokenLookupRow extends TokenRef {
  revoked_at: string | null;
  revoked_reason: RevokedReason | null;
  replaced_by: string | null;
  family_live: number | null;
}

// Usa el índice UNIQUE de token_hash. No filtra por usuario: el hash es la credencial y
// el resultado informa user_id para que el servicio lo use en el resto de operaciones.
export async function findRefreshTokenByHash(
  db: D1Database,
  tokenHash: string,
  now: Date,
): Promise<FindRefreshTokenResult> {
  const row = await db
    .prepare(FIND_TOKEN_BY_HASH_SQL)
    .bind(tokenHash, now.toISOString())
    .first<TokenLookupRow>();
  if (!row) {
    return { status: 'not_found' };
  }
  const ref: TokenRef = {
    id: row.id,
    user_id: row.user_id,
    family_id: row.family_id,
    expires_at: row.expires_at,
  };
  if (row.revoked_at === null || row.revoked_reason === null) {
    return row.expires_at > now.toISOString()
      ? { status: 'active', ...ref }
      : { status: 'expired', ...ref };
  }
  if (row.revoked_reason === 'rotated') {
    return {
      status: 'rotated',
      ...ref,
      revoked_at: row.revoked_at,
      replaced_by: row.replaced_by,
      family_live: row.family_live === 1,
    };
  }
  return {
    status: 'revoked',
    ...ref,
    revoked_at: row.revoked_at,
    revoked_reason: row.revoked_reason,
  };
}

// --------------------------------------------------------------------------------------
// Rotación
// --------------------------------------------------------------------------------------

// 1. Cerrojo: solo afecta a un token activo y vigente, localizado por el índice de token_hash.
export const ROTATE_REVOKE_SQL = `UPDATE refresh_tokens
   SET revoked_at = ?1, revoked_reason = 'rotated', replaced_by = ?2, updated_at = ?1
 WHERE token_hash = ?3 AND revoked_at IS NULL AND expires_at > ?1`;

// 2. Sucesor: copia user_id y family_id de la fila recién rotada. Se localiza por token_hash
// (índice), sin escanear por replaced_by. Si el cerrojo no afectó nada, no inserta nada.
export const ROTATE_INSERT_SQL = `INSERT INTO refresh_tokens
  (id, user_id, family_id, token_hash, expires_at, created_at, updated_at)
SELECT ?1, user_id, family_id, ?2, ?3, ?4, ?4
  FROM refresh_tokens
 WHERE token_hash = ?5 AND replaced_by = ?1 AND revoked_reason = 'rotated' AND revoked_at = ?4`;

// 3. Confirmación: el éxito exige que el sucesor exista, sea del mismo user_id y family_id, esté
// activo y que el anterior apunte a él con motivo rotated. replaced_by por sí solo no basta.
export const ROTATE_CONFIRM_SQL = `SELECT s.id AS id, s.user_id AS user_id, s.family_id AS family_id
  FROM refresh_tokens o
  JOIN refresh_tokens s ON s.id = o.replaced_by
 WHERE o.token_hash = ?3 AND o.replaced_by = ?1 AND o.revoked_reason = 'rotated' AND o.revoked_at = ?4
   AND s.id = ?1 AND s.token_hash = ?2
   AND s.user_id = o.user_id AND s.family_id = o.family_id
   AND s.revoked_at IS NULL AND s.revoked_reason IS NULL`;

export interface RotateRefreshTokenInput {
  oldHash: string;
  newId: string;
  newHash: string;
  now: Date;
  // Nuevo vencimiento del sucesor (ventana deslizante); lo decide el servicio.
  expiresAt: Date;
}

export type RotateRefreshTokenResult =
  | { status: 'rotated'; successor: { id: string; user_id: string; family_id: string } }
  // No escribió nada: el servicio clasifica el motivo con findRefreshTokenByHash.
  | { status: 'not_rotated' };

// Un solo db.batch() atómico. Si algo falla (UNIQUE, CHECK, FK diferida) se revierte todo y
// la promesa se rechaza. Con N intentos simultáneos del mismo token solo el primero cumple el
// UPDATE condicional; los demás no escriben nada y devuelven not_rotated.
export async function rotateRefreshToken(
  db: D1Database,
  input: RotateRefreshTokenInput,
): Promise<RotateRefreshTokenResult> {
  const now = input.now.toISOString();
  const [, , confirmation] = await db.batch<{ id: string; user_id: string; family_id: string }>([
    db.prepare(ROTATE_REVOKE_SQL).bind(now, input.newId, input.oldHash),
    db
      .prepare(ROTATE_INSERT_SQL)
      .bind(input.newId, input.newHash, input.expiresAt.toISOString(), now, input.oldHash),
    db.prepare(ROTATE_CONFIRM_SQL).bind(input.newId, input.newHash, input.oldHash, now),
  ]);
  const successor = confirmation?.results[0];
  return successor ? { status: 'rotated', successor } : { status: 'not_rotated' };
}

// --------------------------------------------------------------------------------------
// Revocación de familia
// --------------------------------------------------------------------------------------

// Usa el índice parcial único de family_id (tokens no revocados). Acotada por user_id.
export const REVOKE_FAMILY_SQL = `UPDATE refresh_tokens
   SET revoked_at = ?1, revoked_reason = ?2, updated_at = ?1
 WHERE user_id = ?3 AND family_id = ?4 AND revoked_at IS NULL`;

export interface RevokeFamilyInput {
  userId: string;
  familyId: string;
  now: Date;
}

export type RevokeFamilyResult = { status: 'revoked'; revokedCount: number };

async function revokeFamily(
  db: D1Database,
  input: RevokeFamilyInput,
  reason: 'logout' | 'reuse',
): Promise<RevokeFamilyResult> {
  const result = await db
    .prepare(REVOKE_FAMILY_SQL)
    .bind(input.now.toISOString(), reason, input.userId, input.familyId)
    .run();
  return { status: 'revoked', revokedCount: result.meta.changes };
}

// Idempotentes: solo tocan el token activo de la familia; los ya revocados conservan su motivo.
export function revokeFamilyForReuse(
  db: D1Database,
  input: RevokeFamilyInput,
): Promise<RevokeFamilyResult> {
  return revokeFamily(db, input, 'reuse');
}

export function revokeFamilyForLogout(
  db: D1Database,
  input: RevokeFamilyInput,
): Promise<RevokeFamilyResult> {
  return revokeFamily(db, input, 'logout');
}
