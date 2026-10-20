// Hoja «Eliminar mi cuenta y mis datos» (G1; docs/010 §24: ELIM-b a ELIM-d, e, h, i, m, r).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, BackHandler, Keyboard, Linking, ScrollView } from 'react-native';
import {
  DELETE_CANCELLED_MESSAGE,
  DELETE_REAUTH_PROGRESS,
  DELETE_UNCERTAIN_MESSAGE,
  deleteFailureMessage,
} from '../lib/account-deletion-messages';
import type { DeleteAccountResult } from '../lib/auth-service';
import { controlledPromise, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import { OPEN_LINK_ERROR } from '../lib/external-link';
import DeleteAccountSheet from './delete-account-sheet';

relaxTimeoutsForColdCache();

const mockDelete = jest.fn();
jest.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ deleteAccount: mockDelete, user: { id: 'u', email: 'ana@example.com' } }),
}));
const mockLinks = {
  privacyPolicyUrl: null as string | null,
  accountDeletionUrl: null as string | null,
};
jest.mock('../lib/config', () => ({ readLegalLinks: () => mockLinks }));

const onClose = jest.fn();
const onNotify = jest.fn();
const open = (visible = true) =>
  render(<DeleteAccountSheet visible={visible} onClose={onClose} onNotify={onNotify} />);
const confirmButton = () => screen.getByRole('button', { name: 'Eliminar definitivamente' });
const field = () => screen.getByLabelText('Escribe ELIMINAR para confirmar');
const type = (value: string) => fireEvent.changeText(field(), value);
const failed = (reason: string, uncertain = false) =>
  ({ status: 'failed', reason, uncertain }) as DeleteAccountResult;

