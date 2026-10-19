// Hoja «Eliminar mi cuenta y mis datos» (G1; docs/003 Decisión G1, docs/010 §24). Se monta solo
// mientras está abierta (estado, guard y listener de Atrás viven con ella). Cuerpo desplazable y pie
// fijo con el campo de confirmación y los botones. Nunca se abre junto a otro `Modal`.
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useDiscardGuard } from '../hooks/use-discard-guard';
import {
  CONFIRM_WORD,
  DELETE_ALTERNATIVE,
  DELETE_BUSY_LABEL,
  DELETE_CANCELLED_MESSAGE,
  DELETE_CANCEL_LABEL,
  DELETE_CONFIRM_LABEL,
  DELETE_DISCARD_MESSAGE,
  DELETE_DISCARD_TITLE,
  DELETE_FIELD_ACCESSIBILITY,
  DELETE_FIELD_LABEL,
  DELETE_IRREVERSIBLE,
  DELETE_REAUTH_NOTICE,
  DELETE_REAUTH_PROGRESS,
  DELETE_RETRY_LABEL,
  DELETE_SHEET_TITLE,
  DELETE_WILL_KEEP,
  DELETE_WILL_KEEP_TITLE,
  DELETE_WILL_REMOVE,
  DELETE_WILL_REMOVE_TITLE,
  DELETION_WEB_LABEL,
  deleteFailureMessage,
  matchesConfirmation,
} from '../lib/account-deletion-messages';
import { readLegalLinks } from '../lib/config';
import { OPEN_LINK_ERROR, openExternal } from '../lib/external-link';
import { colors, typography } from '../theme/tokens';
import { Sheet } from './sheets';
import { Button, screenStyles as s } from './ui';

// Ventana baja, teclado abierto o fuente muy grande: la hoja usa casi toda la ventana.
const COMPACT_WINDOW_DP = 480;
const COMPACT_FONT_SCALE = 1.75;
const STACKED_FONT_SCALE = 1.3;

export default function DeleteAccountSheet(props: SheetProps & { visible: boolean }) {
  const { visible, ...rest } = props;
  return visible ? <OpenDeleteSheet {...rest} /> : null;
}

interface SheetProps {
  // Cierre real (sin preguntar): lo llama la hoja tras confirmar el descarte o con «Cancelar».
  onClose: () => void;
  // Aviso breve (Snackbar) para el enlace que no se pudo abrir.
  onNotify?: (message: string) => void;
}

