import {
  NO_ARROWS,
  chipArrows,
  chipCenterTarget,
  chipRevealTarget,
  chipScrollTarget,
} from './chip-scroll';

describe('chipArrows', () => {
  it('sin medidas no hay flechas ni huecos', () => {
    expect(chipArrows({ x: 0, viewport: 0, content: 900, reserved: false })).toEqual(NO_ARROWS);
    expect(chipArrows({ x: 0, viewport: 300, content: 0, reserved: false })).toEqual(NO_ARROWS);
  });
  it('si todo cabe no hay flechas ni huecos', () => {
    expect(chipArrows({ x: 0, viewport: 312, content: 312, reserved: false })).toEqual(NO_ARROWS);
    // Con huecos reservados el ancho de la fila es viewport + 96: no oscila.
    expect(chipArrows({ x: 0, viewport: 216, content: 312, reserved: true })).toEqual(NO_ARROWS);
  });
  it('posición inicial, intermedia y final', () => {
    const base = { viewport: 216, content: 900, reserved: true };
    expect(chipArrows({ ...base, x: 0 })).toEqual({
      reserved: true,
      canLeft: false,
      canRight: true,
    });
    expect(chipArrows({ ...base, x: 300 })).toEqual({
      reserved: true,
      canLeft: true,
      canRight: true,
    });
    expect(chipArrows({ ...base, x: 684 })).toEqual({
      reserved: true,
      canLeft: true,
      canRight: false,
    });
  });
  it('tolera 1 px en los extremos', () => {
    const base = { viewport: 216, content: 900, reserved: true };
    expect(chipArrows({ ...base, x: 1 }).canLeft).toBe(false);
    expect(chipArrows({ ...base, x: 683.5 }).canRight).toBe(false);
  });
});

describe('chipScrollTarget', () => {
  it('avanza 0,8 × viewport y se acota a los extremos', () => {
    expect(chipScrollTarget(0, 'right', 200, 900)).toBe(160);
    expect(chipScrollTarget(600, 'right', 200, 900)).toBe(700);
    expect(chipScrollTarget(100, 'left', 200, 900)).toBe(0);
    expect(chipScrollTarget(0, 'right', 200, 100)).toBe(0);
  });
});

describe('chipRevealTarget y chipCenterTarget', () => {
  it('desplaza lo mínimo o nada', () => {
    expect(chipRevealTarget(100, 200, 150, 80)).toBeNull();
    expect(chipRevealTarget(100, 200, 60, 80)).toBe(60);
    expect(chipRevealTarget(100, 200, 260, 80)).toBe(140);
  });
  it('centra sin pasar de 0', () => {
    expect(chipCenterTarget(200, 500, 100)).toBe(450);
    expect(chipCenterTarget(200, 10, 40)).toBe(0);
  });
});
