// Estado compartido de las guías contextuales (docs/007 §5.12.B e I). Un proveedor por encima del
// navegador carga la preferencia del usuario autenticado una sola vez; las pantallas la consumen.
// Sin proveedor (o mientras carga) no se muestra ninguna guía.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addSeen,
  createGuideStore,
  pickGuide,
  secureGuideStorage,
  type CatalogGuide,
  type GuideId,
  type GuideStorage,
} from '../lib/guides';

interface GuidesValue {
  // La preferencia del usuario actual ya se leyó.
  ready: boolean;
  seen: readonly GuideId[];
  dismiss: (ids: GuideId | readonly GuideId[]) => void;
  // true si se guardó; false si falló (no cambia nada en pantalla).
  resetAll: () => Promise<boolean>;
}

const NOT_READY: GuidesValue = {
  ready: false,
  seen: [],
  dismiss: () => undefined,
  resetAll: async () => false,
};

const GuidesContext = createContext<GuidesValue>(NOT_READY);

interface Loaded {
  userId: string;
  seen: readonly GuideId[];
}

export function GuidesProvider({
  userId,
  storage = secureGuideStorage,
  children,
}: {
  userId: string | null;
  storage?: GuideStorage;
  children: ReactNode;
}) {
  const store = useMemo(() => createGuideStore(storage), [storage]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Cambio de usuario: la lectura anterior se descarta y no se muestra nada hasta leer la nueva.
  useEffect(() => {
    if (userId === null) return undefined;
    let cancelled = false;
    void store.load(userId).then((record) => {
      if (!cancelled) setLoaded({ userId, seen: record.seen });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, store]);

  const current = loaded !== null && loaded.userId === userId ? loaded.seen : null;
  const latest = useRef<Loaded | null>(loaded);
  latest.current = loaded;

  // `userId` queda capturado: un descarte tardío de otro usuario nunca escribe en la clave de este.
  const dismiss = useCallback(
    (ids: GuideId | readonly GuideId[]) => {
      if (userId === null) return;
      const list = typeof ids === 'string' ? [ids] : [...ids];
      const known = latest.current?.userId === userId ? latest.current.seen : [];
      setLoaded((previous) =>
        previous !== null && previous.userId === userId
          ? { userId, seen: addSeen(previous.seen, list) }
          : previous,
      );
      void store.markSeen(userId, addSeen(known, list));
    },
    [userId, store],
  );

  const resetAll = useCallback(async () => {
    if (userId === null) return false;
    try {
      await store.reset(userId);
    } catch {
      return false;
    }
    setLoaded((previous) =>
      previous !== null && previous.userId === userId ? { userId, seen: [] } : previous,
    );
    return true;
  }, [userId, store]);

  const value = useMemo<GuidesValue>(
    () => ({ ready: current !== null, seen: current ?? [], dismiss, resetAll }),
    [current, dismiss, resetAll],
  );
  return <GuidesContext.Provider value={value}>{children}</GuidesContext.Provider>;
}

export function useGuides(): GuidesValue {
  return useContext(GuidesContext);
}

// Guía que debe verse en una pantalla: `enabled` resume «datos cargados, sin error y sin datos».
// Con varias candidatas gana la primera del catálogo.
export function useGuide(
  candidates: readonly GuideId[],
  enabled: boolean,
): { guide: CatalogGuide | null; dismissGuide: () => void } {
  const { ready, seen, dismiss } = useGuides();
  const guide = enabled && ready ? pickGuide(candidates, seen) : null;
  const id = guide?.id;
  const dismissGuide = useCallback(() => {
    if (id !== undefined) dismiss(id);
  }, [id, dismiss]);
  return { guide, dismissGuide };
}
