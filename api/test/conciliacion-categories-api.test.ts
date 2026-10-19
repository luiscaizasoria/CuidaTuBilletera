import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { ACCOUNT_ICONS } from '../src/lib/account-appearance';
import { DEFAULT_CATEGORIES } from '../src/services/default-categories';
import { count, DB_HOOK_TIMEOUT_MS, freshDb, NOW } from './d1-helpers';
import { api, userWithToken } from './resource-helpers';

// Fase 6 (Decisión 6.1): categorías predeterminadas «Conciliación» de ingreso y egreso.
vi.setConfig({ testTimeout: 30_000, hookTimeout: DB_HOOK_TIMEOUT_MS });

let db: D1Database;
let call: ReturnType<typeof api>;
let token: string;

beforeEach(async () => {
  db = await freshDb();
  call = api(createApp({ now: () => NOW }), db);
  ({ token } = await userWithToken(db));
}, DB_HOOK_TIMEOUT_MS);

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (response: Response) => (await response.json()) as Json;

async function createAccount(as = token): Promise<{ accountId: string; categories: Json[] }> {
  const response = await call('POST', '/accounts', as, { nombre: 'Cuenta', saldoInicial: 10_000 });
  expect(response.status).toBe(201);
  const body = await json(response);
  return { accountId: body.account.id, categories: body.categories };
}

const conc = (categories: Json[], tipo: string) =>
  categories.find((c) => c.nombre === 'Conciliación' && c.tipo === tipo)!;

describe('catálogo predeterminado con Conciliación', () => {
  it('DEFAULT_CATEGORIES tiene 13 entradas sin duplicados y dentro de los contratos', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(13);
    const keys = DEFAULT_CATEGORIES.map((c) => `${c.tipo}:${c.nombre.toLowerCase()}`);
    expect(new Set(keys).size).toBe(13);
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.nombre.length).toBeLessThanOrEqual(40);
      expect(c.nombre).toBe(c.nombre.trim());
      expect(c.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.icono).toMatch(/^[a-z0-9_-]{1,40}$/);
    }
    const concs = DEFAULT_CATEGORIES.filter((c) => c.nombre === 'Conciliación');
    expect(concs.map((c) => c.tipo).sort()).toEqual(['egreso', 'ingreso']);
    for (const c of concs) {
      expect(c).toMatchObject({ icono: 'exchange', color: '#6366F1' });
    }
    expect(ACCOUNT_ICONS).toContain('exchange');
  });

  it('Conciliación va al final de cada grupo', () => {
    const egresos = DEFAULT_CATEGORIES.filter((c) => c.tipo === 'egreso');
    const ingresos = DEFAULT_CATEGORIES.filter((c) => c.tipo === 'ingreso');
    expect(egresos.at(-1)?.nombre).toBe('Conciliación');
    expect(ingresos.at(-1)?.nombre).toBe('Conciliación');
  });

  it('una cuenta nueva recibe 13 categorías con una Conciliación por tipo, diferenciadas', async () => {
    const { accountId, categories } = await createAccount();
    expect(categories).toHaveLength(13);
    expect(await count(db, 'categories', `account_id = '${accountId}'`)).toBe(13);
    const ingreso = conc(categories, 'ingreso');
    const egreso = conc(categories, 'egreso');
    expect(ingreso.id).not.toBe(egreso.id);
    expect(categories.filter((c) => c.nombre === 'Conciliación')).toHaveLength(2);
    for (const c of [ingreso, egreso]) {
      expect(c).toMatchObject({ icono: 'exchange', color: '#6366F1', archivada: false });
      expect(c.nombre.length).toBeLessThanOrEqual(40);
    }
    const names = categories.map((c) => `${c.tipo}:${c.nombre}`);
    expect(new Set(names).size).toBe(13);
  });

  it('el máximo de 60 categorías por cuenta se mantiene', async () => {
    const { MAX_CATEGORIES_PER_ACCOUNT } = await import('../src/lib/limits');
    expect(MAX_CATEGORIES_PER_ACCOUNT).toBe(60);
  });
});

