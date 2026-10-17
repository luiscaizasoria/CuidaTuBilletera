// Selector de ícono compartido por cuentas y categorías (R5.1b; docs/007 §5.15 A, docs/008 §6.17.3):
// fila «Ícono» del formulario (`IconField`) y hoja «Elegir ícono» (`IconPickerSheet`) con buscador,
// chips de grupo y rejilla. La hoja trabaja con un borrador: el formulario solo cambia con «Usar este
// ícono»; Cancelar, ✕, el fondo y Atrás descartan sin guardar.
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  entriesOfGroup,
  findIcon,
  groupsOf,
  initialGroup,
  searchIcons,
  type IconEntry,
} from '../lib/icon-catalog';
import {
  ARROW_SLOT_DP,
  NO_ARROWS,
  chipArrows,
  chipCenterTarget,
  chipRevealTarget,
  chipScrollTarget,
  type ChipArrows,
} from '../lib/chip-scroll';
import { colors, radii, sizes, typography } from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';
import { Sheet } from './sheets';
import { Button } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

const GAP = 8;
// Relleno horizontal de la hoja (`Sheet`): ancho útil de la rejilla = ventana - 2 * 24.
const SHEET_PADDING_X = 24;

// Presupuesto de alturas (dp) de la hoja, a fuente 1x. El layout real no se calcula aquí: estas constantes
// solo deciden si la hoja alta cabe (`iconSheetLayout`) y una prueba verifica que la suma no se pase.
export const SHEET_CHROME_DP = 12 + 4 + 24; // relleno superior + asa + relleno inferior (sin inset del sistema)
export const SHEET_GAP_DP = 12; // separación entre hijos directos de `Sheet`
export const HEAD_DP = sizes.touchMin; // encabezado: título y ✕
export const CONTROLS_DP = sizes.touchMin + GAP + sizes.touchMin; // buscador + chips
export const GRID_MIN_DP = 2 * sizes.touchMin + GAP; // dos filas completas de celdas
export const FOOTER_DP = 1 + 8 + 20 + 8 + sizes.touchMin; // borde, relleno, «Seleccionado», separación, botones
// Hijos directos de la hoja con controles fijos: asa, encabezado, controles, rejilla y pie (4 separaciones).
export const FIXED_CONTROLS_DP =
  SHEET_CHROME_DP + 4 * SHEET_GAP_DP + HEAD_DP + CONTROLS_DP + FOOTER_DP;
export const NEEDED_DP = FIXED_CONTROLS_DP + GRID_MIN_DP;
// Texto que crece con la fuente (título, «Seleccionado», etiquetas): margen por unidad de escala sobre 1.
const TEXT_GROWTH_DP = 40;
// Con fuente >= 1.5 el pie apila los botones (uno sobre otro).
const STACK_FONT_SCALE = 1.5;

export interface IconSheetLayout {
  // Hoja casi a pantalla completa (la alta de 75 % no deja la rejilla mínima, o el buscador tiene foco).
  compact: boolean;
  // Ni así caben controles fijos + rejilla mínima: buscador, chips y rejilla se desplazan juntos y solo
  // encabezado y pie quedan fijos.
  bodyScrolls: boolean;
  // Alto máximo de la hoja en esta variante y alto que quedaría a la rejilla con controles fijos.
  maxHeight: number;
  gridHeight: number;
}

