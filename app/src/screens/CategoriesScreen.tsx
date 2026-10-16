import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { useGuide, useGuides } from '../hooks/use-guides';
import { useLoader, useMutation } from '../hooks/use-loader';
import { categoryFill } from '../lib/category-appearance';
import {
  ApiRequestError,
  type Account,
  type Category,
  type CategoryType,
  type ResourcesApi,
  type TransactionType,
  type UpdateCategoryInput,
} from '../lib/resources-api';
import { colors, radii, shadows, sizes, typography } from '../theme/tokens';
import { CategoryIcon, FormTextInput, TypeToggle } from './form-ui';
import { Sheet } from './sheets';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  LoadingState,
  GuideCard,
  ScreenTitle,
  Segmented,
  useScreenContainerStyle,
} from './ui';

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

type Form = { kind: 'create' } | { kind: 'edit'; category: Category };

interface FormValues {
  nombre: string;
  descripcion: string;
  tipo: CategoryType;
  color: string | null;
}

export const FROM_FORM_HELP = 'Crea una categoría y vuelve para anotar tu movimiento.';
export const IN_USE_NOTICE =
  'Esta categoría tiene movimientos, por eso no se puede eliminar. Puedes archivarla: no aparecerá al anotar movimientos nuevos, pero tu historial se conserva.';

const isAccountArchived = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 409 && error.code === 'ACCOUNT_ARCHIVED';
const isInUse = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 409 && error.code === 'CATEGORY_IN_USE';

const toTransactionType = (tipo: CategoryType): TransactionType =>
  tipo === 'egreso' ? 'gasto' : 'ingreso';

