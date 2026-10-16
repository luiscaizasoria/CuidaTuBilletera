// Crear cuenta (docs/007 §5.3). Sin barra de contexto. Atrás vuelve a Mis cuentas sin preguntar,
// salvo mientras se guarda.
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useMutation } from '../hooks/use-loader';
import { parseCentsFromInput } from '../lib/money';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { colors, typography } from '../theme/tokens';
import { Button, screenStyles as s } from './ui';

export const BALANCE_ERROR =
  'El saldo inicial no es válido. Usa el formato 1234.56 (hasta 2 decimales).';

export default function NewAccountScreen({
  api,
  onBack,
  onCreated,
}: {
  api: ResourcesApi;
  onBack: () => void;
  onCreated: (account: Account) => void;
}) {
  const { authorizedCall } = useAuth();
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation();
  const busy = mutation.pending;

  // Mientras se guarda, Atrás se ignora (el listener más reciente tiene prioridad).
  useEffect(() => {
    if (!busy) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy]);

  const created = useRef<Account | null>(null);

  async function submit() {
    const name = nombre.trim();
    if (name === '') {
      setFormError('Escribe un nombre.');
      return;
    }
    let saldoInicial: number | undefined;
    if (saldo.trim() !== '') {
      const cents = parseCentsFromInput(saldo);
      if (cents === null) {
        setFormError(BALANCE_ERROR);
        return;
      }
      saldoInicial = cents;
    }
    setFormError(null);
    created.current = null;
    const ok = await mutation.run(async () => {
      const result = await authorizedCall((token) =>
        api.createAccount(token, {
          nombre: name,
          ...(saldoInicial !== undefined ? { saldoInicial } : {}),
        }),
      );
      created.current = result.account;
    });
    if (ok && created.current) onCreated(created.current);
  }

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onBack}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Nueva cuenta
        </Text>
      </View>

      <Text style={styles.label}>Nombre de la cuenta</Text>
      <TextInput
        accessibilityLabel="Nombre de la cuenta"
        placeholder="Efectivo, Banco, Tarjeta…"
        value={nombre}
        onChangeText={setNombre}
        editable={!busy}
        style={s.input}
      />

      <Text style={styles.label}>Saldo inicial (opcional)</Text>
      <TextInput
        accessibilityLabel="Saldo inicial"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={saldo}
        onChangeText={setSaldo}
        editable={!busy}
        style={s.input}
      />
      <Text style={styles.help}>
        Es el dinero que ya tienes hoy en esta cuenta. Después no se puede cambiar; lo demás lo
        registras con movimientos.
      </Text>

      {formError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {formError}
        </Text>
      ) : null}
      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error}
        </Text>
      ) : null}

      <Button
        label={busy ? 'Creando…' : 'Crear cuenta'}
        variant="primary"
        tall
        busy={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, fontWeight: '800', color: colors.brand700 },
  title: { ...typography.title, color: colors.text },
  label: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  help: { ...typography.small, color: colors.text2, marginBottom: 16 },
  error: { ...typography.body, color: colors.expenseText, marginBottom: 8 },
});
