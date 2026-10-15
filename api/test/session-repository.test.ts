import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionFamily,
  EVICT_SESSIONS_SQL,
  FIND_TOKEN_BY_HASH_SQL,
  findRefreshTokenByHash,
  MAX_ACTIVE_SESSIONS,
  REVOKE_FAMILY_SQL,
  revokeFamilyForLogout,
  revokeFamilyForReuse,
  ROTATE_CONFIRM_SQL,
  ROTATE_INSERT_SQL,
  ROTATE_REVOKE_SQL,
  rotateRefreshToken,
} from '../src/db/session-repository';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertToken,
  insertUser,
  iso,
  newSuccessor,
  NOW,
  plusDays,
  plusMs,
  readInvariants,
  rowOf,
  sha256Hex,
  uuid,
} from './d1-helpers';

let db: D1Database;
let userId: string;
beforeEach(async () => {
  db = await freshDb();
  userId = await insertUser(db);
}, DB_HOOK_TIMEOUT_MS);

async function login(user = userId, now = NOW, tokenId = uuid()) {
  const familyId = uuid();
  const tokenHash = await sha256Hex(`rt_${uuid()}`);
  const result = await createSessionFamily(db, {
    userId: user,
    familyId,
    tokenId,
    tokenHash,
    now,
    expiresAt: plusDays(now, 7),
  });
  return { result, familyId, tokenId, tokenHash };
}

const activeOf = (user = userId, now = NOW) =>
  db
    .prepare(
      `SELECT id, family_id FROM refresh_tokens
        WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2 ORDER BY created_at, id`,
    )
    .bind(user, iso(now))
    .all<{ id: string; family_id: string }>()
    .then((r) => r.results);

