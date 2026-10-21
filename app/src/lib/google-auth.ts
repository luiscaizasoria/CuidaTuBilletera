import {
  GoogleSignin,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { AuthError, type GoogleIdTokenResult, type GoogleProvider } from './auth-types';

// Códigos de estado de Google Play Services (GoogleSignInStatusCodes) que la librería
// entrega como texto y que no exporta en statusCodes.
const NETWORK_ERROR = '7';
const DEVELOPER_ERROR = '10'; // SHA-1/paquete/cliente mal configurados en Google Cloud

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (isErrorWithCode(error)) {
    const code = String(error.code);
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new AuthError('play-services');
    if (code === statusCodes.IN_PROGRESS) return new AuthError('in-progress');
    if (code === NETWORK_ERROR) return new AuthError('network');
    if (code === DEVELOPER_ERROR) return new AuthError('config');
  }
  // No se conserva el mensaje original: podría contener datos de la cuenta.
  return new AuthError('unknown');
}

function idTokenOf(user: { idToken: string | null }): string {
  // Sin idToken lo habitual es un webClientId ausente o que no es de tipo Web.
  if (!user.idToken) throw new AuthError('config');
  return user.idToken;
}

export function createGoogleProvider(webClientId: string): GoogleProvider {
  // Solo el ID token: sin scopes adicionales (por defecto email y perfil).
  GoogleSignin.configure({ webClientId });

  return {
    async signIn(): Promise<GoogleIdTokenResult> {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return { status: 'cancelled' };
        return { status: 'success', idToken: idTokenOf(response.data) };
      } catch (error) {
        throw toAuthError(error);
      }
    },

    async signInSilently(): Promise<GoogleIdTokenResult> {
      try {
        const response = await GoogleSignin.signInSilently();
        if (isNoSavedCredentialFoundResponse(response)) return { status: 'no-saved-credential' };
        if (!isSuccessResponse(response)) return { status: 'no-saved-credential' };
        return { status: 'success', idToken: idTokenOf(response.data) };
      } catch (error) {
        throw toAuthError(error);
      }
    },

    async reauthenticate(): Promise<GoogleIdTokenResult> {
      try {
        // Best-effort: fuerza el selector de cuentas en lugar de reutilizar la cuenta anterior.
        try {
          await GoogleSignin.signOut();
        } catch {
          // un fallo aquí no impide pedir la cuenta
        }
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return { status: 'cancelled' };
        return { status: 'success', idToken: idTokenOf(response.data) };
      } catch (error) {
        throw toAuthError(error);
      }
    },

    async signOut(): Promise<void> {
      await GoogleSignin.signOut();
    },
  };
}
