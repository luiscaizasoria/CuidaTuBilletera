// Mis cuentas: pantalla inicial autenticada (docs/007 §5.2; docs/003, Decisiones R0 D1 y R2).
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useGuide, useGuides } from '../hooks/use-guides';
import { useLoader, useMutation } from '../hooks/use-loader';
import { activeAccountsTotal, avatarInitial, firstName } from '../lib/accounts';
import type { GuideId } from '../lib/guides';
import { formatCents } from '../lib/money';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { colors, headerPigSize, radii, shadows, tabularNums, typography } from '../theme/tokens';
import { AccountCard, balanceText } from './account-ui';
import SessionBanner from './SessionBanner';
import { SignOutControl } from './session-ui';
import { ProfileSheet } from './sheets';
import { Button, EmptyState, GuideCard, PIG_ART } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

export const ACCOUNTS_ERROR =
  'No pudimos cargar tus cuentas. Revisa tu conexión e inténtalo de nuevo.';

export default function AccountsScreen({
  api,
  onOpenAccount,
  onCreateAccount,
  onNotify,
  initialArchivedOpen = false,
  onAppearanceSupport,
}: {
  api: ResourcesApi;
  // Abre el Detalle de la cuenta (también una archivada, en modo consulta).
  onOpenAccount: (account: Account) => void;
  onCreateAccount: () => void;
  onNotify?: (message: string) => void;
  initialArchivedOpen?: boolean;
  // Informa si la lista trae las claves color/icono (true/false; null si la lista está vacía).
  onAppearanceSupport?: (supported: boolean | null) => void;
}) {
  const { status, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const unavailable = status === 'unavailable';
  const name = firstName(user?.name);
  const { width, fontScale } = useWindowDimensions();
  const [hasActive, setHasActive] = useState(false);
  const pigSize = headerPigSize(width, fontScale);

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Text numberOfLines={2} style={styles.brand}>
          CuidaTuBilletera
        </Text>
        <View style={styles.headerActions}>
          <SignOutControl variant="icon" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tu perfil y sesión"
            onPress={() => setProfileOpen(true)}
            style={styles.avatarTouch}
          >
            <View style={[styles.avatar, shadows.card]} {...hidden}>
              <Text style={styles.avatarText}>{avatarInitial(user?.name, user?.email)}</Text>
            </View>
          </Pressable>
        </View>
      </View>
      <View testID="accounts-header-row" style={styles.headerRow}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.greeting}>
            {name ? `Hola, ${name}` : 'Hola'}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            Mis cuentas
          </Text>
          <View style={styles.underline} {...hidden} />
        </View>
        {pigSize > 0 && hasActive ? (
          <Image
            testID="accounts-header-pig"
            source={PIG_ART}
            style={[styles.headerPig, { width: pigSize, height: pigSize }]}
            resizeMode="contain"
            accessible={false}
            {...hidden}
          />
        ) : null}
      </View>

      <SessionBanner />

      {/* Sin sesión disponible no se consulta la API. */}
      {unavailable ? null : (
        <AccountsList
          api={api}
          onOpenAccount={onOpenAccount}
          onCreateAccount={onCreateAccount}
          onNotify={onNotify}
          initialArchivedOpen={initialArchivedOpen}
          onAppearanceSupport={onAppearanceSupport}
          onHasActiveChange={setHasActive}
        />
      )}

      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </View>
  );
}

