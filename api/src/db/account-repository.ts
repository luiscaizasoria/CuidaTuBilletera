// Acceso a D1 de la tabla accounts. Solo persistencia: sin HTTP ni reglas de negocio.
// Toda consulta, UPDATE y DELETE se acota por user_id; nunca se busca solo por id.

export interface AccountRow {
  id: string;
  user_id: string;
  nombre: string;
  saldo_inicial: number;
  archivada: number;
  color: string | null;
  icono: string | null;
  created_at: string;
  updated_at: string;
}

// Cuenta con los agregados de sus movimientos vigentes (los anulados no cuentan), en centavos.
export interface AccountWithTotalsRow extends AccountRow {
  ingresos: number;
  gastos: number;
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
  color: string | null;
  icono: string | null;
  now: Date;
}

// Cuenta + agregados en una sola consulta (sin N+1). `deleted_at IS NULL` va en el ON y no en
// el WHERE: así una cuenta sin movimientos (o solo con anulados) sigue apareciendo (LEFT JOIN).
const TOTALS_SELECT = `SELECT a.id, a.user_id, a.nombre, a.saldo_inicial, a.archivada, a.color, a.icono,
          a.created_at, a.updated_at,
          COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto END), 0) AS ingresos,
          COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto END), 0) AS gastos
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL`;

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
): Promise<Page<AccountWithTotalsRow>> {
  const archived = incluirArchivadas ? 1 : 0; // 1 = incluir todas; 0 = solo activas.
  const [items, total] = await db.batch<AccountWithTotalsRow | { n: number }>([
    db
      .prepare(
        `${TOTALS_SELECT}
          WHERE a.user_id = ?1 AND (?2 = 1 OR a.archivada = 0)
          GROUP BY a.id
          ORDER BY a.created_at, a.id LIMIT ?3 OFFSET ?4`,
      )
      .bind(userId, archived, pageSize, (page - 1) * pageSize),
    db
      .prepare(
        'SELECT count(*) AS n FROM accounts WHERE user_id = ?1 AND (?2 = 1 OR archivada = 0)',
      )
      .bind(userId, archived),
  ]);
  return {
    items: (items?.results ?? []) as AccountWithTotalsRow[],
    total: (total?.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

export async function findAccount(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AccountWithTotalsRow | null> {
  return db
    .prepare(`${TOTALS_SELECT} WHERE a.id = ?1 AND a.user_id = ?2 GROUP BY a.id`)
    .bind(id, userId)
    .first<AccountWithTotalsRow>();
}

// Sentencia (sin ejecutar) para componerla en un db.batch junto con las categorías iniciales.
export function insertAccountStatement(db: D1Database, input: NewAccount): D1PreparedStatement {
  const at = input.now.toISOString();
  return db
    .prepare(
      `INSERT INTO accounts (id, user_id, nombre, saldo_inicial, archivada, color, icono, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?7)`,
    )
    .bind(input.id, input.userId, input.nombre, input.saldoInicial, input.color, input.icono, at);
}

export interface AccountPatch {
  nombre?: string;
  archivada?: boolean;
  // undefined = sin cambio; null = volver a NULL (predeterminado); valor = fijar.
  color?: string | null;
  icono?: string | null;
}

// Devuelve la cuenta actualizada, o null si no existe o no pertenece al usuario.
export async function updateAccount(
  db: D1Database,
  userId: string,
  id: string,
  patch: AccountPatch,
  now: Date,
): Promise<AccountWithTotalsRow | null> {
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
  if (patch.color !== undefined) {
    values.push(patch.color);
    sets.push(`color = ?${values.length}`);
  }
  if (patch.icono !== undefined) {
    values.push(patch.icono);
    sets.push(`icono = ?${values.length}`);
  }
  values.push(now.toISOString());
  sets.push(`updated_at = ?${values.length}`);
  values.push(id, userId);
  const idIndex = values.length - 1;
  const [, selected] = await db.batch<AccountWithTotalsRow>([
    db
      .prepare(
        `UPDATE accounts SET ${sets.join(', ')} WHERE id = ?${idIndex} AND user_id = ?${idIndex + 1}`,
      )
      .bind(...values),
    db
      .prepare(`${TOTALS_SELECT} WHERE a.id = ?1 AND a.user_id = ?2 GROUP BY a.id`)
      .bind(id, userId),
  ]);
  return selected?.results[0] ?? null;
}
