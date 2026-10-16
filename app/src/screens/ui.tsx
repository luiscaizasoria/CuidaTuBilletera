import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Guide, GuideModule } from '../lib/guides';
import { useSystemInsets } from '../theme/useSystemInsets';
import {
  colors,
  moduleColors,
  radii,
  screenMargin,
  shadows,
  sizes,
  spacing,
  tabularNums,
  typography,
} from '../theme/tokens';

// Margen lateral de la ventana actual (16 dp; 20 dp desde 400 dp de ancho).
export function useScreenMargin(): number {
  const { width } = useWindowDimensions();
  return screenMargin(width);
}

// Estilo del contenedor de las pantallas de pestaña: fondo, relleno responsive y ocupa el alto.
export function useScreenContainerStyle() {
  const margin = useScreenMargin();
  return { flex: 1, padding: margin, backgroundColor: colors.bg } as const;
}

// Piezas de interfaz compartidas por las pantallas.
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  tall = false,
  variant = 'secondary',
  accessibilityLabel,
  expanded,
  suffix,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tall?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'link' | 'danger' | 'dangerSolid';
  accessibilityLabel?: string;
  // Botón que despliega una sección (p. ej. «Filtros»): anuncia el estado abierto/cerrado.
  expanded?: boolean;
  // Adorno decorativo tras la etiqueta (p. ej. «▾»), oculto a los lectores de pantalla.
  suffix?: string;
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
      accessibilityState={
        busy
          ? { disabled: true, busy: true, ...(expanded === undefined ? {} : { expanded }) }
          : { disabled, ...(expanded === undefined ? {} : { expanded }) }
      }
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
      {suffix ? (
        <Text
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[styles.label, styles[`${variant}Label`], styles.buttonSuffix]}
        >
          {suffix}
        </Text>
      ) : null}
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
  role = 'radio',
  check = true,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: 'md' | 'sm';
  // `gasto` / `ingreso`: el elegido toma el tinte del tipo del formulario (docs/008 §6.13).
  // `movimientos`: tinte del módulo Movimientos (filtros del Historial, docs/008 §6.14).
  tone?: 'neutral' | 'gasto' | 'ingreso' | 'movimientos';
  // Adorno decorativo tras la etiqueta (p. ej. «▾»), oculto a los lectores de pantalla.
  suffix?: string;
  // `button` para chips que ejecutan una acción (quitar un filtro) en lugar de elegir una opción.
  role?: 'radio' | 'button';
  // Muestra «✓» en el chip elegido (los chips de filtro activo usan «✕» en su lugar).
  check?: boolean;
}) {
  const small = size === 'sm';
  const tinted = selected && tone !== 'neutral';
  const toneStyle =
    tone === 'gasto'
      ? styles.chipExpense
      : tone === 'ingreso'
        ? styles.chipIncome
        : styles.chipMovimientos;
  const toneText =
    tone === 'gasto'
      ? styles.chipTextExpense
      : tone === 'ingreso'
        ? styles.chipTextIncome
        : styles.chipTextMovimientos;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { selected, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={small ? { top: sizes.chipHitSlop, bottom: sizes.chipHitSlop } : undefined}
      style={[
        styles.chip,
        small && styles.chipSm,
        selected && styles.chipSelected,
        tinted && toneStyle,
        disabled && styles.disabled,
      ]}
    >
      {selected && check ? (
        <Text
          testID="chip-check"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[
            styles.chipText,
            small && styles.chipTextSm,
            styles.chipTextSelected,
            tinted && toneText,
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
          tinted && toneText,
        ]}
      >
        {label}
      </Text>
      {suffix ? (
        <Text
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[
            styles.chipText,
            small && styles.chipTextSm,
            {
              color: tinted && tone === 'movimientos' ? moduleColors.movimientos.ink : colors.text2,
            },
          ]}
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
  const margin = useScreenMargin();
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        padded && {
          padding: margin,
          paddingBottom: bottomBar ? margin : insets.bottom + margin,
        },
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
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

export type ModuleKey = 'movimientos' | 'calendario' | 'reportes' | 'mas';

const MODULE_GLYPHS: Record<ModuleKey, string> = {
  movimientos: '📋',
  calendario: '📅',
  reportes: '📊',
  mas: '🏷️',
};

// Cuadrado con el color del módulo (docs/008 §6.14): 36 dp; 28 dp con fuente del sistema ≥ 130 %;
// se oculta con fuente ≥ 175 % para dejar el ancho al título. Decorativo.
export function ModuleTile({ module }: { module: ModuleKey }) {
  const { fontScale } = useWindowDimensions();
  if (fontScale >= 1.75) return null;
  const size = fontScale >= 1.3 ? sizes.moduleTileSm : sizes.moduleTile;
  return (
    <View
      testID="module-tile"
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[
        styles.moduleTile,
        { width: size, height: size, backgroundColor: moduleColors[module].tile },
      ]}
    >
      <Text style={styles.moduleGlyph}>{MODULE_GLYPHS[module]}</Text>
    </View>
  );
}

// Título de pantalla: mosaico del módulo, título 24/30 (header) y subrayado amarillo. Sin el nombre de
// la cuenta (lo muestra la barra de contexto). El tope de escala solo aplica a este título.
export function ScreenTitle({ title, module }: { title: string; module: ModuleKey }) {
  return (
    <View style={styles.titleRow}>
      <ModuleTile module={module} />
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles.titleText}>
          {title}
        </Text>
        <View importantForAccessibility="no" style={styles.titleUnderline} />
      </View>
    </View>
  );
}

// Mosaico de resumen (docs/008 §6.5). `neutral` no lleva burbuja ni color. Con `wide` la etiqueta va a
// la izquierda y la cifra a la derecha. La cifra se recibe ya formateada (la app no calcula).
export function SummaryTile({
  kind,
  label,
  value,
  wide = false,
  hint,
  testID,
}: {
  kind: 'income' | 'expense' | 'neutral';
  label: string;
  value: string;
  wide?: boolean;
  // Pista decorativa bajo la cifra (p. ej. «Ver movimientos ›» en Reportes).
  hint?: string;
  testID?: string;
}) {
  const bubble =
    kind === 'neutral' ? null : (
      <View
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[
          styles.bubble,
          { backgroundColor: kind === 'income' ? colors.incomeSoft : colors.expenseSoft },
        ]}
      >
        <Text
          style={[
            styles.bubbleGlyph,
            { color: kind === 'income' ? colors.incomeText : colors.expenseText },
          ]}
        >
          {kind === 'income' ? '↑' : '↓'}
        </Text>
      </View>
    );
  const valueColor =
    kind === 'income' ? colors.income : kind === 'expense' ? colors.expense : colors.text;
  return (
    <View
      testID={testID}
      style={[styles.summaryTile, shadows.card, wide ? styles.summaryWide : styles.summaryHalf]}
    >
      <View style={styles.summaryLabelRow}>
        {bubble}
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, tabularNums, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
    </View>
  );
}

// Flecha de período (‹ ›): círculo de 32 dp dentro de una zona táctil de 48 dp (docs/008 §6.6).
export function MonthArrow({
  glyph,
  label,
  disabled = false,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrowZone, disabled && styles.arrowDisabled]}
    >
      <View
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[styles.arrowCircle, shadows.card]}
      >
        <Text style={styles.arrowGlyph}>{glyph}</Text>
      </View>
    </Pressable>
  );
}

