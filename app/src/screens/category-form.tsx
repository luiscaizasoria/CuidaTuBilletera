// Formulario compartido de categoría (extraído de CategoriesScreen en R5.1; docs/007 §5.13 D y E,
// docs/008 §6.15.4). Lo usan la pantalla Categorías (tarjeta) y la hoja «Nueva categoría» de Nuevo
// movimiento (solo los campos, con su propio pie).
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { categoryFill } from '../lib/category-appearance';
import { findIcon, iconsForScope } from '../lib/icon-catalog';
import type { Category, CategoryType, TransactionType } from '../lib/resources-api';
import { colors, radii, typography } from '../theme/tokens';
import { CategoryIcon, FormTextInput, TypeToggle } from './form-ui';
import { IconField } from './icon-picker-sheet';
import { Button, Card } from './ui';

// Paleta fija de colores (formato #RRGGBB). Son datos que se envían a la API, no estilos.
export const CATEGORY_COLORS = [
  { name: 'Rojo', value: '#E53935' },
  { name: 'Naranja', value: '#FB8C00' },
  { name: 'Amarillo', value: '#FDD835' },
  { name: 'Verde', value: '#43A047' },
  { name: 'Azul', value: '#1E88E5' },
  { name: 'Morado', value: '#8E24AA' },
  { name: 'Gris', value: '#757575' },
] as const;

export type Form = { kind: 'create' } | { kind: 'edit'; category: Category };

export interface FormValues {
  nombre: string;
  descripcion: string;
  tipo: CategoryType;
  color: string | null;
  // null = sin elegir (al crear la API usa `tag`; al editar no se envía).
  icono: string | null;
}

export const toTransactionType = (tipo: CategoryType): TransactionType =>
  tipo === 'egreso' ? 'gasto' : 'ingreso';
export const toCategoryType = (tipo: TransactionType): CategoryType =>
  tipo === 'gasto' ? 'egreso' : 'ingreso';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

const CATEGORY_ENTRIES = iconsForScope('category');

// Ícono del catálogo o null: un slug desconocido (categoría antigua) queda sin selección.
export function catalogIcon(icono: string): string | null {
  return findIcon(CATEGORY_ENTRIES, icono)?.key ?? null;
}

