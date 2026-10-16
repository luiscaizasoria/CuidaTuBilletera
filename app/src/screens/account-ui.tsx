// Piezas de la navegación centrada en cuentas (docs/007 §5; docs/008 §6): tarjeta de cuenta, barra de
// contexto, barra de pestañas, botón flotante y aviso de cuenta archivada.
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { accountColors, accountIcon } from '../lib/accounts';
import { formatCents } from '../lib/money';
import type { Account } from '../lib/resources-api';
import {
  colors,
  depth,
  moduleColors,
  radii,
  screenMargin,
  shadows,
  sizes,
  tabularNums,
  typography,
} from '../theme/tokens';
import { useSystemInsets } from '../theme/useSystemInsets';
import type { BalanceStatus, Tab } from './navigation';

const WIDE = 400;
const NARROW = 340;
const LARGE_FONT = 1.3;
const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

// Saldo mostrable o null: nunca se inventa una cifra (formatCents devuelve «$0.00» ante valores
// no enteros seguros, docs/003 Decisión R0 D3).
export function balanceText(saldo: number, status: BalanceStatus = 'ok'): string | null {
  if (status === 'error' || !Number.isSafeInteger(saldo)) return null;
  return formatCents(saldo);
}

export const ARCHIVED_NOTICE =
  'Cuenta archivada. Puedes consultar su historial, pero no anotar movimientos.';

export function ArchivedNotice() {
  return <Text style={styles.archivedNotice}>{ARCHIVED_NOTICE}</Text>;
}

