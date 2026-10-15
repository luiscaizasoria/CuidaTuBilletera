import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateEs } from '../lib/dates';
import { formatCents } from '../lib/money';
import type { Category, Transaction } from '../lib/resources-api';
import { screenStyles as s } from './ui';

export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

// Fila de movimiento: categoría, fecha, nota y monto con signo (gasto negativo).
export default function TransactionRow({
  transaction,
  category,
  onPress,
}: {
  transaction: Transaction;
  category: Category | undefined;
  onPress: () => void;
}) {
  const name = category?.nombre ?? 'Categoría';
  const amount = `${transaction.tipo === 'gasto' ? '-' : '+'}${formatCents(transaction.monto)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar movimiento de ${name} del ${formatDateEs(transaction.fecha)}`}
      onPress={onPress}
      style={s.row}
    >
      <View style={styles.line}>
        <View style={[styles.swatch, { backgroundColor: category?.color ?? '#757575' }]} />
        <Text style={[s.rowTitle, styles.grow]}>{name}</Text>
        <Text style={[s.rowTitle, transaction.tipo === 'gasto' ? styles.expense : styles.income]}>
          {amount}
        </Text>
      </View>
      <Text style={s.rowSubtitle}>{formatDateEs(transaction.fecha)}</Text>
      {transaction.nota ? <Text style={s.rowSubtitle}>{transaction.nota}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  expense: { color: '#b3261e' },
  income: { color: '#2e7d32' },
});
