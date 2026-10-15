import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_NAME_MAX,
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_ICON_MAX,
  CATEGORY_NAME_MAX,
  MAX_AMOUNT_CENTS,
} from '../src/lib/limits';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertAccount,
  insertCategory,
  insertUser,
  iso,
  NOW,
  rowOf,
  uuid,
} from './d1-helpers';

// Integración sobre D1 local con el esquema real de api/migrations/0002_accounts_categories.sql.
let db: D1Database;
let userId: string;
let accountId: string;
beforeEach(async () => {
  db = await freshDb();
  userId = await insertUser(db);
  accountId = await insertAccount(db, userId);
}, DB_HOOK_TIMEOUT_MS);

const CHECK = /CHECK constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;

describe('migración 0002', () => {
  it('se aplica después de la 0001, en orden, y crea tablas e índices', async () => {
    const { results } = await db
      .prepare('SELECT name FROM d1_migrations ORDER BY id')
      .all<{ name: string }>();
    expect(results.map((row) => row.name.replace(/\.sql$/, ''))).toEqual([
      '0001_users_refresh_tokens',
      '0002_accounts_categories',
    ]);
    const { results: objects } = await db
      .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all<{ name: string }>();
    expect(objects.map((row) => row.name)).toEqual(
      expect.arrayContaining(['accounts', 'categories', 'ix_accounts_user']),
    );
    expect(objects.map((row) => row.name)).not.toContain('transactions');
  });

  it('las tablas arrancan vacías salvo lo insertado por la prueba', async () => {
    expect(await count(db, 'accounts')).toBe(1);
    expect(await count(db, 'categories')).toBe(0);
  });
});

describe('accounts', () => {
  it('acepta una cuenta válida con saldo 0 y activa por defecto', async () => {
    expect(await rowOf(db, 'accounts', accountId)).toMatchObject({
      saldo_inicial: 0,
      archivada: 0,
    });
  });

  it('exige un usuario existente', async () => {
    await expect(insertAccount(db, uuid())).rejects.toThrow(FOREIGN_KEY);
  });

  it.each([
    ['id que no es UUID', { id: 'abc' }],
    ['id con mayúsculas', { id: uuid().toUpperCase() }],
    ['nombre vacío', { nombre: '' }],
    ['nombre solo espacios', { nombre: '   ' }],
    ['nombre con espacios en los extremos', { nombre: ' Caja' }],
    ['nombre de 61 caracteres', { nombre: 'a'.repeat(ACCOUNT_NAME_MAX + 1) }],
    ['saldo decimal', { saldo_inicial: 10.5 }],
    ['saldo como texto no numérico', { saldo_inicial: 'abc' }],
    ['saldo por encima del rango', { saldo_inicial: MAX_AMOUNT_CENTS + 2 }],
    ['saldo por debajo del rango', { saldo_inicial: -MAX_AMOUNT_CENTS - 2 }],
    ['archivada distinta de 0 o 1', { archivada: 2 }],
    ['created_at con otro formato', { created_at: '2026-10-13' }],
    ['updated_at imposible', { updated_at: '2026-02-30T00:00:00.000Z' }],
  ])('rechaza %s', async (_name, overrides) => {
    await expect(insertAccount(db, userId, overrides)).rejects.toThrow(CHECK);
  });

  it('acepta el nombre máximo y los saldos en los extremos del rango, también negativos', async () => {
    await insertAccount(db, userId, { nombre: 'a'.repeat(ACCOUNT_NAME_MAX) });
    await insertAccount(db, userId, { saldo_inicial: MAX_AMOUNT_CENTS });
    await insertAccount(db, userId, { saldo_inicial: -MAX_AMOUNT_CENTS });
  });

  it('permite nombres de cuenta repetidos', async () => {
    await insertAccount(db, userId, { nombre: 'Cuenta de prueba' });
    expect(await count(db, 'accounts')).toBe(2);
  });
});

