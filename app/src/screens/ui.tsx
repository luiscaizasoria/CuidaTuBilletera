import { Pressable, StyleSheet, Text, View } from 'react-native';

// Piezas de interfaz compartidas por las pantallas de cuentas y categorías.
export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'secondary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, styles[variant], disabled && styles.disabled]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

// Opción seleccionable (selector de cuenta, tipo, categoría, filtros).
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

export function ErrorBox({
  message,
  onRetry,
  retryLabel = 'Reintentar',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.errorBox}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {message}
      </Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="primary" /> : null}
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  row: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: '#555555', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bbbbbb',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 8,
  },
  form: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  muted: { color: '#555555', textAlign: 'center', marginVertical: 16 },
  badge: { color: '#8a6d00', fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  primary: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  secondary: { backgroundColor: '#ffffff', borderColor: '#1a73e8' },
  danger: { backgroundColor: '#ffffff', borderColor: '#b3261e' },
  disabled: { opacity: 0.5 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbbbbb',
  },
  chipSelected: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  label: { fontSize: 15, fontWeight: '600', color: '#1a73e8' },
  primaryLabel: { color: '#ffffff' },
  errorBox: { alignItems: 'center', padding: 16, gap: 12 },
  errorText: { color: '#b3261e', textAlign: 'center' },
});
