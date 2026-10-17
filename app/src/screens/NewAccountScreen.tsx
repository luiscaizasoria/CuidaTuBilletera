// Crear cuenta (R3; docs/007 §5.3 y §5.5.1, docs/008 §6.13). Sin barra de contexto. Atrás y «‹»
// piden confirmar solo si hay algo escrito; mientras se guarda se ignoran.
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import { useGuide, useGuides } from '../hooks/use-guides';
import { useMutation } from '../hooks/use-loader';
import {
  buildCreateAppearance,
  DEFAULT_APPEARANCE,
  isAppearanceRejection,
  type AppearanceDraft,
} from '../lib/account-appearance';
import { isAccountFormDirty } from '../lib/form-dirty';
import { AMOUNT_REJECTION_MESSAGES, validateAmountText } from '../lib/money';
import type { Account, AccountInput, ResourcesApi } from '../lib/resources-api';
import {
  APPEARANCE_SAVE_ERROR,
  isUncertainWriteFailure,
  LOST_RESPONSE_ACCOUNT,
} from '../lib/resources-messages';
import { colors, typography } from '../theme/tokens';
import { AppearancePicker } from './account-appearance';
import { AmountField, CheckboxChip, FieldError, FormTextInput } from './form-ui';
import { Button, Card, GuideCard } from './ui';

export const BALANCE_TOO_BIG_ERROR = 'El saldo inicial es demasiado grande. Revisa la cifra.';
export const NEGATIVE_BALANCE_LABEL = 'Es un saldo en contra (debo dinero)';
// El campo conserva lo pegado (con margen para separadores) y la validación lo rechaza al guardar.
const BALANCE_MAX_LENGTH = 24;
// Relleno de la tarjeta de Apariencia: define el ancho útil de la rejilla (5 columnas a 360 dp).
const APPEARANCE_CARD_PADDING = 16;

export default function NewAccountScreen({
  api,
  onBack,
  onCreated,
  appearanceSupported = false,
  onAppearanceRejected,
}: {
  api: ResourcesApi;
  onBack: () => void;
  onCreated: (account: Account) => void;
  // La API soporta color e ícono (se detecta en el navegador). Sin soporte el bloque no se muestra
  // y el cuerpo no lleva esos campos.
  appearanceSupported?: boolean;
  // La API rechazó la apariencia (400): el navegador deja de ofrecerla.
  onAppearanceRejected?: () => void;
}) {
  const { authorizedCall } = useAuth();
  const { dismiss } = useGuides();
  const { guide, dismissGuide } = useGuide(['cuenta-crear'], true);
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState('');
  const [enContra, setEnContra] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceDraft>(DEFAULT_APPEARANCE);
  const [appearanceRejected, setAppearanceRejected] = useState(false);
  const showAppearance = appearanceSupported && !appearanceRejected;
  const [errors, setErrors] = useState<{ nombre?: string; saldo?: string }>({});
  const mutation = useMutation();
  const busy = mutation.pending;
  const nombreRef = useRef<TextInput>(null);
  const saldoRef = useRef<TextInput>(null);
  const created = useRef<Account | null>(null);
  const uncertain = useRef(false);
  const [lostResponse, setLostResponse] = useState(false);
  const [appearanceFailed, setAppearanceFailed] = useState(false);

  const { requestLeave } = useDiscardGuard({
    dirty: isAccountFormDirty({
      nombre,
      saldo,
      enContra,
      ...(showAppearance ? { appearance } : {}),
    }),
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
    // Sin soporte el cuerpo no lleva color ni ícono (ni undefined ni null).
    const body: AccountInput = {
      nombre: name,
      ...(saldoInicial !== undefined ? { saldoInicial } : {}),
      ...(showAppearance ? buildCreateAppearance(appearance) : {}),
    };
    setAppearanceFailed(false);
    const ok = await mutation.run(async () => {
      try {
        const result = await authorizedCall((token) => api.createAccount(token, body));
        created.current = result.account;
      } catch (error) {
        if (isAppearanceRejection(error, body)) {
          // 400 con apariencia: sin reintento automático; se oculta el bloque y se avisa.
          setAppearanceRejected(true);
          setAppearanceFailed(true);
          onAppearanceRejected?.();
        }
        uncertain.current = isUncertainWriteFailure(error);
        throw error;
      }
    });
    if (ok && created.current) {
      // Completar la acción también descarta las ayudas de crear la primera cuenta.
      dismiss(['cuentas-vacio', 'cuenta-crear']);
      onCreated(created.current);
    } else if (!ok && uncertain.current) setLostResponse(true);
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

      {guide ? <GuideCard guide={guide} onDismiss={dismissGuide} /> : null}

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

      {showAppearance ? (
        <Card style={styles.appearanceCard}>
          <AppearancePicker
            nombre={nombre}
            draft={appearance}
            onChange={(patch) => setAppearance((current) => ({ ...current, ...patch }))}
            busy={busy}
            accountId={null}
            inset={APPEARANCE_CARD_PADDING}
          />
        </Card>
      ) : null}

      {lostResponse || mutation.error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {lostResponse
            ? LOST_RESPONSE_ACCOUNT
            : appearanceFailed
              ? APPEARANCE_SAVE_ERROR
              : mutation.error}
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
  appearanceCard: { padding: APPEARANCE_CARD_PADDING, marginBottom: 8 },
  checkWrap: { marginTop: 8 },
  help: { ...typography.small, color: colors.text2, marginTop: 8, marginBottom: 16 },
  error: { ...typography.body, color: colors.expenseText, marginTop: 8, marginBottom: 8 },
});
