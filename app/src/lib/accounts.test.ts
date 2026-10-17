import { accountPalette } from '../theme/tokens';
import { account } from '../resources-test-utils';
import {
  accountColorIndex,
  accountColors,
  accountColorsFor,
  accountIcon,
  accountIconFor,
  activeAccountsTotal,
  avatarInitial,
  firstName,
} from './accounts';

describe('accountColorIndex', () => {
  it('es estable y cae en la paleta de 6 tonos', () => {
    const ids = ['acc-1', 'acc-2', '0f8b1c2e-1234-4abc-9def-000000000000', '', 'ñ'];
    for (const id of ids) {
      const index = accountColorIndex(id);
      expect(index).toBe(accountColorIndex(id));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(accountPalette.length);
      expect(Number.isInteger(index)).toBe(true);
    }
  });

  it('valores conocidos del hash (x = x*31 + código, 32 bits sin signo)', () => {
    expect(accountColorIndex('')).toBe(0);
    expect(accountColorIndex('a')).toBe(97 % 6);
    expect(accountColorIndex('ab')).toBe((97 * 31 + 98) % 6);
  });

  it('no desborda con ids largos', () => {
    const index = accountColorIndex('z'.repeat(500));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(6);
  });

  it('accountColors devuelve el tono de la paleta', () => {
    expect(accountColors('a')).toBe(accountPalette[97 % 6]);
  });
});

describe('activeAccountsTotal', () => {
  it('suma exacta de las activas, incluidos negativos', () => {
    expect(
      activeAccountsTotal([
        account({ id: '1', saldo: 1250 }),
        account({ id: '2', saldo: -2550 }),
        account({ id: '3', saldo: 100 }),
      ]),
    ).toEqual({ total: -1200, count: 3 });
  });

  it('excluye las archivadas', () => {
    expect(
      activeAccountsTotal([
        account({ id: '1', saldo: 1000 }),
        account({ id: '2', saldo: 500 }),
        account({ id: '3', saldo: 99999, archivada: true }),
      ]),
    ).toEqual({ total: 1500, count: 2 });
  });

  it('null con 0 o 1 activas', () => {
    expect(activeAccountsTotal([])).toBeNull();
    expect(activeAccountsTotal([account()])).toBeNull();
    expect(
      activeAccountsTotal([account({ id: '1' }), account({ id: '2', archivada: true })]),
    ).toBeNull();
  });

  it('null si algún saldo no es entero seguro o la suma desborda', () => {
    expect(
      activeAccountsTotal([account({ id: '1', saldo: 1.5 }), account({ id: '2' })]),
    ).toBeNull();
    expect(
      activeAccountsTotal([
        account({ id: '1', saldo: Number.MAX_SAFE_INTEGER }),
        account({ id: '2', saldo: 1 }),
      ]),
    ).toBeNull();
  });
});

describe('firstName y avatarInitial', () => {
  it('primer nombre o null; nunca el correo', () => {
    expect(firstName('Ana María López')).toBe('Ana');
    expect(firstName('  ')).toBeNull();
    expect(firstName(undefined)).toBeNull();
  });

  it('inicial del nombre o del correo', () => {
    expect(avatarInitial('ana', 'x@example.com')).toBe('A');
    expect(avatarInitial(undefined, 'beto@example.com')).toBe('B');
    expect(avatarInitial('', '')).toBe('?');
  });
});

describe('accountIcon', () => {
  it('tarjeta 💳, banco 🏦 y el resto 👛, sin distinguir mayúsculas', () => {
    expect(accountIcon('Tarjeta Visa')).toBe('💳');
    expect(accountIcon('BANCO del Pichincha')).toBe('🏦');
    expect(accountIcon('Efectivo')).toBe('👛');
  });
});

describe('accountColorsFor y accountIconFor', () => {
  it('con apariencia guardada usan el color y el glifo elegidos', () => {
    const acc = account({ id: 'acc-1', nombre: 'Banco', color: 'limon', icono: 'plane' });
    expect(accountColorsFor(acc)).toMatchObject({ card: '#FFF6D6', tile: '#FFE58A' });
    expect(accountIconFor(acc)).toBe('✈\uFE0F');
  });

  it('con null o claves desconocidas conservan el hash del id y el ícono por nombre', () => {
    for (const [color, icono] of [
      [null, null],
      ['nuevo', 'cohete'],
    ] as const) {
      const acc = account({ id: 'acc-1', nombre: 'Banco', color, icono });
      expect(accountColorsFor(acc)).toBe(accountColors('acc-1'));
      expect(accountIconFor(acc)).toBe('🏦');
    }
    expect(accountIconFor(account({ nombre: 'Efectivo', icono: null }))).toBe('👛');
  });
});
