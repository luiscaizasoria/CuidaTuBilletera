import {
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
