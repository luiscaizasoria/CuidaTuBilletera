import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { MAX_JSON_BODY_BYTES } from '../src/lib/json-body';
import { count, DB_HOOK_TIMEOUT_MS, freshDb } from './d1-helpers';
import { AUTH_ENV, createGoogleFixture, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let db: D1Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  fx = await createGoogleFixture();
});
beforeEach(async () => {
  db = await freshDb();
  app = createApp({ googleKeys: fx.keys, now: () => NOW });
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

// Base real que cuenta cada acceso: permite verificar que un rechazo no toca D1.
function spyDb() {
  const calls: string[] = [];
  const proxy = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof prop !== 'string' || typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(prop);
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { env: { ...AUTH_ENV, DB: proxy }, calls };
}

const VALID_REFRESH = 'A'.repeat(43);
const ROUTES = ['/auth/google', '/auth/refresh', '/auth/logout'] as const;
const PAD = (json: string, bytes: number) =>
  json + ' '.repeat(bytes - new TextEncoder().encode(json).length);

function send(path: string, body: BodyInit | null, headers: Record<string, string>, env: object) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
      // Necesario en Node/Workers para cuerpos de tipo stream.
      ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    } as RequestInit,
    env,
  );
}

// Stream sin tamaño declarado; cuenta cuántos fragmentos se pidieron y si se canceló.
function chunkedStream(chunkBytes: number, chunks: number) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) return controller.close();
      state.pulled += 1;
      controller.enqueue(new Uint8Array(chunkBytes).fill(0x20));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

async function expectTooLarge(response: Response) {
  const text = await response.text();
  expect(response.status).toBe(413);
  expect(JSON.parse(text)).toEqual({
    error: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande.' },
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(text).not.toMatch(/stack|Error:|D1|SQL|idToken|refreshToken|16384|bytes/);
}

describe.each(ROUTES)('límite de cuerpo en %s', (path) => {
  const tooBig = 'x'.repeat(MAX_JSON_BODY_BYTES + 1);

  it('Content-Length declarado sobre el máximo: 413 sin tocar D1', async () => {
    const { env, calls } = spyDb();
    const response = await send(path, tooBig, { 'content-length': String(tooBig.length) }, env);
    await expectTooLarge(response);
    expect(calls).toEqual([]);
  });

  it('sin Content-Length y stream grande: 413, se cancela y no se lee todo', async () => {
    const { env, calls } = spyDb();
    const { stream, state } = chunkedStream(4096, 10_000); // 40 MB potenciales
    const response = await send(path, stream, {}, env);
    await expectTooLarge(response);
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(20);
    expect(calls).toEqual([]);
  });

  it('Content-Length menor que el cuerpo real: 413 contando bytes', async () => {
    const { env, calls } = spyDb();
    const response = await send(path, tooBig, { 'content-length': '10' }, env);
    await expectTooLarge(response);
    expect(calls).toEqual([]);
  });

  it('cuenta bytes y no caracteres: UTF-8 multibyte sobre el máximo', async () => {
    const { env } = spyDb();
    const body = 'ñ'.repeat(MAX_JSON_BODY_BYTES / 2 + 1); // 2 bytes cada uno
    await expectTooLarge(await send(path, body, {}, env));
  });

  it('JSON inválido dentro del límite sigue siendo 400 INVALID_REQUEST', async () => {
    const { env, calls } = spyDb();
    const response = await send(path, '{no-json', {}, env);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'La solicitud no es válida.' },
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(calls).toEqual([]);
  });

  it('sin cuerpo sigue siendo 400 INVALID_REQUEST', async () => {
    const { env } = spyDb();
    const response = await send(path, null, {}, env);
    expect(response.status).toBe(400);
  });

  it('la configuración se valida antes que el cuerpo (sin DB: 500 CONFIG_ERROR)', async () => {
    const response = await send(path, tooBig, {}, { ...AUTH_ENV });
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'CONFIG_ERROR',
    );
  });
});

