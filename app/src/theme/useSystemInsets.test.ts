import { FALLBACK_BOTTOM_DP, FALLBACK_TOP_DP, resolveInsets } from './useSystemInsets';

describe('resolveInsets', () => {
  it('Android: usa los insets reales válidos', () => {
    expect(resolveInsets({ insets: { top: 40, bottom: 20 }, platform: 'android' })).toEqual({
      top: 40,
      bottom: 20,
    });
  });

  it('Android: un 0 legítimo se respeta (barra de navegación oculta)', () => {
    expect(resolveInsets({ insets: { top: 0, bottom: 0 }, platform: 'android' })).toEqual({
      top: 0,
      bottom: 0,
    });
  });

  it.each([NaN, Infinity, -Infinity, -1])('Android: %s usa el respaldo de ese campo', (bad) => {
    expect(resolveInsets({ insets: { top: bad, bottom: 20 }, platform: 'android' })).toEqual({
      top: FALLBACK_TOP_DP,
      bottom: 20,
    });
    expect(resolveInsets({ insets: { top: 30, bottom: bad }, platform: 'android' })).toEqual({
      top: 30,
      bottom: FALLBACK_BOTTOM_DP,
    });
  });

  it('Android: sin provider (null/undefined) usa ambos respaldos', () => {
    for (const insets of [null, undefined]) {
      expect(resolveInsets({ insets, platform: 'android' })).toEqual({
        top: FALLBACK_TOP_DP,
        bottom: FALLBACK_BOTTOM_DP,
      });
    }
  });

  it('otras plataformas devuelven 0', () => {
    expect(resolveInsets({ insets: { top: 30, bottom: 20 }, platform: 'ios' })).toEqual({
      top: 0,
      bottom: 0,
    });
  });

  it('respaldos con los valores definidos', () => {
    expect(FALLBACK_TOP_DP).toBe(32);
    expect(FALLBACK_BOTTOM_DP).toBe(48);
  });
});