// Tarjeta de cuenta de Mis cuentas: un único botón, sin acciones internas.
export function AccountCard({
  account,
  onPress,
  hint,
}: {
  account: Account;
  onPress: () => void;
  hint?: string;
}) {
  const { width } = useWindowDimensions();
  const palette = accountColors(account.id);
  const saldo = balanceText(account.saldo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${account.nombre}, saldo actual ${saldo ?? 'no disponible'}. Abrir cuenta`}
      onPress={onPress}
      testID={`account-card-${account.id}`}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: palette.card,
          minHeight: width >= WIDE ? sizes.accountCardMinWide : sizes.accountCardMin,
        },
        pressed && styles.pressed,
      ]}
    >
      <View pointerEvents="none" style={styles.cardCircle} {...hidden} />
      <View style={[styles.cardTile, { backgroundColor: palette.tile }]} {...hidden}>
        <Text style={styles.cardTileEmoji}>{accountIcon(account.nombre)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardName}>
          {account.nombre}
        </Text>
        <Text style={styles.small}>Saldo actual</Text>
        <Text style={[styles.cardBalance, tabularNums, account.saldo < 0 && styles.negative]}>
          {saldo ?? 'Saldo no disponible'}
        </Text>
        {hint ? <Text style={styles.small}>{hint}</Text> : null}
      </View>
      <View style={styles.cardChevron} {...hidden}>
        <Text style={styles.cardChevronText}>›</Text>
      </View>
    </Pressable>
  );
}

// Barra de contexto de la cuenta activa: completa (con salida y selector), de solo lectura o compacta.
export function AccountContextBar({
  account,
  balance,
  variant,
  showBalance = true,
  balanceWord = 'saldo',
  exitLabel,
  exitAccessibilityLabel,
  onExit,
  onRetry,
  onOpenSwitcher,
}: {
  account: Account;
  balance: BalanceStatus;
  variant: 'full' | 'readOnly' | 'compact';
  showBalance?: boolean;
  balanceWord?: string;
  exitLabel?: string;
  exitAccessibilityLabel?: string;
  onExit?: () => void;
  onRetry?: () => void;
  onOpenSwitcher?: () => void;
}) {
  const saldo = showBalance ? balanceText(account.saldo, balance) : null;
  const failed = showBalance && balance === 'error';
  const refreshing = showBalance && balance === 'refreshing';
  let label = `Cuenta ${account.nombre}`;
  if (saldo) label += `, ${balanceWord} ${saldo}`;
  if (account.archivada) label += ', archivada';
  if (refreshing) label += ', actualizando saldo';
  if (failed) label += ', saldo no disponible';
  const selectable = variant === 'full' && onOpenSwitcher !== undefined;
  const { width, fontScale } = useWindowDimensions();
  // Pantalla estrecha o fuente grande: dos filas para no truncar la salida ni el saldo.
  const twoRows = width <= NARROW || fontScale >= LARGE_FONT;
  const palette = accountColors(account.id);

  if (variant === 'compact') {
    return (
      <View testID="context-bar" style={[styles.bar, styles.barCompact]}>
        <View accessible accessibilityRole="text" accessibilityLabel={label} style={styles.info}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.barName, styles.name]}>
            {account.nombre}
          </Text>
          <Text style={[styles.barBalanceCompact, tabularNums]}>
            {' · '}
            {saldo ?? 'Saldo no disponible'}
          </Text>
          {account.archivada ? <ArchivedBadge /> : null}
        </View>
      </View>
    );
  }

  const identity = (
    <>
      <View style={[styles.barTile, { backgroundColor: palette.tile }]} {...hidden}>
        <Text style={styles.barTileEmoji}>{accountIcon(account.nombre)}</Text>
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.barName, styles.name]}>
        {account.nombre}
      </Text>
      {selectable ? (
        <Text testID="context-bar-chevron" style={styles.chevron} {...hidden}>
          ▾
        </Text>
      ) : null}
    </>
  );
  const status = (
    <>
      {account.archivada ? <ArchivedBadge /> : null}
      {saldo ? (
        <View style={styles.balancePill}>
          <Text style={[styles.barBalance, tabularNums, account.saldo < 0 && styles.negative]}>
            {saldo}
          </Text>
        </View>
      ) : null}
      {refreshing ? (
        <ActivityIndicator size={12} color={colors.text2} testID="context-bar-refreshing" />
      ) : null}
    </>
  );
  const errorArea = failed ? (
    <View style={styles.errorArea}>
      <Text style={styles.barError} {...(twoRows ? hidden : {})}>
        Saldo no disponible
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar saldo"
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;
  const exit = onExit ? (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exitAccessibilityLabel}
        onPress={onExit}
        style={styles.exit}
      >
        <Text style={styles.exitText}>{exitLabel}</Text>
      </Pressable>
      <View style={styles.separator} {...hidden} />
    </>
  ) : null;
  const infoProps = {
    accessibilityLabel: label,
    accessibilityState: refreshing ? { busy: true } : {},
  };
  // En una fila el bloque incluye el estado (que envuelve antes de ocultar el nombre); en dos
  // filas el estado va abajo, oculto a la accesibilidad porque ya está en la etiqueta del bloque.
  const infoContent = twoRows ? (
    identity
  ) : (
    <>
      {identity}
      {status}
    </>
  );
  const info = selectable ? (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Toca para cambiar de cuenta"
      onPress={onOpenSwitcher}
      style={[styles.info, styles.infoWrap, styles.infoTouch]}
      {...infoProps}
    >
      {infoContent}
    </Pressable>
  ) : (
    <View accessible accessibilityRole="text" style={[styles.info, styles.infoWrap]} {...infoProps}>
      {infoContent}
    </View>
  );

  if (twoRows) {
    return (
      <View testID="context-bar" style={[styles.bar, styles.barTwoRows, shadows.card]}>
        <View testID="context-bar-row1" style={styles.row}>
          {exit}
          {info}
        </View>
        <View testID="context-bar-row2" style={[styles.row, styles.row2]}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.row}
          >
            {status}
          </View>
          {errorArea}
        </View>
      </View>
    );
  }

  return (
    <View testID="context-bar" style={[styles.bar, styles.barWrap, shadows.card]}>
      {exit}
      {info}
      {errorArea}
    </View>
  );
}

function ArchivedBadge() {
  return <Text style={styles.archivedBadge}>Archivada</Text>;
}

const TABS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'cuenta', label: 'Cuenta', icon: '🏠' },
  { tab: 'movimientos', label: 'Movimientos', icon: '📋' },
  { tab: 'calendario', label: 'Calendario', icon: '📅' },
  { tab: 'reportes', label: 'Reportes', icon: '📊' },
  { tab: 'mas', label: 'Más', icon: '⋯' },
];

// Barra inferior de cinco pestañas. Etiquetas completas, sin truncar.
export function BottomTabs({
  active,
  onChange,
  onLayout,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSystemInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Secciones de la cuenta"
      onLayout={onLayout}
      style={[styles.tabs, { paddingBottom: insets.bottom }]}
    >
      {TABS.map(({ tab, label, icon }) => {
        const selected = tab === active;
        const tone = moduleColors[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab)}
            style={styles.tab}
          >
            <View style={[styles.tabPill, selected && { backgroundColor: tone.tile }]} {...hidden}>
              <Text style={styles.tabIcon}>{icon}</Text>
            </View>
            <Text style={[styles.tabLabel, selected && { color: tone.ink, fontWeight: '800' }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const FAB_NOTE = 'Cuenta archivada: no admite movimientos nuevos';

// Botón flotante «Nuevo movimiento». Con la cuenta archivada se ve deshabilitado y explicado.
export function Fab({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="box-none" style={[styles.fabArea, { right: screenMargin(width) }]}>
      {disabled ? (
        <Text pointerEvents="none" style={styles.fabNote}>
          {FAB_NOTE}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo movimiento"
        accessibilityHint={disabled ? FAB_NOTE : undefined}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          if (!disabled) onPress();
        }}
        testID="fab"
        style={({ pressed }) => [
          styles.fab,
          shadows.raised,
          pressed && { backgroundColor: colors.brand800 },
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.fabPlus} {...hidden}>
          <Text style={styles.fabPlusText}>+</Text>
        </View>
        <Text style={styles.fabText}>Nuevo movimiento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  shrink: { flexShrink: 1 },
  negative: { color: colors.expenseText },
  small: { ...typography.small, color: colors.text2 },
  archivedNotice: {
    backgroundColor: colors.yellowSoft,
    color: colors.yellowText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    borderRadius: radii.md,
    padding: 12,
    marginVertical: 12,
  },
  // Tarjeta de cuenta
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.accountCard,
    paddingTop: 12,
    paddingRight: 14,
    paddingBottom: 12,
    paddingLeft: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardCircle: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    right: -34,
    top: -44,
    backgroundColor: colors.white,
    opacity: depth.accountCardCircleOpacity,
  },
  cardTile: {
    width: sizes.accountIcon,
    height: sizes.accountIcon,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTileEmoji: { fontSize: 28 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { ...typography.accountName, color: colors.text },
  cardBalance: { ...typography.accountBalance, color: colors.text },
  cardChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChevronText: { fontSize: 18, fontWeight: '800', color: colors.text },
  // Barra de contexto
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.contextBar,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    gap: 8,
  },
  barWrap: { flexWrap: 'wrap' },
  barTwoRows: { flexDirection: 'column', alignItems: 'stretch', gap: 0, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  row2: { paddingLeft: 4 },
  name: { flexShrink: 1, minWidth: 64 },
  chevron: { fontSize: 14, fontWeight: '800', color: colors.text },
  infoWrap: { flexWrap: 'wrap' },
  barCompact: { minHeight: sizes.contextBarCompact, paddingHorizontal: 16 },
  exit: { minWidth: 48, minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  exitText: { fontSize: 14, fontWeight: '800', color: colors.text },
  separator: { width: 1, alignSelf: 'stretch', marginVertical: 12, backgroundColor: colors.border },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  infoTouch: { minHeight: 48 },
  barTile: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTileEmoji: { fontSize: 16 },
  barName: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.text },
  balancePill: {
    backgroundColor: colors.segBg,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  barBalance: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.text },
  barBalanceCompact: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.text2 },
  archivedBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.yellowText,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  errorArea: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barError: { fontSize: 13, fontWeight: '700', color: colors.expenseText },
  retry: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 4 },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brand700,
    textDecorationLine: 'underline',
  },
  // Pestañas
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: sizes.tabMinWidth,
    minHeight: sizes.tabHeight,
    paddingHorizontal: 2,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabPill: {
    paddingHorizontal: sizes.tabPillPadX,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  tabIcon: { fontSize: 20, lineHeight: 24 },
  tabLabel: { ...typography.tab, color: colors.text2, textAlign: 'center' },
  // Botón flotante
  fabArea: { position: 'absolute', bottom: 16, alignItems: 'flex-end', gap: 8 },
  fab: {
    minHeight: sizes.fab,
    borderRadius: radii.pill,
    backgroundColor: colors.brand700,
    paddingLeft: 8,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabPlus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPlusText: { fontSize: 24, fontWeight: '900', color: colors.text },
  fabText: { fontSize: 16, fontWeight: '800', color: colors.white },
  fabNote: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.yellowText,
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 230,
    overflow: 'hidden',
  },
});
