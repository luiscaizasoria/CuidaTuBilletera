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