// Decide `compact` y `bodyScrolls` por el espacio disponible (ventana, insets y teclado), sin constantes
// por modelo de teléfono. `Sheet` aplica el mismo cálculo de altura máxima (0.75 * alto - inset superior;
// compacta: alto - inset superior - 8).
export function iconSheetLayout({
  height,
  insetTop,
  insetBottom,
  keyboard,
  fontScale,
  searchFocused,
}: {
  height: number;
  insetTop: number;
  insetBottom: number;
  keyboard: number;
  fontScale: number;
  searchFocused: boolean;
}): IconSheetLayout {
  const usable = height - keyboard;
  const growth = (Math.min(Math.max(fontScale, 1), 2) - 1) * TEXT_GROWTH_DP;
  const stack = fontScale >= STACK_FONT_SCALE ? sizes.touchMin + GAP : 0;
  const needed = NEEDED_DP + insetBottom + growth + stack;
  const tallMax = 0.75 * usable - insetTop;
  const compactMax = usable - insetTop - 8;
  const compact = searchFocused || tallMax < needed;
  const maxHeight = compact ? compactMax : tallMax;
  return {
    compact,
    bodyScrolls: maxHeight < needed,
    maxHeight,
    gridHeight: maxHeight - (needed - GRID_MIN_DP),
  };
}