describe('categories', () => {
  it('acepta una categoría válida con archivada 0 por defecto', async () => {
    const id = await insertCategory(db, accountId);
    expect(await rowOf(db, 'categories', id)).toMatchObject({ archivada: 0, descripcion: null });
  });

  it('exige una cuenta existente', async () => {
    await expect(insertCategory(db, uuid())).rejects.toThrow(FOREIGN_KEY);
  });

  it.each([
    ['nombre vacío', { nombre: '' }],
    ['nombre con espacios en los extremos', { nombre: 'Comida ' }],
    ['nombre de 41 caracteres', { nombre: 'a'.repeat(CATEGORY_NAME_MAX + 1) }],
    ['descripción vacía', { descripcion: '' }],
    ['descripción de 201 caracteres', { descripcion: 'a'.repeat(CATEGORY_DESCRIPTION_MAX + 1) }],
    ['tipo desconocido', { tipo: 'gasto' }],
    ['icono vacío', { icono: '' }],
    ['icono de 41 caracteres', { icono: 'a'.repeat(CATEGORY_ICON_MAX + 1) }],
    ['color sin almohadilla', { color: '6B7280A' }],
    ['color corto', { color: '#FFF' }],
    ['color con caracteres no hexadecimales', { color: '#GGGGGG' }],
    ['color en minúsculas', { color: '#6b7280' }],
    ['archivada distinta de 0 o 1', { archivada: 3 }],
    ['created_at con otro formato', { created_at: 'ayer' }],
  ])('rechaza %s', async (_name, overrides) => {
    await expect(insertCategory(db, accountId, overrides)).rejects.toThrow(CHECK);
  });

  it('acepta los largos máximos de nombre, descripción e icono', async () => {
    await insertCategory(db, accountId, {
      nombre: 'a'.repeat(CATEGORY_NAME_MAX),
      descripcion: 'd'.repeat(CATEGORY_DESCRIPTION_MAX),
      icono: 'i'.repeat(CATEGORY_ICON_MAX),
    });
  });

  it('el nombre es único por cuenta y tipo, sin distinguir mayúsculas ASCII', async () => {
    await insertCategory(db, accountId, { nombre: 'Comida' });
    await expect(insertCategory(db, accountId, { nombre: 'Comida' })).rejects.toThrow(UNIQUE);
    await expect(insertCategory(db, accountId, { nombre: 'COMIDA' })).rejects.toThrow(UNIQUE);
    await expect(insertCategory(db, accountId, { nombre: 'comida' })).rejects.toThrow(UNIQUE);
  });

  it('permite el mismo nombre en otro tipo o en otra cuenta', async () => {
    await insertCategory(db, accountId, { nombre: 'Comida', tipo: 'egreso' });
    await insertCategory(db, accountId, { nombre: 'Comida', tipo: 'ingreso' });
    const other = await insertAccount(db, userId);
    await insertCategory(db, other, { nombre: 'Comida', tipo: 'egreso' });
    expect(await count(db, 'categories')).toBe(3);
  });

  it('la unicidad de NOCASE no cubre las letras con tilde (lo resuelve la API)', async () => {
    await insertCategory(db, accountId, { nombre: 'Ámbar' });
    await insertCategory(db, accountId, { nombre: 'ámbar' });
    expect(await count(db, 'categories')).toBe(2);
  });
});

describe('ON DELETE CASCADE', () => {
  it('borrar el usuario borra sus cuentas y las categorías de ellas', async () => {
    await insertCategory(db, accountId);
    const other = await insertUser(db, { google_sub: 'otro' });
    const otherAccount = await insertAccount(db, other);
    await insertCategory(db, otherAccount);

    await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();

    expect(await count(db, 'accounts')).toBe(1);
    expect(await count(db, 'categories')).toBe(1);
    expect(await rowOf(db, 'accounts', otherAccount)).not.toBeNull();
  });

  it('borrar una cuenta borra sus categorías', async () => {
    await insertCategory(db, accountId);
    await db.prepare('DELETE FROM accounts WHERE id = ?1').bind(accountId).run();
    expect(await count(db, 'categories')).toBe(0);
  });
});

describe('timestamps', () => {
  it('acepta el formato de toISOString()', async () => {
    await insertAccount(db, userId, { created_at: iso(NOW), updated_at: iso(NOW) });
  });
});
