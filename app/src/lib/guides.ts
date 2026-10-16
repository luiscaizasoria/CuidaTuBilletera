// Guías contextuales de primera vez (R5; docs/007 §5.12 y docs/003, Decisión R5 D1–D4).
// Catálogo puro y almacenamiento de una preferencia local por usuario en SecureStore. Solo guarda
// `{ v: 1, vistas: [ids] }`: nunca montos, nombres, correos ni ids de cuenta.
import * as SecureStore from 'expo-secure-store';

export type GuideModule = 'cuenta' | 'movimientos' | 'calendario' | 'reportes' | 'mas';

export interface Guide {
  // Estable: no se renombra (es lo que se persiste).
  id: string;
  module: GuideModule;
  text: string;
}

// Orden del catálogo = prioridad cuando una pantalla tuviera dos candidatas (docs/007 §5.12.B.2).
export const GUIDES = [
  {
    id: 'cuentas-vacio',
    module: 'cuenta',
    text: 'Bienvenido. Empieza creando una cuenta: puede ser tu efectivo, tu banco o tu tarjeta.',
  },
  {
    id: 'cuentas-lista',
    module: 'cuenta',
    text: 'Toca una cuenta para anotar sus gastos e ingresos.',
  },
  {
    id: 'cuenta-crear',
    module: 'cuenta',
    text: 'El saldo inicial es lo que ya tienes hoy. Si no estás seguro, déjalo vacío.',
  },
  {
    id: 'cuenta-detalle',
    module: 'cuenta',
    text: 'Aquí ves cuánto tienes y lo que has anotado. Toca + para registrar un gasto o un ingreso.',
  },
  {
    id: 'movimiento-nuevo',
    module: 'movimientos',
    text: 'Elige qué fue, escribe cuánto y listo. La fecha es hoy, pero puedes cambiarla.',
  },
  {
    id: 'calendario',
    module: 'calendario',
    text: 'Los días con movimientos muestran sus importes. Toca un día para ver el detalle.',
  },
  {
    id: 'reportes',
    module: 'reportes',
    text: 'Aquí ves cuánto entró y cuánto salió en un período. Toca una barra o un total para ver sus movimientos.',
  },
  {
    id: 'categorias',
    module: 'mas',
    text: 'Las categorías ordenan tus gastos e ingresos. Puedes cambiarles el nombre y el color.',
  },
] as const satisfies readonly Guide[];

export type CatalogGuide = (typeof GUIDES)[number];
export type GuideId = CatalogGuide['id'];

const GUIDE_IDS: readonly string[] = GUIDES.map((guide) => guide.id);

export function isGuideId(value: unknown): value is GuideId {
  return typeof value === 'string' && GUIDE_IDS.includes(value);
}

export function guideById(id: GuideId): Guide {
  return GUIDES.find((guide) => guide.id === id)!;
}

// SecureStore solo admite A-Z a-z 0-9 . - _ en la clave.
export function guideStorageKey(userId: string): string {
  return `guias_v1_${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export interface GuideRecord {
  // Ids descartados, sin duplicados y en el orden del catálogo.
  seen: GuideId[];
  // Escrito por una versión posterior: se lee como vacío y no se sobrescribe.
  locked: boolean;
}

const EMPTY: GuideRecord = { seen: [], locked: false };

function inCatalogOrder(ids: Iterable<string>): GuideId[] {
  const wanted = new Set(ids);
  return GUIDES.filter((guide) => wanted.has(guide.id)).map((guide) => guide.id);
}

// Pura y tolerante: ausente, JSON inválido o forma inesperada = ninguna descartada; ids
// desconocidos se ignoran; una versión mayor a 1 queda bloqueada. Nunca lanza.
export function parseGuideRecord(raw: string | null): GuideRecord {
  if (raw === null) return { ...EMPTY };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...EMPTY };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ...EMPTY };
  const { v, vistas } = data as Record<string, unknown>;
  if (typeof v === 'number' && Number.isInteger(v) && v > 1) return { seen: [], locked: true };
  if (v !== 1 || !Array.isArray(vistas)) return { ...EMPTY };
  return { seen: inCatalogOrder(vistas.filter(isGuideId)), locked: false };
}

export function serializeGuideRecord(seen: Iterable<GuideId>): string {
  return JSON.stringify({ v: 1, vistas: inCatalogOrder(seen) });
}

export function addSeen(seen: readonly GuideId[], ids: readonly GuideId[]): GuideId[] {
  return inCatalogOrder([...seen, ...ids]);
}

// Una guía a la vez: gana la primera del catálogo que esté entre las candidatas y no descartada.
export function pickGuide(
  candidates: readonly GuideId[],
  seen: ReadonlySet<GuideId> | readonly GuideId[],
): CatalogGuide | null {
  const done = new Set<GuideId>(seen);
  const next = GUIDES.find((guide) => candidates.includes(guide.id) && !done.has(guide.id));
  return next ?? null;
}

export interface GuideStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

export const secureGuideStorage: GuideStorage = {
  read: (key) => SecureStore.getItemAsync(key),
  write: (key, value) => SecureStore.setItemAsync(key, value),
};

export interface GuideStore {
  // Nunca lanza: un fallo de lectura equivale a «ninguna descartada».
  load(userId: string): Promise<GuideRecord>;
  // Nunca lanza: si no se puede leer o guardar, la guía solo queda descartada en memoria y no se
  // sobrescribe lo guardado.
  markSeen(userId: string, ids: readonly GuideId[]): Promise<void>;
  // Lanza si no pudo leer o guardar (la pantalla lo informa). No sobrescribe una versión posterior.
  reset(userId: string): Promise<void>;
}

// Lectura, modificación y escritura de una misma entrada en serie (una cola por clave).
export function createGuideStore(storage: GuideStorage): GuideStore {
  const tails = new Map<string, Promise<unknown>>();

  function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const run = (tails.get(key) ?? Promise.resolve()).then(task);
    tails.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  }

  // Para mostrar: un fallo de lectura equivale a «ninguna descartada».
  async function readRecord(key: string): Promise<GuideRecord> {
    try {
      return parseGuideRecord(await storage.read(key));
    } catch {
      return { ...EMPTY };
    }
  }

  // Para escribir: distingue «ausente» (éxito, vacío) de «fallo de lectura» (null) y reintenta una
  // vez. Sin lectura confiable no se escribe, para no pisar descartes ya guardados.
  async function readForWrite(key: string): Promise<GuideRecord | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return parseGuideRecord(await storage.read(key));
      } catch {
        // reintenta
      }
    }
    return null;
  }

  return {
    load: (userId) => readRecord(guideStorageKey(userId)),

    markSeen(userId, ids) {
      const key = guideStorageKey(userId);
      return enqueue(key, async () => {
        const record = await readForWrite(key);
        if (record === null || record.locked) return;
        try {
          await storage.write(key, serializeGuideRecord(addSeen(record.seen, ids)));
        } catch {
          // Sin aviso al usuario (docs/007 §5.12.B.4).
        }
      });
    },

    reset(userId) {
      const key = guideStorageKey(userId);
      return enqueue(key, async () => {
        const record = await readForWrite(key);
        if (record === null) throw new Error('read-failed');
        if (record.locked) return;
        await storage.write(key, serializeGuideRecord([]));
      });
    },
  };
}
