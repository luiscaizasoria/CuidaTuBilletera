import {
  AuthError,
  type ApiSession,
  type AuthErrorKind,
  type AuthUser,
  type GoogleProvider,
  type LogoutOutcome,
  type RefreshedSession,
  type SessionApi,
  type SessionStorage,
  type StoredLoad,
  type StoredSessionV2,
} from './auth-types';
import { readUnverifiedClaims } from './jwt-claims';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'unavailable';
export type SignedOutReason = 'absent' | 'revoked' | 'signed-out';
export type UnavailableCause = 'network' | 'server' | 'storage';
export type LogoutNotice = 'logout-unconfirmed' | 'logout-storage-error';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  // Hay un inicio de sesión (o un reintento de restauración) en curso: la UI no permite otro.
  busy: boolean;
  // Sesión autenticada pero sin poder renovarse por ahora (red, servidor o almacenamiento).
  degraded: boolean;
  signedOutReason: SignedOutReason | null;
  unavailableCause: UnavailableCause | null;
  error: AuthErrorKind | null;
  notice: LogoutNotice | null;
}

export interface AuthServiceDeps {
  google: GoogleProvider;
  storage: SessionStorage;
  api: SessionApi;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface AuthService {
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<LogoutOutcome>;
  // Ejecuta una llamada autenticada: renueva con POST /auth/refresh si el access token está por
  // vencer y, ante un 401, renueva una vez y reintenta una vez. Un segundo 401 se propaga sin
  // destruir la sesión.
  authorizedCall<T>(call: (accessToken: string) => Promise<T>): Promise<T>;
  // La app volvió a primer plano (Android). Punto de entrada único y seguro: nunca lanza, no inicia
  // otro ciclo si ya hay uno en vuelo, no recupera con Google tras un cierre de sesión y no usa la
  // red mientras el access token siga vigente. Reutiliza restore() y el ciclo de renovación.
  onForeground(): Promise<void>;
}

// Margen para renovar antes de que el access token expire de verdad.
export const EXPIRY_MARGIN_MS = 60_000;
// Tras una recuperación automática con Google fallida no se reintenta antes de este plazo.
export const RECOVERY_COOLDOWN_MS = 60_000;
// Límite de espera de Google. La renovación silenciosa no necesita al usuario; el selector de
// cuentas interactivo sí puede tardar (contraseña, verificación), por eso su plazo es mayor.
export const GOOGLE_SILENT_TIMEOUT_MS = 15_000;
export const GOOGLE_INTERACTIVE_TIMEOUT_MS = 60_000;
// Intervalo mínimo entre reintentos manuales (Reintentar) que llegan a la red: evita una
// rotación del refresh token por cada pulsación cuando el servidor devuelve un 401 persistente.
export const RESTORE_MIN_INTERVAL_MS = 5_000;
const CONFLICT_WAIT_BASE_MS = 1_000;
const CONFLICT_WAIT_JITTER_MS = 250;

type Cause = UnavailableCause;
// `kind` conserva la causa original cuando aporta más detalle que `cause` (Play Services,
// configuración o error desconocido), para que la UI pueda mostrar un texto propio.
type DetailKind = 'play-services' | 'config' | 'unknown';
type CycleResult =
  { ok: true; token: string } | { ok: false; cause: Cause | 'ended'; kind?: DetailKind };
const ENDED: CycleResult = { ok: false, cause: 'ended' };

type CommitResult =
  | { kind: 'saved'; mine: number }
  | { kind: 'stale' }
  | { kind: 'failed' }
  | { kind: 'successor'; session: StoredSessionV2 };

const INITIAL_STATE: AuthState = {
  status: 'initializing',
  user: null,
  busy: false,
  degraded: false,
  signedOutReason: null,
  unavailableCause: null,
  error: null,
  notice: null,
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const noop = () => undefined;

function kindOf(error: unknown): AuthErrorKind {
  return error instanceof AuthError ? error.kind : 'unknown';
}

// network y storage se conservan; cualquier otra falla transitoria se presenta como "servidor".
function causeOf(kind: AuthErrorKind): Cause {
  return kind === 'network' || kind === 'storage' ? kind : 'server';
}

function detailOf(kind: AuthErrorKind): DetailKind | undefined {
  return kind === 'play-services' || kind === 'config' || kind === 'unknown' ? kind : undefined;
}

function causeToError(result: Extract<CycleResult, { ok: false }>): AuthError {
  return new AuthError(result.cause === 'ended' ? 'rejected' : (result.kind ?? result.cause));
}

// Espera acotada: si Google no responde a tiempo se rechaza como error transitorio de red. El
// resultado tardío de Google se descarta aquí mismo (nadie lo consume), de modo que un ID token
// que llegue tarde jamás se intercambia ni se persiste. Usa los temporizadores globales.
function withTimeout<T>(call: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthError('network')), ms);
    // En Node/Jest un plazo pendiente no debe mantener vivo el proceso.
    (timer as { unref?: () => void }).unref?.();
    let pending: Promise<T>;
    try {
      pending = call();
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createAuthService({
  google,
  storage,
  api,
  now = Date.now,
  sleep = defaultSleep,
  random = Math.random,
}: AuthServiceDeps): AuthService {
  let state: AuthState = INITIAL_STATE;
  const listeners = new Set<() => void>();

  // Sesión en memoria. El access token vive aquí y en SecureStore; nunca se registra.
  let session: StoredSessionV2 | null = null;
  let accessExpiresAt = 0;

  // Se incrementa en el logout y en cada reemplazo de sesión (inicio de sesión confirmado,
  // recuperación confirmada, fin de sesión): toda operación en vuelo la compara con la que
  // capturó al empezar y se descarta si cambió.
  let epoch = 0;
  // Se incrementa en cada asignación de la sesión en memoria: permite detectar que una lectura
  // del almacenamiento quedó anterior a una publicación.
  let generation = 0;
  // Cola FIFO: TODAS las operaciones de almacenamiento pasan por aquí, de modo que el último
  // en escribir sea siempre el logout.
  let tail: Promise<unknown> = Promise.resolve();
  // Ciclo único compartido por renovación, recuperación con Google y migración v1.
  let cycle: Promise<CycleResult> | null = null;
  // Se incrementa al iniciar cada ciclo: permite a la revalidación detectar un ciclo que empezó y
  // terminó (p. ej. falló por red) mientras su GET /me estaba en vuelo.
  let cycleSeq = 0;
  let restoring: Promise<void> | null = null;
  // Identifica el inicio de sesión interactivo en vuelo (null si no hay). Mientras exista,
  // restore() no corre: su setState({ busy: false }) liberaría `busy` con signIn() aún esperando.
  let signInToken: object | null = null;
  let lastRecoveryAt: number | null = null;
  // El logout no pudo borrar el almacenamiento: impide que restore() reviva esa sesión. Solo se
  // lee y escribe dentro de tareas de la cola; un guardado correcto de una sesión nueva la apaga.
  let pendingClear = false;
  // Fin del último intento que llegó a la red (ciclo o GET /me): base de RESTORE_MIN_INTERVAL_MS.
  let lastAttemptAt: number | null = null;
  // refreshToken marcado como consumido cuya marca NO se pudo persistir: antes de recuperar con
  // Google se reintenta escribirla (la marca va a disco antes de cualquier llamada a Google).
  let unpersistedMark: string | null = null;

  function setState(patch: Partial<AuthState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // un suscriptor defectuoso no debe romper el ciclo de sesión
      }
    });
  }

  function setSession(next: StoredSessionV2 | null, expiresAt: number) {
    session = next;
    accessExpiresAt = expiresAt;
    generation += 1;
    // Una sesión con otro refresh token (o ninguna) deja sin efecto la marca pendiente.
    if (unpersistedMark !== null && next?.refreshToken !== unpersistedMark) unpersistedMark = null;
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task);
    tail = run.then(noop, noop);
    return run;
  }

  function accessExpiryOf(accessToken: string): number {
    const claims = readUnverifiedClaims(accessToken);
    return claims ? claims.exp * 1000 : 0; // ilegible => no fresco
  }

  function isFresh(): boolean {
    return session !== null && accessExpiresAt - now() > EXPIRY_MARGIN_MS;
  }

  function publishSession(next: StoredSessionV2, expiresAt: number) {
    setSession(next, expiresAt);
    setState({
      status: 'authenticated',
      user: next.user,
      busy: false,
      degraded: false,
      signedOutReason: null,
      unavailableCause: null,
      error: null,
      notice: null,
    });
  }

  // Falla transitoria: se conserva todo. Con access aún vigente la sesión sigue en uso (degradada);
  // si no, la app queda no disponible hasta poder renovar.
  function markTransient(cause: Cause, kind?: DetailKind) {
    if (session && accessExpiresAt > now()) {
      setState({
        status: 'authenticated',
        user: session.user,
        busy: false,
        degraded: true,
        unavailableCause: null,
        signedOutReason: null,
        // Un fallo del ciclo no es un 401 de /me: nunca arrastra el aviso de "no verificada".
        error: null,
      });
    } else {
      setState({
        status: 'unavailable',
        user: session?.user ?? state.user,
        busy: false,
        degraded: false,
        unavailableCause: cause,
        error: kind ?? null,
      });
    }
  }

  // Un error tardío (la operación ya fue reemplazada o cerrada) nunca modifica el estado.
  function fail(cause: Cause, epoch0: number, kind?: DetailKind): CycleResult {
    if (epoch !== epoch0) return ENDED;
    markTransient(cause, kind);
    return { ok: false, cause, kind };
  }

  function failWith(error: unknown, epoch0: number): CycleResult {
    const kind = kindOf(error);
    return fail(causeOf(kind), epoch0, detailOf(kind));
  }

  // Revoca con POST /auth/logout, sin esperar ni propagar errores. Solo se usa para:
  //  (a) la familia recién creada por NUESTRO exchangeGoogleToken que no se pudo persistir ni
  //      publicar (huérfana: la creamos y nadie más la conoce);
  //  (b) la familia vieja tras una recuperación exitosa originada en un 401 INVALID_REFRESH_TOKEN
  //      (token ya muerto: llamada inocua). NUNCA si el origen fue un 409 REFRESH_CONFLICT: ese
  //      token identifica una familia que puede tener un sucesor legítimo en otro proceso;
  //  (c) el logout explícito (signOut llama a api.logout por su cuenta).
  // Nunca con un par rotado recibido tarde: tras un logout, el logout explícito ya revoca la
  // familia entera, y un par rotado que no se pudo guardar se recupera con Google.
  function bestEffortLogout(refreshToken: string) {
    void Promise.resolve()
      .then(() => api.logout(refreshToken))
      .catch(noop);
  }

  // clearAll con UN reintento. Debe ejecutarse dentro de una tarea de la cola.
  async function tryClearAll(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await storage.clearAll();
        return true;
      } catch {
        // se reintenta una vez
      }
    }
    return false;
  }

  // Borrado dentro de una tarea de la cola, manteniendo la marca de limpieza pendiente.
  async function clearAllMarked(): Promise<boolean> {
    const cleared = await tryClearAll();
    pendingClear = !cleared;
    return cleared;
  }

  function clearStorage(): Promise<boolean> {
    return enqueue(clearAllMarked);
  }

  // Guarda por la cola con compare-and-set: la tarea revalida el epoch justo antes de escribir.
  // `bump`: el guardado es un reemplazo de sesión (epoch++ tras escribir). `replaces`: solo se
  // escribe si el refresh almacenado es ese (o no hay ninguno); si apareció un sucesor, no escribe.
  async function commit(
    next: StoredSessionV2,
    epoch0: number,
    options: {
      bump: boolean;
      replaces?: { refreshToken: string | null };
      // Solo para la marca de consumido: no escribe si no hay una sesión en disco que marcar
      // (vacío, corrupto, legado) ni con una limpieza pendiente; no resucita nada. Una versión
      // futura devuelve 'failed' también aquí: no se marca ni se recupera con Google.
      markOnly?: boolean;
    },
  ): Promise<CommitResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await enqueue(async (): Promise<CommitResult | 'retry'> => {
        if (epoch !== epoch0) return { kind: 'stale' };
        try {
          if (options.replaces) {
            const current = await storage.loadSession();
            // Una sesión de una versión futura jamás se sobrescribe ni se marca (tampoco en markOnly).
            if (current.kind === 'unsupported') return { kind: 'failed' };
            if (options.markOnly && current.kind !== 'session') {
              return { kind: 'saved', mine: epoch }; // el llamador revalida el epoch
            }
            if (
              current.kind === 'session' &&
              current.session.refreshToken !== options.replaces.refreshToken
            ) {
              return { kind: 'successor', session: current.session };
            }
          }
          if (options.markOnly && pendingClear) {
            return { kind: 'saved', mine: epoch }; // el llamador revalida el epoch
          }
          if (pendingClear) {
            // Reintento oportunista del borrado que el logout no pudo completar.
            await clearAllMarked();
          }
          await storage.saveSession(next);
        } catch {
          return 'retry';
        }
        // Hay una sesión legítima en disco: ninguna limpieza anterior puede borrarla después.
        pendingClear = false;
        // Un logout pudo ocurrir mientras se escribía: su clearAll ya está en la cola, detrás.
        if (epoch !== epoch0) return { kind: 'stale' };
        if (options.bump) epoch += 1;
        return { kind: 'saved', mine: epoch };
      });
      if (outcome !== 'retry') return outcome;
    }
    return epoch !== epoch0 ? { kind: 'stale' } : { kind: 'failed' };
  }

  // Termina la sesión local: memoria vacía, almacenamiento borrado y estado sin sesión.
  async function endSession(
    reason: 'absent' | 'revoked',
    epoch0: number,
    error: AuthErrorKind | null = null,
  ): Promise<CycleResult> {
    if (epoch !== epoch0) return ENDED;
    epoch += 1;
    const mine = epoch;
    setSession(null, 0);
    const cleared = await clearStorage();
    if (epoch !== mine) return ENDED;
    const base = {
      user: null,
      busy: false,
      degraded: false,
      error,
      notice: null,
    } as const;
    if (cleared) {
      setState({
        ...base,
        status: 'unauthenticated',
        signedOutReason: reason,
        unavailableCause: null,
      });
    } else {
      // No se afirma que el almacenamiento esté limpio (clearStorage dejó la marca pendiente).
      if (reason === 'revoked') {
        setState({
          ...base,
          status: 'unauthenticated',
          signedOutReason: reason,
          unavailableCause: null,
          notice: 'logout-storage-error',
        });
      } else {
        setState({
          ...base,
          status: 'unavailable',
          signedOutReason: null,
          unavailableCause: 'storage',
          error: null,
        });
      }
    }
    return ENDED;
  }

  // --- Ciclo único ---------------------------------------------------------------------------

  function runCycle(body: () => Promise<CycleResult>): Promise<CycleResult> {
    if (cycle) return cycle;
    const epoch0 = epoch;
    cycleSeq += 1;
    const run: Promise<CycleResult> = body()
      // Un error inesperado tardío (tras un logout o un reemplazo) no toca el estado.
      .catch((): CycleResult => fail('server', epoch0))
      .finally(() => {
        lastAttemptAt = now();
        if (cycle === run) cycle = null;
      });
    cycle = run;
    return run;
  }

  function refreshCycle(): Promise<CycleResult> {
    return runCycle(async () => {
      const epoch0 = epoch;
      return session ? rotate(session, epoch0, false) : ENDED;
    });
  }

  // Rotación: POST /auth/refresh -> guardar (cola, compare-and-set) -> publicar sin await entre
  // la revalidación del epoch y la publicación.
  async function rotate(
    base: StoredSessionV2,
    epoch0: number,
    afterConflict: boolean,
  ): Promise<CycleResult> {
    // Refresh token ya consumido (marca persistida tras un 409): jamás se reenvía a la API; se
    // recupera con Google respetando cooldown, presupuesto de un exchange por ciclo y single-flight.
    if (base.refreshConsumed) {
      if (unpersistedMark === base.refreshToken) {
        // La marca no llegó a disco: se reintenta ANTES de llamar a Google.
        const marked = await markConsumed(base, epoch0);
        if (marked.kind === 'stale') return ENDED;
        if (marked.kind === 'successor') return adoptSuccessor(marked.session, epoch0);
        if (marked.kind === 'failed') return fail('storage', epoch0);
      }
      return recover(epoch0, base.refreshToken, base.user.id, true);
    }
    let refreshed: RefreshedSession;
    try {
      refreshed = await api.refresh(base.refreshToken);
    } catch (error) {
      if (epoch !== epoch0) return ENDED;
      const kind = kindOf(error);
      // 401 INVALID_REFRESH_TOKEN: recuperación excepcional con Google.
      if (kind === 'rejected') return recover(epoch0, base.refreshToken, base.user.id, false);
      if (kind === 'conflict') {
        if (!afterConflict) {
          // El token ya está consumido: se marca en memoria de inmediato, antes de releer el disco
          // (si la relectura falla, ningún reintento de este proceso lo reenvía).
          markInMemory(base);
          return resolveConflict(base, epoch0);
        }
        // Un segundo 409 (ya con el sucesor) no justifica Google ni una nueva familia, pero el
        // sucesor también quedó consumido: se marca para que Reintentar o un reinicio no lo reenvíen.
        const marked = await markConsumed(base, epoch0);
        if (marked.kind === 'stale') return ENDED;
        if (marked.kind === 'failed') return fail('storage', epoch0);
        // Un tercer proceso escribió otro sucesor: queda en memoria, sin enviarse en este ciclo.
        if (marked.kind === 'successor') {
          setSession(marked.session, accessExpiryOf(marked.session.accessToken));
        }
        return fail('server', epoch0);
      }
      // red, 429/5xx, timeout o desconocido: nunca se borra nada.
      return failWith(error, epoch0);
    }
    const receivedAt = now();
    if (epoch !== epoch0) return ENDED;
    const next: StoredSessionV2 = {
      version: 2,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      refreshExpiresAt: refreshed.refreshExpiresAt,
      user: base.user, // el refresh no devuelve al usuario
    };
    const saved = await commit(next, epoch0, { bump: false });
    if (saved.kind === 'stale' || epoch !== epoch0) return ENDED;
    // Si no se pudo guardar (tras su único reintento) el par NO se publica ni se revoca: la
    // familia sigue siendo la del usuario y se recupera por Google si hiciera falta.
    if (saved.kind !== 'saved') return fail('storage', epoch0);
    publishSession(next, receivedAt + refreshed.expiresIn * 1000);
    return { ok: true, token: next.accessToken };
  }

  // 409 REFRESH_CONFLICT: otra renovación (p. ej. otro proceso) ya rotó este refresh token.
  // El token enviado jamás se reenvía.
  async function resolveConflict(base: StoredSessionV2, epoch0: number): Promise<CycleResult> {
    await sleep(
      Math.min(
        CONFLICT_WAIT_BASE_MS + CONFLICT_WAIT_JITTER_MS,
        CONFLICT_WAIT_BASE_MS + random() * CONFLICT_WAIT_JITTER_MS,
      ),
    );
    if (epoch !== epoch0) return ENDED;
    let loaded: StoredLoad;
    try {
      loaded = await enqueue(() => storage.loadSession());
    } catch {
      return fail('storage', epoch0);
    }
    if (epoch !== epoch0) return ENDED;
    // Una sesión de versión futura no se toca ni se reemplaza.
    if (loaded.kind === 'unsupported') return fail('storage', epoch0);
    if (loaded.kind === 'session' && loaded.session.refreshToken !== base.refreshToken) {
      return adoptSuccessor(loaded.session, epoch0);
    }
    // Sin sucesor: el token quedó consumido. La marca se persiste ANTES de llamar a Google.
    const marked = await markConsumed(base, epoch0);
    if (marked.kind === 'stale') return ENDED;
    // Apareció un sucesor entre la lectura y la escritura: se adopta, sin marca ni Google.
    if (marked.kind === 'successor') return adoptSuccessor(marked.session, epoch0);
    // Sin poder persistir la marca no se llama a Google (un reinicio reenviaría el token).
    if (marked.kind === 'failed') return fail('storage', epoch0);
    return recover(epoch0, base.refreshToken, base.user.id, true);
  }

  // Marca síncrona de la copia en memoria; la persistencia la intenta markConsumed (o, si falla la
  // relectura, el guard de rotate gracias a `unpersistedMark`). Un sucesor adoptado después la limpia.
  function markInMemory(base: StoredSessionV2) {
    if (session?.refreshToken !== base.refreshToken || session.refreshConsumed) return;
    setSession({ ...base, refreshConsumed: true }, accessExpiresAt);
    unpersistedMark = base.refreshToken;
  }

  // Marca `base.refreshToken` como consumido: compare-and-set por epoch y por token en la cola, y
  // copia en memoria marcada (salvo stale o sucesor). Si el disco falla queda `unpersistedMark`.
  async function markConsumed(
    base: StoredSessionV2,
    epoch0: number,
  ): Promise<
    | { kind: 'saved' }
    | { kind: 'failed' }
    | { kind: 'stale' }
    | { kind: 'successor'; session: StoredSessionV2 }
  > {
    const marked: StoredSessionV2 = { ...base, refreshConsumed: true };
    const saved = await commit(marked, epoch0, {
      bump: false,
      markOnly: true,
      replaces: { refreshToken: base.refreshToken },
    });
    if (saved.kind === 'stale' || epoch !== epoch0) return { kind: 'stale' };
    if (saved.kind === 'successor') return saved;
    if (session?.refreshToken === base.refreshToken) setSession(marked, accessExpiresAt);
    unpersistedMark = saved.kind === 'failed' ? base.refreshToken : null;
    return { kind: saved.kind === 'failed' ? 'failed' : 'saved' };
  }

  // Adopta el sucesor escrito por otro proceso: lo publica si está fresco o lo rota una vez.
  function adoptSuccessor(successor: StoredSessionV2, epoch0: number): Promise<CycleResult> {
    const expiresAt = accessExpiryOf(successor.accessToken);
    setSession(successor, expiresAt);
    if (isFresh()) {
      publishSession(successor, expiresAt);
      return Promise.resolve({ ok: true, token: successor.accessToken });
    }
    return rotate(successor, epoch0, true);
  }

  // Recuperación excepcional con Google (401 INVALID_REFRESH_TOKEN o 409 sin sucesor). Una
  // sola familia nueva por ciclo. Nunca tras un logout explícito.
  async function recover(
    epoch0: number,
    refreshTokenOld: string | null,
    expectedUserId: string,
    fromConflict: boolean,
  ): Promise<CycleResult> {
    if (epoch !== epoch0 || state.signedOutReason === 'signed-out') return ENDED;
    if (lastRecoveryAt !== null && now() - lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
      return fail('server', epoch0);
    }
    let silent;
    try {
      silent = await withTimeout(() => google.signInSilently(), GOOGLE_SILENT_TIMEOUT_MS);
    } catch (error) {
      if (epoch !== epoch0) return ENDED;
      lastRecoveryAt = now();
      return failWith(error, epoch0);
    }
    if (epoch !== epoch0) return ENDED;
    if (silent.status !== 'success') {
      lastRecoveryAt = now();
      return endSession('revoked', epoch0);
    }
    let fresh: ApiSession;
    try {
      fresh = await api.exchangeGoogleToken(silent.idToken);
    } catch (error) {
      if (epoch !== epoch0) return ENDED;
      lastRecoveryAt = now();
      const kind = kindOf(error);
      return kind === 'rejected' ? endSession('revoked', epoch0) : failWith(error, epoch0);
    }
    const receivedAt = now();
    if (epoch !== epoch0) {
      bestEffortLogout(fresh.refreshToken); // (a) familia nueva sin persistir ni publicar
      return ENDED;
    }
    if (fresh.user.id !== expectedUserId) {
      // Google devolvió otra cuenta. No se reemplaza la sesión en silencio: la nueva familia,
      // creada por esta llamada, es huérfana y se revoca (a). La sesión previa ya era inservible
      // (su refresh token fue rechazado con 401, o consumido por un 409 sin sucesor): se cierra
      // localmente y se pide un inicio interactivo. No se afirma ninguna revocación remota.
      // La familia ANTIGUA no se revoca: tras un 401 ya está muerta (sería un no-op) y tras un
      // 409 puede seguir viva con un sucesor que conoce otro proceso o dispositivo; revocarla
      // mataría una sesión legítima.
      bestEffortLogout(fresh.refreshToken);
      return endSession('absent', epoch0, 'conflict');
    }
    const next = toStored(fresh);
    const saved = await commit(next, epoch0, {
      bump: true,
      replaces: { refreshToken: refreshTokenOld },
    });
    if (saved.kind === 'saved') {
      if (epoch !== saved.mine) {
        bestEffortLogout(fresh.refreshToken); // (a) un logout llegó tras guardar
        return ENDED;
      }
      lastRecoveryAt = null;
      publishSession(next, receivedAt + fresh.expiresIn * 1000);
      if (refreshTokenOld !== null && !fromConflict) bestEffortLogout(refreshTokenOld); // (b) solo 401
      return { ok: true, token: next.accessToken };
    }
    // (a) El par recuperado no se usa: se revoca para no dejar una familia huérfana.
    bestEffortLogout(fresh.refreshToken);
    if (saved.kind === 'stale' || epoch !== epoch0) return ENDED;
    lastRecoveryAt = now();
    if (saved.kind === 'successor') {
      // Apareció un sucesor legítimo: se adopta en lugar del par recuperado.
      const expiresAt = accessExpiryOf(saved.session.accessToken);
      setSession(saved.session, expiresAt);
      if (isFresh()) {
        publishSession(saved.session, expiresAt);
        return { ok: true, token: saved.session.accessToken };
      }
    }
    return fail('storage', epoch0);
  }

  function toStored(fresh: ApiSession): StoredSessionV2 {
    return {
      version: 2,
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      refreshExpiresAt: fresh.refreshExpiresAt,
      user: fresh.user,
    };
  }

  // Migración de JWT v1 (session_token) a v2 dentro del ciclo. Nunca llama a /me con un JWT v1.
  // No compara usuarios: los claims de un JWT v1 no se verifican en el dispositivo y en esta fase
  // la sesión v1 no guarda datos locales (todo vive en la API por usuario), así que el resultado
  // equivale a un inicio de sesión con la cuenta de Google del dispositivo.
  async function migrate(epoch0: number): Promise<CycleResult> {
    let silent;
    try {
      silent = await withTimeout(() => google.signInSilently(), GOOGLE_SILENT_TIMEOUT_MS);
    } catch (error) {
      // Error transitorio: session_token queda intacto para reintentar con restore().
      return failWith(error, epoch0);
    }
    if (epoch !== epoch0) return ENDED;
    if (silent.status !== 'success') return endSession('absent', epoch0);
    let fresh: ApiSession;
    try {
      fresh = await api.exchangeGoogleToken(silent.idToken);
    } catch (error) {
      if (epoch !== epoch0) return ENDED;
      const kind = kindOf(error);
      return kind === 'rejected' ? endSession('absent', epoch0) : failWith(error, epoch0);
    }
    const receivedAt = now();
    if (epoch !== epoch0) {
      bestEffortLogout(fresh.refreshToken); // (a) familia nueva sin persistir ni publicar
      return ENDED;
    }
    const next = toStored(fresh);
    const saved = await commit(next, epoch0, { bump: true });
    if (saved.kind !== 'saved') {
      bestEffortLogout(fresh.refreshToken); // (a) no se pudo guardar v2
      return saved.kind === 'stale' ? ENDED : fail('storage', epoch0);
    }
    // Solo tras confirmar el guardado de v2 se borra session_token. Si falla es inocuo: v2 prevalece.
    await enqueue(() => storage.clearLegacy()).catch(noop);
    if (epoch !== saved.mine) {
      bestEffortLogout(fresh.refreshToken); // (a) un logout llegó tras guardar
      return ENDED;
    }
    publishSession(next, receivedAt + fresh.expiresIn * 1000);
    return { ok: true, token: next.accessToken };
  }

  // --- API pública ----------------------------------------------------------------------------

  async function ensureToken(): Promise<string> {
    if (session && isFresh()) return session.accessToken;
    const result = await refreshCycle();
    if (result.ok) return result.token;
    // Falla transitoria con el access aún sin vencer: la llamada puede seguir con él.
    if (result.cause !== 'ended' && session && accessExpiresAt > now()) return session.accessToken;
    throw causeToError(result);
  }

  async function authorizedCall<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
    const used = await ensureToken();
    try {
      return await call(used);
    } catch (error) {
      if (!(error instanceof AuthError) || error.kind !== 'rejected') throw error;
      // Otro ciclo ya renovó mientras la llamada estaba en vuelo: se reintenta sin otro refresh.
      if (session && session.accessToken !== used) return call(session.accessToken);
      const result = await refreshCycle();
      if (!result.ok) throw causeToError(result);
      // Un segundo 401 se propaga tal cual: no se destruye la sesión automáticamente.
      return call(result.token);
    }
  }

  async function doRestore(): Promise<void> {
    const epoch0 = epoch;
    const afterLogout =
      state.status === 'unauthenticated' && state.signedOutReason === 'signed-out' && !pendingClear;
    if (state.status === 'unavailable' || state.degraded) setState({ busy: true });
    if (pendingClear && session === null) {
      // La marca se evalúa DENTRO de la cola: si un inicio de sesión nuevo se guardó antes, la
      // marca ya está apagada y esta limpieza no corre (jamás borra una sesión legítima).
      const outcome = await enqueue(async () => {
        if (!pendingClear || epoch !== epoch0) return 'skip' as const;
        return (await clearAllMarked()) ? ('cleared' as const) : ('failed' as const);
      });
      if (epoch !== epoch0) return;
      if (outcome === 'failed') {
        setState({
          status: 'unauthenticated',
          user: null,
          busy: false,
          signedOutReason: 'signed-out',
          notice: 'logout-storage-error',
        });
        return;
      }
    }

    // Si hay un ciclo activo se espera a que termine y se relee: una lectura anterior a lo que el
    // ciclo ya publicó nunca debe reponer un par viejo en memoria.
    let loaded: StoredLoad;
    let gen: number;
    for (let attempt = 0; ; attempt += 1) {
      if (cycle) {
        const waited = await cycle;
        // Logout o recuperación: el ciclo (o el logout) ya dejó el estado final.
        if (epoch !== epoch0) return;
        // El ciclo ya intentó la red y falló de forma transitoria (y dejó el estado unavailable o
        // degraded): no se lanza un segundo refresh por la misma pulsación. Un nuevo intento
        // queda para el siguiente Reintentar, tras RESTORE_MIN_INTERVAL_MS.
        if (!waited.ok && waited.cause !== 'ended') return;
      }
      gen = generation;
      try {
        loaded = await enqueue(() => storage.loadSession());
      } catch {
        fail('storage', epoch0);
        return;
      }
      if (epoch !== epoch0) return;
      if ((cycle || generation !== gen) && attempt < 3) continue;
      break;
    }
    // Quedó una publicación entre la lectura y su aplicación: manda la memoria.
    if (generation !== gen && session) loaded = { kind: 'session', session };

    switch (loaded.kind) {
      case 'empty':
        setState({
          status: 'unauthenticated',
          user: null,
          busy: false,
          degraded: false,
          // Un cierre explícito concurrente con este restore() no se reetiqueta como "ausente".
          signedOutReason: afterLogout ? 'signed-out' : 'absent',
          unavailableCause: null,
        });
        return;
      case 'corrupt':
        // Contenido ilegible de la versión actual: se limpia y se trata como sesión ausente.
        await endSession('absent', epoch0);
        return;
      case 'unsupported':
        // Sesión de una versión futura de la app: NUNCA se borra automáticamente.
        fail('storage', epoch0);
        return;
      case 'legacy':
        await runCycle(() => migrate(epoch0));
        return;
      case 'session':
        break;
    }

    // Si además quedó session_token de la v1, v2 prevalece: se borra sin esperar (best-effort).
    void enqueue(() => storage.clearLegacy()).catch(noop);
    if (generation === gen) {
      const memory = session;
      if (memory?.refreshToken !== loaded.session.refreshToken) {
        setSession(loaded.session, accessExpiryOf(loaded.session.accessToken));
      } else if (loaded.session.refreshConsumed && !memory.refreshConsumed) {
        // Otro proceso marcó el token en disco: se fusiona (la marca de memoria, si la hay, ya se
        // conserva porque la copia en memoria no se reemplaza).
        setSession(
          { ...loaded.session, refreshConsumed: true },
          accessExpiryOf(loaded.session.accessToken),
        );
      }
    }
    try {
      if (isFresh()) {
        const user = await authorizedCall((accessToken) => api.getMe(accessToken));
        if (epoch !== epoch0) return;
        setState({
          status: 'authenticated',
          user,
          busy: false,
          degraded: false,
          signedOutReason: null,
          unavailableCause: null,
          error: null,
        });
      } else {
        // El ciclo de renovación publica el resultado por sí mismo.
        await ensureToken();
      }
    } catch (error) {
      if (epoch !== epoch0) return;
      lastAttemptAt = now();
      const kind = kindOf(error);
      if (kind === 'rejected') {
        // Un 401 persistente tras renovar no destruye la sesión: queda no disponible con
        // reintento manual (el access "vigente" por reloj no es de fiar).
        setState({
          status: 'unavailable',
          busy: false,
          degraded: false,
          unavailableCause: 'server',
          error: null,
        });
      } else {
        markTransient(causeOf(kind), detailOf(kind));
      }
    }
  }

  // Revalidación proactiva de una sesión degradada con el access aún vigente: UNA comprobación
  // GET /me con el access en memoria. A propósito NO usa authorizedCall: ante un 401 éste rotaría
  // el refresh token con el access todavía vigente por reloj, y aquí no se debe rotar, recuperar
  // con Google ni crear familias. Resultado:
  //  - 200: se quita degraded y se publica el usuario devuelto.
  //  - 401 (rejected), red, timeout, 429 o 5xx: "no verificable". Se conserva la sesión y degraded
  //    (jamás se borra el almacenamiento ni se pasa a unauthenticated) y se estampa lastAttemptAt.
  //    El 401 lo resolverán el siguiente uso real (authorizedCall) o la renovación proactiva
  //    cuando el access entre en el margen de vencimiento.
  // Un resultado tardío (logout o reemplazo de sesión) no modifica el estado.
  async function revalidate(): Promise<void> {
    const epoch0 = epoch;
    const gen0 = generation;
    const seq0 = cycleSeq;
    const used = session?.accessToken;
    if (used === undefined) return;
    // Otro ciclo o sesión tomó el control mientras volaba el GET /me: el resultado ya no aplica.
    const superseded = () =>
      generation !== gen0 || session?.accessToken !== used || cycle !== null || cycleSeq !== seq0;
    // Libera busy al descartar. Con un ciclo activo lo libera el propio ciclo al publicar.
    const discard = () => {
      if (!cycle && state.busy) setState({ busy: false });
    };
    setState({ busy: true });
    try {
      const user = await api.getMe(used);
      if (epoch !== epoch0) return; // logout/reemplazo: el estado ya es de otro; busy no se toca
      lastAttemptAt = now();
      if (superseded()) return discard();
      setState({
        status: 'authenticated',
        user,
        busy: false,
        degraded: false,
        signedOutReason: null,
        unavailableCause: null,
        error: null,
        notice: null,
      });
    } catch (error) {
      if (epoch !== epoch0) return;
      lastAttemptAt = now();
      if (superseded()) return discard();
      // 401: "no verificada" (error='rejected'); red/timeout/429/5xx: conectividad (nunca 'rejected').
      const kind = kindOf(error);
      setState({ busy: false, error: kind === 'rejected' ? 'rejected' : kind });
    }
  }

  function restore(): Promise<void> {
    // Un inicio de sesión interactivo en vuelo manda: restore() no corre ni toca lastAttemptAt.
    if (signInToken !== null) return Promise.resolve();
    if (restoring) return restoring;
    // Reintentar repetido: dentro del intervalo mínimo no se vuelve a la red ni a rotar.
    if (
      (state.status === 'unavailable' || (state.status === 'authenticated' && state.degraded)) &&
      lastAttemptAt !== null &&
      now() - lastAttemptAt < RESTORE_MIN_INTERVAL_MS
    ) {
      return Promise.resolve();
    }
    // Sesión degradada con access vigente y sin ciclo en vuelo: solo se revalida con GET /me.
    const probe =
      state.status === 'authenticated' && state.degraded && session !== null && !cycle && isFresh();
    const run = (probe ? revalidate() : doRestore()).finally(() => {
      if (restoring === run) restoring = null;
    });
    restoring = run;
    return run;
  }

  async function signIn() {
    // evita pulsaciones repetidas y no compite con una restauración en curso
    if (state.busy || restoring) return;
    const epoch0 = epoch;
    // Mismo turno síncrono que setState({ busy: true }): sin await antes.
    const mine = {};
    signInToken = mine;
    setState({ busy: true, error: null, notice: null });
    try {
      const result = await withTimeout(() => google.signIn(), GOOGLE_INTERACTIVE_TIMEOUT_MS);
      // Un resultado tardío tras un logout o un reemplazo no se intercambia ni se persiste.
      if (epoch !== epoch0) return;
      if (result.status !== 'success') {
        setState({ busy: false }); // cancelación voluntaria: sin error
        return;
      }
      const fresh = await api.exchangeGoogleToken(result.idToken);
      const receivedAt = now();
      const next = toStored(fresh);
      const saved = await commit(next, epoch0, { bump: true });
      if (saved.kind !== 'saved' || epoch !== saved.mine) {
        // (a) Logout durante el inicio, o fallo de almacenamiento: la familia nueva no se usa.
        bestEffortLogout(fresh.refreshToken);
        if (saved.kind === 'failed') throw new AuthError('storage');
        return;
      }
      lastRecoveryAt = null; // el inicio interactivo ignora el cooldown
      // Identidad nueva: ningún ciclo anterior (rotación en vuelo) puede acogerse a esta sesión.
      cycle = null;
      publishSession(next, receivedAt + fresh.expiresIn * 1000);
    } catch (error) {
      if (epoch !== epoch0) return;
      setState({ busy: false, error: kindOf(error) });
    } finally {
      // Un signIn viejo (invalidado por signOut) no libera el token de uno nuevo.
      if (signInToken === mine) signInToken = null;
    }
  }

  async function signOut(): Promise<LogoutOutcome> {
    // Parte síncrona: el estado local queda cerrado antes de tocar disco o red.
    const refreshSnapshot = session?.refreshToken ?? null;
    epoch += 1;
    signInToken = null; // el cierre invalida el signIn en vuelo: restore() vuelve a poder correr
    // Un restore() obsoleto no debe bloquear el siguiente signIn(); su finally compara `restoring === run`.
    restoring = null;
    const mine = epoch;
    setSession(null, 0);
    cycle = null; // un ciclo anterior no debe acoger llamadas de una sesión posterior
    setState({
      status: 'unauthenticated',
      user: null,
      busy: false,
      degraded: false,
      signedOutReason: 'signed-out',
      unavailableCause: null,
      error: null,
      notice: null,
    });

    const { token, cleared } = await enqueue(async () => {
      let found = refreshSnapshot;
      if (found === null) {
        try {
          const loaded = await storage.loadSession();
          if (loaded.kind === 'session') found = loaded.session.refreshToken;
        } catch {
          // sin acceso al almacenamiento: se intenta igualmente borrar
        }
      }
      return { token: found, cleared: await clearAllMarked() };
    });
    if (!cleared && epoch === mine) setState({ notice: 'logout-storage-error' });
    try {
      await google.signOut();
    } catch {
      // El cierre local ya se hizo; un fallo de Google no debe dejar la sesión abierta.
    }
    if (token === null) return 'no-token';
    try {
      // (c) Logout explícito: la API revoca la familia entera a partir de este refresh token.
      await api.logout(token); // UN solo intento; sin cola persistente de reintentos
      return 'revoked';
    } catch {
      // El aviso de almacenamiento, más grave, no se pisa.
      if (epoch === mine && state.notice === null) setState({ notice: 'logout-unconfirmed' });
      return 'not-confirmed';
    }
  }

  // Reactivación de la app. No modifica el estado por sí misma: delega en restore() o en el ciclo
  // de renovación, que ya validan el epoch, el cooldown de recuperación y la marca refreshConsumed.
  async function onForeground(): Promise<void> {
    try {
      // Primera carga, restauración, ciclo o inicio de sesión en vuelo: ya hay trabajo en curso.
      if (state.status === 'initializing' || state.busy || restoring || cycle) return;
      // Sin sesión (incluido el cierre explícito): jamás se llama a Google en automático.
      if (state.status === 'unauthenticated') return;
      if (state.status === 'unavailable') {
        // Una recuperación controlada; restore() aplica RESTORE_MIN_INTERVAL_MS.
        await restore();
        return;
      }
      if (session === null) return;
      // Degradada con el access vigente: una revalidación GET /me (restore aplica los 5 s).
      if (isFresh()) {
        if (state.degraded) await restore();
        return;
      }
      // Tras un intento fallido reciente no se vuelve a la red (mismo intervalo que Reintentar).
      if (lastAttemptAt !== null && now() - lastAttemptAt < RESTORE_MIN_INTERVAL_MS) return;
      await ensureToken();
    } catch {
      // fire-and-forget: ensureToken rechaza si no pudo renovar y el estado ya quedó publicado
    }
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
    onForeground,
  };
}
