// Catálogo cerrado de personalización de cuenta (D12 de docs/003). La API es la autoridad: D1 solo
// restringe la forma (api/migrations/0004_account_appearance.sql). Son identificadores, no hex.
export const ACCOUNT_COLORS = [
  'aguamarina',
  'lavanda',
  'albaricoque',
  'celeste',
  'rosa',
  'limon',
] as const;

export const ACCOUNT_ICONS = [
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
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];
export type AccountIcon = (typeof ACCOUNT_ICONS)[number];
