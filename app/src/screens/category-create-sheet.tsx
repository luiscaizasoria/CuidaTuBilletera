// Hoja «Nueva categoría» de Nuevo movimiento (R5.1; docs/007 §5.13 E, docs/008 §6.15.5). Se monta
// dentro de TransactionFormScreen para no perder el estado del movimiento. Crea la categoría con la
// API existente (`createCategory`) del tipo fijado por el movimiento; no lleva descripción.
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { useGuides } from '../hooks/use-guides';
import { useMutation } from '../hooks/use-loader';
import {
  isUncertainWriteFailure,
  resourceErrorMessage,
  UNCERTAIN_CATEGORY_MESSAGE,
} from '../lib/resources-messages';
import {
  ApiRequestError,
  type Account,
  type Category,
  type CategoryType,
  type ResourcesApi,
} from '../lib/resources-api';
import { colors, radii, typography } from '../theme/tokens';
import { CategoryFormFields, type FormValues } from './category-form';
import { Sheet } from './sheets';
import { Button } from './ui';

export const LIMIT_REACHED_CATEGORY_MESSAGE =
  'Llegaste al máximo de categorías de esta cuenta. Archiva alguna en Más > Categorías para crear otra.';
export const NOT_CREATED_MESSAGE = 'No se creó. Puedes intentarlo de nuevo.';

const isConflict = (error: unknown, code: string) =>
  error instanceof ApiRequestError && error.status === 409 && error.code === code;

// Ventana baja o teclado abierto: la hoja usa casi todo el alto y el pie pasa a una fila.
const COMPACT_WINDOW_DP = 480;

export default function CategoryCreateSheet(props: SheetProps & { visible: boolean }) {
  const { visible, ...rest } = props;
  // La hoja (y su estado, su guard y su listener de Atrás) existe solo mientras está abierta.
  return visible ? <OpenCategorySheet {...rest} /> : null;
}

interface SheetProps {
  // Cierre real (sin preguntar): lo llama la propia hoja tras descartar o crear.
  onClose: () => void;
  // Tipo del movimiento (gasto -> egreso); no se puede cambiar.
  tipo: CategoryType;
  account: Account;
  api: ResourcesApi;
  // La categoría existe (creada o confirmada con «Revisar la lista»): el formulario la selecciona.
  onCreated: (category: Category) => void;
  // 409 ACCOUNT_ARCHIVED: el formulario se bloquea como al guardar un movimiento.
  onAccountArchived: () => void;
}

