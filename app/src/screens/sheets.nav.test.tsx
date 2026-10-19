// El Sheet cubre también la barra de navegación del sistema (docs/003 D17).
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Sheet } from './sheets';

describe('Sheet y barra de navegación', () => {
  it('el Modal usa navigationBarTranslucent junto con statusBarTranslucent', async () => {
    await render(
      <Sheet visible onClose={jest.fn()} accessibilityLabel="Prueba" testID="sheet-modal">
        <Text>Contenido</Text>
      </Sheet>,
    );
    const modal = screen.getByTestId('sheet-modal');
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
  });
});
