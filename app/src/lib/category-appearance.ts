// Apariencia de las categorías (docs/008 §2.7 y §11): fondo del cuadrado de ícono y glifo.
// Puro y sin dependencias de React: el color de la API no se modifica, solo se oscurece el fondo mostrado.
import { iconsForScope } from './icon-catalog';

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function whiteContrast(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

function toHex(values: number[]): string {
  return `#${values
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_CATEGORY_FILL = '#6B7280';

// Oscurece el color (mezcla con negro, pasos de 1 %) hasta que un glifo blanco alcance 3:1.
// Un color que no es #RRGGBB usa el gris neutro.
export function categoryFill(hex: string): string {
  if (!HEX_COLOR.test(hex)) return DEFAULT_CATEGORY_FILL;
  const base = channels(hex);
  let current = toHex(base);
  for (let k = 1; whiteContrast(current) < 3 && k <= 100; k += 1) {
    current = toHex(base.map((v) => v * (1 - k / 100)));
  }
  return current;
}

export interface CategoryGlyph {
  glyph: string;
  // true: glifo de texto que se dibuja en blanco (los emojis llevan su propio color).
  text?: boolean;
}

export interface CategoryIconOption extends CategoryGlyph {
  slug: string;
  // Nombre en español: etiqueta accesible «Ícono {nombre}» del selector.
  name: string;
}

// Íconos de categoría: todo el catálogo único (icon-catalog.ts, 249 entradas). Incluye los 12 slugs de
// las categorías por defecto de la API (api/src/services/default-categories.ts) y `tag`, el valor por
// defecto de la API. Las 30 claves originales conservan clave, emoji y nombre.
export const CATEGORY_ICON_OPTIONS: readonly CategoryIconOption[] = iconsForScope('category').map(
  (entry) => ({
    slug: entry.key,
    glyph: entry.glyph,
    name: entry.name,
    ...(entry.text ? { text: true } : {}),
  }),
);

// Glifo por clave `icono`, derivado del catálogo. `tag` no entra: es el valor por defecto.
export const categoryGlyphs: Record<string, CategoryGlyph> = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.filter((option) => option.slug !== 'tag').map((option) => [
    option.slug,
    option.text ? { glyph: option.glyph, text: true } : { glyph: option.glyph },
  ]),
);
export const defaultCategoryGlyph: CategoryGlyph = { glyph: '🏷️' };

export function categoryGlyph(icono: string): CategoryGlyph {
  return Object.prototype.hasOwnProperty.call(categoryGlyphs, icono)
    ? categoryGlyphs[icono]!
    : defaultCategoryGlyph;
}