describe('createSessionFamily', () => {
  it.each([1, 4, 5])('con %i login(s) no expulsa a nadie', async (n) => {
    for (let i = 0; i < n; i += 1) {
      const { result } = await login(userId, plusMs(NOW, i * 1000));
      expect(result).toEqual({ status: 'created', evictedCount: 0 });
    }
    expect(await activeOf(userId, plusMs(NOW, 10_000))).toHaveLength(n);
  });

  it.each([6, 8, 12])(
    'tras %i logins secuenciales quedan 5 vigentes: los más recientes',
    async (n) => {
      const created: string[] = [];
      for (let i = 0; i < n; i += 1) {
        const { tokenId } = await login(userId, plusMs(NOW, i * 1000));
        created.push(tokenId);
      }
      const active = await activeOf(userId, plusMs(NOW, n * 1000));
      expect(active.map((t) => t.id)).toEqual(created.slice(n - MAX_ACTIVE_SESSIONS));
      expect(await count(db, 'refresh_tokens', "revoked_reason = 'evicted'")).toBe(n - 5);
      expect(await count(db, 'refresh_tokens')).toBe(n);
      expect(await readInvariants(db)).toMatchObject({ familiesWithManyActive: 0 });
    },
  );

  it('el sexto login expulsa solo la más antigua y marca evicted', async () => {
    const first = await login(userId, NOW);
    for (let i = 1; i < 5; i += 1) await login(userId, plusMs(NOW, i * 1000));
    const { result } = await login(userId, plusMs(NOW, 5000));
    expect(result.evictedCount).toBe(1);
    expect(await rowOf(db, 'refresh_tokens', first.tokenId)).toMatchObject({
      revoked_reason: 'evicted',
      revoked_at: iso(plusMs(NOW, 5000)),
      replaced_by: null,
    });
  });

  it('con created_at iguales el desempate es por id ascendente', async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
    // Inserción en orden mezclado: el orden de llegada no debe influir.
    for (const id of [ids[3], ids[0], ids[6], ids[1], ids[4], ids[2], ids[7], ids[5]]) {
      await login(userId, NOW, id as string);
    }
    const active = await activeOf(userId, NOW);
    // Orden exacto (activeOf ordena por created_at, id): quedan los ids 4 a 8.
    expect(active.map((t) => t.id)).toEqual([ids[3], ids[4], ids[5], ids[6], ids[7]]);
    const evicted = await db
      .prepare("SELECT id FROM refresh_tokens WHERE revoked_reason = 'evicted' ORDER BY id")
      .all<{ id: string }>();
    // Orden de llegada 4,1,7,2,5,3,8,6: se expulsó 1, luego 2 y luego 3, siempre el menor vigente.
    expect(evicted.results.map((row) => row.id)).toEqual([ids[0], ids[1], ids[2]]);
  });

  it.each([6, 8, 20])('%i logins concurrentes dejan exactamente 5 vigentes', async (n) => {
    await Promise.all(Array.from({ length: n }, () => login()));
    expect(await activeOf()).toHaveLength(5);
    expect(await count(db, 'refresh_tokens')).toBe(n);
    expect(await count(db, 'refresh_tokens', "revoked_reason = 'evicted'")).toBe(n - 5);
    expect(await readInvariants(db)).toMatchObject({ familiesWithManyActive: 0 });
  });

  it('concurrentes sobre 5 existentes: sigue habiendo 5', async () => {
    for (let i = 0; i < 5; i += 1) await login(userId, plusMs(NOW, i * 1000));
    await Promise.all(Array.from({ length: 8 }, () => login(userId, plusMs(NOW, 10_000))));
    expect(await activeOf(userId, plusMs(NOW, 10_000))).toHaveLength(5);
  });

  it('los activos expirados no cuentan, no se expulsan y permanecen inertes', async () => {
    const expired = await Promise.all(
      Array.from({ length: 3 }, () =>
        insertToken(db, userId, { expires_at: iso(plusMs(NOW, 1000)) }),
      ),
    );
    const later = plusMs(NOW, 60_000);
    for (let i = 0; i < 5; i += 1) {
      const { result } = await login(userId, plusMs(later, i));
      expect(result.evictedCount).toBe(0);
    }
    for (const token of expired) {
      expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
        revoked_at: null,
        revoked_reason: null,
        updated_at: iso(NOW),
      });
    }
    expect((await login(userId, plusMs(later, 10))).result.evictedCount).toBe(1);
    expect(await activeOf(userId, plusMs(later, 10))).toHaveLength(5);
  });

  it('los revocados no cuentan para el límite', async () => {
    for (let i = 0; i < 4; i += 1) {
      await insertToken(db, userId, {
        revoked_at: iso(plusMs(NOW, 1)),
        revoked_reason: 'logout',
      });
    }
    for (let i = 0; i < 5; i += 1) {
      expect((await login(userId, plusMs(NOW, 1000 + i))).result.evictedCount).toBe(0);
    }
  });

  it('el límite de un usuario no afecta a otro', async () => {
    const other = await insertUser(db);
    for (let i = 0; i < 3; i += 1) await login(other, plusMs(NOW, i));
    for (let i = 0; i < 8; i += 1) await login(userId, plusMs(NOW, 1000 + i));
    expect(await activeOf(userId, plusMs(NOW, 5000))).toHaveLength(5);
    expect(await activeOf(other, plusMs(NOW, 5000))).toHaveLength(3);
    expect(
      await count(db, 'refresh_tokens', `user_id = '${other}' AND revoked_at IS NOT NULL`),
    ).toBe(0);
  });

  it('si el INSERT falla, la expulsión se revierte', async () => {
    for (let i = 0; i < 5; i += 1) await login(userId, plusMs(NOW, i * 1000));
    const now = plusMs(NOW, 10_000);
    await expect(
      createSessionFamily(db, {
        userId,
        familyId: uuid(),
        tokenId: uuid(),
        tokenHash: await sha256Hex('x'),
        now,
        expiresAt: now,
      }),
    ).rejects.toThrow(/CHECK constraint failed/);
    expect(await activeOf(userId, now)).toHaveLength(5);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NOT NULL')).toBe(0);
  });
});

