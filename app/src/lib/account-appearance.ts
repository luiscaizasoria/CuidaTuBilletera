// Apariencia de la cuenta: color e ícono (docs/003 D12, docs/007 §5.14, docs/008 §6.16).
// Puro y sin dependencias de React. La API es la autoridad del catálogo (enum en Zod): la app solo
// guarda y envía claves. Una clave desconocida se dibuja como el predeterminado.
import { iconsForScope } from './icon-catalog';
import { ApiRequestError, hasAppearanceKeys, type AccountPatch } from './resources-api';

export interface AccountColorOption {
  // Clave de la API: ASCII y sin tilde (`limon`); nunca sale del nombre visible.
  key: string;
  // Nombre visible y accesible.
  label: string;
  card: string;
  tile: string;
}

// Valores `card` y `tile` idénticos a `accountPalette` (theme/tokens.ts); el orden es el de la rejilla.
export const ACCOUNT_COLOR_OPTIONS: readonly AccountColorOption[] = [
  { key: 'aguamarina', label: 'Aguamarina', card: '#E3F6F8', tile: '#BDE9EF' },
  { key: 'lavanda', label: 'Lavanda', card: '#F0EBFF', tile: '#D9CCFF' },
  { key: 'albaricoque', label: 'Albaricoque', card: '#FFF0E0', tile: '#FFD6A8' },
  { key: 'celeste', label: 'Celeste', card: '#E7F1FF', tile: '#C5DBFF' },
  { key: 'rosa', label: 'Rosa', card: '#FDEAF2', tile: '#F8CADD' },
  { key: 'limon', label: 'Limón', card: '#FFF6D6', tile: '#FFE58A' },
];

export interface AccountIconOption {
  key: string;
  label: string;
  glyph: string;
}

// Íconos de cuenta: derivados del catálogo único (icon-catalog.ts), sin los exclusivos de categorías.
// Las 12 claves originales conservan clave, emoji y nombre.
export const ACCOUNT_ICON_OPTIONS: readonly AccountIconOption[] = iconsForScope('account').map(
  (entry) => ({ key: entry.key, label: entry.name, glyph: entry.glyph }),
);

// Opción del catálogo o null (null, vacío o clave desconocida = predeterminado).
export function accountColorOption(key: string | null | undefined): AccountColorOption | null {
  return ACCOUNT_COLOR_OPTIONS.find((option) => option.key === key) ?? null;
}

export function accountIconOption(key: string | null | undefined): AccountIconOption | null {
  return ACCOUNT_ICON_OPTIONS.find((option) => option.key === key) ?? null;
}

// Selección del formulario: null = Predeterminado.
export interface AppearanceDraft {
  color: string | null;
  icono: string | null;
}

export const DEFAULT_APPEARANCE: AppearanceDraft = { color: null, icono: null };

// Valor guardado -> selección inicial: lo desconocido se muestra como Predeterminado.
export function appearanceOf(value: {
  color: string | null;
  icono: string | null;
}): AppearanceDraft {
  return {
    color: accountColorOption(value.color)?.key ?? null,
    icono: accountIconOption(value.icono)?.key ?? null,
  };
}

// Crear: solo se envía lo que el usuario eligió (Predeterminado = el campo no se incluye).
export function buildCreateAppearance(draft: AppearanceDraft): { color?: string; icono?: string } {
  return {
    ...(draft.color !== null ? { color: draft.color } : {}),
    ...(draft.icono !== null ? { icono: draft.icono } : {}),
  };
}

// Editar: solo las diferencias contra lo guardado. Pasar de un valor a Predeterminado envía null;
// de null a Predeterminado no envía nada.
export function buildAppearancePatch(
  stored: { color: string | null; icono: string | null },
  draft: AppearanceDraft,
): Pick<AccountPatch, 'color' | 'icono'> {
  const initial = appearanceOf(stored);
  return {
    ...(draft.color !== initial.color ? { color: draft.color } : {}),
    ...(draft.icono !== initial.icono ? { icono: draft.icono } : {}),
  };
}

export function isAppearanceDirty(
  stored: { color: string | null; icono: string | null },
  draft: AppearanceDraft,
): boolean {
  return Object.keys(buildAppearancePatch(stored, draft)).length > 0;
}

// La API actual responde 400 INVALID_REQUEST a un cuerpo con claves desconocidas (strictObject) y la
// versión nueva con enum puede responder VALIDATION_ERROR: ambos códigos cuentan.
const VALIDATION_CODES = ['VALIDATION_ERROR', 'INVALID_REQUEST'];

// true si el error es un 400 de validación y el cuerpo enviado llevaba color o ícono: la app no
// reintenta a medias; oculta el bloque y avisa.
export function isAppearanceRejection(error: unknown, body: object): boolean {
  return (
    error instanceof ApiRequestError &&
    error.status === 400 &&
    VALIDATION_CODES.includes(error.code) &&
    hasAppearanceKeys(body)
  );
}
