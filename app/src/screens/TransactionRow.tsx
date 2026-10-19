import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateEs } from '../lib/dates';
import { formatCents } from '../lib/money';
import type { Category, Transaction } from '../lib/resources-api';
import { colors, radii, shadows, tabularNums, typography } from '../theme/tokens';
import { CategoryIcon } from './form-ui';

export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

// Fila de movimiento (docs/007 §5.11 C.5, docs/008 §6.14): ícono de categoría de 40 dp, nombre hasta
// dos líneas sin elipsis, nota hasta dos líneas con elipsis e importe con signo sin truncar. La fecha
// no se repite en cada fila: la muestra el encabezado del día (`showDate` solo para listas sin grupos).
export default function TransactionRow({
  transaction,
  category,
  onPress,
  showDate = false,
}: {
  transaction: Transaction;
  category: Category | undefined;
  onPress: () => void;
  showDate?: boolean;
}) {
  const name = category?.nombre ?? 'Categoría';
  const isExpense = transaction.tipo === 'gasto';
  const amount = `${isExpense ? '-' : '+'}${formatCents(transaction.monto)}`;
  const note = transaction.nota ? `, nota: ${transaction.nota}` : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar movimiento de ${name} del ${formatDateEs(transaction.fecha)}: ${isExpense ? 'gasto' : 'ingreso'} de ${formatCents(transaction.monto)}${note}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, shadows.card, pressed && styles.pressed]}
    >
      <CategoryIcon
        icono={category?.icono ?? ''}
        color={category?.color ?? ''}
        size={40}
        dimmed={category?.archivada === true}
      />
      <View style={styles.body}>
        <Text numberOfLines={2} ellipsizeMode="clip" style={styles.name}>
          {name}
        </Text>
        {showDate ? <Text style={styles.note}>{formatDateEs(transaction.fecha)}</Text> : null}
        {transaction.nota ? (
          <Text numberOfLines={2} style={styles.note}>
            {transaction.nota}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, isExpense ? styles.expense : styles.income]}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
  note: { ...typography.small, color: colors.text2 },
  amount: { fontSize: 16, lineHeight: 22, fontWeight: '800', flexShrink: 0, ...tabularNums },
  expense: { color: colors.expenseText },
  income: { color: colors.incomeText },
});