export default function CategoriesScreen({
  account,
  api,
  onAccountArchived,
  fromForm = false,
}: {
  account: Account;
  api: ResourcesApi;
  // 409 ACCOUNT_ARCHIVED al crear o desarchivar: el servidor confirma que la cuenta está archivada.
  onAccountArchived?: (accountId: string) => void;
  // Se llegó desde Nuevo movimiento: muestra la frase de ayuda.
  fromForm?: boolean;
}) {
  const { authorizedCall } = useAuth();
  const containerStyle = useScreenContainerStyle();
  const [segment, setSegment] = useState<CategoryType>('egreso');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [menuFor, setMenuFor] = useState<Category | null>(null);
  const [inUse, setInUse] = useState<Category | null>(null);
  const mutation = useMutation();
  const { dismiss } = useGuides();
  const accountArchived = useRef(false);

  // Ejecuta la mutación marcando un 409 ACCOUNT_ARCHIVED para avisar al contenedor.
  async function runWatchingArchived(action: () => Promise<unknown>) {
    accountArchived.current = false;
    const ok = await mutation.run(async () => {
      try {
        await action();
      } catch (error) {
        if (isAccountArchived(error)) accountArchived.current = true;
        throw error;
      }
    });
    if (!ok && accountArchived.current) onAccountArchived?.(account.id);
    return ok;
  }

  const { state, reload, refresh } = useLoader(
    () =>
      authorizedCall(async (token) => ({
        accountId: account.id,
        ...(await api.listCategories(token, account.id, {
          pageSize: 100,
          incluirArchivadas: showArchived,
        })),
      })),
    `${account.id}:${showArchived}`,
  );

  function openForm(next: Form | null) {
    setForm(next);
    setInUse(null);
    mutation.clearError();
  }

  async function submit(current: Form, values: FormValues) {
    const name = values.nombre.trim();
    const desc = values.descripcion.trim();
    const ok = await runWatchingArchived(() =>
      authorizedCall((token) => {
        if (current.kind === 'create') {
          return api.createCategory(token, account.id, {
            nombre: name,
            tipo: values.tipo,
            ...(desc !== '' ? { descripcion: desc } : {}),
            ...(values.color !== null ? { color: values.color } : {}),
          });
        }
        const existing = current.category;
        const changes: UpdateCategoryInput = {};
        if (name !== existing.nombre) changes.nombre = name;
        if (desc !== (existing.descripcion ?? '')) changes.descripcion = desc === '' ? null : desc;
        if (values.color !== null && values.color !== existing.color) changes.color = values.color;
        return api.updateCategory(token, existing.id, changes);
      }),
    );
    if (ok) {
      dismiss('categorias');
      setForm(null);
      refresh();
    }
  }

  async function setArchived(category: Category, archivada: boolean) {
    setInUse(null);
    const ok = await runWatchingArchived(() =>
      authorizedCall((token) => api.updateCategory(token, category.id, { archivada })),
    );
    if (ok) refresh();
  }

  async function remove(category: Category) {
    setInUse(null);
    const ok = await mutation.run(async () => {
      try {
        await authorizedCall((token) => api.deleteCategory(token, category.id));
      } catch (error) {
        if (isInUse(error)) setInUse(category);
        throw error;
      }
    });
    if (ok) refresh();
  }

  function confirmDelete(category: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar «${category.nombre}»? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void remove(category) },
      ],
    );
  }

  const busy = mutation.pending;
  const loaded = state.status === 'ready' && state.data.accountId === account.id;
  const items = loaded ? state.data.items.filter((c) => c.tipo === segment) : [];
  // Guía solo con la lista cargada y la cuenta activa (docs/007 §5.12.C).
  const { guide, dismissGuide } = useGuide(['categorias'], loaded && !account.archivada);
  const typeWord = segment === 'egreso' ? 'gasto' : 'ingreso';

  return (
    <ScrollView style={containerStyle} keyboardShouldPersistTaps="handled">
      <ScreenTitle title="Categorías" module="mas" />
      {guide ? <GuideCard guide={guide} onDismiss={dismissGuide} /> : null}

      {fromForm ? <Text style={styles.help}>{FROM_FORM_HELP}</Text> : null}

      <Segmented
        accessibilityLabel="Tipo de categoría"
        value={segment}
        onChange={(value) => {
          setSegment(value);
          setInUse(null);
        }}
        options={[
          { value: 'egreso', label: 'Gastos' },
          { value: 'ingreso', label: 'Ingresos' },
        ]}
      />

      {account.archivada ? (
        <Text style={styles.archivedNotice}>
          Cuenta archivada: no se pueden crear ni desarchivar categorías.
        </Text>
      ) : null}

      {form ? (
        <CategoryFormCard
          key={form.kind === 'edit' ? form.category.id : 'create'}
          form={form}
          segment={segment}
          busy={busy}
          error={mutation.error}
          onSubmit={(values) => void submit(form, values)}
          onClose={() => openForm(null)}
        />
      ) : (
        <>
          {!account.archivada ? (
            <View style={styles.newButton}>
              <Button
                label="+ Nueva categoría"
                accessibilityLabel="Nueva categoría"
                variant="primary"
                tall
                disabled={busy}
                onPress={() => openForm({ kind: 'create' })}
              />
            </View>
          ) : null}
          {mutation.error && !inUse ? (
            <Text accessibilityRole="alert" style={[styles.error, styles.errorGap]}>
              {mutation.error}
            </Text>
          ) : null}
          {inUse ? (
            <View style={styles.inUseBox}>
              <Text accessibilityRole="alert" style={styles.inUseText}>
                {IN_USE_NOTICE}
              </Text>
              <Button
                label={`Archivar «${inUse.nombre}»`}
                disabled={busy}
                onPress={() => void setArchived(inUse, true)}
              />
            </View>
          ) : null}
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Mostrar archivadas</Text>
        <Switch
          accessibilityLabel="Mostrar archivadas"
          value={showArchived}
          onValueChange={setShowArchived}
          disabled={busy}
          trackColor={{ false: colors.borderStrong, true: colors.brand700 }}
          thumbColor={colors.white}
        />
      </View>

      {!loaded && state.status !== 'error' ? (
        <LoadingState text="Cargando categorías…" testID="categories-loading" />
      ) : state.status === 'error' ? (
        <ErrorBox message={state.message} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          module="mas"
          glyph="🏷️"
          message={
            account.archivada
              ? `Aún no tienes categorías de ${typeWord}.`
              : `Aún no tienes categorías de ${typeWord}. Crea la primera.`
          }
        />
      ) : (
        items.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            busy={busy}
            onOpenMenu={() => setMenuFor(category)}
          />
        ))
      )}

      <Sheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        accessibilityLabel={menuFor ? `Acciones de ${menuFor.nombre}` : 'Acciones'}
        testID="category-menu"
      >
        {menuFor ? (
          <View style={styles.menu}>
            <Text accessibilityRole="header" style={styles.menuTitle}>
              {menuFor.nombre}
            </Text>
            <Button
              label="Editar"
              accessibilityLabel={`Editar ${menuFor.nombre}`}
              disabled={busy}
              onPress={() => {
                const category = menuFor;
                setMenuFor(null);
                openForm({ kind: 'edit', category });
              }}
            />
            <Button
              label={menuFor.archivada ? 'Desarchivar' : 'Archivar'}
              accessibilityLabel={`${menuFor.archivada ? 'Desarchivar' : 'Archivar'} ${menuFor.nombre}`}
              disabled={busy}
              onPress={() => {
                const category = menuFor;
                setMenuFor(null);
                void setArchived(category, !category.archivada);
              }}
            />
            <View style={styles.menuDanger}>
              <Button
                label="Eliminar"
                variant="danger"
                accessibilityLabel={`Eliminar ${menuFor.nombre}`}
                disabled={busy}
                onPress={() => {
                  const category = menuFor;
                  setMenuFor(null);
                  confirmDelete(category);
                }}
              />
            </View>
            <Button label="Cerrar" variant="ghost" onPress={() => setMenuFor(null)} />
          </View>
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

function CategoryRow({
  category,
  busy,
  onOpenMenu,
}: {
  category: Category;
  busy: boolean;
  onOpenMenu: () => void;
}) {
  const archived = category.archivada;
  return (
    <View
      testID={`category-row-${category.id}`}
      style={[styles.row, archived ? styles.rowArchived : shadows.card]}
    >
      <CategoryIcon icono={category.icono} color={category.color} size={40} dimmed={archived} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{category.nombre}</Text>
        {category.descripcion ? <Text style={styles.rowDesc}>{category.descripcion}</Text> : null}
        {archived ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Archivada</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Acciones de ${category.nombre}`}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onOpenMenu}
        style={[styles.more, busy && styles.moreDisabled]}
      >
        <Text importantForAccessibility="no" accessibilityElementsHidden style={styles.moreGlyph}>
          ⋮
        </Text>
      </Pressable>
    </View>
  );
}

// Formulario de crear/editar. Monta el guard de descarte solo mientras está abierto (docs/003 R3 D4);
// Atrás sin cambios cierra el formulario y no la pantalla (listener registrado antes del del guard,
// por lo que se consulta después de él).
function CategoryFormCard({
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
      }
    : { nombre: '', descripcion: '', tipo: segment, color: null };
  const [nombre, setNombre] = useState(initial.nombre);
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [tipo, setTipo] = useState<CategoryType>(initial.tipo);
  const [color, setColor] = useState<string | null>(initial.color);
  const [nameError, setNameError] = useState<string | null>(null);
  const initialRef = useRef(initial);

  const dirty = editing
    ? nombre.trim() !== initialRef.current.nombre ||
      descripcion.trim() !== initialRef.current.descripcion ||
      (color !== null && color !== initialRef.current.color)
    : nombre.trim() !== '' ||
      descripcion.trim() !== '' ||
      color !== null ||
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
    onSubmit({ nombre, descripcion, tipo, color });
  }

  const colorName = CATEGORY_COLORS.find((option) => option.value === color)?.name;

  return (
    <Card style={styles.formCard}>
      <Text accessibilityRole="header" style={styles.formTitle}>
        {editing ? 'Editar categoría' : 'Nueva categoría'}
      </Text>

      <Text style={styles.label}>Nombre</Text>
      <FormTextInput
        accessibilityLabel="Nombre de la categoría"
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
        editable={!busy}
        error={nameError !== null}
      />
      <Text style={styles.label}>Descripción (opcional)</Text>
      <FormTextInput
        accessibilityLabel="Descripción"
        placeholder="Descripción (opcional)"
        value={descripcion}
        onChangeText={setDescripcion}
        editable={!busy}
      />

      {editing ? (
        <Text style={styles.fixedType}>
          Tipo: {initial.tipo === 'egreso' ? 'Gasto' : 'Ingreso'} (no se puede cambiar)
        </Text>
      ) : (
        <>
          <Text style={styles.label}>Tipo</Text>
          <TypeToggle
            value={toTransactionType(tipo)}
            onChange={(value) => setTipo(value === 'gasto' ? 'egreso' : 'ingreso')}
            disabled={busy}
          />
        </>
      )}

      <Text style={styles.label}>Color</Text>
      <Text style={styles.colorSummary}>
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
              onPress={() => setColor(option.value)}
              style={styles.colorOption}
            >
              <View style={[styles.colorRing, selected && styles.colorRingSelected]}>
                <View style={[styles.colorFill, { backgroundColor: categoryFill(option.value) }]}>
                  {selected ? (
                    <Text
                      importantForAccessibility="no"
                      accessibilityElementsHidden
                      style={styles.colorCheck}
                    >
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

      <Text style={styles.previewLabel}>Vista previa</Text>
      <View style={styles.preview}>
        <CategoryIcon icono="" color={color ?? ''} size={32} />
        <Text style={[styles.previewName, nombre.trim() === '' && styles.previewEmpty]}>
          {nombre.trim() === '' ? 'Nombre de la categoría' : nombre.trim()}
        </Text>
      </View>

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
  help: { ...typography.small, color: colors.text2, marginBottom: 12 },
  archivedNotice: {
    ...typography.small,
    color: colors.yellowText,
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 12,
  },
  newButton: { marginTop: 12 },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText },
  errorGap: { marginTop: 8 },
  inUseBox: {
    marginTop: 12,
    padding: 12,
    gap: 12,
    borderRadius: radii.md,
    backgroundColor: colors.yellowSoft,
  },
  inUseText: { ...typography.small, color: colors.yellowText },
  switchRow: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  switchLabel: { ...typography.body, color: colors.text, flexShrink: 1 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  rowArchived: { backgroundColor: colors.archivedRow },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  rowDesc: { ...typography.small, color: colors.text2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    backgroundColor: colors.yellowSoft,
  },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.yellowText },
  more: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreDisabled: { opacity: 0.5 },
  moreGlyph: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text },
  menu: { gap: 8 },
  menuTitle: { ...typography.h2, color: colors.text },
  menuDanger: { marginTop: 8 },
  formCard: { marginTop: 12, padding: 16 },
  formTitle: { ...typography.h2, color: colors.text },
  label: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  fixedType: { ...typography.small, color: colors.text2, marginTop: 16 },
  colorSummary: { ...typography.small, color: colors.text2, marginBottom: 8 },
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
