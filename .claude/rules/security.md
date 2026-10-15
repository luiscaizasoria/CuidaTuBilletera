# Security Rules

## Objetivo

Reducir el riesgo de exponer credenciales durante el desarrollo asistido por Claude Code.

## Reglas obligatorias

- Los agentes nunca leen, copian, imprimen, registran ni incluyen credenciales reales en prompts, informes, commits ni documentos.
- Las plantillas `.env.example` y `.dev.vars.example` pueden consultarse solo mientras contengan exclusivamente marcadores no sensibles. Si una plantilla contiene un valor que parezca real, el agente no lo reproduce y avisa al usuario.
- Los secretos se gestionan con los mecanismos seguros del proveedor (secretos de Cloudflare y GitHub Secrets) y nunca se almacenan en el repositorio.
- Antes de agregar credenciales, modificar permisos sensibles (`permissions` de `.claude/settings.json`) o activar el sandbox, se solicita autorización expresa del usuario.

## Alcance y límites de los controles

- Las reglas `Read` de `.claude/settings.json` (todas en `deny`) cubren, en cualquier subdirectorio, `.env`, `.env.*`, `.dev.vars`, `.dev.vars.*`, `*.jks`, `*.keystore`, `*.pem`, `*.key` y `credentials*.json`.
- Los patrones `.env.*` y `.dev.vars.*` también alcanzan las plantillas `.env.example` y `.dev.vars.example`. Para mantenerlas legibles `settings.json` incluye `Read(!**/.env.example)` y `Read(!**/.dev.vars.example)` dentro de `deny`, pero **no está demostrado** que esas reglas con `!` funcionen como excepción (no están documentadas como tal). Hasta verificarlo con archivos señuelo en una sesión nueva, se debe asumir que las plantillas pueden quedar bloqueadas y no que estén garantizadas como legibles.
- Reforzar esta configuración sin negaciones (patrones explícitos por nombre) queda como mejora pendiente y requiere autorización expresa para modificar `permissions`.
- Esas reglas reducen el riesgo de exposición, pero no proporcionan aislamiento completo: no controlan procesos arbitrarios (scripts, `grep -r`, subprocesos) y `Grep` y `Glob` solo se cubren con el mejor esfuerzo. El aislamiento completo exige el sandbox, hoy desactivado.
- `.gitignore` evita incorporaciones accidentales de archivos no rastreados. No es un control de acceso: no impide leer un archivo ni protege uno que ya esté rastreado.
- Los cambios de `.claude/settings.json` se aplican al iniciar una sesión nueva. Se verifican con archivos señuelo inertes, nunca con credenciales reales.
