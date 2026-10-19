// R5, criterio J16: cerrar sesión no borra las guías descartadas y el módulo de sesión no cambia.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import App from './App';
import { createAuthService } from './lib/auth-service';
import { guideRecord, memoryGuideStorage } from './guides-test-utils';
import { pageOf, fakeResourcesApi } from './resources-test-utils';
import {
  fakeApi,
  fakeClock,
  fakeGoogle,
  fakeJwt,
  fakeStorage,
  relaxTimeoutsForColdCache,
  storedSession,
} from './test-utils';

relaxTimeoutsForColdCache();

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));

describe('App: guías y cierre de sesión', () => {
  it('cerrar sesión limpia solo la sesión; la preferencia del usuario se conserva y no vuelve la guía', async () => {
    const clock = fakeClock();
    const storage = fakeStorage({
      kind: 'session',
      session: storedSession({ accessToken: fakeJwt(600) }),
    });
    const service = createAuthService({
      google: fakeGoogle(),
      storage,
      api: fakeApi(),
      now: clock.now,
      sleep: clock.sleep,
      random: clock.random,
    });
    const guides = memoryGuideStorage();
    const resourcesApi = fakeResourcesApi({ listAccounts: jest.fn(async () => pageOf([])) });
    await render(<App service={service} resourcesApi={resourcesApi} guideStorage={guides} />);

    expect(await screen.findByTestId('guide-cuentas-vacio')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));
    await screen.findByText('Todavía no tienes cuentas');

    await fireEvent.press(screen.getByRole('button', { name: 'Tu perfil y sesión' }));
    // R5.1: el encabezado también tiene «Cerrar sesión»; se pulsa el de la hoja de perfil.
    await fireEvent.press(
      within(screen.getByTestId('profile-sheet')).getByRole('button', { name: 'Cerrar sesión' }),
    );
    await screen.findByText('Continuar con Google');
    expect(storage.isEmpty()).toBe(true);
    expect(guides.data.get('guias_v1_sub-1')).toBe(guideRecord('cuentas-vacio'));

    // El mismo usuario vuelve a entrar: no ve de nuevo la bienvenida.
    await fireEvent.press(screen.getByText('Continuar con Google'));
    await screen.findByText('Todavía no tienes cuentas');
    await screen.findByRole('header', { name: 'Mis cuentas' });
    expect(guides.reads.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('guide-cuentas-vacio')).toBeNull();
  });
});
