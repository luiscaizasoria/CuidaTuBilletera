import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSystemInsets } from '../theme/useSystemInsets';
import { colors, radii, shadows, sizes, typography, moduleColors } from '../theme/tokens';

// Piezas de interfaz compartidas por las pantallas.
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  tall = false,
  variant = 'secondary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tall?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'link' | 'danger' | 'dangerSolid';
  accessibilityLabel?: string;
}) {
  const inactive = disabled || busy;
  // Variantes sólidas: el estado presionado oscurece el fondo en lugar de bajar la opacidad.
  const solidPressed =
    variant === 'primary'
      ? styles.primaryPressed
      : variant === 'dangerSolid'
        ? styles.dangerSolidPressed
        : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={busy ? { disabled: true, busy: true } : { disabled }}
      disabled={inactive}
      onPress={() => {
        if (!inactive) onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        tall && styles.tall,
        styles[variant],
        pressed && (solidPressed ?? styles.pressed),
        inactive && styles.disabled,
      ]}
    >
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </Pressable>
  );
}

// Opción seleccionable (tipo, categoría, filtros). Píldora; la elegida muestra «✓» en un texto aparte,
// oculto a la accesibilidad (el estado ya lo anuncia). `size="sm"` (36 dp) amplía la zona táctil a 48 dp.
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  size = 'md',
  tone = 'neutral',
  suffix,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: 'md' | 'sm';
  // `gasto` / `ingreso`: el elegido toma el tinte del tipo del formulario (docs/008 §6.13).
  tone?: 'neutral' | 'gasto' | 'ingreso';
  // Adorno decorativo tras la etiqueta (p. ej. «▾»), oculto a los lectores de pantalla.
  suffix?: string;
}) {
  const small = size === 'sm';
  const tinted = selected && tone !== 'neutral';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={small ? { top: sizes.chipHitSlop, bottom: sizes.chipHitSlop } : undefined}
      style={[
        styles.chip,
        small && styles.chipSm,
        selected && styles.chipSelected,
        tinted && (tone === 'gasto' ? styles.chipExpense : styles.chipIncome),
        disabled && styles.disabled,
      ]}
    >
      {selected ? (
        <Text
          testID="chip-check"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[
            styles.chipText,
            small && styles.chipTextSm,
            styles.chipTextSelected,
            tinted && (tone === 'gasto' ? styles.chipTextExpense : styles.chipTextIncome),
          ]}
        >
          ✓
        </Text>
      ) : null}
      <Text
        style={[
          styles.chipText,
          small && styles.chipTextSm,
          selected && styles.chipTextSelected,
          tinted && (tone === 'gasto' ? styles.chipTextExpense : styles.chipTextIncome),
        ]}
      >
        {label}
      </Text>
      {suffix ? (
        <Text
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[styles.chipText, small && styles.chipTextSm, { color: colors.text2 }]}
        >
          {suffix}
        </Text>
      ) : null}
    </Pressable>
  );
}

// Tarjeta de superficie con borde fino y sombra suave.
export function Card({
  children,
  raised = false,
  style,
  testID,
}: {
  children: ReactNode;
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, raised ? shadows.raised : shadows.card, style]}>
      {children}
    </View>
  );
}

// Control segmentado (radiogroup). La opción elegida muestra «✓»; la etiqueta accesible no.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  tone = 'neutral',
  disabled = false,
}: {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  tone?: 'neutral' | 'reportes' | 'movimientos';
  disabled?: boolean;
}) {
  const toneColors = tone === 'neutral' ? null : moduleColors[tone];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.segmented}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentOption,
              selected &&
                (toneColors
                  ? { backgroundColor: toneColors.tile }
                  : [styles.segmentSelectedNeutral, shadows.card]),
              disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
                selected && toneColors && { color: toneColors.ink },
              ]}
            >
              {selected ? `✓ ${option.label}` : option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Aviso temporal. Sin animaciones si el sistema pide movimiento reducido.
export function Snackbar({
  message,
  onDismiss,
  duration = 3000,
  bottomOffset = 0,
  testID,
}: {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
  bottomOffset?: number;
  testID?: string;
}) {
  const insets = useSystemInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (message === null) return undefined;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    opacity.setValue(1);
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((reduce) => {
        if (cancelled || reduce) return;
        opacity.setValue(0);
        animation = Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true });
        animation.start();
      })
      .catch(() => undefined);
    const timer = setTimeout(() => dismiss.current(), duration);
    return () => {
      cancelled = true;
      animation?.stop();
      clearTimeout(timer);
    };
  }, [message, duration, opacity]);

  if (message === null) return null;
  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.snackbar,
        shadows.raised,
        { bottom: insets.bottom + bottomOffset + 8, opacity },
      ]}
    >
      <Text style={styles.snackbarText}>{message}</Text>
    </Animated.View>
  );
}

