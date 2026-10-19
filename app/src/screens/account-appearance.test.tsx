// Bloque «Apariencia» (docs/007 §5.14, docs/008 §6.16): vista previa, color e ícono.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { type AppearanceDraft } from '../lib/account-appearance';
import { accountColors } from '../lib/accounts';
import { colors } from '../theme/tokens';
import { chooseIcon, mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import { AccountPreview, AppearancePicker, COLOR_ASSIGNED_ON_CREATE } from './account-appearance';

relaxTimeoutsForColdCache();

const onChange = jest.fn();
const renderPicker = (
  draft: AppearanceDraft = { color: null, icono: null },
  extra: Partial<Parameters<typeof AppearancePicker>[0]> = {},
) =>
  render(
    <AppearancePicker
      nombre="Banco"
      draft={draft}
      onChange={onChange}
      busy={false}
      accountId={null}
      {...extra}
    />,
  );

beforeEach(() => {
  onChange.mockClear();
  mockWindow(360);
});
afterEach(() => jest.restoreAllMocks());

describe('AppearancePicker: estructura y accesibilidad (CTA-10)', () => {
  it('título, ayuda, grupos radiogroup y chips «Predeterminado» seleccionados por defecto', async () => {
    await renderPicker();
    expect(screen.getByRole('header', { name: 'Apariencia' })).toBeTruthy();
    expect(
      screen.getByText('Opcional. Te ayuda a reconocer la cuenta de un vistazo.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Color de la cuenta').props.accessibilityRole).toBe('radiogroup');
    expect(
      screen.getByRole('radio', { name: 'Color predeterminado' }).props.accessibilityState,
    ).toEqual({
      selected: true,
      disabled: false,
    });
    expect(
      screen.getByRole('radio', { name: 'Ícono predeterminado' }).props.accessibilityState,
    ).toEqual({
      selected: true,
      disabled: false,
    });
    expect(screen.getByText('Color: predeterminado')).toBeTruthy();
    expect(screen.getByText('Ícono: predeterminado')).toBeTruthy();
  });

  it('seis colores y una sola fila de ícono (la rejilla vive en la hoja)', async () => {
    await renderPicker();
    for (const name of ['aguamarina', 'lavanda', 'albaricoque', 'celeste', 'rosa', 'limón']) {
      expect(screen.getByRole('radio', { name: `Color ${name}` })).toBeTruthy();
    }
    expect(screen.queryByTestId('icon-grid')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ícono predeterminado, cambiar' })).toBeTruthy();
    // Chip «Predeterminado» de ícono + 7 de color.
    expect(screen.getAllByRole('radio')).toHaveLength(7 + 1);
  });

  it('el seleccionado es exclusivo y el resumen lo nombra', async () => {
    await renderPicker({ color: 'limon', icono: 'bank' });
    expect(
      screen.getByRole('radio', { name: 'Color limón' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'Color predeterminado' }).props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByRole('radio', { name: 'Ícono predeterminado' }).props.accessibilityState.selected,
    ).toBe(false);
    expect(screen.getByRole('button', { name: 'Ícono Banco, cambiar' })).toBeTruthy();
    expect(screen.getByText('Color: Limón')).toBeTruthy();
    expect(screen.getByText('Ícono: Banco')).toBeTruthy();
    expect(screen.getAllByText('✓', { includeHiddenElements: true }).length).toBe(1);
  });

  it('«✓» de la muestra usa colors.text y el anillo de reposo 1.5 dp borderStrong', async () => {
    await renderPicker({ color: 'rosa', icono: null });
    const check = screen
      .getAllByText('✓', { includeHiddenElements: true })
      .find((node) => StyleSheet.flatten(node.props.style)?.fontSize === 18)!;
    expect(StyleSheet.flatten(check.props.style).color).toBe(colors.text);
    const rest = screen.getByRole('radio', { name: 'Color lavanda' });
    const ring = rest.children[0] as unknown as typeof rest;
    expect(StyleSheet.flatten(ring.props.style)).toMatchObject({
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    });
  });

  it('la hoja usa 24 sp en el glifo y 5 columnas a 360 dp (celda de 56 dp)', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByRole('button', { name: /^Ícono .*, cambiar$/ }));
    const glyph = screen.getByText('👛', { includeHiddenElements: true, exact: true });
    expect(StyleSheet.flatten(glyph.props.style).fontSize).toBe(24);
    const cell = StyleSheet.flatten(
      screen.getByRole('radio', { name: 'Ícono Billetera' }).props.style,
    );
    expect(cell.width).toBe(56);
  });
});

