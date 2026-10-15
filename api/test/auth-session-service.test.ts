import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSessionFromGoogleLogin,
  logoutSession,
  REFRESH_GRACE_MS,
  refreshSession,
  type AuthSession,
  type AuthSessionDeps,
} from '../src/services/auth-session-service';
import { revokeFamilyForReuse } from '../src/db/session-repository';
import { verifyAccessToken } from '../src/services/access-token-service';
import { hashRefreshToken } from '../src/services/refresh-token';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  iso,
  NOW,
  plusDays,
  plusMs,
  readInvariants,
  uuid,
} from './d1-helpers';
import { JWT_SECRET } from './helpers';

let db: D1Database;
beforeEach(async () => {
  db = await freshDb();
}, DB_HOOK_TIMEOUT_MS);
afterEach(() => vi.restoreAllMocks());

const at = (now: Date): Partial<AuthSessionDeps> => ({ now: () => now });
const identity = (n: string) => ({ sub: `google-${n}`, email: `${n}@example.com`, name: `U ${n}` });

async function login(n = 'a', now = NOW): Promise<AuthSession> {
  const result = await createSessionFromGoogleLogin(db, JWT_SECRET, identity(n), at(now));
  return result.session;
}

async function rowByToken(token: string) {
  return db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?1')
    .bind(await hashRefreshToken(token))
    .first<Record<string, unknown>>();
}

function ok(result: Awaited<ReturnType<typeof refreshSession>>): AuthSession {
  if (result.status !== 'OK') throw new Error(`esperaba OK, fue ${result.status}`);
  return result.session;
}