// Campos del formulario (controlados): nombre, descripción opcional, tipo, color, ícono y vista previa.
export function CategoryFormFields({
  draft,
  onChange,
  busy,
  nameError,
  showDescription = true,
  fixedTypeText,
  hideTypeControl = false,
}: {
  draft: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  busy: boolean;
  nameError: string | null;
  showDescription?: boolean;
  // Con texto, el tipo no se puede cambiar y se muestra como línea fija (sin TypeToggle).
  fixedTypeText?: string;
  // El tipo ya lo indica otro elemento (p. ej. la píldora de la hoja): no se muestra control ni línea.
  hideTypeControl?: boolean;
}) {
  const { nombre, descripcion, tipo, color, icono } = draft;
  const colorName = CATEGORY_COLORS.find((option) => option.value === color)?.name;
  return (
    <>
      <Text style={styles.label}>Nombre</Text>
      <FormTextInput
        accessibilityLabel="Nombre de la categoría"
        placeholder="Nombre"
        value={nombre}
        onChangeText={(text) => onChange({ nombre: text })}
        editable={!busy}
        error={nameError !== null}
      />
      {showDescription ? (
        <>
          <Text style={styles.label}>Descripción (opcional)</Text>
          <FormTextInput
            accessibilityLabel="Descripción"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={(text) => onChange({ descripcion: text })}
            editable={!busy}
          />
        </>
      ) : null}

      {hideTypeControl ? null : fixedTypeText ? (
        <Text style={styles.fixedType}>{fixedTypeText}</Text>
      ) : (
        <>
          <Text style={styles.label}>Tipo</Text>
          <TypeToggle
            value={toTransactionType(tipo)}
            onChange={(value) => onChange({ tipo: toCategoryType(value) })}
            disabled={busy}
          />
        </>
      )}

      <Text style={styles.label}>Color</Text>
      <Text style={styles.summary}>
        {colorName ? `Color: ${colorName}` : 'Color: sin elegir (se asigna uno por defecto)'}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.colors}>
        {CATEGORY_COLORS.map((option) => {
          const selected = color === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${option.name}`}
              accessibilityState={{ selected, disabled: busy }}
              disabled={busy}
              onPress={() => onChange({ color: option.value })}
              style={styles.colorOption}
            >
              <View style={[styles.colorRing, selected && styles.colorRingSelected]}>
                <View style={[styles.colorFill, { backgroundColor: categoryFill(option.value) }]}>
                  {selected ? (
                    <Text {...hidden} style={styles.colorCheck}>
                      ✓
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.colorName, selected && styles.colorNameSelected]}>
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Ícono</Text>
      <IconField
        value={icono}
        entries={CATEGORY_ENTRIES}
        onChange={(key) => onChange({ icono: key })}
        disabled={busy}
        emptyText="Ícono: sin elegir (se usa la etiqueta)"
      />

      <Text style={styles.previewLabel}>Vista previa</Text>
      <View style={styles.preview}>
        <CategoryIcon icono={icono ?? ''} color={color ?? ''} size={32} />
        <Text style={[styles.previewName, nombre.trim() === '' && styles.previewEmpty]}>
          {nombre.trim() === '' ? 'Nombre de la categoría' : nombre.trim()}
        </Text>
      </View>
    </>
  );
}

// Formulario de crear/editar. Monta el guard de descarte solo mientras está abierto (docs/003 R3 D4);
// Atrás sin cambios cierra el formulario y no la pantalla (listener registrado antes del del guard,
// por lo que se consulta después de él).
export function CategoryFormCard({
  form,
  segment,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  form: Form;
  segment: CategoryType;
  busy: boolean;
  error: string | null;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
}) {
  const editing = form.kind === 'edit';
  const initial: FormValues = editing
    ? {
        nombre: form.category.nombre,
        descripcion: form.category.descripcion ?? '',
        tipo: form.category.tipo,
        color: form.category.color,
        icono: catalogIcon(form.category.icono),
      }
    : { nombre: '', descripcion: '', tipo: segment, color: null, icono: null };
  const [draft, setDraft] = useState<FormValues>(initial);
  const [nameError, setNameError] = useState<string | null>(null);
  const initialRef = useRef(initial);
  const { nombre, descripcion, tipo, color, icono } = draft;

  const dirty = editing
    ? nombre.trim() !== initialRef.current.nombre ||
      descripcion.trim() !== initialRef.current.descripcion ||
      (color !== null && color !== initialRef.current.color) ||
      (icono !== null && icono !== initialRef.current.icono)
    : nombre.trim() !== '' ||
      descripcion.trim() !== '' ||
      color !== null ||
      icono !== null ||
      tipo !== initialRef.current.tipo;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busyRef.current) return true;
      closeRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const { requestLeave } = useDiscardGuard({
    dirty,
    busy,
    onLeave: onClose,
    title: editing ? '¿Descartar los cambios?' : '¿Descartar esta categoría?',
    message: editing ? 'Los cambios que hiciste no se guardarán.' : 'Lo que escribiste se perderá.',
  });

  function save() {
    if (nombre.trim() === '') {
      setNameError('Escribe un nombre.');
      return;
    }
    setNameError(null);
    onSubmit(draft);
  }

  const typeWord = initial.tipo === 'egreso' ? 'Gasto' : 'Ingreso';
  const fixedTypeText = editing ? `Tipo: ${typeWord} (no se puede cambiar)` : undefined;

  return (
    <Card style={styles.formCard}>
      <Text accessibilityRole="header" style={styles.formTitle}>
        {editing ? 'Editar categoría' : 'Nueva categoría'}
      </Text>

      <CategoryFormFields
        draft={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        busy={busy}
        nameError={nameError}
        fixedTypeText={fixedTypeText}
      />

      {nameError ? (
        <Text accessibilityRole="alert" style={[styles.error, styles.errorGap]}>
          {nameError}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, styles.errorGap]}>
          {error}
        </Text>
      ) : null}

      <View style={styles.formActions}>
        <Button
          label={busy ? 'Guardando…' : 'Guardar'}
          accessibilityLabel="Guardar"
          variant="primary"
          tall
          busy={busy}
          onPress={save}
        />
        <Button label="Cancelar" variant="ghost" disabled={busy} onPress={() => requestLeave()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText },
  errorGap: { marginTop: 8 },
  formCard: { marginTop: 12, padding: 16 },
  formTitle: { ...typography.h2, color: colors.text },
  label: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  fixedType: { ...typography.small, color: colors.text2, marginTop: 16 },
  summary: { ...typography.small, color: colors.text2, marginBottom: 8 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Ancho fijo de 76 dp y alto adaptable (mínimo 72): crece con fuente ampliada y nombres de 2 líneas.
  colorOption: { width: 76, minHeight: 72, alignItems: 'center' },
  colorRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRingSelected: { borderColor: colors.text },
  colorFill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCheck: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.white },
  colorName: { ...typography.small, fontSize: 12, lineHeight: 16, color: colors.text2 },
  colorNameSelected: { fontWeight: '700', color: colors.text },
  previewLabel: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.text2,
    marginTop: 12,
    marginBottom: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  previewName: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.text,
  },
  previewEmpty: { fontWeight: '400', color: colors.text3 },
  formActions: { marginTop: 16, gap: 8 },
});
