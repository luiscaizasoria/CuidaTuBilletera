// Mis cuentas: pantalla inicial autenticada (docs/007 §5.2; docs/003, Decisiones R0 D1 y R2).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader, useMutation } from '../hooks/use-loader';
import { activeAccountsTotal, avatarInitial, firstName } from '../lib/accounts';
import { formatCents } from '../lib/money';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { colors, radii, shadows, tabularNums, typography } from '../theme/tokens';
import { AccountCard, balanceText } from './account-ui';
import SessionBanner from './SessionBanner';
import { ProfileSheet } from './sheets';
import { Button } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

export const ACCOUNTS_ERROR =
  'No pudimos cargar tus cuentas. Revisa tu conexión e inténtalo de nuevo.';

export default function AccountsScreen({
  api,
  onOpenAccount,
  onCreateAccount,
  onNotify,
  initialArchivedOpen = false,
}: {
  api: ResourcesApi;
  // Abre el Detalle de la cuenta (también una archivada, en modo consulta).
  onOpenAccount: (account: Account) => void;
  onCreateAccount: () => void;
  onNotify?: (message: string) => void;
  initialArchivedOpen?: boolean;
}) {
  const { status, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const unavailable = status === 'unavailable';
  const name = firstName(user?.name);

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>CuidaTuBilletera</Text>
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
      <Text numberOfLines={1} style={styles.greeting}>
        {name ? `Hola, ${name}` : 'Hola'}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        Mis cuentas
      </Text>
      <View style={styles.underline} {...hidden} />

      <SessionBanner />

      {/* Sin sesión disponible no se consulta la API. */}
      {unavailable ? null : (
        <AccountsList
          api={api}
          onOpenAccount={onOpenAccount}
          onCreateAccount={onCreateAccount}
          onNotify={onNotify}
          initialArchivedOpen={initialArchivedOpen}
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
}: {
  api: ResourcesApi;
  onOpenAccount: (account: Account) => void;
  onCreateAccount: () => void;
  onNotify?: (message: string) => void;
  initialArchivedOpen: boolean;
}) {
  const { authorizedCall } = useAuth();
  const [archivedOpen, setArchivedOpen] = useState(initialArchivedOpen);
  const mutation = useMutation();
  // Una sola lectura con las archivadas: la lista se separa en la app.
  const { state, reload, refresh } = useLoader(
    () =>
      authorizedCall((token) =>
        api.listAccounts(token, { pageSize: 100, incluirArchivadas: true }),
      ),
    'accounts',
  );

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
        <View style={styles.empty}>
          {archived.length === 0 ? (
            <>
              <Text style={styles.emptyTitle}>Todavía no tienes cuentas</Text>
              <Text style={styles.body}>
                Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              No tienes cuentas activas. Puedes crear una o desarchivar una de las anteriores.
            </Text>
          )}
          <Button
            label="Crear mi primera cuenta"
            variant="primary"
            tall
            onPress={onCreateAccount}
          />
        </View>
      ) : (
        <>
          {active.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              hint={active.length === 1 ? 'Toca para ver tus movimientos' : undefined}
              onPress={() => onOpenAccount(account)}
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
  brandRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { ...typography.brandLabel, color: colors.brandInk },
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
  empty: { gap: 12, paddingVertical: 16 },
  emptyTitle: { ...typography.h2, color: colors.text },
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
