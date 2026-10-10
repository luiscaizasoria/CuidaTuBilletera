import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

describe('GET /health', () => {
  it('responde 200 con {"status":"ok"}', async () => {
    const response = await exports.default.fetch('http://example.com/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('ruta inexistente', () => {
  it('responde 404 con el formato de error NOT_FOUND', async () => {
    const response = await exports.default.fetch('http://example.com/no-existe');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });
});

describe('error no controlado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responde 500 con INTERNAL_ERROR sin exponer el error original', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Misma aplicación que usa el Worker (createApp), con una ruta que lanza
    // solo en esta prueba; así se verifica que onError está conectado de verdad.
    const app = createApp();
    app.get('/boom', () => {
      throw new Error('detalle-interno-secreto');
    });

    const response = await app.request('/boom');
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: expect.any(String) },
    });
    expect(text).not.toContain('detalle-interno-secreto');
  });
});
