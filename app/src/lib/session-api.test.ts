import { fakeJwt, USER } from '../test-utils';
import { AuthError } from './auth-types';
import { createSessionApi } from './session-api';

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('createSessionApi', () => {
  it('intercambia el ID token por una sesión', async () => {
    const token = fakeJwt(900);
    const fetchMock = jest.fn(async () =>
      json(200, { accessToken: token, expiresIn: 900, user: USER }),
    );
    const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);

    await expect(api.exchangeGoogleToken('id-token')).resolves.toMatchObject({
      accessToken: token,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/auth/google');
    expect(init.body).toBe(JSON.stringify({ idToken: 'id-token' }));
  });

  it('envía el JWT en GET /me', async () => {
    const fetchMock = jest.fn(async () => json(200, { user: USER }));
    const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);

    await expect(api.getMe('jwt')).resolves.toEqual(USER);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ Authorization: 'Bearer jwt' });
  });

  it.each([
    [400, 'rejected'],
    [401, 'rejected'],
    [500, 'network'],
  ])('traduce HTTP %i a "%s"', async (status, kind) => {
    const fetchMock = jest.fn(async () => json(status, { error: {} }));
    const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);
    await expect(api.getMe('jwt')).rejects.toMatchObject({ kind });
  });

  it('traduce un fallo de red a "network"', async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);
    await expect(api.exchangeGoogleToken('x')).rejects.toBeInstanceOf(AuthError);
    await expect(api.exchangeGoogleToken('x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('rechaza respuestas con forma inesperada', async () => {
    const fetchMock = jest.fn(async () => json(200, { foo: 1 }));
    const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);
    await expect(api.exchangeGoogleToken('x')).rejects.toMatchObject({ kind: 'unknown' });
  });
});
