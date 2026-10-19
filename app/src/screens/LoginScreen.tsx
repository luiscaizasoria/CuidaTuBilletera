// Login (R5.1; docs/007 §5.13 A y B, docs/008 §6.15.1 y §6.15.2). El flujo de Google Sign-In no cambia:
// solo la presentación. Pinta bajo la barra de estado (el App no lo envuelve en `Screen`).
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { PRIVACY_POLICY_HINT, PRIVACY_POLICY_LABEL } from '../lib/account-deletion-messages';
import {
  AUTH_ERROR_MESSAGES,
  LOGOUT_NOTICE_MESSAGES,
  SIGNED_OUT_MESSAGES,
} from '../lib/auth-messages';
import { readLegalLinks } from '../lib/config';
import { OPEN_LINK_ERROR, openExternal } from '../lib/external-link';
import {
  brandGoogle,
  colors,
  depth,
  radii,
  screenMargin,
  shadows,
  sizes,
  typography,
} from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

/* eslint-disable @typescript-eslint/no-require-imports */
// Metro elige la densidad (google-g.png, @2x, @3x, @4x) a partir del nombre base.
const GOOGLE_G = require('../../assets/brand/google-g.png');
const PIGGY = require('../../assets/illustrations/vacio-alcancia.png');
/* eslint-enable @typescript-eslint/no-require-imports */

export const LOGIN_MESSAGE = 'Anota lo que entra y lo que sale, y mira cómo está tu dinero.';
export const LOGIN_PRIVACY =
  'Usamos tu cuenta de Google solo para identificarte. No vemos tu contraseña.';
export const GOOGLE_LABEL = 'Continuar con Google';
export const GOOGLE_BUSY_LABEL = 'Ingresando…';

// Tamaños de las manchas (docs/008 §6.15.1).
const BLOB_SIZES = [220, 170, 190] as const;
const COMPACT_HEIGHT_DP = 600;

