import type { JWTPayload } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { USER_DATA_TABLES } from '../src/db/profile-repository';
import { reauthDiagnosticsHandler } from '../src/lib/reauth-diagnostics';
import { issueAccessToken } from '../src/services/access-token-service';
import { count, DB_HOOK_TIMEOUT_MS, freshDb, insertAccount, insertUser } from './d1-helpers';
import { AUTH_ENV, createGoogleFixture, JWT_SECRET, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let db: D1Database;
let userToken: string;
let userId: string;

beforeAll(async () => {
  fx = await createGoogleFixture();
});

const nowSec = Math.floor(NOW.getTime() / 1000);
const SUB = 'google-sub-A';
const EMAIL = 'a@example.com';
const idClaims = (over: JWTPayload = {}): JWTPayload => ({
  ...fx.validClaims(),
  sub: SUB,
  email: EMAIL,
  ...over,
});

const DEV = { ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: '1' };

async function del(extraEnv: Record<string, string>, idToken: string) {
  const app = createApp({ googleKeys: fx.keys, now: () => NOW });
  return app.request(
    '/me',
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'ELIMINAR', idToken }),
    },
    { ...AUTH_ENV, DB: db, ...extraEnv },
  );
}

async function serialize(res: Response) {
  const headers = [...res.headers.entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ status: res.status, headers, body: await res.text() });
}

let spies: ReturnType<typeof vi.spyOn>[];
const calls = () => spies.flatMap((s) => s.mock.calls);
const warnCalls = () => spies[2]!.mock.calls;