describe('login', () => {
  it('crea usuario, familia y devuelve JWT v2 + refresh token', async () => {
    const s = await login();
    expect(s.tokenType).toBe('Bearer');
    expect(s.expiresIn).toBe(900);
    expect(s.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s.user).toMatchObject({ email: 'a@example.com', name: 'U a' });
    const verified = await verifyAccessToken(s.accessToken, JWT_SECRET, NOW);
    expect(verified).toMatchObject({ status: 'valid', user: { id: s.user.id } });
    expect(s.user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('persiste solo el hash, nunca el token en claro, con expiración de 7 días', async () => {
    const s = await login();
    const dump = JSON.stringify(
      (await db.prepare('SELECT * FROM refresh_tokens').all<Record<string, unknown>>()).results,
    );
    expect(dump).not.toContain(s.refreshToken);
    const row = await rowByToken(s.refreshToken);
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.expires_at).toBe(iso(plusDays(NOW, 7)));
  });

  it('un segundo login del mismo google_sub conserva el usuario y crea otra familia', async () => {
    const a = await login();
    const b = await login();
    expect(b.user.id).toBe(a.user.id);
    expect(await count(db, 'users')).toBe(1);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(2);
  });
});

describe('refresh', () => {
  it('rota: nuevo par, antiguo rotated y expiración deslizante', async () => {
    const s = await login();
    const later = plusMs(NOW, 3 * 86_400_000);
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(later)));
    expect(next.refreshToken).not.toBe(s.refreshToken);
    expect(next.user).toEqual(s.user);
    expect((await verifyAccessToken(next.accessToken, JWT_SECRET, later)).status).toBe('valid');
    const old = await rowByToken(s.refreshToken);
    expect(old).toMatchObject({ revoked_reason: 'rotated', revoked_at: iso(later) });
    const fresh = await rowByToken(next.refreshToken);
    expect(fresh?.expires_at).toBe(iso(plusDays(later, 7)));
    expect(fresh?.family_id).toBe(old?.family_id);
    expect(old?.replaced_by).toBe(fresh?.id);
  });

  it('concurrencia: un ganador y el resto REFRESH_CONFLICT', async () => {
    const s = await login();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 1000))),
      ),
    );
    expect(results.filter((r) => r.status === 'OK')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'REFRESH_CONFLICT')).toHaveLength(7);
    for (const r of results) {
      if (r.status === 'REFRESH_CONFLICT') expect(Object.keys(r)).toEqual(['status']);
    }
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(0);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(1);
    expect(await readInvariants(db)).toEqual({
      familiesWithManyActive: 0,
      rotatedWithoutSuccessor: 0,
      successorsOfOtherFamily: 0,
    });
  });

  it('límite de gracia: 29.999 ms conflicto; 30.000 y 30.001 ms reutilización', async () => {
    expect(REFRESH_GRACE_MS).toBe(30_000);
    for (const [delta, expected] of [
      [29_999, 'REFRESH_CONFLICT'],
      [30_000, 'INVALID_TOKEN'],
      [30_001, 'INVALID_TOKEN'],
    ] as const) {
      db = await freshDb();
      const s = await login();
      const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
      const result = await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, delta)));
      expect(result).toEqual({ status: expected });
      expect(Object.keys(result)).toEqual(['status']);
      const successor = await rowByToken(next.refreshToken);
      if (expected === 'REFRESH_CONFLICT') {
        expect(successor?.revoked_at).toBeNull();
      } else {
        expect(successor?.revoked_reason).toBe('reuse');
      }
    }
  });

  it('tras la reutilización el sucesor también queda inválido', async () => {
    const s = await login();
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    const later = plusMs(NOW, 60_000);
    expect(await refreshSession(db, JWT_SECRET, s.refreshToken, at(later))).toEqual({
      status: 'INVALID_TOKEN',
    });
    expect(await refreshSession(db, JWT_SECRET, next.refreshToken, at(later))).toEqual({
      status: 'INVALID_TOKEN',
    });
  });

  it('desconocido, expirado, logout y evicted => INVALID_TOKEN', async () => {
    expect(await refreshSession(db, JWT_SECRET, 'x'.repeat(43), at(NOW))).toEqual({
      status: 'INVALID_TOKEN',
    });
    const expired = await login();
    expect(
      await refreshSession(db, JWT_SECRET, expired.refreshToken, at(plusMs(NOW, 7 * 86_400_000))),
    ).toEqual({ status: 'INVALID_TOKEN' });

    const out = await login('b');
    await logoutSession(db, out.refreshToken, at(NOW));
    expect(await refreshSession(db, JWT_SECRET, out.refreshToken, at(NOW))).toEqual({
      status: 'INVALID_TOKEN',
    });

    const first = await login('c');
    for (let i = 0; i < 5; i++) await login('c', plusMs(NOW, 1000 * (i + 1)));
    expect((await rowByToken(first.refreshToken))?.revoked_reason).toBe('evicted');
    expect(
      await refreshSession(db, JWT_SECRET, first.refreshToken, at(plusMs(NOW, 10_000))),
    ).toEqual({ status: 'INVALID_TOKEN' });
  });

  it('refresh de A no afecta a B (estado verificado en BD)', async () => {
    const a = await login('a');
    const b = await login('b');
    const nextA = ok(await refreshSession(db, JWT_SECRET, a.refreshToken, at(NOW)));
    expect(await refreshSession(db, JWT_SECRET, a.refreshToken, at(plusMs(NOW, 60_000)))).toEqual({
      status: 'INVALID_TOKEN',
    });
    // A: familia revocada por reutilización; B: intacto.
    expect(await rowByToken(a.refreshToken)).toMatchObject({ revoked_reason: 'rotated' });
    expect(await rowByToken(nextA.refreshToken)).toMatchObject({ revoked_reason: 'reuse' });
    expect(await rowByToken(b.refreshToken)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
      replaced_by: null,
    });
    const nextB = ok(await refreshSession(db, JWT_SECRET, b.refreshToken, at(plusMs(NOW, 60_000))));
    expect(await rowByToken(b.refreshToken)).toMatchObject({ revoked_reason: 'rotated' });
    expect(await rowByToken(nextB.refreshToken)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
    });
    expect(await rowByToken(nextA.refreshToken)).toMatchObject({ revoked_reason: 'reuse' });
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(1);
  });
});

