// Acceso a D1 de la tabla accounts. Solo persistencia: sin HTTP ni reglas de negocio.
// Toda consulta, UPDATE y DELETE se acota por user_id; nunca se busca solo por id.

export interface AccountRow {
  id: string;
  user_id: string;
  nombre: string;
  saldo_inicial: number;
  archivada: number;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface AccountListOptions {
  page: number;
  pageSize: number;
  incluirArchivadas: boolean;
}

export interface NewAccount {
  id: string;
  userId: string;
  nombre: string;
  saldoInicial: number;
  now: Date;
}

const ACCOUNT_COLUMNS = 'id, user_id, nombre, saldo_inicial, archivada, created_at, updated_at';

export async function countAccounts(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT count(*) AS n FROM accounts WHERE user_id = ?1')
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listAccounts(
  db: D1Database,
  userId: string,
  { page, pageSize, incluirArchivadas }: AccountListOptions,
): Promise<Page<AccountRow>> {
  const archived = incluirArchivadas ? 1 : 0; // 1 = incluir todas; 0 = solo activas.
  const [items, total] = await db.batch<AccountRow | { n: number }>([
    db
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS} FROM accounts
          WHERE user_id = ?1 AND (?2 = 1 OR archivada = 0)
          ORDER BY created_at, id LIMIT ?3 OFFSET ?4`,
      )
      .bind(userId, archived, pageSize, (page - 1) * pageSize),
    db
      .prepare(
        'SELECT count(*) AS n FROM accounts WHERE user_id = ?1 AND (?2 = 1 OR archivada = 0)',
      )
      .bind(userId, archived),
  ]);
  return {
    items: (items?.results ?? []) as AccountRow[],
    total: (total?.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

export async function findAccount(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AccountRow | null> {
  return db
    .prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<AccountRow>();
}

// Sentencia (sin ejecutar) para componerla en un db.batch junto con las categorías iniciales.
export function insertAccountStatement(db: D1Database, input: NewAccount): D1PreparedStatement {
  const at = input.now.toISOString();
  return db
    .prepare(
      `INSERT INTO accounts (id, user_id, nombre, saldo_inicial, archivada, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5)`,
    )
    .bind(input.id, input.userId, input.nombre, input.saldoInicial, at);
}

export interface AccountPatch {
  nombre?: string;
  archivada?: boolean;
}

// Devuelve la cuenta actualizada, o null si no existe o no pertenece al usuario.
export async function updateAccount(
  db: D1Database,
  userId: string,
  id: string,
  patch: AccountPatch,
  now: Date,
): Promise<AccountRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.nombre !== undefined) {
    values.push(patch.nombre);
    sets.push(`nombre = ?${values.length}`);
  }
  if (patch.archivada !== undefined) {
    values.push(patch.archivada ? 1 : 0);
    sets.push(`archivada = ?${values.length}`);
  }
  values.push(now.toISOString());
  sets.push(`updated_at = ?${values.length}`);
  values.push(id, userId);
  const idIndex = values.length - 1;
  const [, selected] = await db.batch<AccountRow>([
    db
      .prepare(
        `UPDATE accounts SET ${sets.join(', ')} WHERE id = ?${idIndex} AND user_id = ?${idIndex + 1}`,
      )
      .bind(...values),
    db
      .prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?1 AND user_id = ?2`)
      .bind(id, userId),
  ]);
  return selected?.results[0] ?? null;
}
