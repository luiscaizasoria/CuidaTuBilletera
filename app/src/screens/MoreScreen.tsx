// Pestaña Más del Detalle (docs/007 §5.9): datos de la cuenta, categorías, exportar, sesión y
// opciones avanzadas (archivar). Sin eliminar cuenta ni conciliar.
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useGuides } from '../hooks/use-guides';
import { useMutation } from '../hooks/use-loader';
import {
  appearanceOf,
  buildAppearancePatch,
  isAppearanceRejection,
  type AppearanceDraft,
} from '../lib/account-appearance';
import { AuthError } from '../lib/auth-types';
import { APPEARANCE_SAVE_ERROR } from '../lib/resources-messages';
import type { Account, AccountPatch, ResourcesApi } from '../lib/resources-api';
import { colors, moduleColors, radii, shadows, typography } from '../theme/tokens';
import { AppearancePicker } from './account-appearance';
import { ArchivedNotice } from './account-ui';
import SessionBanner from './SessionBanner';
import { SignOutControl } from './session-ui';
import { Button, ErrorBox, screenStyles as s, useScreenMargin } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

export const HELP_RESET_DONE = 'Listo. Verás las ayudas otra vez.';
export const HELP_RESET_ERROR = 'No pudimos restablecer las ayudas. Inténtalo de nuevo.';