describe('findRefreshTokenByHash', () => {
  const later = plusMs(NOW, 60_000);

  it('active', async () => {
    const token = await insertToken(db, userId);
    expect(await findRefreshTokenByHash(db, token.hash, later)).toEqual({
      status: 'active',
      id: token.id,
      user_id: userId,
      family_id: token.familyId,
      expires_at: iso(plusDays(NOW, 7)),
    });
  });

  it('expired, incluido el instante exacto de vencimiento', async () => {
    const token = await insertToken(db, userId, { expires_at: iso(later) });
    expect((await findRefreshTokenByHash(db, token.hash, plusMs(later, -1))).status).toBe('active');
    expect((await findRefreshTokenByHash(db, token.hash, later)).status).toBe('expired');
  });

  it('rotated con replaced_by y revoked_at', async () => {
    const old = await insertToken(db, userId);
    const successor = await newSuccessor();
    await rotateRefreshToken(db, {
      oldHash: old.hash,
      now: later,
      expiresAt: plusDays(later, 7),
      ...successor,
    });
    expect(await findRefreshTokenByHash(db, old.hash, plusMs(later, 5000))).toMatchObject({
      status: 'rotated',
      id: old.id,
      user_id: userId,
      family_id: old.familyId,
      replaced_by: successor.newId,
      revoked_at: iso(later),
    });
    expect((await findRefreshTokenByHash(db, successor.newHash, later)).status).toBe('active');
  });

  describe('family_live del token rotado', () => {
    async function rotate(old: { hash: string }, at: Date, ttlDays = 7) {
      const successor = await newSuccessor();
      await rotateRefreshToken(db, {
        oldHash: old.hash,
        now: at,
        expiresAt: plusDays(at, ttlDays),
        ...successor,
      });
      return successor;
    }
    const liveOf = async (hash: string, now: Date) => {
      const found = await findRefreshTokenByHash(db, hash, now);
      if (found.status !== 'rotated') throw new Error(`esperaba rotated, fue ${found.status}`);
      return found.family_live;
    };

    it('true tras una rotación', async () => {
      const old = await insertToken(db, userId);
      await rotate(old, later);
      expect(await liveOf(old.hash, plusMs(later, 1000))).toBe(true);
    });

    it('true con una cadena T1 -> T2 -> T3 al consultar T1', async () => {
      const t1 = await insertToken(db, userId);
      const t2 = await rotate(t1, later);
      await rotate({ hash: t2.newHash }, plusMs(later, 1000));
      expect(await liveOf(t1.hash, plusMs(later, 2000))).toBe(true);
    });

    it('false tras revokeFamilyForLogout', async () => {
      const old = await insertToken(db, userId);
      await rotate(old, later);
      await revokeFamilyForLogout(db, {
        userId,
        familyId: old.familyId,
        now: plusMs(later, 1000),
      });
      expect(await liveOf(old.hash, plusMs(later, 2000))).toBe(false);
    });

    it('false tras revokeFamilyForReuse', async () => {
      const old = await insertToken(db, userId);
      await rotate(old, later);
      await revokeFamilyForReuse(db, { userId, familyId: old.familyId, now: plusMs(later, 1000) });
      expect(await liveOf(old.hash, plusMs(later, 2000))).toBe(false);
    });

    it('false tras la expulsión del sucesor por sesiones nuevas', async () => {
      const old = await insertToken(db, userId);
      await rotate(old, later);
      for (let i = 1; i <= 5; i += 1) await login(userId, plusMs(later, 1000 * i));
      expect(await liveOf(old.hash, plusMs(later, 6000))).toBe(false);
    });

    it('false con el sucesor vencido (now >= expires_at) y true un instante antes', async () => {
      const old = await insertToken(db, userId);
      await rotate(old, later, 7);
      const expiry = plusDays(later, 7);
      expect(await liveOf(old.hash, plusMs(expiry, -1))).toBe(true);
      expect(await liveOf(old.hash, expiry)).toBe(false);
    });

    it('no existe para tokens que no son rotated', async () => {
      const token = await insertToken(db, userId);
      const found = await findRefreshTokenByHash(db, token.hash, later);
      expect(found).not.toHaveProperty('family_live');
    });
  });

  it.each(['logout', 'evicted', 'reuse'] as const)('revoked por %s', async (reason) => {
    const token = await insertToken(db, userId, {
      revoked_at: iso(plusMs(NOW, 1000)),
      revoked_reason: reason,
    });
    expect(await findRefreshTokenByHash(db, token.hash, later)).toMatchObject({
      status: 'revoked',
      revoked_reason: reason,
      revoked_at: iso(plusMs(NOW, 1000)),
      user_id: userId,
    });
  });

  it('not_found y el resultado nunca incluye el hash', async () => {
    expect(await findRefreshTokenByHash(db, await sha256Hex('nada'), later)).toEqual({
      status: 'not_found',
    });
    const token = await insertToken(db, userId);
    const found = await findRefreshTokenByHash(db, token.hash, later);
    expect(JSON.stringify(found)).not.toContain(token.hash);
  });
});

