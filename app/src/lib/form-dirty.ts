// Detección de cambios sin guardar de los formularios (docs/003 Rediseño R3 D4, docs/007 §5.5.1 B).
// «Cambio» = el estado actual difiere de la instantánea inicial tomada al montar. Los valores
// prefijados (fecha de hoy o la elegida en el calendario) no cuentan.
import { parseCentsFromInput, trimTrailingSeparator } from './money';

export interface TransactionFormValues {
  categoryId: string | null;
  monto: string;
  fecha: string;
  nota: string;
}

// El monto se compara en centavos («12.5» y «12.50» son iguales); si no se puede interpretar, por texto.
function normalizeAmount(text: string): string {
  const trimmed = trimTrailingSeparator(text);
  const cents = parseCentsFromInput(trimmed);
  return cents === null ? trimmed : String(cents);
}

// El tipo no se compara: al cambiarlo se limpia la categoría, así que cambiar solo de Gasto a Ingreso
// no pierde nada y volver al valor inicial tampoco cuenta como cambio.
export function isFormDirty(
  initial: TransactionFormValues,
  current: TransactionFormValues,
): boolean {
  return (
    current.categoryId !== initial.categoryId ||
    normalizeAmount(current.monto) !== normalizeAmount(initial.monto) ||
    current.fecha !== initial.fecha ||
    current.nota.trim() !== initial.nota.trim()
  );
}

export function isAccountFormDirty(values: {
  nombre: string;
  saldo: string;
  enContra: boolean;
}): boolean {
  return values.nombre.trim() !== '' || values.saldo.trim() !== '' || values.enContra;
}
