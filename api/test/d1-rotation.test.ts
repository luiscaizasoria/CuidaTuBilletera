import { beforeEach, describe, expect, it } from 'vitest';
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
  SESSION_DAYS,
  uuid,
  type TokenFixture,
} from './d1-helpers';
import { rotateRefreshToken, ROTATE_INSERT_SQL } from '../src/db/session-repository';

// Rotación real con env.DB.batch() sobre D1 local y el esquema de la migración 0001.
let db: D1Database;
let userId: string;
beforeEach(async () => {
  db = await freshDb();
  userId = await insertUser(db);
}, DB_HOOK_TIMEOUT_MS);

const later = plusMs(NOW, 15 * 60_000);

const rotate = (input: { oldHash: string; newId: string; newHash: string; now: Date }) =>
  rotateRefreshToken(db, { ...input, expiresAt: plusDays(input.now, SESSION_DAYS) });

async function attempt(oldToken: TokenFixture, now = later) {
  const successor = await newSuccessor();
  const result = await rotate({ oldHash: oldToken.hash, now, ...successor });
  return { ...successor, result };
}

const rotatedOf = (outcome: { result: { status: string } }) => outcome.result.status === 'rotated';

const NO_VIOLATIONS = {
  familiesWithManyActive: 0,
  rotatedWithoutSuccessor: 0,
  successorsOfOtherFamily: 0,
};

