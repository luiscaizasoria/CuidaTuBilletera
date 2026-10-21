// Borrado físico del perfil completo de un usuario (docs/001 §5 «Eliminación del perfil»).
// Solo persistencia: sin JWT, sin HTTP y sin Hono.

// Tablas con datos del usuario, de hijas a padres. Toda tabla nueva con user_id/account_id (o FK
// transitiva a users) debe agregarse aquí y a DELETE_USER_DATA_SQL; delete-me-contract.test.ts lo
// verifica contra el esquema real.
export const USER_DATA_TABLES = [
  'transactions',
  'categories',
  'accounts',
  'refresh_tokens',
  'users',
] as const;

// Todas las sentencias se acotan por el id del usuario (?1). No dependen de la cascada de claves
// foráneas: se borra explícitamente de hijas a padres (transactions.category_id es RESTRICT).
export const DELETE_USER_DATA_SQL: readonly string[] = [
  'DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?1)',
  'DELETE FROM categories WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?1)',
  'DELETE FROM accounts WHERE user_id = ?1',
  'DELETE FROM refresh_tokens WHERE user_id = ?1',
  'DELETE FROM users WHERE id = ?1',
];

// Un único db.batch atómico: o se borra todo o no se borra nada. No comprueba `changes`, así que
// repetirlo sobre un usuario inexistente no falla.
export async function deleteUserData(db: D1Database, userId: string): Promise<void> {
  await db.batch(DELETE_USER_DATA_SQL.map((sql) => db.prepare(sql).bind(userId)));
}
