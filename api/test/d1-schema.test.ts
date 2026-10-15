import { beforeEach, describe, expect, it } from 'vitest';
import {
  count,
  DB_HOOK_TIMEOUT_MS,
  freshDb,
  insertToken,
  insertUser,
  iso,
  NOW,
  plusDays,
  plusMs,
  rowOf,
  sha256Hex,
  uuid,
} from './d1-helpers';

// Integración sobre D1 local con el esquema real de api/migrations/0001_users_refresh_tokens.sql.
let db: D1Database;
beforeEach(async () => {
  db = await freshDb();
}, DB_HOOK_TIMEOUT_MS);

const CHECK = /CHECK constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;

async function namesOf(type: 'table' | 'index'): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT name FROM sqlite_master WHERE type = ?1')
    .bind(type)
    .all<{ name: string }>();
  return results.map((row) => row.name);
}

describe('esquema creado por la migración 0001', () => {
  it('crea users, refresh_tokens y sus índices', async () => {
    expect(await namesOf('table')).toEqual(expect.arrayContaining(['users', 'refresh_tokens']));
    expect(await namesOf('index')).toEqual(
      expect.arrayContaining(['ux_refresh_tokens_family_active', 'ix_refresh_tokens_user_active']),
    );
  });

  it('registra la migración aplicada con el nombre del archivo', async () => {
    const { results } = await db
      .prepare('SELECT name FROM d1_migrations ORDER BY id')
      .all<{ name: string }>();
    // La 0002 (cuentas y categorías) y la 0003 (movimientos) se prueban en accounts-schema.test.ts
    // y transactions-schema.test.ts.
    expect(results).toHaveLength(3);
    expect(results[0]?.name).toMatch(/^0001_users_refresh_tokens(\.sql)?$/);
  });

  it('las tablas arrancan vacías y sin datos reales', async () => {
    expect(await count(db, 'users')).toBe(0);
    expect(await count(db, 'refresh_tokens')).toBe(0);
  });
});

describe('users', () => {
  it('acepta un usuario válido y aplica USD y free por defecto', async () => {
    const id = await insertUser(db);
    const row = await rowOf(db, 'users', id);
    expect(row).toMatchObject({ currency: 'USD', plan: 'free', plan_expires_at: null });
  });

  it('acepta nombre y plan_expires_at nulos o con fecha válida', async () => {
    await insertUser(db, { nombre: null });
    await insertUser(db, { plan_expires_at: iso(plusDays(NOW, 30)) });
    expect(await count(db, 'users')).toBe(2);
  });

  it('rechaza un google_sub repetido', async () => {
    await insertUser(db, { google_sub: 'sub-repetido' });
    await expect(insertUser(db, { google_sub: 'sub-repetido' })).rejects.toThrow(UNIQUE);
  });

  it('permite el mismo correo para dos identidades de Google distintas', async () => {
    await insertUser(db, { email: 'mismo@example.com' });
    await insertUser(db, { email: 'mismo@example.com' });
    expect(await count(db, 'users')).toBe(2);
  });

  it.each([
    ['moneda distinta de USD', { currency: 'EUR' }],
    ['plan distinto de free', { plan: 'premium' }],
    ['google_sub vacío', { google_sub: '  ' }],
    ['email vacío', { email: '' }],
    ['nombre vacío', { nombre: ' ' }],
  ])('rechaza %s', async (_name, overrides) => {
    await expect(insertUser(db, overrides)).rejects.toThrow(CHECK);
  });

  it.each([
    ['sin guiones', '0'.repeat(36)],
    ['demasiado corto', '1234'],
    ['en mayúsculas', uuid().toUpperCase()],
    ['con caracteres no hexadecimales', `${'g'.repeat(8)}-0000-0000-0000-000000000000`],
    ['con guiones mal ubicados', `${'0'.repeat(9)}-000-0000-0000-000000000000`],
  ])('rechaza un id UUID %s', async (_name, id) => {
    await expect(insertUser(db, { id })).rejects.toThrow(CHECK);
  });

  it.each([
    ['sin milisegundos', '2026-10-13T12:00:00Z'],
    ['con desfase horario', '2026-10-13T12:00:00.000+00:00'],
    ['solo fecha', '2026-10-13'],
    ['con espacio en lugar de T', '2026-10-13 12:00:00.000Z'],
    ['inexistente', '2026-13-45T12:00:00.000Z'],
    ['no es una fecha', 'ayer'],
  ])('rechaza created_at %s', async (_name, createdAt) => {
    await expect(insertUser(db, { created_at: createdAt })).rejects.toThrow(CHECK);
  });

  it('rechaza updated_at y plan_expires_at con formato inválido', async () => {
    await expect(insertUser(db, { updated_at: '2026-10-13' })).rejects.toThrow(CHECK);
    await expect(insertUser(db, { plan_expires_at: 'pronto' })).rejects.toThrow(CHECK);
  });

  it('rechaza created_at y updated_at nulos', async () => {
    await expect(insertUser(db, { created_at: null })).rejects.toThrow(/constraint failed/);
    await expect(insertUser(db, { updated_at: null })).rejects.toThrow(/constraint failed/);
  });
});

