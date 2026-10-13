import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { AUTH_ERROR_MESSAGES } from '../lib/auth-messages';

export default function LoginScreen() {
  const { busy, error, signIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CuidaTuBilletera</Text>
      <Text style={styles.subtitle}>Inicia sesión para continuar.</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {AUTH_ERROR_MESSAGES[error]}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => void signIn()}
        style={[styles.button, busy && styles.buttonDisabled]}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" testID="login-loading" />
        ) : (
          <Text style={styles.buttonText}>Ingresar con Google</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#444444', marginBottom: 24 },
  error: { color: '#b00020', textAlign: 'center', marginBottom: 16 },
  button: {
    minWidth: 240,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    paddingHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
