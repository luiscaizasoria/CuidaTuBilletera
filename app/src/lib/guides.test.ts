// Catálogo y almacenamiento de las guías (R5; docs/007 §5.12, criterios J1 a J5, J15 y J16).
import * as SecureStore from 'expo-secure-store';
import { guideRecord, memoryGuideStorage } from '../guides-test-utils';
import {
  GUIDES,
  addSeen,
  createGuideStore,
  guideStorageKey,
  isGuideId,
  parseGuideRecord,
  pickGuide,
  secureGuideStorage,
  serializeGuideRecord,
} from './guides';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const EXPECTED = {
  'cuentas-vacio':
    'Bienvenido. Empieza creando una cuenta: puede ser tu efectivo, tu banco o tu tarjeta.',
  'cuentas-lista': 'Toca una cuenta para anotar sus gastos e ingresos.',
  'cuenta-crear': 'El saldo inicial es lo que ya tienes hoy. Si no estás seguro, déjalo vacío.',
  'cuenta-detalle':
    'Aquí ves cuánto tienes y lo que has anotado. Toca + para registrar un gasto o un ingreso.',
  'movimiento-nuevo':
    'Elige qué fue, escribe cuánto y listo. La fecha es hoy, pero puedes cambiarla.',
  calendario: 'Los días con movimientos muestran sus importes. Toca un día para ver el detalle.',
  reportes:
    'Aquí ves cuánto entró y cuánto salió en un período. Toca una barra o un total para ver sus movimientos.',
  categorias:
    'Las categorías ordenan tus gastos e ingresos. Puedes cambiarles el nombre y el color.',
} as const;

describe('catálogo', () => {
  it('tiene exactamente los 8 ids únicos con el texto aprobado', () => {
    const ids = GUIDES.map((guide) => guide.id);
    expect(new Set(ids).size).toBe(8);
    expect([...ids].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const guide of GUIDES) expect(guide.text).toBe(EXPECTED[guide.id]);
  });

  it('cada guía usa un módulo con color', () => {
    expect(new Set(GUIDES.map((guide) => guide.module))).toEqual(
      new Set(['cuenta', 'movimientos', 'calendario', 'reportes', 'mas']),
    );
  });

  it('isGuideId reconoce solo ids del catálogo', () => {
    expect(isGuideId('calendario')).toBe(true);
    expect(isGuideId('otra')).toBe(false);
    expect(isGuideId(3)).toBe(false);
  });
});

