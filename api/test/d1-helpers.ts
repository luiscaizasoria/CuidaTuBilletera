import { applyD1Migrations, reset, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Reloj fijo de las pruebas de D1. Los timestamps de la base usan el formato de toISOString().
export const NOW = new Date('2026-10-13T12:00:00.000Z');
export const SESSION_DAYS = 7;

export const iso = (date: Date): string => date.toISOString();
export const plusMs = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
export const plusDays = (date: Date, days: number): Date => plusMs(date, days * 86_400_000);

// Tiempo máximo de los hooks que reinician la base (reset + migraciones). El valor por defecto de
// Vitest (10 s) se agotó en ejecuciones completas con carga (arranque en frío de workerd).
export const DB_HOOK_TIMEOUT_MS = 30_000;

export const uuid = (): string => crypto.randomUUID();

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// `DB` y `TEST_MIGRATIONS` solo existen en las pruebas (vitest.config.ts). Se leen aquí con un
// tipo propio en lugar de ampliar Cloudflare.Env, para que el código de src/ no crea que
// el binding DB ya existe en producción.
interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
}

// Base vacía con el esquema real: borra el estado local y vuelve a aplicar api/migrations.
export async function freshDb(): Promise<D1Database> {
  await reset();
  const { DB, TEST_MIGRATIONS } = env as unknown as TestEnv;
  await applyD1Migrations(DB, TEST_MIGRATIONS);
  return DB;
}

export type Row = Record<string, unknown>;

// Inserta con las columnas que se indiquen; las que falten usan los DEFAULT de la tabla.
export async function insertRow(db: D1Database, table: string, row: Row): Promise<void> {
  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `?${index + 1}`).join(', ');
  await db
    .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
    .bind(...Object.values(row))
    .run();
}

export async function insertUser(db: D1Database, overrides: Row = {}): Promise<string> {
  const row: Row = {
    id: uuid(),
    google_sub: `google-sub-${uuid()}`,
    email: 'usuario@example.com',
    nombre: 'Usuario Prueba',
    created_at: iso(NOW),
    updated_at: iso(NOW),
    ...overrides,
  };
  await insertRow(db, 'users', row);
  return row.id as string;
}

export interface TokenFixture {
  id: string;
  familyId: string;
  secret: string;
  hash: string;
}

// Token activo por defecto. `secret` es el valor que conocería el cliente; en la base solo
// queda su hash SHA-256.
export async function insertToken(
  db: D1Database,
  userId: string,
  overrides: Row = {},
): Promise<TokenFixture> {
  const secret = `rt_${uuid()}`;
  const row: Row = {
    id: uuid(),
    user_id: userId,
    family_id: uuid(),
    token_hash: await sha256Hex(secret),
    expires_at: iso(plusDays(NOW, SESSION_DAYS)),
    created_at: iso(NOW),
    updated_at: iso(NOW),
    ...overrides,
  };
  await insertRow(db, 'refresh_tokens', row);
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    secret,
    hash: row.token_hash as string,
  };
}

export async function rowOf(db: D1Database, table: string, id: string): Promise<Row | null> {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?1`).bind(id).first<Row>();
}

export async function count(db: D1Database, table: string, where = '1 = 1'): Promise<number> {
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${where}`).first<{
    n: number;
  }>();
  return row?.n ?? 0;
}

// Identificador y hash del sucesor que intentará insertar una rotación.
export async function newSuccessor(): Promise<{ newId: string; newHash: string }> {
  return { newId: uuid(), newHash: await sha256Hex(`rt_${uuid()}`) };
}

// Invariantes que ninguna secuencia de operaciones debe romper.
export async function readInvariants(db: D1Database): Promise<{
  familiesWithManyActive: number;
  rotatedWithoutSuccessor: number;
  successorsOfOtherFamily: number;
}> {
  const manyActive = await db
    .prepare(
      `SELECT count(*) AS n FROM (
         SELECT family_id FROM refresh_tokens WHERE revoked_at IS NULL
          GROUP BY family_id HAVING count(*) > 1)`,
    )
    .first<{ n: number }>();
  const orphaned = await db
    .prepare(
      `SELECT count(*) AS n FROM refresh_tokens r
        WHERE r.revoked_reason = 'rotated'
          AND NOT EXISTS (SELECT 1 FROM refresh_tokens s WHERE s.id = r.replaced_by)`,
    )
    .first<{ n: number }>();
  const mismatched = await db
    .prepare(
      `SELECT count(*) AS n FROM refresh_tokens r
        JOIN refresh_tokens s ON s.id = r.replaced_by
        WHERE s.user_id <> r.user_id OR s.family_id <> r.family_id`,
    )
    .first<{ n: number }>();
  return {
    familiesWithManyActive: manyActive?.n ?? -1,
    rotatedWithoutSuccessor: orphaned?.n ?? -1,
    successorsOfOtherFamily: mismatched?.n ?? -1,
  };
}
