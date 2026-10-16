// Selector de fecha propio (docs/003 Rediseño R3 D5, docs/008 §6.13 punto 4): cuadrícula mensual de
// `lib/calendar.ts` en una hoja. Rango enero 2000 a diciembre 2100; fechas futuras permitidas.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  buildMonthGrid,
  dateKey,
  initialMonthFor,
  MONTH_NAMES,
  monthTitle,
  shiftMonth,
  weekdayHeaders,
  type YearMonth,
} from '../lib/calendar';
import type { TransactionType } from '../lib/resources-api';
import { colors, sizes, typography } from '../theme/tokens';
import { Sheet } from './sheets';
import { Button } from './ui';

const hidden = { importantForAccessibility: 'no', accessibilityElementsHidden: true } as const;

export default function DatePickerSheet({
  visible,
  value,
  today,
  tipo,
  onSelect,
  onClose,
}: {
  visible: boolean;
  // Fecha actual del formulario (AAAA-MM-DD): fija el mes inicial y el día elegido.
  value: string;
  today: string;
  tipo: TransactionType;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<YearMonth>(() => initialMonthFor(value));
  // Cada apertura empieza en el mes de la fecha del formulario.
  useEffect(() => {
    if (visible) setView(initialMonthFor(value));
    // Solo al abrir: `value` no cambia mientras la hoja está abierta.
  }, [visible]);

  const previous = shiftMonth(view.year, view.month, -1);
  const next = shiftMonth(view.year, view.month, 1);
  const accent = tipo === 'gasto' ? colors.expense : colors.income;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Elige una fecha"
      testID="date-picker"
    >
      <Text accessibilityRole="header" style={styles.title}>
        Elige una fecha
      </Text>
      {/* La hoja trae 24 dp de relleno; el diseño usa 8 para que las celdas lleguen a 48 dp. */}
      <View style={styles.body}>
        <View style={styles.monthRow}>
          <MonthArrow
            glyph="‹"
            label="Mes anterior"
            disabled={previous === null}
            onPress={() => previous && setView(previous)}
          />
          <Text accessibilityRole="header" style={styles.monthTitle}>
            {monthTitle(view.year, view.month)}
          </Text>
          <MonthArrow
            glyph="›"
            label="Mes siguiente"
            disabled={next === null}
            onPress={() => next && setView(next)}
          />
        </View>
        <View style={styles.weekRow} {...hidden}>
          {weekdayHeaders().map((header, index) => (
            <Text key={index} style={styles.weekday}>
              {header.short}
            </Text>
          ))}
        </View>
        {buildMonthGrid(view.year, view.month).map((week, row) => (
          <View key={row} style={styles.weekRow}>
            {week.map((day, col) => {
              if (day === null) return <View key={col} style={styles.cell} />;
              const key = dateKey(view.year, view.month, day);
              const selected = key === value;
              const isToday = key === today;
              return (
                <Pressable
                  key={col}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} de ${MONTH_NAMES[view.month - 1]!.toLowerCase()} de ${view.year}${isToday ? ', hoy' : ''}`}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(key)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.circle,
                      isToday && !selected && styles.circleToday,
                      selected && { backgroundColor: accent },
                    ]}
                  >
                    <Text style={[styles.day, selected && styles.daySelected]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Button label="Cerrar" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

function MonthArrow({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrow, disabled && styles.arrowDisabled]}
    >
      <View style={styles.arrowCircle} {...hidden}>
        <Text style={styles.arrowGlyph}>{glyph}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text },
  body: { marginHorizontal: -16 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: {
    ...typography.h2,
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.text,
  },
  arrow: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.4 },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  arrowGlyph: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: colors.text },
  weekRow: { flexDirection: 'row' },
  weekday: {
    ...typography.small,
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text2,
  },
  cell: { flex: 1, height: sizes.dateCell, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleToday: { borderWidth: 2, borderColor: colors.text },
  day: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text },
  daySelected: { fontWeight: '800', color: colors.white },
});
