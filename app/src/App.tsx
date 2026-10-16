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

function Root({ api }: { api: ResourcesApi }) {
  const { status } = useAuth();

  if (status === 'initializing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" testID="app-loading" />
      </View>
    );
  }
  // Sin disponibilidad temporal la sesión se conserva: se muestra la pantalla principal con reintento.
  return status === 'authenticated' || status === 'unavailable' ? (
    <MainNavigator api={api} />
  ) : (
    <LoginScreen />
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
      {/* R2 debe retirar este envoltorio al migrar cada pantalla a Screen (evita relleno duplicado). */}
      <Screen scroll={false} padded={false} keyboardAvoiding={false} statusBar="bg">
        {resolved ? (
          <AuthProvider service={resolved}>
            <Root api={api} />
          </AuthProvider>
        ) : (
          <ConfigMissingScreen />
        )}
      </Screen>
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
