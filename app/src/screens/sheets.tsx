// Hojas inferiores con `Modal` de React Native (docs/003, Decisión R2 D1): Atrás o tocar fuera las
// cierran antes que cualquier otra navegación.
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader } from '../hooks/use-loader';
import { accountColors, accountIcon, avatarInitial } from '../lib/accounts';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { colors, depth, radii, shadows, tabularNums, typography } from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';
import { balanceText } from './account-ui';
import { Button } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

export function Sheet({
  visible,
  onClose,
  accessibilityLabel,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSystemInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((reduce) => {
        if (!cancelled && reduce === true) setReduceMotion(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.root}>
        <Pressable
          testID="sheet-scrim"
          importantForAccessibility="no"
          accessibilityElementsHidden
          onPress={onClose}
          style={styles.scrim}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[styles.sheet, shadows.raised, { paddingBottom: 24 + insets.bottom }]}
        >
          <View style={styles.handle} {...hidden} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

// Hoja de perfil (docs/007 14.17 a): nombre, correo y «Cerrar sesión» sin confirmación.
export function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Tu perfil y sesión"
      testID="profile-sheet"
    >
      <View style={styles.profileHead}>
        <View style={styles.profileAvatar} {...hidden}>
          <Text style={styles.profileInitial}>{avatarInitial(user?.name, user?.email)}</Text>
        </View>
        <View style={styles.flex}>
          {user?.name ? <Text style={styles.profileName}>{user.name}</Text> : null}
          {user ? <Text style={styles.small}>{user.email}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Cerrar sesión" variant="secondary" onPress={() => void signOut()} />
        <Button label="Cerrar" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// Selector rápido de cuenta (docs/003, Decisión R0 D11): solo cuentas activas, cargadas al abrir.
export function AccountSwitcherSheet({
  visible,
  onClose,
  api,
  currentId,
  onSelect,
  onSeeAll,
}: {
  visible: boolean;
  onClose: () => void;
  api: ResourcesApi;
  // null si la cuenta activa está archivada: no se marca ninguna.
  currentId: string | null;
  onSelect: (account: Account) => void;
  onSeeAll: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Cambiar de cuenta"
      testID="account-switcher"
    >
      <Text accessibilityRole="header" style={styles.title}>
        Cambiar de cuenta
      </Text>
      {visible ? <SwitcherList api={api} currentId={currentId} onSelect={onSelect} /> : null}
      <Button label="Ver todas mis cuentas" variant="link" onPress={onSeeAll} />
    </Sheet>
  );
}

function SwitcherList({
  api,
  currentId,
  onSelect,
}: {
  api: ResourcesApi;
  currentId: string | null;
  onSelect: (account: Account) => void;
}) {
  const { authorizedCall } = useAuth();
  const { state, reload } = useLoader(
    () => authorizedCall((token) => api.listAccounts(token, { pageSize: 100 })),
    'switcher',
  );
  if (state.status === 'loading') {
    return (
      <View style={styles.status}>
        <ActivityIndicator size="small" color={colors.text2} />
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          Cargando tus cuentas…
        </Text>
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.status}>
        <Text accessibilityRole="alert" style={styles.error}>
          No pudimos cargar tus cuentas.
        </Text>
        <Button label="Reintentar" variant="primary" onPress={reload} />
      </View>
    );
  }
  const accounts = state.data.items.filter((account) => !account.archivada);
  return (
    <View accessibilityRole="radiogroup" style={styles.list}>
      {accounts.map((account) => {
        const selected = account.id === currentId;
        const saldo = balanceText(account.saldo) ?? 'no disponible';
        return (
          <Pressable
            key={account.id}
            accessibilityRole="radio"
            accessibilityLabel={`${account.nombre}, saldo ${saldo}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(account)}
            style={styles.row}
          >
            <View
              style={[styles.rowTile, { backgroundColor: accountColors(account.id).tile }]}
              {...hidden}
            >
              <Text>{accountIcon(account.nombre)}</Text>
            </View>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.rowName}>
              {account.nombre}
            </Text>
            <Text style={[styles.rowBalance, tabularNums, account.saldo < 0 && styles.negative]}>
              {saldo}
            </Text>
            {selected ? (
              <Text testID="switcher-check" style={styles.check} {...hidden}>
                ✓
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: depth.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: { ...typography.h2, color: colors.text },
  small: { ...typography.small, color: colors.text2 },
  error: { ...typography.body, color: colors.expenseText, textAlign: 'center' },
  negative: { color: colors.expenseText },
  actions: { gap: 8 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1.5,
    borderColor: colors.yellowBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: 20, fontWeight: '800', color: colors.text },
  profileName: { fontSize: 17, fontWeight: '800', color: colors.text },
  status: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  list: { gap: 4 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.md,
  },
  rowTile: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.segBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  rowBalance: { fontSize: 14, fontWeight: '800', color: colors.text },
  check: { fontSize: 16, fontWeight: '800', color: colors.brand700 },
});
