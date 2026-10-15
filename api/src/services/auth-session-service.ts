import {
  createSessionFamily,
  findRefreshTokenByHash,
  revokeFamilyForLogout,
  revokeFamilyForReuse,
  rotateRefreshToken,
  type FindRefreshTokenResult,
} from '../db/session-repository';
import { findUserById, upsertUserByGoogleSub, type UserRow } from '../db/user-repository';
import { ACCESS_TOKEN_TTL_SECONDS, issueAccessToken } from './access-token-service';
import type { GoogleIdentity } from './google-token-service';
import {
  defaultRandomBytes,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  type RandomBytes,
} from './refresh-token';

// Ventana de gracia ante refrescos concurrentes con el mismo token.
// DECISIÓN DE LÍMITE: con (now - revoked_at) < 30 000 ms (hasta 29 999 ms) es un conflicto
// legítimo (REFRESH_CONFLICT, sin credenciales y sin revocar). Con 30 000 ms o más (30 000 y
// 30 001 incluidos) es reutilización: se revoca la familia y se responde INVALID_TOKEN.
export const REFRESH_GRACE_MS = 30_000;

export interface AuthSessionDeps {
  now: () => Date;
  idGenerator: () => string;
  randomBytes: RandomBytes;
}

const defaultDeps: AuthSessionDeps = {
  now: () => new Date(),
  idGenerator: () => crypto.randomUUID(),
  randomBytes: defaultRandomBytes,
};

function resolve(deps?: Partial<AuthSessionDeps>): AuthSessionDeps {
  return { ...defaultDeps, ...deps };
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  user: { id: string; email: string; name?: string };
}

export type LoginResult = { status: 'OK'; session: AuthSession };

export type RefreshResult =
  | { status: 'OK'; session: AuthSession }
  | { status: 'REFRESH_CONFLICT' }
  | { status: 'INVALID_TOKEN' };

export type LogoutResult = { status: 'OK' };

async function buildSession(
  user: UserRow,
  secret: string,
  refreshToken: string,
  now: Date,
): Promise<AuthSession> {
  const name = user.nombre ?? undefined;
  const accessToken = await issueAccessToken({ id: user.id, email: user.email, name }, secret, now);
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    user: { id: user.id, email: user.email, name },
  };
}

export async function createSessionFromGoogleLogin(
  db: D1Database,
  secret: string,
  identity: GoogleIdentity,
  overrides?: Partial<AuthSessionDeps>,
): Promise<LoginResult> {
  const deps = resolve(overrides);
  const now = deps.now();
  const { user } = await upsertUserByGoogleSub(db, {
    id: deps.idGenerator(),
    google_sub: identity.sub,
    email: identity.email,
    nombre: identity.name ?? null,
    now,
  });
  const refreshToken = generateRefreshToken(deps.randomBytes);
  await createSessionFamily(db, {
    userId: user.id,
    familyId: deps.idGenerator(),
    tokenId: deps.idGenerator(),
    tokenHash: await hashRefreshToken(refreshToken),
    now,
    expiresAt: refreshExpiry(now),
  });
  return { status: 'OK', session: await buildSession(user, secret, refreshToken, now) };
}

async function classifyNonActive(
  db: D1Database,
  found: FindRefreshTokenResult,
  now: Date,
): Promise<RefreshResult> {
  if (found.status === 'rotated') {
    const elapsed = now.getTime() - Date.parse(found.revoked_at);
    // C: fuera de gracia => reutilización tardía, se revoca la familia.
    if (elapsed >= REFRESH_GRACE_MS) {
      await revokeFamilyForReuse(db, { userId: found.user_id, familyId: found.family_id, now });
      return { status: 'INVALID_TOKEN' };
    }
    // A: dentro de gracia y con la familia viva => conflicto legítimo.
    // B: dentro de gracia pero sin sucesor vigente (logout, expulsión, reuse) => inválido.
    return found.family_live ? { status: 'REFRESH_CONFLICT' } : { status: 'INVALID_TOKEN' };
  }
  // not_found, expired y revoked (logout/evicted/reuse).
  return { status: 'INVALID_TOKEN' };
}

export async function refreshSession(
  db: D1Database,
  secret: string,
  refreshToken: string,
  overrides?: Partial<AuthSessionDeps>,
): Promise<RefreshResult> {
  const deps = resolve(overrides);
  const now = deps.now();
  const oldHash = await hashRefreshToken(refreshToken);
  const found = await findRefreshTokenByHash(db, oldHash, now);
  if (found.status !== 'active') return classifyNonActive(db, found, now);

  const user = await findUserById(db, found.user_id);
  if (!user) return { status: 'INVALID_TOKEN' };

  const newToken = generateRefreshToken(deps.randomBytes);
  const rotation = await rotateRefreshToken(db, {
    oldHash,
    newId: deps.idGenerator(),
    newHash: await hashRefreshToken(newToken),
    now,
    expiresAt: refreshExpiry(now),
  });
  if (rotation.status === 'rotated') {
    return { status: 'OK', session: await buildSession(user, secret, newToken, now) };
  }

  // Carrera: otro refresco ganó entre la búsqueda y la rotación. Se reclasifica.
  const reclassified = await findRefreshTokenByHash(db, oldHash, now);
  // 'active' aquí es inesperado (la rotación no escribió pero el token sigue activo): se rechaza.
  return classifyNonActive(db, reclassified, now);
}

export async function logoutSession(
  db: D1Database,
  refreshToken: string,
  overrides?: Partial<AuthSessionDeps>,
): Promise<LogoutResult> {
  const now = resolve(overrides).now();
  const found = await findRefreshTokenByHash(db, await hashRefreshToken(refreshToken), now);
  if (found.status !== 'not_found') {
    await revokeFamilyForLogout(db, { userId: found.user_id, familyId: found.family_id, now });
  }
  // Idempotente y sin filtrar si el token existía.
  return { status: 'OK' };
}