// Altura del teclado abierto (0 si está cerrado).
function useKeyboardHeight(): number {
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboard(event?.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboard;
}

// Columnas de la rejilla de íconos: clamp(floor((ancho + 8) / 56), 4, 6); con fuente >= 1.5, 4.
export function iconColumns(availableWidth: number, fontScale: number): number {
  if (fontScale >= 1.5) return 4;
  return Math.min(6, Math.max(4, Math.floor((availableWidth + 8) / 56)));
}

function useFocus() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

// Aro de foco de 2 dp `colors.text` (docs/008 §6.17.3) dibujado DENTRO del borde, separado 2 dp: no sustituye
// el borde de 3 dp del elemento seleccionado.
function FocusRing({ round }: { round?: boolean }) {
  return <View pointerEvents="none" {...hidden} style={[styles.ring, round && styles.ringRound]} />;
}

// Fila del formulario: glifo actual, «Ícono: {nombre}» y «Cambiar». Abre la hoja y, al cerrarla, devuelve
// el foco de TalkBack a esta fila.
export function IconField({
  value,
  entries,
  onChange,
  disabled,
  emptyText = 'Ícono: predeterminado',
  tile,
}: {
  value: string | null;
  entries: readonly IconEntry[];
  onChange: (key: string) => void;
  disabled: boolean;
  // Texto de la fila cuando no hay ícono elegido.
  emptyText?: string;
  // Fondo del mosaico del glifo (por omisión `segBg`).
  tile?: string;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<View>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { focused, focusProps } = useFocus();
  const current = findIcon(entries, value);

  function close() {
    setOpen(false);
    // Tras cerrar la hoja el foco vuelve a esta fila (el cierre del Modal necesita un instante).
    setTimeout(() => {
      try {
        const node = mounted.current ? findNodeHandle(rowRef.current) : null;
        if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
      } catch {
        // Mejor esfuerzo: sin foco programático no se pierde ninguna función.
      }
    }, 150);
  }

  return (
    <>
      <Pressable
        ref={rowRef}
        testID="icon-field"
        accessibilityRole="button"
        accessibilityLabel={`Ícono ${current ? current.name : 'predeterminado'}, cambiar`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        {...focusProps}
        style={({ pressed }) => [
          styles.field,
          focused && styles.fieldFocus,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View {...hidden} style={[styles.fieldTile, tile ? { backgroundColor: tile } : null]}>
          <Text {...hidden} maxFontSizeMultiplier={1.5} style={styles.fieldGlyph}>
            {current ? current.glyph : '🏷️'}
          </Text>
        </View>
        <Text style={styles.fieldText}>{current ? `Ícono: ${current.name}` : emptyText}</Text>
        <Text style={styles.fieldAction}>Cambiar</Text>
      </Pressable>
      {open ? (
        <IconPickerSheet
          visible
          entries={entries}
          value={value}
          onClose={close}
          onConfirm={(key) => {
            onChange(key);
            close();
          }}
        />
      ) : null}
    </>
  );
}

// La hoja y su borrador existen solo mientras está abierta (se reinician en cada apertura).
export function IconPickerSheet(props: SheetProps & { visible: boolean }) {
  const { visible, ...rest } = props;
  return visible ? <OpenIconPickerSheet {...rest} /> : null;
}

interface SheetProps {
  entries: readonly IconEntry[];
  // Clave actual del formulario (null = predeterminado).
  value: string | null;
  // Descarta sin guardar (Cancelar, ✕, fondo y Atrás).
  onClose: () => void;
  // Confirma la clave marcada («Usar este ícono»).
  onConfirm: (key: string) => void;
}

function OpenIconPickerSheet({ entries, value, onClose, onConfirm }: SheetProps) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSystemInsets();
  const keyboard = useKeyboardHeight();
  const groups = groupsOf(entries);
  const [draft, setDraft] = useState<string | null>(findIcon(entries, value)?.key ?? null);
  const [group, setGroup] = useState(() => initialGroup(entries, value));
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const confirmed = useRef(false);
  const initialKey = useRef(findIcon(entries, value)?.key ?? null);
  const titleRef = useRef<Text>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Desplazamiento inicial hasta la celda del ícono actual: pendiente hasta tener ambas posiciones.
  const pendingScroll = useRef(initialKey.current !== null);
  const cellsY = useRef<number | null>(null);
  const cellY = useRef<number | null>(null);

  const searching = query.trim() !== '';
  const results = searching ? searchIcons(entries, query) : [];
  const shown = searching ? results : entriesOfGroup(entries, group);
  const selected = findIcon(entries, draft);
  const layout = iconSheetLayout({
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    keyboard,
    fontScale,
    searchFocused,
  });
  const { compact, bodyScrolls } = layout;
  const columns = iconColumns(width - 2 * SHEET_PADDING_X, fontScale);
  const cell = Math.floor((width - 2 * SHEET_PADDING_X - GAP * (columns - 1)) / columns);
  const canConfirm = draft !== null && draft !== (findIcon(entries, value)?.key ?? null);

  // Al abrir, el foco de TalkBack va al título (mejor esfuerzo; el Modal necesita un instante).
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const node = findNodeHandle(titleRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
      } catch {
        // Mejor esfuerzo: sin foco programático no se pierde ninguna función.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  function tryScrollToSelection() {
    if (!pendingScroll.current || cellsY.current === null || cellY.current === null) return;
    pendingScroll.current = false;
    scrollRef.current?.scrollTo({
      y: Math.max(0, cellsY.current + cellY.current - GAP),
      animated: false,
    });
  }

  function confirm() {
    // Doble toque: el segundo se ignora.
    if (!canConfirm || confirmed.current || draft === null) return;
    confirmed.current = true;
    onConfirm(draft);
  }

  function chooseGroup(next: string) {
    pendingScroll.current = false;
    setGroup(next);
    const count = entriesOfGroup(entries, next).length;
    AccessibilityInfo.announceForAccessibility?.(`${next}, ${count} íconos`);
  }

  const controls = (
    <View style={styles.controls}>
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Buscar ícono"
          placeholder="Buscar ícono"
          placeholderTextColor={colors.text2}
          value={query}
          onChangeText={(text) => {
            pendingScroll.current = false;
            setQuery(text);
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          maxFontSizeMultiplier={1.5}
          style={styles.searchInput}
        />
        {query !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
            onPress={() => setQuery('')}
            style={styles.clearButton}
          >
            <Text {...hidden} style={styles.closeText}>
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {searching ? null : <GroupBar groups={groups} group={group} onChoose={chooseGroup} />}
    </View>
  );

  const gridContent =
    searching && results.length === 0 ? (
      <View style={styles.empty} accessibilityLiveRegion="polite">
        <Text style={styles.emptyText}>
          {`No encontramos íconos con «${query.trim()}». Prueba con otra palabra o elige un grupo.`}
        </Text>
        <Button label="Borrar búsqueda" variant="secondary" onPress={() => setQuery('')} />
      </View>
    ) : (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={searching ? 'Resultados de la búsqueda' : `Íconos del grupo ${group}`}
        testID="icon-picker-grid"
        style={styles.cells}
        onLayout={(event) => {
          cellsY.current = event.nativeEvent.layout.y;
          tryScrollToSelection();
        }}
      >
        {shown.map((entry) => (
          <IconCell
            key={entry.key}
            entry={entry}
            width={cell}
            selected={entry.key === draft}
            onPress={() => setDraft(entry.key)}
            onLayoutY={
              entry.key === initialKey.current
                ? (y) => {
                    cellY.current = y;
                    tryScrollToSelection();
                  }
                : undefined
            }
          />
        ))}
      </View>
    );

  return (
    <Sheet
      visible
      onClose={onClose}
      accessibilityLabel="Elegir ícono"
      testID="icon-picker-sheet"
      tall
      compact={compact}
    >
      <View style={styles.head}>
        <Text ref={titleRef} accessibilityRole="header" style={styles.title}>
          Elegir ícono
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text {...hidden} style={styles.closeText}>
            ✕
          </Text>
        </Pressable>
      </View>

      {bodyScrolls ? (
        <ScrollView
          ref={scrollRef}
          testID="icon-picker-scroll"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          style={styles.grid}
          contentContainerStyle={styles.bodyContent}
        >
          {controls}
          {gridContent}
        </ScrollView>
      ) : (
        <>
          {controls}
          <ScrollView
            ref={scrollRef}
            testID="icon-picker-scroll"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={[styles.grid, { minHeight: GRID_MIN_DP }]}
            contentContainerStyle={styles.gridContent}
          >
            {gridContent}
          </ScrollView>
        </>
      )}

      <View testID="icon-picker-footer" style={styles.footer}>
        {selected ? (
          <Text accessibilityLiveRegion="polite" style={styles.selectedName}>
            {`Seleccionado: ${selected.name}`}
          </Text>
        ) : null}
        <View
          testID="icon-picker-actions"
          style={[styles.actions, fontScale >= STACK_FONT_SCALE && styles.actionsStacked]}
        >
          <View style={styles.action}>
            <Button label="Cancelar" variant="ghost" onPress={onClose} />
          </View>
          <View style={styles.action}>
            <Button
              label="Usar este ícono"
              variant="primary"
              disabled={!canConfirm}
              onPress={confirm}
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

// Fila de grupos: [flecha ‹ 48] [ScrollView de chips] [flecha › 48] (docs/007 §5.15.1, docs/008 §6.17.5).
// Se monta solo cuando no hay búsqueda: al volver de ella arranca con el grupo vigente y lo recentra.
function GroupBar({
  groups,
  group,
  onChoose,
}: {
  groups: readonly string[];
  group: string;
  onChoose: (name: string) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const pos = useRef({ x: 0, viewport: 0, content: 0 });
  const target = useRef<number | null>(null);
  const chipBox = useRef(new Map<string, { x: number; w: number }>());
  // Centrado del grupo activo pendiente: se repite si cambia el ancho (al reservar los huecos) y termina
  // con la primera acción del usuario.
  const centering = useRef(true);
  const [arrows, setArrows] = useState<ChipArrows>(NO_ARROWS);
  const reserved = useRef(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled?.()?.then((value) => {
        if (alive) reduceMotion.current = value;
      });
    } catch {
      // Mejor esfuerzo: sin dato se anima.
    }
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
      reduceMotion.current = value;
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  function refresh() {
    const next = chipArrows({ ...pos.current, reserved: reserved.current });
    reserved.current = next.reserved;
    setArrows((prev) =>
      prev.reserved === next.reserved &&
      prev.canLeft === next.canLeft &&
      prev.canRight === next.canRight
        ? prev
        : next,
    );
  }

  function scrollTo(x: number, animated: boolean) {
    ref.current?.scrollTo({ x, animated });
    // El evento de scroll llega después; se anticipa para que las flechas sigan al destino.
    pos.current.x = x;
  }

  function center() {
    const box = chipBox.current.get(group);
    if (!centering.current || !box || pos.current.viewport <= 0) return;
    scrollTo(chipCenterTarget(pos.current.viewport, box.x, box.w), false);
    refresh();
  }

  function step(direction: 'left' | 'right') {
    centering.current = false;
    const { viewport, content } = pos.current;
    const from = target.current ?? pos.current.x;
    const next = chipScrollTarget(from, direction, viewport, content);
    target.current = next;
    scrollTo(next, !reduceMotion.current);
    refresh();
    const max = Math.max(0, content - viewport);
    if (direction === 'right' && next >= max - 1) {
      AccessibilityInfo.announceForAccessibility?.('Último grupo');
    } else if (direction === 'left' && next <= 1) {
      AccessibilityInfo.announceForAccessibility?.('Primer grupo');
    }
  }

  function choose(name: string) {
    centering.current = false;
    const box = chipBox.current.get(name);
    if (box && pos.current.viewport > 0) {
      const reveal = chipRevealTarget(pos.current.x, pos.current.viewport, box.x, box.w);
      if (reveal !== null) scrollTo(reveal, !reduceMotion.current);
    }
    onChoose(name);
  }

  return (
    <View style={styles.barRow}>
      {arrows.reserved ? (
        <ArrowButton
          direction="left"
          available={arrows.canLeft}
          label="Ver grupos anteriores"
          onPress={() => step('left')}
        />
      ) : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Grupos de íconos"
        style={styles.barScroll}
      >
        <ScrollView
          ref={ref}
          testID="icon-picker-groups"
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onLayout={(event) => {
            pos.current.viewport = event.nativeEvent.layout.width;
            center();
            refresh();
          }}
          onContentSizeChange={(width) => {
            pos.current.content = width;
            refresh();
          }}
          onScroll={(event) => {
            pos.current.x = event.nativeEvent.contentOffset.x;
            if (target.current !== null && Math.abs(pos.current.x - target.current) <= 1) {
              target.current = null;
            }
            refresh();
          }}
          onScrollBeginDrag={() => {
            centering.current = false;
            target.current = null;
          }}
          contentContainerStyle={styles.chips}
        >
          {groups.map((name) => (
            <GroupChip
              key={name}
              name={name}
              selected={name === group}
              onPress={() => choose(name)}
              onLayout={(x, w) => {
                chipBox.current.set(name, { x, w });
                if (name === group) center();
              }}
            />
          ))}
        </ScrollView>
      </View>
      {arrows.reserved ? (
        <ArrowButton
          direction="right"
          available={arrows.canRight}
          label="Ver más grupos"
          onPress={() => step('right')}
        />
      ) : null}
    </View>
  );
}

// Flecha de 48 x 48 dp con círculo de 40 dp y chevron dibujado con View (sin texto «‹» «›»). No disponible:
// invisible, deshabilitada y fuera de TalkBack, pero conserva su hueco.
function ArrowButton({
  direction,
  available,
  label,
  onPress,
}: {
  direction: 'left' | 'right';
  available: boolean;
  label: string;
  onPress: () => void;
}) {
  const { focused, focusProps } = useFocus();
  return (
    <Pressable
      testID={`group-arrow-${direction}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!available}
      accessibilityState={{ disabled: !available }}
      {...(available ? {} : { importantForAccessibility: 'no-hide-descendants' as const })}
      accessibilityElementsHidden={!available}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.arrow,
        !available && styles.arrowGone,
        pressed && styles.pressed,
      ]}
    >
      {focused && available ? <FocusRing round /> : null}
      <View {...hidden} style={styles.arrowCircle}>
        <View
          {...hidden}
          style={direction === 'right' ? styles.chevronRight : styles.chevronLeft}
        />
      </View>
    </Pressable>
  );
}

function GroupChip({
  name,
  selected,
  onPress,
  onLayout,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
  onLayout: (x: number, width: number) => void;
}) {
  const { focused, focusProps } = useFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Grupo ${name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLayout={(event) => onLayout(event.nativeEvent.layout.x, event.nativeEvent.layout.width)}
      {...focusProps}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      {focused ? <FocusRing /> : null}
      <Text numberOfLines={1} style={styles.chipText}>
        {selected ? <Text {...hidden}>✓ </Text> : null}
        {name}
      </Text>
    </Pressable>
  );
}

function IconCell({
  entry,
  width,
  selected,
  onPress,
  onLayoutY,
}: {
  entry: IconEntry;
  width: number;
  selected: boolean;
  onPress: () => void;
  // Posición vertical de la celda dentro de la rejilla (solo la del ícono actual).
  onLayoutY?: (y: number) => void;
}) {
  const { focused, focusProps } = useFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Ícono ${entry.name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLayout={onLayoutY ? (event) => onLayoutY(event.nativeEvent.layout.y) : undefined}
      {...focusProps}
      style={({ pressed }) => [
        styles.cell,
        { width },
        selected && styles.cellSelected,
        pressed && styles.pressed,
      ]}
    >
      {focused ? <FocusRing /> : null}
      <Text
        {...hidden}
        maxFontSizeMultiplier={1.5}
        style={[styles.cellGlyph, entry.text && styles.cellGlyphText]}
      >
        {entry.glyph}
      </Text>
      {selected ? (
        <View {...hidden} style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md - 2,
    backgroundColor: colors.segBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGlyph: { fontSize: 24, lineHeight: 30 },
  fieldText: { ...typography.body, flex: 1, minWidth: 0, color: colors.text },
  fieldAction: { ...typography.brandLabel, color: colors.brand700 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...typography.h2, color: colors.text, flexShrink: 1 },
  closeButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchMin,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: sizes.touchMin,
    paddingHorizontal: 12,
    color: colors.text,
  },
  clearButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { gap: GAP },
  chips: { gap: GAP, paddingRight: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center' },
  barScroll: { flex: 1, minWidth: 0 },
  arrow: {
    width: ARROW_SLOT_DP,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGone: { opacity: 0 },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.segBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chevron de 11 x 11 dp con dos bordes de 3 dp girados 45 grados; el desplazamiento centra la punta.
  chevronRight: {
    width: 11,
    height: 11,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.text,
    borderRadius: 1,
    transform: [{ translateX: -3 }, { rotate: '45deg' }],
  },
  chevronLeft: {
    width: 11,
    height: 11,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.text,
    borderRadius: 1,
    transform: [{ translateX: 3 }, { rotate: '45deg' }],
  },
  chip: {
    minHeight: sizes.touchMin,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderWidth: 3, borderColor: colors.text, backgroundColor: colors.brand100 },
  chipText: { ...typography.brandLabel, color: colors.text },
  grid: { flexShrink: 1 },
  gridContent: { paddingBottom: 4 },
  bodyContent: { gap: GAP, paddingBottom: 4 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    minHeight: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md - 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cellSelected: { borderWidth: 3, borderColor: colors.text, backgroundColor: colors.brand100 },
  cellGlyph: { fontSize: 24, lineHeight: 30 },
  cellGlyphText: { fontWeight: '800', color: colors.text },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: colors.white },
  selectedName: { ...typography.small, color: colors.text2 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  emptyText: { ...typography.body, color: colors.text2, textAlign: 'center' },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 8 },
  actions: { flexDirection: 'row', gap: GAP },
  actionsStacked: { flexDirection: 'column-reverse' },
  action: { flex: 1 },
  fieldFocus: { borderWidth: 2, borderColor: colors.text },
  ring: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: radii.md - 6,
  },
  ringRound: { borderRadius: 22 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
