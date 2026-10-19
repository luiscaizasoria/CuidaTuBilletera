import { requireOptionalNativeModule } from 'expo';

// Modo inmersivo de la barra de navegación del sistema (docs/003 D17). Único módulo que carga
// `expo-navigation-bar`, y lo hace de forma diferida: importarlo a nivel superior lanza
// "Cannot find native module 'ExpoNavigationBar'" al arrancar si la APK instalada no lo incluye
// (pantalla roja antes del login). Aquí la función es opcional: sin módulo nativo se desactiva.

type NavigationBarApi = { setHidden: (hidden: boolean) => void };

let navigationBar: NavigationBarApi | null | undefined;

function loadNavigationBar(): NavigationBarApi | null {
  if (navigationBar !== undefined) return navigationBar;
  navigationBar = null;
  try {
    if (requireOptionalNativeModule('ExpoNavigationBar') == null) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    navigationBar = (require('expo-navigation-bar') as { NavigationBar: NavigationBarApi })
      .NavigationBar;
  } catch {
    navigationBar = null;
  }
  return navigationBar;
}

// Oculta solo en Android, sin lector de pantalla (TalkBack) y con el teclado cerrado.
export function shouldHideNavigationBar({
  platform,
  screenReaderEnabled,
  keyboardOpen,
}: {
  platform: string;
  screenReaderEnabled: boolean;
  keyboardOpen: boolean;
}): boolean {
  return platform === 'android' && !screenReaderEnabled && !keyboardOpen;
}

// Degrada en silencio: un fallo nativo nunca debe romper la app (la barra simplemente queda visible).
export function applyNavigationBarHidden(hidden: boolean): void {
  try {
    loadNavigationBar()?.setHidden(hidden);
  } catch {
    // sin efecto
  }
}
