// Crear cuenta (R3; docs/007 §5.3 y §5.5.1, docs/008 §6.13). Sin barra de contexto. Atrás y «‹»
// piden confirmar solo si hay algo escrito; mientras se guarda se ignoran.
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { useMutation } from '../hooks/use-loader';
import { isAccountFormDirty } from '../lib/form-dirty';
import { AMOUNT_REJECTION_MESSAGES, validateAmountText } from '../lib/money';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { isUncertainWriteFailure, LOST_RESPONSE_ACCOUNT } from '../lib/resources-messages';
import { colors, typography } from '../theme/tokens';
import { AmountField, CheckboxChip, FieldError, FormTextInput } from './form-ui';
import { Button } from './ui';

export const BALANCE_TOO_BIG_ERROR = 'El saldo inicial es demasiado grande. Revisa la cifra.';
export const NEGATIVE_BALANCE_LABEL = 'Es un saldo en contra (debo dinero)';
// El campo conserva lo pegado (con margen para separadores) y la validación lo rechaza al guardar.
const BALANCE_MAX_LENGTH = 24;

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
  const [enContra, setEnContra] = useState(false);
  const [errors, setErrors] = useState<{ nombre?: string; saldo?: string }>({});
  const mutation = useMutation();
  const busy = mutation.pending;
  const nombreRef = useRef<TextInput>(null);
  const saldoRef = useRef<TextInput>(null);
  const created = useRef<Account | null>(null);
  const uncertain = useRef(false);
  const [lostResponse, setLostResponse] = useState(false);

  const { requestLeave } = useDiscardGuard({
    dirty: isAccountFormDirty({ nombre, saldo, enContra }),
    busy,
    onLeave: onBack,
    title: '¿Descartar esta cuenta?',
    message: 'Lo que escribiste se perderá.',
  });

  async function submit() {
    const name = nombre.trim();
    if (name === '') {
      setErrors({ nombre: 'Escribe un nombre.' });
      AccessibilityInfo.announceForAccessibility?.('Escribe un nombre.');
      nombreRef.current?.focus();
      return;
    }
    let saldoInicial: number | undefined;
    const amount = validateAmountText(saldo);
    if (amount.ok) {
      saldoInicial = enContra && amount.cents !== 0 ? -amount.cents : amount.cents;
    } else if (amount.reason !== 'empty') {
      // Vacío = 0 (docs/001 §5): se omite. Lo ambiguo o fuera de tope se rechaza sin enviar.
      const message =
        amount.reason === 'too-large'
          ? BALANCE_TOO_BIG_ERROR
          : AMOUNT_REJECTION_MESSAGES[amount.reason];
      setErrors({ saldo: message });
      AccessibilityInfo.announceForAccessibility?.(message);
      saldoRef.current?.focus();
      return;
    }
    setErrors({});
    created.current = null;
    uncertain.current = false;
    setLostResponse(false);
    const ok = await mutation.run(async () => {
      try {
        const result = await authorizedCall((token) =>
          api.createAccount(token, {
            nombre: name,
            ...(saldoInicial !== undefined ? { saldoInicial } : {}),
          }),
        );
        created.current = result.account;
      } catch (error) {
        uncertain.current = isUncertainWriteFailure(error);
        throw error;
      }
    });
    if (ok && created.current) onCreated(created.current);
    else if (!ok && uncertain.current) setLostResponse(true);
  }

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => requestLeave()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Nueva cuenta
        </Text>
      </View>

      <Text style={styles.label}>Nombre de la cuenta</Text>
      <FormTextInput
        ref={nombreRef}
        accessibilityLabel="Nombre de la cuenta"
        placeholder="Efectivo, Banco, Tarjeta…"
        value={nombre}
        onChangeText={(text) => {
          setNombre(text);
          setErrors((current) => ({ ...current, nombre: undefined }));
        }}
        editable={!busy}
        error={errors.nombre !== undefined}
      />
      {errors.nombre ? <FieldError message={errors.nombre} /> : null}

      <Text style={styles.label}>Saldo inicial (opcional)</Text>
      <AmountField
        ref={saldoRef}
        accessibilityLabel="Saldo inicial"
        prefix={enContra ? '-$' : '$'}
        value={saldo}
        onChangeText={(text) => {
          setSaldo(text);
          setErrors((current) => ({ ...current, saldo: undefined }));
        }}
        maxLength={BALANCE_MAX_LENGTH}
        editable={!busy}
        error={errors.saldo !== undefined}
      />
      {errors.saldo ? <FieldError message={errors.saldo} /> : null}
      <View style={styles.checkWrap}>
        <CheckboxChip
          label={NEGATIVE_BALANCE_LABEL}
          checked={enContra}
          disabled={busy}
          onChange={setEnContra}
        />
      </View>
      <Text style={styles.help}>
        Es el dinero que ya tienes hoy en esta cuenta. Déjalo vacío si empiezas en 0. Después no se
        puede cambiar; lo demás lo registras con movimientos.
      </Text>

      {lostResponse || mutation.error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {lostResponse ? LOST_RESPONSE_ACCOUNT : mutation.error}
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
  label: { ...typography.brandLabel, color: colors.text, marginTop: 16, marginBottom: 8 },
  checkWrap: { marginTop: 8 },
  help: { ...typography.small, color: colors.text2, marginTop: 8, marginBottom: 16 },
  error: { ...typography.body, color: colors.expenseText, marginBottom: 8 },
});
