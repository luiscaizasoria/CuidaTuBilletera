import type { DeleteAccountFailureReason } from './auth-service';
import {
  CONFIRM_WORD,
  DELETE_ALTERNATIVE,
  DELETE_CANCELLED_MESSAGE,
  DELETE_FAILURE_MESSAGES,
  DELETE_UNCERTAIN_MESSAGE,
  DELETE_WILL_KEEP,
  DELETE_WILL_REMOVE,
  deleteFailureMessage,
  matchesConfirmation,
} from './account-deletion-messages';

describe('matchesConfirmation', () => {
  it.each(['ELIMINAR', 'eliminar', 'Eliminar', ' ELIMINAR ', '\n eliminar\t'])(
    'acepta %j',
    (value) => {
      expect(matchesConfirmation(value)).toBe(true);
    },
  );

  it.each(['', ' ', 'ELIMINA', 'ELIMINARR', 'ELIM INAR', 'BORRAR', 'ELIMINAR!'])(
    'rechaza %j',
    (value) => {
      expect(matchesConfirmation(value)).toBe(false);
    },
  );

  it('la palabra de confirmación es el literal que exige la API', () => {
    expect(CONFIRM_WORD).toBe('ELIMINAR');
  });
});

describe('textos de eliminación', () => {
  const reasons: DeleteAccountFailureReason[] = [
    'reauth-required',
    'network',
    'server',
    'invalid-request',
    'play-services',
    'config',
    'in-progress',
    'unknown',
  ];

  it('hay un texto por cada razón y ninguno afirma una eliminación', () => {
    expect(Object.keys(DELETE_FAILURE_MESSAGES).sort()).toEqual([...reasons].sort());
    for (const reason of reasons) {
      const text = deleteFailureMessage(reason, false, 'ana@example.com');
      expect(text).toContain('No se eliminó nada');
      expect(text).not.toContain('{correo}');
    }
  });

  it('reauth-required nombra el correo de la sesión, o lo omite sin correo', () => {
    expect(deleteFailureMessage('reauth-required', false, 'ana@example.com')).toBe(
      'Usa la cuenta de Google con la que iniciaste sesión (ana@example.com). No se eliminó nada.',
    );
    expect(deleteFailureMessage('reauth-required', false)).toBe(
      'Usa la cuenta de Google con la que iniciaste sesión. No se eliminó nada.',
    );
  });

  it('el correo se inserta literal aunque contenga patrones de reemplazo como $& (D-3)', () => {
    expect(deleteFailureMessage('reauth-required', false, "a$&b$'c@example.com")).toContain(
      "(a$&b$'c@example.com)",
    );
  });

  it('con incertidumbre manda el texto de «no pudimos confirmar»', () => {
    expect(deleteFailureMessage('network', true)).toBe(DELETE_UNCERTAIN_MESSAGE);
    expect(DELETE_UNCERTAIN_MESSAGE).toMatch(/^No pudimos confirmar si se eliminó tu cuenta/);
  });

  it('la cancelación es neutra', () => {
    expect(DELETE_CANCELLED_MESSAGE).toBe(
      'No se eliminó nada. Para continuar, confirma con tu cuenta de Google.',
    );
  });

  it('qué se elimina y qué no: sin cifras ni plazos de conservación', () => {
    expect(DELETE_WILL_REMOVE).toMatch(/cuentas.*categorías.*movimientos/);
    expect(DELETE_WILL_REMOVE).toContain('anulados');
    expect(DELETE_WILL_REMOVE).toContain('archivados');
    expect(DELETE_WILL_KEEP).toContain('exportaste');
    expect(DELETE_WILL_KEEP).toContain('cuenta de Google');
    expect(DELETE_WILL_KEEP).toContain('política de privacidad');
    for (const text of [DELETE_WILL_KEEP, DELETE_WILL_REMOVE, DELETE_ALTERNATIVE]) {
      expect(text).not.toMatch(/\d/);
    }
  });
});