describe('refresh_tokens: valores y referencias', () => {
  let userId: string;
  beforeEach(async () => {
    userId = await insertUser(db);
  });

  it('acepta un token activo y solo guarda su hash SHA-256', async () => {
    const token = await insertToken(db, userId);
    const row = await rowOf(db, 'refresh_tokens', token.id);
    expect(row).toMatchObject({
      user_id: userId,
      token_hash: await sha256Hex(token.secret),
      revoked_at: null,
      revoked_reason: null,
      replaced_by: null,
    });
    expect(JSON.stringify(row)).not.toContain(token.secret);
  });

  it('rechaza un token_hash repetido', async () => {
    const token = await insertToken(db, userId);
    await expect(insertToken(db, userId, { token_hash: token.hash })).rejects.toThrow(UNIQUE);
  });

  it.each([
    ['en mayúsculas', 'A'.repeat(64)],
    ['demasiado corto', 'abc123'],
    ['demasiado largo', 'a'.repeat(65)],
    ['no hexadecimal', 'z'.repeat(64)],
    ['un token en claro', `rt_${'a'.repeat(61)}`],
  ])('rechaza un token_hash %s', async (_name, tokenHash) => {
    await expect(insertToken(db, userId, { token_hash: tokenHash })).rejects.toThrow(CHECK);
  });

  it('rechaza un user_id que no existe', async () => {
    await expect(insertToken(db, uuid())).rejects.toThrow(FOREIGN_KEY);
  });

  it('rechaza un family_id o un id que no son UUID', async () => {
    await expect(insertToken(db, userId, { family_id: 'familia' })).rejects.toThrow(CHECK);
    await expect(insertToken(db, userId, { id: 'token' })).rejects.toThrow(CHECK);
  });

  it('rechaza fechas con formato inválido y un vencimiento no posterior a la creación', async () => {
    await expect(insertToken(db, userId, { expires_at: '2026-10-20' })).rejects.toThrow(CHECK);
    await expect(insertToken(db, userId, { created_at: 'hoy' })).rejects.toThrow(CHECK);
    await expect(insertToken(db, userId, { expires_at: iso(NOW) })).rejects.toThrow(CHECK);
  });

  it('elimina los tokens de un usuario cuando se borra el usuario (CASCADE)', async () => {
    await insertToken(db, userId);
    await insertToken(db, userId);
    await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
    expect(await count(db, 'refresh_tokens')).toBe(0);
  });
});

describe('refresh_tokens: consistencia de revocación', () => {
  let userId: string;
  const revokedAt = iso(plusMs(NOW, 60_000));
  beforeEach(async () => {
    userId = await insertUser(db);
  });

  it('acepta un token activo con revoked_at y revoked_reason nulos', async () => {
    const token = await insertToken(db, userId);
    expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
    });
  });

  it.each(['rotated', 'logout', 'evicted', 'reuse'])(
    'acepta un token revocado con motivo %s',
    async (reason) => {
      const token = await insertToken(db, userId, {
        revoked_at: revokedAt,
        revoked_reason: reason,
      });
      expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
        revoked_at: revokedAt,
        revoked_reason: reason,
      });
    },
  );

  it('rechaza revoked_at sin revoked_reason', async () => {
    await expect(insertToken(db, userId, { revoked_at: revokedAt })).rejects.toThrow(CHECK);
  });

  it('rechaza revoked_reason sin revoked_at', async () => {
    await expect(insertToken(db, userId, { revoked_reason: 'logout' })).rejects.toThrow(CHECK);
  });

  it.each(['otro', '', 'ROTATED'])('rechaza el motivo %j', async (reason) => {
    await expect(
      insertToken(db, userId, { revoked_at: revokedAt, revoked_reason: reason }),
    ).rejects.toThrow(CHECK);
  });

  it('rechaza actualizar solo uno de los dos campos y acepta actualizar ambos', async () => {
    const token = await insertToken(db, userId);
    const update = (sql: string) => db.prepare(sql).bind(revokedAt, token.id).run();

    await expect(update('UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = ?2')).rejects.toThrow(
      CHECK,
    );
    await expect(
      update(
        "UPDATE refresh_tokens SET revoked_reason = 'logout' WHERE id = ?2 AND ?1 IS NOT NULL",
      ),
    ).rejects.toThrow(CHECK);
    await update(
      "UPDATE refresh_tokens SET revoked_at = ?1, revoked_reason = 'logout' WHERE id = ?2",
    );
    expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
      revoked_reason: 'logout',
    });
  });
});

