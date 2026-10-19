import {
  accountPalette,
  brandGoogle,
  colors,
  headerPigSize,
  moduleColors,
  screenMargin,
  shadows,
  sizes,
  spacing,
  typography,
} from './tokens';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('tokens', () => {
  it('sizes tiene exactamente 32 claves con los valores aprobados', () => {
    expect(Object.keys(sizes)).toHaveLength(32);
    expect(sizes).toEqual({
      touchMin: 48,
      tabHeight: 62,
      contextBar: 56,
      contextBarCompact: 36,
      fab: 56,
      primaryTall: 52,
      accountCardMin: 88,
      accountCardMinWide: 92,
      accountIcon: 52,
      avatar: 40,
      tabMinWidth: 48,
      tabPillPadX: 10,
      chipSmHeight: 36,
      chipHitSlop: 6,
      segmentOption: 48,
      categoryOptionMin: 56,
      categoryIcon: 32,
      dateCell: 48,
      calendarCellHeight: 52,
      headerPig: 72,
      headerPigWide: 96,
      headerPigLargeFont: 48,
      emptyPig: 120,
      balanceCardMin: 132,
      balanceCardPig: 104,
      moduleTile: 36,
      moduleTileSm: 28,
      monthArrow: 32,
      categoryBar: 10,
      googleLogo: 20,
      loginMark: 144,
      loginPig: 120,
    });
  });

  it('colores clave coinciden con docs/008 §11', () => {
    expect(colors).toMatchObject({
      brand800: '#0B4A46',
      brand700: '#0F5F5A',
      brand500: '#1F8A80',
      brand100: '#D3EBF0',
      bg: '#FFFBF5',
      surface: '#FFFFFF',
      segBg: '#F3EEE6',
      text: '#17211F',
      text2: '#4B5653',
      text3: '#5F6B68',
      border: '#EEE7DC',
      borderStrong: '#7E8A86',
      incomeText: '#0E6A3D',
      expenseText: '#B42A20',
      yellowText: '#6B4E00',
    });
    for (const v of Object.values(colors)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('paletas y escalas completas', () => {
    expect(accountPalette).toHaveLength(6);
    expect(Object.keys(moduleColors)).toHaveLength(5);
    expect(spacing.xxl).toBe(32);
    expect(Object.keys(typography)).toHaveLength(14);
    expect(shadows.card.elevation).toBe(1);
    expect(shadows.raised.elevation).toBe(4);
  });

  it.each([
    ['text', 'bg'],
    ['text', 'surface'],
    ['text2', 'surface'],
    ['text3', 'surface'],
    ['white', 'brand700'],
    ['white', 'brand800'],
    ['brand700', 'surface'],
    ['brand700', 'segBg'],
    ['expenseText', 'surface'],
    ['incomeText', 'surface'],
    ['yellowText', 'surface'],
    ['white', 'text'],
  ] as const)('contraste %s sobre %s >= 4.5', (fg, bg) => {
    expect(ratio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('tokens no cromáticos de R3 (docs/008 §6.13)', () => {
    expect(typography.amountInput).toEqual({ fontSize: 28, lineHeight: 34, fontWeight: '800' });
    expect(sizes.dateCell).toBe(48);
    expect(sizes.categoryIcon).toBe(32);
  });

  it('R5.1: brandGoogle es un objeto aparte de colors y cumple la guía de marca (docs/008 §6.15.7)', () => {
    expect(brandGoogle).toEqual({
      bg: '#FFFFFF',
      border: '#747775',
      text: '#1F1F1F',
      pressed: '#E6E6E6',
    });
    expect(Object.values(colors)).not.toContain('#747775');
    expect(Object.values(colors)).not.toContain('#1F1F1F');
    expect(ratio(brandGoogle.text, brandGoogle.bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(brandGoogle.text, brandGoogle.pressed)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(brandGoogle.border, brandGoogle.bg)).toBeGreaterThanOrEqual(3);
  });

  it('R5.1: tamaños nuevos del Login y del logotipo de Google', () => {
    expect(sizes.googleLogo).toBe(20);
    expect(sizes.loginMark).toBe(144);
    expect(sizes.loginPig).toBe(120);
  });

  it('borde fuerte >= 3:1 sobre superficie', () => {
    expect(ratio(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('screenMargin (docs/003 R4 D6)', () => {
  it.each([
    [320, 16],
    [360, 16],
    [399, 16],
    [400, 20],
    [412, 20],
    [480, 20],
  ])('ancho %s dp -> margen %s dp', (width, margin) => {
    expect(screenMargin(width)).toBe(margin);
  });
});

describe('headerPigSize (alcancía del encabezado)', () => {
  it('no incluye pigZoom', () => {
    expect(sizes).not.toHaveProperty('pigZoom');
  });

  it.each([
    [320, 1, 0],
    [340, 1, 0],
    [341, 1, 72],
    [360, 1, 72],
    [399, 1, 72],
    [400, 1, 96],
    [412, 1, 96],
    [360, 1.29, 72],
    [360, 1.3, 48],
    [412, 1.74, 48],
    [360, 1.75, 0],
    [320, 1.3, 0],
  ])('ancho %s y fuente %s: %s dp', (width, fontScale, size) => {
    expect(headerPigSize(width, fontScale)).toBe(size);
  });
});
