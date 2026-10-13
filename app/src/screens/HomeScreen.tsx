import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { AUTH_ERROR_MESSAGES } from '../lib/auth-messages';

export default function HomeScreen() {
  const { user, error, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sesión iniciada</Text>
      {user?.name ? <Text style={styles.name}>{user.name}</Text> : null}
      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      {error ? <Text style={styles.notice}>{AUTH_ERROR_MESSAGES[error]}</Text> : null}
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
});
