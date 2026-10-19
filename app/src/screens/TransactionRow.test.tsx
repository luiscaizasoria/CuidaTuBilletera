import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { category, transaction } from '../resources-test-utils';
import { colors } from '../theme/tokens';
import TransactionRow, { categoryMap } from './TransactionRow';
import { relaxTimeoutsForColdCache } from '../test-utils';

relaxTimeoutsForColdCache();

const food = category({ id: 'c1', nombre: 'Comida', icono: 'utensils', color: '#E53935' });

// Los adornos están ocultos a los lectores de pantalla: se consultan incluyendo elementos ocultos.
const HIDDEN = { includeHiddenElements: true };

describe('TransactionRow (R4)', () => {
  it('categoryMap indexa por id', () => {
    expect(categoryMap([food]).get('c1')).toBe(food);
  });

  it('gasto: «-$6.50» en expenseText sin truncar y etiqueta con tipo, importe y nota', async () => {
    const onPress = jest.fn();
    await render(
      <TransactionRow
        transaction={transaction({ monto: 650, nota: 'Almuerzo con Ana', categoryId: 'c1' })}
        category={food}
        onPress={onPress}
      />,
    );
    const amount = screen.getByText('-$6.50');
    expect(StyleSheet.flatten(amount.props.style)).toMatchObject({
      color: colors.expenseText,
      flexShrink: 0,
      fontSize: 16,
      fontWeight: '800',
    });
    expect(amount.props.numberOfLines).toBeUndefined();
    const row = screen.getByRole('button', {
      name: 'Editar movimiento de Comida del 14/10/2026: gasto de $6.50, nota: Almuerzo con Ana',
    });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ingreso: «+$800.00» en incomeText y etiqueta sin nota', async () => {
    await render(
      <TransactionRow
        transaction={transaction({ tipo: 'ingreso', monto: 80000 })}
        category={food}
        onPress={() => undefined}
      />,
    );
    expect(StyleSheet.flatten(screen.getByText('+$800.00').props.style).color).toBe(
      colors.incomeText,
    );
    expect(
      screen.getByRole('button', {
        name: 'Editar movimiento de Comida del 14/10/2026: ingreso de $800.00',
      }),
    ).toBeTruthy();
  });

  it('tarjeta de al menos 56 dp, ícono de 40 dp, nombre a dos líneas sin elipsis y nota con elipsis', async () => {
    await render(
      <TransactionRow
        transaction={transaction({ nota: 'una nota' })}
        category={category({ nombre: 'A'.repeat(40) })}
        onPress={() => undefined}
      />,
    );
    const row = screen.getByRole('button');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: 56, borderRadius: 16 });
    expect(
      StyleSheet.flatten(screen.getByTestId('category-icon', HIDDEN).props.style),
    ).toMatchObject({
      width: 40,
      height: 40,
      borderRadius: 12,
    });
    const name = screen.getByText('A'.repeat(40));
    expect(name.props.numberOfLines).toBe(2);
    expect(name.props.ellipsizeMode).toBe('clip');
    const note = screen.getByText('una nota');
    expect(note.props.numberOfLines).toBe(2);
    expect(note.props.ellipsizeMode).toBeUndefined();
  });

  it('no repite la fecha salvo que se pida con showDate', async () => {
    const tx = transaction({ fecha: '2026-10-14' });
    const view = await render(
      <TransactionRow transaction={tx} category={food} onPress={() => undefined} />,
    );
    expect(screen.queryByText('14/10/2026')).toBeNull();
    await view.unmount();
    await render(
      <TransactionRow transaction={tx} category={food} onPress={() => undefined} showDate />,
    );
    expect(screen.getByText('14/10/2026')).toBeTruthy();
  });

  it('categoría archivada: ícono con opacidad 0.5; sin categoría: nombre genérico y gris por defecto', async () => {
    const view = await render(
      <TransactionRow
        transaction={transaction()}
        category={category({ archivada: true })}
        onPress={() => undefined}
      />,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('category-icon', HIDDEN).props.style).opacity,
    ).toBe(0.5);
    await view.unmount();
    await render(
      <TransactionRow transaction={transaction()} category={undefined} onPress={() => undefined} />,
    );
    expect(screen.getByText('Categoría')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('category-icon', HIDDEN).props.style),
    ).toMatchObject({
      backgroundColor: '#6B7280',
    });
  });
});