function OpenDeleteSheet({ onClose, onNotify }: SheetProps) {
  const { deleteAccount, user } = useAuth();
  const { height, fontScale } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const compact = height < COMPACT_WINDOW_DP || keyboardOpen || fontScale >= COMPACT_FONT_SCALE;
  const stacked = !compact || fontScale >= STACKED_FONT_SCALE;
  // Sin espacio suficiente (teclado o fuente grande) todo el contenido vive dentro del scroll.
  const inline = compact || fontScale >= STACKED_FONT_SCALE;
  const scrollRef = useRef<ScrollView>(null);
  const scrollToEnd = () => scrollRef.current?.scrollToEnd?.({ animated: true });

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // El intento anterior terminó sin certeza: el siguiente comprueba antes de volver a pedir Google.
  const [uncertain, setUncertain] = useState(false);
  const [linkError, setLinkError] = useState(false);
  // Anti doble toque: el ref cierra la ventana antes de que el estado se renderice.
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // En modo integrado, un mensaje nuevo o el teclado llevan el scroll al final (campo y botones).
  useEffect(() => {
    if (inline && (message || busy || keyboardOpen)) scrollToEnd();
  }, [inline, message, busy, keyboardOpen]);

  const { accountDeletionUrl } = readLegalLinks();
  const matches = matchesConfirmation(text);
  const dirty = text !== '';

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Atrás: registrado ANTES que el del guard (que se consulta primero). Sin texto escrito el guard no
  // interviene y la hoja se cierra aquí; con la operación en curso se ignora.
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
    title: DELETE_DISCARD_TITLE,
    message: DELETE_DISCARD_MESSAGE,
  });

  async function submit() {
    if (submitting.current || !matches) return;
    submitting.current = true;
    Keyboard.dismiss();
    setBusy(true);
    setMessage(null);
    let failure: { reason: Parameters<typeof deleteFailureMessage>[0]; uncertain: boolean } | null =
      null;
    let cancelled = false;
    try {
      const result = await deleteAccount(uncertain ? { afterUncertain: true } : undefined);
      if (result.status === 'cancelled') cancelled = true;
      else if (result.status === 'failed') {
        failure = { reason: result.reason, uncertain: result.uncertain };
      }
      // 'deleted' y 'session-expired': el servicio ya llevó a la app al Login.
    } catch {
      // El servicio no lanza; si lo hiciera no se sabe qué pasó.
      failure = { reason: 'unknown', uncertain: true };
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
    if (!mounted.current) return;
    if (cancelled) {
      setUncertain(false);
      setMessage(DELETE_CANCELLED_MESSAGE);
    } else if (failure) {
      // El servicio conserva `uncertain` en modo afterUncertain cuando el fallo es transitorio.
      setUncertain(failure.uncertain);
      setMessage(deleteFailureMessage(failure.reason, failure.uncertain, user?.email));
    }
  }

  async function openDeletionPage() {
    if (!accountDeletionUrl) return;
    setLinkError(false);
    const ok = await openExternal(accountDeletionUrl);
    if (ok) return;
    setLinkError(true);
    onNotify?.(OPEN_LINK_ERROR);
  }

  const confirmButton = (
    <Button
      label={busy ? DELETE_BUSY_LABEL : uncertain ? DELETE_RETRY_LABEL : DELETE_CONFIRM_LABEL}
      accessibilityLabel={uncertain && !busy ? DELETE_RETRY_LABEL : DELETE_CONFIRM_LABEL}
      variant="dangerSolid"
      tall={!compact}
      busy={busy}
      disabled={!matches}
      onPress={() => void submit()}
    />
  );
  const cancelButton = (
    <Button
      label={DELETE_CANCEL_LABEL}
      variant="ghost"
      disabled={busy}
      onPress={() => requestLeave()}
    />
  );

  const title = (
    <Text accessibilityRole="header" style={styles.title}>
      {DELETE_SHEET_TITLE}
    </Text>
  );
  const body = (
    <>
      <Text style={styles.strong}>{DELETE_IRREVERSIBLE}</Text>
      <Text style={styles.heading}>{DELETE_WILL_REMOVE_TITLE}</Text>
      <Text style={styles.body}>{DELETE_WILL_REMOVE}</Text>
      <Text style={styles.heading}>{DELETE_WILL_KEEP_TITLE}</Text>
      <Text style={styles.body}>{DELETE_WILL_KEEP}</Text>
      <Text style={styles.body}>{DELETE_ALTERNATIVE}</Text>
      <Text style={styles.body}>{DELETE_REAUTH_NOTICE}</Text>
      {accountDeletionUrl ? (
        <Button
          label={DELETION_WEB_LABEL}
          variant="link"
          disabled={busy}
          onPress={() => void openDeletionPage()}
        />
      ) : null}
      {linkError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {OPEN_LINK_ERROR}
        </Text>
      ) : null}
    </>
  );
  const footerContent = (
    <>
      <Text style={styles.label}>{DELETE_FIELD_LABEL}</Text>
      <TextInput
        accessibilityLabel={DELETE_FIELD_ACCESSIBILITY}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={colors.text2}
        value={text}
        onChangeText={setText}
        onFocus={inline ? () => setTimeout(scrollToEnd, 50) : undefined}
        editable={!busy}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        spellCheck={false}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
        style={s.input}
      />
      {busy ? (
        <Text accessibilityRole="alert" style={styles.progress}>
          {DELETE_REAUTH_PROGRESS}
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      ) : null}
      {stacked ? (
        <>
          {confirmButton}
          {cancelButton}
        </>
      ) : (
        <View style={styles.footerRow}>
          <View style={styles.flex}>{cancelButton}</View>
          <View style={styles.flex}>{confirmButton}</View>
        </View>
      )}
    </>
  );

  return (
    <Sheet
      visible
      onClose={() => requestLeave()}
      accessibilityLabel={DELETE_SHEET_TITLE}
      testID="delete-account-sheet"
      tall
      compact={compact}
    >
      {inline ? null : title}
      <ScrollView
        ref={scrollRef}
        testID="delete-account-scroll"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {inline ? title : null}
        {body}
        {inline ? (
          <View testID="delete-account-inline-footer" style={styles.inlineFooter}>
            {footerContent}
          </View>
        ) : null}
      </ScrollView>
      {inline ? null : (
        <View testID="delete-account-footer" style={styles.footer}>
          {footerContent}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text },
  scroll: { flexShrink: 1 },
  scrollContent: { gap: 8, paddingBottom: 8 },
  strong: { ...typography.body, fontWeight: '800', color: colors.expenseText },
  heading: { ...typography.body, fontWeight: '800', color: colors.text },
  body: { ...typography.body, color: colors.text },
  label: { ...typography.body, fontWeight: '700', color: colors.text },
  error: { ...typography.small, fontWeight: '700', color: colors.expenseText },
  progress: { ...typography.small, fontWeight: '700', color: colors.text2 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  inlineFooter: { paddingTop: 12, gap: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
