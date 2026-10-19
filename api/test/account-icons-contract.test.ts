import { describe, expect, it } from 'vitest';
// @ts-expect-error: importación ?raw de Vite, sin tipos.
import appCatalogSource from '../../app/src/lib/icon-catalog.ts?raw';
import { ACCOUNT_ICONS } from '../src/lib/account-appearance';

const ORIGINAL = [
  'wallet',
  'card',
  'bank',
  'piggy-bank',
  'cash',
  'trending-up',
  'briefcase',
  'home',
  'plane',
  'gift',
  'shopping-bag',
  'money-bag',
];
const CATEGORY_ONLY = ['tag', 'ellipsis', 'plus-circle'];

describe('catálogo de íconos de cuenta', () => {
  it('tiene 246 claves únicas con la forma ^[a-z0-9-]{1,20}$ (CHECK de la migración 0004)', () => {
    expect(ACCOUNT_ICONS).toHaveLength(246);
    expect(new Set(ACCOUNT_ICONS).size).toBe(ACCOUNT_ICONS.length);
    for (const key of ACCOUNT_ICONS) expect(key).toMatch(/^[a-z0-9-]{1,20}$/);
  });

  it('conserva las 12 claves originales, en su orden y al inicio', () => {
    expect(ACCOUNT_ICONS.slice(0, 12)).toEqual(ORIGINAL);
  });

  it('no incluye las claves de uso exclusivo de categoría', () => {
    for (const key of CATEGORY_ONLY) expect(ACCOUNT_ICONS).not.toContain(key);
  });

  // Contrato con la app sin acoplar paquetes: se lee el archivo como texto y se comparan las claves.
  it('coincide con las entradas del catálogo de la app sin scope category', () => {
    const source = appCatalogSource as string;
    const start = source.indexOf('export const ICON_CATALOG');
    const body = source.slice(start, source.indexOf('\n];', start));
    const appKeys = body
      .split(/\n {2}\{\s*/)
      .slice(1)
      .filter((entry) => !entry.includes("scope: 'category'"))
      .map((entry) => /key: '([^']+)'/.exec(entry)![1]);
    expect(appKeys).toHaveLength(246);
    expect([...ACCOUNT_ICONS].sort()).toEqual([...appKeys].sort());
  });
});
