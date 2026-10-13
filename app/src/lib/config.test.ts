import { readConfig } from './config';

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
