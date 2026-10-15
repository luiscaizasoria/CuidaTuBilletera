// Tipos compartidos de autenticación. La sesión de la app es el par access/refresh JWT v2 de la API.
export type AuthErrorKind =
  | 'play-services' // Google Play Services no disponible o desactualizado
  | 'in-progress' // ya hay un inicio de sesión de Google en curso
  | 'config' // configuración de Google o de la app incompleta/incorrecta
  | 'network' // sin conexión o servidor inalcanzable
  | 'rejected' // la API rechazó las credenciales
  | 'conflict' // 409 REFRESH_CONFLICT: otra renovación ganó la carrera; NO implica revocación
  | 'server' // 429 o 5xx: temporal, la sesión no se invalida
  | 'storage' // fallo nativo de SecureStore
  | 'unknown';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    readonly status?: number,
    readonly code?: string,
  ) {
    // Nunca se incluye el cuerpo de la API ni credenciales en el mensaje.
    super(kind);
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export type GoogleIdTokenResult =
  | { status: 'success'; idToken: string }
  | { status: 'cancelled' } // el usuario canceló: no es un error
  | { status: 'no-saved-credential' }; // solo en la renovación silenciosa

// Proveedor de Google intercambiable: en pruebas no se usa Google real.
export interface GoogleProvider {
  signIn(): Promise<GoogleIdTokenResult>;
  signInSilently(): Promise<GoogleIdTokenResult>;
  signOut(): Promise<void>;
}

// Sesión devuelta por POST /auth/google.
export interface ApiSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string; // 43 caracteres base64url
  refreshExpiresAt: string; // ISO 8601
  user: AuthUser;
}

// Respuesta de POST /auth/refresh: rota el refresh token y no incluye al usuario.
export interface RefreshedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
}

// Resultado de cerrar sesión.
export type LogoutOutcome = 'revoked' | 'not-confirmed' | 'no-token';

export interface StoredSessionV2 {
  version: 2;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
  // `true`: el refresh token guardado ya fue consumido (409 REFRESH_CONFLICT sin sucesor) y NO puede
  // volver a enviarse a /auth/refresh. Ausente en sesiones antiguas (equivale a «no consumido»).
  refreshConsumed?: true;
}

// load() NUNCA borra. 'unsupported' (versión futura) existe aparte de 'corrupt' para que nadie
// borre automáticamente una sesión escrita por una versión más nueva de la app.
export type StoredLoad =
  | { kind: 'session'; session: StoredSessionV2 }
  | { kind: 'legacy'; token: string }
  | { kind: 'corrupt' }
  | { kind: 'unsupported' }
  | { kind: 'empty' };

export interface SessionStorage {
  loadSession(): Promise<StoredLoad>;
  saveSession(session: StoredSessionV2): Promise<void>;
  clearLegacy(): Promise<void>;
  // Borra session_v2 y session_token; lanza AuthError('storage') si alguna falló.
  clearAll(): Promise<void>;
}

export interface SessionApi {
  exchangeGoogleToken(idToken: string): Promise<ApiSession>;
  refresh(refreshToken: string): Promise<RefreshedSession>;
  // Resuelve solo con 204; cualquier otro resultado rechaza.
  logout(refreshToken: string): Promise<void>;
  getMe(accessToken: string): Promise<AuthUser>;
}
