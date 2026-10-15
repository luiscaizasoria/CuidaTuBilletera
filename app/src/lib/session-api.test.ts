import { USER } from '../test-utils';
import { classifyFailure, createSessionApi, isUtcIsoDate } from './session-api';

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('classifyFailure', () => {
  it.each([
    [401, 'INVALID_REFRESH_TOKEN', 'rejected'],
    [401, 'INVALID_TOKEN', 'rejected'],
    [401, 'UNAUTHORIZED', 'rejected'],
    [401, undefined, 'unknown'],
    [401, 'OTRO', 'unknown'],
    [409, 'REFRESH_CONFLICT', 'conflict'],
    [409, undefined, 'unknown'],
    [409, 'OTRO', 'unknown'],
    [400, 'VALIDATION_ERROR', 'unknown'],
    [403, undefined, 'unknown'],
    [413, 'PAYLOAD_TOO_LARGE', 'unknown'],
    [429, undefined, 'server'],
    [500, 'INTERNAL_ERROR', 'server'],
    [503, undefined, 'server'],
  ])('status %i con código %s -> %s', (status, code, kind) => {
    expect(classifyFailure(status, code)).toBe(kind);
  });
});

const REFRESH_A = 'A'.repeat(43);
const REFRESH_B = 'B'.repeat(43);
const EXPIRES = '2026-11-13T12:00:00.000Z';
const ACCESS = 'jwt-acceso-secreto';
const tokens = (refreshToken = REFRESH_B) => ({
  accessToken: ACCESS,
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken,
  refreshExpiresAt: EXPIRES,
});
const errorBody = (code: string) => ({ error: { code, message: 'MENSAJE-NO-PROPAGAR' } });
const noContent = () => ({ ok: true, status: 204, json: async () => ({}) }) as unknown as Response;

function makeV2(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = jest.fn(impl);
  const api = createSessionApi('https://api.test', fetchMock as unknown as typeof fetch);
  return { api, fetchMock };
}
const callOf = (fetchMock: jest.Mock, index = 0) =>
  fetchMock.mock.calls[index] as unknown as [string, RequestInit];

