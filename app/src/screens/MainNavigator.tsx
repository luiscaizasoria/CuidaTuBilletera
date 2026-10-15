import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Account, ResourcesApi } from '../lib/resources-api';
import AccountsScreen from './AccountsScreen';
import CategoriesScreen from './CategoriesScreen';
import HomeScreen from './HomeScreen';

type Route = { name: 'home' } | { name: 'accounts' } | { name: 'categories'; account: Account };

// Navegación sin dependencias: pila en estado local y botón «atrás» de Android. Al cerrar sesión
// el navegador se desmonta, de modo que la pila y los datos no sobreviven a un cambio de usuario.
export default function MainNavigator({ api }: { api: ResourcesApi }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1) return false; // en Inicio, el sistema cierra la app
      setStack((current) => current.slice(0, -1));
      return true;
    });
    return () => subscription.remove();
  }, [stack]);

  const push = (route: Route) => setStack((current) => [...current, route]);
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
    default:
      return <HomeScreen onOpenAccounts={() => push({ name: 'accounts' })} />;
  }
}