describe('clave de almacenamiento', () => {
  it('guias_v1_ + id y reemplaza lo no admitido por «_»', () => {
    expect(guideStorageKey('sub-1')).toBe('guias_v1_sub-1');
    expect(guideStorageKey('1234567890')).toBe('guias_v1_1234567890');
    const key = guideStorageKey('a@b.com/ñ :1');
    expect(key).toBe('guias_v1_a_b.com____1');
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('lectura tolerante', () => {
  it.each([
    ['ausente', null],
    ['vacío', ''],
    ['JSON inválido', '{no'],
    ['no es objeto', '[1]'],
    ['sin versión', '{"vistas":["calendario"]}'],
    ['versión 0', '{"v":0,"vistas":["calendario"]}'],
    ['vistas no es lista', '{"v":1,"vistas":"calendario"}'],
    ['número', '7'],
  ])('%s = ninguna descartada, sin lanzar', (_name, raw) => {
    expect(parseGuideRecord(raw)).toEqual({ seen: [], locked: false });
  });

  it('ignora ids desconocidos y duplicados y ordena por catálogo', () => {
    expect(
      parseGuideRecord(guideRecord('reportes', 'x', 'cuentas-vacio', 'reportes', '1')),
    ).toEqual({ seen: ['cuentas-vacio', 'reportes'], locked: false });
  });

  it('una versión mayor se lee como vacía y queda bloqueada', () => {
    expect(parseGuideRecord('{"v":2,"vistas":["calendario"]}')).toEqual({ seen: [], locked: true });
  });
});

describe('escritura', () => {
  it('serializa solo versión e ids del catálogo, sin duplicados', () => {
    const raw = serializeGuideRecord(['reportes', 'cuentas-vacio', 'reportes']);
    expect(JSON.parse(raw)).toEqual({ v: 1, vistas: ['cuentas-vacio', 'reportes'] });
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['v', 'vistas']);
  });

  it('addSeen une sin duplicar', () => {
    expect(addSeen(['calendario'], ['calendario', 'categorias'])).toEqual([
      'calendario',
      'categorias',
    ]);
  });
});

describe('pickGuide', () => {
  it('devuelve la primera candidata del catálogo no descartada', () => {
    expect(pickGuide(['reportes', 'calendario'], [])?.id).toBe('calendario');
    expect(pickGuide(['reportes', 'calendario'], ['calendario'])?.id).toBe('reportes');
    expect(pickGuide(['calendario'], new Set(['calendario']))).toBeNull();
    expect(pickGuide([], [])).toBeNull();
  });
});

describe('createGuideStore', () => {
  it('load tolera fallos de lectura', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario') });
    const store = createGuideStore(storage);
    expect((await store.load('u1')).seen).toEqual(['calendario']);
    storage.setFailRead(true);
    expect(await store.load('u1')).toEqual({ seen: [], locked: false });
  });

  it('markSeen escribe la entrada del usuario con el formato aprobado', async () => {
    const storage = memoryGuideStorage();
    const store = createGuideStore(storage);
    await store.markSeen('u1', ['reportes']);
    await store.markSeen('u1', ['calendario']);
    expect(JSON.parse(storage.data.get('guias_v1_u1')!)).toEqual({
      v: 1,
      vistas: ['calendario', 'reportes'],
    });
    expect(storage.data.size).toBe(1);
  });

  it('dos descartes seguidos no se pisan (cola por clave)', async () => {
    const storage = memoryGuideStorage();
    const store = createGuideStore(storage);
    await Promise.all([store.markSeen('u1', ['reportes']), store.markSeen('u1', ['categorias'])]);
    expect(parseGuideRecord(storage.data.get('guias_v1_u1')!).seen).toEqual([
      'reportes',
      'categorias',
    ]);
  });

  it('markSeen no lanza si falla guardar', async () => {
    const storage = memoryGuideStorage();
    storage.setFailWrite(true);
    await expect(createGuideStore(storage).markSeen('u1', ['reportes'])).resolves.toBeUndefined();
  });

  it('no sobrescribe una versión mayor (descartar ni restablecer)', async () => {
    const future = '{"v":2,"vistas":["calendario"],"extra":true}';
    const storage = memoryGuideStorage({ guias_v1_u1: future });
    const store = createGuideStore(storage);
    await store.markSeen('u1', ['reportes']);
    await store.reset('u1');
    expect(storage.writes).toEqual([]);
    expect(storage.data.get('guias_v1_u1')).toBe(future);
  });

  // UXQA-R5-03: «ausente» no es «fallo de lectura».
  it('lectura OK fusiona con lo guardado; ausente crea la entrada', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario') });
    const store = createGuideStore(storage);
    await store.markSeen('u1', ['reportes']);
    expect(parseGuideRecord(storage.data.get('guias_v1_u1')!).seen).toEqual([
      'calendario',
      'reportes',
    ]);
    await store.markSeen('u2', ['reportes']);
    expect(JSON.parse(storage.data.get('guias_v1_u2')!)).toEqual({ v: 1, vistas: ['reportes'] });
  });

  it('un fallo de lectura se reintenta una vez y, si se recupera, fusiona', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario') });
    storage.setFailRead(1);
    await createGuideStore(storage).markSeen('u1', ['reportes']);
    expect(storage.reads).toHaveLength(2);
    expect(parseGuideRecord(storage.data.get('guias_v1_u1')!).seen).toEqual([
      'calendario',
      'reportes',
    ]);
  });

  it('si la lectura sigue fallando no escribe y no sobrescribe lo guardado', async () => {
    const saved = guideRecord('calendario', 'categorias');
    const storage = memoryGuideStorage({ guias_v1_u1: saved });
    storage.setFailRead(true);
    const store = createGuideStore(storage);
    await expect(store.markSeen('u1', ['reportes'])).resolves.toBeUndefined();
    expect(storage.reads).toHaveLength(2);
    expect(storage.writes).toEqual([]);
    await expect(store.reset('u1')).rejects.toThrow();
    expect(storage.writes).toEqual([]);
    expect(storage.data.get('guias_v1_u1')).toBe(saved);
  });

  it('reset vacía las vistas y lanza si no puede guardar', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario') });
    const store = createGuideStore(storage);
    await store.reset('u1');
    expect(JSON.parse(storage.data.get('guias_v1_u1')!)).toEqual({ v: 1, vistas: [] });
    storage.setFailWrite(true);
    await expect(store.reset('u1')).rejects.toThrow();
  });

  it('dos usuarios en el mismo almacén son independientes', async () => {
    const storage = memoryGuideStorage();
    const store = createGuideStore(storage);
    await store.markSeen('u1', ['reportes']);
    await store.markSeen('u2', ['categorias']);
    expect((await store.load('u1')).seen).toEqual(['reportes']);
    expect((await store.load('u2')).seen).toEqual(['categorias']);
    expect((await store.load('u3')).seen).toEqual([]);
  });

  it('nunca guarda datos financieros ni de identidad', async () => {
    const storage = memoryGuideStorage();
    const store = createGuideStore(storage);
    await store.markSeen('ana@example.com', [...GUIDES.map((guide) => guide.id)]);
    const value = storage.writes.map((write) => write.value).join('');
    expect(value).not.toMatch(/ana|example|\d{3,}|acc-|saldo|monto/i);
    expect(JSON.parse(value)).toEqual({ v: 1, vistas: GUIDES.map((guide) => guide.id) });
  });
});

describe('SecureStore real (doble) y sin borrados', () => {
  it('usa get/set con la clave por usuario y no llama a deleteItemAsync', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    const store = createGuideStore(secureGuideStorage);
    await store.load('u1');
    await store.markSeen('u1', ['calendario']);
    await store.reset('u1');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('guias_v1_u1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'guias_v1_u1',
      '{"v":1,"vistas":["calendario"]}',
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