function AccountsList({
  api,
  onOpenAccount,
  onCreateAccount,
  onNotify,
  initialArchivedOpen,
  onAppearanceSupport,
  onHasActiveChange,
}: {
  api: ResourcesApi;
  onOpenAccount: (account: Account) => void;
  onCreateAccount: () => void;
  onNotify?: (message: string) => void;
  initialArchivedOpen: boolean;
  onAppearanceSupport?: (supported: boolean | null) => void;
  // Informa si hay cuentas activas (solo con la lista cargada); false al desmontar.
  onHasActiveChange?: (hasActive: boolean) => void;
}) {
  const { authorizedCall } = useAuth();
  const [archivedOpen, setArchivedOpen] = useState(initialArchivedOpen);
  const mutation = useMutation();
  const { dismiss } = useGuides();
  // Una sola lectura con las archivadas: la lista se separa en la app.
  const { state, reload, refresh } = useLoader(
    () =>
      authorizedCall((token) =>
        api.listAccounts(token, { pageSize: 100, incluirArchivadas: true }),
      ),
    'accounts',
  );

  const supportRef = useRef(onAppearanceSupport);
  supportRef.current = onAppearanceSupport;
  useEffect(() => {
    if (state.status === 'ready') supportRef.current?.(state.data.appearanceSupported ?? null);
  }, [state]);

  const hasActiveRef = useRef(onHasActiveChange);
  hasActiveRef.current = onHasActiveChange;
  const hasActive =
    state.status === 'ready' && state.data.items.some((account) => !account.archivada);
  useEffect(() => {
    hasActiveRef.current?.(hasActive);
  }, [hasActive]);
  useEffect(() => () => hasActiveRef.current?.(false), []);

  // Guías (docs/007 §5.12.C): solo con la lista cargada. Con una sola cuenta la pista fija de la
  // tarjeta ya orienta (docs/003, R5 D5), por eso `cuentas-lista` pide dos o más cuentas activas.
  const loadedItems = state.status === 'ready' ? state.data.items : [];
  const activeCount = loadedItems.filter((account) => !account.archivada).length;
  const archivedCount = loadedItems.length - activeCount;
  const candidates: GuideId[] =
    activeCount === 0 && archivedCount === 0
      ? ['cuentas-vacio']
      : activeCount >= 2
        ? ['cuentas-lista']
        : [];
  const { guide, dismissGuide } = useGuide(candidates, state.status === 'ready');

  async function unarchive(account: Account) {
    const ok = await mutation.run(() =>
      authorizedCall((token) => api.updateAccount(token, account.id, { archivada: false })),
    );
    if (ok) {
      onNotify?.('Cuenta desarchivada');
      refresh();
    }
  }

  if (state.status === 'loading') return <LoadingSkeleton />;
  if (state.status === 'error') {
    return (
      <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {ACCOUNTS_ERROR}
        </Text>
        <Button label="Reintentar" variant="primary" onPress={reload} />
      </View>
    );
  }

  const active = state.data.items.filter((account) => !account.archivada);
  const archived = state.data.items.filter((account) => account.archivada);
  const total = activeAccountsTotal(state.data.items);

  return (
    <View>
      {guide ? <GuideCard guide={guide} onDismiss={dismissGuide} /> : null}
      {total ? (
        <View
          accessible
          accessibilityLabel={`Total en tus cuentas, ${formatCents(total.total)}, suma de ${total.count} cuentas activas`}
          testID="accounts-total"
          style={[styles.total, shadows.card]}
        >
          <View style={styles.coin} {...hidden}>
            <Text style={styles.coinText}>$</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.totalLabel}>Total en tus cuentas</Text>
            <Text style={[styles.totalAmount, tabularNums, total.total < 0 && styles.negative]}>
              {formatCents(total.total)}
            </Text>
            <Text style={styles.small}>Suma de los saldos de {total.count} cuentas</Text>
            {archived.length > 0 ? (
              <Text style={styles.small}>No incluye cuentas archivadas</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {active.length === 0 ? (
        archived.length === 0 ? (
          <EmptyState
            module="cuenta"
            art="alcancia"
            title="Todavía no tienes cuentas"
            message="Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta."
            actionLabel="Crear mi primera cuenta"
            onAction={onCreateAccount}
            tall
          />
        ) : (
          <EmptyState
            module="cuenta"
            art="alcancia"
            message="No tienes cuentas activas. Puedes crear una o desarchivar una de las anteriores."
            actionLabel="Crear mi primera cuenta"
            onAction={onCreateAccount}
            tall
          />
        )
      ) : (
        <>
          {active.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              hint={active.length === 1 ? 'Toca para ver tus movimientos' : undefined}
              onPress={() => {
                dismiss('cuentas-lista');
                onOpenAccount(account);
              }}
            />
          ))}
          <Button
            label="+ Nueva cuenta"
            accessibilityLabel="Nueva cuenta"
            variant="primary"
            tall
            onPress={onCreateAccount}
          />
        </>
      )}

      {archived.length > 0 ? (
        <View style={styles.archived}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Archivadas (${archived.length})`}
            accessibilityState={{ expanded: archivedOpen }}
            onPress={() => setArchivedOpen((open) => !open)}
            style={styles.archivedToggle}
          >
            <Text style={styles.archivedToggleText}>
              {archivedOpen ? '▾' : '▸'} Archivadas ({archived.length})
            </Text>
          </Pressable>
          {archivedOpen
            ? archived.map((account) => (
                <View key={account.id} style={styles.archivedRow}>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.archivedName}>
                      {account.nombre}
                    </Text>
                    <Text style={styles.small}>Archivada</Text>
                    <Text style={[styles.archivedBalance, tabularNums]}>
                      {balanceText(account.saldo) ?? 'Saldo no disponible'}
                    </Text>
                  </View>
                  <Button
                    label="Ver"
                    accessibilityLabel={`Ver ${account.nombre}`}
                    variant="link"
                    onPress={() => onOpenAccount(account)}
                  />
                  <Button
                    label="Desarchivar"
                    accessibilityLabel={`Desarchivar ${account.nombre}`}
                    busy={mutation.pending}
                    onPress={() => void unarchive(account)}
                  />
                </View>
              ))
            : null}
          {mutation.error ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {mutation.error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Esqueleto estático, sin cifras: lo anuncia solo el texto de carga.
function LoadingSkeleton() {
  return (
    <View testID="accounts-loading">
      <Text accessibilityLiveRegion="polite" style={styles.small}>
        Cargando tus cuentas…
      </Text>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[0, 1].map((key) => (
          <View key={key} style={styles.skeletonCard}>
            <View style={[styles.skeletonBar, { width: '50%' }]} />
            <View style={[styles.skeletonBar, { width: '30%' }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerPig: { flexShrink: 0 },
  brandRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { ...typography.brandLabel, color: colors.brandInk, flexShrink: 1 },
  // [🚪] [avatar]: dos zonas de 48 dp separadas 8 dp para evitar toques accidentales.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarTouch: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.text },
  greeting: { ...typography.greeting, color: colors.text2 },
  title: { ...typography.rootTitle, color: colors.text },
  underline: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.yellow,
    marginBottom: 12,
  },
  small: { ...typography.small, color: colors.text2 },
  body: { ...typography.body, color: colors.text },
  negative: { color: colors.expenseText },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontSize: 18, fontWeight: '900', color: colors.text },
  totalLabel: { ...typography.small, fontWeight: '700', color: colors.text2 },
  totalAmount: { ...typography.totalAmount, color: colors.text },
  errorBox: { alignItems: 'center', padding: 16, gap: 12 },
  errorText: { ...typography.body, color: colors.expenseText, textAlign: 'center' },
  archived: { marginTop: 16, gap: 8 },
  archivedToggle: { minHeight: 48, justifyContent: 'center' },
  archivedToggleText: { ...typography.button, color: colors.text },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.archivedRow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  archivedName: { fontSize: 15, fontWeight: '700', color: colors.text },
  archivedBalance: { fontSize: 15, fontWeight: '800', color: colors.text2 },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.accountCard,
    padding: 16,
    gap: 8,
    marginTop: 10,
    minHeight: 88,
  },
  skeletonBar: { height: 12, borderRadius: 6, backgroundColor: colors.segBg },
});
