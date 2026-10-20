// Hoja «Eliminar mi cuenta y mis datos» (G1; docs/003 Decisión G1, docs/010 §24). Se monta solo
// mientras está abierta (estado, guard y listener de Atrás viven con ella). Cuerpo desplazable y pie
// fijo con el campo de confirmación y los botones. Nunca se abre junto a otro `Modal`.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  type LayoutChangeEvent,
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
  DELETE_UNCERTAIN_MESSAGE,
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

// Ventana baja, teclado abierto o fuente muy grande: la hoja usa casi toda la ventana. Esto solo
// cambia estilos (altura máxima, botón alto, botones apilados); nunca el padre del campo.
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
  // REGLA: el campo de confirmación no debe cambiar de padre mientras se escribe. Abrir el teclado
  // reduce la ventana y activa `compact`; si `inline` dependiera de eso, el TextInput se desmontaría
  // al enfocarlo, perdería el foco y Android cerraría el teclado de inmediato. Por eso `inline` solo
  // depende de la fuente del sistema, estable durante la sesión de escritura. Con fuente grande todo
  // el contenido vive dentro del scroll; si no, el pie fijo (fuera del scroll) queda visible.
  const inline = fontScale >= STACKED_FONT_SCALE;
  const scrollRef = useRef<ScrollView>(null);
  // Posiciones medidas (onLayout) dentro del contenido del scroll: inicio del bloque del pie integrado
  // y de su mensaje (la `y` del mensaje es relativa al pie, que la suma).
  const footerY = useRef(0);
  const scrollToY = useCallback((y: number) => {
    scrollRef.current?.scrollTo?.({ y: Math.max(0, y), animated: true });
  }, []);
  const onFooterLayout = (event: LayoutChangeEvent) => {
    footerY.current = event.nativeEvent.layout.y;
  };
  // Etiqueta y campo arriba de la zona visible; se espera a que termine el diseño con el teclado.
  const scrollToField = useCallback(() => {
    const frame = requestAnimationFrame(() => scrollToY(footerY.current));
    return () => cancelAnimationFrame(frame);
  }, [scrollToY]);
  // El progreso o el mensaje nuevo se miden al montarse y el scroll lleva su inicio a la vista.
  const onStatusLayout = (event: LayoutChangeEvent) => {
    if (!inline) return;
    const y = footerY.current + event.nativeEvent.layout.y;
    requestAnimationFrame(() => scrollToY(y));
  };

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

  // Solo en modo integrado (fuente grande) el campo sube al abrirse el teclado (keyboardDidShow, tras
  // su animación); en modo fijo el pie ya queda visible. No cambia el árbol: solo hace scroll.
  useEffect(() => {
    if (inline && keyboardOpen) return scrollToField();
    return undefined;
  }, [inline, keyboardOpen, scrollToField]);

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
    const wasUncertain = uncertain;
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
      // Tras un intento incierto, cancelar el selector no aclara si el envío anterior borró la cuenta.
      setUncertain(wasUncertain);
      setMessage(wasUncertain ? DELETE_UNCERTAIN_MESSAGE : DELETE_CANCELLED_MESSAGE);
    } else if (failure) {
      // La marca solo se limpia con un resultado cierto tras el sondeo; un fallo previo al envío
      // (timeout del selector, red) no la limpia si el intento anterior era incierto.
      const stillUncertain = failure.uncertain || wasUncertain;
      setUncertain(stillUncertain);
      setMessage(deleteFailureMessage(failure.reason, stillUncertain, user?.email));
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
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
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
        onFocus={inline ? () => void scrollToField() : undefined}
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
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onLayout={onStatusLayout}
          style={styles.progress}
        >
          {DELETE_REAUTH_PROGRESS}
        </Text>
      ) : null}
      {message ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          onLayout={onStatusLayout}
          style={styles.error}
        >
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
          <View
            testID="delete-account-inline-footer"
            onLayout={onFooterLayout}
            style={styles.inlineFooter}
          >
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
