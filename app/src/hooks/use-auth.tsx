import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { AuthService, AuthState } from '../lib/auth-service';

// Ventana anti-rebote: Android puede emitir ráfagas de eventos al volver a primer plano.
export const FOREGROUND_DEBOUNCE_MS = 1_000;

const AuthContext = createContext<AuthService | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  useEffect(() => {
    void service.restore();
  }, [service]);

  // Un único listener por servicio. El hook solo detecta la transición y delega en el servicio.
  useEffect(() => {
    let disposed = false;
    // Al montar la app ya está activa: el restore() del montaje es el único trabajo inicial.
    let previous: AppStateStatus = AppState.currentState;
    let lastForegroundAt: number | null = null;
    const subscription = AppState.addEventListener('change', (next) => {
      const wasHidden = previous === 'background' || previous === 'inactive';
      previous = next;
      if (disposed || next !== 'active' || !wasHidden) return;
      const at = Date.now();
      if (lastForegroundAt !== null && at - lastForegroundAt < FOREGROUND_DEBOUNCE_MS) return;
      lastForegroundAt = at;
      void service.onForeground();
    });
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [service]);

  return <AuthContext.Provider value={service}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState & Pick<AuthService, 'signIn' | 'signOut' | 'restore'> {
  const service = useContext(AuthContext);
  if (!service) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  return { ...state, signIn: service.signIn, signOut: service.signOut, restore: service.restore };
}