describe('rotación con db.batch()', () => {
  it('revoca el token con motivo rotated e inserta un único sucesor activo', async () => {
    const old = await insertToken(db, userId);
    const { newId, result } = await attempt(old);

    expect(result.status).toBe('rotated');
    expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
      revoked_at: iso(later),
      revoked_reason: 'rotated',
      replaced_by: newId,
      updated_at: iso(later),
    });
    expect(await rowOf(db, 'refresh_tokens', newId)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
      replaced_by: null,
      created_at: iso(later),
    });
    expect(await count(db, 'refresh_tokens', `family_id = '${old.familyId}'`)).toBe(2);
    expect(
      await count(db, 'refresh_tokens', `family_id = '${old.familyId}' AND revoked_at IS NULL`),
    ).toBe(1);
  });

  it('conserva user_id y family_id en el sucesor', async () => {
    const old = await insertToken(db, userId);
    const { result } = await attempt(old);
    expect(result).toEqual({
      status: 'rotated',
      successor: {
        id: expect.any(String),
        user_id: userId,
        family_id: old.familyId,
      },
    });
    expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
  });

  it('renueva la ventana de inactividad a 7 días desde la renovación', async () => {
    const old = await insertToken(db, userId);
    const { newId } = await attempt(old);
    const row = await rowOf(db, 'refresh_tokens', newId);
    expect(row?.expires_at).toBe(iso(plusDays(later, SESSION_DAYS)));
  });

  it('solo guarda hashes: ni el token viejo ni el nuevo aparecen en claro', async () => {
    const old = await insertToken(db, userId);
    const successorSecret = `rt_${uuid()}`;
    const result = await rotate({
      oldHash: old.hash,
      newId: uuid(),
      newHash: await sha256Hex(successorSecret),
      now: later,
    });
    expect(result.status).toBe('rotated');
    const { results } = await db.prepare('SELECT * FROM refresh_tokens').all();
    const dump = JSON.stringify(results);
    expect(dump).not.toContain(old.secret);
    expect(dump).not.toContain(successorSecret);
  });

  describe('cuando el token no se puede rotar', () => {
    it('un token ya rotado no cambia nada ni crea otro sucesor', async () => {
      const old = await insertToken(db, userId);
      await attempt(old);
      const before = await count(db, 'refresh_tokens');

      const { result, newId } = await attempt(old);
      expect(result.status).toBe('not_rotated');
      expect(await rowOf(db, 'refresh_tokens', newId)).toBeNull();
      expect(await count(db, 'refresh_tokens')).toBe(before);
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });

    it('un token vencido no rota, ni siquiera en el instante exacto de vencimiento', async () => {
      const old = await insertToken(db, userId, { expires_at: iso(plusMs(NOW, 60_000)) });
      expect((await attempt(old, plusMs(NOW, 59_999))).result.status).toBe('rotated');

      const expired = await insertToken(db, userId, { expires_at: iso(plusMs(NOW, 60_000)) });
      expect((await attempt(expired, plusMs(NOW, 60_000))).result.status).toBe('not_rotated');
      expect((await attempt(expired, plusMs(NOW, 60_001))).result.status).toBe('not_rotated');
      expect(await rowOf(db, 'refresh_tokens', expired.id)).toMatchObject({ revoked_at: null });
    });

    it.each(['logout', 'evicted', 'reuse'])('un token revocado por %s no rota', async (reason) => {
      const old = await insertToken(db, userId, {
        revoked_at: iso(plusMs(NOW, 1000)),
        revoked_reason: reason,
      });
      const { result } = await attempt(old);
      expect(result.status).toBe('not_rotated');
      expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
        revoked_reason: reason,
        replaced_by: null,
      });
    });

    it('un hash desconocido no escribe nada', async () => {
      await insertToken(db, userId);
      const before = await count(db, 'refresh_tokens');
      const successor = await newSuccessor();
      const result = await rotate({
        oldHash: await sha256Hex('rt_inexistente'),
        now: later,
        ...successor,
      });
      expect(result.status).toBe('not_rotated');
      expect(await count(db, 'refresh_tokens')).toBe(before);
    });
  });

  describe('reversión de todo el batch', () => {
    it('si el INSERT del sucesor falla, el UPDATE también se revierte', async () => {
      const old = await insertToken(db, userId);
      const other = await insertToken(db, userId);
      const before = await count(db, 'refresh_tokens');

      // El hash del sucesor ya existe en otro token: el INSERT viola UNIQUE(token_hash).
      await expect(
        rotate({ oldHash: old.hash, newId: uuid(), newHash: other.hash, now: later }),
      ).rejects.toThrow(/UNIQUE constraint failed/);

      expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
        revoked_at: null,
        revoked_reason: null,
        replaced_by: null,
        updated_at: iso(NOW),
      });
      expect(await count(db, 'refresh_tokens')).toBe(before);
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });

    it('tras la reversión, el mismo token todavía puede rotar con éxito', async () => {
      const old = await insertToken(db, userId);
      const other = await insertToken(db, userId);
      await expect(
        rotate({ oldHash: old.hash, newId: uuid(), newHash: other.hash, now: later }),
      ).rejects.toThrow();

      expect((await attempt(old)).result.status).toBe('rotated');
    });

    it('si el INSERT del sucesor viola un CHECK, el UPDATE tampoco se conserva', async () => {
      const old = await insertToken(db, userId);
      const successor = await newSuccessor();

      // expires_at no posterior a created_at: incumple el CHECK de la tabla.
      await expect(
        rotateRefreshToken(db, {
          oldHash: old.hash,
          now: later,
          expiresAt: later,
          ...successor,
        }),
      ).rejects.toThrow(/CHECK constraint failed/);

      expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
        revoked_at: null,
        revoked_reason: null,
        replaced_by: null,
      });
      expect(await rowOf(db, 'refresh_tokens', successor.newId)).toBeNull();
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });
  });

  describe('confirmación del sucesor', () => {
    // Ejercita la función real rotateRefreshToken. Solo se neutraliza el INSERT del sucesor
    // (se sustituye por una consulta vacía) y se pasa como newId/newHash un token que ya existe:
    // así el UPDATE real deja replaced_by apuntando a él y la confirmación real decide si
    // cuenta como éxito. No se duplica la lógica de rotación.
    function withoutSuccessorInsert(real: D1Database): D1Database {
      return new Proxy(real, {
        get(target, prop) {
          if (prop === 'prepare') {
            return (sql: string) =>
              target.prepare(
                sql === ROTATE_INSERT_SQL
                  ? 'SELECT 1 WHERE 0 AND ?1 AND ?2 AND ?3 AND ?4 AND ?5'
                  : sql,
              );
          }
          const value = Reflect.get(target, prop) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }

    // El UPDATE real debe haber marcado replaced_by hacia el token existente: así se demuestra
    // que el rechazo viene de la confirmación y no de que el cerrojo no actuó.
    async function rotateTowards(old: TokenFixture, existing: TokenFixture) {
      const result = await rotateRefreshToken(withoutSuccessorInsert(db), {
        oldHash: old.hash,
        newId: existing.id,
        newHash: existing.hash,
        now: later,
        expiresAt: plusDays(later, SESSION_DAYS),
      });
      expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
        revoked_reason: 'rotated',
        replaced_by: existing.id,
      });
      return result;
    }

    it('el éxito real devuelve el sucesor confirmado (control)', async () => {
      const old = await insertToken(db, userId);
      const { result } = await attempt(old);
      expect(result.status).toBe('rotated');
    });

    it('replaced_by hacia un token de otra familia y usuario no cuenta como éxito', async () => {
      const old = await insertToken(db, userId);
      const otherUser = await insertUser(db);
      const foreign = await insertToken(db, otherUser);
      expect(await rotateTowards(old, foreign)).toEqual({ status: 'not_rotated' });
    });

    it('replaced_by hacia un token de otra familia del mismo usuario no cuenta como éxito', async () => {
      const old = await insertToken(db, userId);
      const sameUserOtherFamily = await insertToken(db, userId);
      expect(await rotateTowards(old, sameUserOtherFamily)).toEqual({ status: 'not_rotated' });
    });

    it('un sucesor ya revocado no cuenta como éxito', async () => {
      const old = await insertToken(db, userId);
      const revoked = await insertToken(db, userId, {
        family_id: old.familyId,
        revoked_at: iso(plusMs(NOW, 1000)),
        revoked_reason: 'logout',
      });
      expect(await rotateTowards(old, revoked)).toEqual({ status: 'not_rotated' });
    });
  });

  describe('renovaciones concurrentes con el mismo token', () => {
    it('dos renovaciones simultáneas: exactamente una rota y nunca hay dos sucesores activos', async () => {
      const old = await insertToken(db, userId);
      const outcomes = await Promise.all([attempt(old), attempt(old)]);

      expect(outcomes.filter((outcome) => rotatedOf(outcome))).toHaveLength(1);
      expect(outcomes.filter((outcome) => !rotatedOf(outcome))).toHaveLength(1);
      expect(await count(db, 'refresh_tokens', `family_id = '${old.familyId}'`)).toBe(2);
      expect(
        await count(db, 'refresh_tokens', `family_id = '${old.familyId}' AND revoked_at IS NULL`),
      ).toBe(1);

      const winner = outcomes.find((outcome) => rotatedOf(outcome));
      const loser = outcomes.find((outcome) => !rotatedOf(outcome));
      expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
        replaced_by: winner?.newId,
      });
      expect(await rowOf(db, 'refresh_tokens', loser?.newId ?? '')).toBeNull();
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });

    it('diez renovaciones simultáneas: un ganador y nueve rechazadas sin errores', async () => {
      const old = await insertToken(db, userId);
      const settled = await Promise.allSettled(Array.from({ length: 10 }, () => attempt(old)));

      expect(settled.filter((outcome) => outcome.status === 'rejected')).toHaveLength(0);
      const fulfilled = settled.flatMap((outcome) =>
        outcome.status === 'fulfilled' ? [outcome.value] : [],
      );
      expect(fulfilled.filter((outcome) => rotatedOf(outcome))).toHaveLength(1);
      expect(
        await count(db, 'refresh_tokens', `family_id = '${old.familyId}' AND revoked_at IS NULL`),
      ).toBe(1);
      expect(await count(db, 'refresh_tokens')).toBe(2);
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });

    // Carga alta (15 rondas x 9 batch concurrentes): timeout explícito de 60 s en lugar del
    // de 5 s por defecto, que bajo carga de CPU no es una señal de defecto. Las aserciones
    // llevan la ronda para localizar el fallo.
    it('repetido 15 veces, y con familias distintas a la vez, las invariantes se mantienen', async () => {
      for (let round = 0; round < 15; round += 1) {
        const tokens = await Promise.all(Array.from({ length: 3 }, () => insertToken(db, userId)));
        const attempts = tokens.flatMap((token) => [
          attempt(token),
          attempt(token),
          attempt(token),
        ]);
        const settled = await Promise.allSettled(attempts);
        const rejected = settled.flatMap((outcome) =>
          outcome.status === 'rejected' ? [String(outcome.reason)] : [],
        );
        expect(rejected, `ronda ${round}: intentos rechazados con error`).toEqual([]);
        const outcomes = settled.flatMap((outcome) =>
          outcome.status === 'fulfilled' ? [outcome.value] : [],
        );
        // Un ganador por token.
        expect(
          outcomes.filter((outcome) => rotatedOf(outcome)),
          `ronda ${round}: ganadores`,
        ).toHaveLength(3);
        expect(await readInvariants(db), `ronda ${round}: invariantes`).toEqual(NO_VIOLATIONS);
      }
      // 15 rondas x 3 familias = 45 familias, cada una con 1 activo y 1 rotado.
      expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(45);
      expect(await count(db, 'refresh_tokens', "revoked_reason = 'rotated'")).toBe(45);
    }, 60_000);

    it('rotaciones sucesivas en cadena mantienen un solo activo por familia', async () => {
      let current = await insertToken(db, userId);
      for (let step = 1; step <= 5; step += 1) {
        const successor = await newSuccessor();
        const result = await rotate({
          oldHash: current.hash,
          now: plusMs(NOW, step * 60_000),
          ...successor,
        });
        expect(result.status).toBe('rotated');
        current = { ...current, id: successor.newId, hash: successor.newHash };
      }
      expect(await count(db, 'refresh_tokens', `family_id = '${current.familyId}'`)).toBe(6);
      expect(
        await count(
          db,
          'refresh_tokens',
          `family_id = '${current.familyId}' AND revoked_at IS NULL`,
        ),
      ).toBe(1);
      expect(await readInvariants(db)).toEqual(NO_VIOLATIONS);
    });
  });
});
