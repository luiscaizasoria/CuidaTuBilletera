import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from './auth-types';

const SESSION_KEY = 'session_token';

// Guarda únicamente el JWT propio en el Android Keystore. Nunca el ID token de Google.
export const secureSessionStorage: SessionStorage = {
  load: () => SecureStore.getItemAsync(SESSION_KEY),
  save: (token) => SecureStore.setItemAsync(SESSION_KEY, token),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
};
