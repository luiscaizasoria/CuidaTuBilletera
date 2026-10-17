// Selector «Elegir ícono» compartido (R5.1b; docs/007 §5.15 A, docs/008 §6.17.3).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Keyboard,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ICON_GROUPS, iconsForScope, entriesOfGroup } from '../lib/icon-catalog';
import { colors } from '../theme/tokens';
import { mockWindow, relaxTimeoutsForColdCache } from '../test-utils';
import {
  FIXED_CONTROLS_DP,
  GRID_MIN_DP,
  IconField,
  IconPickerSheet,
  NEEDED_DP,
  iconSheetLayout,
} from './icon-picker-sheet';

relaxTimeoutsForColdCache();

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}) as ViewStyle;
const CATEGORY = iconsForScope('category');
const ACCOUNT = iconsForScope('account');

const onClose = jest.fn();
const onConfirm = jest.fn();
const renderSheet = (value: string | null = null, entries = CATEGORY) =>
  render(
    <IconPickerSheet
      visible
      entries={entries}
      value={value}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
const cells = () => screen.getAllByRole('radio', { name: /^Ícono / });
const chip = (group: string) => screen.getByRole('radio', { name: `Grupo ${group}` });
const useButton = () => screen.getByRole('button', { name: 'Usar este ícono' });

beforeEach(() => {
  onClose.mockClear();
  onConfirm.mockClear();
  mockWindow(360, 1);
});
afterEach(() => jest.restoreAllMocks());

// El layout real (medidas, desplazamiento y teclado) NO se valida en Jest: solo estructura, estilos y el
// cálculo de presupuesto. La medición de alturas se valida en el teléfono (Android 360x640 y 412x915).
describe('hoja: presupuesto de alturas (cálculo, no layout real)', () => {
  const base = { insetTop: 32, insetBottom: 24, keyboard: 0, fontScale: 1, searchFocused: false };

  it('controles fijos + rejilla mínima de 2 filas caben en 360x640 con el inset de 32 dp', () => {
    expect(GRID_MIN_DP).toBe(2 * 48 + 8);
    expect(NEEDED_DP).toBe(FIXED_CONTROLS_DP + GRID_MIN_DP);
    // Sin inset inferior: 0.75 * 640 - 32 = 448 >= 429, la hoja alta cabe sin compactar.
    expect(NEEDED_DP).toBeLessThanOrEqual(0.75 * 640 - 32);
    const layout = iconSheetLayout({ ...base, height: 640, insetBottom: 0 });
    expect(layout.compact).toBe(false);
    expect(layout.bodyScrolls).toBe(false);
    expect(layout.gridHeight).toBeGreaterThanOrEqual(GRID_MIN_DP);
  });

  it('412x915 deja la hoja alta con rejilla holgada', () => {
    const layout = iconSheetLayout({ ...base, height: 915 });
    expect(layout.compact).toBe(false);
    expect(layout.bodyScrolls).toBe(false);
    expect(layout.maxHeight).toBeCloseTo(0.75 * 915 - 32);
    expect(layout.gridHeight).toBeGreaterThan(GRID_MIN_DP);
  });

  it('si la hoja alta no alcanza pasa a compacta y garantiza la rejilla mínima', () => {
    // Con 24 dp de barra de navegación la alta (448) ya no alcanza (429 + 24): usa la compacta (600).
    const layout = iconSheetLayout({ ...base, height: 640 });
    expect(layout.compact).toBe(true);
    expect(layout.maxHeight).toBe(640 - 32 - 8);
    expect(layout.bodyScrolls).toBe(false);
    expect(layout.gridHeight).toBeGreaterThanOrEqual(GRID_MIN_DP);
  });

  it('con teclado abierto o ventana muy baja el cuerpo completo se desplaza', () => {
    expect(iconSheetLayout({ ...base, height: 640, keyboard: 300 }).bodyScrolls).toBe(true);
    expect(iconSheetLayout({ ...base, height: 400 }).bodyScrolls).toBe(true);
  });

  it('la fuente grande reserva más espacio', () => {
    const normal = iconSheetLayout({ ...base, height: 800 });
    const large = iconSheetLayout({ ...base, height: 800, fontScale: 2 });
    expect(large.gridHeight).toBeLessThan(normal.gridHeight);
  });

  it('con alto suficiente, buscador y chips quedan fuera de la zona desplazable', async () => {
    mockWindow(360, 1, 800);
    await renderSheet(null);
    const scroll = screen.getByTestId('icon-picker-scroll');
    expect(within(scroll).queryByLabelText('Buscar ícono')).toBeNull();
    expect(flat(scroll).minHeight).toBe(GRID_MIN_DP);
  });

  it('con alto insuficiente buscador, chips y rejilla se desplazan juntos y el pie queda fijo', async () => {
    mockWindow(360, 1, 400);
    await renderSheet(null);
    const scroll = screen.getByTestId('icon-picker-scroll');
    expect(within(scroll).getByLabelText('Buscar ícono')).toBeTruthy();
    expect(within(scroll).getByLabelText('Grupos de íconos')).toBeTruthy();
    expect(within(scroll).getByTestId('icon-picker-grid')).toBeTruthy();
    expect(within(screen.getByTestId('icon-picker-footer')).getByText('Cancelar')).toBeTruthy();
    expect(within(scroll).queryByText('Cancelar')).toBeNull();
  });

  it('el pie va en una fila con Cancelar y «Usar este ícono» de al menos 48 dp', async () => {
    await renderSheet('bus');
    const actions = flat(screen.getByTestId('icon-picker-actions'));
    expect(actions.flexDirection).toBe('row');
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(flat(cancel).minHeight).toBeGreaterThanOrEqual(48);
    expect(flat(useButton()).minHeight).toBeGreaterThanOrEqual(48);
    // Con fuente >= 1.5 los botones se apilan.
    mockWindow(360, 1.5);
    await renderSheet('bus');
    expect(flat(screen.getAllByTestId('icon-picker-actions').at(-1)!).flexDirection).toBe(
      'column-reverse',
    );
  });
});

describe('hoja: foco, desplazamiento inicial y teclado', () => {
  it('al abrir lleva el foco de accesibilidad al título', async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(11);
    await renderSheet('bus');
    await waitFor(() => expect(focus).toHaveBeenCalledWith(11));
  });

  it('desplaza la rejilla hasta la celda del ícono actual una vez que hay medidas', async () => {
    const scrollTo = jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(() => undefined);
    scrollTo.mockClear();
    await renderSheet('bus');
    const layoutOf = (y: number) => ({
      nativeEvent: { layout: { x: 0, y, width: 50, height: 50 } },
    });
    const cell = screen.getByRole('radio', { name: 'Ícono Transporte público' });
    await fireEvent(cell, 'layout', layoutOf(112));
    expect(scrollTo).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('icon-picker-grid'), 'layout', layoutOf(4));
    expect(scrollTo).toHaveBeenCalledWith({ y: 4 + 112 - 8, animated: false });
    // Solo una vez.
    await fireEvent(screen.getByTestId('icon-picker-grid'), 'layout', layoutOf(4));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('sin ícono actual no desplaza', async () => {
    const scrollTo = jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(() => undefined);
    scrollTo.mockClear();
    await renderSheet(null);
    await fireEvent(screen.getByTestId('icon-picker-grid'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 4, width: 50, height: 50 } },
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('onSubmitEditing cierra el teclado', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    await renderSheet(null);
    await fireEvent(screen.getByLabelText('Buscar ícono'), 'submitEditing');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('el aro de foco usa colors.text y no sustituye el borde de 3 dp de la celda marcada', async () => {
    await renderSheet('bus');
    const cell = screen.getByRole('radio', { name: 'Ícono Transporte público' });
    await fireEvent(cell, 'focus');
    expect(flat(cell)).toMatchObject({ borderWidth: 3 });
    const ring = cell.children
      .filter((child) => typeof child !== 'string')
      .map((child) => child as unknown as { props: { pointerEvents?: string; style?: unknown } })
      .find((child) => child.props.pointerEvents === 'none');
    expect(flat(ring!)).toMatchObject({ borderWidth: 2, borderColor: colors.text });
  });
});

describe('hoja: grupo inicial y selección', () => {
  it('con ícono actual abre en su grupo, con la celda marcada y «Seleccionado: {nombre}»', async () => {
    await renderSheet('bus');
    expect(chip('Transporte').props.accessibilityState.selected).toBe(true);
    expect(chip('Dinero y ahorro').props.accessibilityState.selected).toBe(false);
    const selected = cells().filter((cell) => cell.props.accessibilityState.selected);
    expect(selected.map((cell) => cell.props.accessibilityLabel)).toEqual([
      'Ícono Transporte público',
    ]);
    expect(screen.getByText('Seleccionado: Transporte público')).toBeTruthy();
    expect(cells()).toHaveLength(entriesOfGroup(CATEGORY, 'Transporte').length);
  });

  it('sin ícono abre en «Dinero y ahorro» sin selección', async () => {
    await renderSheet(null);
    expect(chip('Dinero y ahorro').props.accessibilityState.selected).toBe(true);
    expect(cells().filter((cell) => cell.props.accessibilityState.selected)).toHaveLength(0);
    expect(screen.queryByText(/^Seleccionado:/)).toBeNull();
  });

  it('una clave desconocida abre en «Dinero y ahorro» sin selección', async () => {
    await renderSheet('icono-viejo');
    expect(chip('Dinero y ahorro').props.accessibilityState.selected).toBe(true);
    expect(cells().filter((cell) => cell.props.accessibilityState.selected)).toHaveLength(0);
  });

  it('17 chips de grupo; cambiar de grupo muestra solo sus íconos', async () => {
    await renderSheet(null);
    expect(screen.getAllByRole('radio', { name: /^Grupo / })).toHaveLength(17);
    await fireEvent.press(chip('Mascotas'));
    expect(chip('Mascotas').props.accessibilityState.selected).toBe(true);
    expect(cells()).toHaveLength(12);
    expect(screen.getByLabelText('Íconos del grupo Mascotas')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Ícono Mascotas' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Ícono Billetera' })).toBeNull();
  });

  it('el chip activo lleva borde de 3 dp y «✓» (no solo color)', async () => {
    await renderSheet(null);
    expect(flat(chip('Dinero y ahorro'))).toMatchObject({ borderWidth: 3 });
    expect(
      within(chip('Dinero y ahorro')).getByText('✓ ', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(within(chip('Hogar')).queryByText('✓ ', { includeHiddenElements: true })).toBeNull();
  });

  it('en cuentas no hay íconos exclusivos de categorías', async () => {
    await renderSheet(null, ACCOUNT);
    await fireEvent.press(chip('Otros'));
    expect(cells()).toHaveLength(11);
    expect(screen.queryByRole('radio', { name: 'Ícono Etiqueta' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Ícono Ingreso extra' })).toBeNull();
  });
});

describe('hoja: confirmar y cancelar', () => {
  it('«Usar este ícono» está deshabilitado sin marca nueva y marcar no confirma', async () => {
    await renderSheet('bus');
    expect(useButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(useButton());
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Auto' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Seleccionado: Auto')).toBeTruthy();
    expect(useButton().props.accessibilityState.disabled).toBe(false);
  });

  it('seleccionar y confirmar entrega la clave una sola vez (doble toque ignorado)', async () => {
    await renderSheet('bus');
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Auto' }));
    await fireEvent.press(useButton());
    await fireEvent.press(useButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('car');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancelar, ✕ y Atrás/fondo (onRequestClose) cierran sin confirmar', async () => {
    await renderSheet('bus');
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Auto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    screen.getByTestId('icon-picker-sheet').props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(4);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('hoja: búsqueda', () => {
  const search = (text: string) =>
    fireEvent.changeText(screen.getByLabelText('Buscar ícono'), text);

  it('ignora tildes y mayúsculas, oculta los grupos y rotula los resultados', async () => {
    await renderSheet(null);
    await search('BAÑO');
    expect(screen.queryAllByRole('radio', { name: /^Grupo / })).toHaveLength(0);
    expect(screen.getByLabelText('Resultados de la búsqueda')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Ícono Baño' })).toBeTruthy();
    await search('cafe');
    expect(screen.getByRole('radio', { name: 'Ícono Café' })).toBeTruthy();
  });

  it('sin resultados: texto, «Borrar búsqueda» y regreso al grupo activo', async () => {
    await renderSheet('bus');
    await search('zzzz');
    expect(
      screen.getByText(
        'No encontramos íconos con «zzzz». Prueba con otra palabra o elige un grupo.',
      ),
    ).toBeTruthy();
    expect(screen.queryAllByRole('radio', { name: /^Ícono / })).toHaveLength(0);
    const clear = screen.getAllByRole('button', { name: 'Borrar búsqueda' });
    expect(clear.length).toBeGreaterThanOrEqual(1);
    await fireEvent.press(clear[0]!);
    expect(screen.getByLabelText('Buscar ícono').props.value).toBe('');
    expect(chip('Transporte').props.accessibilityState.selected).toBe(true);
    expect(cells()).toHaveLength(16);
  });

  it('la selección sobrevive a la búsqueda y se confirma desde los resultados', async () => {
    await renderSheet(null);
    await search('pizza');
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Pizza' }));
    await search('');
    await fireEvent.press(useButton());
    expect(onConfirm).toHaveBeenCalledWith('pizza');
  });

  it('enfocar el buscador pasa la hoja a modo compacto (más alta)', async () => {
    await renderSheet(null);
    const before = flat(screen.getByLabelText('Elegir ícono')).maxHeight as number;
    await fireEvent(screen.getByLabelText('Buscar ícono'), 'focus');
    const after = flat(screen.getByLabelText('Elegir ícono')).maxHeight as number;
    expect(after).toBeGreaterThan(before);
  });
});

describe('hoja: accesibilidad y áreas táctiles', () => {
  it('roles, etiquetas y estados', async () => {
    await renderSheet('bus');
    expect(screen.getByLabelText('Elegir ícono').props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByRole('header', { name: 'Elegir ícono' })).toBeTruthy();
    const search = screen.getByLabelText('Buscar ícono');
    expect(search.props.placeholder).toBe('Buscar ícono');
    expect(search.props.returnKeyType).toBe('search');
    expect(search.props.autoCorrect).toBe(false);
    expect(screen.getByLabelText('Grupos de íconos').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Íconos del grupo Transporte').props.accessibilityRole).toBe(
      'radiogroup',
    );
    for (const cell of cells()) {
      expect(cell.props.accessibilityState).toHaveProperty('selected');
    }
    expect(useButton().props.accessibilityState.disabled).toBe(true);
  });

  it('celdas, chips y botones miden al menos 48 dp (con fuente al 200 % también)', async () => {
    mockWindow(360, 2);
    await renderSheet('bus');
    for (const cell of cells()) expect(flat(cell).minHeight).toBeGreaterThanOrEqual(48);
    for (const item of screen.getAllByRole('radio', { name: /^Grupo / })) {
      expect(flat(item).minHeight).toBeGreaterThanOrEqual(48);
    }
    expect(flat(screen.getByRole('button', { name: 'Cerrar' })).height).toBeGreaterThanOrEqual(48);
    expect(flat(screen.getByLabelText('Buscar ícono')).minHeight).toBeGreaterThanOrEqual(48);
    // 4 columnas con fuente grande.
    expect(flat(cells()[0]!).width).toBe(Math.floor((312 - 8 * 3) / 4));
  });

  it('el glifo mide 24 sp y los glifos y la insignia quedan ocultos a los lectores', async () => {
    await renderSheet('bus');
    const glyph = screen.getByText('🚌', { includeHiddenElements: true });
    expect(StyleSheet.flatten(glyph.props.style).fontSize).toBe(24);
    expect(glyph.props.importantForAccessibility).toBe('no');
    const badge = within(screen.getByRole('radio', { name: 'Ícono Transporte público' })).getByText(
      '✓',
      { includeHiddenElements: true },
    );
    expect(badge.parent!.props.importantForAccessibility).toBe('no');
  });

  it('todos los grupos del diseño están presentes en orden', async () => {
    await renderSheet(null);
    const labels = screen
      .getAllByRole('radio', { name: /^Grupo / })
      .map((item) => item.props.accessibilityLabel);
    expect(labels).toEqual(ICON_GROUPS.map((group) => `Grupo ${group}`));
  });
});

describe('hoja: flechas de la barra de grupos (docs/007 §5.15.1; Jest no mide layout real)', () => {
  const strip = () => screen.getByTestId('icon-picker-groups');
  const right = () => screen.queryByRole('button', { name: 'Ver más grupos' });
  const left = () => screen.queryByRole('button', { name: 'Ver grupos anteriores' });
  const measure = async (viewport: number, content: number) => {
    await fireEvent(strip(), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: viewport, height: 48 } },
    });
    await fireEvent(strip(), 'contentSizeChange', content, 48);
  };
  const scrollBy = (x: number) =>
    fireEvent.scroll(strip(), { nativeEvent: { contentOffset: { x, y: 0 } } });
  let scrollTo: jest.SpyInstance;
  beforeEach(() => {
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  const xCalls = () => scrollTo.mock.calls.map((call) => call[0]).filter((a) => 'x' in a);

  it('si todo cabe no hay flechas ni huecos', async () => {
    await renderSheet(null);
    await measure(312, 300);
    expect(right()).toBeNull();
    expect(left()).toBeNull();
    expect(screen.queryByTestId('group-arrow-right')).toBeNull();
  });

  it('posición inicial (solo derecha), intermedia (ambas) y final (solo izquierda)', async () => {
    await renderSheet(null);
    expect(right()).toBeNull();
    await measure(216, 900);
    expect(right()).toBeTruthy();
    expect(left()).toBeNull();
    // Hueco reservado: la izquierda existe pero no está disponible.
    expect(screen.getByTestId('group-arrow-left', { hidden: true })).toBeTruthy();
    await scrollBy(300);
    expect(right()).toBeTruthy();
    expect(left()).toBeTruthy();
    await scrollBy(684);
    expect(right()).toBeNull();
    expect(left()).toBeTruthy();
  });

  it('la flecha no disponible conserva el hueco, es invisible, deshabilitada y sale de TalkBack', async () => {
    await renderSheet(null);
    await measure(216, 900);
    const gone = screen.getByTestId('group-arrow-left', { hidden: true });
    expect(flat(gone).opacity).toBe(0);
    expect(flat(gone).width).toBe(48);
    expect(gone.props.accessibilityState.disabled).toBe(true);
    expect(gone.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(gone.props.accessibilityElementsHidden).toBe(true);
  });

  it('etiquetas exactas, rol botón y área de al menos 48 dp con círculo de 40 dp', async () => {
    await renderSheet(null);
    await measure(216, 900);
    await scrollBy(300);
    for (const arrow of [left()!, right()!]) {
      expect(arrow.props.accessibilityRole).toBe('button');
      expect(flat(arrow).width).toBeGreaterThanOrEqual(48);
      expect(flat(arrow).height).toBeGreaterThanOrEqual(48);
    }
    expect(screen.queryByText('‹')).toBeNull();
    expect(screen.queryByText('›')).toBeNull();
  });

  it('tocar desplaza 0,8 × ancho visible, acota a los extremos y no cambia el grupo', async () => {
    await renderSheet(null);
    await measure(200, 900);
    scrollTo.mockClear();
    await fireEvent.press(right()!);
    expect(xCalls().at(-1)).toEqual({ x: 160, animated: true });
    // Toques rápidos: parte del último destino pedido.
    await fireEvent.press(right()!);
    expect(xCalls().at(-1)).toEqual({ x: 320, animated: true });
    for (let i = 0; i < 6 && right(); i++) await fireEvent.press(right()!);
    expect(xCalls().at(-1)).toEqual({ x: 700, animated: true });
    expect(right()).toBeNull();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Último grupo');
    await fireEvent.press(left()!);
    expect(xCalls().at(-1)).toEqual({ x: 540, animated: true });
    expect(chip('Dinero y ahorro').props.accessibilityState.selected).toBe(true);
  });

  it('hacia la izquierda se acota a 0 y anuncia «Primer grupo»', async () => {
    await renderSheet(null);
    await measure(200, 900);
    await scrollBy(100);
    await fireEvent.press(left()!);
    expect(xCalls().at(-1)).toEqual({ x: 0, animated: true });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Primer grupo');
  });

  it('un gesto de desplazamiento actualiza las flechas', async () => {
    await renderSheet(null);
    await measure(216, 900);
    expect(left()).toBeNull();
    await scrollBy(120);
    expect(left()).toBeTruthy();
    await scrollBy(0);
    expect(left()).toBeNull();
    expect(strip().props.scrollEventThrottle).toBe(16);
  });

  it('con reducir movimiento activo el desplazamiento es sin animación', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderSheet(null);
    await measure(200, 900);
    scrollTo.mockClear();
    await fireEvent.press(right()!);
    expect(xCalls().at(-1)).toEqual({ x: 160, animated: false });
  });

  it('seleccionar el último grupo mantiene la selección y lo centra', async () => {
    const last = ICON_GROUPS.at(-1)!;
    const entry = entriesOfGroup(CATEGORY, last)[0]!;
    await renderSheet(entry.key);
    expect(chip(last).props.accessibilityState.selected).toBe(true);
    await measure(216, 1000);
    scrollTo.mockClear();
    await fireEvent(chip(last), 'layout', {
      nativeEvent: { layout: { x: 900, y: 0, width: 100, height: 48 } },
    });
    expect(xCalls().at(-1)).toEqual({ x: 900 + 50 - 108, animated: false });
    expect(chip(last).props.accessibilityState.selected).toBe(true);
  });

  it('tras buscar y borrar, el grupo activo vuelve a quedar visible', async () => {
    const last = ICON_GROUPS.at(-1)!;
    await renderSheet(entriesOfGroup(CATEGORY, last)[0]!.key);
    await measure(216, 1000);
    await fireEvent.changeText(screen.getByLabelText('Buscar ícono'), 'bus');
    expect(screen.queryAllByRole('radio', { name: /^Grupo / })).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Buscar ícono'), '');
    scrollTo.mockClear();
    await measure(216, 1000);
    await fireEvent(chip(last), 'layout', {
      nativeEvent: { layout: { x: 900, y: 0, width: 100, height: 48 } },
    });
    expect(xCalls().at(-1)).toEqual({ x: 842, animated: false });
  });
});

describe('IconField (fila del formulario)', () => {
  const onChange = jest.fn();
  const renderField = (value: string | null, disabled = false) =>
    render(<IconField value={value} entries={CATEGORY} onChange={onChange} disabled={disabled} />);
  const row = () => screen.getByTestId('icon-field');

  beforeEach(() => onChange.mockClear());

  it('muestra glifo y nombre; el rótulo accesible dice «Ícono {nombre}, cambiar»', async () => {
    await renderField('coffee');
    expect(row().props.accessibilityRole).toBe('button');
    expect(row().props.accessibilityLabel).toBe('Ícono Café, cambiar');
    expect(screen.getByText('Ícono: Café')).toBeTruthy();
    expect(screen.getByText('Cambiar')).toBeTruthy();
    expect(flat(row()).minHeight).toBeGreaterThanOrEqual(56);
  });

  it('sin ícono es «predeterminado»', async () => {
    await renderField(null);
    expect(row().props.accessibilityLabel).toBe('Ícono predeterminado, cambiar');
    expect(screen.getByText('Ícono: predeterminado')).toBeTruthy();
  });

  it('una clave desconocida también es «predeterminado»', async () => {
    await renderField('icono-viejo');
    expect(row().props.accessibilityLabel).toBe('Ícono predeterminado, cambiar');
  });

  it('abrir la hoja no cambia el valor; Cancelar la cierra sin llamar a onChange', async () => {
    await renderField('coffee');
    await fireEvent.press(row());
    expect(screen.getByRole('header', { name: 'Elegir ícono' })).toBeTruthy();
    await fireEvent.press(chip('Transporte'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Auto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('header', { name: 'Elegir ícono' })).toBeNull();
    // La hoja arranca limpia en la apertura siguiente: sin la marca descartada.
    await fireEvent.press(row());
    expect(screen.getByText('Seleccionado: Café')).toBeTruthy();
  });

  it('abre en el grupo del ícono actual', async () => {
    await renderField('coffee');
    await fireEvent.press(row());
    expect(chip('Alimentación').props.accessibilityState.selected).toBe(true);
  });

  it('«Usar este ícono» llama a onChange con la clave, cierra y devuelve el foco a la fila', async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(7);
    await renderField('coffee');
    await fireEvent.press(row());
    await fireEvent.press(screen.getByRole('radio', { name: 'Ícono Pizza' }));
    await fireEvent.press(useButton());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pizza');
    expect(screen.queryByRole('header', { name: 'Elegir ícono' })).toBeNull();
    await waitFor(() => expect(focus).toHaveBeenCalledWith(7));
  });

  it('deshabilitada no abre la hoja', async () => {
    await renderField('coffee', true);
    expect(row().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(row());
    expect(screen.queryByRole('header', { name: 'Elegir ícono' })).toBeNull();
  });
});
