import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader } from '../hooks/use-loader';
import { formatCents } from '../lib/money';
import type { Account, ResourcesApi, Transaction } from '../lib/resources-api';
import TransactionRow, { categoryMap } from './TransactionRow';
import { Button, Chip, ErrorBox, screenStyles as s } from './ui';

export interface HomeDashboardProps {
  api: ResourcesApi;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  onCreateAccount: () => void;
  onNewTransaction: (account: Account) => void;
  onOpenHistory: (account: Account) => void;
  onOpenCalendar: (account: Account) => void;
  onOpenReports: (account: Account) => void;
  onEditTransaction: (account: Account, transaction: Transaction) => void;
}

// Cuentas activas, selector, saldo y movimientos recientes. Los datos viven solo en el estado del
// componente: se recargan al montar (también al volver de pantallas secundarias) y al cambiar de cuenta.
export default function HomeDashboard(props: HomeDashboardProps) {
  const { api, selectedAccountId, onSelectAccount, onCreateAccount } = props;
  const { authorizedCall } = useAuth();
  const { state, reload } = useLoader(
    () => authorizedCall((token) => api.listAccounts(token, { pageSize: 100 })),
    'home-accounts',
  );

  if (state.status === 'loading') {
    return <ActivityIndicator size="large" testID="home-loading" style={{ marginVertical: 16 }} />;
  }
  if (state.status === 'error')
    return <ErrorBox message={state.message} onRetry={reload} retryLabel="Reintentar carga" />;

  const accounts = state.data.items.filter((account) => !account.archivada);
  if (accounts.length === 0) {
    return (
      <View style={styles.block}>
        <Text style={s.muted}>No tienes cuentas activas. Crea una para registrar movimientos.</Text>
        <Button label="Crear cuenta" variant="primary" onPress={onCreateAccount} />
      </View>
    );
  }

  // Si la cuenta elegida ya no existe o se archivó, se usa la primera.
  const selected = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]!;

  return (
    <View style={styles.block}>
      <View style={s.actions} accessibilityRole="radiogroup">
        {accounts.map((account) => (
          <Chip
            key={account.id}
            label={account.nombre}
            accessibilityLabel={`Cuenta ${account.nombre}`}
            selected={account.id === selected.id}
            onPress={() => onSelectAccount(account.id)}
          />
        ))}
      </View>
      <Text style={styles.balanceLabel}>Saldo de {selected.nombre}</Text>
      <Text accessibilityLabel={`Saldo ${formatCents(selected.saldo)}`} style={styles.balance}>
        {formatCents(selected.saldo)}
      </Text>
      <View style={s.actions}>
        <Button
          label="Nuevo movimiento"
          variant="primary"
          onPress={() => props.onNewTransaction(selected)}
        />
        <Button label="Ver historial" onPress={() => props.onOpenHistory(selected)} />
        <Button label="Ver calendario" onPress={() => props.onOpenCalendar(selected)} />
        <Button label="Reportes" onPress={() => props.onOpenReports(selected)} />
      </View>
      <RecentTransactions key={selected.id} account={selected} {...props} />
    </View>
  );
}

function RecentTransactions({
  api,
  account,
  onEditTransaction,
}: HomeDashboardProps & { account: Account }) {
  const { authorizedCall } = useAuth();
  const { state, reload } = useLoader(
    () =>
      authorizedCall(async (token) => {
        const [transactions, categories] = await Promise.all([
          api.listTransactions(token, { accountId: account.id, pageSize: 10 }),
          api.listCategories(token, account.id, { incluirArchivadas: true, pageSize: 100 }),
        ]);
        return { transactions: transactions.items, categories: categoryMap(categories.items) };
      }),
    `recent:${account.id}`,
  );

  return (
    <View>
      <Text accessibilityRole="header" style={s.section}>
        Movimientos recientes
      </Text>
      {state.status === 'loading' ? (
        <ActivityIndicator size="small" testID="recent-loading" />
      ) : state.status === 'error' ? (
        <ErrorBox message={state.message} onRetry={reload} retryLabel="Reintentar carga" />
      ) : state.data.transactions.length === 0 ? (
        <Text style={s.muted}>Aún no hay movimientos en esta cuenta</Text>
      ) : (
        state.data.transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            category={state.data.categories.get(transaction.categoryId)}
            onPress={() => onEditTransaction(account, transaction)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch', marginBottom: 16 },
  balanceLabel: { marginTop: 16, color: '#555555' },
  balance: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
});
