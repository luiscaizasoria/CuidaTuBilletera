import { describe, expect, it } from 'vitest';
import { parseAndroidClientIds, requireAndroidClientIds } from './auth-config';

const WEB = '111-web.apps.googleusercontent.com';
const A1 = '1-a.apps.googleusercontent.com';
const A2 = '2-b.apps.googleusercontent.com';
const A3 = '3-c.apps.googleusercontent.com';
const A4 = '4-d.apps.googleusercontent.com';
const A5 = '5-e.apps.googleusercontent.com';

const configError = { status: 500, code: 'CONFIG_ERROR' };

describe('parseAndroidClientIds', () => {
  it.each([undefined, '', '   ', '\t\n'])('trata %j como no definida', (raw) => {
    expect(parseAndroidClientIds(raw, WEB)).toEqual([]);
  });

  it('acepta de 1 a 4 elementos y recorta espacios por elemento', () => {
    expect(parseAndroidClientIds(A1, WEB)).toEqual([A1]);
    expect(parseAndroidClientIds(` ${A1} , ${A2}`, WEB)).toEqual([A1, A2]);
    expect(parseAndroidClientIds(`${A1},${A2},${A3}`, WEB)).toEqual([A1, A2, A3]);
    expect(parseAndroidClientIds(`${A1},${A2},${A3},${A4}`, WEB)).toEqual([A1, A2, A3, A4]);
  });

  it.each([
    ['5 elementos', `${A1},${A2},${A3},${A4},${A5}`],
    ['duplicado', `${A1},${A2},${A1}`],
    ['coma doble', `${A1},,${A2}`],
    ['coma final', `${A1},`],
    ['coma inicial', `,${A1}`],
    ['mayúsculas', '1-A.apps.googleusercontent.com'],
    ['espacio interno', '1-a b.apps.googleusercontent.com'],
    ['tabulador interno', '1-a\tb.apps.googleusercontent.com'],
    ['espacio de no separación interno', '1-a b.apps.googleusercontent.com'],
    ['dígito Unicode de ancho completo', '１-a.apps.googleusercontent.com'],
    ['comodín', '*'],
    ['comodín parcial', '1-*.apps.googleusercontent.com'],
    ['prefijo no numérico', 'x1-a.apps.googleusercontent.com'],
    ['sin prefijo numérico', '-a.apps.googleusercontent.com'],
    ['sin sufijo', '1-a'],
    ['sufijo distinto', '1-a.apps.example.com'],
    ['sufijo con texto extra', `${A1}.evil.com`],
    ['más de 128 caracteres', `1-${'a'.repeat(120)}.apps.googleusercontent.com`],
    ['cliente Web en la lista', `${A1},${WEB}`],
  ])('rechaza %s con CONFIG_ERROR', (_n, raw) => {
    expect(() => parseAndroidClientIds(raw, WEB)).toThrowError(
      expect.objectContaining(configError),
    );
  });

  it('el mensaje del error no incluye los valores configurados', () => {
    try {
      parseAndroidClientIds('valor-secreto-invalido', WEB);
      expect.unreachable();
    } catch (error) {
      expect(JSON.stringify(error) + String((error as Error).message)).not.toContain(
        'valor-secreto-invalido',
      );
    }
  });
});

describe('requireAndroidClientIds', () => {
  const base = { GOOGLE_WEB_CLIENT_ID: WEB };

  it('sin variables: política desactivada', () => {
    expect(requireAndroidClientIds(base)).toEqual([]);
    expect(
      requireAndroidClientIds({
        ...base,
        GOOGLE_ANDROID_CLIENT_ID: '',
        GOOGLE_ANDROID_CLIENT_IDS: ' ',
      }),
    ).toEqual([]);
  });

  it('la variable heredada sigue funcionando sin validación estricta', () => {
    expect(requireAndroidClientIds({ ...base, GOOGLE_ANDROID_CLIENT_ID: ' legado ' })).toEqual([
      'legado',
    ]);
  });

  it('usa la lista nueva', () => {
    expect(requireAndroidClientIds({ ...base, GOOGLE_ANDROID_CLIENT_IDS: `${A1}, ${A2}` })).toEqual(
      [A1, A2],
    );
  });

  it('ambas variables definidas es CONFIG_ERROR', () => {
    expect(() =>
      requireAndroidClientIds({
        ...base,
        GOOGLE_ANDROID_CLIENT_ID: A1,
        GOOGLE_ANDROID_CLIENT_IDS: A2,
      }),
    ).toThrowError(expect.objectContaining(configError));
  });

  it('lista inválida nunca degrada a «sin política», aunque exista la heredada vacía', () => {
    expect(() =>
      requireAndroidClientIds({
        ...base,
        GOOGLE_ANDROID_CLIENT_ID: '',
        GOOGLE_ANDROID_CLIENT_IDS: 'x',
      }),
    ).toThrowError(expect.objectContaining(configError));
  });

  it('cliente Web dentro de la lista es CONFIG_ERROR', () => {
    expect(() =>
      requireAndroidClientIds({ ...base, GOOGLE_ANDROID_CLIENT_IDS: `${A1},${WEB}` }),
    ).toThrowError(expect.objectContaining(configError));
  });
});