describe('cuerpos válidos en el límite exacto', () => {
  it('/auth/google acepta exactamente el máximo y rechaza un byte más', async () => {
    const { env } = spyDb();
    const idToken = await fx.sign(fx.validClaims());
    const json = JSON.stringify({ idToken });
    const ok = await send('/auth/google', PAD(json, MAX_JSON_BODY_BYTES), {}, env);
    expect(ok.status).toBe(200);
    const over = await send('/auth/google', PAD(json, MAX_JSON_BODY_BYTES + 1), {}, env);
    await expectTooLarge(over);
  });

  it('/auth/google acepta un idToken de 8192 caracteres dentro del límite (validación falla en el token, no en el tamaño)', async () => {
    const { env } = spyDb();
    const body = JSON.stringify({ idToken: 'a'.repeat(8192) });
    const response = await send('/auth/google', body, {}, env);
    expect(response.status).toBe(401); // llegó a la verificación del token
  });

  it('/auth/refresh acepta exactamente el máximo, también como stream sin tamaño', async () => {
    const { env } = spyDb();
    const loginToken = await fx.sign(fx.validClaims());
    const session = (await (
      await send('/auth/google', JSON.stringify({ idToken: loginToken }), {}, env)
    ).json()) as {
      refreshToken: string;
    };
    const padded = PAD(JSON.stringify({ refreshToken: session.refreshToken }), MAX_JSON_BODY_BYTES);
    const bytes = new TextEncoder().encode(padded);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 5000));
        controller.enqueue(bytes.slice(5000));
        controller.close();
      },
    });
    const response = await send('/auth/refresh', stream, {}, env);
    expect(response.status).toBe(200);
  });

  it('/auth/logout acepta exactamente el máximo y responde 204', async () => {
    const { env } = spyDb();
    const body = PAD(JSON.stringify({ refreshToken: VALID_REFRESH }), MAX_JSON_BODY_BYTES);
    const response = await send('/auth/logout', body, {}, env);
    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('el rechazo por tamaño no crea usuarios ni sesiones', async () => {
    const { env } = spyDb();
    const idToken = await fx.sign(fx.validClaims());
    const body = PAD(JSON.stringify({ idToken }), MAX_JSON_BODY_BYTES + 1);
    await expectTooLarge(await send('/auth/google', body, {}, env));
    expect(await count(db, 'users')).toBe(0);
    expect(await count(db, 'refresh_tokens')).toBe(0);
  });
});

describe.each(ROUTES)('Content-Length no numérico o negativo en %s', (path) => {
  const small = '{no-json';
  const tooBig = 'x'.repeat(MAX_JSON_BODY_BYTES + 1);

  it.each(['abc', '1e3', '12abc', '-1', '', ' ', '0x10', '+5'])(
    'valor %j con cuerpo pequeño: se cuentan bytes reales (400, no bypass ni 413)',
    async (declared) => {
      const { env, calls } = spyDb();
      const response = await send(path, small, { 'content-length': declared }, env);
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        'INVALID_REQUEST',
      );
      expect(calls).toEqual([]);
    },
  );

  it.each(['abc', '1e3', '12abc', '-1', '', ' ', '0x10', '+5'])(
    'valor %j con cuerpo mayor al máximo: sigue siendo 413 (no es un bypass)',
    async (declared) => {
      const { env, calls } = spyDb();
      await expectTooLarge(await send(path, tooBig, { 'content-length': declared }, env));
      expect(calls).toEqual([]);
    },
  );

  it('valor no numérico con stream grande sin tamaño real: 413 y se cancela', async () => {
    const { env } = spyDb();
    const { stream, state } = chunkedStream(4096, 10_000);
    await expectTooLarge(await send(path, stream, { 'content-length': 'abc' }, env));
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(20);
  });
});

describe('idToken de 8193 caracteres en /auth/google', () => {
  it('400 INVALID_REQUEST y la verificación de Google no se ejecuta', async () => {
    // Resolutor de claves real de la fixture, envuelto solo para contar invocaciones.
    const getKey = vi.fn(fx.keys);
    const spyApp = createApp({ googleKeys: getKey as typeof fx.keys, now: () => NOW });
    const { env, calls } = spyDb();
    const response = await spyApp.request(
      '/auth/google',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: 'a'.repeat(8193) }),
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'La solicitud no es válida.' },
    });
    expect(getKey).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(await count(db, 'users')).toBe(0);
  });

  it('control: con 8192 caracteres sí se invoca la verificación (el espía detecta la llamada)', async () => {
    const idToken = await fx.sign(fx.validClaims());
    const getKey = vi.fn(fx.keys);
    const spyApp = createApp({ googleKeys: getKey as typeof fx.keys, now: () => NOW });
    const { env } = spyDb();
    const response = await spyApp.request(
      '/auth/google',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(getKey).toHaveBeenCalled();
  });
});
