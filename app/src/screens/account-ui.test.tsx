import { fireEvent, render, screen } from '@testing-library/react-native';
import { accountPalette, colors, moduleColors } from '../theme/tokens';
import { accountColorIndex } from '../lib/accounts';
import { account } from '../resources-test-utils';
import { mockWindow } from '../test-utils';
import {
  AccountCard,
  AccountContextBar,
  ARCHIVED_NOTICE,
  ArchivedNotice,
  BottomTabs,
  Fab,
  FAB_NOTE,
  balanceText,
} from './account-ui';

describe('balanceText', () => {
  it('formatea solo saldos enteros seguros sin error; nunca inventa $0.00', () => {
    expect(balanceText(-2550)).toBe('-$25.50');
    expect(balanceText(1250, 'refreshing')).toBe('$12.50');
    expect(balanceText(1250, 'error')).toBeNull();
    expect(balanceText(1.5)).toBeNull();
    expect(balanceText(Number.NaN)).toBeNull();
  });
});

describe('AccountCard', () => {
  // La ventana de Jest mide 750 dp de ancho (≥ 400): se usa el mínimo ancho de 92 dp.
  it('un solo botón con etiqueta completa, color por hash y mínimo 92 dp en pantalla ancha', async () => {
    const onPress = jest.fn();
    const acc = account({ id: 'acc-1', nombre: 'Banco del Pichincha', saldo: -2550 });
    await render(<AccountCard account={acc} onPress={onPress} />);
    const card = screen.getByRole('button', {
      name: 'Banco del Pichincha, saldo actual -$25.50. Abrir cuenta',
    });
    expect(card).toHaveStyle({
      backgroundColor: accountPalette[accountColorIndex('acc-1')]!.card,
      minHeight: 92,
      borderRadius: 20,
    });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Banco del Pichincha').props.numberOfLines).toBe(1);
    const amount = screen.getByText('-$25.50');
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(amount).toHaveStyle({ color: colors.expenseText });
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AccountContextBar', () => {
  const acc = account({ nombre: 'Efectivo', saldo: 1250 });
  // Ventana normal (411 dp, fontScale 1): una sola fila; el modo twoRows tiene su propia prueba.
  beforeEach(() => {
    mockWindow();
  });
  afterEach(() => jest.restoreAllMocks());

  it('fuente grande (fontScale ≥ 1.3): dos filas, estado oculto y en la etiqueta del bloque; Reintentar accesible', async () => {
    mockWindow(411, 1.5);
    const onRetry = jest.fn();
    const { rerender } = await render(
      <AccountContextBar
        account={{ ...acc, archivada: true }}
        balance="ok"
        variant="readOnly"
        balanceWord="saldo actual"
      />,
    );
    expect(screen.getByTestId('context-bar-row2')).toBeTruthy();
    expect(screen.queryByText('Archivada')).toBeNull();
    expect(screen.queryByText('$12.50')).toBeNull();
    expect(screen.getByLabelText('Cuenta Efectivo, saldo actual $12.50, archivada')).toBeTruthy();
    await rerender(
      <AccountContextBar
        account={acc}
        balance="error"
        variant="full"
        onRetry={onRetry}
        onOpenSwitcher={jest.fn()}
      />,
    );
    expect(screen.queryByText('Saldo no disponible')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Cuenta Efectivo, saldo no disponible' }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar saldo' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('completa: salida «‹ Mis cuentas» y selector con etiqueta y pista', async () => {
    const onExit = jest.fn();
    const onOpenSwitcher = jest.fn();
    await render(
      <AccountContextBar
        account={acc}
        balance="ok"
        variant="full"
        exitLabel="‹ Mis cuentas"
        exitAccessibilityLabel="Volver a Mis cuentas"
        onExit={onExit}
        onOpenSwitcher={onOpenSwitcher}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a Mis cuentas' }));
    expect(onExit).toHaveBeenCalled();
    const info = screen.getByRole('button', { name: 'Cuenta Efectivo, saldo $12.50' });
    expect(info.props.accessibilityHint).toBe('Toca para cambiar de cuenta');
    await fireEvent.press(info);
    expect(onOpenSwitcher).toHaveBeenCalled();
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('sin saldo en la pestaña Cuenta: solo «Cuenta {nombre}»', async () => {
    await render(
      <AccountContextBar
        account={acc}
        balance="ok"
        variant="full"
        showBalance={false}
        onOpenSwitcher={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cuenta Efectivo' })).toBeTruthy();
    expect(screen.queryByText('$12.50')).toBeNull();
  });

  it('actualizando: conserva el último saldo, indicador y busy', async () => {
    await render(
      <AccountContextBar
        account={acc}
        balance="refreshing"
        variant="full"
        onOpenSwitcher={jest.fn()}
      />,
    );
    const info = screen.getByRole('button', {
      name: 'Cuenta Efectivo, saldo $12.50, actualizando saldo',
    });
    expect(info.props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByText('$12.50')).toBeTruthy();
    expect(screen.getByTestId('context-bar-refreshing')).toBeTruthy();
  });

  it('error: «Saldo no disponible» y Reintentar, nunca $0.00 ni el saldo viejo', async () => {
    const onRetry = jest.fn();
    await render(
      <AccountContextBar
        account={acc}
        balance="error"
        variant="full"
        onRetry={onRetry}
        onOpenSwitcher={jest.fn()}
      />,
    );
    expect(screen.getByText('Saldo no disponible')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Cuenta Efectivo, saldo no disponible' }),
    ).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Reintentar saldo' });
    expect(retry).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalled();
  });

  it('archivada: texto «Archivada» y sufijo accesible', async () => {
    await render(
      <AccountContextBar
        account={{ ...acc, archivada: true }}
        balance="ok"
        variant="readOnly"
        balanceWord="saldo actual"
      />,
    );
    expect(screen.getByText('Archivada')).toBeTruthy();
    expect(
      screen.getByLabelText('Cuenta Efectivo, saldo actual $12.50, archivada').props
        .accessibilityRole,
    ).toBe('text');
  });

  it('solo lectura: sin selector; salida propia', async () => {
    const onExit = jest.fn();
    await render(
      <AccountContextBar
        account={acc}
        balance="ok"
        variant="readOnly"
        exitLabel="‹ Más"
        exitAccessibilityLabel="Volver a Más"
        onExit={onExit}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a Más' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('compacta: «{nombre} · {saldo}», 36 dp y sin acciones', async () => {
    await render(<AccountContextBar account={acc} balance="ok" variant="compact" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('context-bar')).toHaveStyle({ minHeight: 36 });
    expect(screen.getByLabelText('Cuenta Efectivo, saldo $12.50')).toHaveTextContent(
      'Efectivo · $12.50',
    );
  });
});

describe('BottomTabs', () => {
  it('tablist con cinco pestañas en orden, la activa seleccionada con su color', async () => {
    const onChange = jest.fn();
    await render(<BottomTabs active="reportes" onChange={onChange} />);
    const list = screen.getByLabelText('Secciones de la cuenta');
    expect(list.props.accessibilityRole).toBe('tablist');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Cuenta',
      'Movimientos',
      'Calendario',
      'Reportes',
      'Más',
    ]);
    expect(tabs[3]!.props.accessibilityState).toEqual({ selected: true });
    expect(tabs[0]!.props.accessibilityState).toEqual({ selected: false });
    expect(tabs[0]).toHaveStyle({ minWidth: 48, minHeight: 62 });
    expect(screen.getByText('Reportes')).toHaveStyle({
      color: moduleColors.reportes.ink,
      fontWeight: '800',
    });
    expect(screen.getByText('Movimientos').props.numberOfLines).toBeUndefined();
    await fireEvent.press(tabs[1]!);
    expect(onChange).toHaveBeenCalledWith('movimientos');
  });
});

describe('Fab', () => {
  it('botón «Nuevo movimiento» con marca y 56 dp', async () => {
    const onPress = jest.fn();
    await render(<Fab onPress={onPress} />);
    const fab = screen.getByRole('button', { name: 'Nuevo movimiento' });
    expect(fab).toHaveStyle({ minHeight: 56, backgroundColor: colors.brand700 });
    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByText(FAB_NOTE)).toBeNull();
  });

  it('deshabilitado (cuenta archivada): no navega y lo explica', async () => {
    const onPress = jest.fn();
    await render(<Fab onPress={onPress} disabled />);
    const fab = screen.getByRole('button', { name: 'Nuevo movimiento' });
    expect(fab.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(fab);
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByText(FAB_NOTE)).toBeTruthy();
  });
});

describe('ArchivedNotice', () => {
  it('muestra el aviso de modo consulta', async () => {
    await render(<ArchivedNotice />);
    expect(screen.getByText(ARCHIVED_NOTICE)).toBeTruthy();
  });
});
