import { Dimensions, Platform, StatusBar, useWindowDimensions } from 'react-native';

// Respaldos (dp) cuando el sistema no informa las alturas. Mejor esfuerzo: la validación real es en teléfono.
// MITIGACIÓN PROVISIONAL (R5.1, docs/003 D11.7 y docs/008 §6.15.6): el margen superior es el mayor entre
// la altura que informa el sistema y 32 dp (antes 24), porque en teléfonos con recorte el encabezado
// quedaba bajo la barra de estado. 32 dp es una hipótesis sin medir en el teléfono. La corrección exacta
// (`react-native-safe-area-context`) está BLOQUEADA hasta que el usuario autorice la dependencia nativa
// y una Development Build nueva; entonces este respaldo solo quedará para pruebas.
export const FALLBACK_TOP_DP = 32;
export const FALLBACK_BOTTOM_DP = 48;
// Altura de barra de estado que se asume solo para estimar el margen inferior cuando el sistema no la
// informa (valor histórico; no afecta al margen superior).
const ASSUMED_STATUS_BAR_DP = 24;

export type Insets = { top: number; bottom: number };

export function computeInsets({
  screenH,
  windowH,
  statusBarH,
  platform,
}: {
  screenH: number;
  windowH: number;
  statusBarH?: number | null;
  platform: string;
}): Insets {
  if (platform !== 'android') return { top: 0, bottom: 0 };
  const reported = statusBarH && statusBarH > 0 ? statusBarH : 0;
  const top = Math.max(reported, FALLBACK_TOP_DP);
  const bottom = Math.max(0, screenH - windowH - (reported > 0 ? reported : ASSUMED_STATUS_BAR_DP));
  return { top, bottom: bottom > 0 ? bottom : FALLBACK_BOTTOM_DP };
}

// Márgenes de sistema aproximados sin librerías nativas (barra de estado y de navegación).
export function useSystemInsets(): Insets {
  const window = useWindowDimensions(); // fuerza el re-render al cambiar el tamaño de ventana
  return computeInsets({
    screenH: Dimensions.get('screen')?.height ?? window.height,
    windowH: window.height,
    statusBarH: StatusBar.currentHeight,
    platform: Platform.OS,
  });
}
