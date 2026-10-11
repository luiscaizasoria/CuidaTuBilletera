# Despliegue de la API a Cloudflare Workers

Guía operativa del despliegue continuo (CD) del Worker `controlgastos-api`. Complementa docs/001-CONSTITUCION.md (sección 10) y las decisiones registradas en docs/003-DECISIONES-FASE0.md.

## Estado

- El workflow `.github/workflows/deploy.yml` está **preparado pero nunca se ha ejecutado**. No existe aún cuenta, token ni Environment configurados.
- El despliegue es **exclusivamente manual** (`workflow_dispatch`). La activación automática desde `main` requiere una autorización futura y un registro en docs/003.
- La tarea "Configurar CD" del Roadmap sigue sin marcar hasta que exista un despliegue exitoso y verificado.

## Cómo funciona

1. Se ejecuta a mano desde la pestaña Actions → "Deploy API" → Run workflow, eligiendo la rama `main`.
2. El job solo se ejecuta si la referencia es `refs/heads/main`. En otra rama se omite.
3. El job usa el Environment `production`, que exige la aprobación de un revisor antes de empezar y es donde viven el token y las variables.
4. Comprueba que el SHA de la ejecución sigue siendo el último commit de `main`. Si `main` avanzó, falla y hay que volver a ejecutar.
5. Instala dependencias con `npm ci` y ejecuta lint, typecheck de la API, pruebas de la API y el build sin despliegue (`wrangler deploy --dry-run`). Estos pasos no usan credenciales.
6. Publica con la versión de Wrangler fijada en el lockfile (`npx --no-install wrangler deploy`), con `--message` (SHA y número de ejecución) y `--tag` (SHA corto).
7. Si `WORKER_URL` está configurada, comprueba `GET /health` y exige exactamente `{"status":"ok"}`.
8. Escribe un resumen con SHA, ejecución, actor, resultado de la publicación y resultado de la verificación HTTP.

El resumen distingue entre **publicación exitosa** y **verificación HTTP**. Si `WORKER_URL` no existe, la verificación queda como **PENDIENTE** y no se considera aprobada.

## Seguridad del workflow

- `permissions: contents: read`. No se necesita nada más.
- Solo `workflow_dispatch`. Ningún evento de `pull_request` puede alcanzar los secretos.
- `concurrency: deploy-production` sin cancelar, para evitar despliegues simultáneos.
- `actions/checkout` y `actions/setup-node` fijadas por SHA completo (verificado con la API de GitHub el 11/10/2026):
  - `actions/checkout` v7.0.1: `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `actions/setup-node` v7.1.0: `949feb2413d6458794dcd2491c4babbbce0c15c1`
- `ci.yml` sigue usando tags mayores; se deja sin cambios en esta tarea.
- `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` solo se exponen al paso "Publicar Worker". Los demás pasos no los reciben.
- No se usa `cloudflare/wrangler-action`: menos terceros con acceso al token.
- `workers_dev: true` y `preview_urls: false` en `api/wrangler.jsonc`, para que la exposición pública sea explícita y no se publiquen URLs de versiones previas.

## Configuración que debe hacer el propietario (no se hace desde el repositorio)

Ninguno de estos pasos se ha realizado. Nunca se comparten valores en el repositorio, en issues ni en chats.

### 1. Cuenta y token de Cloudflare

1. Tener una cuenta de Cloudflare (plan gratuito).
2. En el panel: Manage Account → Account API Tokens → Create Token.
3. Usar la plantilla "Edit Cloudflare Workers" y dejar solo los permisos de Workers necesarios.
4. Limitar los recursos de cuenta a la cuenta autorizada. No incluir zonas.
5. Definir una fecha de expiración.
6. Copiar el valor una sola vez y guardarlo directamente en GitHub (siguiente apartado).

Un token de Cloudflare no se puede limitar a un Worker individual: el mínimo práctico es el alcance de cuenta con permisos de Workers. Cuando existan migraciones de D1 (Fase 2) se evaluará añadir el permiso de D1 al token.

### 2. Environment `production` en GitHub

En el repositorio: Settings → Environments → New environment → `production`.

- **Required reviewers:** añadir al revisor.
- **Prevent self-review:** si el propietario es el único revisor, debe estar **desactivado**; de lo contrario nadie podría aprobar y el despliegue quedaría bloqueado. Con un único colaborador la aprobación es una pausa explícita contra errores, no un control independiente.
- **Deployment branches and tags:** "Selected branches and tags" y permitir solo `main`.
- **Environment secrets:** `CLOUDFLARE_API_TOKEN`.
- **Environment variables:**
  - `CLOUDFLARE_ACCOUNT_ID` (identificador de cuenta; no es secreto).
  - `WORKER_URL` (por ejemplo `https://controlgastos-api.<subdominio>.workers.dev`, sin barra final). Se conoce después de la primera publicación. Mientras no exista, la verificación HTTP queda pendiente.

