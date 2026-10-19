import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  LoadingState,
  ModuleTile,
  MonthArrow,
  Screen,
  ScreenTitle,
  Segmented,
  Snackbar,
  SummaryTile,
} from './ui';
import { colors, moduleColors } from '../theme/tokens';
import { mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import { FALLBACK_TOP_DP } from '../theme/useSystemInsets';

relaxTimeoutsForColdCache();

// Los adornos están ocultos a los lectores de pantalla: se consultan incluyendo elementos ocultos.
const HIDDEN = { includeHiddenElements: true };

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger', 'dangerSolid'] as const)(
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

  it('tall usa radio 16 (radii.lg)', async () => {
    await render(<Button label="Ok" variant="primary" tall onPress={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({ borderRadius: 16 });
  });

  it('sin tall conserva el radio 12', async () => {
    await render(<Button label="Ok" onPress={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({ borderRadius: 12 });
  });

  it('dangerSolid: fondo y borde expense, texto blanco', async () => {
    await render(<Button label="Archivar" variant="dangerSolid" onPress={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: colors.expense,
      borderColor: colors.expense,
    });
    expect(screen.getByText('Archivar')).toHaveStyle({ color: colors.white });
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
  // R2: píldora con borde 1.5 (antes borde 2 al seleccionar, docs/007 §6.7); se ajusta el ancho esperado.
  it('rol radio, estado y texto sin ✓', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Efectivo" selected onPress={onPress} />);
    const c = screen.getByRole('radio', { name: 'Efectivo' });
    expect(c.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(screen.getByText('Efectivo')).toBeTruthy();
    await fireEvent.press(c);
    expect(onPress).toHaveBeenCalled();
    expect(c).toHaveStyle({ minHeight: 48, borderWidth: 1.5 });
  });

  it('píldora: radio pill, borde 1.5 y superficie', async () => {
    await render(<Chip label="Gasto" selected={false} onPress={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Gasto' })).toHaveStyle({
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
    });
    expect(screen.queryByTestId('chip-check', HIDDEN)).toBeNull();
  });

  it('seleccionado: ✓ en un texto aparte, oculto a la accesibilidad, y etiqueta en negrita', async () => {
    await render(<Chip label="Gasto" selected onPress={() => undefined} />);
    const check = screen.getByTestId('chip-check', { includeHiddenElements: true });
    expect(check).toHaveTextContent('✓');
    expect(check.props.importantForAccessibility).toBe('no');
    expect(check.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByText('Gasto')).toHaveStyle({ fontWeight: '800' });
    expect(screen.queryByText('✓ Gasto')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Gasto' })).toHaveStyle({
      backgroundColor: colors.segBg,
      borderColor: colors.text,
    });
  });

  it('size sm: 36 dp visibles con hitSlop de 6 arriba y abajo', async () => {
    await render(<Chip label="Todos" size="sm" selected={false} onPress={() => undefined} />);
    const c = screen.getByRole('radio', { name: 'Todos' });
    expect(c).toHaveStyle({ minHeight: 36, paddingHorizontal: 12 });
    expect(c.props.hitSlop).toEqual({ top: 6, bottom: 6 });
    expect(screen.getByText('Todos')).toHaveStyle({ fontSize: 13, lineHeight: 18 });
  });

  it('size md no amplía la zona táctil', async () => {
    await render(<Chip label="Todos" selected={false} onPress={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Todos' }).props.hitSlop).toBeUndefined();
  });

  it('tono de tipo (R3): el elegido toma el tinte del gasto o del ingreso; sin elegir no cambia', async () => {
    const { rerender } = await render(
      <Chip label="Hoy" tone="gasto" selected onPress={() => undefined} />,
    );
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveStyle({
      borderWidth: 2,
      borderColor: colors.expense,
      backgroundColor: colors.expenseSoft,
    });
    expect(screen.getByText('Hoy')).toHaveStyle({ color: colors.expenseText });
    await rerender(<Chip label="Hoy" tone="ingreso" selected onPress={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveStyle({
      borderColor: colors.income,
      backgroundColor: colors.incomeSoft,
    });
    await rerender(<Chip label="Hoy" tone="ingreso" selected={false} onPress={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveStyle({
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    });
  });

  it('suffix: adorno decorativo oculto a la accesibilidad', async () => {
    await render(
      <Chip label="Otra fecha…" suffix="▾" selected={false} onPress={() => undefined} />,
    );
    const suffix = screen.getByText('▾', { includeHiddenElements: true });
    expect(suffix.props.importantForAccessibility).toBe('no');
    expect(screen.getByRole('radio', { name: 'Otra fecha…' })).toBeTruthy();
  });

  it('disabled no ejecuta onPress y marca el estado', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Todos" selected={false} disabled onPress={onPress} />);
    const c = screen.getByRole('radio', { name: 'Todos' });
    await fireEvent.press(c);
    expect(onPress).not.toHaveBeenCalled();
    expect(c.props.accessibilityState).toEqual({ selected: false, disabled: true });
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
    await await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Screen', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'android';
  });
  afterEach(() => {
    Platform.OS = originalOS;
  });

  // Con SafeAreaProvider mandan los insets reales del sistema (docs/003 D17).
  it('relleno superior con el inset real del sistema en Android', async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 40, bottom: 20, left: 0, right: 0 }}>
        <Screen>
          <Text>Hola</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId('screen-top-inset')).toHaveStyle({
      height: 40,
      backgroundColor: colors.bg,
    });
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('sin provider usa el respaldo superior', async () => {
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

  it('sin scroll y sin barra inferior reserva el margen inferior real del sistema', async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 40, bottom: 20, left: 0, right: 0 }}>
        <Screen scroll={false}>
          <Text>Hola</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId('screen-bottom-inset')).toHaveStyle({ height: 20 });
  });

  it('sin provider el margen inferior usa el respaldo', async () => {
    await render(
      <Screen scroll={false}>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByTestId('screen-bottom-inset')).toHaveStyle({ height: 48 });
  });

  it('con bottomBar no añade el espaciador (lo pone la barra)', async () => {
    await render(
      <Screen scroll={false} bottomBar>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-bottom-inset')).toBeNull();
  });

  it('con scroll no añade el espaciador (lo pone el relleno del contenido)', async () => {
    await render(
      <Screen>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-bottom-inset')).toBeNull();
  });
});

describe('R4: ScreenTitle y ModuleTile', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ScreenTitle es un encabezado 24/30 800 con tope de escala 1.6, subrayado amarillo y sin cuenta', async () => {
    mockWindow(360, 1);
    await render(<ScreenTitle title="Movimientos" module="movimientos" />);
    const title = screen.getByRole('header', { name: 'Movimientos' });
    expect(title).toHaveStyle({ fontSize: 24, lineHeight: 30, fontWeight: '800' });
    expect(title.props.maxFontSizeMultiplier).toBe(1.6);
    expect(title.props.allowFontScaling).not.toBe(false);
    expect(screen.getByTestId('module-tile', HIDDEN)).toHaveStyle({
      width: 36,
      height: 36,
      backgroundColor: moduleColors.movimientos.tile,
    });
  });

  it.each([
    [1.3, 28],
    [1.5, 28],
    [1.0, 36],
  ])('ModuleTile con fuente %s mide %s dp', async (fontScale, size) => {
    mockWindow(360, fontScale);
    await render(<ModuleTile module="calendario" />);
    expect(screen.getByTestId('module-tile', HIDDEN)).toHaveStyle({ width: size, height: size });
  });

  it('ModuleTile se oculta con fuente ≥ 175 %', async () => {
    mockWindow(360, 1.75);
    await render(<ScreenTitle title="Calendario" module="calendario" />);
    expect(screen.queryByTestId('module-tile', HIDDEN)).toBeNull();
    expect(screen.getByRole('header', { name: 'Calendario' })).toBeTruthy();
  });

  it('cada módulo usa su mosaico', async () => {
    mockWindow(360, 1);
    for (const module of ['movimientos', 'calendario', 'reportes', 'mas'] as const) {
      const view = await render(<ModuleTile module={module} />);
      expect(screen.getByTestId('module-tile', HIDDEN)).toHaveStyle({
        backgroundColor: moduleColors[module].tile,
      });
      await view.unmount();
    }
  });
});

describe('R4: Chip tone movimientos, Button expanded, ErrorBox', () => {
  it('Chip movimientos elegido: tile, borde 1.5 ink y texto ink con «✓»', async () => {
    await render(
      <Chip label="Comida" tone="movimientos" selected size="sm" onPress={() => undefined} />,
    );
    const chip = screen.getByRole('radio', { name: 'Comida' });
    expect(chip).toHaveStyle({
      backgroundColor: moduleColors.movimientos.tile,
      borderColor: moduleColors.movimientos.ink,
      borderWidth: 1.5,
    });
    expect(screen.getByText('Comida')).toHaveStyle({ color: moduleColors.movimientos.ink });
    expect(screen.getByTestId('chip-check', HIDDEN)).toBeTruthy();
  });

  it('Chip de filtro activo: rol button, sin «✓» y con «✕» oculto a lectores', async () => {
    const onPress = jest.fn();
    await render(
      <Chip
        label="Gastos"
        tone="movimientos"
        selected
        role="button"
        check={false}
        suffix="✕"
        accessibilityLabel="Quitar filtro: Gastos"
        onPress={onPress}
      />,
    );
    expect(screen.queryByTestId('chip-check', HIDDEN)).toBeNull();
    expect(screen.getByText('✕', HIDDEN).props.importantForAccessibility).toBe('no');
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtro: Gastos' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Button con expanded anuncia el estado y oculta el adorno', async () => {
    await render(<Button label="Filtros" suffix="▾" expanded={false} onPress={() => undefined} />);
    const button = screen.getByRole('button', { name: /^Filtros/ });
    expect(button.props.accessibilityState).toEqual({ disabled: false, expanded: false });
    expect(screen.getByText('▾', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });

  it('ErrorBox: fondo expenseSoft, mensaje alert y Reintentar secundario', async () => {
    const onRetry = jest.fn();
    await render(<ErrorBox message="No se pudo conectar" onRetry={onRetry} />);
    const message = screen.getByText('No se pudo conectar');
    expect(message.props.accessibilityRole).toBe('alert');
    expect(message.parent!).toHaveStyle({ backgroundColor: colors.expenseSoft, borderRadius: 16 });
    const retry = screen.getByRole('button', { name: 'Reintentar' });
    expect(retry).toHaveStyle({ backgroundColor: colors.surface });
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('R4: SummaryTile, MonthArrow y estados', () => {
  it('SummaryTile de ingresos y gastos: burbuja y cifra con su color; neto en text', async () => {
    await render(
      <>
        <SummaryTile kind="income" label="Ingresos" value="+$12.00" />
        <SummaryTile kind="expense" label="Gastos" value="-$5.00" />
        <SummaryTile kind="neutral" label="Neto" value="$7.00" wide />
      </>,
    );
    expect(screen.getByText('+$12.00')).toHaveStyle({ color: colors.income, fontSize: 19 });
    expect(screen.getByText('-$5.00')).toHaveStyle({ color: colors.expense });
    expect(screen.getByText('$7.00')).toHaveStyle({ color: colors.text });
    expect(screen.getByText('↑', HIDDEN).parent!).toHaveStyle({
      backgroundColor: colors.incomeSoft,
    });
    expect(screen.getByText('↓', HIDDEN).parent!).toHaveStyle({
      backgroundColor: colors.expenseSoft,
    });
    expect(screen.queryAllByText(/^[↑↓]$/, HIDDEN)).toHaveLength(2);
  });

  it('MonthArrow: zona de 48 dp, círculo de 32 dp, deshabilitada con opacidad 0.4', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <MonthArrow glyph="‹" label="Mes anterior" onPress={onPress} />
        <MonthArrow glyph="›" label="Mes siguiente" disabled onPress={onPress} />
      </>,
    );
    const prev = screen.getByRole('button', { name: 'Mes anterior' });
    expect(prev).toHaveStyle({ width: 48, height: 48 });
    expect(screen.getByText('‹', HIDDEN).parent!).toHaveStyle({
      width: 32,
      height: 32,
      borderRadius: 16,
    });
    await fireEvent.press(prev);
    const next = screen.getByRole('button', { name: 'Mes siguiente' });
    expect(next.props.accessibilityState.disabled).toBe(true);
    expect(next).toHaveStyle({ opacity: 0.4 });
    await fireEvent.press(next);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('LoadingState muestra el indicador con su texto', async () => {
    await render(<LoadingState text="Cargando movimientos…" testID="loading" />);
    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.getByText('Cargando movimientos…')).toBeTruthy();
  });

  it('EmptyState muestra el dibujo y la acción; con fuente ≥ 175 % oculta el dibujo', async () => {
    const onAction = jest.fn();
    mockWindow(360, 1);
    const view = await render(
      <EmptyState
        module="movimientos"
        glyph="🔎"
        message="Ningún movimiento coincide con estos filtros."
        actionLabel="Limpiar filtros"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('🔎', HIDDEN)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    await view.unmount();
    mockWindow(360, 1.75);
    await render(<EmptyState module="movimientos" glyph="🔎" message="Vacío" />);
    expect(screen.queryByText('🔎', HIDDEN)).toBeNull();
    expect(screen.getByText('Vacío')).toBeTruthy();
    jest.restoreAllMocks();
  });
});

describe('R4 D6: chips pequeños y margen lateral', () => {
  it('Chip sm: 36 dp de alto, minWidth 48 y hitSlop vertical de 6 dp (zona ≥ 48 × 48)', async () => {
    await render(<Chip label="A" size="sm" selected={false} onPress={() => undefined} />);
    const chip = screen.getByRole('radio', { name: 'A' });
    const style = StyleSheet.flatten(chip.props.style);
    expect(style.minHeight).toBe(36);
    expect(style.minWidth).toBe(48);
    // Sin hitSlop horizontal: el ancho ya cubre 48 dp y no invade al vecino.
    expect(chip.props.hitSlop).toEqual({ top: 6, bottom: 6 });
    expect(style.minHeight! + 6 + 6).toBeGreaterThanOrEqual(48);
  });

  it('Chip md no cambia: 48 dp de alto y sin hitSlop', async () => {
    await render(<Chip label="Todos" selected={false} onPress={() => undefined} />);
    const chip = screen.getByRole('radio', { name: 'Todos' });
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(48);
    expect(chip.props.hitSlop).toBeUndefined();
  });
});