// Botón con aspecto de campo para elegir una fecha («Desde» / «Hasta»): 48 dp, valor o «Elegir».
export function DateField({
  label,
  value,
  display,
  onPress,
  testID,
}: {
  label: string;
  // Fecha elegida en AAAA-MM-DD ('' = sin elegir) y su texto visible ya formateado.
  value: string;
  display: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ? display : 'sin elegir'}`}
      onPress={onPress}
      style={styles.dateField}
    >
      <Text style={styles.dateFieldLabel}>{label}</Text>
      <Text style={[styles.dateFieldValue, !value && styles.dateFieldEmpty]}>
        {value ? display : 'Elegir'}
      </Text>
    </Pressable>
  );
}

// Carga con texto (docs/008 §6.14 punto 6): nunca muestra datos anteriores.
export function LoadingState({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.stateBlock}>
      <ActivityIndicator size="large" color={colors.brand700} testID={testID} />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

// Ilustraciones decorativas de los vacíos (docs/008 §9.1). PNG empaquetados con Metro.
/* eslint-disable @typescript-eslint/no-require-imports */
const EMPTY_ART = {
  movimientos: require('../../assets/illustrations/vacio-movimientos.png'),
  filtros: require('../../assets/illustrations/vacio-filtros.png'),
  reportes: require('../../assets/illustrations/vacio-reportes.png'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type EmptyArt = keyof typeof EMPTY_ART;

// Vacío con siguiente paso (docs/008 §9.3). Dibujo decorativo de 96 dp (`art`) o, mientras no haya
// ilustración, círculo con el tinte del módulo y su glifo (`glyph`); ambos se ocultan con fuente
// ≥ 175 % sin dejar hueco. `compact` no lleva dibujo (comparte pantalla con una cuadrícula).
export function EmptyState({
  module,
  glyph,
  art,
  title,
  message,
  actionLabel,
  onAction,
  tall = false,
  compact = false,
  testID,
}: {
  module: GuideModule;
  glyph?: string;
  art?: EmptyArt;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tall?: boolean;
  compact?: boolean;
  testID?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.75;
  const showArt = !compact && !large;
  return (
    <View testID={testID} style={compact ? styles.stateCompact : styles.stateBlock}>
      {showArt && art ? (
        <Image
          testID="empty-art"
          source={EMPTY_ART[art]}
          style={styles.emptyArt}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      ) : showArt && glyph ? (
        <View
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[styles.emptyCircle, { backgroundColor: moduleColors[module].tile }]}
        >
          <Text style={styles.emptyGlyph}>{glyph}</Text>
        </View>
      ) : null}
      {title ? <Text style={styles.stateTitle}>{title}</Text> : null}
      <Text style={styles.stateText}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={tall || large ? styles.stateActionWide : undefined}>
          <Button
            label={actionLabel}
            onPress={onAction}
            tall={tall}
            variant={tall ? 'primary' : 'secondary'}
          />
        </View>
      ) : null}
    </View>
  );
}

// Guía contextual de primera vez (docs/008 §9.2, docs/007 §5.12.B): tarjeta en el flujo de la
// pantalla, nunca modal. Desaparece al instante al descartarla.
export function GuideCard({ guide, onDismiss }: { guide: Guide; onDismiss: () => void }) {
  const { fontScale } = useWindowDimensions();
  const palette = moduleColors[guide.module];
  const opacity = useRef(new Animated.Value(0)).current;
  const wide = fontScale >= 1.3;

  // Nace transparente: con movimiento reducido pasa directo a opaca; si no, aparece en 180 ms.
  // Sin dato del sistema (promesa rechazada) también queda visible.
  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          opacity.setValue(1);
          return;
        }
        animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
        animation.start();
      })
      .catch(() => opacity.setValue(1));
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      testID={`guide-${guide.id}`}
      style={[styles.guide, { backgroundColor: palette.tile, opacity }]}
    >
      <View style={styles.guideRow}>
        {fontScale >= 1.75 ? null : (
          <View importantForAccessibility="no" accessibilityElementsHidden style={styles.guideBulb}>
            <Text style={styles.guideBulbGlyph}>💡</Text>
          </View>
        )}
        <Text style={styles.guideText}>{guide.text}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar ayuda"
          onPress={onDismiss}
          style={styles.guideClose}
        >
          <Text
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={[styles.guideCloseGlyph, { color: palette.ink }]}
          >
            ✕
          </Text>
        </Pressable>
      </View>
      <View style={wide ? styles.guideActionWide : styles.guideAction}>
        <Button label="Entendido" variant="secondary" onPress={onDismiss} />
      </View>
    </Animated.View>
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
    flexDirection: 'row',
    gap: 6,
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
  label: { ...typography.button, textAlign: 'center', flexShrink: 1 },
  buttonSuffix: { fontWeight: '400' },
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
  // Compacto (36 dp de alto) pero con zona táctil de al menos 48 × 48 dp: el alto se completa con
  // hitSlop vertical (filas separadas 12 dp) y el ancho con minWidth, sin invadir al vecino.
  chipSm: { minHeight: sizes.chipSmHeight, minWidth: sizes.touchMin, paddingHorizontal: 12 },
  chipSelected: { borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.segBg },
  chipExpense: { borderWidth: 2, borderColor: colors.expense, backgroundColor: colors.expenseSoft },
  chipIncome: { borderWidth: 2, borderColor: colors.income, backgroundColor: colors.incomeSoft },
  chipMovimientos: {
    borderWidth: 1.5,
    borderColor: moduleColors.movimientos.ink,
    backgroundColor: moduleColors.movimientos.tile,
  },
  chipTextMovimientos: { color: moduleColors.movimientos.ink },
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
  moduleTile: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleGlyph: { fontSize: 20, lineHeight: 24 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  titleBlock: { flex: 1 },
  titleText: { ...typography.title, color: colors.text },
  titleUnderline: {
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: spacing.xs,
    backgroundColor: colors.yellow,
  },
  summaryTile: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryHalf: { flex: 1, gap: 4 },
  summaryWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  summaryLabel: { ...typography.small, fontWeight: '700', color: colors.text2, flexShrink: 1 },
  summaryValue: { fontSize: 19, lineHeight: 26, fontWeight: '800', flexShrink: 0 },
  summaryHint: { ...typography.small, fontWeight: '700', color: colors.brand700 },
  dateField: {
    flex: 1,
    minHeight: sizes.touchMin,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  dateFieldLabel: { ...typography.small, fontWeight: '700', color: colors.text2 },
  dateFieldValue: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
  dateFieldEmpty: { color: colors.text3 },
  bubble: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleGlyph: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  arrowZone: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.4 },
  arrowCircle: {
    width: sizes.monthArrow,
    height: sizes.monthArrow,
    borderRadius: sizes.monthArrow / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.text },
  stateBlock: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  stateCompact: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  stateTitle: { ...typography.h2, color: colors.text, textAlign: 'center', maxWidth: 320 },
  stateText: { ...typography.body, color: colors.text2, textAlign: 'center', maxWidth: 320 },
  stateActionWide: { alignSelf: 'stretch', maxWidth: 320, width: '100%' },
  emptyArt: { width: 96, height: 96 },
  guide: { borderRadius: radii.lg, padding: 16, paddingBottom: 12, marginBottom: 16, gap: 12 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guideBulb: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBulbGlyph: { fontSize: 16, lineHeight: 20 },
  guideText: { ...typography.body, color: colors.text, flex: 1 },
  guideClose: {
    minWidth: sizes.touchMin,
    minHeight: sizes.touchMin,
    marginTop: -8,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCloseGlyph: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
  guideAction: { alignSelf: 'flex-start' },
  guideActionWide: { alignSelf: 'stretch' },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyph: { fontSize: 40, lineHeight: 48 },
  errorBox: {
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.expenseSoft,
  },
  errorText: { ...typography.body, color: colors.expenseText, textAlign: 'center' },
});
