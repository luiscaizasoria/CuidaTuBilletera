import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StatusBar, Text } from 'react-native';
import { Button, Card, Chip, Screen, Segmented, Snackbar } from './ui';
import { colors } from '../theme/tokens';
import { FALLBACK_TOP_DP } from '../theme/useSystemInsets';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'variante %s con rol y estado',
    async (variant) => {
      const onPress = jest.fn();
      await render(<Button label="Guardar" variant={variant} onPress={onPress} />);
      const b = screen.getByRole('button', { name: 'Guardar' });
      expect(b.props.accessibilityState).toEqual({ disabled: false });
      await fireEvent.press(b);
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it('primary usa brand700 y altura 52 con tall', async () => {
    await render(<Button label="Ok" variant="primary" tall onPress={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: colors.brand700,
      minHeight: 52,
    });
  });

  it('minHeight 48 por defecto', async () => {
    await render(<Button label="Ok" onPress={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: 48 });
  });

  it('disabled no ejecuta onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Ok" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toEqual({ disabled: true });
  });

  it('busy ignora la pulsación y expone busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Ok" busy onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(screen.getByRole('button')).toHaveStyle({ opacity: 0.5 });
  });
});

describe('Chip', () => {
  it('rol radio, estado y texto sin ✓', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Efectivo" selected onPress={onPress} />);
    const c = screen.getByRole('radio', { name: 'Efectivo' });
    expect(c.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(screen.getByText('Efectivo')).toBeTruthy();
    await fireEvent.press(c);
    expect(onPress).toHaveBeenCalled();
    expect(c).toHaveStyle({ minHeight: 48, borderWidth: 2 });
  });
});

describe('Card', () => {
  it('renderiza hijos con superficie y sombra', async () => {
    await render(
      <Card testID="card">
        <Text>Dentro</Text>
      </Card>,
    );
    expect(screen.getByText('Dentro')).toBeTruthy();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: colors.surface,
      elevation: 1,
    });
  });
  it('raised eleva más', async () => {
    await render(
      <Card raised testID="card">
        <Text>x</Text>
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveStyle({ elevation: 4 });
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'Uno' },
    { value: 'b', label: 'Dos', accessibilityLabel: 'Segunda' },
  ];

  it('radiogroup, ✓ solo en la seleccionada y etiqueta accesible sin ✓', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented options={options} value="a" onChange={onChange} accessibilityLabel="Tipo" />,
    );
    expect(screen.getByLabelText('Tipo').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByText('✓ Uno')).toBeTruthy();
    expect(screen.getByText('Dos')).toBeTruthy();
    expect(screen.queryByText('✓ Dos')).toBeNull();
    const first = screen.getByRole('radio', { name: 'Uno' });
    expect(first.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(screen.getByRole('radio', { name: 'Segunda' }).props.accessibilityState.selected).toBe(
      false,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Segunda' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('tonos de módulo usan el color del módulo', async () => {
    await render(
      <Segmented
        options={options}
        value="a"
        onChange={() => undefined}
        accessibilityLabel="T"
        tone="reportes"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Uno' })).toHaveStyle({ backgroundColor: '#ECE4FF' });
  });

  it('neutral usa superficie', async () => {
    await render(
      <Segmented options={options} value="a" onChange={() => undefined} accessibilityLabel="T" />,
    );
    expect(screen.getByRole('radio', { name: 'Uno' })).toHaveStyle({
      backgroundColor: colors.surface,
      minHeight: 48,
    });
  });

  it('disabled marca el estado', async () => {
    await render(
      <Segmented
        options={options}
        value="a"
        onChange={() => undefined}
        accessibilityLabel="T"
        disabled
      />,
    );
    expect(screen.getByRole('radio', { name: 'Uno' }).props.accessibilityState.disabled).toBe(true);
  });
});

describe('Snackbar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sin mensaje no renderiza', async () => {
    await render(<Snackbar message={null} onDismiss={() => undefined} testID="sb" />);
    expect(screen.queryByTestId('sb')).toBeNull();
  });

  it('llama a onDismiss tras la duración y expone alert/liveRegion', async () => {
    const onDismiss = jest.fn();
    await render(<Snackbar message="Guardado" onDismiss={onDismiss} testID="sb" />);
    const el = screen.getByTestId('sb');
    expect(el.props.accessibilityLiveRegion).toBe('polite');
    expect(el.props.accessibilityRole).toBe('alert');
    expect(screen.getByText('Guardado')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('limpia el temporizador al desmontar', async () => {
    const onDismiss = jest.fn();
    const view = await render(<Snackbar message="x" onDismiss={onDismiss} />);
    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Screen', () => {
  const original = StatusBar.currentHeight;
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'android';
  });
  afterEach(() => {
    Platform.OS = originalOS;
    (StatusBar as { currentHeight?: number }).currentHeight = original;
  });

  it('relleno superior con la altura de la barra de estado en Android', async () => {
    (StatusBar as { currentHeight?: number }).currentHeight = 30;
    await render(
      <Screen>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByTestId('screen-top-inset')).toHaveStyle({
      height: 30,
      backgroundColor: colors.bg,
    });
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it.each([0, undefined])('altura %s usa el respaldo', async (h) => {
    (StatusBar as { currentHeight?: number }).currentHeight = h;
    await render(
      <Screen statusBar="surface" scroll={false}>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByTestId('screen-top-inset')).toHaveStyle({
      height: FALLBACK_TOP_DP,
      backgroundColor: colors.surface,
    });
  });
});
