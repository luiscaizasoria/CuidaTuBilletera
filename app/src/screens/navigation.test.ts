import { account, transaction } from '../resources-test-utils';
import {
  initialDetail,
  needsDetail,
  resolveBack,
  ROOT,
  type NavState,
  type Tab,
} from './navigation';

const TODAY = '2026-10-16';
const detail = (tab: Tab = 'cuenta') => ({ ...initialDetail(account(), TODAY), tab });

describe('initialDetail', () => {
  it('pestaña Cuenta, saldo ok sin relectura y vistas del mes de hoy', () => {
    const state = initialDetail(account({ id: 'x' }), TODAY);
    expect(state).toMatchObject({
      account: { id: 'x' },
      balance: 'ok',
      refreshKey: 0,
      tab: 'cuenta',
      justCreated: false,
      views: {
        calendar: { month: '2026-10', day: TODAY },
        reports: { mode: 'month', year: 2026, month: 10 },
        summaryMonth: '2026-10',
      },
    });
    expect(state.views.history).toBeUndefined();
    expect(initialDetail(account(), TODAY, true).justCreated).toBe(true);
  });
});

describe('needsDetail', () => {
  it('solo Mis cuentas y Crear cuenta no necesitan cuenta activa', () => {
    expect(needsDetail({ name: 'accounts' })).toBe(false);
    expect(needsDetail({ name: 'newAccount' })).toBe(false);
    expect(needsDetail({ name: 'detail' })).toBe(true);
    expect(needsDetail({ name: 'categories' })).toBe(true);
    expect(needsDetail({ name: 'newTx' })).toBe(true);
  });
});

describe('resolveBack (tabla de Atrás)', () => {
  it('Mis cuentas (raíz): no se intercepta', () => {
    expect(resolveBack({ stack: ROOT, detail: null })).toBeNull();
  });

  it('pila vacía: no se intercepta', () => {
    expect(resolveBack({ stack: [], detail: null })).toBeNull();
  });

  it('Crear cuenta -> Mis cuentas', () => {
    expect(resolveBack({ stack: [...ROOT, { name: 'newAccount' }], detail: null })).toEqual({
      stack: ROOT,
      detail: null,
    });
  });

  it('Detalle en Cuenta -> Mis cuentas y suelta la cuenta activa', () => {
    expect(resolveBack({ stack: [...ROOT, { name: 'detail' }], detail: detail() })).toEqual({
      stack: ROOT,
      detail: null,
    });
  });

  it.each(['movimientos', 'calendario', 'reportes', 'mas'] as const)(
    'Detalle en %s -> pestaña Cuenta conservando la pila y las vistas',
    (tab) => {
      const state: NavState = { stack: [...ROOT, { name: 'detail' }], detail: detail(tab) };
      const next = resolveBack(state);
      expect(next?.stack).toBe(state.stack);
      expect(next?.detail).toEqual({ ...state.detail, tab: 'cuenta' });
    },
  );

  it.each([
    [{ name: 'newTx' as const }, 'calendario' as const],
    [{ name: 'editTx' as const, transaction: transaction() }, 'movimientos' as const],
    [{ name: 'categories' as const }, 'mas' as const],
    [{ name: 'historyFiltered' as const, filters: { categoryId: 'c' } }, 'reportes' as const],
  ])('%o -> Detalle en la pestaña de origen (%s)', (route, tab) => {
    const current = detail(tab);
    const next = resolveBack({ stack: [...ROOT, { name: 'detail' }, route], detail: current });
    expect(next).toEqual({ stack: [...ROOT, { name: 'detail' }], detail: current });
  });
});
