import { beforeEach, describe, expect, it } from 'vitest';
import { findAccount, updateAccount } from '../src/db/account-repository';
import { deleteCategory, updateCategory } from '../src/db/category-repository';
import {
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertUser,
  plusMs,
  NOW,
  rowOf,
} from './d1-helpers';

// Pruebas directas de repositorio: los UPDATE y DELETE deben acotarse por usuario por sí mismos,
// sin depender de una comprobación previa del servicio.
let db: D1Database;
let owner: string;
let intruder: string;
let accountId: string;
let categoryId: string;

beforeEach(async () => {
  db = await freshDb();
  owner = await insertUser(db, { google_sub: 'owner' });
  intruder = await insertUser(db, { google_sub: 'intruder' });
  accountId = await insertAccount(db, owner, { nombre: 'Original' });
  categoryId = await insertCategory(db, accountId, { nombre: 'Original' });
}, DB_HOOK_TIMEOUT_MS);

const later = plusMs(NOW, 60_000);

describe('repositorios: filas de otro usuario', () => {
  it('updateAccount de otro usuario devuelve null y no modifica la fila', async () => {
    const before = await rowOf(db, 'accounts', accountId);
    const result = await updateAccount(
      db,
      intruder,
      accountId,
      { nombre: 'X', archivada: true },
      later,
    );
    expect(result).toBeNull();
    expect(await rowOf(db, 'accounts', accountId)).toEqual(before);
    expect(await findAccount(db, owner, accountId)).not.toBeNull();
  });

  it('updateCategory de otro usuario devuelve null y no modifica la fila', async () => {
    const before = await rowOf(db, 'categories', categoryId);
    const result = await updateCategory(
      db,
      intruder,
      categoryId,
      { nombre: 'X', descripcion: 'd', icono: 'x', color: '#000000', archivada: true },
      later,
    );
    expect(result).toBeNull();
    expect(await rowOf(db, 'categories', categoryId)).toEqual(before);
  });

  it('deleteCategory de otro usuario devuelve false y no borra la fila', async () => {
    expect(await deleteCategory(db, intruder, categoryId)).toBe(false);
    expect(await rowOf(db, 'categories', categoryId)).not.toBeNull();
  });

  it('el propietario sí actualiza y borra', async () => {
    expect(await updateAccount(db, owner, accountId, { nombre: 'Nuevo' }, later)).toMatchObject({
      nombre: 'Nuevo',
    });
    expect(await updateCategory(db, owner, categoryId, { nombre: 'Nuevo' }, later)).toMatchObject({
      nombre: 'Nuevo',
    });
    expect(await deleteCategory(db, owner, categoryId)).toBe(true);
  });
});
