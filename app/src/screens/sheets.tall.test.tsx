// Variante `tall` de Sheet (R5.1, docs/008 §6.15.5): no cambia el comportamiento por defecto.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { mockWindow } from '../test-utils';
import { useSystemInsets } from '../theme/useSystemInsets';
import { Sheet } from './sheets';

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle &
    TextStyle;

beforeEach(() => mockWindow(360, 1));
afterEach(() => jest.restoreAllMocks());

function Probe({ tall, compact }: { tall?: boolean; compact?: boolean }) {
  return (
    <Sheet visible onClose={jest.fn()} accessibilityLabel="Prueba" tall={tall} compact={compact}>
      <Text>Contenido</Text>
    </Sheet>
  );
}

describe('Sheet tall', () => {
  it('por defecto no limita la altura', async () => {
    await render(<Probe />);
    expect(flat(screen.getByLabelText('Prueba')).maxHeight).toBeUndefined();
  });

  it('tall limita a 75 % de la ventana menos el margen superior', async () => {
    let top = 0;
    function Top() {
      top = useSystemInsets().top;
      return null;
    }
    await render(
      <>
        <Top />
        <Probe tall />
      </>,
    );
    expect(flat(screen.getByLabelText('Prueba')).maxHeight).toBe(0.75 * 800 - top);
  });

  it('tall compacto (teclado o ventana baja) sube el máximo a la ventana menos margen y 8 dp', async () => {
    let top = 0;
    function Top() {
      top = useSystemInsets().top;
      return null;
    }
    await render(
      <>
        <Top />
        <Probe tall compact />
      </>,
    );
    expect(flat(screen.getByLabelText('Prueba')).maxHeight).toBe(800 - top - 8);
  });
});
