// Nuevo / Editar movimiento (R3; docs/007 §5.5.1, docs/008 §6.13). Orden: Tipo, Categoría, Monto,
// Fecha, Detalle y pie fijo con Guardar y Cancelar. La API sigue validando las reglas de negocio.
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { useLoader, useMutation } from '../hooks/use-loader';
import { isValidDateString, formatDateEs, todayLocal, yesterdayLocal } from '../lib/dates';
import { isFormDirty } from '../lib/form-dirty';
import { formatCents, AMOUNT_REJECTION_MESSAGES, validateAmountText } from '../lib/money';
import {
  ACCOUNT_ARCHIVED_ON_SAVE,
  isUncertainWriteFailure,
  LOST_RESPONSE_MOVEMENT,
} from '../lib/resources-messages';
import {
  ApiRequestError,
  type Account,
  type Category,
  type ResourcesApi,
  type Transaction,
  type TransactionType,
  type UpdateTransactionInput,
} from '../lib/resources-api';
import { colors, radii, shadows, sizes, typography } from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';
import DatePickerSheet from './DatePickerSheet';
import {
  AmountField,
  CategoryIcon,
  CategoryOption,
  FieldError,
  FormTextInput,
  formStyles,
  TypeToggle,
} from './form-ui';
import { Button, Chip, ErrorBox } from './ui';

export const MAX_AMOUNT_CENTS = 99_999_999_999;
export const NOTE_MAX = 500;
const NOTE_COUNTER_WARNING = 450;
// El campo conserva lo pegado (con margen para separadores) y la validación lo rechaza al guardar.
const AMOUNT_MAX_LENGTH = 24;

// 1250 -> "12.50" (sin símbolo, para editar en el campo de texto).
function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

// Errores tras los cuales la lista de categorías mostrada puede estar desactualizada.
const STALE_CATEGORY_CODES = new Set(['NOT_FOUND', 'CATEGORY_ARCHIVED', 'CATEGORY_MISMATCH']);

type FieldName = 'categoria' | 'monto' | 'fecha';
type FieldErrors = Partial<Record<FieldName, string>>;

