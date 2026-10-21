// Variables públicas de Expo: se incrustan al empaquetar el JS (no requieren nuevo APK).
// Deben leerse con la forma literal process.env.EXPO_PUBLIC_*.
export interface AppConfig {
  apiUrl: string;
  googleWebClientId: string;
}

// Hosts de desarrollo local a los que se permite http (solo con isDev). Lista cerrada: un host de
// red local distinto (p. ej. una IP de LAN) nunca se admite por http. 10.0.2.2 es el alias del
// emulador de Android hacia la máquina anfitriona.
export const DEV_CLEARTEXT_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '10.0.2.2'];

// Espacios, caracteres de control, '?', '#' y '\\' se rechazan sobre el texto crudo, antes de
// parsear, porque URL() los corrige o descarta en silencio.
const FORBIDDEN_RAW = /[\s?#\\]/;

const hasControlChar = (text: string): boolean =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

// Devuelve origen + ruta sin barras finales, o null si la URL no es válida para la API.
// https siempre; http solo en desarrollo y hacia un host de DEV_CLEARTEXT_HOSTS.
function normalizeApiUrl(raw: string | undefined, isDev: boolean): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || FORBIDDEN_RAW.test(trimmed) || hasControlChar(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.username !== '' || url.password !== '' || url.hostname === '') return null;
    if (url.protocol === 'http:') {
      if (!isDev || !DEV_CLEARTEXT_HOSTS.includes(url.hostname)) return null;
    } else if (url.protocol !== 'https:') {
      return null;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function readConfig(
  env: { apiUrl?: string; googleWebClientId?: string } = {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
  options: { isDev?: boolean } = { isDev: __DEV__ },
): AppConfig | null {
  const apiUrl = normalizeApiUrl(env.apiUrl, options.isDev === true);
  const googleWebClientId = env.googleWebClientId?.trim();
  if (!apiUrl || !googleWebClientId) return null;
  return { apiUrl, googleWebClientId };
}

// Enlaces legales públicos (G1). Son opcionales: sin una URL https válida la app no muestra el
// enlace (ni un «próximamente») y, a diferencia de readConfig(), su ausencia no bloquea la app.
export interface LegalLinks {
  privacyPolicyUrl: string | null;
  accountDeletionUrl: string | null;
}

function httpsUrlOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' && url.hostname !== '' ? trimmed : null;
  } catch {
    return null;
  }
}

export function readLegalLinks(
  env: { privacyPolicyUrl?: string; accountDeletionUrl?: string } = {
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  },
): LegalLinks {
  return {
    privacyPolicyUrl: httpsUrlOrNull(env.privacyPolicyUrl),
    accountDeletionUrl: httpsUrlOrNull(env.accountDeletionUrl),
  };
}
