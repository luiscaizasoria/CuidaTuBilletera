import { Dimensions, Platform, StatusBar, useWindowDimensions } from 'react-native';

// Respaldos (dp) cuando el sistema no informa las alturas. Mejor esfuerzo: la validación real es en teléfono.
export const FALLBACK_TOP_DP = 24;
export const FALLBACK_BOTTOM_DP = 48;

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
  const top = statusBarH && statusBarH > 0 ? statusBarH : FALLBACK_TOP_DP;
  const bottom = Math.max(0, screenH - windowH - top);
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
