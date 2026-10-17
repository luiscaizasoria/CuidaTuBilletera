import {
  CATEGORY_ICON_OPTIONS,
  categoryFill,
  categoryGlyph,
  DEFAULT_CATEGORY_FILL,
  defaultCategoryGlyph,
} from './category-appearance';

// Valores esperados de docs/008 §11 (categoryFillExpected).
const EXPECTED: Record<string, string> = {
  '#F97316': '#EF6E15',
  '#3B82F6': '#3B82F6',
  '#EAB308': '#B98D06',
  '#EF4444': '#EF4444',
  '#8B5CF6': '#8B5CF6',
  '#14B8A6': '#12A695',
  '#EC4899': '#EC4899',
  '#6B7280': '#6B7280',
  '#22C55E': '#1DA951',
  '#06B6D4': '#05A2BD',
  '#84CC16': '#6AA312',
};

describe('categoryFill', () => {
  it.each(Object.entries(EXPECTED))('%s -> %s', (input, expected) => {
    expect(categoryFill(input)).toBe(expected);
  });

  it('acepta minúsculas y devuelve mayúsculas', () => {
    expect(categoryFill('#f97316')).toBe('#EF6E15');
  });

  it('un valor que no es #RRGGBB usa el gris neutro', () => {
    expect(categoryFill('rojo')).toBe(DEFAULT_CATEGORY_FILL);
    expect(categoryFill('#FFF')).toBe(DEFAULT_CATEGORY_FILL);
    expect(categoryFill('')).toBe(DEFAULT_CATEGORY_FILL);
  });

  it('un color blanco se oscurece hasta 3:1 sin pasar de negro', () => {
    expect(categoryFill('#FFFFFF')).toMatch(/^#[0-9A-F]{6}$/);
    expect(categoryFill('#FFFFFF')).not.toBe('#FFFFFF');
  });
});

describe('categoryGlyph', () => {
  it('claves conocidas y glifos de texto', () => {
    expect(categoryGlyph('utensils').glyph).toBe('🍽️');
    expect(categoryGlyph('ellipsis')).toEqual({ glyph: '⋯', text: true });
    expect(categoryGlyph('plus-circle').text).toBe(true);
  });

  it('clave desconocida (incluidas las del prototipo de Object) usa la etiqueta', () => {
    expect(categoryGlyph('tag')).toBe(defaultCategoryGlyph);
    expect(categoryGlyph('constructor')).toBe(defaultCategoryGlyph);
  });
});

describe('CATEGORY_ICON_OPTIONS (R5.1, docs/007 §5.13 D)', () => {
  it('R51-12: exactamente 30 íconos con slug válido, glifo y nombre únicos', () => {
    expect(CATEGORY_ICON_OPTIONS).toHaveLength(30);
    for (const option of CATEGORY_ICON_OPTIONS) {
      expect(option.slug).toMatch(/^[a-z0-9_-]{1,40}$/);
      expect(option.glyph).not.toBe('');
      expect(option.name).not.toBe('');
    }
    for (const key of ['slug', 'glyph', 'name'] as const) {
      expect(new Set(CATEGORY_ICON_OPTIONS.map((option) => option[key])).size).toBe(30);
    }
  });

  it('R51-12: incluye los 11 slugs de las categorías por defecto y tag; un desconocido da 🏷️', () => {
    const slugs = CATEGORY_ICON_OPTIONS.map((option) => option.slug);
    for (const slug of [
      'utensils',
      'bus',
      'lightbulb',
      'heart-pulse',
      'graduation-cap',
      'home',
      'film',
      'ellipsis',
      'briefcase',
      'shopping-bag',
      'plus-circle',
      'tag',
    ]) {
      expect(slugs).toContain(slug);
    }
    expect(categoryGlyph('desconocido')).toBe(defaultCategoryGlyph);
    expect(categoryGlyph('wifi').glyph).toBe('📶');
    expect(categoryGlyph('plus-circle')).toEqual({ glyph: '＋', text: true });
    expect(categoryGlyph('tag')).toBe(defaultCategoryGlyph);
  });
});