export default function LoginScreen() {
  const { busy, error, notice, signedOutReason, signIn } = useAuth();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSystemInsets();
  const compact = height < COMPACT_HEIGHT_DP || fontScale >= 1.5;
  // Con fuente muy ampliada se oculta la marca para que el botón siga a mano.
  const showMark = fontScale < 1.75;
  const blobScale = compact ? 0.75 : 1;
  // Prioridad: error > aviso > motivo de cierre; el motivo solo aparece si nada es más específico.
  const deleted = signedOutReason === 'account-deleted';
  const signedOutMessage =
    !error && !notice && signedOutReason && !deleted ? SIGNED_OUT_MESSAGES[signedOutReason] : null;
  const { privacyPolicyUrl } = readLegalLinks();
  const [linkError, setLinkError] = useState(false);

  async function openPolicy() {
    if (!privacyPolicyUrl) return;
    setLinkError(false);
    if (!(await openExternal(privacyPolicyUrl))) setLinkError(true);
  }
  const markSize = compact ? 120 : sizes.loginMark;
  const pigSize = compact ? 96 : sizes.loginPig;

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        {...hidden}
        style={[
          styles.blob,
          {
            width: BLOB_SIZES[0] * blobScale,
            height: BLOB_SIZES[0] * blobScale,
            top: -60,
            right: -70,
            backgroundColor: depth.blobs[0].color,
            opacity: depth.blobs[0].opacity,
          },
        ]}
      />
      <View
        pointerEvents="none"
        {...hidden}
        style={[
          styles.blob,
          {
            width: BLOB_SIZES[1] * blobScale,
            height: BLOB_SIZES[1] * blobScale,
            bottom: -50,
            left: -60,
            backgroundColor: depth.blobs[1].color,
            opacity: depth.blobs[1].opacity,
          },
        ]}
      />
      <View
        pointerEvents="none"
        {...hidden}
        style={[
          styles.blob,
          {
            width: BLOB_SIZES[2] * blobScale,
            height: BLOB_SIZES[2] * blobScale,
            top: '45%',
            right: -90,
            backgroundColor: depth.blobs[2].color,
            opacity: depth.blobs[2].opacity,
          },
        ]}
      />

      <ScrollView
        testID="login-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: screenMargin(width) + 8,
          },
        ]}
      >
        <View style={styles.column}>
          {showMark ? (
            <View
              testID="login-mark"
              {...hidden}
              style={[
                styles.mark,
                { width: markSize, height: markSize, borderRadius: markSize / 2 },
                { marginBottom: compact ? 12 : 16 },
              ]}
            >
              <Image
                source={PIGGY}
                accessible={false}
                resizeMode="contain"
                style={{ width: pigSize, height: pigSize }}
              />
            </View>
          ) : null}

          <Text accessibilityRole="header" style={styles.title}>
            CuidaTuBilletera
          </Text>
          <View {...hidden} style={styles.underline} />
          <Text style={styles.message}>{LOGIN_MESSAGE}</Text>

          {notice ? <Banner kind="notice" message={LOGOUT_NOTICE_MESSAGES[notice]} /> : null}
          {deleted ? (
            <Banner kind="success" message={SIGNED_OUT_MESSAGES['account-deleted']!} />
          ) : null}
          {signedOutMessage ? <Banner kind="notice" message={signedOutMessage} /> : null}
          {error ? <Banner kind="error" message={AUTH_ERROR_MESSAGES[error]} /> : null}

          <GoogleButton busy={busy} onPress={() => void signIn()} />
          <Text style={styles.privacy}>{LOGIN_PRIVACY}</Text>
          {privacyPolicyUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={PRIVACY_POLICY_LABEL}
              accessibilityHint={PRIVACY_POLICY_HINT}
              onPress={() => void openPolicy()}
              style={styles.policyLink}
            >
              <Text style={styles.policyText}>{PRIVACY_POLICY_LABEL}</Text>
            </Pressable>
          ) : null}
          {linkError ? (
            <Text accessibilityRole="alert" style={styles.linkError}>
              {OPEN_LINK_ERROR}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// Caja de aviso, error o éxito sobre el botón; el «⚠» / «✓» es decorativo y está oculto.
function Banner({ kind, message }: { kind: 'error' | 'notice' | 'success'; message: string }) {
  const tone =
    kind === 'error'
      ? { bg: colors.expenseSoft, fg: colors.expenseText, glyph: '⚠' }
      : kind === 'success'
        ? { bg: colors.incomeSoft, fg: colors.incomeText, glyph: '✓' }
        : { bg: colors.yellowSoft, fg: colors.yellowText, glyph: '⚠' };
  return (
    <View style={[styles.banner, { backgroundColor: tone.bg }]}>
      <Text {...hidden} style={[styles.bannerText, { color: tone.fg }]}>
        {tone.glyph}
      </Text>
      <Text
        accessibilityRole="alert"
        style={[styles.bannerText, styles.bannerMessage, { color: tone.fg }]}
      >
        {message}
      </Text>
    </View>
  );
}

// Botón claro de la guía de marca de Google (única excepción cromática a los tokens del proyecto).
function GoogleButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const label = busy ? GOOGLE_BUSY_LABEL : GOOGLE_LABEL;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.googleButton,
        shadows.card,
        pressed && styles.googlePressed,
        busy && styles.googleBusy,
      ]}
    >
      {busy ? (
        <ActivityIndicator size={sizes.googleLogo} color={colors.brand700} testID="login-loading" />
      ) : (
        <Image
          testID="google-logo"
          source={GOOGLE_G}
          resizeMode="contain"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={styles.googleLogo}
        />
      )}
      <Text style={styles.googleText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: colors.bg },
  blob: { position: 'absolute', borderRadius: 999 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  column: { width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center' },
  mark: { backgroundColor: colors.yellowSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.rootTitle, color: colors.brandInk, textAlign: 'center' },
  underline: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.yellow,
    marginTop: 8,
  },
  message: { ...typography.body, color: colors.text2, textAlign: 'center', marginTop: 12 },
  banner: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    padding: 12,
    borderRadius: radii.md,
    marginTop: 16,
  },
  bannerText: { ...typography.small, fontWeight: '700' },
  bannerMessage: { flexShrink: 1, flex: 1 },
  googleButton: {
    width: '100%',
    minHeight: sizes.primaryTall,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: brandGoogle.border,
    backgroundColor: brandGoogle.bg,
    marginTop: 24,
  },
  googlePressed: { backgroundColor: brandGoogle.pressed },
  googleBusy: { opacity: 0.6 },
  googleLogo: { width: sizes.googleLogo, height: sizes.googleLogo },
  googleText: {
    ...typography.button,
    fontWeight: '600',
    color: brandGoogle.text,
    flexShrink: 1,
    textAlign: 'center',
  },
  policyLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  policyText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.brandInk,
    textDecorationLine: 'underline',
  },
  linkError: { ...typography.small, color: colors.expenseText, textAlign: 'center' },
  privacy: { ...typography.small, color: colors.text2, textAlign: 'center', marginTop: 12 },
});
