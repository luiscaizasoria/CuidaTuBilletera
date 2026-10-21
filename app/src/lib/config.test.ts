import { DEV_CLEARTEXT_HOSTS, readConfig, readLegalLinks } from './config';

const PROD = { isDev: false };
const DEV = { isDev: true };

describe('readConfig', () => {
  it('devuelve la configuración sin barra final', () => {
    expect(
      readConfig({ apiUrl: ' https://api.test/ ', googleWebClientId: 'web-id' }, PROD),
    ).toEqual({
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

  it('googleWebClientId se recorta y no puede quedar vacío', () => {
    expect(readConfig({ apiUrl: 'https://api.test', googleWebClientId: ' id ' }, PROD)).toEqual({
      apiUrl: 'https://api.test',
      googleWebClientId: 'id',
    });
    expect(readConfig({ apiUrl: 'https://api.test', googleWebClientId: '  ' }, PROD)).toBeNull();
  });

  it.each([
    ['https://api.test', 'https://api.test'],
    ['https://api.test/', 'https://api.test'],
    ['https://api.test///', 'https://api.test'],
    ['https://api.test/api/', 'https://api.test/api'],
    ['https://api.test/api//', 'https://api.test/api'],
    ['https://api.test:8443/v1', 'https://api.test:8443/v1'],
    ['https://API.Test/', 'https://api.test'],
    ['https://[::1]:8443/', 'https://[::1]:8443'],
  ])('acepta y normaliza %s', (apiUrl, expected) => {
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, PROD)?.apiUrl).toBe(expected);
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, DEV)?.apiUrl).toBe(expected);
  });

  it('la lista de hosts http de desarrollo es exactamente la esperada', () => {
    expect([...DEV_CLEARTEXT_HOSTS]).toEqual(['localhost', '127.0.0.1', '10.0.2.2']);
  });

  it.each(DEV_CLEARTEXT_HOSTS)('http://%s: aceptado solo con isDev', (host) => {
    const env = { apiUrl: `http://${host}:8787/`, googleWebClientId: 'w' };
    expect(readConfig(env, DEV)?.apiUrl).toBe(`http://${host}:8787`);
    expect(readConfig(env, PROD)).toBeNull();
    expect(readConfig(env, {})).toBeNull();
  });

  // Formas alternativas de loopback: URL las normaliza a 127.0.0.1, que sí está en la lista.
  // Se fija el comportamiento: solo en desarrollo; nunca en producción.
  it.each(['http://127.1', 'http://0x7f.0.0.1', 'http://2130706433'])(
    '%s se normaliza a 127.0.0.1 solo en desarrollo',
    (apiUrl) => {
      expect(readConfig({ apiUrl, googleWebClientId: 'w' }, DEV)?.apiUrl).toBe('http://127.0.0.1');
      expect(readConfig({ apiUrl, googleWebClientId: 'w' }, PROD)).toBeNull();
    },
  );

  it.each([
    'http://192.168.1.10:8787',
    'http://10.0.2.3',
    'http://api.test',
    'http://[::1]:8787',
    'http://localhost.evil.test',
  ])('http hacia un host no permitido se rechaza incluso en desarrollo: %s', (apiUrl) => {
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, DEV)).toBeNull();
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, PROD)).toBeNull();
  });

  it.each([
    'ftp://api.test',
    'javascript:alert(1)',
    'api.test',
    '//api.test',
    '',
    '   ',
    'https://',
    'https://user@api.test',
    'https://user:pass@api.test',
    'https://:pass@api.test',
    'https://api.test?x=1',
    'https://api.test/?x=1',
    'https://api.test#x',
    'https://api.test/api#x',
    'https://api.test?',
    'https://api.test\\api',
    'https://api .test',
    'https://api.test/a b',
    'https://api.test/\tapi',
    'https://api.test/\u0000',
  ])('rechaza la URL no válida %j', (apiUrl) => {
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, PROD)).toBeNull();
    expect(readConfig({ apiUrl, googleWebClientId: 'w' }, DEV)).toBeNull();
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
