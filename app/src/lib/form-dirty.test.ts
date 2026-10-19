import { isAccountFormDirty, isFormDirty, type TransactionFormValues } from './form-dirty';

const initial: TransactionFormValues = {
  categoryId: null,
  monto: '',
  fecha: '2026-10-16',
  nota: '',
};
const withValues = (change: Partial<TransactionFormValues>) => ({ ...initial, ...change });

describe('isFormDirty', () => {
  it('sin tocar nada no hay cambios (la fecha prefijada no cuenta)', () => {
    expect(isFormDirty(initial, { ...initial })).toBe(false);
  });

  it.each([
    ['categoría elegida', { categoryId: 'c1' }],
    ['monto escrito', { monto: '5' }],
    ['nota escrita', { nota: 'x' }],
    ['fecha distinta', { fecha: '2026-10-15' }],
  ])('%s es un cambio', (_name, change) => {
    expect(isFormDirty(initial, withValues(change))).toBe(true);
  });

  it('una nota de solo espacios, un monto con separador suelto o vacío no cuentan', () => {
    expect(isFormDirty(initial, withValues({ nota: '   ' }))).toBe(false);
    expect(isFormDirty(initial, withValues({ monto: '' }))).toBe(false);
  });

  it('escribir y borrar para volver al valor inicial no es un cambio', () => {
    expect(isFormDirty(initial, withValues({ monto: '5' }))).toBe(true);
    expect(isFormDirty(initial, withValues({ monto: '' }))).toBe(false);
  });

  it('en edición el monto se compara en centavos y la nota con trim', () => {
    const edit: TransactionFormValues = {
      categoryId: 'c1',
      monto: '12.50',
      fecha: '2026-10-10',
      nota: 'original',
    };
    expect(isFormDirty(edit, { ...edit, monto: '12.5' })).toBe(false);
    expect(isFormDirty(edit, { ...edit, monto: '12.5.' })).toBe(false);
    expect(isFormDirty(edit, { ...edit, monto: '012.50' })).toBe(false);
    expect(isFormDirty(edit, { ...edit, nota: '  original  ' })).toBe(false);
    expect(isFormDirty(edit, { ...edit, monto: '12.51' })).toBe(true);
    expect(isFormDirty(edit, { ...edit, nota: 'otra' })).toBe(true);
    expect(isFormDirty(edit, { ...edit, fecha: '2026-10-11' })).toBe(true);
  });
});

describe('isAccountFormDirty', () => {
  it('solo cuenta nombre con texto, saldo no vacío o signo marcado', () => {
    expect(isAccountFormDirty({ nombre: '', saldo: '', enContra: false })).toBe(false);
    expect(isAccountFormDirty({ nombre: '   ', saldo: '  ', enContra: false })).toBe(false);
    expect(isAccountFormDirty({ nombre: 'a', saldo: '', enContra: false })).toBe(true);
    expect(isAccountFormDirty({ nombre: '', saldo: '0', enContra: false })).toBe(true);
    expect(isAccountFormDirty({ nombre: '', saldo: '', enContra: true })).toBe(true);
  });
});

describe('isAccountFormDirty con apariencia', () => {
  const base = { nombre: '', saldo: '', enContra: false };
  it('elegir solo un color o un ícono cuenta como cambio', () => {
    expect(isAccountFormDirty({ ...base, appearance: { color: 'rosa', icono: null } })).toBe(true);
    expect(isAccountFormDirty({ ...base, appearance: { color: null, icono: 'bank' } })).toBe(true);
  });
  it('Predeterminado sin otros datos no es cambio', () => {
    expect(isAccountFormDirty({ ...base, appearance: { color: null, icono: null } })).toBe(false);
  });
});
