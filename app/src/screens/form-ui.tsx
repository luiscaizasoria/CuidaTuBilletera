// Piezas del formulario de movimiento y de Crear cuenta (R3; docs/008 §6.13).
import { useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { categoryFill, categoryGlyph } from '../lib/category-appearance';
import type { TransactionType } from '../lib/resources-api';
import { colors, radii, sizes, tabularNums, typography } from '../theme/tokens';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

// Marco de un campo: borde 1.5 `borderStrong`; con foco, borde 2 `brand700` y halo de 3 dp `brand100`
// (el halo se reserva siempre, así no hay saltos de diseño); con error, borde 2 `expense` (gana al
// del foco, el halo se conserva); deshabilitado por guardado, fondo `segBg`.
function FieldFrame({
  focused,
  error,
  disabled,
  style,
  children,
}: {
  focused: boolean;
  error: boolean;
  disabled: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.halo, focused && styles.haloOn]}>
      <View
        style={[
          styles.frame,
          (focused || error) && styles.frameStrong,
          focused && styles.frameFocus,
          error && styles.frameError,
          disabled && styles.frameDisabled,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// Campo de texto con foco visible y estado de error (nombre de la cuenta, detalle).
export function FormTextInput({
  error = false,
  multiline = false,
  ref,
  ...props
}: TextInputProps & { error?: boolean; ref?: Ref<TextInput> }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldFrame focused={focused} error={error} disabled={props.editable === false}>
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.text3}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </FieldFrame>
  );
}

// Campo de monto: prefijo «$» (o «-$»), cifras de 28 y tabulares, alto mínimo 56.
export function AmountField({
  prefix = '$',
  error = false,
  ref,
  ...props
}: TextInputProps & { prefix?: string; error?: boolean; ref?: Ref<TextInput> }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldFrame
      focused={focused}
      error={error}
      disabled={props.editable === false}
      style={styles.amountFrame}
    >
      <Text {...hidden} style={styles.amountPrefix}>
        {prefix}
      </Text>
      <TextInput
        ref={ref}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.text3}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={styles.amountInput}
      />
    </FieldFrame>
  );
}

// Mensaje de error de un campo: «⚠» decorativo oculto y texto con rol `alert`.
export function FieldError({ message, ref }: { message: string; ref?: Ref<Text> }) {
  return (
    <View style={styles.errorRow}>
      <Text {...hidden} style={styles.errorText}>
        ⚠
      </Text>
      <Text
        ref={ref}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.errorText, styles.errorMessage]}
      >
        {message}
      </Text>
    </View>
  );
}

// Ícono de categoría: cuadrado con el color de la API oscurecido y glifo (emoji o texto blanco).
export function CategoryIcon({
  icono,
  color,
  size = sizes.categoryIcon,
  dimmed = false,
}: {
  icono: string;
  color: string;
  size?: number;
  // Categoría archivada: opacidad 0.5 (docs/008 §6.14).
  dimmed?: boolean;
}) {
  const { glyph, text } = categoryGlyph(icono);
  return (
    <View
      testID="category-icon"
      {...hidden}
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size >= sizes.avatar ? radii.md : 10,
          backgroundColor: categoryFill(color),
        },
        dimmed && styles.iconDimmed,
      ]}
    >
      <Text style={[styles.iconGlyph, text && styles.iconGlyphText]}>{glyph}</Text>
    </View>
  );
}

// Opción de la rejilla de categorías (2 columnas): ícono, nombre de hasta 2 líneas, tinte del tipo.
export function CategoryOption({
  nombre,
  icono,
  color,
  tipo,
  selected,
  disabled,
  onPress,
}: {
  nombre: string;
  icono: string;
  color: string;
  tipo: TransactionType;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const expense = tipo === 'gasto';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Categoría ${nombre}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && {
          backgroundColor: expense ? colors.expenseSoft : colors.incomeSoft,
          borderColor: expense ? colors.expense : colors.income,
        },
        pressed && styles.optionPressed,
        disabled && styles.optionDisabled,
      ]}
    >
      <CategoryIcon icono={icono} color={color} />
      <Text
        numberOfLines={2}
        style={[
          styles.optionName,
          selected && {
            fontWeight: '800',
            color: expense ? colors.expenseText : colors.incomeText,
          },
        ]}
      >
        {selected ? <Text {...hidden}>✓ </Text> : null}
        {nombre}
      </Text>
    </Pressable>
  );
}

// Casilla a todo el ancho (48 dp), con rol `checkbox`. Encendida usa el tono neutro: el coral y el
// verde significan gasto e ingreso (docs/008 §6.13 punto 7).
export function CheckboxChip({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.checkbox, checked && styles.checkboxOn, disabled && styles.optionDisabled]}
    >
      <Text {...hidden} style={styles.checkboxBox}>
        {checked ? '✓' : '☐'}
      </Text>
      <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelOn]}>{label}</Text>
    </Pressable>
  );
}

// Selector de tipo: dos botones de 48 dp con el tinte del tipo (no usa `Segmented` ni `Chip`).
export function TypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: TransactionType;
  onChange: (tipo: TransactionType) => void;
  disabled: boolean;
}) {
  const options: { value: TransactionType; label: string }[] = [
    { value: 'gasto', label: 'Gasto' },
    { value: 'ingreso', label: 'Ingreso' },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Tipo" style={styles.typeRow}>
      {options.map((option) => {
        const selected = option.value === value;
        const expense = option.value === 'gasto';
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.typeOption,
              selected && {
                backgroundColor: expense ? colors.expenseSoft : colors.incomeSoft,
                borderColor: expense ? colors.expense : colors.income,
                borderWidth: 2,
              },
              disabled && styles.optionDisabled,
            ]}
          >
            <Text
              style={[
                styles.typeText,
                selected && {
                  fontWeight: '800',
                  color: expense ? colors.expenseText : colors.incomeText,
                },
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

export const formStyles = StyleSheet.create({
  label: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  help: { ...typography.small, color: colors.text2, marginTop: 4 },
});

const styles = StyleSheet.create({
  halo: { padding: 3, margin: -3, borderRadius: radii.md + 3, backgroundColor: 'transparent' },
  haloOn: { backgroundColor: colors.brand100 },
  frame: {
    minHeight: sizes.touchMin,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  frameStrong: { borderWidth: 2 },
  frameFocus: { borderColor: colors.brand700 },
  frameError: { borderColor: colors.expense },
  frameDisabled: { backgroundColor: colors.segBg },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: sizes.touchMin - 4,
    paddingHorizontal: 12,
  },
  inputMultiline: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  amountFrame: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  amountPrefix: { ...typography.amountInput, color: colors.text2 },
  amountInput: {
    ...typography.amountInput,
    ...tabularNums,
    flex: 1,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 0,
    minHeight: 52,
  },
  errorRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  errorText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.expenseText },
  errorMessage: { flexShrink: 1 },
  icon: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconDimmed: { opacity: 0.5 },
  iconGlyph: { fontSize: 16, lineHeight: 20 },
  iconGlyphText: { color: colors.white, fontWeight: '800' },
  option: {
    flex: 1,
    minHeight: sizes.categoryOptionMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionPressed: { opacity: 0.85 },
  optionDisabled: { opacity: 0.5 },
  optionName: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.text,
  },
  checkbox: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  checkboxOn: { borderColor: colors.text, backgroundColor: colors.segBg },
  checkboxBox: { fontSize: 18, lineHeight: 22, color: colors.text },
  checkboxLabel: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  checkboxLabelOn: { fontWeight: '800' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeOption: {
    flex: 1,
    minHeight: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  typeText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text2 },
});