describe('refresh_tokens: un solo token activo por familia', () => {
  let userId: string;
  beforeEach(async () => {
    userId = await insertUser(db);
  });

  it('rechaza un segundo token activo en la misma familia', async () => {
    const first = await insertToken(db, userId);
    await expect(insertToken(db, userId, { family_id: first.familyId })).rejects.toThrow(UNIQUE);
  });

  it('permite varios revocados y un activo en la misma familia', async () => {
    const familyId = uuid();
    const revoked = { revoked_at: iso(plusMs(NOW, 1000)), revoked_reason: 'rotated' };
    await insertToken(db, userId, { family_id: familyId, ...revoked });
    await insertToken(db, userId, { family_id: familyId, ...revoked });
    await insertToken(db, userId, { family_id: familyId });
    expect(await count(db, 'refresh_tokens', `family_id = '${familyId}'`)).toBe(3);
  });

  it('permite un activo por cada familia distinta, incluso del mismo usuario', async () => {
    await insertToken(db, userId);
    await insertToken(db, userId);
    await insertToken(db, userId);
    expect(await count(db, 'refresh_tokens', 'revoked_at IS NULL')).toBe(3);
  });

  it('libera la familia al revocar su token activo', async () => {
    const first = await insertToken(db, userId);
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ?1, revoked_reason = 'logout' WHERE id = ?2")
      .bind(iso(plusMs(NOW, 1000)), first.id)
      .run();
    await insertToken(db, userId, { family_id: first.familyId });
    expect(await count(db, 'refresh_tokens', `family_id = '${first.familyId}'`)).toBe(2);
  });
});

describe('refresh_tokens: replaced_by', () => {
  let userId: string;
  const revokedAt = iso(plusMs(NOW, 60_000));
  beforeEach(async () => {
    userId = await insertUser(db);
  });

  it('rechaza replaced_by en un token que no es rotated o que no está revocado', async () => {
    const target = await insertToken(db, userId);
    await expect(
      insertToken(db, userId, {
        revoked_at: revokedAt,
        revoked_reason: 'logout',
        replaced_by: target.id,
      }),
    ).rejects.toThrow(CHECK);
    await expect(insertToken(db, userId, { replaced_by: target.id })).rejects.toThrow(CHECK);
  });

  it('rechaza que un token se suceda a sí mismo', async () => {
    const id = uuid();
    await expect(
      insertToken(db, userId, {
        id,
        revoked_at: revokedAt,
        revoked_reason: 'rotated',
        replaced_by: id,
      }),
    ).rejects.toThrow(CHECK);
  });

  it('la referencia diferida se verifica al confirmar y revierte el batch completo', async () => {
    const token = await insertToken(db, userId);
    const other = await insertToken(db, userId);
    const original = iso(NOW);
    const touchedAt = iso(plusMs(NOW, 60_000));
    const before = await count(db, 'refresh_tokens');
    // Un UPDATE válido seguido de otro que apunta a un sucesor inexistente: la FK diferida
    // falla al COMMIT y ambos deben revertirse.
    // El motor local de workerd puede devolver `internal error` cuando falla una FK diferida
    // durante el COMMIT; el mensaje de SQLite solo aparece en el log de workerd. Por eso se
    // verifica el rechazo y, sobre todo, el estado posterior.
    await expect(
      db.batch([
        db
          .prepare('UPDATE refresh_tokens SET updated_at = ?1 WHERE id = ?2')
          .bind(touchedAt, other.id),
        db
          .prepare(
            "UPDATE refresh_tokens SET revoked_at = ?1, revoked_reason = 'rotated', replaced_by = ?2 WHERE id = ?3",
          )
          .bind(revokedAt, uuid(), token.id),
      ]),
    ).rejects.toThrow(/internal error|FOREIGN KEY/);
    expect(await rowOf(db, 'refresh_tokens', other.id)).toMatchObject({ updated_at: original });
    expect(await rowOf(db, 'refresh_tokens', token.id)).toMatchObject({
      revoked_at: null,
      revoked_reason: null,
      replaced_by: null,
      updated_at: original,
    });
    expect(await count(db, 'refresh_tokens', 'replaced_by IS NOT NULL')).toBe(0);
    expect(await count(db, 'refresh_tokens')).toBe(before);
    // D1 sigue operativo: consulta simple y batch válido posterior.
    expect(await count(db, 'users')).toBe(1);
    await db.batch([
      db
        .prepare('UPDATE refresh_tokens SET updated_at = ?1 WHERE id = ?2')
        .bind(touchedAt, other.id),
    ]);
    expect(await rowOf(db, 'refresh_tokens', other.id)).toMatchObject({ updated_at: touchedAt });
  });

  it('deja replaced_by en NULL cuando se borra el sucesor (SET NULL)', async () => {
    const successor = await insertToken(db, userId);
    const old = await insertToken(db, userId, {
      revoked_at: revokedAt,
      revoked_reason: 'rotated',
      replaced_by: successor.id,
    });
    await db.prepare('DELETE FROM refresh_tokens WHERE id = ?1').bind(successor.id).run();
    expect(await rowOf(db, 'refresh_tokens', old.id)).toMatchObject({
      revoked_reason: 'rotated',
      replaced_by: null,
    });
  });
});
