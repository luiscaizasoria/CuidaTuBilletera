# Despliegue de la API a Cloudflare Workers

Guía operativa del despliegue continuo (CD) del Worker `controlgastos-api`. Complementa docs/001-CONSTITUCION.md (sección 10) y las decisiones registradas en docs/003-DECISIONES-FASE0.md.

## Estado

- El workflow `.github/workflows/deploy.yml` **se ejecutó dos veces con `workflow_dispatch` el 2026-10-11 (SHA `90ac2dd`, conclusión `success`)** y publicó el Worker `controlgastos-api` con el código de esa fecha: sin D1, sin variables y sin `JWT_SECRET`, por lo que solo `/health` es funcional. Verificado en solo lectura el 2026-10-19 (API pública de GitHub y `cwrangler deployments list`). El Environment `production` de GitHub existe (revisor requerido y solo `main`); sus secretos y variables no se pudieron comprobar sin sesión.
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

## Plan de lanzamiento v1.0 en Google Play (paso 386; PLAN, nada ejecutado)

Decisión y requisitos en docs/003 «Decisión L1»; alcance en docs/001 §3 y docs/004. v1.0 = funcionalidades originales + R0 a R6 + conciliación manual; F-A y F-B fuera. **Cada acción productiva requiere autorización expresa del usuario**; ningún secreto se imprime ni se guarda en el repositorio. Los comandos son orientativos y se confirman en la documentación vigente antes de ejecutarlos.

| Puerta | Condiciones previas | Acciones | Evidencias | Aprobación | Rollback | Autorización expresa |
| --- | --- | --- | --- | --- | --- | --- |
| **G0** Integrar Fase 6 | PR #17 | Confirmar `main` y CI; pasar los docs pendientes a una rama `chore/` desde `main`; descartar o ignorar `tsconfig.json` de la raíz | API de GitHub: `main` `a482048`, PR #17 fusionado, CI correcto (**ya cumplido**) | CI verde y árbol limpio | revert del PR de docs | Sí, para commit, push y PR de docs |
| **G1** Bloqueos de Play | G0 y decisiones (cuenta de Play, norma de eliminación, política, correo) | Aprobar la norma en docs/001 y 003; implementar `DELETE /me` (API), «Eliminar mi cuenta y mis datos» (app, sin pantallas nuevas) con pruebas (aislamiento, cascada completa con anulados y archivados, tokens inválidos tras borrar, doble llamada, error de red, relogin con perfil vacío); política de privacidad y página de eliminación en una URL pública; enlace a la política en la app; ficha: ícono 512, imagen destacada 1024×500, capturas reales sin datos personales, descripciones; cuenta de revisión | Pruebas verdes, `curl -I` 200 sin login a las dos URL, capturas, revisión de `mobile-ux-qa` | Usuario aprueba textos legales y norma | revertir los PR; deshabilitar Pages | Sí |
| **G2** Cloudflare PROD aprobado | G1 | Decidir estructura (nivel superior como producción recomendado, o `env.prod`); aprobar el cambio de `wrangler.jsonc` (D1 propia, `vars` GOOGLE_*, `observability`); política de `JWT_SECRET` (nuevo, ≥32 caracteres, distinto de DEV, custodia del usuario); token de CI con permisos mínimos | diff de configuración sin valores sensibles | Usuario aprueba cada operación | no aplicar | Sí |
| **G3** Backend PROD | G2 | `d1 create` (nombre propio); anotar bookmark de Time Travel; migraciones 0001 a 0005 (`migrations apply --remote`, con `list` antes y después; en una base vacía la 0005 inserta 0 filas); `secret put JWT_SECRET`; PR de `wrangler.jsonc`; «Deploy API» con aprobación del Environment; smoke tests: `/health`, 401 sin token con `no-store`, 413 y 400, login real con dos identidades `QA-A` y `QA-B` (0 fugas), cuenta nueva con 13 categorías, conciliación, reportes, exportación, `DELETE /me` con una tercera identidad, PDF de 2000 filas con `wrangler tail`, PROD no apunta a la D1 DEV | VersionId, bookmark, `migrations list`, resultados | Todo en verde; sin 5xx; aislamiento sin fugas | `cwrangler rollback <VERSION_ID>`; Time Travel y exportación previa para datos | Sí, por cada paso remoto |
| **G4** AAB de producción | G3 | Variables de EAS `production` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, visibilidad `plaintext`); PR de `eas.json` (`environment` en `preview` y `production`, perfil `production-apk`) y de `app.json` (`android.blockedPermissions` según el manifiesto real); upload key generada por EAS y respaldada; build `preview` (APK) con variables de producción; después build `production` (AAB; versionCode siguiente al remoto, que hoy es 2) | `eas build:list`; manifiesto de la AAB (`targetSdk` 36, permisos, sin `cleartext`); sin `devlauncher`; conteo del host DEV en el bundle = 0 | QA aprueba el checklist | no publicar el artefacto; build nueva con versionCode mayor | Sí, por cada build |
| **G5** Sin Metro | G4 | Instalar el APK equivalente y la pista de prueba interna de Play: ícono, nombre, splash, ausencia del launcher, login (sin `DEVELOPER_ERROR`; SHA-1 de la upload key y de la clave de firma de Play en el cliente OAuth Android), sesión tras cerrar la app, flujo completo con conciliación, reportes, exportación, eliminación de cuenta y relogin, modo avión | guion firmado por el usuario | sin crash; login con la firma de Play | detener la pista | Sí |
| **G6** Play Console | G5 | Seguridad de los datos, IARC, público objetivo (sin menores), anuncios «No», funciones financieras, categoría Finanzas, acceso de revisión con cuenta de prueba, ficha; primer upload manual; prueba cerrada si la cuenta lo exige (≥12 testers con opt-in, 14 días continuos; recomendable 15 a 20) con seguimiento diario y recogida de fallos (Android Vitals, informe previo al lanzamiento, formulario) | capturas de cada formulario aceptado, contador de testers | sin defectos altos o críticos abiertos | corregir y subir versionCode mayor | Sí |
| **G7** Producción | G6 | Solicitar acceso a producción; lanzamiento escalonado si se desea; revisar Android Vitals a las 48 h y `wrangler tail` | estado «disponible» en Play, sin picos de crash | umbrales de Vitals | pausar el despliegue; versionCode mayor | Sí |

