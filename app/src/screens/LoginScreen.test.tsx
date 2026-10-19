// Login R5.1 (criterios R51-01 a R51-06, docs/007 §5.13 H). El flujo de Google no cambia: se
// verifica la presentación, el botón con el logotipo oculto a TalkBack y los estados.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AUTH_ERROR_MESSAGES, LOGOUT_NOTICE_MESSAGES } from '../lib/auth-messages';
import { mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import { brandGoogle, colors, sizes } from '../theme/tokens';
import LoginScreen, { LOGIN_MESSAGE, LOGIN_PRIVACY } from './LoginScreen';

relaxTimeoutsForColdCache();

const mockAuth: Record<string, unknown> = {};
jest.mock('../hooks/use-auth', () => ({ useAuth: () => mockAuth }));

const signIn = jest.fn();
beforeEach(() => {
  mockWindow(360, 1);
  signIn.mockReset();
  for (const key of Object.keys(mockAuth)) delete mockAuth[key];
  Object.assign(mockAuth, {
    busy: false,
    error: null,
    notice: null,
    signedOutReason: null,
    signIn,
  });
});
afterEach(() => jest.restoreAllMocks());

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle &
    TextStyle;

describe('LoginScreen: contenido (R51-01)', () => {
  it('muestra el nombre como encabezado, el mensaje de la variante A y la nota de privacidad', async () => {
    await render(<LoginScreen />);
    expect(screen.getByRole('header', { name: 'CuidaTuBilletera' })).toBeTruthy();
    expect(LOGIN_MESSAGE).toBe('Anota lo que entra y lo que sale, y mira cómo está tu dinero.');
    expect(screen.getByText(LOGIN_MESSAGE)).toBeTruthy();
    expect(
      screen.getByText(
        'Usamos tu cuenta de Google solo para identificarte. No vemos tu contraseña.',
      ),
    ).toBeTruthy();
    expect(LOGIN_PRIVACY).toContain('No vemos tu contraseña');
    expect(screen.queryByText('Inicia sesión para continuar.')).toBeNull();
  });

  it('la marca (alcancía en círculo amarillo suave) es decorativa y usa los tamaños de tokens', async () => {
    await render(<LoginScreen />);
    const mark = screen.getByTestId('login-mark', { includeHiddenElements: true });
    expect(mark.props.importantForAccessibility).toBe('no');
    expect(mark.props.accessibilityElementsHidden).toBe(true);
    expect(flat(mark)).toMatchObject({
      width: sizes.loginMark,
      height: sizes.loginMark,
      backgroundColor: colors.yellowSoft,
    });
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('ventana baja o fuente >= 1.5: la marca y las manchas se reducen al 75 % (120 y 96 dp)', async () => {
    mockWindow(360, 1.5);
    await render(<LoginScreen />);
    const mark = screen.getByTestId('login-mark', { includeHiddenElements: true });
    expect(flat(mark)).toMatchObject({ width: 120, height: 120 });
  });

  it('fuente >= 1.75: se oculta la marca y el botón sigue disponible', async () => {
    mockWindow(360, 2);
    await render(<LoginScreen />);
    expect(screen.queryByTestId('login-mark', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeTruthy();
  });
});

describe('LoginScreen: botón de Google (R51-02, R51-03, R51-04, R51-06)', () => {
  it('R51-02: se llama «Continuar con Google» y ya no existe «Ingresar con Google»', async () => {
    await render(<LoginScreen />);
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeTruthy();
    expect(screen.queryByText('Ingresar con Google')).toBeNull();
    expect(screen.queryByLabelText('Ingresar con Google')).toBeNull();
  });

  it('R51-03: contiene el logotipo de Google oculto a los lectores de pantalla', async () => {
    await render(<LoginScreen />);
    const button = screen.getByRole('button', { name: 'Continuar con Google' });
    expect(button.props.accessibilityLabel).toBe('Continuar con Google');
    const logo = screen.getByTestId('google-logo', { includeHiddenElements: true });
    expect(logo.props.importantForAccessibility).toBe('no');
    expect(logo.props.accessibilityElementsHidden).toBe(true);
    expect(flat(logo)).toMatchObject({ width: sizes.googleLogo, height: sizes.googleLogo });
    expect(logo.props.resizeMode).toBe('contain');
    // Con el logo oculto, el único elemento accesible con ese nombre es el botón.
    expect(screen.getAllByLabelText('Continuar con Google')).toHaveLength(1);
  });

  it('estilo de la guía de marca de Google: colores, 52 dp, radio 12, borde 1.5', async () => {
    await render(<LoginScreen />);
    const style = flat(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(style).toMatchObject({
      backgroundColor: brandGoogle.bg,
      borderColor: brandGoogle.border,
      borderWidth: 1.5,
      borderRadius: 12,
      minHeight: sizes.primaryTall,
    });
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(flat(screen.getByText('Continuar con Google'))).toMatchObject({
      color: brandGoogle.text,
      fontSize: 16,
      fontWeight: '600',
    });
  });

  it('R51-04: un toque llama a signIn una vez', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('R51-04: ocupado muestra login-loading y «Ingresando…», deshabilitado, y no llama a signIn', async () => {
    Object.assign(mockAuth, { busy: true });
    await render(<LoginScreen />);
    expect(screen.getByTestId('login-loading')).toBeTruthy();
    expect(screen.getByText('Ingresando…')).toBeTruthy();
    expect(screen.queryByTestId('google-logo', { includeHiddenElements: true })).toBeNull();
    const button = screen.getByRole('button', { name: 'Ingresando…' });
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(flat(button).opacity).toBe(0.6);
    await fireEvent.press(button);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('R51-06: el contenido está en un ScrollView que conserva los toques', async () => {
    await render(<LoginScreen />);
    const scroll = screen.getByTestId('login-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      justifyContent: 'center',
    });
  });
});

describe('LoginScreen: avisos y errores (R51-05)', () => {
  it('error: texto de AUTH_ERROR_MESSAGES con rol alert y botón activo para reintentar', async () => {
    Object.assign(mockAuth, { error: 'network' });
    await render(<LoginScreen />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(AUTH_ERROR_MESSAGES.network);
    expect(flat(alert)).toMatchObject({ color: colors.expenseText });
    const button = screen.getByRole('button', { name: 'Continuar con Google' });
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
  });

  it('aviso de cierre no confirmado con caja amarilla', async () => {
    Object.assign(mockAuth, { notice: 'logout-unconfirmed' });
    await render(<LoginScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      LOGOUT_NOTICE_MESSAGES['logout-unconfirmed'],
    );
    expect(flat(screen.getByRole('alert'))).toMatchObject({ color: colors.yellowText });
  });

  it('motivo de cierre (sesión revocada) solo si no hay error ni aviso', async () => {
    Object.assign(mockAuth, { signedOutReason: 'revoked' });
    const first = await render(<LoginScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/ya no está disponible/);
    await first.unmount();

    Object.assign(mockAuth, { error: 'rejected' });
    await render(<LoginScreen />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/ya no está disponible/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERROR_MESSAGES.rejected);
  });

  it('sin error, aviso ni motivo no hay cajas de alerta', async () => {
    await render(<LoginScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('los avisos van antes del botón en el orden visual', async () => {
    Object.assign(mockAuth, { error: 'server' });
    await render(<LoginScreen />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf(AUTH_ERROR_MESSAGES.server)).toBeLessThan(
      tree.indexOf('Continuar con Google'),
    );
    expect(tree.indexOf('Continuar con Google')).toBeLessThan(
      tree.indexOf('No vemos tu contraseña'),
    );
  });
});