describe('revocación de familia', () => {
  const later = plusMs(NOW, 60_000);

  it.each([
    ['logout', revokeFamilyForLogout],
    ['reuse', revokeFamilyForReuse],
  ] as const)(
    '%s revoca el token activo con su motivo, de forma idempotente',
    async (reason, fn) => {
      const token = await insertToken(db, userId);
      expect(await fn(db, { userId, familyId: token.familyId, now: later })).toEqual({
        status: 'revoked',
        revokedCount: 1,
      });
      expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
        revoked_at: iso(later),
        revoked_reason: reason,
        updated_at: iso(later),
      });
      expect(await fn(db, { userId, familyId: token.familyId, now: plusMs(later, 1000) })).toEqual({
        status: 'revoked',
        revokedCount: 0,
      });
      expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({ revoked_at: iso(later) });
    },
  );

  it('conserva el motivo original de los tokens ya revocados y solo toca el activo', async () => {
    const old = await insertToken(db, userId);
    const successor = await newSuccessor();
    await rotateRefreshToken(db, {
      oldHash: old.hash,
      now: NOW,
      expiresAt: plusDays(NOW, 7),
      ...successor,
    });
    const result = await revokeFamilyForReuse(db, { userId, familyId: old.familyId, now: later });
    expect(result.revokedCount).toBe(1);
    expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
      revoked_reason: 'rotated',
      replaced_by: successor.newId,
    });
    expect(await rowOf(db, 'refresh_tokens', successor.newId)).toMatchObject({
      revoked_reason: 'reuse',
    });
  });

  it('una familia ya revocada por logout conserva logout', async () => {
    const token = await insertToken(db, userId, {
      revoked_at: iso(plusMs(NOW, 1)),
      revoked_reason: 'logout',
    });
    expect(
      (await revokeFamilyForReuse(db, { userId, familyId: token.familyId, now: later }))
        .revokedCount,
    ).toBe(0);
    expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({ revoked_reason: 'logout' });
  });

  it('con user_id ajeno no revoca nada; otras familias del usuario quedan intactas', async () => {
    const other = await insertUser(db);
    const mine = await insertToken(db, userId);
    const sibling = await insertToken(db, userId);
    expect(
      await revokeFamilyForLogout(db, { userId: other, familyId: mine.familyId, now: later }),
    ).toEqual({
      status: 'revoked',
      revokedCount: 0,
    });
    expect(await rowOf(db, 'refresh_tokens', mine.id)).toMatchObject({ revoked_at: null });
    await revokeFamilyForLogout(db, { userId, familyId: mine.familyId, now: later });
    expect(await rowOf(db, 'refresh_tokens', sibling.id)).toMatchObject({ revoked_at: null });
  });
});

