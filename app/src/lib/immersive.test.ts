import { NavigationBar } from 'expo-navigation-bar';
import { applyNavigationBarHidden, shouldHideNavigationBar } from './immersive';

const setHidden = NavigationBar.setHidden as jest.Mock;

describe('shouldHideNavigationBar', () => {
  it.each([
    ['android', false, false, true],
    ['android', true, false, false],
    ['android', false, true, false],
    ['android', true, true, false],
    ['ios', false, false, false],
    ['web', false, false, false],
  ])('%s lector=%s teclado=%s -> %s', (platform, screenReaderEnabled, keyboardOpen, expected) => {
    expect(shouldHideNavigationBar({ platform, screenReaderEnabled, keyboardOpen })).toBe(expected);
  });
});

describe('applyNavigationBarHidden', () => {
  beforeEach(() => setHidden.mockReset());

  it('delega en setHidden', () => {
    applyNavigationBarHidden(true);
    applyNavigationBarHidden(false);
    expect(setHidden.mock.calls).toEqual([[true], [false]]);
  });

  it('una excepción nativa se absorbe en silencio', () => {
    setHidden.mockImplementation(() => {
      throw new Error('nativo');
    });
    expect(() => applyNavigationBarHidden(true)).not.toThrow();
  });
});

describe('applyNavigationBarHidden sin módulo nativo (APK sin ExpoNavigationBar)', () => {
  const load = (probe: () => unknown, navBarFactory?: () => unknown) => {
    let apply!: (hidden: boolean) => void;
    jest.isolateModules(() => {
      jest.doMock('expo', () => ({ requireOptionalNativeModule: probe }));
      if (navBarFactory) jest.doMock('expo-navigation-bar', navBarFactory);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      apply = require('./immersive').applyNavigationBarHidden;
    });
    return apply;
  };
  afterEach(() => {
    jest.dontMock('expo');
    jest.dontMock('expo-navigation-bar');
  });

  it('no carga expo-navigation-bar ni lanza si el módulo nativo no existe', () => {
    const factory = jest.fn(() => {
      throw new Error("Cannot find native module 'ExpoNavigationBar'");
    });
    const apply = load(() => null, factory);
    expect(() => apply(true)).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('absorbe un fallo al cargar el paquete aunque el módulo nativo exista', () => {
    const apply = load(
      () => ({}),
      () => {
        throw new Error('carga');
      },
    );
    expect(() => apply(true)).not.toThrow();
  });
});
