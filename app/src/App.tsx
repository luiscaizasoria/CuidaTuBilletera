import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './hooks/use-auth';
import { createAuthService, type AuthService } from './lib/auth-service';
import { readConfig } from './lib/config';
import { createGoogleProvider } from './lib/google-auth';
import { createSessionApi } from './lib/session-api';
import { secureSessionStorage } from './lib/session-storage';
import ConfigMissingScreen from './screens/ConfigMissingScreen';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';

function createDefaultService(): AuthService | null {
  const config = readConfig();
  if (!config) return null;
  return createAuthService({
    google: createGoogleProvider(config.googleWebClientId),
    storage: secureSessionStorage,
    api: createSessionApi(config.apiUrl),
  });
}

function Root() {
  const { status } = useAuth();

  if (status === 'initializing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" testID="app-loading" />
      </View>
    );
  }
  // Sin disponibilidad temporal la sesión se conserva: se muestra la pantalla principal con reintento.
  return status === 'authenticated' || status === 'unavailable' ? <HomeScreen /> : <LoginScreen />;
}

// `service` solo se inyecta en pruebas; en la app se construye con la configuración real.
export default function App({ service }: { service?: AuthService }) {
  const resolved = useMemo(() => service ?? createDefaultService(), [service]);

  return (
    <>
      {resolved ? (
        <AuthProvider service={resolved}>
          <Root />
        </AuthProvider>
      ) : (
        <ConfigMissingScreen />
      )}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
