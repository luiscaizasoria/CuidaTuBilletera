import { useCallback, useEffect, useRef, useState } from 'react';
import { resourceErrorMessage } from '../lib/resources-messages';

export type LoaderState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

// Carga datos en el estado del componente (sin caché global). `key` identifica la consulta: al
// cambiar vuelve a cargar mostrando «loading». `reload` también muestra «loading»; `refresh`
// vuelve a consultar sin parpadeo (tras una mutación). Un flag `cancelled` evita actualizar el
// estado tras desmontar o tras un cambio de consulta.
export function useLoader<T>(fetcher: () => Promise<T>, key: string) {
  const [state, setState] = useState<LoaderState<T>>({ status: 'loading' });
  const [request, setRequest] = useState({ n: 0, silent: false });
  const fetcherRef = useRef(fetcher);
  const lastKey = useRef(key);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    const silent = request.silent && lastKey.current === key;
    lastKey.current = key;
    if (!silent) setState({ status: 'loading' });
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: resourceErrorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, request]);

  const reload = useCallback(() => setRequest((r) => ({ n: r.n + 1, silent: false })), []);
  const refresh = useCallback(() => setRequest((r) => ({ n: r.n + 1, silent: true })), []);
  return { state, reload, refresh };
}

// Ejecuta una mutación a la vez: `pending` deshabilita los botones y `error` guarda el mensaje
// en español. No actualiza el estado si el componente ya se desmontó.
export function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      if (mounted.current) setError(resourceErrorMessage(caught));
      return false;
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  return { pending, error, run, clearError };
}