beforeEach(async () => {
  db = await freshDb();
  userId = await insertUser(db, { google_sub: SUB, email: EMAIL });
  await insertAccount(db, userId, { nombre: 'Principal' });
  userToken = await issueAccessToken({ id: userId, email: EMAIL }, JWT_SECRET, NOW);
  spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

const REJECTIONS: [string, () => Promise<string>][] = [
  ['token antiguo', async () => fx.sign(idClaims({ iat: nowSec - 400 }))],
  ['sub distinto', async () => fx.sign(idClaims({ sub: 'otro-sub' }))],
  ['token inválido', async () => fx.signWithOtherKey(idClaims())],
  ['email no verificado', async () => fx.sign(idClaims({ email_verified: false }))],
  ['azp desconocido', async () => fx.sign(idClaims({ azp: 'ajeno' }))],
];

describe('reauthDiagnosticsHandler', () => {
  it.each([
    [{}],
    [{ ENVIRONMENT: 'prod', REAUTH_DIAGNOSTICS: '1' }],
    [{ REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: 'dev' }],
    [{ ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: 'true' }],
    [{ ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: '0' }],
    [{ ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: ' 1' }],
    [{ ENVIRONMENT: 'DEV', REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: ' dev', REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: 'dev ', REAUTH_DIAGNOSTICS: '1' }],
  ])('sin handler para %j', (env) => {
    expect(reauthDiagnosticsHandler(env)).toBeUndefined();
  });

  it('con dev y 1 devuelve handler', () => {
    expect(reauthDiagnosticsHandler(DEV)).toBeTypeOf('function');
  });

  it('descarta valores fuera del conjunto y edades no enteras', () => {
    const handler = reauthDiagnosticsHandler(DEV)!;
    handler('NO_EXISTE' as never);
    expect(warnCalls()).toHaveLength(0);
    handler('TOKEN_TOO_OLD', { tokenAgeSeconds: 1.5 });
    expect(JSON.parse(warnCalls()[0]![0] as string)).toEqual({
      event: 'reauth_rejected',
      reason: 'TOKEN_TOO_OLD',
    });
  });
});

describe('DELETE /me: diagnóstico REAUTH_REQUIRED', () => {
  it('DEV sin diagnóstico: ningún console.*', async () => {
    for (const [, build] of REJECTIONS) await del({ ENVIRONMENT: 'dev' }, await build());
    expect(calls()).toHaveLength(0);
  });

  it('DEV con diagnóstico: un iat futuro fuera de margen registra una edad negativa', async () => {
    const res = await del(DEV, await fx.sign(idClaims({ iat: nowSec + 61 })));
    expect(res.status).toBe(401);
    expect(warnCalls()).toHaveLength(1);
    const line = JSON.parse(warnCalls()[0]![0] as string) as Record<string, unknown>;
    expect(line).toEqual({
      event: 'reauth_rejected',
      reason: 'TOKEN_TOO_OLD',
      tokenAgeSeconds: -61,
    });
  });

  it('DEV con diagnóstico: una línea por rechazo con las claves permitidas', async () => {
    const expected: [string, string, number | undefined][] = [
      ['token antiguo', 'TOKEN_TOO_OLD', 400],
      ['sub distinto', 'GOOGLE_SUB_MISMATCH', 60],
      ['token inválido', 'TOKEN_INVALID', undefined],
      ['email no verificado', 'EMAIL_NOT_VERIFIED', 60],
      ['azp desconocido', 'AZP_INVALID', 60],
    ];
    for (const [i, [name, build]] of REJECTIONS.entries()) {
      const before = calls().length;
      const res = await del(DEV, await build());
      expect(res.status).toBe(401);
      expect(calls().length - before, name).toBe(1);
      expect(warnCalls()).toHaveLength(i + 1);
      const line = JSON.parse(warnCalls()[i]![0] as string) as Record<string, unknown>;
      const [, reason, age] = expected[i]!;
      expect(line.reason).toBe(reason);
      expect(line.event).toBe('reauth_rejected');
      if (age === undefined) expect(Object.keys(line).sort()).toEqual(['event', 'reason']);
      else {
        expect(Object.keys(line).sort()).toEqual(['event', 'reason', 'tokenAgeSeconds']);
        expect(line.tokenAgeSeconds).toBe(age);
      }
      expect(warnCalls()[i]).toHaveLength(1);
    }
  });

  it.each([
    [{}],
    [{ ENVIRONMENT: 'prod', REAUTH_DIAGNOSTICS: '1' }],
    [{ REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: 'true' }],
    [{ ENVIRONMENT: 'DEV', REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: ' dev', REAUTH_DIAGNOSTICS: '1' }],
    [{ ENVIRONMENT: 'dev', REAUTH_DIAGNOSTICS: '0' }],
  ])('PROD o valores erróneos %j: cero registros', async (env) => {
    for (const [, build] of REJECTIONS) await del(env, await build());
    expect(calls()).toHaveLength(0);
  });

  it('respuestas públicas idénticas entre motivos y con/sin diagnóstico; no elimina datos', async () => {
    const tables = [...USER_DATA_TABLES];
    const snap = async () => Promise.all(tables.map((t) => count(db, t)));
    const before = await snap();
    const responses: string[] = [];
    for (const env of [{}, DEV]) {
      for (const [, build] of REJECTIONS)
        responses.push(await serialize(await del(env, await build())));
    }
    expect(new Set(responses).size).toBe(1);
    expect(await snap()).toEqual(before);
  });

  it('ningún log contiene token, payload, firma, sub, email ni id de usuario', async () => {
    for (const [, build] of REJECTIONS) {
      const token = await build();
      await del(DEV, token);
      const logged = JSON.stringify(calls());
      const [h, p, s] = token.split('.');
      for (const secret of [token, h, p, s, SUB, 'otro-sub', EMAIL, userId, userToken]) {
        if (secret) expect(logged).not.toContain(secret);
      }
    }
    expect(warnCalls()).toHaveLength(REJECTIONS.length);
  });

  it('console.warn que lanza no altera la respuesta', async () => {
    const token = await fx.sign(idClaims({ iat: nowSec - 400 }));
    const reference = await serialize(await del({}, token));
    spies[2]!.mockImplementation(() => {
      throw new Error('warn roto');
    });
    expect(await serialize(await del(DEV, token))).toBe(reference);
  });
});