### 3. Primer despliegue

1. Ejecutar el workflow desde `main`.
2. Aprobar el Environment.
3. Anotar la URL del Worker, configurar `WORKER_URL` y volver a ejecutar para que la verificación HTTP se ejecute y quede registrada.
4. Solo con una publicación exitosa y una verificación HTTP aprobada se puede actualizar el Roadmap.

## Rollback manual (no automatizado)

Opción A, desde la línea de comandos con credenciales del propietario:

1. Listar versiones: `npx wrangler deployments list` (dentro de `api/`).
2. Volver a una versión: `npx wrangler rollback <VERSION_ID> --message "motivo"`.

Opción B, corregir hacia adelante: el workflow solo publica el SHA vigente de `main`, por lo que no sirve para volver a un commit anterior. La vía es un Pull Request `fix:` o `revert:` hacia `main` y un nuevo despliegue manual.

Notas:

- El rollback del Worker no deshace cambios en datos. Hoy no hay base de datos; cuando exista D1 (Fase 2), las migraciones deberán ser compatibles hacia atrás.
- No se asume que `wrangler rollback` acepte `--yes`; no figura en la documentación.
- Si falla la verificación HTTP, la versión nueva ya está activa: hay que decidir manualmente entre corregir hacia adelante o volver atrás.

## Riesgos operativos

- `workers.dev` es público y `/health` no tiene autenticación. Solo devuelve `{"status":"ok"}`.
- El token tiene alcance de cuenta. Mitigaciones: expiración, almacenamiento únicamente en el Environment y rotación si hay sospecha de filtración.
- Los pasos de validación usan el lockfile; una dependencia comprometida en el CI podría alcanzar el paso de despliegue. Las acciones externas están fijadas por SHA.
- El tag `v7` de `ci.yml` es mutable. Pendiente de decisión.
- El parseo del identificador de versión desde la salida de Wrangler es informativo y puede no aparecer; la trazabilidad fiable es el SHA en `--message` y `--tag`.
- Los avisos de `npm audit` registrados en docs/003 afectan a herramientas de desarrollo, no al runtime del Worker.

## Límites del plan gratuito (verificados en la documentación de Cloudflare)

- 100.000 solicitudes al día (reinicio a medianoche UTC).
- 10 ms de CPU por solicitud.
- 50 subrequests por invocación.
- 100 Workers por cuenta.

Al exceder la cuota diaria, Cloudflare responde con el error 1027. El costo previsto es cero. Los límites cambian con el tiempo; verificarlos antes de cerrar decisiones de capacidad.

## Pendiente

- Entorno `dev` y D1: se añadirán en la Fase 2, con revisión arquitectónica y actualización previa de la documentación.
- Despliegue automático tras un CI verde en `main`: requiere autorización futura.
- Fijar por SHA las acciones de `ci.yml`: decisión aparte.
