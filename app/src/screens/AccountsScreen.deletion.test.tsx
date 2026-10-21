// Eliminar la cuenta desde la hoja de perfil (G1; ELIM-a, ELIM-m, ELIM-q): ProfileSheet se cierra
// antes de abrir la hoja de eliminación; jamás hay dos `Modal` visibles a la vez.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { fakeResourcesApi } from '../resources-test-utils';
import { mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import AccountsScreen from './AccountsScreen';

relaxTimeoutsForColdCache();

const mockDelete = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana' },
    busy: false,
    degraded: false,
    signOut: mockSignOut,
    deleteAccount: mockDelete,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));
const mockLinks = {
  privacyPolicyUrl: null as string | null,
  accountDeletionUrl: null as string | null,
};
jest.mock('../lib/config', () => ({ readLegalLinks: () => mockLinks }));

const notify = jest.fn();
const renderScreen = () =>
  render(
    <AccountsScreen
      api={fakeResourcesApi()}
      onOpenAccount={jest.fn()}
      onCreateAccount={jest.fn()}
      onNotify={notify}
    />,
  );
const modalCount = () => (JSON.stringify(screen.toJSON()).match(/"type":"Modal"/g) ?? []).length;
const openProfile = async () => {
  await screen.findByRole('button', { name: 'Tu perfil y sesión' });
  await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
};

beforeEach(() => {
  mockWindow(411, 1, 800);
  mockLinks.privacyPolicyUrl = null;
  mockLinks.accountDeletionUrl = null;
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

describe('hoja de perfil: privacidad y eliminación', () => {
  it('ofrece «Eliminar mi cuenta y mis datos» separado de «Cerrar sesión»; sin URL no hay política', async () => {
    await renderScreen();
    await openProfile();
    const sheet = within(screen.getByTestId('profile-sheet'));
    expect(sheet.getByRole('button', { name: 'Eliminar mi cuenta y mis datos' })).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(sheet.queryByText('Política de privacidad')).toBeNull();
  });

  it('con URL muestra la política y la abre en el navegador (ELIM-m)', async () => {
    mockLinks.privacyPolicyUrl = 'https://ejemplo.test/privacidad';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderScreen();
    await openProfile();
    await fireEvent.press(screen.getByRole('link', { name: 'Política de privacidad' }));
    expect(openURL).toHaveBeenCalledWith('https://ejemplo.test/privacidad');
    openURL.mockRejectedValue(new Error('x'));
    await fireEvent.press(screen.getByRole('link', { name: 'Política de privacidad' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('No pudimos abrir el enlace.'));
  });

  it('cierra primero la hoja de perfil y abre después la de eliminación, sin dos Modal (ELIM-q)', async () => {
    await renderScreen();
    await openProfile();
    expect(modalCount()).toBe(1);
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', {
        name: 'Eliminar mi cuenta y mis datos',
      }),
    );
    // Nunca dos a la vez: se observa cada comprobación hasta que aparece la hoja de eliminación.
    await waitFor(() => {
      expect(modalCount()).toBeLessThanOrEqual(1);
      expect(screen.queryByTestId('profile-sheet')).toBeNull();
      expect(screen.getByTestId('delete-account-sheet')).toBeTruthy();
    });
    expect(modalCount()).toBe(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('cancelar la hoja de eliminación vuelve a Mis cuentas sin dejar Modal abierto', async () => {
    await renderScreen();
    await openProfile();
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', {
        name: 'Eliminar mi cuenta y mis datos',
      }),
    );
    await screen.findByTestId('delete-account-sheet');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(modalCount()).toBe(0);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('reabrir el perfil antes del retardo descarta la apertura pendiente (D-4)', async () => {
    await renderScreen();
    await openProfile();
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', {
        name: 'Eliminar mi cuenta y mis datos',
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByTestId('delete-account-sheet')).toBeNull();
    expect(modalCount()).toBe(1);
  });

  it('«Cerrar sesión» de la hoja de perfil no cambia (ELIM-o)', async () => {
    await renderScreen();
    await openProfile();
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
