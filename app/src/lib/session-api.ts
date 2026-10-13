import { AuthError, type ApiSession, type AuthUser, type SessionApi } from './auth-types';

const REQUEST_TIMEOUT_MS = 15_000;

async function request(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw new AuthError('network');
  } finally {
    clearTimeout(timer);
  }
}

function failure(status: number): AuthError {
  // 400/401/403: la API no aceptó las credenciales. 5xx u otros: problema temporal.
  return status >= 400 && status < 500 ? new AuthError('rejected') : new AuthError('network');
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object') return data as Record<string, unknown>;
  } catch {
    // se trata abajo como respuesta inválida
  }
  throw new AuthError('unknown');
}

function toUser(value: unknown): AuthUser {
  const user = value as Partial<AuthUser> | undefined;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
    throw new AuthError('unknown');
  }
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === 'string' ? user.name : undefined,
  };
}

export function createSessionApi(baseUrl: string, fetchImpl: typeof fetch = fetch): SessionApi {
  return {
    async exchangeGoogleToken(idToken): Promise<ApiSession> {
      const response = await request(fetchImpl, `${baseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw failure(response.status);
      const data = await readJson(response);
      if (typeof data.accessToken !== 'string' || typeof data.expiresIn !== 'number') {
        throw new AuthError('unknown');
      }
      return { accessToken: data.accessToken, expiresIn: data.expiresIn, user: toUser(data.user) };
    },

    async getMe(accessToken): Promise<AuthUser> {
      const response = await request(fetchImpl, `${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw failure(response.status);
      return toUser((await readJson(response)).user);
    },
  };
}
