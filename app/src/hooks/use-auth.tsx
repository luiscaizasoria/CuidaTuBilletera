import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { AuthService, AuthState } from '../lib/auth-service';

const AuthContext = createContext<AuthService | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  useEffect(() => {
    void service.restore();
  }, [service]);

  return <AuthContext.Provider value={service}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState & Pick<AuthService, 'signIn' | 'signOut'> {
  const service = useContext(AuthContext);
  if (!service) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  return { ...state, signIn: service.signIn, signOut: service.signOut };
}
