import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage } from './session-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'jwt'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('secureSessionStorage', () => {
  it('guarda, lee y borra el JWT en SecureStore bajo una sola clave', async () => {
    await secureSessionStorage.save('jwt');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('session_token', 'jwt');
    await expect(secureSessionStorage.load()).resolves.toBe('jwt');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('session_token');
    await secureSessionStorage.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('session_token');
  });
});
