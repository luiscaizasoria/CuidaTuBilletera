import type { Account, Category, Page, ResourcesApi, Transaction } from './lib/resources-api';

export const TS = '2026-10-13T12:00:00.000Z';

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    nombre: 'Efectivo',
    saldoInicial: 1250,
    saldo: 1250,
    archivada: false,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    accountId: 'acc-1',
    nombre: 'Comida',
    descripcion: null,
    tipo: 'egreso',
    icono: 'tag',
    color: '#E53935',
    archivada: false,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    tipo: 'gasto',
    monto: 1500,
    fecha: '2026-10-14',
    nota: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export const pageOf = <T>(items: T[]): Page<T> => ({
  items,
  page: 1,
  pageSize: 100,
  total: items.length,
});

export function fakeResourcesApi(overrides: Partial<ResourcesApi> = {}): jest.Mocked<ResourcesApi> {
  return {
    listAccounts: jest.fn(async () => pageOf([account()])),
    createAccount: jest.fn(async (_t, input) => ({
      account: account({ id: 'acc-new', nombre: input.nombre }),
      categories: [],
    })),
    updateAccount: jest.fn(async (_t, id, input) => account({ id, ...input })),
    listCategories: jest.fn(async () => pageOf([category()])),
    createCategory: jest.fn(async (_t, accountId, input) =>
      category({ id: 'cat-new', accountId, ...input, descripcion: input.descripcion ?? null }),
    ),
    updateCategory: jest.fn(async (_t, id, input) => category({ id, ...input })),
    deleteCategory: jest.fn(async () => undefined),
    listTransactions: jest.fn(async () => pageOf<Transaction>([])),
    createTransaction: jest.fn(async (_t, input) =>
      transaction({ id: 'tx-new', ...input, nota: input.nota ?? null }),
    ),
    updateTransaction: jest.fn(async (_t, id, input) => transaction({ id, ...input })),
    deleteTransaction: jest.fn(async () => undefined),
    getCalendar: jest.fn(async (_t, { accountId, month }) => ({ accountId, month, days: [] })),
    getReportSummary: jest.fn(async (_t, { accountId, desde, hasta }) => ({
      accountId,
      desde,
      hasta,
      ingresos: 0,
      gastos: 0,
      balance: 0,
      cantidad: 0,
    })),
    getReportByCategory: jest.fn(async (_t, { accountId, desde, hasta }) => ({
      accountId,
      desde,
      hasta,
      ingresos: { total: 0, items: [] },
      gastos: { total: 0, items: [] },
    })),
    getReportByPeriod: jest.fn(async (_t, { accountId, desde, hasta, group }) => ({
      accountId,
      desde,
      hasta,
      group,
      points: [],
    })),
    exportFile: jest.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    ...overrides,
  } as jest.Mocked<ResourcesApi>;
}
