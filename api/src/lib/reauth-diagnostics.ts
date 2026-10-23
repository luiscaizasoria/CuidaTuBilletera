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

// Fail-closed: solo con ENVIRONMENT === 'dev' y REAUTH_DIAGNOSTICS === '1' (comparación estricta).
// Emite una línea con el motivo y, si se conoce, la edad del token. Nada más.
export function reauthDiagnosticsHandler(env: AuthBindings): ReauthRejectedHandler | undefined {
  if (env.ENVIRONMENT !== 'dev' || env.REAUTH_DIAGNOSTICS !== '1') return undefined;
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
