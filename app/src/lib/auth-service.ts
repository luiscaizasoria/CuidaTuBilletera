import {
  AuthError,
  type AuthErrorKind,
  type AuthUser,
  type GoogleProvider,
  type SessionApi,
  type SessionStorage,
} from './auth-types';
import { readUnverifiedClaims } from './jwt-claims';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  // Hay un inicio de sesión en curso: la UI no debe permitir otro.
  busy: boolean;
  error: AuthErrorKind | null;
}

type RefreshOutcome = { ok: true; token: string } | { ok: false; reason: 'signed-out' | 'network' };

export interface AuthServiceDeps {
  google: GoogleProvider;
  storage: SessionStorage;
  api: SessionApi;
  now?: () => number;
}

export interface AuthService {
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  // Ejecuta una llamada autenticada: renueva si el JWT está por vencer y reintenta una sola vez
  // ante un 401. Si no se puede renovar, la sesión local se cierra.
  authorizedCall<T>(call: (accessToken: string) => Promise<T>): Promise<T>;
}

// Margen para renovar antes de que el JWT expire de verdad.
const EXPIRY_MARGIN_MS = 30_000;

export function createAuthService({
  google,
  storage,
  api,
  now = Date.now,
}: AuthServiceDeps): AuthService {
  let state: AuthState = {
    status: 'initializing',
    user: null,
    busy: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  let token: string | null = null;
  let refreshing: Promise<RefreshOutcome> | null = null;
  // Se incrementa al cerrar sesión: invalida operaciones en vuelo para que una renovación
  // tardía no vuelva a autenticar a un usuario que ya salió.
  let generation = 0;

  function setState(patch: Partial<AuthState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function isFresh(jwt: string): boolean {
    const claims = readUnverifiedClaims(jwt);
    return claims !== null && claims.exp * 1000 - now() > EXPIRY_MARGIN_MS;
  }

  async function clearStored() {
    try {
      await storage.clear();
    } catch {
      // Sin acceso al almacenamiento no hay nada más que hacer; el estado en memoria sí se limpia.
    }
  }

  async function endSession(gen: number, error: AuthErrorKind | null = null) {
    if (gen !== generation) return;
    token = null;
    await clearStored();
    if (gen !== generation) return;
    setState({ status: 'unauthenticated', user: null, busy: false, error });
  }

  async function startSession(session: { accessToken: string; user: AuthUser }, gen: number) {
    await storage.save(session.accessToken);
    if (gen !== generation) {
      await clearStored();
      return false;
    }
    token = session.accessToken;
    setState({ status: 'authenticated', user: session.user, busy: false, error: null });
    return true;
  }

  // Una sola renovación a la vez: las llamadas simultáneas comparten el mismo resultado.
  function refreshSession(): Promise<RefreshOutcome> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function doRefresh(): Promise<RefreshOutcome> {
    const gen = generation;
    try {
      const result = await google.signInSilently();
      if (result.status !== 'success') {
        await endSession(gen);
        return { ok: false, reason: 'signed-out' };
      }
      const session = await api.exchangeGoogleToken(result.idToken);
      if (!(await startSession(session, gen))) return { ok: false, reason: 'signed-out' };
      return { ok: true, token: session.accessToken };
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'network') {
        // Falla temporal: se conserva lo almacenado para reintentar luego.
        return { ok: false, reason: 'network' };
      }
      await endSession(gen);
      return { ok: false, reason: 'signed-out' };
    }
  }

  async function ensureToken(): Promise<RefreshOutcome> {
    if (token && isFresh(token)) return { ok: true, token };
    return refreshSession();
  }

  async function authorizedCall<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
    const first = await ensureToken();
    if (!first.ok) throw new AuthError(first.reason === 'network' ? 'network' : 'rejected');
    try {
      return await call(first.token);
    } catch (error) {
      if (!(error instanceof AuthError) || error.kind !== 'rejected') throw error;
      // Un solo reintento tras renovar: nunca un ciclo de 401.
      const second = await refreshSession();
      if (!second.ok) throw new AuthError(second.reason === 'network' ? 'network' : 'rejected');
      try {
        return await call(second.token);
      } catch (retryError) {
        if (retryError instanceof AuthError && retryError.kind === 'rejected') {
          await endSession(generation);
        }
        throw retryError;
      }
    }
  }

  async function restore() {
    const gen = generation;
    let stored: string | null;
    try {
      stored = await storage.load();
    } catch {
      stored = null;
    }
    if (gen !== generation) return;
    if (!stored) {
      setState({ status: 'unauthenticated', user: null, busy: false, error: null });
      return;
    }
    token = stored;
    try {
      const user = await authorizedCall((accessToken) => api.getMe(accessToken));
      if (gen === generation) {
        setState({ status: 'authenticated', user, busy: false, error: null });
      }
    } catch (error) {
      if (gen !== generation) return;
      const kind = error instanceof AuthError ? error.kind : 'unknown';
      const claims = token ? readUnverifiedClaims(token) : null;
      if (kind === 'network' && token && isFresh(token) && claims?.sub && claims.email) {
        // Sin conexión pero con un JWT todavía vigente: se conserva la sesión. Los datos
        // mostrados vienen del JWT sin verificar y son solo informativos.
        setState({
          status: 'authenticated',
          user: { id: claims.sub, email: claims.email, name: claims.name },
          busy: false,
          error: 'network',
        });
      } else if (kind === 'network') {
        // Se conserva lo almacenado; el usuario puede reintentar.
        setState({ status: 'unauthenticated', user: null, busy: false, error: 'network' });
      } else {
        await endSession(gen);
      }
    }
  }

  async function signIn() {
    if (state.busy) return; // evita pulsaciones repetidas
    const gen = generation;
    setState({ busy: true, error: null });
    try {
      const result = await google.signIn();
      if (result.status !== 'success') {
        setState({ busy: false }); // cancelación voluntaria: sin error
        return;
      }
      const session = await api.exchangeGoogleToken(result.idToken);
      await startSession(session, gen);
    } catch (error) {
      if (gen !== generation) return;
      setState({ busy: false, error: error instanceof AuthError ? error.kind : 'unknown' });
    }
  }

  async function signOut() {
    generation += 1;
    token = null;
    refreshing = null;
    await clearStored();
    try {
      await google.signOut();
    } catch {
      // El cierre local ya se hizo; un fallo de Google no debe dejar la sesión abierta.
    }
    setState({ status: 'unauthenticated', user: null, busy: false, error: null });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore,
    signIn,
    signOut,
    authorizedCall,
  };
}
