// @ts-expect-error: importación ?raw de Vite, sin tipos.
import wranglerSource from '../wrangler.jsonc?raw';
import { describe, expect, it } from 'vitest';
import { DEV_GOOGLE_WEB_CLIENT_ID } from '../src/lib/reauth-diagnostics';

// Quita comentarios (// y /* */) fuera de cadenas y comas finales; luego JSON.parse.
function parseJsonc(text: string): unknown {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 2;
    } else {
      out += c;
      i++;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

type Config = {
  vars?: Record<string, string>;
  env?: Record<string, { vars?: Record<string, string> }>;
};
const config = parseJsonc(wranglerSource as string) as Config;
const devVars = config.env?.dev?.vars ?? {};
const prodVars = config.env?.prod?.vars ?? {};

describe('wrangler.jsonc y la guarda del diagnóstico REAUTH_REQUIRED', () => {
  it('la constante es exactamente el cliente Web de DEV', () => {
    expect(devVars.GOOGLE_WEB_CLIENT_ID).toBeTypeOf('string');
    expect(DEV_GOOGLE_WEB_CLIENT_ID).toBe(devVars.GOOGLE_WEB_CLIENT_ID);
  });

  it('el cliente Web de PROD es distinto', () => {
    expect(prodVars.GOOGLE_WEB_CLIENT_ID).toBeTypeOf('string');
    expect(prodVars.GOOGLE_WEB_CLIENT_ID).not.toBe(DEV_GOOGLE_WEB_CLIENT_ID);
  });

  it('ENVIRONMENT y REAUTH_DIAGNOSTICS no están versionados en ningún vars', () => {
    const todos = [config.vars ?? {}, devVars, prodVars];
    for (const vars of todos) {
      expect(Object.keys(vars)).not.toContain('ENVIRONMENT');
      expect(Object.keys(vars)).not.toContain('REAUTH_DIAGNOSTICS');
    }
  });
});
