import type { JWTPayload } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { USER_DATA_TABLES } from '../src/db/profile-repository';
import { issueAccessToken } from '../src/services/access-token-service';
import type { ReauthRejectionReason } from '../src/services/google-token-service';
import { count, DB_HOOK_TIMEOUT_MS, freshDb, insertAccount, insertUser } from './d1-helpers';
import { AUTH_ENV, createGoogleFixture, JWT_SECRET, NOW } from './helpers';

let fx: Awaited<ReturnType<typeof createGoogleFixture>>;
let db: D1Database;
let reasons: unknown[][];
let userToken: string;

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
const without = (claims: JWTPayload, key: string): JWTPayload => {
  const copy = { ...claims };
  delete copy[key];
  return copy;
};

const TABLES = [...USER_DATA_TABLES];
async function snapshot() {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = await count(db, t);
  return out;
}

function buildApp(onReauthRejected?: (reason: ReauthRejectionReason) => void) {
  return createApp({ googleKeys: fx.keys, now: () => NOW, onReauthRejected });
}

async function del(app: ReturnType<typeof createApp>, idToken: string) {
  return app.request(
    '/me',
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'ELIMINAR', idToken }),
    },
    { ...AUTH_ENV, DB: db },
  );
}

// Respuesta serializada (estado, cabeceras y cuerpo) para compararla entre motivos.
async function serialize(res: Response) {
  const headers = [...res.headers.entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ status: res.status, headers, body: await res.text() });
}