// Contenedor de pantalla: márgenes de sistema, fondo, teclado y desplazamiento.
export function Screen({
  children,
  scroll = true,
  padded = true,
  keyboardAvoiding = true,
  statusBar = 'bg',
  bottomBar = false,
  contentContainerStyle,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboardAvoiding?: boolean;
  statusBar?: 'bg' | 'surface';
  bottomBar?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const insets = useSystemInsets();
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        padded && { padding: 16, paddingBottom: bottomBar ? 16 : insets.bottom + 16 },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );
  // Sin scroll ni barra inferior propia, el margen inferior del sistema se reserva aquí.
  const bottomSpacer =
    !scroll && !bottomBar ? (
      <View testID="screen-bottom-inset" style={{ height: insets.bottom }} />
    ) : null;
  return (
    <View testID={testID} style={styles.screen}>
      <View
        testID="screen-top-inset"
        style={{
          height: insets.top,
          backgroundColor: colors[statusBar === 'bg' ? 'bg' : 'surface'],
        }}
      />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
      {bottomSpacer}
    </View>
  );
}

export function ErrorBox({
  message,
  onRetry,
  retryLabel = 'Reintentar',
  retryAccessibilityLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryAccessibilityLabel?: string;
}) {
  return (
    <View style={styles.errorBox}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          accessibilityLabel={retryAccessibilityLabel}
          onPress={onRetry}
          variant="primary"
        />
      ) : null}
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: colors.text2, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 8,
  },
  form: {
    borderWidth: 1,
    borderColor: colors.brand700,
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 12,
  },
  muted: { color: colors.text2, textAlign: 'center', marginVertical: 16 },
  badge: { color: colors.yellowText, fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  button: {
    minHeight: sizes.touchMin,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tall: { minHeight: sizes.primaryTall, borderRadius: radii.lg },
  primary: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  primaryPressed: { backgroundColor: colors.brand800, borderColor: colors.brand800 },
  secondary: { backgroundColor: colors.surface, borderColor: colors.brand700 },
  ghost: { backgroundColor: 'transparent' },
  link: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.surface, borderColor: colors.expense },
  dangerSolid: { backgroundColor: colors.expense, borderColor: colors.expense },
  dangerSolidPressed: { backgroundColor: colors.expenseText, borderColor: colors.expenseText },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, textAlign: 'center' },
  primaryLabel: { color: colors.white },
  secondaryLabel: { color: colors.brand700 },
  ghostLabel: { color: colors.text },
  linkLabel: { color: colors.brand700, fontWeight: '700' },
  dangerLabel: { color: colors.expenseText },
  dangerSolidLabel: { color: colors.white },
  chip: {
    minHeight: sizes.touchMin,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipSm: { minHeight: sizes.chipSmHeight, paddingHorizontal: 12 },
  chipSelected: { borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.segBg },
  chipExpense: { borderWidth: 2, borderColor: colors.expense, backgroundColor: colors.expenseSoft },
  chipIncome: { borderWidth: 2, borderColor: colors.income, backgroundColor: colors.incomeSoft },
  chipTextExpense: { color: colors.expenseText },
  chipTextIncome: { color: colors.incomeText },
  chipText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
  chipTextSm: { fontSize: 13, lineHeight: 18 },
  chipTextSelected: { fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.segBg,
    borderRadius: radii.pill,
    padding: 4,
  },
  segmentOption: {
    flex: 1,
    minHeight: sizes.segmentOption,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
  },
  segmentSelectedNeutral: { backgroundColor: colors.surface },
  segmentText: { ...typography.body, color: colors.text2, textAlign: 'center' },
  segmentTextSelected: { fontWeight: '800', color: colors.text },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.text,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  snackbarText: { ...typography.body, color: colors.white },
  errorBox: { alignItems: 'center', padding: 16, gap: 12 },
  errorText: { color: colors.expenseText, textAlign: 'center' },
});