// Clasificación de un token rotado dentro de la ventana de gracia, según el estado vivo de la
// familia: A (hay token vigente) => REFRESH_CONFLICT; B (sin token vigente: logout, expulsión o
// reuse previos) => INVALID_TOKEN sin escrituras; C (fuera de gracia) => reutilización tardía.
describe('refresh de un token rotado: clasificación A/B/C', () => {
  const snapshot = async () =>
    (await db.prepare('SELECT * FROM refresh_tokens ORDER BY id').all<Record<string, unknown>>())
      .results;
  const bare = (r: object) => expect(Object.keys(r)).toEqual(['status']);
  const NO_VIOLATIONS = {
    familiesWithManyActive: 0,
    rotatedWithoutSuccessor: 0,
    successorsOfOtherFamily: 0,
  };

  it('B por logout del sucesor: INVALID_TOKEN, el viejo sigue rotated y no hay reuse', async () => {
    const s = await login();
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    await logoutSession(db, next.refreshToken, at(plusMs(NOW, 1000)));
    const before = await snapshot();
    const result = await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 2000)));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect((await rowByToken(s.refreshToken))?.revoked_reason).toBe('rotated');
    expect((await rowByToken(next.refreshToken))?.revoked_reason).toBe('logout');
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it('B por expulsión del sucesor (6.ª sesión): INVALID_TOKEN dentro de gracia', async () => {
    const s = await login('a');
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    for (let i = 1; i <= 5; i += 1) await login('a', plusMs(NOW, 1000 * i));
    expect((await rowByToken(next.refreshToken))?.revoked_reason).toBe('evicted');
    const before = await snapshot();
    const result = await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 10_000)));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it('B por reuse previo de la familia: INVALID_TOKEN sin nuevas filas reuse', async () => {
    const s = await login();
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    const userId = (await rowByToken(s.refreshToken))?.user_id as string;
    const familyId = (await rowByToken(s.refreshToken))?.family_id as string;
    await revokeFamilyForReuse(db, { userId, familyId, now: plusMs(NOW, 1000) });
    expect((await rowByToken(next.refreshToken))?.revoked_reason).toBe('reuse');
    const before = await snapshot();
    const result = await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 2000)));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(1);
    expect(await snapshot()).toEqual(before);
  });

  it('B con sucesor revocado en 29.999 ms, 30.000 y 30.001: INVALID_TOKEN', async () => {
    // 29.999 ms: B puro, sin escrituras. >= 30.000 ms: C; la revocación de familia no cambia
    // nada porque no queda ningún token activo.
    for (const delta of [29_999, 30_000, 30_001]) {
      db = await freshDb();
      const s = await login();
      const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
      await logoutSession(db, next.refreshToken, at(plusMs(NOW, 1000)));
      const before = await snapshot();
      const result = await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, delta)));
      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      bare(result);
      expect(await snapshot()).toEqual(before);
    }
  });

  it('A con cadena T1 -> T2 -> T3: repetir T1 o T2 da CONFLICT con T3 activo', async () => {
    const t1 = await login();
    const t2 = ok(await refreshSession(db, JWT_SECRET, t1.refreshToken, at(NOW)));
    const t3 = ok(await refreshSession(db, JWT_SECRET, t2.refreshToken, at(plusMs(NOW, 1000))));
    const before = await snapshot();
    for (const token of [t1.refreshToken, t2.refreshToken]) {
      const result = await refreshSession(db, JWT_SECRET, token, at(plusMs(NOW, 2000)));
      expect(result).toEqual({ status: 'REFRESH_CONFLICT' });
      bare(result);
    }
    expect(await rowByToken(t3.refreshToken)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
    });
    expect(await snapshot()).toEqual(before);
    expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
  });

  // LÍMITE: el D1 local (workerd/miniflare) serializa las operaciones, así que Promise.all no
  // garantiza todos los entrelazados posibles entre la búsqueda y la rotación. La prueba valida
  // los invariantes con el orden que produzca el motor; los entrelazados concretos se cubren con
  // las pruebas de not_rotated más abajo, que fuerzan el cambio entre búsqueda y rotación.
  it('carrera refresh vs logout del mismo token: sin familia viva ni filas reuse', async () => {
    const s = await login();
    const when = at(plusMs(NOW, 1000));
    const [refreshed, loggedOut] = await Promise.all([
      refreshSession(db, JWT_SECRET, s.refreshToken, when),
      logoutSession(db, s.refreshToken, when),
    ]);
    expect(loggedOut).toEqual({ status: 'OK' });
    expect(['OK', 'INVALID_TOKEN']).toContain(refreshed.status);
    if (refreshed.status !== 'OK') bare(refreshed);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(0);
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'reuse'")).toBe(0);
    expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    // Tras la carrera el token original no puede volver a refrescar.
    expect(await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 2000)))).toEqual({
      status: 'INVALID_TOKEN',
    });
  });

  // Envuelve db: antes de la rotación (único db.batch de refreshSession) ejecuta `beforeRotation`,
  // como si otra petición hubiera cambiado el token entre la clasificación y la rotación.
  function interceptRotation(beforeRotation: () => Promise<void>): D1Database {
    return new Proxy(db, {
      get(target, prop) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            await beforeRotation();
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  it('not_rotated: el token se revoca entre clasificación y rotación => INVALID_TOKEN', async () => {
    const s = await login();
    const row = await rowByToken(s.refreshToken);
    const wrapped = interceptRotation(async () => {
      await logoutSession(db, s.refreshToken, at(plusMs(NOW, 1000)));
    });
    const result = await refreshSession(wrapped, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 1000)));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect(await count(db, 'refresh_tokens')).toBe(1);
    expect(await rowByToken(s.refreshToken)).toMatchObject({
      id: row?.id,
      revoked_reason: 'logout',
      replaced_by: null,
    });
    expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
  });

  it('not_rotated: el token vence entre clasificación y rotación => INVALID_TOKEN', async () => {
    const s = await login();
    const later = plusMs(NOW, 1000);
    const wrapped = interceptRotation(async () => {
      await db
        .prepare('UPDATE refresh_tokens SET expires_at = ?1 WHERE token_hash = ?2')
        .bind(iso(later), await hashRefreshToken(s.refreshToken))
        .run();
    });
    const result = await refreshSession(wrapped, JWT_SECRET, s.refreshToken, at(later));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect(await count(db, 'refresh_tokens')).toBe(1);
    expect(await rowByToken(s.refreshToken)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
      replaced_by: null,
    });
  });

  it('usuario inexistente para un token activo => INVALID_TOKEN sin escrituras', async () => {
    const s = await login();
    const before = await snapshot();
    // Solo la lectura del usuario devuelve vacío; el resto de consultas es la real.
    const wrapped = new Proxy(db, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql: string) =>
            target.prepare(/FROM users/.test(sql) ? 'SELECT * FROM users WHERE 0 AND ?1' : sql);
        }
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const result = await refreshSession(wrapped, JWT_SECRET, s.refreshToken, at(NOW));
    expect(result).toEqual({ status: 'INVALID_TOKEN' });
    bare(result);
    expect(await snapshot()).toEqual(before);
  });
});

