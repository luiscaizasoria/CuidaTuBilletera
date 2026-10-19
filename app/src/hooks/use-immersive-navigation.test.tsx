import { act, render } from '@testing-library/react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { AccessibilityInfo, AppState, Keyboard, Platform } from 'react-native';
import { useImmersiveNavigation } from './use-immersive-navigation';

const setHidden = NavigationBar.setHidden as jest.Mock;

function Probe() {
  useImmersiveNavigation();
  return null;
}

type Handler = (arg?: unknown) => void;
const originalOS = Platform.OS;
let handlers: Record<string, Handler>;
const fire = (name: string, arg?: unknown) => handlers[name]?.(arg);
let removes: jest.Mock[];
let screenReader: boolean | 'error';

beforeEach(() => {
  setHidden.mockReset();
  handlers = {};
  removes = [];
  screenReader = false;
  const subscribe = (_t: unknown, name: string, fn: Handler) => {
    handlers[name] = fn;
    const remove = jest.fn();
    removes.push(remove);
    return { remove };
  };
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockImplementation(() =>
      screenReader === 'error' ? Promise.reject(new Error('x')) : Promise.resolve(screenReader),
    );
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(((name: string, fn: Handler) => subscribe(null, name, fn)) as never);
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation(((name: string, fn: Handler) => subscribe(null, name, fn)) as never);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(((name: string, fn: Handler) => subscribe(null, name, fn)) as never);
});

afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

describe('useImmersiveNavigation', () => {
  describe('Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('oculta la barra al montar, una sola vez', async () => {
      const view = await render(<Probe />);
      expect(setHidden.mock.calls).toEqual([[true]]);
      await view.rerender(<Probe />);
      await view.rerender(<Probe />);
      expect(setHidden).toHaveBeenCalledTimes(1);
    });

    it('con TalkBack la revela y al apagarlo vuelve a ocultar', async () => {
      screenReader = true;
      await render(<Probe />);
      expect(setHidden.mock.calls.at(-1)).toEqual([false]);
      await act(async () => fire('screenReaderChanged', false));
      expect(setHidden.mock.calls.at(-1)).toEqual([true]);
      await act(async () => fire('screenReaderChanged', true));
      expect(setHidden.mock.calls.at(-1)).toEqual([false]);
    });

    it('si falla isScreenReaderEnabled se asume apagado', async () => {
      screenReader = 'error';
      await render(<Probe />);
      expect(setHidden.mock.calls.at(-1)).toEqual([true]);
    });

    it('con el teclado abierto la revela y al cerrarlo oculta', async () => {
      await render(<Probe />);
      await act(async () => fire('keyboardDidShow'));
      expect(setHidden.mock.calls.at(-1)).toEqual([false]);
      await act(async () => fire('keyboardDidHide'));
      expect(setHidden.mock.calls.at(-1)).toEqual([true]);
    });

    it('background/inactive reinician la caché con false y active reaplica true', async () => {
      await render(<Probe />);
      setHidden.mockClear();
      await act(async () => fire('change', 'background'));
      expect(setHidden.mock.calls).toEqual([[false]]);
      await act(async () => fire('change', 'active'));
      expect(setHidden.mock.calls).toEqual([[false], [true]]);
      setHidden.mockClear();
      await act(async () => fire('change', 'inactive'));
      await act(async () => fire('change', 'active'));
      expect(setHidden.mock.calls).toEqual([[false], [true]]);
    });

    it('con el teclado abierto al volver a active solo aplica false', async () => {
      await render(<Probe />);
      await act(async () => fire('keyboardDidShow'));
      setHidden.mockClear();
      await act(async () => fire('change', 'background'));
      await act(async () => fire('change', 'active'));
      expect(setHidden.mock.calls).toEqual([[false], [false]]);
    });

    it('con TalkBack al volver a active solo aplica false', async () => {
      screenReader = true;
      await render(<Probe />);
      setHidden.mockClear();
      await act(async () => fire('change', 'background'));
      await act(async () => fire('change', 'active'));
      expect(setHidden.mock.calls).toEqual([[false], [false]]);
    });

    it('un error nativo en el cambio de AppState no se propaga', async () => {
      await render(<Probe />);
      setHidden.mockImplementation(() => {
        throw new Error('nativo');
      });
      await act(async () => fire('change', 'background'));
      await act(async () => fire('change', 'active'));
    });

    it('al desmontar elimina los listeners', async () => {
      const view = await render(<Probe />);
      expect(removes).toHaveLength(4);
      await view.unmount();
      for (const remove of removes) expect(remove).toHaveBeenCalledTimes(1);
    });

    it('un error nativo no rompe el render', async () => {
      setHidden.mockImplementation(() => {
        throw new Error('nativo');
      });
      await expect(render(<Probe />)).resolves.toBeDefined();
    });
  });

  it('fuera de Android no hace nada', async () => {
    Platform.OS = 'ios';
    await render(<Probe />);
    expect(setHidden).not.toHaveBeenCalled();
    expect(Object.keys(handlers)).toHaveLength(0);
  });
});
