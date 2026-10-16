import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader, useMutation } from '../hooks/use-loader';
import { isValidDateString, todayLocal, yesterdayLocal } from '../lib/dates';
import { formatCents, parseCentsFromInput } from '../lib/money';
import {
  ApiRequestError,
  type Account,
  type ResourcesApi,
  type Transaction,
  type TransactionType,
  type UpdateTransactionInput,
} from '../lib/resources-api';
import { Button, Chip, ErrorBox, screenStyles as s } from './ui';

export const MAX_AMOUNT_CENTS = 99_999_999_999;
export const NOTE_MAX = 500;

// 1250 -> "12.50" (sin símbolo, para editar en el campo de texto).
function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

// Errores tras los cuales la lista de categorías mostrada puede estar desactualizada.
const STALE_CATEGORY_CODES = new Set(['NOT_FOUND', 'CATEGORY_ARCHIVED', 'CATEGORY_MISMATCH']);

export default function TransactionFormScreen({
  account,
  api,
  transaction,
  initialFecha,
  onDone,
  onAccountArchived,
}: {
  account: Account;
  api: ResourcesApi;
  transaction?: Transaction | undefined;
  // Fecha preseleccionada al crear (p. ej. el día elegido en el calendario); si no es válida, hoy.
  initialFecha?: string | undefined;
  // `changed` = hubo escritura (crear, editar con cambios o anular): el contenedor relee el saldo.
  onDone: (changed: boolean) => void;
  // 409 ACCOUNT_ARCHIVED al crear: el servidor confirma que la cuenta está archivada.
  onAccountArchived?: (accountId: string) => void;
}) {
  const { authorizedCall } = useAuth();
  const editing = transaction !== undefined;
  const [montoText, setMontoText] = useState(transaction ? centsToInput(transaction.monto) : '');
  const [tipo, setTipo] = useState<TransactionType>(transaction?.tipo ?? 'gasto');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [fecha, setFecha] = useState(
    transaction?.fecha ??
      (initialFecha !== undefined && isValidDateString(initialFecha) ? initialFecha : todayLocal()),
  );
  const [nota, setNota] = useState(transaction?.nota ?? '');
  const [errors, setErrors] = useState<{ monto?: string; categoria?: string; fecha?: string }>({});
  const mutation = useMutation();
  const staleCategories = useRef(false);
  const accountArchived = useRef(false);
  const busy = mutation.pending;

  // Mientras se guarda, Atrás se ignora (el listener más reciente tiene prioridad).
  useEffect(() => {
    if (!busy) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy]);

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

  function changeTipo(next: TransactionType) {
    if (next === tipo) return;
    setTipo(next);
    setCategoryId(null);
    setErrors((current) => ({ ...current, categoria: undefined }));
  }

  function validate() {
    const next: typeof errors = {};
    const cents = parseCentsFromInput(montoText);
    if (cents === null || cents <= 0)
      next.monto = 'Ingresa un monto mayor a cero, por ejemplo 12.50.';
    else if (cents > MAX_AMOUNT_CENTS)
      next.monto = `El monto máximo es ${formatCents(MAX_AMOUNT_CENTS)}.`;
    if (!editing && categoryId === null) next.categoria = 'Elige una categoría.';
    if (!isValidDateString(fecha)) {
      next.fecha = 'Escribe una fecha válida con formato AAAA-MM-DD (años 2000 a 2100).';
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, cents: cents ?? 0 };
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
      onDone(true);
      return;
    }
    if (accountArchived.current) onAccountArchived?.(account.id);
    if (staleCategories.current) {
      setCategoryId(null);
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

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      </Text>
      <Text style={s.rowSubtitle}>Cuenta: {account.nombre}</Text>

      <Text style={s.section}>Monto</Text>
      <TextInput
        accessibilityLabel="Monto"
        placeholder="0.00"
        keyboardType="decimal-pad"
        autoFocus
        value={montoText}
        onChangeText={setMontoText}
        editable={!busy}
        style={s.input}
      />
      {errors.monto ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.monto}
        </Text>
      ) : null}

      <Text style={s.section}>Tipo</Text>
      {editing ? (
        <Text accessibilityLabel="Tipo">{tipo === 'gasto' ? 'Gasto' : 'Ingreso'}</Text>
      ) : (
        <View style={s.actions} accessibilityRole="radiogroup">
          <Chip
            label="Gasto"
            selected={tipo === 'gasto'}
            disabled={busy}
            onPress={() => changeTipo('gasto')}
          />
          <Chip
            label="Ingreso"
            selected={tipo === 'ingreso'}
            disabled={busy}
            onPress={() => changeTipo('ingreso')}
          />
        </View>
      )}

      <Text style={s.section}>Categoría</Text>
      {editing ? (
        <Text accessibilityLabel="Categoría">
          {currentCategory?.nombre ?? 'Categoría del movimiento'}
        </Text>
      ) : categories.status === 'loading' ? (
        <ActivityIndicator testID="form-categories-loading" />
      ) : categories.status === 'error' ? (
        <ErrorBox message={categories.message} onRetry={reload} />
      ) : options.length === 0 ? (
        <Text style={s.muted}>No hay categorías activas de este tipo. Crea una desde Cuentas.</Text>
      ) : (
        <View style={s.actions} accessibilityRole="radiogroup">
          {options.map((category) => (
            <Chip
              key={category.id}
              label={category.nombre}
              accessibilityLabel={`Categoría ${category.nombre}`}
              selected={categoryId === category.id}
              disabled={busy}
              onPress={() => {
                setCategoryId(category.id);
                setErrors((current) => ({ ...current, categoria: undefined }));
              }}
            />
          ))}
        </View>
      )}
      {errors.categoria ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.categoria}
        </Text>
      ) : null}

      <Text style={s.section}>Fecha</Text>
      <TextInput
        accessibilityLabel="Fecha"
        placeholder="AAAA-MM-DD"
        value={fecha}
        onChangeText={setFecha}
        editable={!busy}
        maxLength={10}
        autoCapitalize="none"
        style={s.input}
      />
      <View style={s.actions}>
        <Button label="Hoy" disabled={busy} onPress={() => setFecha(todayLocal())} />
        <Button label="Ayer" disabled={busy} onPress={() => setFecha(yesterdayLocal())} />
      </View>
      {errors.fecha ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.fecha}
        </Text>
      ) : null}

      <Text style={s.section}>Nota (opcional)</Text>
      <TextInput
        accessibilityLabel="Nota"
        placeholder="Nota"
        value={nota}
        onChangeText={setNota}
        editable={!busy}
        maxLength={NOTE_MAX}
        multiline
        style={s.input}
      />

      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error}
        </Text>
      ) : null}

      <View style={s.actions}>
        <Button label="Guardar" variant="primary" disabled={busy} onPress={() => void submit()} />
        <Button label="Cancelar" disabled={busy} onPress={() => onDone(false)} />
        {transaction ? (
          <Button
            label="Anular movimiento"
            variant="danger"
            disabled={busy}
            onPress={() => confirmVoid(transaction)}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: { color: '#b3261e', marginBottom: 4 },
});