beforeEach(async () => {
  db = await freshDb();
  reasons = [];
  const id = await insertUser(db, { google_sub: SUB, email: EMAIL });
  await insertAccount(db, id, { nombre: 'Principal' });
  userToken = await issueAccessToken({ id, email: EMAIL }, JWT_SECRET, NOW);
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

const collect = (reason: ReauthRejectionReason) => void reasons.push([reason]);

const REJECTIONS: [string, () => Promise<string>, ReauthRejectionReason][] = [
  ['firma de otra clave', async () => fx.signWithOtherKey(idClaims()), 'TOKEN_INVALID'],
  ['sin firma', async () => fx.unsigned(idClaims()), 'TOKEN_INVALID'],
  ['HS256', async () => fx.signHs256(idClaims()), 'TOKEN_INVALID'],
  [
    'payload manipulado',
    async () => {
      const [h, , s] = (await fx.sign(idClaims())).split('.');
      const forged = Buffer.from(JSON.stringify(idClaims({ sub: 'otro' }))).toString('base64url');
      return `${h}.${forged}.${s}`;
    },
    'TOKEN_INVALID',
  ],
  ['aud erróneo', async () => fx.sign(idClaims({ aud: 'otro' })), 'TOKEN_INVALID'],
  ['iss erróneo', async () => fx.sign(idClaims({ iss: 'https://evil.example' })), 'TOKEN_INVALID'],
  ['exp vencido', async () => fx.sign(idClaims({ exp: nowSec - 3600 })), 'TOKEN_INVALID'],
  ['iat de hace 301 s', async () => fx.sign(idClaims({ iat: nowSec - 301 })), 'TOKEN_TOO_OLD'],
  ['iat futuro > 60 s', async () => fx.sign(idClaims({ iat: nowSec + 61 })), 'TOKEN_TOO_OLD'],
  [
    'sub de otro usuario',
    async () => fx.sign(idClaims({ sub: 'otro-sub' })),
    'GOOGLE_SUB_MISMATCH',
  ],
  [
    'email_verified false',
    async () => fx.sign(idClaims({ email_verified: false })),
    'EMAIL_NOT_VERIFIED',
  ],
  ['email ausente', async () => fx.sign(without(idClaims(), 'email')), 'EMAIL_NOT_VERIFIED'],
  ['azp desconocido', async () => fx.sign(idClaims({ azp: 'ajeno' })), 'AZP_INVALID'],
  // Combinaciones: se informa el primer fallo del orden real de verifyGoogleIdToken.
  [
    'sub distinto + iat viejo',
    async () => fx.sign(idClaims({ sub: 'otro-sub', iat: nowSec - 301 })),
    'TOKEN_TOO_OLD',
  ],
  [
    'firma inválida + sub distinto',
    async () => fx.signWithOtherKey(idClaims({ sub: 'otro-sub' })),
    'TOKEN_INVALID',
  ],
  [
    'email no verificado + azp ajeno (gana email)',
    async () => fx.sign(idClaims({ email_verified: false, azp: 'ajeno' })),
    'EMAIL_NOT_VERIFIED',
  ],
  [
    'iat viejo + email no verificado + azp ajeno (gana iat)',
    async () => fx.sign(idClaims({ iat: nowSec - 301, email_verified: false, azp: 'ajeno' })),
    'TOKEN_TOO_OLD',
  ],
];

describe('DELETE /me: clasificación interna de REAUTH_REQUIRED', () => {
  it('token reciente válido: 204 y el callback no se invoca', async () => {
    const res = await del(buildApp(collect), await fx.sign(idClaims()));
    expect(res.status).toBe(204);
    expect(reasons).toEqual([]);
  });

  it.each(REJECTIONS)('%s', async (_name, build, expected) => {
    const before = await snapshot();
    const res = await del(buildApp(collect), await build());
    expect(res.status).toBe(401);
    expect(reasons).toEqual([[expected]]);
    expect(await snapshot()).toEqual(before);
  });

  it('todos los rechazos son indistinguibles y coinciden con el cuerpo REAUTH', async () => {
    const responses: string[] = [];
    for (const [, build] of REJECTIONS) {
      responses.push(await serialize(await del(buildApp(collect), await build())));
    }
    expect(new Set(responses).size).toBe(1);
    const parsed = JSON.parse(responses[0]!) as {
      status: number;
      headers: [string, string][];
      body: string;
    };
    expect(parsed.status).toBe(401);
    expect(JSON.parse(parsed.body)).toEqual({
      error: {
        code: 'REAUTH_REQUIRED',
        message:
          'No se pudo confirmar tu identidad. Usa la cuenta de Google con la que iniciaste sesión.',
      },
    });
    expect(Object.fromEntries(parsed.headers)['cache-control']).toBe('no-store');
  });

  it('la respuesta es idéntica con y sin callback', async () => {
    const token = await fx.sign(idClaims({ sub: 'otro-sub' }));
    const withCb = await serialize(await del(buildApp(collect), token));
    const without = await serialize(await del(buildApp(), token));
    expect(withCb).toBe(without);
  });

  it('el callback recibe solo el motivo (un string del conjunto)', async () => {
    const calls: unknown[][] = [];
    const app = createApp({
      googleKeys: fx.keys,
      now: () => NOW,
      onReauthRejected: (...args: unknown[]) => void calls.push(args),
    });
    await del(app, await fx.sign(idClaims({ sub: 'otro-sub' })));
    await del(app, await fx.signWithOtherKey(idClaims()));
    const allowed = [
      'TOKEN_INVALID',
      'TOKEN_TOO_OLD',
      'GOOGLE_SUB_MISMATCH',
      'EMAIL_NOT_VERIFIED',
      'AZP_INVALID',
      'OTRAS_CONDICIONES',
    ];
    expect(calls).toHaveLength(2);
    for (const args of calls) {
      expect(args).toHaveLength(1);
      expect(allowed).toContain(args[0]);
    }
  });

  it('un callback que lanza no altera la respuesta ni los datos', async () => {
    const token = await fx.sign(idClaims({ iat: nowSec - 301 }));
    const before = await snapshot();
    const reference = await serialize(await del(buildApp(), token));
    const throwing = buildApp(() => {
      throw new Error('fallo del callback');
    });
    expect(await serialize(await del(throwing, token))).toBe(reference);
    const mismatch = await fx.sign(idClaims({ sub: 'otro-sub' }));
    expect((await del(throwing, mismatch)).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it('ningún console.* contiene el token, su payload, el sub ni el email', async () => {
    const spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    for (const [, build] of REJECTIONS) {
      const token = await build();
      await del(buildApp(collect), token);
      const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      const payloadPart = token.split('.')[1];
      for (const secret of [token, payloadPart, SUB, EMAIL, 'otro-sub']) {
        if (secret) expect(logged).not.toContain(secret);
      }
    }
  });
});