export default function TransactionFormScreen({
  account,
  api,
  transaction,
  initialFecha,
  onDone,
  onAccountArchived,
  onOpenCategories,
}: {
  account: Account;
  api: ResourcesApi;
  transaction?: Transaction | undefined;
  // Fecha preseleccionada al crear (p. ej. el día elegido en el calendario); si no es válida, hoy.
  initialFecha?: string | undefined;
  // `changed` = hubo escritura (crear, editar con cambios o anular): el contenedor relee el saldo.
  // `message`: aviso de éxito que el contenedor muestra en su Snackbar único.
  onDone: (changed: boolean, message?: string) => void;
  // 409 ACCOUNT_ARCHIVED al crear: el servidor confirma que la cuenta está archivada.
  onAccountArchived?: (accountId: string) => void;
  // «Ir a Categorías» cuando no hay categorías activas del tipo elegido.
  onOpenCategories?: () => void;
}) {
  const { authorizedCall } = useAuth();
  const insets = useSystemInsets();
  const editing = transaction !== undefined;
  const [montoText, setMontoText] = useState(transaction ? centsToInput(transaction.monto) : '');
  const [tipo, setTipo] = useState<TransactionType>(transaction?.tipo ?? 'gasto');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [fecha, setFecha] = useState(
    transaction?.fecha ??
      (initialFecha !== undefined && isValidDateString(initialFecha) ? initialFecha : todayLocal()),
  );
  const [nota, setNota] = useState(transaction?.nota ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [archivedBlocked, setArchivedBlocked] = useState(false);
  // La creación falló sin certeza de si el servidor la grabó (red o 5xx): no se invita a reintentar.
  const [lostResponse, setLostResponse] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    n: number;
    field: FieldName;
    message: string;
  } | null>(null);
  const mutation = useMutation();
  const staleCategories = useRef(false);
  const accountArchived = useRef(false);
  const uncertain = useRef(false);
  const busy = mutation.pending;

  // Instantánea inicial (al montar): lo prefijado no cuenta como cambio.
  const initial = useRef({
    categoryId,
    monto: montoText,
    fecha,
    nota,
  }).current;
  // Con la cuenta archivada (409) los datos ya no se pueden enviar: se sale sin preguntar.
  const dirty =
    !archivedBlocked && isFormDirty(initial, { categoryId, monto: montoText, fecha, nota });
  const { requestLeave } = useDiscardGuard({
    dirty,
    busy,
    onLeave: () => onDone(false),
    title: editing ? '¿Descartar los cambios?' : '¿Descartar este movimiento?',
    message: editing ? 'Los cambios que hiciste no se guardarán.' : 'Lo que escribiste se perderá.',
  });

  const scrollRef = useRef<ScrollView>(null);
  const montoRef = useRef<TextInput>(null);
  const categoryErrorRef = useRef<Text>(null);
  const dateErrorRef = useRef<Text>(null);
  const submitErrorRef = useRef<Text>(null);
  const sectionY = useRef<Partial<Record<FieldName, number>>>({});

  // Foco y anuncio del primer error tras un intento fallido (un solo anuncio por intento).
  useEffect(() => {
    if (focusRequest === null) return;
    const y = sectionY.current[focusRequest.field];
    if (y !== undefined) scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 8), animated: true });
    if (focusRequest.field === 'monto') montoRef.current?.focus();
    else {
      const node = findNodeHandle(
        focusRequest.field === 'categoria' ? categoryErrorRef.current : dateErrorRef.current,
      );
      if (node !== null) AccessibilityInfo.setAccessibilityFocus?.(node);
    }
    AccessibilityInfo.announceForAccessibility?.(focusRequest.message);
  }, [focusRequest]);

  // Error de envío: el texto específico de respuesta perdida o de cuenta archivada manda sobre el genérico.
  const submitError = archivedBlocked
    ? ACCOUNT_ARCHIVED_ON_SAVE
    : lostResponse
      ? LOST_RESPONSE_MOVEMENT
      : mutation.error;
  // El foco va al mensaje de error de envío.
  useEffect(() => {
    if (!submitError) return;
    const node = findNodeHandle(submitErrorRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus?.(node);
  }, [submitError]);

  // Creación: categorías activas del tipo elegido (gasto -> egreso). Edición: todas, solo para el nombre.
  const {
    state: categories,
    reload,
    refresh,
  } = useLoader(
    () =>
      authorizedCall((token) =>
        api.listCategories(token, account.id, {
          pageSize: 100,
          ...(editing
            ? { incluirArchivadas: true }
            : { tipo: tipo === 'gasto' ? ('egreso' as const) : ('ingreso' as const) }),
        }),
      ),
    editing ? `edit:${account.id}` : `${account.id}:${tipo}`,
  );

  const clearError = (field: FieldName) =>
    setErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: undefined },
    );

  function changeTipo(next: TransactionType) {
    if (next === tipo) return;
    setTipo(next);
    setCategoryId(null);
    clearError('categoria');
  }

  function validate() {
    const next: FieldErrors = {};
    const amount = validateAmountText(montoText);
    const cents = amount.ok ? amount.cents : 0;
    if (!editing && categoryId === null) next.categoria = 'Elige una categoría.';
    if (!amount.ok) {
      next.monto =
        amount.reason === 'empty'
          ? 'Ingresa un monto mayor a cero, por ejemplo 12.50.'
          : amount.reason === 'too-large'
            ? `El monto máximo es ${formatCents(MAX_AMOUNT_CENTS)}.`
            : AMOUNT_REJECTION_MESSAGES[amount.reason];
    } else if (cents <= 0) next.monto = 'Ingresa un monto mayor a cero, por ejemplo 12.50.';
    else if (cents > MAX_AMOUNT_CENTS)
      next.monto = `El monto máximo es ${formatCents(MAX_AMOUNT_CENTS)}.`;
    if (!isValidDateString(fecha)) next.fecha = 'Elige una fecha válida (años 2000 a 2100).';
    setErrors(next);
    // Orden de revisión = orden visual: Categoría, Monto, Fecha.
    const first = (['categoria', 'monto', 'fecha'] as const).find((field) => next[field]);
    if (first) {
      setFocusRequest((current) => ({
        n: (current?.n ?? 0) + 1,
        field: first,
        message: next[first]!,
      }));
    }
    return { ok: first === undefined, cents };
  }

  async function submit() {
    const { ok: valid, cents } = validate();
    if (!valid) return;
    const note = nota.trim();

    if (transaction) {
      const changes: UpdateTransactionInput = {};
      if (cents !== transaction.monto) changes.monto = cents;
      if (fecha !== transaction.fecha) changes.fecha = fecha;
      if (note !== (transaction.nota ?? '')) changes.nota = note === '' ? null : note;
      if (Object.keys(changes).length === 0) {
        onDone(false); // sin cambios no se llama a la API
        return;
      }
      const ok = await mutation.run(() =>
        authorizedCall((token) => api.updateTransaction(token, transaction.id, changes)),
      );
      if (ok) onDone(true);
      return;
    }

    staleCategories.current = false;
    accountArchived.current = false;
    uncertain.current = false;
    setLostResponse(false);
    const ok = await mutation.run(async () => {
      try {
        await authorizedCall((token) =>
          api.createTransaction(token, {
            accountId: account.id,
            categoryId: categoryId!,
            tipo,
            monto: cents,
            fecha,
            ...(note !== '' ? { nota: note } : {}),
          }),
        );
      } catch (error) {
        uncertain.current = isUncertainWriteFailure(error);
        if (error instanceof ApiRequestError && STALE_CATEGORY_CODES.has(error.code)) {
          staleCategories.current = true;
        }
        if (
          error instanceof ApiRequestError &&
          error.status === 409 &&
          error.code === 'ACCOUNT_ARCHIVED'
        ) {
          accountArchived.current = true;
        }
        throw error;
      }
    });
    if (ok) {
      const name = options.find((c) => c.id === categoryId)?.nombre;
      onDone(
        true,
        name
          ? `${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de ${formatCents(cents)} guardado en ${name}`
          : undefined,
      );
      return;
    }
    if (uncertain.current) setLostResponse(true);
    if (accountArchived.current) {
      setArchivedBlocked(true);
      onAccountArchived?.(account.id);
    }
    if (staleCategories.current) {
      setCategoryId(null);
      setErrors((current) => ({ ...current, categoria: 'Esa categoría cambió. Elige otra.' }));
      refresh();
    }
  }

  async function voidTransaction(target: Transaction) {
    const ok = await mutation.run(async () => {
      try {
        await authorizedCall((token) => api.deleteTransaction(token, target.id));
      } catch (error) {
        // 404: ya no existe; se trata como anulado y se vuelve a recargar.
        if (error instanceof ApiRequestError && error.status === 404) return;
        throw error;
      }
    });
    if (ok) onDone(true);
  }

  function confirmVoid(target: Transaction) {
    Alert.alert('Anular movimiento', '¿Anular este movimiento? Dejará de contar en el saldo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Anular', style: 'destructive', onPress: () => void voidTransaction(target) },
    ]);
  }

  const options =
    categories.status === 'ready' ? categories.data.items.filter((c) => !c.archivada) : [];
  const currentCategory =
    categories.status === 'ready'
      ? categories.data.items.find((c) => c.id === transaction?.categoryId)
      : undefined;

  const today = todayLocal();
  const yesterday = yesterdayLocal();
  const customDate = fecha !== today && fecha !== yesterday;
  const tone = tipo === 'gasto' ? 'gasto' : 'ingreso';
  const saveLabel = busy
    ? 'Guardando…'
    : editing
      ? 'Guardar cambios'
      : tipo === 'gasto'
        ? 'Guardar gasto'
        : 'Guardar ingreso';
  const rows: Category[][] = [];
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));

  const markSection = (field: FieldName) => ({
    onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
      sectionY.current[field] = event.nativeEvent.layout.y;
    },
  });

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        testID="transaction-form-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar formulario"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => requestLeave()}
            style={[styles.close, busy && styles.closeDisabled]}
          >
            <Text style={styles.closeText} importantForAccessibility="no">
              ✕
            </Text>
          </Pressable>
        </View>

        <Text style={formStyles.label}>Tipo</Text>
        {editing ? (
          <View
            style={[
              styles.readOnly,
              { backgroundColor: tipo === 'gasto' ? colors.expenseSoft : colors.incomeSoft },
            ]}
          >
            <Text
              accessibilityLabel={`Tipo: ${tipo === 'gasto' ? 'Gasto' : 'Ingreso'}`}
              style={[
                styles.readOnlyType,
                { color: tipo === 'gasto' ? colors.expenseText : colors.incomeText },
              ]}
            >
              {tipo === 'gasto' ? 'Gasto' : 'Ingreso'}
            </Text>
          </View>
        ) : (
          <TypeToggle value={tipo} onChange={changeTipo} disabled={busy} />
        )}

        <View {...markSection('categoria')}>
          <Text style={formStyles.label}>Categoría</Text>
          {editing ? (
            <View style={styles.readOnlyCategory}>
              {currentCategory ? (
                <CategoryIcon icono={currentCategory.icono} color={currentCategory.color} />
              ) : null}
              <Text
                accessibilityLabel={`Categoría: ${currentCategory?.nombre ?? 'Categoría del movimiento'}`}
                style={styles.readOnlyName}
              >
                {currentCategory?.nombre ?? 'Categoría del movimiento'}
              </Text>
            </View>
          ) : categories.status === 'loading' ? (
            <ActivityIndicator testID="form-categories-loading" />
          ) : categories.status === 'error' ? (
            <ErrorBox message={categories.message} onRetry={reload} />
          ) : options.length === 0 ? (
            <View style={styles.emptyCategories}>
              <Text style={styles.emptyText}>
                {`No tienes categorías de ${tipo === 'gasto' ? 'gasto' : 'ingreso'} activas. Crea una en Más > Categorías.`}
              </Text>
              {onOpenCategories ? (
                <Button
                  label="Ir a Categorías"
                  disabled={busy}
                  onPress={() => requestLeave(onOpenCategories)}
                />
              ) : null}
            </View>
          ) : (
            <View accessibilityRole="radiogroup" accessibilityLabel="Categoría" style={styles.grid}>
              {rows.map((row) => (
                <View key={row[0]!.id} style={styles.gridRow}>
                  {row.map((category) => (
                    <CategoryOption
                      key={category.id}
                      nombre={category.nombre}
                      icono={category.icono}
                      color={category.color}
                      tipo={tipo}
                      selected={categoryId === category.id}
                      disabled={busy}
                      onPress={() => {
                        setCategoryId(category.id);
                        clearError('categoria');
                      }}
                    />
                  ))}
                  {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
                </View>
              ))}
            </View>
          )}
          {errors.categoria ? (
            <FieldError ref={categoryErrorRef} message={errors.categoria} />
          ) : null}
        </View>

        <View {...markSection('monto')}>
          <Text style={formStyles.label}>Monto</Text>
          <AmountField
            ref={montoRef}
            accessibilityLabel="Monto"
            value={montoText}
            onChangeText={(text) => {
              setMontoText(text);
              clearError('monto');
            }}
            maxLength={AMOUNT_MAX_LENGTH}
            editable={!busy}
            error={errors.monto !== undefined}
          />
          {errors.monto ? <FieldError message={errors.monto} /> : null}
        </View>

        <View {...markSection('fecha')}>
          <Text style={formStyles.label}>Fecha</Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`Fecha: ${formatDateEs(fecha)}`}
            style={styles.dateRow}
          >
            <Chip
              label="Hoy"
              tone={tone}
              selected={fecha === today}
              disabled={busy}
              onPress={() => {
                setFecha(today);
                clearError('fecha');
              }}
            />
            <Chip
              label="Ayer"
              tone={tone}
              selected={fecha === yesterday}
              disabled={busy}
              onPress={() => {
                setFecha(yesterday);
                clearError('fecha');
              }}
            />
            <Chip
              label={customDate ? formatDateEs(fecha) : 'Otra fecha…'}
              accessibilityLabel={customDate ? `Otra fecha, ${formatDateEs(fecha)}` : 'Otra fecha'}
              tone={tone}
              selected={customDate}
              disabled={busy}
              suffix={customDate ? undefined : '▾'}
              onPress={() => setDateSheetOpen(true)}
            />
          </View>
          {errors.fecha ? <FieldError ref={dateErrorRef} message={errors.fecha} /> : null}
        </View>

        <Text style={formStyles.label}>Detalle (opcional)</Text>
        <FormTextInput
          accessibilityLabel="Detalle"
          placeholder="Detalle"
          value={nota}
          onChangeText={setNota}
          editable={!busy}
          maxLength={NOTE_MAX}
          multiline
        />
        <Text
          style={[styles.counter, nota.length >= NOTE_COUNTER_WARNING && styles.counterNear]}
        >{`${nota.length}/${NOTE_MAX}`}</Text>

        {transaction ? (
          <View style={styles.voidWrap}>
            <Button
              label="Anular movimiento"
              variant="danger"
              disabled={busy}
              onPress={() => confirmVoid(transaction)}
            />
          </View>
        ) : null}
      </ScrollView>

      <View
        testID="transaction-form-footer"
        style={[styles.footer, shadows.raised, { paddingBottom: 12 + insets.bottom }]}
      >
        {submitError ? (
          <Text
            ref={submitErrorRef}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.submitError}
          >
            {submitError}
          </Text>
        ) : null}
        {archivedBlocked ? (
          <Button label="Volver a la cuenta" variant="primary" tall onPress={() => onDone(false)} />
        ) : (
          <>
            <Button
              label={saveLabel}
              variant="primary"
              tall
              busy={busy}
              onPress={() => void submit()}
            />
            <Button
              label="Cancelar"
              variant="ghost"
              disabled={busy}
              onPress={() => requestLeave()}
            />
          </>
        )}
      </View>

      <DatePickerSheet
        visible={dateSheetOpen}
        value={fecha}
        today={today}
        tipo={tipo}
        onClose={() => setDateSheetOpen(false)}
        onSelect={(date) => {
          setFecha(date);
          clearError('fecha');
          setDateSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  title: { ...typography.title, flex: 1, color: colors.text },
  close: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDisabled: { opacity: 0.5 },
  closeText: { fontSize: 22, fontWeight: '800', color: colors.text },
  readOnly: { borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyType: { ...typography.button },
  readOnlyCategory: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  readOnlyName: { ...typography.greeting, color: colors.text },
  emptyCategories: { gap: 8, alignItems: 'flex-start' },
  emptyText: { ...typography.body, color: colors.text2 },
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridSpacer: { flex: 1 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  counter: { ...typography.small, color: colors.text3, textAlign: 'right', marginTop: 4 },
  counterNear: { color: colors.text, fontWeight: '700' },
  voidWrap: { marginTop: 24 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  submitError: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.expenseText },
});
