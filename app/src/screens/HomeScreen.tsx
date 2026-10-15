import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import {
  DEGRADED_MESSAGE,
  DEGRADED_UNVERIFIED_MESSAGE,
  unavailableMessage,
} from '../lib/auth-messages';

export default function HomeScreen({ onOpenAccounts }: { onOpenAccounts?: () => void }) {
  const { status, user, busy, degraded, unavailableCause, error, signOut, restore } = useAuth();
  const unavailable = status === 'unavailable';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{unavailable ? 'Sesión no disponible' : 'Sesión iniciada'}</Text>
      {user?.name ? <Text style={styles.name}>{user.name}</Text> : null}
      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      {degraded ? (
        <Text style={styles.notice}>
          {error === 'rejected' ? DEGRADED_UNVERIFIED_MESSAGE : DEGRADED_MESSAGE}
        </Text>
      ) : null}
      {unavailable && unavailableCause ? (
        <Text style={styles.notice}>{unavailableMessage(unavailableCause, error)}</Text>
      ) : null}
      {unavailable || degraded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => void restore()}
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>Reintentar</Text>
        </Pressable>
      ) : null}
      {onOpenAccounts && !unavailable ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenAccounts}
          style={[styles.primaryButton, styles.accountsButton]}
        >
          <Text style={styles.primaryButtonText}>Cuentas</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.button}>
        <Text style={styles.buttonText}>Cerrar sesión</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  name: { fontSize: 18, marginBottom: 4 },
  email: { fontSize: 16, color: '#444444', marginBottom: 24 },
  notice: { color: '#8a6d00', textAlign: 'center', marginBottom: 16 },
  button: {
    minWidth: 240,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  buttonText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  primaryButton: {
    minWidth: 240,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  accountsButton: { marginBottom: 12 },
});