describe('Conciliación se comporta como una categoría normal', () => {
  const move = (
    accountId: string,
    categoryId: string,
    tipo: string,
    monto: number,
    fecha: string,
  ) => call('POST', '/transactions', token, { accountId, categoryId, tipo, monto, fecha });

  it('suma y resta el saldo y aparece en historial, calendario, reportes y exportación', async () => {
    const { accountId, categories } = await createAccount();
    const ingreso = conc(categories, 'ingreso');
    const egreso = conc(categories, 'egreso');
    expect((await move(accountId, ingreso.id, 'ingreso', 2500, '2026-10-05')).status).toBe(201);
    expect((await move(accountId, egreso.id, 'gasto', 700, '2026-10-06')).status).toBe(201);

    const balance = await json(await call('GET', `/accounts/${accountId}/balance`, token));
    expect(balance).toMatchObject({ saldo: 11_800, ingresos: 2500, gastos: 700 });

    const history = await json(await call('GET', `/transactions?account_id=${accountId}`, token));
    expect(history.total).toBe(2);
    expect(history.items.map((t: Json) => t.categoryId).sort()).toEqual(
      [ingreso.id, egreso.id].sort(),
    );

    const range = `account_id=${accountId}&desde=2026-10-01&hasta=2026-10-31`;
    const calendar = await json(
      await call('GET', `/calendar?account_id=${accountId}&month=2026-10`, token),
    );
    expect(JSON.stringify(calendar)).toContain('2026-10-05');
    const summary = await json(await call('GET', `/reports/summary?${range}`, token));
    expect(summary).toMatchObject({ ingresos: 2500, gastos: 700 });
    const byCategory = await json(await call('GET', `/reports/by-category?${range}`, token));
    expect(JSON.stringify(byCategory)).toContain(ingreso.id);
    expect(JSON.stringify(byCategory)).toContain(egreso.id);
    expect(JSON.stringify(byCategory)).toContain('Conciliación');

    const csv = await (await call('GET', `/export?${range}`, token)).text();
    expect(csv.match(/Conciliación/g)).toHaveLength(2);
  });

  it('es editable, archivable y eliminable sin movimientos', async () => {
    const { categories } = await createAccount();
    const ingreso = conc(categories, 'ingreso');
    const egreso = conc(categories, 'egreso');
    const edit = await call('PATCH', `/categories/${ingreso.id}`, token, {
      nombre: 'Ajustes',
      color: '#111111',
    });
    expect(edit.status).toBe(200);
    expect((await json(edit)).category).toMatchObject({ nombre: 'Ajustes', color: '#111111' });
    const archive = await call('PATCH', `/categories/${egreso.id}`, token, { archivada: true });
    expect(archive.status).toBe(200);
    expect((await json(archive)).category.archivada).toBe(true);
    const del = await call('DELETE', `/categories/${ingreso.id}`, token);
    expect(del.status).toBe(204);
    expect(await count(db, 'categories', `id = '${ingreso.id}'`)).toBe(0);
  });

  it('con movimientos no se elimina y el aislamiento por usuario se conserva', async () => {
    const { accountId, categories } = await createAccount();
    const egreso = conc(categories, 'egreso');
    await move(accountId, egreso.id, 'gasto', 100, '2026-10-05');
    const del = await call('DELETE', `/categories/${egreso.id}`, token);
    expect(del.status).toBe(409);

    const other = await userWithToken(db, 'otro@example.com');
    const theirs = await createAccount(other.token);
    expect(theirs.categories.map((c) => c.id)).not.toContain(egreso.id);
    expect(
      (await call('PATCH', `/categories/${egreso.id}`, other.token, { nombre: 'X' })).status,
    ).toBe(404);
    expect((await call('DELETE', `/categories/${egreso.id}`, other.token)).status).toBe(404);
    expect(
      (await move(theirs.accountId, egreso.id, 'gasto', 100, '2026-10-05')).status,
    ).toBeGreaterThanOrEqual(400);
  });
});
