import type { ReauthRejectedHandler } from '../routes/me';
import type { ReauthRejectionReason } from '../services/google-token-service';
import type { AuthBindings } from './auth-config';

const REASONS: readonly ReauthRejectionReason[] = [
  'TOKEN_INVALID',
  'TOKEN_TOO_OLD',
  'GOOGLE_SUB_MISMATCH',
  'EMAIL_NOT_VERIFIED',
  'AZP_INVALID',
  'OTRAS_CONDICIONES',
];

// ID público (no es un secreto) del cliente Web OAuth de DEV; debe coincidir con
// env.dev.vars.GOOGLE_WEB_CLIENT_ID de wrangler.jsonc (lo verifica una prueba). PROD usa otro cliente.
export const DEV_GOOGLE_WEB_CLIENT_ID =
  '441178517157-d2cfm6jre3hoepj9ltnaqmlrk57negkv.apps.googleusercontent.com';

// Fail-closed: solo con ENVIRONMENT === 'dev', REAUTH_DIAGNOSTICS === '1' y GOOGLE_WEB_CLIENT_ID
// idéntico al cliente Web de DEV (comparación estricta, sin recorte de espacios). La tercera
// condición no depende de las variables de activación: activar el diagnóstico en PROD exigiría
// sobrescribir además el cliente Web, lo que rompe la audiencia del login de PROD. Evita una
// activación accidental, no una deliberada. Emite una línea con el motivo y, si se conoce, la edad del token. Nada más.
export function reauthDiagnosticsHandler(env: AuthBindings): ReauthRejectedHandler | undefined {
  if (env.ENVIRONMENT !== 'dev' || env.REAUTH_DIAGNOSTICS !== '1') return undefined;
  if (env.GOOGLE_WEB_CLIENT_ID !== DEV_GOOGLE_WEB_CLIENT_ID) return undefined;
  return (reason, meta) => {
    if (!REASONS.includes(reason)) return;
    const entry: {
      event: 'reauth_rejected';
      reason: ReauthRejectionReason;
      tokenAgeSeconds?: number;
    } = { event: 'reauth_rejected', reason };
    const age = meta?.tokenAgeSeconds;
    if (typeof age === 'number' && Number.isSafeInteger(age)) entry.tokenAgeSeconds = age;
    console.warn(JSON.stringify(entry));
  };
}
