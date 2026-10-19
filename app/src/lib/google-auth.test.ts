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
  'configure' | 'signIn' | 'signInSilently' | 'signOut' | 'hasPlayServices',
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

describe('createGoogleProvider.reauthenticate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocked.hasPlayServices.mockResolvedValue(true);
    mocked.signOut.mockResolvedValue(null);
  });

  it('signOut -> hasPlayServices -> signIn, nunca signInSilently, y devuelve el idToken', async () => {
    const order: string[] = [];
    mocked.signOut.mockImplementation(async () => void order.push('signOut'));
    mocked.hasPlayServices.mockImplementation(async () => void order.push('playServices'));
    mocked.signIn.mockImplementation(async () => {
      order.push('signIn');
      return { type: 'success', data: { idToken: 'tok' } };
    });
    await expect(createGoogleProvider('w').reauthenticate()).resolves.toEqual({
      status: 'success',
      idToken: 'tok',
    });
    expect(order).toEqual(['signOut', 'playServices', 'signIn']);
    expect(mocked.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(mocked.signInSilently).not.toHaveBeenCalled();
  });

  it('un fallo de signOut no impide pedir la cuenta', async () => {
    mocked.signOut.mockRejectedValue(new Error('x'));
    mocked.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
    await expect(createGoogleProvider('w').reauthenticate()).resolves.toMatchObject({
      status: 'success',
    });
  });

  it('la cancelación es un resultado, no un error', async () => {
    mocked.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(createGoogleProvider('w').reauthenticate()).resolves.toEqual({
      status: 'cancelled',
    });
    expect(mocked.signInSilently).not.toHaveBeenCalled();
  });

  it('Play Services no disponible: error play-services sin abrir el selector', async () => {
    mocked.hasPlayServices.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    await expect(createGoogleProvider('w').reauthenticate()).rejects.toMatchObject({
      kind: 'play-services',
    });
    expect(mocked.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ['10', 'config'],
    ['IN_PROGRESS', 'in-progress'],
    ['7', 'network'],
    ['999', 'unknown'],
  ])('código %s -> %s', async (code, kind) => {
    mocked.signIn.mockRejectedValue(Object.assign(new Error('correo@secreto.com'), { code }));
    const error = await createGoogleProvider('w')
      .reauthenticate()
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toContain('secreto');
  });

  it('sin idToken: error de configuración', async () => {
    mocked.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    await expect(createGoogleProvider('w').reauthenticate()).rejects.toMatchObject({
      kind: 'config',
    });
  });
});
