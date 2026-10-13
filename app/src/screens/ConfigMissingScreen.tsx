import { StyleSheet, Text, View } from 'react-native';

export default function ConfigMissingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuración incompleta</Text>
      <Text style={styles.text}>
        Faltan EXPO_PUBLIC_API_URL o EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Revisa app/.env.example.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  text: { textAlign: 'center' },
});
