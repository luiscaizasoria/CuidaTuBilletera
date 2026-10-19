// La raíz monta SafeAreaProvider y el modo inmersivo antes de decidir la pantalla (docs/003 D17).
import { render, screen } from '@testing-library/react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { Platform } from 'react-native';
import App from './App';

jest.mock('./lib/google-auth', () => ({ createGoogleProvider: jest.fn() }));
jest.mock('./lib/session-storage', () => ({ secureSessionStorage: {} }));
jest.mock('./lib/config', () => ({ readConfig: () => null }));

const setHidden = NavigationBar.setHidden as jest.Mock;
const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
  setHidden.mockClear();
});

describe('App: modo inmersivo', () => {
  it('sin configuración (ConfigMissing) igualmente oculta la barra en Android', async () => {
    Platform.OS = 'android';
    await render(<App />);
    expect(screen.toJSON()).not.toBeNull();
    expect(setHidden).toHaveBeenCalledWith(true);
  });

  it('en iOS no toca la barra', async () => {
    Platform.OS = 'ios';
    await render(<App />);
    expect(setHidden).not.toHaveBeenCalled();
  });
});
