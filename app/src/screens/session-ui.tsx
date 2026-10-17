// Cierre de sesión compartido (R5.1; docs/007 §5.13 C, docs/008 §6.15.3). Un solo componente para
// el encabezado de Mis cuentas, la hoja de perfil, Más y la franja de sesión: todos llaman al mismo
// `signOut` de `useAuth()`, sin confirmación y sin borrar datos ni preferencias (guías incluidas).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { colors, shadows, sizes } from '../theme/tokens';
import { Button } from './ui';

export const SIGN_OUT_LABEL = 'Cerrar sesión';

export function SignOutControl({ variant }: { variant: 'icon' | 'button' }) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  // Protección contra doble toque: el ref cierra la ventana antes de que el estado se renderice.
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function press() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await signOut();
    } catch {
      // El servicio publica sus propios avisos; aquí solo se libera el control.
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (variant === 'button') {
    return <Button label={SIGN_OUT_LABEL} variant="secondary" busy={pending} onPress={press} />;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SIGN_OUT_LABEL}
      accessibilityState={pending ? { disabled: true, busy: true } : { disabled: false }}
      disabled={pending}
      onPress={() => void press()}
      style={styles.touch}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.circle,
            shadows.card,
            pressed && styles.circlePressed,
            pending && styles.circlePending,
          ]}
        >
          {pending ? (
            <ActivityIndicator size={18} color={colors.brand700} />
          ) : (
            <Text
              importantForAccessibility="no"
              accessibilityElementsHidden
              maxFontSizeMultiplier={1.3}
              style={styles.glyph}
            >
              🚪
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Zona táctil de 48 dp; el círculo visual de 40 dp es de la misma familia que el avatar.
  touch: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: sizes.avatar / 2,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: { backgroundColor: colors.segBg, borderColor: colors.borderStrong },
  circlePending: { opacity: 0.7 },
  glyph: { fontSize: 20, lineHeight: 24 },
});
