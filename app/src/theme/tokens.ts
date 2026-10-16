// Tokens visuales (docs/008 §11). Sin dependencias de React: solo valores.
export const colors = {
  // marca: SOLO acción primaria, FAB, tarjeta de saldo, foco, botón secundario y enlaces
  brand800: '#0B4A46',
  brand700: '#0F5F5A',
  brand500: '#1F8A80', // solo decorativo (banda al 35 %)
  brand100: '#D3EBF0',
  brandInk: '#0B4A46',
  onBrandSoft: '#E6F7F4',
  // superficies y texto
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  segBg: '#F3EEE6',
  text: '#17211F',
  text2: '#4B5653',
  text3: '#5F6B68',
  border: '#EEE7DC',
  borderStrong: '#7E8A86',
  // semánticos (fijos)
  income: '#12804A',
  incomeText: '#0E6A3D',
  incomeSoft: '#D9F4E4',
  expense: '#D13A2F',
  expenseText: '#B42A20',
  expenseSoft: '#FFE1D9',
  // acento
  yellow: '#FFC93C',
  yellowSoft: '#FFF1C2',
  yellowText: '#6B4E00',
  yellowBorder: '#E8C560',
  archivedRow: '#F4F0EA', // fondo de la fila de cuenta archivada (docs/008)
  white: '#FFFFFF',
} as const;

// Color por módulo (docs/007 §3.6). Nunca en la barra de contexto, importes ni FAB.
export const moduleColors = {
  cuenta: { tile: '#D3EBF0', ink: '#0B4A46' },
  movimientos: { tile: '#FFEDA6', ink: '#5C4000', strong: '#F5A524' },
  calendario: { tile: '#DCEBFF', ink: '#174C86', strong: '#2563C9' },
  reportes: { tile: '#ECE4FF', ink: '#4E2DA3' },
  mas: { tile: '#E3E8EF', ink: '#334155' },
} as const;

// Paleta de cuentas (docs/007 §5.2.4).
export const accountPalette = [
  { name: 'aguamarina', card: '#E3F6F8', tile: '#BDE9EF' },
  { name: 'lavanda', card: '#F0EBFF', tile: '#D9CCFF' },
  { name: 'albaricoque', card: '#FFF0E0', tile: '#FFD6A8' },
  { name: 'celeste', card: '#E7F1FF', tile: '#C5DBFF' },
  { name: 'rosa', card: '#FDEAF2', tile: '#F8CADD' },
  { name: 'limón', card: '#FFF6D6', tile: '#FFE58A' },
] as const;

// Capas decorativas (View con opacity), verificadas compuestas en docs/008 §3.
export const depth = {
  bandColor: colors.brand500,
  bandOpacity: 0.35,
  bandRotate: '-16deg',
  circleColor: colors.white,
  circleOpacity: 0.08,
  accountCardCircleOpacity: 0.45,
  scrim: 'rgba(23,33,31,0.45)', // velo detrás de las hojas inferiores
  blobs: [
    { color: '#FFD966', opacity: 0.35 },
    { color: '#FFB59A', opacity: 0.25 },
    { color: '#9CC4FF', opacity: 0.25 },
  ],
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16, accountCard: 20, xl: 24, pill: 999 } as const;

export const typography = {
  amountXl: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  amountInput: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  rootTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  totalAmount: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  accountBalance: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  accountName: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  greeting: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  brandLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  tab: { fontSize: 11.5, lineHeight: 14, fontWeight: '700' },
} as const;

export const elevation = { card: 1, raised: 4 } as const;

// Sombras: `elevation` en Android; `shadow*` por compatibilidad con otras plataformas y pruebas.
export const shadows = {
  card: {
    elevation: elevation.card,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  raised: {
    elevation: elevation.raised,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
} as const;

// Cifras tabulares para importes. Tipo mutable: `TextStyle.fontVariant` no acepta tuplas de solo lectura.
export const tabularNums: { fontVariant: ['tabular-nums'] } = { fontVariant: ['tabular-nums'] };

export const sizes = {
  touchMin: 48,
  tabHeight: 62,
  contextBar: 56,
  contextBarCompact: 36,
  fab: 56,
  primaryTall: 52,
  accountCardMin: 88,
  accountCardMinWide: 92,
  accountIcon: 52,
  avatar: 40,
  tabMinWidth: 48,
  tabPillPadX: 10,
  chipSmHeight: 36,
  chipHitSlop: 6,
  segmentOption: 48,
  categoryOptionMin: 56,
  categoryIcon: 32,
  dateCell: 48,
  calendarCellHeight: 52,
  headerPig: 72,
  headerPigWide: 96,
  headerPigLargeFont: 48,
  pigZoom: 1.4,
  balanceCardMin: 132,
  balanceCardPig: 104,
  moduleTile: 36,
  moduleTileSm: 28,
  monthArrow: 32,
  categoryBar: 10,
} as const;

// Margen lateral de las pantallas (docs/003 R4 D6): 16 dp con ancho menor de 400 dp y 20 dp desde 400 dp.
export const WIDE_SCREEN_DP = 400;
export function screenMargin(windowWidth: number): number {
  return windowWidth >= WIDE_SCREEN_DP ? 20 : 16;
}