describe('plan de consulta (sin escaneo completo de refresh_tokens)', () => {
  async function plan(sql: string, ...params: unknown[]): Promise<string> {
    const { results } = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...params)
      .all<{ detail: string }>();
    return results.map((row) => row.detail).join('\n');
  }

  // Datos representativos: 150 usuarios x 4 tokens (activo, activo vencido, revocado por logout,
  // rotado con su sucesor activo en la misma familia) = 750 filas con familias, hashes y
  // estados variados. Sin ANALYZE: es lo que verá la base real al empezar.
  let sample: { userId: string; familyId: string; hash: string; id: string };
  beforeEach(async () => {
    const stamp = iso(NOW);
    const statements: D1PreparedStatement[] = [];
    const insertUserSql = db.prepare(
      'INSERT INTO users (id, google_sub, email, nombre, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)',
    );
    const insertTokenSql = db.prepare(
      `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, created_at, updated_at,
         revoked_at, revoked_reason, replaced_by)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8, ?9)`,
    );
    const future = iso(plusDays(NOW, 7));
    for (let u = 0; u < 150; u += 1) {
      const user = uuid();
      statements.push(
        insertUserSql.bind(user, `sub-${u}-${uuid()}`, `u${u}@example.com`, `U${u}`, stamp),
      );
      const hashes = await Promise.all(Array.from({ length: 5 }, () => sha256Hex(`rt_${uuid()}`)));
      const [activeId, expiredId, loggedOutId, rotatedId, successorId] = [
        uuid(),
        uuid(),
        uuid(),
        uuid(),
        uuid(),
      ];
      const rotatedFamily = uuid();
      const rows: Array<
        [string, string, string, string, string | null, string | null, string | null]
      > = [
        [activeId, uuid(), hashes[0] as string, future, null, null, null],
        [expiredId, uuid(), hashes[1] as string, iso(plusMs(NOW, 1000)), null, null, null],
        [loggedOutId, uuid(), hashes[2] as string, future, stamp, 'logout', null],
        [rotatedId, rotatedFamily, hashes[3] as string, future, stamp, 'rotated', successorId],
        [successorId, rotatedFamily, hashes[4] as string, future, null, null, null],
      ];
      // El sucesor debe existir antes de que el rotado lo referencie solo al confirmar (FK diferida).
      for (const [id, family, hash, expires, revokedAt, reason, replacedBy] of rows) {
        statements.push(
          insertTokenSql.bind(
            id,
            user,
            family,
            hash,
            expires,
            stamp,
            revokedAt,
            reason,
            replacedBy,
          ),
        );
      }
      if (u === 75)
        sample = {
          userId: user,
          familyId: rotatedFamily,
          hash: hashes[4] as string,
          id: successorId,
        };
    }
    await db.batch(statements);
  });

  const cases: Array<[string, string, (s: typeof sample) => unknown[]]> = [
    ['búsqueda por hash', FIND_TOKEN_BY_HASH_SQL, (s) => [s.hash, iso(NOW)]],
    ['rotación: UPDATE', ROTATE_REVOKE_SQL, (s) => [iso(NOW), uuid(), s.hash]],
    [
      'rotación: INSERT...SELECT',
      ROTATE_INSERT_SQL,
      (s) => [uuid(), 'b'.repeat(64), iso(NOW), iso(NOW), s.hash],
    ],
    ['rotación: confirmación', ROTATE_CONFIRM_SQL, (s) => [s.id, s.hash, s.hash, iso(NOW)]],
    ['expulsión de vigentes', EVICT_SESSIONS_SQL, (s) => [s.userId, iso(NOW), 4]],
    ['revocación de familia', REVOKE_FAMILY_SQL, (s) => [iso(NOW), 'logout', s.userId, s.familyId]],
  ];

  it('búsqueda por hash: la subconsulta de family_live usa el índice de familia', async () => {
    const detail = await plan(FIND_TOKEN_BY_HASH_SQL, sample.hash, iso(NOW));
    expect(detail).toMatch(/SEARCH f USING (COVERING )?INDEX ux_refresh_tokens_family_active/);
  });

  it('la siembra tiene el volumen esperado', async () => {
    expect(await count(db, 'users')).toBe(151);
    expect(await count(db, 'refresh_tokens')).toBe(750);
  });

  it.each(cases)('%s usa índices', async (_name, sql, params) => {
    const detail = await plan(sql, ...params(sample));
    // El INSERT...SELECT sobre la misma tabla recorre una tabla efímera con el resultado del
    // SELECT (como mucho una fila), que SQLite rotula "SCAN refresh_tokens" tras el SEARCH por
    // índice de token_hash. Ese único SCAN es el límite aceptado; las demás consultas no deben
    // escanear.
    const lines = detail.split('\n');
    const scans = lines.filter((line) => /^SCAN /.test(line));
    expect(scans, detail).toHaveLength(sql === ROTATE_INSERT_SQL ? 1 : 0);
    expect(
      lines.some((line) => /^SEARCH .* USING (COVERING )?INDEX /.test(line)),
      detail,
    ).toBe(true);
    expect(detail).not.toMatch(/replaced_by/);
  });

  // El token anterior se localiza por el índice UNIQUE de token_hash (autoíndice del UNIQUE de
  // la tabla), nunca por escaneo completo.
  it.each([
    ['búsqueda por hash', FIND_TOKEN_BY_HASH_SQL, (s: typeof sample) => [s.hash, iso(NOW)]],
    ['rotación: UPDATE', ROTATE_REVOKE_SQL, (s: typeof sample) => [iso(NOW), uuid(), s.hash]],
    [
      'rotación: INSERT...SELECT (token anterior)',
      ROTATE_INSERT_SQL,
      (s: typeof sample) => [uuid(), 'b'.repeat(64), iso(NOW), iso(NOW), s.hash],
    ],
  ])('%s busca por el índice único de token_hash', async (_name, sql, params) => {
    const detail = await plan(sql, ...params(sample));
    expect(detail).toMatch(
      /SEARCH refresh_tokens USING INDEX sqlite_autoindex_refresh_tokens_2 \(token_hash=\?\)/,
    );
  });
});