describe('logout', () => {
  it('revoca solo la familia indicada y es idempotente', async () => {
    const s1 = await login();
    const s2 = await login();
    expect(await logoutSession(db, s1.refreshToken, at(NOW))).toEqual({ status: 'OK' });
    expect(await logoutSession(db, s1.refreshToken, at(NOW))).toEqual({ status: 'OK' });
    expect((await rowByToken(s1.refreshToken))?.revoked_reason).toBe('logout');
    expect((await rowByToken(s2.refreshToken))?.revoked_at).toBeNull();
    ok(await refreshSession(db, JWT_SECRET, s2.refreshToken, at(NOW)));
  });

  it('con token rotado revoca el sucesor de la familia', async () => {
    const s = await login();
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    await logoutSession(db, s.refreshToken, at(plusMs(NOW, 1000)));
    expect((await rowByToken(next.refreshToken))?.revoked_reason).toBe('logout');
  });

  it('token desconocido devuelve OK sin cambios', async () => {
    await login();
    expect(await logoutSession(db, uuid(), at(NOW))).toEqual({ status: 'OK' });
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(1);
  });

  it('logout de A no afecta a B', async () => {
    const a = await login('a');
    const b = await login('b');
    await logoutSession(db, a.refreshToken, at(NOW));
    expect((await rowByToken(b.refreshToken))?.revoked_at).toBeNull();
  });
});

describe('sin credenciales en logs', () => {
  it('login, refresh y logout no registran tokens, hashes ni secreto', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const s = await login();
    const next = ok(await refreshSession(db, JWT_SECRET, s.refreshToken, at(NOW)));
    await refreshSession(db, JWT_SECRET, s.refreshToken, at(plusMs(NOW, 60_000)));
    await logoutSession(db, next.refreshToken, at(NOW));
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const secret of [
      JWT_SECRET,
      s.refreshToken,
      next.refreshToken,
      s.accessToken,
      await hashRefreshToken(s.refreshToken),
      await hashRefreshToken(next.refreshToken),
    ]) {
      expect(logged).not.toContain(secret);
    }
  });
});
