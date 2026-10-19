import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { colors } from '../theme/tokens';
import DatePickerSheet from './DatePickerSheet';
import { relaxTimeoutsForColdCache } from '../test-utils';

relaxTimeoutsForColdCache();

const base = { visible: true, today: '2026-10-15', onClose: () => undefined };

describe('DatePickerSheet: tono neutro y valor vacío (R4)', () => {
  it('sin tipo, el día elegido usa colors.text como relleno', async () => {
    await render(<DatePickerSheet {...base} value="2026-10-03" onSelect={() => undefined} />);
    const selected = screen.getByRole('button', { name: '3 de octubre de 2026' });
    expect(selected.props.accessibilityState.selected).toBe(true);
    const filled = screen.getByText('3').parent!;
    expect(StyleSheet.flatten(filled.props.style).backgroundColor).toBe(colors.text);
  });

  it('con tipo conserva el color del tipo de movimiento', async () => {
    await render(
      <DatePickerSheet {...base} value="2026-10-03" tipo="gasto" onSelect={() => undefined} />,
    );
    expect(StyleSheet.flatten(screen.getByText('3').parent!.props.style).backgroundColor).toBe(
      colors.expense,
    );
  });

  it('con valor vacío abre en el mes de hoy y no marca ningún día', async () => {
    const onSelect = jest.fn();
    await render(<DatePickerSheet {...base} value="" onSelect={onSelect} />);
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    const selected = screen
      .getAllByRole('button')
      .filter((node) => node.props.accessibilityState?.selected);
    expect(selected).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: '20 de octubre de 2026' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-20');
  });
});
