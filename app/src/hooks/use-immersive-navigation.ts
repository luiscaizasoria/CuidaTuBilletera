// Oculta la barra de navegación del sistema Android (docs/003 D17): al montar, en cada vuelta a
// primer plano, y la muestra con TalkBack o con el teclado abierto. No-op fuera de Android.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Keyboard, Platform } from 'react-native';
import { applyNavigationBarHidden, shouldHideNavigationBar } from '../lib/immersive';

export function useImmersiveNavigation(): void {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const hidden = shouldHideNavigationBar({
    platform: Platform.OS,
    screenReaderEnabled,
    keyboardOpen,
  });
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (!cancelled) setScreenReaderEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setScreenReaderEnabled(false);
      });
    const reader = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled,
    );
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      cancelled = true;
      reader.remove();
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    applyNavigationBarHidden(hidden);
  }, [hidden]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (state) => {
      // expo-navigation-bar cachea el valor en JS y omite la llamada nativa si no cambia. Android
      // puede revelar la barra en segundo plano, así que al salir de primer plano se reinicia la
      // caché con false (la app no es visible, sin parpadeo) y al volver se reaplica el valor vigente.
      if (state === 'active') applyNavigationBarHidden(hiddenRef.current);
      else applyNavigationBarHidden(false);
    });
    return () => sub.remove();
  }, []);
}
