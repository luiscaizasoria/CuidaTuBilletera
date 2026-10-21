import { beforeAll, describe, expect, it } from 'vitest';
import { DELETE_USER_DATA_SQL, USER_DATA_TABLES } from '../src/db/profile-repository';
import { DB_HOOK_TIMEOUT_MS, freshDb } from './d1-helpers';

let db: D1Database;
beforeAll(async () => {
  db = await freshDb();
}, DB_HOOK_TIMEOUT_MS);

interface FkRow {
  table: string;
  from: string;
  to: string;
}

// Tablas del esquema real que contienen datos de un usuario: tienen user_id/account_id o una FK
// (directa o transitiva) hacia users.
async function userOwnedTables(): Promise<string[]> {
  const { results: tables } = await db
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
          AND name <> 'd1_migrations'`,
    )
    .all<{ name: string }>();
  const names = tables.map((t) => t.name);
  const fks = new Map<string, FkRow[]>();
  const columns = new Map<string, string[]>();
  for (const name of names) {
    const fk = await db
      .prepare(`SELECT "table", "from", "to" FROM pragma_foreign_key_list(?1)`)
      .bind(name)
      .all<FkRow>();
    fks.set(name, fk.results);
    const cols = await db.prepare(`SELECT name FROM pragma_table_info(?1)`).bind(name).all<{
      name: string;
    }>();
    columns.set(
      name,
      cols.results.map((c) => c.name),
    );
  }
  const owned = new Set<string>(['users']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of names) {
      if (owned.has(name)) continue;
      const refsOwned = (fks.get(name) ?? []).some((f) => owned.has(f.table));
      const cols = columns.get(name) ?? [];
      if (refsOwned || cols.includes('user_id') || cols.includes('account_id')) {
        owned.add(name);
        changed = true;
      }
    }
  }
  return [...owned];
}

describe('contrato de borrado del perfil', () => {
  it('toda tabla con datos del usuario está en USER_DATA_TABLES', async () => {
    expect([...(await userOwnedTables())].sort()).toEqual([...USER_DATA_TABLES].sort());
  });

  it('DELETE_USER_DATA_SQL cubre cada tabla, una sentencia por tabla y en el orden de USER_DATA_TABLES', () => {
    expect(DELETE_USER_DATA_SQL).toHaveLength(USER_DATA_TABLES.length);
    USER_DATA_TABLES.forEach((table, i) => {
      expect(DELETE_USER_DATA_SQL[i]).toMatch(new RegExp(`^DELETE FROM ${table} WHERE `));
    });
  });

  it('el orden va de hijas a padres: ninguna tabla se borra antes que sus hijas', async () => {
    const order = new Map<string, number>(USER_DATA_TABLES.map((t, i) => [t, i]));
    for (const child of USER_DATA_TABLES) {
      const { results } = await db
        .prepare(`SELECT "table" AS parent FROM pragma_foreign_key_list(?1)`)
        .bind(child)
        .all<{ parent: string }>();
      for (const { parent } of results) {
        if (parent === child) continue; // autorreferencia (replaced_by)
        expect(order.get(child)!).toBeLessThan(order.get(parent)!);
      }
    }
  });

  it('toda sentencia se acota por el usuario (?1)', () => {
    for (const sql of DELETE_USER_DATA_SQL) expect(sql).toContain('?1');
  });
});
