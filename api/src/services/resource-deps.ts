import { categoryHasTransactions } from '../db/category-repository';

// Dependencias inyectables de los recursos de cuentas y categorías (reloj, ids y la regla
// «categoría sin movimientos»), como en el resto de la API.
export interface ResourceDeps {
  now: () => Date;
  idGenerator: () => string;
  categoryHasTransactions: (db: D1Database, categoryId: string) => Promise<boolean>;
}

export const defaultResourceDeps: ResourceDeps = {
  now: () => new Date(),
  idGenerator: () => crypto.randomUUID(),
  categoryHasTransactions,
};

export function resolveResourceDeps(deps?: Partial<ResourceDeps>): ResourceDeps {
  return { ...defaultResourceDeps, ...definedOnly(deps) };
}

function definedOnly(deps: Partial<ResourceDeps> = {}): Partial<ResourceDeps> {
  return Object.fromEntries(
    Object.entries(deps).filter(([, value]) => value !== undefined),
  ) as Partial<ResourceDeps>;
}
