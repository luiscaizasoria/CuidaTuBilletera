import { useContext } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

// Respaldos (dp) solo para cuando no hay `SafeAreaProvider` o el valor del sistema no es utilizable
// (no finito o negativo). Con provider, los insets reales mandan; un 0 legítimo se respeta
// (p. ej. barra de navegación oculta, docs/003 D17).
export const FALLBACK_TOP_DP = 32;
export const FALLBACK_BOTTOM_DP = 48;

export type Insets = { top: number; bottom: number };

type RawInsets = { top?: number; bottom?: number } | null | undefined;

function usable(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function resolveInsets({
  insets,
  platform,
}: {
  insets: RawInsets;
  platform: string;
}): Insets {
  if (platform !== 'android') return { top: 0, bottom: 0 };
  return {
    top: usable(insets?.top, FALLBACK_TOP_DP),
    bottom: usable(insets?.bottom, FALLBACK_BOTTOM_DP),
  };
}

// Márgenes de sistema reales (react-native-safe-area-context). Se usa el contexto directo para que,
// sin provider (pruebas), se obtenga el respaldo en lugar de lanzar una excepción.
export function useSystemInsets(): Insets {
  const insets = useContext(SafeAreaInsetsContext);
  return resolveInsets({ insets, platform: Platform.OS });
}
