import { computeInsets, FALLBACK_BOTTOM_DP, FALLBACK_TOP_DP } from './useSystemInsets';

describe('computeInsets', () => {
  it('Android: usa la altura de la barra de estado y calcula la inferior', () => {
    expect(
      computeInsets({ screenH: 900, windowH: 820, statusBarH: 30, platform: 'android' }),
    ).toEqual({
      top: 30,
      bottom: 50,
    });
  });

  it('Android: sin altura de barra de estado usa el respaldo superior', () => {
    for (const statusBarH of [0, undefined, null]) {
      expect(
        computeInsets({ screenH: 900, windowH: 800, statusBarH, platform: 'android' }).top,
      ).toBe(FALLBACK_TOP_DP);
    }
  });

  it('Android: inferior 0 usa el respaldo inferior', () => {
    expect(
      computeInsets({ screenH: 800, windowH: 776, statusBarH: 24, platform: 'android' }),
    ).toEqual({
      top: 24,
      bottom: FALLBACK_BOTTOM_DP,
    });
  });

  it('Android: nunca devuelve valores negativos', () => {
    const r = computeInsets({ screenH: 700, windowH: 800, statusBarH: 24, platform: 'android' });
    expect(r.bottom).toBe(FALLBACK_BOTTOM_DP);
  });

  it('otras plataformas devuelven 0', () => {
    expect(computeInsets({ screenH: 900, windowH: 800, statusBarH: 30, platform: 'ios' })).toEqual({
      top: 0,
      bottom: 0,
    });
  });

  it('respaldos con los valores definidos', () => {
    expect(FALLBACK_TOP_DP).toBe(24);
    expect(FALLBACK_BOTTOM_DP).toBe(48);
  });
});
