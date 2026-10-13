// Tipos compartidos de autenticación. La sesión de la app es solo el JWT propio de la API.
export type AuthErrorKind =
  | 'play-services' // Google Play Services no disponible o desactualizado
  | 'in-progress' // ya hay un inicio de sesión de Google en curso
  | 'config' // configuración de Google o de la app incompleta/incorrecta
  | 'network' // sin conexión o servidor inalcanzable
  | 'rejected' // la API rechazó las credenciales
  | 'unknown';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface ApiSession {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
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

export interface SessionStorage {
  load(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionApi {
  exchangeGoogleToken(idToken: string): Promise<ApiSession>;
  getMe(accessToken: string): Promise<AuthUser>;
}
