// Extiende app.json (fuente única). SYSTEM_ALERT_WINDOW solo se conserva si el build declara
// de forma explícita ALLOW_SYSTEM_ALERT_WINDOW=1 (perfil development de eas.json: overlay del
// dev client). Cualquier otro caso lo bloquea (fail closed): production nunca lo conserva por
// una variable perdida.
const KNOWN_PROFILES = ['development', 'preview', 'production'];

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const allow = process.env.ALLOW_SYSTEM_ALERT_WINDOW === '1';

  if (profile && !KNOWN_PROFILES.includes(profile)) {
    throw new Error(`app.config.js: perfil EAS desconocido «${profile}».`);
  }
  if (allow && profile && profile !== 'development') {
    throw new Error(
      `app.config.js: ALLOW_SYSTEM_ALERT_WINDOW=1 solo es válido en development (perfil «${profile}»).`,
    );
  }

  const blocked = config.android?.blockedPermissions ?? [];
  return {
    ...config,
    android: {
      ...config.android,
      blockedPermissions: allow ? blocked : [...blocked, 'android.permission.SYSTEM_ALERT_WINDOW'],
    },
  };
};
