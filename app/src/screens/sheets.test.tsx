import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthError } from '../lib/auth-types';
import type { Page } from '../lib/resources-api';
import { account, accountPageOf, fakeResourcesApi, pageOf } from '../resources-test-utils';
import { controlledPromise, relaxTimeoutsForColdCache } from '../test-utils';
import { AccountSwitcherSheet, ProfileSheet } from './sheets';

relaxTimeoutsForColdCache();

jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok') }),
}));

const mockLinks = {
  privacyPolicyUrl: null as string | null,
  accountDeletionUrl: null as string | null,
};
jest.mock('../lib/config', () => ({ readLegalLinks: () => mockLinks }));

const accounts = [
  account({ id: 'acc-1', nombre: 'Efectivo', saldo: 1250 }),
  account({ id: 'acc-2', nombre: 'Banco', saldo: -500 }),
  account({ id: 'acc-3', nombre: 'Vieja', archivada: true }),
];

const props = { onClose: jest.fn(), onSelect: jest.fn(), onSeeAll: jest.fn() };
afterEach(() => jest.clearAllMocks());

describe('AccountSwitcherSheet', () => {
  it('cerrada no carga cuentas', async () => {
    const api = fakeResourcesApi();
    await render(<AccountSwitcherSheet visible={false} api={api} currentId="acc-1" {...props} />);
    expect(api.listAccounts).not.toHaveBeenCalled();
  });

  it('al abrir carga y muestra solo activas; la actual marcada con ✓ aparte', async () => {
    const gate = controlledPromise<Page<ReturnType<typeof account>>>();
    const api = fakeResourcesApi({ listAccounts: jest.fn(() => gate.promise) });
    await render(<AccountSwitcherSheet visible api={api} currentId="acc-1" {...props} />);
    expect(screen.getByRole('header', { name: 'Cambiar de cuenta' })).toBeTruthy();
    expect(screen.getByText('Cargando tus cuentas…')).toBeTruthy();
    await act(async () => gate.resolve(pageOf(accounts)));
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual([
      'Efectivo, saldo $12.50',
      'Banco, saldo -$5.00',
    ]);
    expect(radios[0]!.props.accessibilityState).toEqual({ selected: true });
    expect(radios[1]!.props.accessibilityState).toEqual({ selected: false });
    expect(screen.getAllByTestId('switcher-check', { includeHiddenElements: true })).toHaveLength(
      1,
    );
    expect(screen.queryByText('Vieja')).toBeNull();
    await fireEvent.press(radios[1]!);
    expect(props.onSelect).toHaveBeenCalledWith(accounts[1]);
  });

  it('con la cuenta activa archivada no marca ninguna', async () => {
    await render(
      <AccountSwitcherSheet
        visible
        api={fakeResourcesApi({ listAccounts: jest.fn(async () => pageOf(accounts)) })}
        currentId={null}
        {...props}
      />,
    );
    const radios = await screen.findAllByRole('radio');
    expect(radios.every((r) => r.props.accessibilityState.selected === false)).toBe(true);
  });

  it('error con Reintentar; «Ver todas mis cuentas»; Atrás la cierra', async () => {
    const listAccounts = jest
      .fn()
      .mockRejectedValueOnce(new AuthError('network'))
      .mockResolvedValueOnce(pageOf(accounts));
    await render(
      <AccountSwitcherSheet
        visible
        api={fakeResourcesApi({ listAccounts })}
        currentId="acc-1"
        {...props}
      />,
    );
    expect(await screen.findByText('No pudimos cargar tus cuentas.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Banco')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas mis cuentas' }));
    expect(props.onSeeAll).toHaveBeenCalled();
    await fireEvent(screen.getByTestId('account-switcher'), 'requestClose');
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('AccountSwitcherSheet: apariencia', () => {
  it('muestra el color y el ícono guardados de cada cuenta (CTA-17)', async () => {
    const items = [account({ id: 'acc-1', nombre: 'Viaje', color: 'limon', icono: 'plane' })];
    const api = fakeResourcesApi({ listAccounts: jest.fn(async () => accountPageOf(items)) });
    await render(<AccountSwitcherSheet visible api={api} currentId="acc-1" {...props} />);
    expect(await screen.findByText('✈\uFE0F', { includeHiddenElements: true })).toBeTruthy();
  });

  it('informa si la lista trae las claves, no al fallar', async () => {
    const onSupport = jest.fn();
    const api = fakeResourcesApi({ listAccounts: jest.fn(async () => accountPageOf(accounts)) });
    await render(
      <AccountSwitcherSheet
        visible
        api={api}
        currentId="acc-1"
        {...props}
        onAppearanceSupport={onSupport}
      />,
    );
    await screen.findAllByRole('radio');
    expect(onSupport).toHaveBeenCalledWith(true);
  });
});

describe('ProfileSheet: privacidad y eliminación (G1)', () => {
  beforeEach(() => {
    mockLinks.privacyPolicyUrl = null;
  });

  it('sin manejador no ofrece eliminar y sin URL no ofrece la política', async () => {
    await render(<ProfileSheet visible onClose={props.onClose} />);
    expect(screen.queryByText('Eliminar mi cuenta y mis datos')).toBeNull();
    expect(screen.queryByText('Política de privacidad')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('con manejador, «Eliminar…» delega en él (no abre nada por sí misma)', async () => {
    const onDeleteAccount = jest.fn();
    await render(
      <ProfileSheet visible onClose={props.onClose} onDeleteAccount={onDeleteAccount} />,
    );
    const del = screen.getByRole('button', { name: 'Eliminar mi cuenta y mis datos' });
    expect(del.props.accessibilityHint).toBe('Abre una confirmación');
    await fireEvent.press(del);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-account-sheet')).toBeNull();
  });

  it('con URL válida muestra la política', async () => {
    mockLinks.privacyPolicyUrl = 'https://ejemplo.test/privacidad';
    await render(<ProfileSheet visible onClose={props.onClose} onDeleteAccount={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toBeTruthy();
  });
});