function OpenCategorySheet({
  onClose,
  tipo,
  account,
  api,
  onCreated,
  onAccountArchived,
}: SheetProps) {
  const { authorizedCall } = useAuth();
  const { dismiss } = useGuides();
  const { height } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const compact = height < COMPACT_WINDOW_DP || keyboardOpen;
  const mutation = useMutation();
  const [draft, setDraft] = useState<FormValues>({
    nombre: '',
    descripcion: '',
    tipo,
    color: null,
    icono: null,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // La creación falló sin certeza de si el servidor la grabó: no se reintenta a ciegas.
  const [uncertain, setUncertain] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = mutation.pending || reviewing;
  const dirty = draft.nombre.trim() !== '' || draft.color !== null || draft.icono !== null;

  // Atrás: este listener se registra ANTES que el del guard (que se consulta primero). Si el guard no
  // interviene (sin cambios), la hoja se cierra aquí; nunca llega al guard del formulario de movimiento.
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
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
    title: '¿Descartar esta categoría?',
    message: 'Lo que escribiste se perderá.',
  });
  function change(patch: Partial<FormValues>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.nombre !== undefined) setNameError(null);
  }

  function finish(category: Category) {
    dismiss('categorias');
    onCreated(category);
  }

  async function save() {
    if (busy || uncertain) return;
    const nombre = draft.nombre.trim();
    if (nombre === '') {
      setNameError('Escribe un nombre.');
      return;
    }
    setNameError(null);
    setFooterError(null);
    setNotice(null);
    const result: { category: Category | null; failure: unknown } = {
      category: null,
      failure: null,
    };
    const ok = await mutation.run(async () => {
      try {
        result.category = await authorizedCall((token) =>
          api.createCategory(token, account.id, {
            nombre,
            tipo,
            ...(draft.color !== null ? { color: draft.color } : {}),
            ...(draft.icono !== null ? { icono: draft.icono } : {}),
          }),
        );
      } catch (error) {
        result.failure = error;
        throw error;
      }
    });
    if (ok && result.category) {
      finish(result.category);
      return;
    }
    if (!mounted.current) return;
    const { failure } = result;
    if (isConflict(failure, 'ACCOUNT_ARCHIVED')) {
      onAccountArchived();
      onClose();
    } else if (isConflict(failure, 'CATEGORY_NAME_TAKEN'))
      setNameError(resourceErrorMessage(failure));
    else if (isConflict(failure, 'LIMIT_REACHED')) setFooterError(LIMIT_REACHED_CATEGORY_MESSAGE);
    else if (isUncertainWriteFailure(failure)) {
      setUncertain(true);
      setFooterError(UNCERTAIN_CATEGORY_MESSAGE);
    } else setFooterError(resourceErrorMessage(failure));
  }

  // Tras un fallo incierto: relee la lista antes de permitir otro intento.
  async function reviewList() {
    if (busy) return;
    const nombre = draft.nombre.trim().toLowerCase();
    setReviewing(true);
    setNotice(null);
    try {
      const page = await authorizedCall((token) =>
        api.listCategories(token, account.id, { pageSize: 100, tipo }),
      );
      if (!mounted.current) return;
      const found = page.items.find(
        (item) => item.tipo === tipo && item.nombre.trim().toLowerCase() === nombre,
      );
      if (found) {
        finish(found);
        return;
      }
      setUncertain(false);
      setFooterError(null);
      setNotice(NOT_CREATED_MESSAGE);
    } catch (error) {
      // La relectura también falló: se conserva el bloqueo y se muestra el error de carga.
      if (mounted.current) setFooterError(resourceErrorMessage(error));
    } finally {
      if (mounted.current) setReviewing(false);
    }
  }

  const typeWord = tipo === 'egreso' ? 'Gasto' : 'Ingreso';
  const expense = tipo === 'egreso';
  const saveLabel = mutation.pending ? 'Guardando…' : 'Guardar categoría';
  const saveButton = (
    <Button
      label={saveLabel}
      accessibilityLabel="Guardar categoría"
      variant="primary"
      tall={!compact}
      busy={mutation.pending}
      disabled={uncertain || reviewing}
      onPress={() => void save()}
    />
  );
  const cancelButton = (
    <Button label="Cancelar" variant="ghost" disabled={busy} onPress={() => requestLeave()} />
  );

  return (
    <Sheet
      visible
      onClose={() => requestLeave()}
      accessibilityLabel="Nueva categoría"
      testID="category-create-sheet"
      tall
      compact={compact}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          Nueva categoría
        </Text>
        <View
          style={[
            styles.pill,
            { backgroundColor: expense ? colors.expenseSoft : colors.incomeSoft },
          ]}
        >
          <Text
            style={[styles.pillText, { color: expense ? colors.expenseText : colors.incomeText }]}
          >
            {`Tipo: ${typeWord}`}
          </Text>
        </View>
      </View>

      <ScrollView
        testID="category-create-scroll"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <CategoryFormFields
          draft={draft}
          onChange={change}
          busy={busy}
          nameError={nameError}
          showDescription={false}
          hideTypeControl
        />
        {nameError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {nameError}
          </Text>
        ) : null}
      </ScrollView>

      <View testID="category-create-footer" style={styles.footer}>
        {footerError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {footerError}
          </Text>
        ) : null}
        {notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        {uncertain ? (
          <Button
            label="Revisar la lista"
            variant="secondary"
            busy={reviewing}
            disabled={mutation.pending}
            onPress={() => void reviewList()}
          />
        ) : null}
        {compact ? (
          <View style={styles.footerRow}>
            <View style={styles.flex}>{cancelButton}</View>
            <View style={styles.flex}>{saveButton}</View>
          </View>
        ) : (
          <>
            {saveButton}
            {cancelButton}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { ...typography.h2, color: colors.text, flexShrink: 1 },
  pill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { ...typography.small, fontWeight: '700' },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 8 },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText, marginTop: 8 },
  notice: { ...typography.small, fontWeight: '700', color: colors.yellowText },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
