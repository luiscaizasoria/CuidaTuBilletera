// Cerrar sesión compartido (R51-07 a R51-11, docs/007 §5.13 C): un solo componente en el encabezado
// de Mis cuentas, la hoja de perfil, Más y la franja de sesión, con el mismo `signOut` de useAuth().
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { GuidesProvider } from '../hooks/use-guides';
import { guideRecord, memoryGuideStorage } from '../guides-test-utils';
import { account, fakeResourcesApi } from '../resources-test-utils';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import { colors, sizes } from '../theme/tokens';
import AccountsScreen from './AccountsScreen';
import MoreScreen from './MoreScreen';
import SessionBanner from './SessionBanner';
import { SignOutControl } from './session-ui';

relaxTimeoutsForColdCache();

const mockAuth: Record<string, unknown> = {};
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    ...mockAuth,
    authorizedCall: (call: (token: string) => Promise<unknown>) => call('tok'),
  }),
}));

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle &
    TextStyle;
const signOut = jest.fn();

beforeEach(() => {
  mockWindow(360, 1);
  signOut.mockReset();
  for (const key of Object.keys(mockAuth)) delete mockAuth[key];
  Object.assign(mockAuth, {
    status: 'authenticated',
    user: { id: 'u', email: 'ana@example.com', name: 'Ana López' },
    busy: false,
    degraded: false,
    unavailableCause: null,
    error: null,
    signOut,
    restore: jest.fn(),
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const renderAccounts = () =>
  render(
    <AccountsScreen
      api={fakeResourcesApi()}
      onOpenAccount={jest.fn()}
      onCreateAccount={jest.fn()}
    />,
  );

describe('SignOutControl: variante icono', () => {
  it('R51-07: botón «Cerrar sesión» con zona de 48 dp y círculo de 40 dp, glifo oculto', async () => {
    await render(<SignOutControl variant="icon" />);
    const control = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(flat(control)).toMatchObject({ width: sizes.touchMin, height: sizes.touchMin });
    const glyph = screen.getByText('🚪', { includeHiddenElements: true });
    expect(glyph.props.importantForAccessibility).toBe('no');
    expect(glyph.props.accessibilityElementsHidden).toBe(true);
    expect(flat(glyph.parent!)).toMatchObject({
      width: sizes.avatar,
      height: sizes.avatar,
      backgroundColor: colors.surface,
    });
  });

  it('R51-08: un toque llama a signOut una vez y sin diálogo de confirmación', async () => {
    await render(<SignOutControl variant="icon" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('R51-08: un segundo toque durante el cierre no repite signOut; el control queda ocupado', async () => {
    const gate = controlledPromise();
    signOut.mockReturnValue(gate.promise);
    await render(<SignOutControl variant="icon" />);
    const control = screen.getByRole('button', { name: 'Cerrar sesión' });
    await fireEvent.press(control);
    await fireEvent.press(control);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    await act(async () => gate.resolve());
    // Si la sesión no cambia (el componente sigue montado) el control se libera.
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('un fallo inesperado de signOut libera el control sin lanzar', async () => {
    signOut.mockRejectedValue(new Error('x'));
    await render(<SignOutControl variant="icon" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).props.accessibilityState).toEqual({
      disabled: false,
    });
  });
});

describe('SignOutControl: variante botón', () => {
  it('usa el Button secundario con el mismo texto y la misma protección', async () => {
    const gate = controlledPromise();
    signOut.mockReturnValue(gate.promise);
    await render(<SignOutControl variant="button" />);
    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(screen.getByText('Cerrar sesión')).toBeTruthy();
    await fireEvent.press(button);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    await act(async () => gate.resolve());
  });
});

describe('Mis cuentas: encabezado (R51-07, R51-10)', () => {
  it('muestra 🚪 y el avatar como dos zonas de 48 dp, separadas 8 dp y con 🚪 primero', async () => {
    await renderAccounts();
    const control = screen.getByRole('button', { name: 'Cerrar sesión' });
    const avatar = screen.getByRole('button', { name: 'Tu perfil y sesión' });
    for (const node of [control, avatar]) {
      expect(flat(node)).toMatchObject({ width: 48, height: 48 });
    }
    const group = control.parent!;
    expect(group).toBe(avatar.parent);
    expect(flat(group)).toMatchObject({ flexDirection: 'row', gap: 8 });
    expect(group.children.indexOf(control as never)).toBeLessThan(
      group.children.indexOf(avatar as never),
    );
    await screen.findByText('Efectivo');
  });

  it('tocar el control llama a signOut una vez, sin confirmación', async () => {
    await renderAccounts();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    await screen.findByText('Efectivo');
  });

  it('con sesión no disponible el control sigue visible y activo; el avatar abre el perfil', async () => {
    Object.assign(mockAuth, { status: 'unavailable', unavailableCause: 'network' });
    await renderAccounts();
    // El encabezado (primero) y la franja comparten etiqueta.
    expect(screen.getAllByRole('button', { name: 'Cerrar sesión' })).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);
    expect(signOut).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
    expect(screen.getByTestId('profile-sheet')).toBeTruthy();
  });

  it('con sesión degradada el control sigue visible y activo', async () => {
    Object.assign(mockAuth, { degraded: true });
    await renderAccounts();
    const control = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(control.props.accessibilityState).toEqual({ disabled: false });
    await screen.findByText('Efectivo');
  });
});

describe('R51-09: un solo mecanismo en los cuatro accesos', () => {
  it('encabezado, hoja de perfil, Más y franja llaman al mismo signOut de useAuth()', async () => {
    Object.assign(mockAuth, { status: 'unavailable', unavailableCause: 'network' });
    const view = await renderAccounts();
    // Encabezado.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);
    // Franja de sesión.
    await fireEvent.press(
      within(screen.getByTestId('session-banner')).getByRole('button', { name: 'Cerrar sesión' }),
    );
    // Hoja de perfil.
    await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(signOut).toHaveBeenCalledTimes(3);
    await view.unmount();

    // Más (con sesión normal: la franja no aparece y queda solo el botón de la sección SESIÓN).
    Object.assign(mockAuth, { status: 'authenticated', unavailableCause: null });
    await render(
      <MoreScreen
        api={fakeResourcesApi()}
        account={account()}
        onAccountUpdated={jest.fn()}
        onArchived={jest.fn()}
        onOpenCategories={jest.fn()}
        onOpenExport={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(4);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('la franja degradada no ofrece su propio botón de cierre (solo «Reintentar»)', async () => {
    Object.assign(mockAuth, { degraded: true });
    await render(<SessionBanner />);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('la franja de sesión no disponible usa el componente compartido (misma etiqueta y protección)', async () => {
    Object.assign(mockAuth, { status: 'unavailable', unavailableCause: 'server' });
    const gate = controlledPromise();
    signOut.mockReturnValue(gate.promise);
    await render(<SessionBanner />);
    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    await fireEvent.press(button);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
  });
});

describe('R51-11: cerrar sesión no borra guías ni preferencias', () => {
  it('no escribe ni borra nada del almacén de guías', async () => {
    const guides = memoryGuideStorage({ guias_v1_u: guideRecord('cuentas-vacio') });
    await render(
      <GuidesProvider userId="u" storage={guides}>
        <SignOutControl variant="icon" />
      </GuidesProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(guides.writes).toHaveLength(0);
    expect(guides.data.get('guias_v1_u')).toBe(guideRecord('cuentas-vacio'));
  });
});