describe('AppearancePicker: selección', () => {
  it('tocar color, ícono o Predeterminado notifica el cambio', async () => {
    await renderPicker({ color: 'rosa', icono: 'bank' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Color limón' }));
    expect(onChange).toHaveBeenLastCalledWith({ color: 'limon' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Color predeterminado' }));
    expect(onChange).toHaveBeenLastCalledWith({ color: null });
    await chooseIcon('Viajes', screen);
    expect(onChange).toHaveBeenLastCalledWith({ icono: 'plane' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono predeterminado' }));
    expect(onChange).toHaveBeenLastCalledWith({ icono: null });
  });

  it('con busy todo queda deshabilitado e inerte (CTA-12)', async () => {
    await renderPicker({ color: 'rosa', icono: null }, { busy: true });
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
    expect(
      screen.getByRole('button', { name: /^Ícono .*, cambiar$/ }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Color limón' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Ícono .*, cambiar$/ }));
    expect(screen.queryByLabelText('Buscar ícono')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('el foco dibuja un contorno de 2 dp', async () => {
    await renderPicker();
    const swatch = screen.getByRole('radio', { name: 'Color celeste' });
    await fireEvent(swatch, 'focus');
    const style = StyleSheet.flatten(
      screen.getByRole('radio', { name: 'Color celeste' }).props.style,
    );
    expect(style.borderWidth).toBe(2);
  });
});

describe('AccountPreview (CTA-09)', () => {
  it('Crear sin color: fondo neutro, aviso y ícono por nombre', async () => {
    await render(
      <AccountPreview nombre="Tarjeta Visa" color={null} icono={null} accountId={null} />,
    );
    const preview = screen.getByTestId('account-preview');
    expect(StyleSheet.flatten(preview.props.style).backgroundColor).toBe(colors.segBg);
    expect(preview.props.accessibilityLabel).toBe(
      'Vista previa de la cuenta Tarjeta Visa, color predeterminado, ícono predeterminado',
    );
    expect(screen.getByText(COLOR_ASSIGNED_ON_CREATE)).toBeTruthy();
    expect(screen.getByText('💳', { includeHiddenElements: true })).toBeTruthy();
  });

  it('nombre vacío: texto de marcador y 👛', async () => {
    await render(<AccountPreview nombre="  " color={null} icono={null} accountId={null} />);
    expect(screen.getByText('Nombre de la cuenta')).toBeTruthy();
    expect(screen.getByText('👛', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('account-preview').props.accessibilityLabel).toContain('sin nombre');
  });

  it('con color e ícono elegidos usa su tarjeta y glifo, sin aviso', async () => {
    await render(<AccountPreview nombre="Viaje" color="limon" icono="plane" accountId={null} />);
    const preview = screen.getByTestId('account-preview');
    expect(StyleSheet.flatten(preview.props.style).backgroundColor).toBe('#FFF6D6');
    expect(preview.props.accessibilityLabel).toBe(
      'Vista previa de la cuenta Viaje, color limón, ícono Viajes',
    );
    expect(screen.getByText('✈️', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(COLOR_ASSIGNED_ON_CREATE)).toBeNull();
  });

  it('Editar sin color: usa el color por hash del id y no muestra el aviso', async () => {
    await render(<AccountPreview nombre="Banco" color={null} icono={null} accountId="acc-1" />);
    expect(
      StyleSheet.flatten(screen.getByTestId('account-preview').props.style).backgroundColor,
    ).toBe(accountColors('acc-1').card);
    expect(screen.queryByText(COLOR_ASSIGNED_ON_CREATE)).toBeNull();
    expect(screen.getByText('🏦', { includeHiddenElements: true })).toBeTruthy();
  });

  it('una clave desconocida se dibuja como Predeterminado', async () => {
    await render(<AccountPreview nombre="X" color="nuevo" icono="cohete" accountId="acc-1" />);
    expect(screen.getByTestId('account-preview').props.accessibilityLabel).toContain(
      'color predeterminado, ícono predeterminado',
    );
  });

  it('el nombre ocupa una línea con elipsis', async () => {
    await render(
      <AccountPreview nombre="Un nombre muy largo" color={null} icono={null} accountId={null} />,
    );
    expect(screen.getByText('Un nombre muy largo').props.numberOfLines).toBe(1);
  });
});
