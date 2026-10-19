import { accountPalette } from '../theme/tokens';
import { CATEGORY_ICON_OPTIONS } from './category-appearance';
import {
  ACCOUNT_COLOR_OPTIONS,
  ACCOUNT_ICON_OPTIONS,
  accountColorOption,
  accountIconOption,
  appearanceOf,
  buildAppearancePatch,
  buildCreateAppearance,
  DEFAULT_APPEARANCE,
  isAppearanceDirty,
  isAppearanceRejection,
} from './account-appearance';
import { ApiRequestError } from './resources-api';
import { AuthError } from './auth-types';

describe('catálogo de apariencia de cuenta', () => {
  it('seis colores con claves ASCII, `limon` sin tilde y valores iguales a accountPalette', () => {
    expect(ACCOUNT_COLOR_OPTIONS.map((o) => o.key)).toEqual([
      'aguamarina',
      'lavanda',
      'albaricoque',
      'celeste',
      'rosa',
      'limon',
    ]);
    ACCOUNT_COLOR_OPTIONS.forEach((option, i) => {
      expect(option.key).toMatch(/^[a-z]+$/);
      expect(option.card).toBe(accountPalette[i]!.card);
      expect(option.tile).toBe(accountPalette[i]!.tile);
    });
    expect(accountColorOption('limon')?.label).toBe('Limón');
  });

  it('246 íconos de cuenta (el catálogo sin los 3 exclusivos de categorías) con las 12 claves originales intactas', () => {
    expect(ACCOUNT_ICON_OPTIONS).toHaveLength(246);
    const keys = ACCOUNT_ICON_OPTIONS.map((o) => o.key);
    for (const exclusive of ['ellipsis', 'plus-circle', 'tag'])
      expect(keys).not.toContain(exclusive);
    // Clave, nombre y emoji de las 12 de antes (✈️ y 🛍️ con U+FE0F).
    const original: [string, string, string][] = [
      ['wallet', 'Billetera', '👛'],
      ['card', 'Tarjeta', '💳'],
      ['bank', 'Banco', '🏦'],
      ['piggy-bank', 'Alcancía', '🐷'],
      ['cash', 'Efectivo', '💵'],
      ['trending-up', 'Inversiones', '📈'],
      ['briefcase', 'Trabajo', '💼'],
      ['home', 'Hogar', '🏠'],
      ['plane', 'Viajes', '✈️'],
      ['gift', 'Regalos', '🎁'],
      ['shopping-bag', 'Compras', '🛍️'],
      ['money-bag', 'Ahorros', '💰'],
    ];
    for (const [key, label, glyph] of original) {
      expect(accountIconOption(key)).toEqual({ key, label, glyph });
    }
    expect(accountIconOption('plane')?.glyph).toBe('✈️');
    expect(accountIconOption('shopping-bag')?.glyph).toBe('🛍️');
  });

  it('todas las claves de cuenta cumplen el patrón de la API', () => {
    for (const option of ACCOUNT_ICON_OPTIONS) expect(option.key).toMatch(/^[a-z0-9-]{1,20}$/);
  });

  it('los glifos compartidos coinciden con el catálogo de categorías', () => {
    for (const key of ['briefcase', 'home', 'plane', 'gift', 'shopping-bag', 'money-bag']) {
      expect(accountIconOption(key)?.glyph).toBe(
        CATEGORY_ICON_OPTIONS.find((o) => o.slug === key)?.glyph,
      );
    }
  });

  it('null, vacío y claves desconocidas no resuelven a ninguna opción', () => {
    for (const value of [null, undefined, '', 'limón', 'zzz']) {
      expect(accountColorOption(value)).toBeNull();
      expect(accountIconOption(value)).toBeNull();
    }
  });
});

describe('buildCreateAppearance', () => {
  it('Predeterminado no envía nada; solo lo elegido', () => {
    expect(buildCreateAppearance(DEFAULT_APPEARANCE)).toEqual({});
    expect(buildCreateAppearance({ color: 'limon', icono: null })).toEqual({ color: 'limon' });
    expect(buildCreateAppearance({ color: null, icono: 'bank' })).toEqual({ icono: 'bank' });
    expect(buildCreateAppearance({ color: 'rosa', icono: 'gift' })).toEqual({
      color: 'rosa',
      icono: 'gift',
    });
  });
});

describe('buildAppearancePatch e isAppearanceDirty', () => {
  const stored = { color: 'rosa', icono: null };

  it('sin cambios no envía nada', () => {
    expect(buildAppearancePatch(stored, { color: 'rosa', icono: null })).toEqual({});
    expect(isAppearanceDirty(stored, { color: 'rosa', icono: null })).toBe(false);
  });

  it('cambiar solo el color envía solo color', () => {
    expect(buildAppearancePatch(stored, { color: 'celeste', icono: null })).toEqual({
      color: 'celeste',
    });
  });

  it('de un valor guardado a Predeterminado envía null; de null a Predeterminado, nada', () => {
    expect(buildAppearancePatch(stored, { color: null, icono: null })).toEqual({ color: null });
    expect(buildAppearancePatch({ color: null, icono: null }, DEFAULT_APPEARANCE)).toEqual({});
  });

  it('elegir un ícono desde null lo envía', () => {
    expect(buildAppearancePatch(stored, { color: 'rosa', icono: 'cash' })).toEqual({
      icono: 'cash',
    });
    expect(isAppearanceDirty(stored, { color: 'rosa', icono: 'cash' })).toBe(true);
  });

  it('una clave guardada desconocida se muestra como Predeterminado y no se envía si no se toca', () => {
    const unknown = { color: 'violeta-nuevo', icono: 'cohete-viejo' };
    expect(appearanceOf(unknown)).toEqual(DEFAULT_APPEARANCE);
    expect(buildAppearancePatch(unknown, DEFAULT_APPEARANCE)).toEqual({});
    expect(buildAppearancePatch(unknown, { color: 'rosa', icono: null })).toEqual({
      color: 'rosa',
    });
  });
});

describe('isAppearanceRejection', () => {
  const body = { color: 'rosa' };
  it('400 de validación con apariencia en el cuerpo', () => {
    expect(isAppearanceRejection(new ApiRequestError(400, 'VALIDATION_ERROR'), body)).toBe(true);
    expect(isAppearanceRejection(new ApiRequestError(400, 'INVALID_REQUEST'), body)).toBe(true);
    expect(
      isAppearanceRejection(new ApiRequestError(400, 'INVALID_REQUEST'), { icono: null }),
    ).toBe(true);
  });
  it('no cuenta sin apariencia, con otro código o estado, ni con otros errores', () => {
    expect(
      isAppearanceRejection(new ApiRequestError(400, 'VALIDATION_ERROR'), { nombre: 'a' }),
    ).toBe(false);
    expect(isAppearanceRejection(new ApiRequestError(400, 'NOT_FOUND'), body)).toBe(false);
    expect(isAppearanceRejection(new ApiRequestError(404, 'VALIDATION_ERROR'), body)).toBe(false);
    expect(isAppearanceRejection(new AuthError('network'), body)).toBe(false);
  });
});
