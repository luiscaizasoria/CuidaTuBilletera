import { readConfig, readLegalLinks } from './config';

describe('readConfig', () => {
  it('devuelve la configuración sin barra final', () => {
    expect(readConfig({ apiUrl: ' https://api.test/ ', googleWebClientId: 'web-id' })).toEqual({
      apiUrl: 'https://api.test',
      googleWebClientId: 'web-id',
    });
  });

  it.each([
    [{}],
    [{ apiUrl: 'https://api.test' }],
    [{ googleWebClientId: 'web-id' }],
    [{ apiUrl: ' ', googleWebClientId: 'web-id' }],
  ])('devuelve null si falta un valor: %j', (env) => {
    expect(readConfig(env)).toBeNull();
  });
});

describe('readLegalLinks', () => {
  it('devuelve las dos URL https sin espacios', () => {
    expect(
      readLegalLinks({
        privacyPolicyUrl: ' https://ejemplo.test/privacidad ',
        accountDeletionUrl: 'https://ejemplo.test/eliminar',
      }),
    ).toEqual({
      privacyPolicyUrl: 'https://ejemplo.test/privacidad',
      accountDeletionUrl: 'https://ejemplo.test/eliminar',
    });
  });

  it.each([
    [undefined],
    [''],
    ['   '],
    ['http://ejemplo.test/privacidad'],
    ['ftp://ejemplo.test'],
    ['javascript:alert(1)'],
    ['ejemplo.test/privacidad'],
    ['https://'],
    ['https:// con espacios'],
  ])('rechaza %j', (value) => {
    expect(readLegalLinks({ privacyPolicyUrl: value, accountDeletionUrl: value })).toEqual({
      privacyPolicyUrl: null,
      accountDeletionUrl: null,
    });
  });

  it('cada enlace se valida por separado', () => {
    expect(
      readLegalLinks({
        privacyPolicyUrl: 'https://ejemplo.test/p',
        accountDeletionUrl: 'http://x',
      }),
    ).toEqual({ privacyPolicyUrl: 'https://ejemplo.test/p', accountDeletionUrl: null });
  });

  it('no afecta a readConfig: sin enlaces la configuración sigue completa', () => {
    expect(readConfig({ apiUrl: 'https://api.test', googleWebClientId: 'w' })).not.toBeNull();
    expect(readLegalLinks({})).toEqual({ privacyPolicyUrl: null, accountDeletionUrl: null });
  });

  it('sin variables EXPO_PUBLIC_* ambas son null', () => {
    expect(readLegalLinks()).toEqual({ privacyPolicyUrl: null, accountDeletionUrl: null });
  });
});