beforeEach(() => {
  mockWindow(411, 1, 800);
  mockDelete.mockReset();
  mockLinks.privacyPolicyUrl = null;
  mockLinks.accountDeletionUrl = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('DeleteAccountSheet: contenido', () => {
  it('cerrada no renderiza nada', async () => {
    await open(false);
    expect(screen.queryByTestId('delete-account-sheet')).toBeNull();
  });

  it('título, advertencia, qué se elimina y qué no, alternativa y aviso de Google', async () => {
    await open();
    expect(screen.getByRole('header', { name: 'Eliminar mi cuenta y mis datos' })).toBeTruthy();
    expect(screen.getByText('Esto no se puede deshacer.')).toBeTruthy();
    expect(
      screen.getByText(/cuentas, categorías y movimientos \(incluidos los anulados/),
    ).toBeTruthy();
    expect(screen.getByText(/archivos que ya exportaste y tu cuenta de Google/)).toBeTruthy();
    expect(screen.getByText(/archivarla.*cierra sesión.*exportar/)).toBeTruthy();
    expect(
      screen.getByText('Después te pediremos elegir tu cuenta de Google para verificar la cuenta.'),
    ).toBeTruthy();
    expect(screen.queryByText(/cerrar la app/)).toBeNull();
  });

  it('sin URL de eliminación no hay enlace ni «próximamente»', async () => {
    await open();
    expect(screen.queryByText('Ver cómo solicitar la eliminación sin la app')).toBeNull();
    expect(screen.queryByText(/próximamente/i)).toBeNull();
  });

  it('con URL válida el enlace abre el navegador; si falla, avisa sin romper la hoja', async () => {
    mockLinks.accountDeletionUrl = 'https://ejemplo.test/eliminar';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver cómo solicitar la eliminación sin la app' }),
    );
    expect(openURL).toHaveBeenCalledWith('https://ejemplo.test/eliminar');
    openURL.mockRejectedValue(new Error('sin navegador'));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver cómo solicitar la eliminación sin la app' }),
    );
    expect(onNotify).toHaveBeenCalledWith('No pudimos abrir el enlace.');
    expect(screen.getByText('No pudimos abrir el enlace.')).toBeTruthy();
    expect(screen.getByTestId('delete-account-sheet')).toBeTruthy();
  });
});

describe('DeleteAccountSheet: campo de confirmación (ELIM-i)', () => {
  it('sin autocorrección, autocompletado ni teclado de contraseña; «Hecho» solo cierra el teclado', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    await open();
    const input = field();
    expect(input.props).toMatchObject({
      autoCapitalize: 'characters',
      autoCorrect: false,
      autoComplete: 'off',
      importantForAutofill: 'no',
      spellCheck: false,
      returnKeyType: 'done',
    });
    expect(input.props.secureTextEntry).toBeUndefined();
    expect(input.props.keyboardType).toBeUndefined();
    await type('ELIMINAR');
    await fireEvent(input, 'submitEditing');
    expect(dismiss).toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('el botón está deshabilitado hasta coincidir (ELIM-b)', async () => {
    mockDelete.mockResolvedValue({ status: 'cancelled' });
    await open();
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    await type('ELIMINA');
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    for (const value of ['eliminar', ' ELIMINAR ', 'Eliminar']) {
      await type(value);
      expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: false });
    }
    await fireEvent.press(confirmButton());
    // sin coincidencia no se llama
    mockDelete.mockClear();
    await type('ELIMINA');
    await fireEvent.press(confirmButton());
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountSheet: envío', () => {
  it('llama una sola vez al servicio, muestra «Eliminando…» y bloquea el doble toque (ELIM-d)', async () => {
    const gate = controlledPromise<DeleteAccountResult>();
    mockDelete.mockReturnValue(gate.promise);
    await open();
    await type('eliminar');
    await fireEvent.press(confirmButton());
    await fireEvent.press(confirmButton());
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('Eliminando…')).toBeTruthy();
    expect(screen.getByText('Elige tu cuenta de Google para verificar la cuenta')).toBeTruthy();
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(field().props.editable).toBe(false);
    await act(async () => gate.resolve({ status: 'deleted' }));
  });

  it('cancelar el selector: texto neutro, botón habilitado y texto conservado', async () => {
    mockDelete.mockResolvedValue({ status: 'cancelled' });
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(DELETE_CANCELLED_MESSAGE)).toBeTruthy();
    expect(field().props.value).toBe('ELIMINAR');
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: false });
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    'reauth-required',
    'network',
    'timeout',
    'server',
    'invalid-request',
    'play-services',
    'config',
    'in-progress',
    'unknown',
  ] as const)(
    'fallo "%s": mensaje con rol alert, hoja abierta, texto y botón conservados (ELIM-e)',
    async (reason) => {
      mockDelete.mockResolvedValue(failed(reason));
      await open();
      await type('ELIMINAR');
      await fireEvent.press(confirmButton());
      const message = deleteFailureMessage(reason, false, 'ana@example.com');
      const node = await screen.findByText(message);
      expect(node.props.accessibilityRole).toBe('alert');
      expect(message).toContain('No se eliminó nada');
      expect(field().props.value).toBe('ELIMINAR');
      expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: false });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText('Comprobar y reintentar')).toBeNull();
    },
  );

  it('reauth-required nombra el correo de la sesión', async () => {
    mockDelete.mockResolvedValue(failed('reauth-required'));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(/ana@example\.com/)).toBeTruthy();
  });

  it('incierto: «No pudimos confirmar…» y el botón pasa a «Comprobar y reintentar» con afterUncertain', async () => {
    mockDelete.mockResolvedValueOnce(failed('network', true));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(DELETE_UNCERTAIN_MESSAGE)).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Comprobar y reintentar' });
    mockDelete.mockResolvedValueOnce({ status: 'deleted' });
    await fireEvent.press(retry);
    expect(mockDelete).toHaveBeenLastCalledWith({ afterUncertain: true });
  });

  it('tras un incierto, un fallo de red al sondear mantiene «Comprobar y reintentar» y vuelve a sondear (D-2)', async () => {
    mockDelete.mockResolvedValueOnce(failed('server', true));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    await screen.findByText(DELETE_UNCERTAIN_MESSAGE);
    mockDelete.mockResolvedValueOnce(failed('network', true));
    await fireEvent.press(screen.getByRole('button', { name: 'Comprobar y reintentar' }));
    await screen.findByText(DELETE_UNCERTAIN_MESSAGE);
    mockDelete.mockResolvedValueOnce({ status: 'deleted' });
    await fireEvent.press(screen.getByRole('button', { name: 'Comprobar y reintentar' }));
    expect(mockDelete).toHaveBeenNthCalledWith(2, { afterUncertain: true });
    expect(mockDelete).toHaveBeenNthCalledWith(3, { afterUncertain: true });
  });

  it.each([
    ['cancelled', { status: 'cancelled' } as DeleteAccountResult],
    ['timeout del selector', failed('timeout')],
    ['red previa al envío', failed('network')],
  ])(
    'tras un incierto, «%s» conserva la marca: mensaje de incierto y «Comprobar y reintentar» (D3)',
    async (_name, result) => {
      mockDelete.mockResolvedValueOnce(failed('server', true));
      await open();
      await type('ELIMINAR');
      await fireEvent.press(confirmButton());
      await screen.findByText(DELETE_UNCERTAIN_MESSAGE);
      mockDelete.mockResolvedValueOnce(result);
      await fireEvent.press(screen.getByRole('button', { name: 'Comprobar y reintentar' }));
      expect(await screen.findByText(DELETE_UNCERTAIN_MESSAGE)).toBeTruthy();
      expect(screen.queryByText(DELETE_CANCELLED_MESSAGE)).toBeNull();
      mockDelete.mockResolvedValueOnce({ status: 'deleted' });
      await fireEvent.press(screen.getByRole('button', { name: 'Comprobar y reintentar' }));
      expect(mockDelete).toHaveBeenLastCalledWith({ afterUncertain: true });
    },
  );

  it('sin intento incierto previo, «cancelled» muestra el texto neutro y no marca incierto', async () => {
    mockDelete.mockResolvedValueOnce({ status: 'cancelled' });
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    await screen.findByText(DELETE_CANCELLED_MESSAGE);
    expect(screen.queryByText('Comprobar y reintentar')).toBeNull();
  });

  it('el motivo "timeout" tiene texto propio, distinto del de red', async () => {
    mockDelete.mockResolvedValue(failed('timeout'));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(
      await screen.findByText(
        'No recibimos respuesta de Google a tiempo. No se eliminó nada. Inténtalo de nuevo.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/No se pudo conectar con el servidor/)).toBeNull();
  });

  it('éxito o sesión caducada: no pinta errores (la app ya vuelve al Login)', async () => {
    mockDelete.mockResolvedValue({ status: 'session-expired' });
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(screen.queryByText(/No se eliminó nada/)).toBeNull();
  });

  it('un servicio que lanza se trata como incierto', async () => {
    mockDelete.mockRejectedValue(new Error('boom'));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(DELETE_UNCERTAIN_MESSAGE)).toBeTruthy();
  });
});