Enlaces legales de la app (G1): las variables públicas opcionales `EXPO_PUBLIC_PRIVACY_POLICY_URL` y `EXPO_PUBLIC_ACCOUNT_DELETION_URL` (solo `https://`) se incrustan al empaquetar el JavaScript; sin una URL válida la app no muestra el enlace correspondiente y no se bloquea.

### Decisiones y calendario
Decisiones pendientes en docs/003 «Decisión L1». Ruta crítica: verificación de desarrollador, `DELETE /me` y política, 14 días de prueba cerrada si la cuenta es personal y posterior a noviembre de 2023 (por confirmar) y revisión de Google. Estimación orientativa: 5 a 7 semanas con prueba cerrada y 2 a 3 sin ella; reunir los testers es el riesgo más subestimado. El primer upload a Play siempre es manual; después `eas submit` con cuenta de servicio (JSON fuera del repositorio).

### Copias y rollback
- Worker: `cwrangler deployments list` y `cwrangler rollback <VERSION_ID> --message "motivo"`, o corregir hacia adelante con PR `fix:` o `revert:`; no revierte datos ni esquema.
- D1: exportar antes de cada migración (`d1 export ... --output` fuera del repositorio; contiene datos de usuarios) y registrar el bookmark de Time Travel (7 días en el plan gratuito, 30 en el de pago); migraciones compatibles hacia atrás.
- Android: el `versionCode` no baja; se corrige publicando uno mayor, o se pausa el despliegue.
- Credenciales: respaldo cifrado de la upload key y de las contraseñas fuera del repositorio; si se pierde la upload key, Play permite restablecerla.
- Pruebas especiales no bloqueantes pendientes: TalkBack, fuente ampliada, 320 dp, otros dispositivos y validación de ícono temático y splash en `preview`.

## Eliminación de datos por solicitud (procedimiento operativo, BORRADOR del paso 387; nada ejecutado)

Aplica a quien ya no tiene la app. Dentro de la app la eliminación se hace con `DELETE /me` (docs/003 «Decisión G1»). **No existe endpoint público que borre con solo un correo.** Plazo comprometido y correo de soporte: decisión del usuario (recomendado: acuse en 7 días y ejecución en 30 días como máximo).
1. Recepción: abrir un número de caso `ELIM-AAAAMMDD-n`; no copiar el contenido de la solicitud al repositorio.
2. Validar el correo antes de usarlo en SQL (`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`; `d1 execute --command` no admite parámetros).
3. Buscar: `SELECT id, created_at FROM users WHERE lower(email) = lower('<EMAIL>')` con `cwrangler d1 execute <DB> --remote --json --command ...` (con `--env dev` solo en DEV). 0 filas: responder que no hay datos y no borrar; más de 1: no borrar y pedir aclaración (el correo no es único; `google_sub` sí).
4. Verificar identidad: responder desde el buzón de soporte pidiendo que contesten **desde la misma dirección de su cuenta de Google** con la frase exacta «CONFIRMO ELIMINAR» y un código de un solo uso generado para el caso; comprobar SPF y DKIM en `Authentication-Results`; sin confirmación en 14 días, cerrar el caso.
5. Contar antes (cuentas, categorías, movimientos, `refresh_tokens` del `id` obtenido; el `id` sale del SELECT y se valida con expresión regular, nunca del correo del solicitante) y anotar el bookmark de `d1 time-travel info`.
6. Ejecutar un único archivo SQL revisado dos veces, fuera del repositorio, con cinco sentencias por `id`: `DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = '<ID>')`, `DELETE FROM categories WHERE account_id IN (...)`, `DELETE FROM accounts WHERE user_id = '<ID>'`, `DELETE FROM refresh_tokens WHERE user_id = '<ID>'`, `DELETE FROM users WHERE id = '<ID>'`, con `cwrangler d1 execute <DB> --remote --file <archivo>`. **La atomicidad de `--file` está por verificar** en DEV con un archivo que falle a mitad; mientras tanto el archivo es relanzable (de hijas a padres, idempotente).
7. Verificar (conteos en 0 y los demás usuarios sin cambios), registrar sin datos personales (caso, fechas, cifras por tabla, bookmark, resultado de la verificación de identidad; nunca correo, nombre ni identificadores), responder al solicitante y destruir el archivo SQL y el código. Los exports manuales de D1 que contengan datos de usuarios se eliminan al terminar.
