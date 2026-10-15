import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Account, ResourcesApi, Transaction } from '../lib/resources-api';
import AccountsScreen from './AccountsScreen';
import CategoriesScreen from './CategoriesScreen';
import HistoryScreen from './HistoryScreen';
import HomeScreen from './HomeScreen';
import TransactionFormScreen from './TransactionFormScreen';

type Route =
  | { name: 'home' }
  | { name: 'accounts' }
  | { name: 'categories'; account: Account }
  | { name: 'history'; account: Account }
  | { name: 'transaction'; account: Account; transaction?: Transaction };

// Navegación sin dependencias: pila en estado local y botón «atrás» de Android. Al cerrar sesión
// el navegador se desmonta, de modo que la pila y los datos no sobreviven a un cambio de usuario.
export default function MainNavigator({ api }: { api: ResourcesApi }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  // Cuenta elegida en Inicio: solo en memoria, se pierde al cerrar sesión (el navegador se desmonta).
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1) return false; // en Inicio, el sistema cierra la app
      setStack((current) => current.slice(0, -1));
      return true;
    });
    return () => subscription.remove();
  }, [stack]);

  const push = (route: Route) => setStack((current) => [...current, route]);
  const pop = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const route = stack[stack.length - 1] ?? { name: 'home' };

  switch (route.name) {
    case 'accounts':
      return (
        <AccountsScreen
          api={api}
          onOpenAccount={(account) => push({ name: 'categories', account })}
        />
      );
    case 'categories':
      return <CategoriesScreen key={route.account.id} account={route.account} api={api} />;
    case 'history':
      return (
        <HistoryScreen
          key={route.account.id}
          account={route.account}
          api={api}
          onOpenTransaction={(transaction) =>
            push({ name: 'transaction', account: route.account, transaction })
          }
        />
      );
    case 'transaction':
      return (
        <TransactionFormScreen
          key={route.transaction?.id ?? 'new'}
          account={route.account}
          api={api}
          transaction={route.transaction}
          onDone={pop}
        />
      );
    default:
      return (
        <HomeScreen
          api={api}
          onOpenAccounts={() => push({ name: 'accounts' })}
          dashboard={{
            selectedAccountId,
            onSelectAccount: setSelectedAccountId,
            onNewTransaction: (account) => push({ name: 'transaction', account }),
            onOpenHistory: (account) => push({ name: 'history', account }),
            onEditTransaction: (account, transaction) =>
              push({ name: 'transaction', account, transaction }),
          }}
        />
      );
  }
}
