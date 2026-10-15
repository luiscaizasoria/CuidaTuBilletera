import type { createApp } from '../src/app';
import { issueAccessToken } from '../src/services/access-token-service';
import { insertUser, NOW } from './d1-helpers';
import { AUTH_ENV, JWT_SECRET } from './helpers';

export const envWith = (db: D1Database) => ({ ...AUTH_ENV, DB: db });

export async function userWithToken(
  db: D1Database,
  email = 'usuario@example.com',
): Promise<{ id: string; token: string }> {
  const id = await insertUser(db, { email });
  return { id, token: await issueAccessToken({ id, email }, JWT_SECRET, NOW) };
}

export function api(app: ReturnType<typeof createApp>, db: D1Database) {
  return (method: string, path: string, token?: string, body?: unknown, raw = false) =>
    app.request(
      path,
      {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: raw ? (body as string) : JSON.stringify(body) } : {}),
      },
      envWith(db),
    );
}
