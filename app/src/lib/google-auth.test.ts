import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthError } from './auth-types';
import { createGoogleProvider } from './google-auth';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn(async () => null),
  },
  statusCodes: {
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    IN_PROGRESS: 'IN_PROGRESS',
  },
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
  isNoSavedCredentialFoundResponse: (r: { type: string }) => r.type === 'noSavedCredentialFound',
}));

const mocked = GoogleSignin as unknown as Record<
  'configure' | 'signIn' | 'signInSilently',
  jest.Mock
>;

describe('createGoogleProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('configura solo el webClientId, sin scopes extra', () => {
    createGoogleProvider('web-id');
    expect(mocked.configure).toHaveBeenCalledWith({ webClientId: 'web-id' });
  });

  it('devuelve el idToken en un inicio exitoso', async () => {
    mocked.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
    await expect(createGoogleProvider('w').signIn()).resolves.toEqual({
      status: 'success',
      idToken: 'tok',
    });
  });

  it('trata la cancelación como resultado, no como error', async () => {
    mocked.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(createGoogleProvider('w').signIn()).resolves.toEqual({ status: 'cancelled' });
  });

  it('sin idToken lo trata como error de configuración', async () => {
    mocked.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    await expect(createGoogleProvider('w').signIn()).rejects.toMatchObject({ kind: 'config' });
  });

  it.each([
    ['PLAY_SERVICES_NOT_AVAILABLE', 'play-services'],
    ['IN_PROGRESS', 'in-progress'],
    ['7', 'network'],
    ['10', 'config'],
    ['999', 'unknown'],
  ])('traduce el código %s a "%s" sin conservar el mensaje', async (code, kind) => {
    mocked.signIn.mockRejectedValue(Object.assign(new Error('correo@secreto.com'), { code }));
    const error = await createGoogleProvider('w')
      .signIn()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toContain('secreto');
  });

  it('la renovación silenciosa distingue "sin credencial guardada"', async () => {
    mocked.signInSilently.mockResolvedValue({ type: 'noSavedCredentialFound', data: null });
    await expect(createGoogleProvider('w').signInSilently()).resolves.toEqual({
      status: 'no-saved-credential',
    });
  });
});
