// Apariencia de la cuenta en Crear y Editar cuenta (docs/007 §5.14, docs/008 §6.16): vista previa,
// selector de color y selector de ícono, cada uno con la opción «Predeterminado» (valor null).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ACCOUNT_COLOR_OPTIONS,
  accountColorOption,
  accountIconOption,
  type AppearanceDraft,
} from '../lib/account-appearance';
import { accountColors, accountIcon } from '../lib/accounts';
import { iconsForScope } from '../lib/icon-catalog';
import { colors, radii, sizes, typography } from '../theme/tokens';
import { IconField } from './icon-picker-sheet';

export const COLOR_ASSIGNED_ON_CREATE = 'El color se asigna al crear la cuenta';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

const ACCOUNT_ENTRIES = iconsForScope('account');

// Estado de foco (teclado externo o TalkBack): contorno de 2 dp en la opción enfocada.
function useFocus() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

// Tarjeta reducida con el aspecto de `AccountCard`, sin saldo. `accountId` null = cuenta por crear.
export function AccountPreview({
  nombre,
  color,
  icono,
  accountId,
}: {
  nombre: string;
  color: string | null;
  icono: string | null;
  accountId: string | null;
}) {
  const colorOption = accountColorOption(color);
  const iconOption = accountIconOption(icono);
  const fallback = accountId !== null ? accountColors(accountId) : null;
  const card = colorOption?.card ?? fallback?.card ?? colors.segBg;
  const tile = colorOption?.tile ?? fallback?.tile ?? colors.segBg;
  const name = nombre.trim();
  const glyph = iconOption?.glyph ?? accountIcon(name);
  const label = `Vista previa de la cuenta ${name === '' ? 'sin nombre' : name}, color ${
    colorOption ? colorOption.label.toLocaleLowerCase('es') : 'predeterminado'
  }, ícono ${iconOption ? iconOption.label : 'predeterminado'}`;
  return (
    <View>
      <Text style={styles.previewLabel}>Vista previa</Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        testID="account-preview"
        style={[styles.preview, { backgroundColor: card }]}
      >
        <View style={[styles.previewTile, { backgroundColor: tile }]} {...hidden}>
          <Text {...hidden} maxFontSizeMultiplier={1.5} style={styles.previewGlyph}>
            {glyph}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.previewName, name === '' && styles.previewEmpty]}
        >
          {name === '' ? 'Nombre de la cuenta' : name}
        </Text>
      </View>
      {accountId === null && color === null ? (
        <Text style={styles.hint}>{COLOR_ASSIGNED_ON_CREATE}</Text>
      ) : null}
    </View>
  );
}

function DefaultChip({
  label,
  accessibilityLabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { focused, focusProps } = useFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        focused && styles.focus,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {selected ? <Text {...hidden}>✓ </Text> : null}
        {label}
      </Text>
    </Pressable>
  );
}

function Swatch({
  label,
  tile,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  tile: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { focused, focusProps } = useFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Color ${label.toLocaleLowerCase('es')}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.swatch,
        focused && styles.focus,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.ring, selected && styles.ringSelected]}>
        <View style={[styles.fill, { backgroundColor: tile }]}>
          {selected ? (
            <Text {...hidden} style={styles.check}>
              ✓
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.swatchName, selected && styles.swatchNameSelected]}>{label}</Text>
    </Pressable>
  );
}

// Bloque «Apariencia» completo. `accountId` null en Crear (sin id aún). El ícono se elige en la hoja
// «Elegir ícono» (fila `IconField`); «Predeterminado» (null) sigue siendo un chip aparte.
export function AppearancePicker({
  nombre,
  draft,
  onChange,
  busy,
  accountId,
}: {
  nombre: string;
  draft: AppearanceDraft;
  onChange: (patch: Partial<AppearanceDraft>) => void;
  busy: boolean;
  accountId: string | null;
}) {
  const colorName = accountColorOption(draft.color)?.label;
  return (
    <View testID="appearance-block">
      <Text accessibilityRole="header" style={styles.title}>
        Apariencia
      </Text>
      <Text style={styles.help}>Opcional. Te ayuda a reconocer la cuenta de un vistazo.</Text>

      <AccountPreview
        nombre={nombre}
        color={draft.color}
        icono={draft.icono}
        accountId={accountId}
      />

      <Text style={styles.label}>Color</Text>
      <Text style={styles.summary}>
        {colorName ? `Color: ${colorName}` : 'Color: predeterminado'}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Color de la cuenta"
        style={styles.row}
      >
        <DefaultChip
          label="Predeterminado"
          accessibilityLabel="Color predeterminado"
          selected={draft.color === null}
          disabled={busy}
          onPress={() => onChange({ color: null })}
        />
        {ACCOUNT_COLOR_OPTIONS.map((option) => (
          <Swatch
            key={option.key}
            label={option.label}
            tile={option.tile}
            selected={draft.color === option.key}
            disabled={busy}
            onPress={() => onChange({ color: option.key })}
          />
        ))}
      </View>

      <Text style={styles.label}>Ícono</Text>
      <View style={styles.chipRow}>
        <DefaultChip
          label="Predeterminado"
          accessibilityLabel="Ícono predeterminado"
          selected={draft.icono === null}
          disabled={busy}
          onPress={() => onChange({ icono: null })}
        />
      </View>
      <IconField
        value={draft.icono}
        entries={ACCOUNT_ENTRIES}
        onChange={(key) => onChange({ icono: key })}
        disabled={busy}
        tile={accountColorOption(draft.color)?.tile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginTop: 16 },
  help: { ...typography.small, color: colors.text2, marginTop: 4, marginBottom: 8 },
  label: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  summary: { ...typography.small, color: colors.text2, marginBottom: 8 },
  hint: { ...typography.small, color: colors.text2, marginTop: 4 },
  previewLabel: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.text2,
    marginBottom: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.accountCard,
  },
  previewTile: {
    width: sizes.accountIcon,
    height: sizes.accountIcon,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlyph: { fontSize: 28 },
  previewName: { ...typography.accountName, flex: 1, minWidth: 0, color: colors.text },
  previewEmpty: { fontWeight: '400', color: colors.text3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  chipRow: { flexDirection: 'row', marginBottom: 8 },
  chip: {
    minHeight: sizes.touchMin,
    minWidth: sizes.touchMin,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderWidth: 3, borderColor: colors.text, backgroundColor: colors.brand100 },
  chipText: { ...typography.body, fontWeight: '600', color: colors.text },
  chipTextSelected: { fontWeight: '800' },
  // Ancho fijo de 76 dp y alto adaptable (mínimo 72): crece con fuente ampliada y nombres de 2 líneas.
  swatch: { width: 76, minHeight: 72, alignItems: 'center' },
  // Anillo de reposo 1.5 dp `borderStrong` (3:1 contra el fondo, docs/008 §6.16.2); seleccionado 3 dp.
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderWidth: 3, borderColor: colors.text },
  fill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // «✓» oscuro: el blanco sobre el tile pastel no alcanza contraste (docs/008 §6.16.2).
  check: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.text },
  swatchName: { ...typography.small, fontSize: 12, lineHeight: 16, color: colors.text2 },
  swatchNameSelected: { fontWeight: '700', color: colors.text },
  focus: { borderWidth: 2, borderColor: colors.brand700, borderRadius: radii.md },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
