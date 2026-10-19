// Franja de estado de la sesión (comportamiento trasladado de HomeScreen): degradada o no disponible.
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import {
  DEGRADED_MESSAGE,
  DEGRADED_UNVERIFIED_MESSAGE,
  unavailableMessage,
} from '../lib/auth-messages';
import { colors, radii, typography } from '../theme/tokens';
import { SignOutControl } from './session-ui';
import { Button } from './ui';

export default function SessionBanner() {
  const { status, busy, degraded, unavailableCause, error, restore } = useAuth();
  const unavailable = status === 'unavailable';
  if (!unavailable && !degraded) return null;
  return (
    <View testID="session-banner" style={styles.banner}>
      {unavailable ? (
        <Text accessibilityRole="header" style={styles.title}>
          Sesión no disponible
        </Text>
      ) : null}
      {unavailable && unavailableCause ? (
        <Text style={styles.text}>{unavailableMessage(unavailableCause, error)}</Text>
      ) : null}
      {degraded && !unavailable ? (
        <Text style={styles.text}>
          {error === 'rejected' ? DEGRADED_UNVERIFIED_MESSAGE : DEGRADED_MESSAGE}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Reintentar" variant="primary" busy={busy} onPress={() => void restore()} />
        {unavailable ? <SignOutControl variant="button" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    padding: 12,
    gap: 8,
    marginVertical: 8,
  },
  title: { ...typography.h2, color: colors.yellowText },
  text: { ...typography.body, color: colors.yellowText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
