// Límites de protección y de forma de los recursos de cuentas y categorías (Decisión 2B.1).
// Los de largo coinciden con los CHECK de api/migrations/0002_accounts_categories.sql.

// Cuentan también las archivadas: archivar no libera cupo.
export const MAX_ACCOUNTS_PER_USER = 10;
export const MAX_CATEGORIES_PER_ACCOUNT = 60;
export const MAX_RESOURCE_BODY_BYTES = 4096;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export const ACCOUNT_NAME_MAX = 60;
export const CATEGORY_NAME_MAX = 40;
export const CATEGORY_DESCRIPTION_MAX = 200;
export const CATEGORY_ICON_MAX = 40;

// Rango seguro de JavaScript para montos en centavos (Number.MAX_SAFE_INTEGER).
export const MAX_AMOUNT_CENTS = 9_007_199_254_740_991;

// Movimientos (Decisión 3.1). Coinciden con los CHECK de api/migrations/0003_transactions.sql.
export const MAX_TRANSACTION_AMOUNT_CENTS = 99_999_999_999;
export const TRANSACTION_NOTE_MAX = 500;
export const DEFAULT_TRANSACTIONS_PAGE_SIZE = 20;
export const TRANSACTION_MIN_DATE = '2000-01-01';
export const TRANSACTION_MAX_DATE = '2100-12-31';
