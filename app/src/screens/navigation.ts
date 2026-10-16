// Estado de navegación de la app autenticada (docs/003, Decisión R2 D1). Sin dependencias: pila
// en estado local y Detalle de cuenta con la cuenta activa como fuente única. Funciones puras.
import { initialReportsView, type ReportsView } from '../lib/reports';
import type { Account, Transaction } from '../lib/resources-api';
import type { HistoryFilters } from './HistoryScreen';

export type Tab = 'cuenta' | 'movimientos' | 'calendario' | 'reportes' | 'mas';

// Ninguna ruta guarda la cuenta: todas leen `detail.account`.
export type Route =
  | { name: 'accounts' }
  | { name: 'newAccount' }
  | { name: 'detail' }
  | { name: 'newTx'; fecha?: string }
  | { name: 'editTx'; transaction: Transaction }
  // `fromForm`: se llegó desde «Ir a Categorías» del formulario (la salida dice «‹ Volver»).
  | { name: 'categories'; fromForm?: true }
  | { name: 'historyFiltered'; filters: HistoryFilters };

export type BalanceStatus = 'ok' | 'refreshing' | 'error';

export interface DetailViews {
  calendar: { month: string; day: string };
  reports: ReportsView;
  history?: HistoryFilters;
  summaryMonth: string; // AAAA-MM de la pestaña Cuenta (independiente del Calendario)
}

export interface DetailState {
  account: Account;
  balance: BalanceStatus;
  refreshKey: number; // 0 = no releer
  tab: Tab;
  views: DetailViews;
  // Se llegó desde Crear cuenta: habilita el vacío «Tu cuenta está lista».
  justCreated: boolean;
}

export interface NavState {
  stack: Route[];
  detail: DetailState | null;
}

export const ROOT: Route[] = [{ name: 'accounts' }];

export function initialDetail(account: Account, today: string, justCreated = false): DetailState {
  return {
    account,
    balance: 'ok',
    refreshKey: 0,
    tab: 'cuenta',
    views: {
      calendar: { month: today.slice(0, 7), day: today },
      reports: initialReportsView(today),
      summaryMonth: today.slice(0, 7),
    },
    justCreated,
  };
}

// Rutas que necesitan la cuenta activa. Sin `detail` se vuelve a Mis cuentas.
export function needsDetail(route: Route): boolean {
  return route.name !== 'accounts' && route.name !== 'newAccount';
}

// Atrás de Android (docs/007 §3.4). null = no se intercepta (en la raíz el sistema sale de la
// app; no se cierra la sesión). Las hojas (Modal) y el formulario mientras guarda lo resuelven
// antes con su propio manejador.
export function resolveBack({ stack, detail }: NavState): NavState | null {
  const top = stack[stack.length - 1];
  if (!top || stack.length <= 1) return null;
  if (top.name === 'detail' && detail && detail.tab !== 'cuenta') {
    return { stack, detail: { ...detail, tab: 'cuenta' } };
  }
  const next = stack.slice(0, -1);
  const nextTop = next[next.length - 1];
  if (!nextTop || !needsDetail(nextTop)) return { stack: next, detail: null };
  return { stack: next, detail };
}
