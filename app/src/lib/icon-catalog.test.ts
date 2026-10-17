import {
  entriesOfGroup,
  findIcon,
  groupsOf,
  ICON_CATALOG,
  ICON_GROUPS,
  ICON_KEY_PATTERN,
  iconsForScope,
  initialGroup,
  normalizeSearch,
  searchIcons,
} from './icon-catalog';

// Las 35 claves anteriores (12 de cuenta y 30 de categoría, 7 comunes) con su emoji exacto.
const ACCOUNT_KEYS: [string, string][] = [
  ['wallet', '👛'],
  ['card', '💳'],
  ['bank', '🏦'],
  ['piggy-bank', '🐷'],
  ['cash', '💵'],
  ['trending-up', '📈'],
  ['briefcase', '💼'],
  ['home', '🏠'],
  ['plane', '✈️'],
  ['gift', '🎁'],
  ['shopping-bag', '🛍️'],
  ['money-bag', '💰'],
];
const CATEGORY_KEYS: [string, string][] = [
  ['utensils', '🍽️'],
  ['shopping-cart', '🛒'],
  ['coffee', '☕'],
  ['bus', '🚌'],
  ['car', '🚗'],
  ['fuel', '⛽'],
  ['lightbulb', '💡'],
  ['home', '🏠'],
  ['heart-pulse', '🩺'],
  ['pill', '💊'],
  ['graduation-cap', '🎓'],
  ['book', '📚'],
  ['briefcase', '💼'],
  ['shopping-bag', '🛍️'],
  ['ellipsis', '⋯'],
  ['gift', '🎁'],
  ['paw', '🐾'],
  ['shirt', '👕'],
  ['phone', '📱'],
  ['wifi', '📶'],
  ['plane', '✈️'],
  ['gamepad', '🎮'],
  ['music', '🎵'],
  ['film', '🎬'],
  ['wrench', '🔧'],
  ['dumbbell', '🏋️'],
  ['trending-up', '📈'],
  ['money-bag', '💰'],
  ['plus-circle', '＋'],
  ['tag', '🏷️'],
];

describe('catálogo único de íconos (docs/008 §6.17)', () => {
  it('249 entradas en 17 grupos con los tamaños del diseño', () => {
    expect(ICON_CATALOG).toHaveLength(249);
    expect(ICON_GROUPS).toHaveLength(17);
    expect(ICON_GROUPS.map((group) => entriesOfGroup(ICON_CATALOG, group).length)).toEqual([
      14, 14, 14, 22, 16, 14, 12, 14, 16, 14, 18, 14, 12, 12, 16, 13, 14,
    ]);
    for (const entry of ICON_CATALOG) expect(ICON_GROUPS).toContain(entry.group);
  });

  it('claves con el patrón de la API y claves, emojis y nombres únicos', () => {
    for (const entry of ICON_CATALOG) {
      expect(entry.key).toMatch(ICON_KEY_PATTERN);
      expect(entry.glyph).not.toBe('');
      expect(entry.name.trim()).toBe(entry.name);
      expect(entry.name).not.toBe('');
    }
    for (const field of ['key', 'glyph', 'name'] as const) {
      expect(new Set(ICON_CATALOG.map((entry) => entry[field])).size).toBe(249);
    }
  });

  it('sin ZWJ, sin tonos de piel y sin banderas', () => {
    for (const entry of ICON_CATALOG) {
      expect(entry.glyph).not.toMatch(/‍/);
      expect(entry.glyph).not.toMatch(/[\u{1F3FB}-\u{1F3FF}]/u);
      expect(entry.glyph).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
    }
  });

  it('las 35 claves existentes conservan su emoji', () => {
    const all = new Map([...ACCOUNT_KEYS, ...CATEGORY_KEYS]);
    expect(all.size).toBe(35);
    for (const [key, glyph] of all) expect(findIcon(ICON_CATALOG, key)?.glyph).toBe(glyph);
  });

  it('solo ellipsis, plus-circle y tag son exclusivos de categorías; los dos primeros son de texto', () => {
    const exclusive = ICON_CATALOG.filter((entry) => entry.scope === 'category').map(
      (entry) => entry.key,
    );
    expect(exclusive).toEqual(['ellipsis', 'plus-circle', 'tag']);
    expect(ICON_CATALOG.filter((entry) => entry.text).map((entry) => entry.key)).toEqual([
      'ellipsis',
      'plus-circle',
    ]);
    expect(iconsForScope('category')).toHaveLength(249);
    expect(iconsForScope('account')).toHaveLength(246);
  });

  it('las claves de cuenta existentes están en el alcance de cuentas y cumplen el patrón', () => {
    const keys = iconsForScope('account').map((entry) => entry.key);
    for (const [key] of ACCOUNT_KEYS) {
      expect(keys).toContain(key);
      expect(key).toMatch(/^[a-z0-9-]{1,20}$/);
    }
  });

  it('cada grupo tiene entradas en ambos alcances y todo grupo del alcance es del catálogo', () => {
    expect(groupsOf(iconsForScope('category'))).toEqual([...ICON_GROUPS]);
    expect(groupsOf(iconsForScope('account'))).toEqual([...ICON_GROUPS]);
  });
});

