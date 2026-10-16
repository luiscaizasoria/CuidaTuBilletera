import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './hooks/use-auth';
import { createAuthService, type AuthService } from './lib/auth-service';
import { readConfig } from './lib/config';
import { createGoogleProvider } from './lib/google-auth';
import { createResourcesApi, type ResourcesApi } from './lib/resources-api';
import { createSessionApi } from './lib/session-api';
import { secureSessionStorage } from './lib/session-storage';
import ConfigMissingScreen from './screens/ConfigMissingScreen';
import LoginScreen from './screens/LoginScreen';
import MainNavigator from './screens/MainNavigator';
import { Screen } from './screens/ui';

function createDefaultService(): AuthService | null {
  const config = readConfig();
  if (!config) return null;
  return createAuthService({
    google: createGoogleProvider(config.googleWebClientId),
    storage: secureSessionStorage,
    api: createSessionApi(config.apiUrl),
  });
}

function createDefaultResourcesApi(): ResourcesApi {
  // Sin configuración la app ni siquiera llega aquí (ConfigMissingScreen); '' solo aplica en pruebas.
  return createResourcesApi(readConfig()?.apiUrl ?? '');
}

// Un solo `Screen` por ruta (docs/003, Decisión R2 D6): lo pone el navegador o esta raíz, nunca
// las pantallas reutilizadas.
function Root({ api }: { api: ResourcesApi }) {
  const { status, user } = useAuth();

  if (status === 'initializing') {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" testID="app-loading" />
        </View>
      </Screen>
    );
  }
  // Sin disponibilidad temporal la sesión se conserva: se muestra la pantalla principal con reintento.
  // `key` por usuario: otro usuario monta un navegador nuevo, sin rastro del anterior.
  return status === 'authenticated' || status === 'unavailable' ? (
    <MainNavigator key={user?.id ?? 'none'} api={api} />
  ) : (
    <Screen scroll={false} padded={false}>
      <LoginScreen />
    </Screen>
  );
}

// `service` solo se inyecta en pruebas; en la app se construye con la configuración real.
export default function App({
  service,
  resourcesApi,
}: {
  service?: AuthService;
  resourcesApi?: ResourcesApi;
}) {
  const resolved = useMemo(() => service ?? createDefaultService(), [service]);
  const api = useMemo(() => resourcesApi ?? createDefaultResourcesApi(), [resourcesApi]);

  return (
    <>
      {resolved ? (
        <AuthProvider service={resolved}>
          <Root api={api} />
        </AuthProvider>
      ) : (
        <Screen scroll={false} padded={false}>
          <ConfigMissingScreen />
        </Screen>
      )}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
