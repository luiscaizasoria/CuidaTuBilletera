import { Linking } from 'react-native';
import { OPEN_LINK_ERROR, openExternal } from './external-link';

afterEach(() => jest.restoreAllMocks());

describe('openExternal', () => {
  it('abre la URL con Linking.openURL, sin canOpenURL', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const can = jest.spyOn(Linking, 'canOpenURL');
    await expect(openExternal('https://ejemplo.test/privacidad')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('https://ejemplo.test/privacidad');
    expect(can).not.toHaveBeenCalled();
  });

  it('si el sistema rechaza, devuelve false sin lanzar', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin navegador'));
    await expect(openExternal('https://ejemplo.test/x')).resolves.toBe(false);
  });

  it('si openURL lanza de forma síncrona, devuelve false', async () => {
    jest.spyOn(Linking, 'openURL').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(openExternal('https://ejemplo.test/x')).resolves.toBe(false);
  });

  it('el aviso es breve', () => {
    expect(OPEN_LINK_ERROR).toBe('No pudimos abrir el enlace.');
  });
});
