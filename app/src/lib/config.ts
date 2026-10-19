// Variables públicas de Expo: se incrustan al empaquetar el JS (no requieren nuevo APK).
// Deben leerse con la forma literal process.env.EXPO_PUBLIC_*.
export interface AppConfig {
  apiUrl: string;
  googleWebClientId: string;
}

export function readConfig(
  env: { apiUrl?: string; googleWebClientId?: string } = {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
): AppConfig | null {
  const apiUrl = env.apiUrl?.trim().replace(/\/+$/, '');
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