describe('createSessionApi', () => {
  it('exchangeGoogleToken: request exacto y respuesta válida', async () => {
    const { api, fetchMock } = makeV2(async () => json(200, { ...tokens(REFRESH_A), user: USER }));
    await expect(api.exchangeGoogleToken('id-token')).resolves.toEqual({
      accessToken: ACCESS,
      expiresIn: 900,
      refreshToken: REFRESH_A,
      refreshExpiresAt: EXPIRES,
      user: USER,
    });
    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://api.test/auth/google');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ idToken: 'id-token' }));
  });

  it('refresh: request exacto, sin Authorization y sin user en la respuesta', async () => {
    const { api, fetchMock } = makeV2(async () => json(200, tokens()));
    await expect(api.refresh(REFRESH_A)).resolves.toEqual({
      accessToken: ACCESS,
      expiresIn: 900,
      refreshToken: REFRESH_B,
      refreshExpiresAt: EXPIRES,
    });
    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://api.test/auth/refresh');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ refreshToken: REFRESH_A }));
  });

  it('logout: resuelve con 204 y no envía Authorization', async () => {
    const { api, fetchMock } = makeV2(async () => noContent());
    await expect(api.logout(REFRESH_A)).resolves.toBeUndefined();
    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://api.test/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ refreshToken: REFRESH_A }));
  });

  it('logout: un 200 no confirma la revocación', async () => {
    const { api } = makeV2(async () => json(200, {}));
    await expect(api.logout(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('getMe: envía Bearer y devuelve el usuario', async () => {
    const { api, fetchMock } = makeV2(async () => json(200, { user: USER }));
    await expect(api.getMe('jwt')).resolves.toEqual(USER);
    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://api.test/me');
    expect(init.headers).toEqual({ Authorization: 'Bearer jwt' });
  });

  it.each([
    ['refresh', 401, 'INVALID_REFRESH_TOKEN', 'rejected'],
    ['refresh', 409, 'REFRESH_CONFLICT', 'conflict'],
    ['refresh', 409, undefined, 'unknown'],
    ['refresh', 400, 'VALIDATION_ERROR', 'unknown'],
    ['refresh', 413, 'PAYLOAD_TOO_LARGE', 'unknown'],
    ['refresh', 429, 'RATE_LIMITED', 'server'],
    ['refresh', 500, 'INTERNAL_ERROR', 'server'],
    ['refresh', 503, undefined, 'server'],
    ['exchange', 401, 'INVALID_TOKEN', 'rejected'],
    ['exchange', 400, 'VALIDATION_ERROR', 'unknown'],
    ['exchange', 500, 'INTERNAL_ERROR', 'server'],
    ['getMe', 401, 'INVALID_TOKEN', 'rejected'],
    ['getMe', 401, 'UNAUTHORIZED', 'rejected'],
    ['logout', 401, 'INVALID_REFRESH_TOKEN', 'rejected'],
    ['logout', 500, undefined, 'server'],
  ] as const)('%s con HTTP %i (%s) -> %s', async (operation, status, code, kind) => {
    const { api } = makeV2(async () => json(status, code ? errorBody(code) : {}));
    const run = {
      refresh: () => api.refresh(REFRESH_A),
      exchange: () => api.exchangeGoogleToken('x'),
      getMe: () => api.getMe('jwt'),
      logout: () => api.logout(REFRESH_A),
    }[operation];
    const error = await run().catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AuthError', kind, status });
    expect((error as { code?: string }).code).toBe(code);
    expect((error as Error).message).not.toContain('MENSAJE-NO-PROPAGAR');
  });

  it('ignora códigos con formato inesperado y cuerpos no JSON', async () => {
    const weird = makeV2(async () => json(401, { error: { code: 'token=abc def', message: 'x' } }));
    await expect(weird.api.refresh(REFRESH_A)).rejects.toMatchObject({
      kind: 'unknown',
      code: undefined,
    });
    const html = makeV2(
      async () =>
        ({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error('html');
          },
        }) as unknown as Response,
    );
    await expect(html.api.refresh(REFRESH_A)).rejects.toMatchObject({
      kind: 'server',
      status: 502,
    });
  });

  it('traduce un fallo de red a network', async () => {
    const { api } = makeV2(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'network' });
  });

  describe('timeouts', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const hanging = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('abort')));
      });

    it('refresh expira a los 15 s como network', async () => {
      const { api } = makeV2(hanging);
      const result = api.refresh(REFRESH_A).catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(14_999);
      let settled = false;
      void result.then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toMatchObject({ kind: 'network' });
    });

    it('logout expira a los 8 s como network', async () => {
      const { api } = makeV2(hanging);
      const result = api.logout(REFRESH_A).catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(8_000);
      await expect(result).resolves.toMatchObject({ kind: 'network' });
    });
  });

  describe('validación estructural de respuestas 2xx', () => {
    const base = { ...tokens(), user: USER };
    it.each([
      ['refresh de 42 caracteres', { ...base, refreshToken: 'B'.repeat(42) }],
      ['refresh con caracteres inválidos', { ...base, refreshToken: '+'.repeat(43) }],
      ['sin refreshToken', { ...base, refreshToken: undefined }],
      ['refreshExpiresAt inválido', { ...base, refreshExpiresAt: 'ayer' }],
      ['expiresIn no numérico', { ...base, expiresIn: '900' }],
      ['sin accessToken', { ...base, accessToken: undefined }],
      ['sin tokenType', { ...base, tokenType: undefined }],
      ['sin user', { ...base, user: undefined }],
      ['user sin email', { ...base, user: { id: 'u' } }],
    ])('exchangeGoogleToken rechaza: %s', async (_name, body) => {
      const { api } = makeV2(async () => json(200, body));
      const error = await api.exchangeGoogleToken('x').catch((e: unknown) => e);
      expect(error).toMatchObject({ kind: 'unknown' });
      expect(JSON.stringify(error)).not.toContain(ACCESS);
    });

    it('refresh rechaza una respuesta sin refreshToken', async () => {
      const bad = makeV2(async () => json(200, { ...tokens(), refreshToken: undefined }));
      await expect(bad.api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
    });

    describe('contrato endurecido (fecha, expiresIn, tokenType)', () => {
      const INVALID_DATES = [
        '12',
        'ayer',
        '',
        '2026-02-30T12:00:00.000Z',
        '2026-13-01T12:00:00.000Z',
        '2026-11-32T12:00:00.000Z',
        '2026-11-13T24:00:00.000Z',
        '2026-11-13T25:00:00.000Z',
        '2026-11-13T12:60:00.000Z',
        '2026-11-13T12:00:60.000Z',
        '2026-11-13T12:00:00', // sin zona
        '2026-11-13T12:00:00.000', // sin zona
        '2026-11-13T12:00:00.000+00:00', // offset (incluso equivalente a UTC)
        '2026-11-13T12:00:00-05:00',
        '2026-11-13T12:00:00.0000Z', // fracción de 4 dígitos
        '2026-11-13T12:00:00.Z',
        '2026-11-13 12:00:00.000Z',
        '2026-11-13',
        ' 2026-11-13T12:00:00.000Z',
        '2026-11-13T12:00:00.000Z ',
        '2026-11-13t12:00:00.000z',
      ];
      const VALID_DATES = [
        '2026-11-13T12:00:00Z',
        '2026-11-13T12:00:00.5Z',
        '2026-11-13T12:00:00.12Z',
        '2026-11-13T12:00:00.123Z',
        '2028-02-29T00:00:00.000Z', // bisiesto
        new Date().toISOString(),
        new Date(Date.UTC(2026, 10, 13, 12, 0, 0)).toISOString(),
      ];

      it.each(INVALID_DATES)('isUtcIsoDate rechaza %p', (value) => {
        expect(isUtcIsoDate(value)).toBe(false);
      });

      it.each(VALID_DATES)('isUtcIsoDate acepta %p', (value) => {
        expect(isUtcIsoDate(value)).toBe(true);
      });

      it.each([undefined, null, 12, {}, new Date()])('isUtcIsoDate rechaza no-string %p', (v) => {
        expect(isUtcIsoDate(v)).toBe(false);
      });

      it('rechaza 2027-02-29 (no bisiesto)', () => {
        expect(isUtcIsoDate('2027-02-29T00:00:00.000Z')).toBe(false);
      });

      it.each(INVALID_DATES)(
        '/auth/refresh y /auth/google rechazan refreshExpiresAt %p',
        async (d) => {
          const body = { ...tokens(), refreshExpiresAt: d, user: USER };
          const refresh = makeV2(async () => json(200, body));
          await expect(refresh.api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
          const google = makeV2(async () => json(200, body));
          await expect(google.api.exchangeGoogleToken('x')).rejects.toMatchObject({
            kind: 'unknown',
          });
        },
      );

      it.each(VALID_DATES)('/auth/refresh acepta refreshExpiresAt %p', async (d) => {
        const { api } = makeV2(async () => json(200, { ...tokens(), refreshExpiresAt: d }));
        await expect(api.refresh(REFRESH_A)).resolves.toMatchObject({ refreshExpiresAt: d });
      });

      it.each([0, -1, 900.5, '900', Number.NaN, Infinity, -Infinity, null, undefined])(
        'rechaza expiresIn %p en ambos endpoints',
        async (expiresIn) => {
          const body = { ...tokens(), expiresIn, user: USER };
          const refresh = makeV2(async () => json(200, body));
          await expect(refresh.api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
          const google = makeV2(async () => json(200, body));
          await expect(google.api.exchangeGoogleToken('x')).rejects.toMatchObject({
            kind: 'unknown',
          });
        },
      );

      it.each(['bearer', 'BEARER', 'Bearer ', ' Bearer', 'Basic', '', undefined, null, 1, {}])(
        'rechaza tokenType %p en ambos endpoints',
        async (tokenType) => {
          const body = { ...tokens(), tokenType, user: USER };
          const refresh = makeV2(async () => json(200, body));
          await expect(refresh.api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
          const google = makeV2(async () => json(200, body));
          await expect(google.api.exchangeGoogleToken('x')).rejects.toMatchObject({
            kind: 'unknown',
          });
        },
      );

      it('acepta las respuestas completas del contrato backend (google y refresh)', async () => {
        const real = {
          accessToken: ACCESS,
          tokenType: 'Bearer',
          expiresIn: 900,
          refreshToken: REFRESH_B,
          refreshExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        };
        const google = makeV2(async () => json(200, { ...real, user: USER }));
        await expect(google.api.exchangeGoogleToken('x')).resolves.toEqual({
          accessToken: ACCESS,
          expiresIn: 900,
          refreshToken: REFRESH_B,
          refreshExpiresAt: real.refreshExpiresAt,
          user: USER,
        });
        const refresh = makeV2(async () => json(200, real));
        await expect(refresh.api.refresh(REFRESH_A)).resolves.toEqual({
          accessToken: ACCESS,
          expiresIn: 900,
          refreshToken: REFRESH_B,
          refreshExpiresAt: real.refreshExpiresAt,
        });
      });
    });

    it('rechaza cuerpos que no son objeto o no son JSON', async () => {
      const arr = makeV2(async () => json(200, []));
      await expect(arr.api.refresh(REFRESH_A)).rejects.toMatchObject({ kind: 'unknown' });
      const bad = makeV2(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new Error('x');
            },
          }) as unknown as Response,
      );
      await expect(bad.api.getMe('jwt')).rejects.toMatchObject({ kind: 'unknown' });
    });

    it('getMe rechaza un usuario mal formado', async () => {
      const { api } = makeV2(async () => json(200, { user: { id: 1 } }));
      await expect(api.getMe('jwt')).rejects.toMatchObject({ kind: 'unknown' });
    });
  });

  it('no registra tokens en console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const ok = makeV2(async () => json(200, { ...tokens(), user: USER }));
    await ok.api.exchangeGoogleToken('id-token-secreto');
    await ok.api.refresh(REFRESH_A);
    const failing = makeV2(async () => json(401, errorBody('INVALID_REFRESH_TOKEN')));
    await failing.api.refresh(REFRESH_A).catch(() => undefined);
    await failing.api.getMe(ACCESS).catch(() => undefined);
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const secret of [ACCESS, REFRESH_A, REFRESH_B, 'id-token-secreto']) {
      expect(logged).not.toContain(secret);
    }
    spies.forEach((spy) => spy.mockRestore());
  });
});