describe('DeleteAccountSheet: salida (ELIM-h)', () => {
  it('con el campo vacío «Cancelar» cierra sin diálogo', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('con texto escrito, Cancelar, el velo y Atrás piden confirmar el descarte', async () => {
    await open();
    await type('ELI');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('descartar desde el diálogo cierra la hoja', async () => {
    (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) =>
      buttons?.find((b: { text: string }) => b.text === 'Descartar')?.onPress?.(),
    );
    await open();
    await type('ELI');
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Atrás sin texto cierra la hoja', async () => {
    const handlers: Array<() => boolean> = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _e: string,
      h: () => boolean,
    ) => {
      handlers.push(h);
      return { remove: jest.fn() };
    }) as never);
    await open();
    // El listener más reciente se consulta primero (el guard); si no interviene, el siguiente.
    const result = [...handlers].reverse().find((h) => h());
    expect(result).toBeDefined();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mientras elimina, Cancelar, velo y Atrás se ignoran', async () => {
    const handlers: Array<() => boolean> = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _e: string,
      h: () => boolean,
    ) => {
      handlers.push(h);
      return { remove: jest.fn() };
    }) as never);
    mockDelete.mockReturnValue(new Promise(() => undefined));
    await open();
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(screen.getByRole('button', { name: 'Cancelar' }).props.accessibilityState).toMatchObject(
      {
        disabled: true,
      },
    );
    for (const handler of handlers) expect(handler()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountSheet: distribución', () => {
  it('fuente 2 y teclado abierto: título, campo y botones viven dentro del scroll (D-1)', async () => {
    mockWindow(320, 2, 568);
    let onShow: (() => void) | undefined;
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, h: () => void) => {
      if (event === 'keyboardDidShow') onShow = h;
      return { remove: jest.fn() };
    }) as never);
    await open();
    await act(async () => onShow?.());
    const scroll = screen.getByTestId('delete-account-scroll');
    expect(within(scroll).getByRole('header')).toBeTruthy();
    expect(within(scroll).getByLabelText('Escribe ELIMINAR para confirmar')).toBeTruthy();
    expect(within(scroll).getByRole('button', { name: 'Eliminar definitivamente' })).toBeTruthy();
    expect(within(scroll).getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.queryByTestId('delete-account-footer')).toBeNull();
  });

  it('fuente 1 sin teclado: el pie sigue fijo fuera del scroll (D-1)', async () => {
    await open();
    const footer = screen.getByTestId('delete-account-footer');
    expect(within(footer).getByRole('button', { name: 'Eliminar definitivamente' })).toBeTruthy();
    expect(
      within(screen.getByTestId('delete-account-scroll')).queryByRole('button', {
        name: 'Eliminar definitivamente',
      }),
    ).toBeNull();
  });

  it('live regions: progreso polite, mensaje y error del enlace assertive (D4)', async () => {
    mockLinks.accountDeletionUrl = 'https://ejemplo.test/eliminar';
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('x'));
    const gate = controlledPromise<DeleteAccountResult>();
    mockDelete.mockReturnValue(gate.promise);
    await open();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver cómo solicitar la eliminación sin la app' }),
    );
    expect((await screen.findByText(OPEN_LINK_ERROR)).props.accessibilityLiveRegion).toBe(
      'assertive',
    );
    await type('ELIMINAR');
    await fireEvent.press(confirmButton());
    const progress = await screen.findByText(DELETE_REAUTH_PROGRESS);
    expect(progress.props.accessibilityLiveRegion).toBe('polite');
    await act(async () => gate.resolve(failed('server')));
    const message = await screen.findByText(deleteFailureMessage('server', false));
    expect(message.props.accessibilityLiveRegion).toBe('assertive');
  });

  describe('scroll a posiciones medidas (D1)', () => {
    const layout = (y: number) => ({
      nativeEvent: { layout: { x: 0, y, width: 300, height: 40 } },
    });
    let scrollTo: jest.Mock;
    let onShow: (() => void) | undefined;
    const openCompact = async () => {
      mockWindow(320, 2, 568);
      // El mock de ScrollView de Jest comparte un jest.fn de `scrollTo` en el prototipo.
      scrollTo = (ScrollView.prototype as unknown as { scrollTo: jest.Mock }).scrollTo;
      scrollTo.mockClear();
      jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, h: () => void) => {
        if (event === 'keyboardDidShow') onShow = h;
        return { remove: jest.fn() };
      }) as never);
      await open();
      await fireEvent(screen.getByTestId('delete-account-inline-footer'), 'layout', layout(500));
    };
    const frames = () =>
      act(async () => new Promise<void>((r) => requestAnimationFrame(() => r())));

    it('al enfocar el campo desplaza a la y medida del pie (no al final)', async () => {
      await openCompact();
      await fireEvent(field(), 'focus');
      await frames();
      expect(scrollTo).toHaveBeenCalledWith({ y: 500, animated: true });
    });

    it('al abrirse el teclado (keyboardDidShow) desplaza a la y del pie', async () => {
      await openCompact();
      await act(async () => onShow?.());
      await frames();
      expect(scrollTo).toHaveBeenCalledWith({ y: 500, animated: true });
    });

    it('el mensaje de error desplaza a su inicio (y del pie + y del mensaje)', async () => {
      await openCompact();
      mockDelete.mockResolvedValue(failed('server'));
      await type('ELIMINAR');
      await fireEvent.press(confirmButton());
      const message = await screen.findByText(deleteFailureMessage('server', false));
      await fireEvent(message, 'layout', layout(120));
      await frames();
      expect(scrollTo).toHaveBeenCalledWith({ y: 620, animated: true });
    });
  });

  it('cuerpo desplazable y pie fijo con el campo y los botones', async () => {
    await open();
    expect(screen.getByTestId('delete-account-scroll')).toBeTruthy();
    const footer = screen.getByTestId('delete-account-footer');
    expect(footer).toBeTruthy();
    expect(screen.getByText('Para confirmar, escribe ELIMINAR')).toBeTruthy();
  });

  it('con fuente >= 1,3 los botones se apilan; sin ella y con ventana baja van en fila', async () => {
    mockWindow(411, 1.3, 800);
    const view = await open();
    expect(screen.getByTestId('delete-account-inline-footer')).toBeTruthy();
    await view.unmount();
    mockWindow(411, 1, 400);
    await open();
    expect(confirmButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  });
});
