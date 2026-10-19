// Recursos nativos de R6 (docs/008 §13.2): icono, icono adaptativo y splash declarados en app.json.
// Sin @types/node: se declaran solo las partes de fs y path que usa la prueba.
type Bytes = {
  subarray: (from: number, to: number) => { toString: (encoding: string) => string };
  readUInt32BE: (offset: number) => number;
  toString: (encoding: string) => string;
};
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require('fs') as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Bytes;
};
const { join } = require('path') as { join: (...parts: string[]) => string };
/* eslint-enable @typescript-eslint/no-require-imports */

const root = join(__dirname, '..');
type Plugin = string | [string, Record<string, unknown>];
const expo = JSON.parse(readFileSync(join(root, 'app.json')).toString('utf8')).expo as {
  icon: string;
  splash?: unknown;
  plugins: Plugin[];
  android: { adaptiveIcon: Record<string, string | undefined> };
};

const splashPlugin = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as
  [string, { image: string; backgroundColor: string }] | undefined;

const referenced = [
  expo.icon,
  expo.android.adaptiveIcon.foregroundImage,
  expo.android.adaptiveIcon.monochromeImage,
  splashPlugin?.[1].image,
] as string[];

function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('recursos nativos (app.json)', () => {
  it('declara el plugin de splash y no usa splash ni backgroundImage', () => {
    expect(splashPlugin).toBeDefined();
    expect(expo.splash).toBeUndefined();
    expect(expo.android.adaptiveIcon.backgroundImage).toBeUndefined();
    expect(expo.android.adaptiveIcon.backgroundColor).toBe('#0F5F5A');
    expect(splashPlugin?.[1].backgroundColor).toBe('#0F5F5A');
  });

  it.each(referenced)('%s existe y mide 1024 x 1024', (ref) => {
    const path = join(root, ref);
    expect(existsSync(path)).toBe(true);
    expect(pngSize(path)).toEqual({ width: 1024, height: 1024 });
  });
});
