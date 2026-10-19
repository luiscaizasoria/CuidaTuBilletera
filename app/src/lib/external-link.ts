import { Linking } from 'react-native';

export const OPEN_LINK_ERROR = 'No pudimos abrir el enlace.';

// Abre una URL en el navegador. Sin canOpenURL (en Android 11+ exige declarar paquetes): se intenta
// abrir y se captura el rechazo. Devuelve false si falló, para que la pantalla muestre su aviso.
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