export default function MoreScreen({
  api,
  account,
  onAccountUpdated,
  onArchived,
  onOpenCategories,
  onOpenExport,
  onNotify,
  bottomInset = 0,
  appearanceSupported = false,
  onAppearanceRejected,
}: {
  api: ResourcesApi;
  account: Account;
  onAccountUpdated: (account: Account) => void;
  onArchived: (account: Account) => void;
  onOpenCategories: () => void;
  onOpenExport: () => void;
  // Aviso breve (Snackbar del navegador).
  onNotify?: (message: string) => void;
  bottomInset?: number;
  // La API soporta color e ícono (se detecta en el navegador). Sin soporte el bloque no se muestra
  // y el PATCH no lleva esos campos.
  appearanceSupported?: boolean;
  // La API rechazó la apariencia (400): el navegador deja de ofrecerla.
  onAppearanceRejected?: () => void;
}) {
  const { authorizedCall, user } = useAuth();
  const margin = useScreenMargin();
  const { resetAll } = useGuides();
  const resettingHelp = useRef(false);
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpError, setHelpError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(account.nombre);
  const [nameError, setNameError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<AppearanceDraft>(() => appearanceOf(account));
  const [appearanceRejected, setAppearanceRejected] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const showAppearance = appearanceSupported && !appearanceRejected;
  const [advanced, setAdvanced] = useState(false);
  const rename = useMutation();
  const archive = useMutation();
  const result = useRef<Account | null>(null);

  function toggleEditing() {
    setEditing((open) => !open);
    setNombre(account.nombre);
    setAppearance(appearanceOf(account));
    setNameError(null);
    setSaveError(null);
    rename.clearError();
  }

  async function saveName() {
    const name = nombre.trim();
    if (name === '') {
      setNameError('Escribe un nombre.');
      return;
    }
    setNameError(null);
    setSaveError(null);
    // Solo las diferencias; sin apariencia soportada el PATCH no lleva color ni ícono.
    const patch: AccountPatch = {
      ...(name !== account.nombre ? { nombre: name } : {}),
      ...(showAppearance ? buildAppearancePatch(account, appearance) : {}),
    };
    if (Object.keys(patch).length === 0) {
      // Sin cambios: no hay petición ni aviso; solo se pliega el editor.
      setEditing(false);
      rename.clearError();
      return;
    }
    result.current = null;
    const ok = await rename.run(async () => {
      try {
        result.current = await authorizedCall((token) =>
          api.updateAccount(token, account.id, patch),
        );
      } catch (error) {
        if (isAppearanceRejection(error, patch)) {
          // 400 con apariencia: sin reintento automático; se oculta el bloque y se avisa.
          setAppearanceRejected(true);
          setSaveError(APPEARANCE_SAVE_ERROR);
          onAppearanceRejected?.();
        } else if (
          showAppearance &&
          error instanceof AuthError &&
          (error.kind === 'network' || error.kind === 'server')
        ) {
          setSaveError(APPEARANCE_SAVE_ERROR);
        }
        throw error;
      }
    });
    if (ok && result.current) {
      setEditing(false);
      onAccountUpdated(result.current);
    }
  }

  async function doArchive() {
    result.current = null;
    const ok = await archive.run(async () => {
      result.current = await authorizedCall((token) =>
        api.updateAccount(token, account.id, { archivada: true }),
      );
    });
    if (ok && result.current) onArchived(result.current);
  }

  function confirmArchive() {
    Alert.alert(
      'Archivar cuenta',
      `¿Archivar «${account.nombre}»? Dejará de aparecer en tu lista y no podrás anotarle movimientos. Podrás desarchivarla cuando quieras.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: () => void doArchive() },
      ],
    );
  }

  // «Ver ayudas otra vez»: sin confirmación (reversible, no toca datos). Un solo guardado a la vez.
  async function showHelpAgain() {
    if (resettingHelp.current) return;
    resettingHelp.current = true;
    setHelpBusy(true);
    setHelpError(false);
    const ok = await resetAll();
    resettingHelp.current = false;
    setHelpBusy(false);
    if (ok) onNotify?.(HELP_RESET_DONE);
    else setHelpError(true);
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { padding: margin, paddingBottom: margin + bottomInset },
      ]}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Más
      </Text>
      {account.archivada ? <ArchivedNotice /> : null}
      <SessionBanner />

      <Text accessibilityRole="header" style={styles.sectionHeader}>
        CUENTA
      </Text>
      <View style={[styles.list, shadows.card]}>
        <Row
          icon="✏️"
          title="Datos de cuenta"
          subtitle="Nombre de la cuenta"
          expanded={editing}
          onPress={toggleEditing}
        />
        {editing ? (
          <View style={styles.editor}>
            <Text style={styles.label}>Nombre de la cuenta</Text>
            <TextInput
              accessibilityLabel="Nombre de la cuenta"
              value={nombre}
              onChangeText={setNombre}
              editable={!rename.pending}
              style={s.input}
            />
            <Text style={styles.small}>
              El saldo inicial no se puede cambiar. Si el saldo no coincide, anota un movimiento.
            </Text>
            {nameError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {nameError}
              </Text>
            ) : null}
            {showAppearance ? (
              <AppearancePicker
                nombre={nombre}
                draft={appearance}
                onChange={(patch) => setAppearance((current) => ({ ...current, ...patch }))}
                busy={rename.pending}
                accountId={account.id}
                inset={16}
              />
            ) : null}
            {saveError || rename.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {saveError ?? rename.error}
              </Text>
            ) : null}
            <Button
              label="Guardar cambios"
              variant="primary"
              busy={rename.pending}
              onPress={() => void saveName()}
            />
          </View>
        ) : null}
        <Row icon="🏷️" title="Categorías" onPress={onOpenCategories} />
        <Row icon="📤" title="Exportar" onPress={onOpenExport} last />
      </View>

      <Text accessibilityRole="header" style={styles.sectionHeader}>
        AYUDA
      </Text>
      <View style={[styles.list, shadows.card]}>
        <Row
          icon="💡"
          title="Ver ayudas otra vez"
          subtitle="Vuelve a mostrar las guías que cerraste."
          busy={helpBusy}
          tall
          last
          onPress={() => void showHelpAgain()}
        />
      </View>
      {helpError ? <ErrorBox message={HELP_RESET_ERROR} /> : null}

      <Text accessibilityRole="header" style={styles.sectionHeader}>
        SESIÓN
      </Text>
      <View style={[styles.list, styles.session, shadows.card]}>
        <Text style={styles.small}>Conectado como</Text>
        {user ? <Text style={styles.email}>{user.email}</Text> : null}
        <SignOutControl variant="button" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Opciones avanzadas"
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced((open) => !open)}
        style={styles.advancedToggle}
      >
        <Text style={styles.advancedText}>{advanced ? '▾' : '▸'} Opciones avanzadas</Text>
      </Pressable>
      {advanced ? (
        account.archivada ? (
          <Text style={styles.body}>
            Esta cuenta ya está archivada. Puedes desarchivarla desde Mis cuentas.
          </Text>
        ) : (
          <View style={[styles.list, styles.session, shadows.card]}>
            <Text style={styles.rowTitle}>Archivar esta cuenta</Text>
            <Text style={styles.small}>
              La cuenta deja de aparecer en tu lista y no admite movimientos nuevos. Su historial se
              conserva y puedes desarchivarla.
            </Text>
            {archive.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {archive.error}
              </Text>
            ) : null}
            <Button
              label="Archivar cuenta"
              variant="danger"
              busy={archive.pending}
              onPress={confirmArchive}
            />
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  subtitle,
  expanded,
  onPress,
  last = false,
  busy = false,
  tall = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  expanded?: boolean;
  onPress: () => void;
  last?: boolean;
  // Operación en curso: fila deshabilitada con indicador en lugar del chevron.
  busy?: boolean;
  // Fila de 56 dp (Ayuda); con fuente ≥ 175 % oculta el mosaico del glifo.
  tall?: boolean;
}) {
  const expandable = expanded !== undefined;
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={busy ? { disabled: true, busy: true } : expandable ? { expanded } : {}}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        tall && styles.rowTall,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      {tall && fontScale >= 1.75 ? null : (
        <View style={styles.tile} {...hidden}>
          <Text>{icon}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.small}>{subtitle}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.text2} testID="row-busy" />
      ) : (
        <Text style={styles.chevron} {...hidden}>
          {expandable && expanded ? '▾' : '›'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  flex: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  sectionHeader: { ...typography.small, fontWeight: '800', color: colors.text2, marginTop: 12 },
  list: { backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: 16 },
  session: { paddingVertical: 12, gap: 8 },
  row: { minHeight: 48, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTall: { minHeight: 56 },
  rowPressed: { opacity: 0.85 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: moduleColors.mas.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 18, fontWeight: '800', color: colors.text2 },
  editor: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.body, fontWeight: '700', color: colors.text },
  small: { ...typography.small, color: colors.text2 },
  body: { ...typography.body, color: colors.text },
  email: { ...typography.body, fontWeight: '700', color: colors.text },
  error: { ...typography.body, color: colors.expenseText },
  advancedToggle: { minHeight: 48, justifyContent: 'center', marginTop: 12 },
  advancedText: { ...typography.button, color: colors.text },
});
