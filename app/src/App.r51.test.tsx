// R5.1: «Cerrar sesión» desde el encabezado de Mis cuentas y desde Más usa el mismo mecanismo, y no hay
// fuga de datos entre usuarios al volver a entrar con otra cuenta (R51-08, R51-09, R51-11).
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import App from './App';
import { createAuthService } from './lib/auth-service';
import type { AuthUser } from './lib/auth-types';
import { guideRecord, memoryGuideStorage } from './guides-test-utils';
import { account, fakeResourcesApi, pageOf } from './resources-test-utils';
import {
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  mockWindow,
  REFRESH_EXPIRES_AT,
  refreshTokenOf,
  relaxTimeoutsForColdCache,
  storedSession,
} from './test-utils';

relaxTimeoutsForColdCache();

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

const ANA: AuthUser = { id: 'sub-ana', email: 'ana@example.com', name: 'Ana' };
const BETO: AuthUser = { id: 'sub-beto', email: 'beto@example.com', name: 'Beto' };

const emailOf = (token: string): string =>
  (
    JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as {
      email: string;
    }
  ).email;

function setup() {
  const clock = fakeClock();
  const storage = fakeStorage({
    kind: 'session',
    session: storedSession({ accessToken: fakeJwt(600, ANA), user: ANA }),
  });
  const users = [BETO];
  const api = fakeApi({
    exchangeGoogleToken: jest.fn(async () => {
      const user = users.shift() ?? BETO;
      return {
        accessToken: fakeJwt(900, user, 'login'),
        expiresIn: 900,
        refreshToken: refreshTokenOf(`RT-${user.id}`),
        refreshExpiresAt: REFRESH_EXPIRES_AT,
        user,
      };
    }),
    getMe: jest.fn(async () => ANA),
  });
  const service = createAuthService({
    google: fakeGoogle(),
    storage,
    api,
    now: clock.now,
    sleep: clock.sleep,
    random: clock.random,
  });
  const guides = memoryGuideStorage({ 'guias_v1_sub-ana': guideRecord('cuentas-lista') });
  const resourcesApi = fakeResourcesApi({
    listAccounts: jest.fn(async (token: string) =>
      pageOf([
        account({
          id: emailOf(token) === ANA.email ? 'acc-ana' : 'acc-beto',
          nombre: emailOf(token) === ANA.email ? 'Cuenta de Ana' : 'Cuenta de Beto',
        }),
      ]),
    ),
  });
  return { service, storage, guides, resourcesApi };
}

beforeEach(() => {
  mockWindow(360, 1);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('App R5.1: cerrar sesión desde el encabezado', () => {
  it('cierra la sesión sin confirmar, conserva las guías y no filtra datos al siguiente usuario', async () => {
    const { service, storage, guides, resourcesApi } = setup();
    await render(<App service={service} resourcesApi={resourcesApi} guideStorage={guides} />);
    expect(await screen.findByText('Cuenta de Ana')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Continuar con Google')).toBeTruthy();
    expect(storage.isEmpty()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(guides.writes).toHaveLength(0);
    expect(guides.data.get('guias_v1_sub-ana')).toBe(guideRecord('cuentas-lista'));
    expect(screen.queryByText('Cuenta de Ana')).toBeNull();

    // Otro usuario de Google: solo ve sus datos.
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(await screen.findByText('Cuenta de Beto')).toBeTruthy();
    expect(screen.getByText('Hola, Beto')).toBeTruthy();
    expect(screen.queryByText('Cuenta de Ana')).toBeNull();
    await waitFor(() =>
      expect(guides.data.get('guias_v1_sub-ana')).toBe(guideRecord('cuentas-lista')),
    );
  });

  it('desde Más usa el mismo cierre de sesión', async () => {
    const { service, storage, guides, resourcesApi } = setup();
    await render(<App service={service} resourcesApi={resourcesApi} guideStorage={guides} />);
    await fireEvent.press(
      await screen.findByRole('button', { name: /Cuenta de Ana, saldo actual .*Abrir cuenta/ }),
    );
    await fireEvent.press(await screen.findByRole('tab', { name: 'Más' }));
    const writesBefore = guides.writes.length;
    await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Continuar con Google')).toBeTruthy();
    expect(storage.isEmpty()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    // Cerrar sesión no escribe ni borra guías.
    expect(guides.writes).toHaveLength(writesBefore);
    expect(guides.data.get('guias_v1_sub-ana')).toContain('cuentas-lista');
  });
});
