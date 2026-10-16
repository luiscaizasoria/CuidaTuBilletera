// Confirmación al descartar formularios (docs/003 Rediseño R3 D1 y D4). Cada pantalla de formulario
// usa este hook: registra un listener local de Atrás que tiene prioridad sobre el del navegador
// (los listeners se llaman del más reciente al más antiguo) y ofrece `requestLeave` para «✕», «‹» y
// «Cancelar».
import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';

export const DISCARD_STAY = 'Seguir editando';
export const DISCARD_LEAVE = 'Descartar';

export function useDiscardGuard({
  dirty,
  busy,
  onLeave,
  title,
  message,
}: {
  // Hay cambios sin guardar respecto de la instantánea inicial.
  dirty: boolean;
  // Se está guardando: no se permite salir ni se muestra el diálogo.
  busy: boolean;
  // Salida real (sin preguntar).
  onLeave: () => void;
  title: string;
  message: string;
}) {
  const latest = useRef({ dirty, busy, onLeave, title, message });
  latest.current = { dirty, busy, onLeave, title, message };
  const dialogOpen = useRef(false);
  // Acción que se ejecuta al confirmar «Descartar» (por defecto, la salida del formulario).
  const pendingAction = useRef<(() => void) | null>(null);

  // Abre el diálogo de descarte, salvo que ya haya uno abierto (evita diálogos duplicados).
  const confirmDiscard = useCallback((action?: () => void) => {
    if (dialogOpen.current) return;
    dialogOpen.current = true;
    pendingAction.current = action ?? null;
    const close = () => {
      dialogOpen.current = false;
      pendingAction.current = null;
    };
    Alert.alert(
      latest.current.title,
      latest.current.message,
      [
        { text: DISCARD_STAY, style: 'cancel', onPress: close },
        {
          text: DISCARD_LEAVE,
          style: 'destructive',
          onPress: () => {
            const action = pendingAction.current ?? latest.current.onLeave;
            close();
            action();
          },
        },
      ],
      // Cerrar fuera del diálogo o con Atrás equivale a «Seguir editando».
      { cancelable: true, onDismiss: close },
    );
  }, []);

  // «✕», «‹» y «Cancelar»: ignorados mientras se guarda; con cambios piden confirmar. `action`
  // permite salir hacia otro destino (p. ej. «Ir a Categorías») con la misma confirmación.
  const requestLeave = useCallback(
    (action?: () => void) => {
      const { busy: isBusy, dirty: isDirty, onLeave: leave } = latest.current;
      if (isBusy) return;
      // `onPress={requestLeave}` entregaría el evento como argumento: solo se acepta una función.
      const target = typeof action === 'function' ? action : undefined;
      if (isDirty) confirmDiscard(target);
      else (target ?? leave)();
    },
    [confirmDiscard],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const { busy: isBusy, dirty: isDirty } = latest.current;
      if (isBusy) return true;
      if (isDirty || dialogOpen.current) {
        confirmDiscard();
        return true;
      }
      return false; // sin cambios: el navegador resuelve Atrás
    });
    return () => subscription.remove();
  }, [confirmDiscard]);

  return { requestLeave };
}