describe('initialGroup y findIcon', () => {
  it('el grupo inicial es el del ícono actual', () => {
    expect(initialGroup(ICON_CATALOG, 'bus')).toBe('Transporte');
    expect(initialGroup(ICON_CATALOG, 'pizza')).toBe('Alimentación');
  });

  it('sin ícono o con clave desconocida es el primer grupo', () => {
    expect(initialGroup(ICON_CATALOG, null)).toBe('Dinero y ahorro');
    expect(initialGroup(ICON_CATALOG, 'icono-viejo')).toBe('Dinero y ahorro');
  });

  it('una clave desconocida, nula o de otro alcance no resuelve', () => {
    expect(findIcon(ICON_CATALOG, 'zzz')).toBeNull();
    expect(findIcon(ICON_CATALOG, null)).toBeNull();
    expect(findIcon(ICON_CATALOG, undefined)).toBeNull();
    expect(findIcon(iconsForScope('account'), 'tag')).toBeNull();
  });
});

describe('búsqueda sin tildes ni mayúsculas', () => {
  const names = (query: string) => searchIcons(ICON_CATALOG, query).map((entry) => entry.name);

  it('normaliza tildes y mayúsculas', () => {
    expect(normalizeSearch('  CaféÑ ')).toBe('cafen');
  });

  it('encuentra por nombre, con o sin tildes y mayúsculas', () => {
    expect(names('banco')).toContain('Banco');
    expect(names('BANCO')).toContain('Banco');
    expect(names('cafe')).toContain('Café');
    expect(names('CAFÉ')).toContain('Café');
    expect(names('alcancia')).toContain('Alcancía');
  });

  it('encuentra por palabra clave (también las que llevan tilde en el catálogo)', () => {
    expect(names('chanchito')).toContain('Alcancía');
    expect(names('baño')).toContain('Baño');
    expect(names('BANO')).toContain('Baño');
  });

  it('encuentra por sinónimos comunes en español neutro', () => {
    expect(names('sueldo')).toContain('Trabajo');
    expect(names('nómina')).toContain('Trabajo');
    expect(names('gasolina')).toContain('Combustible');
    expect(names('arriendo')).toContain('Hogar');
    expect(names('renta')).toContain('Hogar');
    expect(names('luz')).toContain('Servicios básicos');
    expect(names('factura')).toContain('Agua');
    expect(names('medicamentos')).toContain('Medicinas');
    expect(names('impuestos')).toContain('Trámites');
    expect(names('alimentos')).toContain('Supermercado');
    expect(names('PAÑALES')).toContain('Bebé');
    expect(names('anden')).toContain('Estación');
  });

  it('no ofrece resultados absurdos para términos ambiguos', () => {
    expect(names('luz')).not.toContain('Linterna');
    expect(names('recibo')).not.toContain('Transferencia recibida');
    expect(searchIcons(ICON_CATALOG, 'can').map((entry) => entry.key)).not.toContain('dog');
  });

  it('texto vacío o sin coincidencias da lista vacía', () => {
    expect(names('')).toEqual([]);
    expect(names('   ')).toEqual([]);
    expect(names('zzzzqq')).toEqual([]);
  });

  it('respeta el alcance recibido', () => {
    expect(searchIcons(iconsForScope('account'), 'etiqueta')).toEqual([]);
    expect(names('etiqueta')).toContain('Etiqueta');
  });
});
