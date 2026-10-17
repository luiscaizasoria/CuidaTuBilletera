// Cálculo puro de las flechas de la fila de grupos del selector de íconos (docs/007 §5.15.1).
// Jest no mide layout real: estas funciones se prueban con números y el layout se valida en el teléfono.

// Ancho de cada hueco de flecha (dp) y tolerancia en px al comparar posiciones.
export const ARROW_SLOT_DP = 48;
const EPSILON = 1;
// Fracción del ancho visible que desplaza cada toque (deja visible el último chip anterior).
export const SCROLL_STEP = 0.8;

export interface ChipArrows {
  // Hay algo que desplazar: se reservan los dos huecos de 48 dp.
  reserved: boolean;
  canLeft: boolean;
  canRight: boolean;
}

export const NO_ARROWS: ChipArrows = { reserved: false, canLeft: false, canRight: false };

// `viewport` es el ancho actual del ScrollView (ya sin huecos si estaban reservados).
export function chipArrows({
  x,
  viewport,
  content,
  reserved,
}: {
  x: number;
  viewport: number;
  content: number;
  reserved: boolean;
}): ChipArrows {
  // Antes de tener las medidas no se muestra ni se reserva nada (evita parpadeo).
  if (viewport <= 0 || content <= 0) return NO_ARROWS;
  const rowWidth = viewport + (reserved ? 2 * ARROW_SLOT_DP : 0);
  if (content <= rowWidth + EPSILON) return NO_ARROWS;
  return {
    reserved: true,
    canLeft: x > EPSILON,
    canRight: x + viewport < content - EPSILON,
  };
}

// Destino de un toque: 0,8 × viewport hacia el lado de la flecha, acotado a los extremos.
export function chipScrollTarget(
  from: number,
  direction: 'left' | 'right',
  viewport: number,
  content: number,
): number {
  const max = Math.max(0, content - viewport);
  const delta = SCROLL_STEP * viewport * (direction === 'right' ? 1 : -1);
  return Math.min(max, Math.max(0, from + delta));
}

// Desplazamiento mínimo para que un chip parcialmente cortado quede completo; null si ya se ve.
export function chipRevealTarget(
  x: number,
  viewport: number,
  chipX: number,
  chipWidth: number,
): number | null {
  if (chipX < x) return Math.max(0, chipX);
  if (chipX + chipWidth > x + viewport) return chipX + chipWidth - viewport;
  return null;
}

// Posición que centra un chip en la ventana (acotada a 0 por la izquierda).
export function chipCenterTarget(viewport: number, chipX: number, chipWidth: number): number {
  return Math.max(0, chipX + chipWidth / 2 - viewport / 2);
}
