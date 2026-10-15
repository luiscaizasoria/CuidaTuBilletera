import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TTL_MS,
  refreshExpiry,
} from './refresh-token';

describe('refresh token', () => {
  it('genera 43 caracteres base64url sin padding y únicos', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('usa los bytes aleatorios inyectados', () => {
    expect(generateRefreshToken(() => new Uint8Array(32))).toBe('A'.repeat(43));
  });

  it('el hash es SHA-256 hex de 64 caracteres y determinista', async () => {
    const hash = await hashRefreshToken('abc');
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await hashRefreshToken('abc')).toBe(hash);
  });

  it('expira exactamente 7 días después', () => {
    const now = new Date('2026-10-13T12:00:00.000Z');
    expect(REFRESH_TTL_MS).toBe(7 * 86_400_000);
    expect(refreshExpiry(now).toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });
});
