# Plan ejecutable de producción en Cloudflare (paso 406)

**Estado: PLAN con preparación LOCAL implementada (paso 407). No se ha creado, desplegado, migrado ni modificado ningún recurso remoto.** Lo ya implementado en el repositorio: `env.prod` en `api/wrangler.jsonc` con freno contra despliegue accidental, lista de clientes Android (`GOOGLE_ANDROID_CLIENT_IDS`), HTTPS obligatorio en la app, verificador de configuración y ajustes de workflows; ver los apartados 2 y 11 a 14. Cada fase que modifica algo remoto exige la autorización expresa del usuario en la conversación principal; ningún agente aprueba por otro. Complementa docs/006 (puertas G2 a G7) y docs/003 (Decisiones L1 y G1). Los comandos son orientativos y se confirman contra la documentación vigente antes de ejecutarlos; lo marcado **[NO VERIFICADO]** no se confirmó en documentación oficial. Fecha de las consultas a documentación: 2026-10-21 (revisar de nuevo las cifras críticas antes de cerrar G2).

## 1. Hechos del repositorio que condicionan el plan

- **Antes del paso 407** `api/wrangler.jsonc` solo definía `env.dev` y el nivel superior (`controlgastos-api`) no tenía D1 ni variables: un `wrangler deploy` sin `--env` publicaba un Worker sin base de datos (como los dos despliegues manuales del 2026-10-11). Hoy el nivel superior es un centinela y existe `env.prod` (apartado 2).
- Los bindings, `vars` y secretos **no se heredan** entre entornos de Wrangler. `deploy.yml` ejecutaba `wrangler deploy` sin `--env`; desde el paso 407 usa `--env prod`, con el Environment `production` de GitHub (revisor requerido).
- La API lee `DB`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` y `JWT_SECRET`.
- `app/eas.json` no define `environment` en `preview` ni `production`: hoy esos builds saldrían sin `EXPO_PUBLIC_*`. `app/app.json` no define `blockedPermissions`.
- La app incrusta `EXPO_PUBLIC_API_URL` al empaquetar; cambiarla exige un build nuevo.

## 2. Arquitectura propuesta

| Elemento | DEV (existe) | PROD (propuesto, no creado) |
| --- | --- | --- |
| Worker | `controlgastos-api-dev` (`--env dev`) | `controlgastos-api` (`--env prod`; el nivel superior es un centinela) |
| D1 | `controlgastos-db-dev` | `controlgastos-db`, **nueva**, nunca reutilizar el id de DEV |
| `JWT_SECRET` | secreto de DEV | secreto **distinto** (`wrangler secret put JWT_SECRET --env prod`; **nunca sin `--env`**: con el centinela crearía el secreto en el Worker `controlgastos-api-sin-entorno`), ≥ 32 caracteres, generado sin imprimirlo |
| Cliente OAuth Web (`aud`) | actual | propio de PROD (recomendado), mismo valor en el Worker y en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Cliente(s) OAuth Android (`azp`) | uno | uno por huella: upload key de EAS y firma de Play (ver §4, hallazgo B1) |
| Despliegue | manual con `cwrangler ... --env dev` | solo el workflow «Deploy API» (`--env prod`) con aprobación del Environment `production` |
| Migraciones | `d1 migrations apply` manual | manual, con la sesión del propietario, nunca con el token de CI |
| URL de la API | `controlgastos-api-dev.<subdominio>.workers.dev` | `workers.dev` (gratis) o dominio propio (decisión D3) |

Estructura **implementada localmente** en `api/wrangler.jsonc` (sin valores definitivos; los marcadores `REEMPLAZAR_*` se sustituyen en el PR de la fase F4):

- **Nivel superior (centinela):** solo `$schema`, `name: "controlgastos-api-sin-entorno"` y `compatibility_date`. Sin `main`, bindings, variables ni rutas. Verificado: `wrangler deploy` sin `--env` falla con «Missing entry-point». `rollback` o `deployments list` sin `--env` apuntarían al Worker inexistente `controlgastos-api-sin-entorno`, no al de producción. **Aviso:** `secret put` sin `--env` podría **crear** un Worker huérfano con ese nombre y guardar ahí el secreto (comportamiento exacto **[NO VERIFICADO]**): por eso todo comando de Worker o de secretos lleva `--env prod` o `--env dev`.
- **`env.dev`:** idéntico al actual (`controlgastos-api-dev`, D1 `controlgastos-db-dev`), con `main` explícito. Se comprobó con `unstable_readConfig` que `name`, `d1_databases`, `vars`, `workers_dev`, `preview_urls` y `compatibility_date` no cambiaron.
- **`env.prod`:** `name: "controlgastos-api"` (el nombre de un entorno no se concatena cuando `name` está fijado; medido, no solo leído), `main`, `workers_dev: true`, `preview_urls: false`, D1 `controlgastos-db` con `database_id: "REEMPLAZAR_CON_ID_D1_PROD"` y `vars` con `GOOGLE_WEB_CLIENT_ID` y `GOOGLE_ANDROID_CLIENT_IDS` como marcadores.
- **Nombre y URL efectivos de PROD:** Worker `controlgastos-api`, URL `https://controlgastos-api.luis-caiza-soria.workers.dev` (el subdominio de la cuenta contiene tu nombre). Desplegar con `--env prod` **reemplaza** el Worker existente del 2026-10-11: no crea uno nuevo ni deja un Worker huérfano (corrige una afirmación anterior de este plan).
- **Pruebas:** `api/wrangler.test.jsonc` (mínimo, sin ids ni vars) lo usa solo vitest, porque el plugin necesita un `main` y el nivel superior ya no lo tiene.
- **Tipos y scripts:** `api/worker-configuration.d.ts` está en `.gitignore` (se regenera); `types` y `typecheck` usan `wrangler types --env prod`; `build` pasa a `--env prod` y existe `build:dev`.
- **Verificador:** `npm run verificar:wrangler` (modo normal: acepta los marcadores e informa cuántos quedan; lo ejecuta CI) y `node scripts/verificar-config-wrangler.js --estricto` (lo ejecuta deploy.yml antes de publicar y **falla mientras queden marcadores**; exige UUID real, ids de Google con formato válido y que PROD no comparta D1 ni clientes con DEV). Usa `unstable_readConfig` de Wrangler 4.149.0, una API inestable.

Alternativa descartada: nivel superior = PROD (la recomendación anterior de este plan), porque un comando manual sin `--env` habría tocado producción.

## 3. Variables y secretos requeridos (sin valores)

| Nombre | Dónde | Tipo | Quién lo genera |
| --- | --- | --- | --- |
| `JWT_SECRET` | Worker PROD | secreto de Cloudflare | se genera localmente y viaja por tubería a `secret put`; no se imprime ni se guarda |
| `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID(S)` | `wrangler.jsonc` | variable pública | Google Cloud (usuario) |
| `CLOUDFLARE_API_TOKEN` | Environment `production` de GitHub | secreto | usuario, en el panel de Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID`, `WORKER_URL` | Environment `production` de GitHub | variables | usuario |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | EAS, entorno `production` (visibilidad `plaintext`: terminan dentro del bundle) | variables públicas | usuario; las URL legales solo cuando respondan 200 |

Token de CI de mínimo privilegio: token **personalizado** de cuenta con **Workers Scripts · Edit** únicamente, sin D1 ni zonas, con vencimiento (propuesta: 90 días y recordatorio 14 días antes). Si el primer despliegue pide otro permiso, añadir solo ese y documentarlo **[NO VERIFICADO si Wrangler necesita algo más]**. Las migraciones remotas las hace el propietario con su sesión de `cwrangler`.

## 4. Seguridad: hallazgos y decisiones de código (NO implementadas)

**Bloqueantes para un lanzamiento público**

- **B1. Política `azp` con Play App Signing.** `google-token-service.ts:67-72` acepta un solo `GOOGLE_ANDROID_CLIENT_ID`; con Play App Signing hay dos huellas (upload key de EAS y firma de Play) y, por tanto, dos clientes Android. Con un solo ID configurado, los usuarios de Play o los de los APK de EAS recibirían 401 `INVALID_TOKEN` (síntoma engañoso, no `DEVELOPER_ERROR`). Propuesta mínima: `GOOGLE_ANDROID_CLIENT_IDS` (lista separada por comas, parseo estricto, máximo 4, formato validado, configuración inválida = 500 `CONFIG_ERROR` y nunca degradar a «sin política»), con pruebas. `aud` sigue siendo el cliente Web, así que aceptar ambos no debilita la verificación. Alternativas: retirar la política `azp` (dejar `aud`) o un solo cliente con varias huellas **[NO VERIFICADO que Google lo admita]**. Requiere registro en docs/003.
- **B2. Sin mitigación de abuso.** `POST /auth/google` (sin sesión) crea usuarios y escribe filas; `POST /auth/refresh` y `GET /export` (PDF) son abusables. No hay rate limiting ni tope de usuarios. En `*.workers.dev` no hay zona, por lo que las reglas de WAF y de rate limiting de zona probablemente no aplican **[NO VERIFICADO de forma explícita]**. Mitigaciones mínimas posibles: Rate Limiting binding de Workers (disponibilidad en Free **[NO VERIFICADO]**), `MAX_USERS` como interruptor de emergencia, límite de exportaciones por usuario y alertas de uso. Con el plan Free, tráfico hostil puede agotar las 100.000 solicitudes diarias (error 1027 para todos).

**Medios**

- M1. `refresh_tokens` sin purga: cada rotación inserta una fila y nunca se borran las rotadas, expiradas o revocadas.
- M2. Exportación topada a 2000 filas (400 `EXPORT_TOO_LARGE`), sin límite de frecuencia ni tope de movimientos por usuario.
- M3. El access token de 15 min no se revoca en logout (sí cae al instante tras `DELETE /me`, porque el middleware relee `users`): riesgo residual aceptado.
- M4. `DELETE /me` admite repetir un ID token válido dentro de 300 s; el alcance es la misma cuenta. Riesgo bajo.
- M5. `readConfig` de la app (`config.ts`) **no exige `https://`** para `EXPO_PUBLIC_API_URL`; propuesta: `new URL`, protocolo `https:`, rechazar credenciales, query y hash, con pruebas, antes de G4.

**Correcto por diseño (verificado en código):** JWT HS256 con algoritmo fijado, issuer, audiencia v2 y secreto ≥ 32 caracteres; refresh opacos de 256 bits con solo su SHA-256 en la base y rotación con detección de reutilización; `DELETE /me` con `ELIMINAR`, ID token ≤ 300 s, mismo `sub` y borrado atómico; SQL parametrizado; límites de cuerpo (413) y esquemas Zod estrictos; errores genéricos; ningún `console.*` salvo `errors.ts:34` (solo el nombre del error); `Cache-Control: no-store` en los recursos con datos; sin CORS (adecuado para una app nativa, no añadir `*`); exportación aislada por `user_id`, con neutralización de fórmulas en el CSV, nombre de archivo solo con fechas validadas y `nosniff`. Código muerto a retirar: `session-service.ts` (JWT v1) si no tiene uso.

## 5. Costos y límites (consulta 2026-10-21; cifras oficiales, releer antes de decidir)

| Concepto | Workers Free | Workers Paid (desde USD 5/mes por cuenta) |
| --- | --- | --- |
| Solicitudes | 100.000/día (error 1027 al excederlo) | sin tope; 10 M/mes incluidos, USD 0,30 por millón extra |
| CPU por solicitud HTTP | 10 ms | 30 s por defecto (hasta 5 min) |
| Subrequests por invocación | 50 | 10.000 |
| D1: filas leídas / escritas | 5 M/día / 100.000/día | 25.000 M/mes / 50 M/mes incluidas, luego USD 0,001 y USD 1,00 por millón |
| D1: almacenamiento / bases | 5 GB / 10 | 5 GB incluidos, luego USD 0,75/GB-mes / 50.000 |
| Time Travel | 7 días | 30 días (siempre activo, no se puede desactivar) |
| Workers Logs (si se activa `observability`) | 3 días, 200.000 eventos/día | 7 días, 20 M eventos/mes incluidos |

CPU medida **localmente en Node** (orden de magnitud; Cloudflare mide distinto y no incluye el tiempo en D1): verificar un ID token RS256 ≈ 0,14 ms; firmar o verificar un JWT HS256 ≈ 0,12 a 0,15 ms; SHA-256 del refresh ≈ 0,07 ms; CSV de 2000 filas ≈ 1,5 ms; **PDF de 2000 filas ≈ 5,4 ms (p95 ≈ 6 ms), el 54 % del límite Free**, sin contar parseo, middleware, lecturas de D1 ni la diferencia entre V8 de workerd y Node. Un PDF de 10 000 filas (fuera del tope actual) ≈ 73 ms. **No se puede garantizar el PDF de 2000 filas en Free: hay que medirlo en Cloudflare** (panel de CPU time o `wrangler tail`; en workerd el reloj no avanza durante el cómputo, así que un `console.log` de `performance.now()` no sirve).

Aplicación a v1.0 (estimación propia): decenas a cientos de usuarios caben holgadamente en las cuotas Free de solicitudes y de D1. Los riesgos reales de Free son la CPU del PDF, el techo diario ante abuso, Time Travel de 7 días y logs de 3 días. Con Paid desaparecen el techo y el riesgo de CPU, el abuso pasa a ser un costo y Time Travel coincide con la frase pública «hasta 30 días».

## 6. Runbook por fases (cada fase requiere autorización previa)

**Checklist de inicio (no modifica nada remoto):** árbol limpio y rama `chore/` desde `main`; decisiones D1 a D9 registradas en docs/003; ventana de 2 a 3 horas sin otros PR avanzando `main`; sesión de `cwrangler` del propietario; inventario de solo lectura autorizado (`d1 list`, `deployments list`, secretos y variables del Environment `production`); tres identidades de prueba de Google (QA-A, QA-B, QA-C); procedimientos de retención activos (docs/006); historial del shell sin secretos.

| Fase | Autorización | Acciones | Evidencia de éxito | Abortar si | Rollback |
| --- | --- | --- | --- | --- | --- |
| **F1** Crear recursos | A1 (D1, ubicación, plan) | `d1 list`; `d1 create controlgastos-db` con `--location` o `--jurisdiction` (irreversible; la jurisdicción manda sobre el hint y no cambia después); sin `--update-config`; anotar UUID; cambio de plan solo en el panel por el usuario | `d1 info` con nombre y UUID | ya existe una base con datos o cuenta distinta | `d1 delete` (sin datos); la ubicación no se cambia: habría que crear otra |
| **F2** Secretos y variables | A2 (2a `JWT_SECRET`, 2b token, 2c GitHub) | `node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" \| cwrangler secret put JWT_SECRET --env prod` (**`--env prod` es obligatorio**; sin él se crearía el secreto en el Worker centinela `controlgastos-api-sin-entorno`; confirmar que `cwrangler` reenvía stdin **[NO VERIFICADO]**; si no, usar el prompt oculto); token personalizado (§3); `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `WORKER_URL` en el Environment `production`; comprobar *Prevent self-review* desactivado y ramas solo `main` | `secret list` con el nombre; token con vencimiento | el valor aparece en una salida, log o historial; token con permisos de zona o «Edit all» | rotar o borrar el secreto; revocar el token |
| **F3** Migraciones | A3 (base `controlgastos-db` con UUID) | `d1 info` y `d1 list`; `migrations list --remote` (5 pendientes); bookmark; `migrations apply controlgastos-db --remote` (el **nombre**, no el binding; sin `--env dev`); `migrations list` (0 pendientes); `SELECT name FROM sqlite_master`; bookmark | 5 tablas más `d1_migrations`; la 0005 inserta 0 filas | nombre o UUID distinto, migraciones ya aplicadas o mención de `controlgastos-db-dev` | Time Travel al bookmark o recrear la base (sin usuarios); nunca editar una migración aplicada |
| **F4** Despliegue | A4a (PR de `wrangler.jsonc`), A4b (ejecutar «Deploy API» y aprobar el Environment) | rama con la configuración PROD (revisión de `architect`); `deploy --dry-run --env prod`: debe mostrar `controlgastos-db` y no `-dev`; `--dry-run --env dev` debe mostrar lo de DEV; `--dry-run` sin `--env` debe FALLAR (centinela); merge con CI verde; workflow desde `main` | ejecución verde, `/health` = `{"status":"ok"}`, VersionId en `deployments list` | el dry-run de PROD muestra la D1 de DEV o ninguna; `main` avanzó | `rollback <VERSION_ID>` (la versión anterior es la del 2026-10-11, sin rutas con datos: equivale a apagar la API); no toca D1 |
| **F5** Smoke tests | A5 (escritura sintética en PROD, incluido un `DELETE /me` real) | `/health`; 401 sin token con `no-store`; 413 y 400; login QA-A y QA-B sin fugas (404 por id directo, reportes, exportación); cuenta nueva con 13 categorías; conciliación; reportes; CSV; **PDF de 2000 filas con CPU medida**; `DELETE /me` con QA-C (204, token y refresh en 401, 0 filas en las 5 tablas, otras cuentas intactas, relogin vacío); 0 respuestas 5xx; uso de cuota | tabla con estado HTTP y hora UTC, sin tokens | fuga entre identidades; 5xx reproducible; PDF fuera de CPU; aparece un secreto | apagar la API (§8); borrar los datos sintéticos con `DELETE /me` |
| **F6** Aislamiento | A6 (lecturas) | un access token de DEV contra PROD debe dar 401 (si da 200, rotar `JWT_SECRET` de PROD); los datos de DEV no aparecen en PROD y viceversa; UUID de las dos D1 distintos; `database_id` del nivel superior ≠ el de `env.dev`; `WORKER_URL` es la de PROD | cada punto verificado | cualquier cruce | apagar PROD y corregir `wrangler.jsonc` |
| **F7** Páginas legales | A7 (ejecutar `pages.yml` y aprobar `github-pages`) | recomendado **después de F1 a F6** para que lo publicado coincida con la configuración final; `curl -I` a las tres URL | 200 en las tres URL | alguna página contradice la configuración real | deshabilitar Pages o desplegar la corrección; no registrar URL en Play hasta que respondan 200 |
| **F8** EAS | A8 (variables) y PR de `eas.json` | `eas env:set` (o `env:create`, **[NO VERIFICADO]**) para las 4 variables en `production` (`plaintext`); `environment` en los perfiles; `preview` con los mismos valores; extraer el artefacto en un directorio nuevo y buscar el host de DEV (debe haber 0) y `http://` | `env:list`; 0 coincidencias del host DEV | host de DEV en el bundle; una URL no https; faltan variables | cambiar el valor y rehacer el build |
| **F9** AAB | A9 (build y upload key) | PR de `app.json` con `blockedPermissions` según el manifiesto real; upload key generada por EAS y respaldada; registrar en Google Cloud los clientes Android de **ambas** huellas; build `preview` (APK) y luego `production` (AAB, `versionCode` mayor que el remoto); inspeccionar el manifiesto (`targetSdk` 36, permisos, sin `cleartext`, sin dev launcher) | `eas build:list`, manifiesto limpio | `cleartext`, permiso no declarado, host DEV | el build no se «deshace»: no se sube; `versionCode` mayor |
| **F10** Google Play | A10 (cada envío) | ficha, política y URL de eliminación, Seguridad de los datos (coherente con el manifiesto), IARC, público objetivo (pendiente), cuenta de revisión, prueba interna y, si aplica, cerrada (≥ 12 testers y 14 días continuos para cuentas personales creadas desde 2023-11-13; confirmar la fecha de la cuenta) | formularios aceptados | `DEVELOPER_ERROR` en la pista de Play; contradicción con el manifiesto | pausar la pista; `versionCode` mayor |

## 7. Matriz de riesgos de operación

| Riesgo | Prob. | Impacto | Prevención |
| --- | --- | --- | --- |
| R1 Despliegue manual sin `--env` (cae en PROD y salta la aprobación del Environment) | Media | Alto | Nivel superior = centinela (el `deploy` sin `--env` falla con «Missing entry-point»); PROD solo por el workflow con `--env prod`; `--env dev` explícito; el dry-run muestra Worker y D1; valorar que `cwrangler` rechace `deploy` sin `--env` **[no revisado]** |
| R2 Migración a la base equivocada | Media | Alto | nombre explícito (no el binding), `d1 info` y UUID antes, leer el destino del prompt, `migrations list` antes y después |
| R3 Secretos en historial o logs | Media | Alto | tubería a `secret put`, sin `set -x` ni `export`, tokens de prueba en memoria |
| R4 Token de CI con demasiado alcance | Media | Alto | token personalizado, Workers Scripts Edit, sin D1, vencimiento |
| R5 `workers.dev` público, sin rate limiting, abuso de cuota | Alta | Medio | plan Paid, dominio propio con WAF, alertas, interruptor `MAX_USERS` (no implementado) |
| R6 CPU del PDF en Free | Media | Medio | medir en F5; Paid o bajar `MAX_EXPORT_ROWS` |
| R7 `refresh_tokens` sin purga | Media | Bajo | purga manual autorizada; mejora de código pendiente |
| R8 Login rechazado por `azp` o `DEVELOPER_ERROR` con Play App Signing | Alta | Alto | decidir D5 antes de F4 y F9; probar en la pista interna |
| R9 Datos reales en respaldos o exports | Baja | Medio | procedimiento de respaldos de docs/006 |
| R10 `WORKER_URL` apunta a DEV (el `/health` pasaría sobre el Worker equivocado) | Baja | Medio | comprobar en F2 y F6 |

## 8. Rollback general

1. **Worker:** `cwrangler deployments list --env prod` y `cwrangler rollback <VERSION_ID> --env prod --message "motivo"` (**siempre con `--env prod`**: sin él apuntan al Worker centinela), o PR `revert:` y nueva ejecución del workflow. No revierte datos, esquema ni (a comprobar) secretos.
2. **Apagar la API sin borrar datos, de menos a más drástico:** (a) rollback a la versión del 2026-10-11, que no tiene rutas con datos; (b) rotar `JWT_SECRET`, que solo invalida los access tokens de 15 minutos (**no** las sesiones: los refresh son opacos y viven en D1, así que para expulsar sesiones hay que revocar `refresh_tokens` en D1 o suspender la API; corrección del paso 407); (c) `workers_dev: false` y redesplegar, o desactivar el subdominio en el panel **[NO VERIFICADO el procedimiento]**; (d) borrar el Worker (no es la vía preferida; verificar antes el alcance sobre los recursos asociados). Con (a) a (c) los datos permanecen en D1.
3. **D1:** Time Travel (7 días Free, 30 Paid) con el bookmark anotado: restaurar sobrescribe la base y pierde lo escrito después; devuelve el bookmark previo para deshacerlo; **resucitaría datos de usuarios que ya eliminaron su cuenta**, por lo que habría que reaplicar las eliminaciones atendidas dentro de la ventana. Exportación previa a migraciones riesgosas, fuera del repositorio, máximo 7 días.
4. **EAS, Play y Pages:** un build no se revierte (se publica otro con `versionCode` mayor o se pausa la pista); las páginas se retiran deshabilitando Pages o revirtiendo el PR; las credenciales se rotan.

**Verificación en las 48 horas posteriores:** cada 6 horas el primer día y cada 12 el segundo, panel de Workers (solicitudes, 4xx y 5xx, CPU p50/p99, porcentaje de cuota), uso de D1, conteos de solo lectura por tabla para detectar altas anómalas, `deployments list` y `secret list`, Android Vitals, URL de `site/` en 200, `npm run respaldos:auditar` y los recordatorios de calendario creados.

## 9. Decisiones que debe tomar el usuario (con recomendación)

| # | Decisión | Opciones | Recomendación |
| --- | --- | --- | --- |
| D1 | Estructura de `wrangler.jsonc` | nivel superior = PROD, o `env.prod` | nivel superior = PROD (mantiene `deploy.yml` y la URL), con la disciplina `--env dev` |
| D2 | Plan de Cloudflare | Free con medición en F5, o Paid desde el inicio (USD 5/mes) | Paid como mínimo antes de abrir al público (G7); antes si el PDF o el login rozan 10 ms; coincide con la promesa «hasta 30 días» |
| D3 | URL de la API | `workers.dev` (gratis; subdominio de cuenta con tu nombre, sin WAF ni URL portable) o dominio propio | dominio propio si aceptas el costo; decidir **antes de F8** porque se incrusta en la app |
| D4 | Proyecto y clientes OAuth de Google | clientes nuevos de PROD (proyecto aparte o el mismo) | clientes nuevos de PROD; publicar la pantalla de consentimiento «En producción» |
| D5 | Política `azp` | lista `GOOGLE_ANDROID_CLIENT_IDS`, retirar `azp`, o un cliente con varias huellas | lista (cambio con pruebas, antes de F4) |
| D6 | `JWT_SECRET` | custodia | no conservarlo: si se pierde, se rota (invalida sesiones); registrarlo en docs/003 |
| D7 | Token de CI | alcance y vencimiento | personalizado, Workers Scripts Edit, 90 días |
| D8 | `observability` en PROD | activar o no, con `invocation_logs` y muestreo | no activar hasta revisar qué metadatos guarda; si se activa, actualizar la política (3 o 7 días) |
| D9 | Ubicación de D1 | `--location` o `--jurisdiction`, irreversible | decidir antes de F1; no debe contradecir la política («Cloudflare gestiona la ubicación; puede estar fuera de Ecuador») |
| D10 | Mitigaciones de abuso | rate limiting, `MAX_USERS`, tope de movimientos, purga | al menos alertas y un plan de apagado; implementar lo demás por separado con pruebas |
| D11 | Exigir `https` en `readConfig` | cambio pequeño con pruebas | hacerlo antes de G4 |

**Decisiones confirmadas por el usuario (paso 408):** estructura `env.prod` explícita (D1); Workers **Paid** antes de abrir al público (D2); API en `workers.dev` con `workers_dev` habilitado en PROD (D3); credenciales OAuth de producción independientes de DEV (D4); ubicación candidata de la D1 `enam`, **pendiente de aprobación final y de medir la latencia desde Ecuador**, y recordando que el hint no está garantizado y es irreversible (D9). Siguen pendientes: D5 (la lista de clientes Android ya está implementada; falta registrar las huellas y crear los clientes), D6 a D8, D10 y D11 (HTTPS ya implementado). Ningún recurso productivo se ha creado ni modificado.

Corrección pendiente de documentación: docs/003 (línea de Decisión L1 sobre el consentimiento en modo Testing) debe revisarse con la ayuda de Google (https://support.google.com/cloud/answer/15549945), que indica que las solicitudes limitadas a `openid`, `userinfo.email` y `userinfo.profile` quedan exentas de la lista de usuarios de prueba y de la caducidad de 7 días; aun así se recomienda publicar el consentimiento «En producción».

## 10. Cómo se produjo este plan

Revisión de solo lectura por `architect` (arquitectura y cifras oficiales), `backend-engineer` (seguridad de la API y CPU local, sin tocar el repositorio) y `devops-engineer` (runbook). No se ejecutó ninguna operación remota.

## 11. Google OAuth: clientes y `azp` (implementado localmente en el paso 407)

- `GOOGLE_ANDROID_CLIENT_IDS` (lista separada por comas) o, alternativamente, la variable heredada `GOOGLE_ANDROID_CLIENT_ID`; si ambas están definidas, la API responde 500 `CONFIG_ERROR` (ambigüedad). DEV sigue con la heredada, sin cambios. Sin ninguna de las dos, la política `azp` queda desactivada (comportamiento previo, para no romper `wrangler dev` local); **PROD la exige mediante `verificar:wrangler`**.
- Validación estricta de la lista: cada elemento con el formato `^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$` (≤ 128 caracteres, sensible a mayúsculas), sin vacíos (`a,,b` o coma final), sin duplicados, máximo 4, sin comodines ni espacios internos, y ninguno igual al cliente Web. Una configuración inválida nunca degrada a «sin política»: responde 500 genérico antes de leer el cuerpo, en `POST /auth/google` y en `DELETE /me`.
- Relación `aud` / `azp`: `aud` debe ser **exclusivamente** el cliente Web; si el token trae `azp` y hay lista, debe pertenecer a `[...lista, cliente Web]`; un `azp` ajeno es 401 `INVALID_TOKEN` en el login y 401 `REAUTH_REQUIRED` en `DELETE /me`. Añadir clientes Android no debilita `aud`, firma, caducidad, `iat`, `email_verified` ni el `sub`.
- **Configuración por contexto** (no se crearon credenciales en Google Cloud):
  - *Desarrollo:* cliente Android con el SHA-1 del keystore de depuración o del Development Build; variable heredada en `env.dev` y `.dev.vars`.
  - *EAS (APK `preview` / interno):* cliente Android con el SHA-1 de la **upload key** que EAS genera (respaldarla).
  - *Google Play App Signing:* cliente Android adicional con el SHA-1 de la **clave de firma de la app** que muestra Play Console (App integrity → App signing, solo tras el primer upload). Las instalaciones desde Play se firman con ella, por lo que `GOOGLE_ANDROID_CLIENT_IDS` de PROD lleva **dos** ids. Sin el segundo cliente, el login desde Play falla con `DEVELOPER_ERROR`. No se verificó que un mismo cliente admita varias huellas: no depender de ello. PROD no incluye el cliente de depuración. La app no cambia: usa solo `webClientId`.
  - Pendiente de comprobar en la prueba interna de Play, con un token real y sin registrarlo, que `azp` coincide con el cliente Android de la huella usada.

## 12. HTTPS en la app (implementado localmente en el paso 407)

`readConfig` (`app/src/lib/config.ts`) exige `https:` para `EXPO_PUBLIC_API_URL`. Solo se admite `http:` si `__DEV__` es verdadero **y** el host pertenece a la lista cerrada `localhost`, `127.0.0.1`, `10.0.2.2`; cualquier otra red local queda excluida. Se rechazan esquemas distintos, credenciales embebidas, `?`, `#`, `\`, espacios y caracteres de control; se normaliza la barra final. Una URL inválida produce `null` y la app muestra la pantalla de configuración ausente (su texto sigue nombrando las variables: ajustarlo requiere revisión de `mobile-ux-qa`, pendiente). Las URL reales de DEV no se tocaron. En Android 9 o superior el tráfico en claro está bloqueado por defecto; `app.json` no define `usesCleartextTraffic` ni `networkSecurityConfig`. Verificar en la AAB final con `bundletool dump manifest` (herramienta no instalada, requiere autorización). Usar `http://10.0.2.2` en un build de desarrollo puede fallar por esa misma regla: comprobarlo en dispositivo.

## 13. Abuso y disponibilidad (DISEÑO; solo se documenta, no se implementó)

- **Rate Limiting binding de Workers** (GA desde 2025-09-19; Wrangler ≥ 4.36.0, el proyecto usa 4.149.0): `ratelimits: [{ name, namespace_id, simple: { limit, period: 10 | 60 } }]` y `await env.X.limit({ key })`. Es aproximado, local a cada ubicación de Cloudflare, sin límite global, y una petición bloqueada sigue contando como invocación. **No evita el error 1027** ni los límites diarios y no sustituye a un WAF de zona (que probablemente no aplica a `workers.dev`). Disponibilidad en Free y precio: **[NO VERIFICADO]**; si Free no lo admite, el despliegue fallaría: confirmarlo antes de añadir `ratelimits` a `env.prod`, o hacerlo en un PR posterior. Usar `namespace_id` distintos para DEV, PROD y cada limiter. No se pueden inventar ids.
- **Rutas y llaves propuestas (cifras de partida, sin medir):** `POST /auth/google` y `POST /auth/refresh` por IP (`CF-Connecting-IP`; en redes móviles varias personas comparten IP, así que límites generosos), evaluados **antes** de leer el cuerpo y de verificar el JWT de Google; `DELETE /me` y `GET /export` por `user.id`. Un limiter de login y otro de uso autenticado bastan.
- **Respuesta:** `429` con `{"error":{"code":"RATE_LIMITED",...}}`, `Retry-After` (el período configurado) y `Cache-Control: no-store`; requiere ampliar `ApiError` para admitir cabeceras. El middleware debe ser no operativo si el binding no existe (pruebas y DEV) y abrirse ante un fallo del limiter, sin registrar datos.
- **La app ya maneja bien el 429** (revisado en el paso 407): 429 y 5xx se clasifican como `server`; no destruyen la sesión, no hay reintentos automáticos y el usuario ve «El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos.» (en `DELETE /me`, además «No se eliminó nada»). No se lee `Retry-After`; el copy no distingue un límite de uso de una caída (mejora opcional).
- **`MAX_USERS` (interruptor de emergencia):** variable entera comprobada solo al crear usuarios nuevos, con inserción condicionada en una sola sentencia para evitar carreras y respuesta 403 `REGISTRATION_CLOSED` (la app necesitaría un mensaje nuevo, con revisión de `mobile-ux-qa`). Valor y si es variable o secreto: decisión del usuario. Cambiar una variable exige PR y workflow; un secreto, solo `secret put`.
- **Límites de tamaño y procesamiento ya existentes:** cuerpo de 16 KiB en `/auth/*` y `/me` y de 4 KiB en recursos (413), esquemas Zod estrictos, exportación topada a 2000 filas (400 `EXPORT_TOO_LARGE`). Pendientes de decisión: tope de movimientos por usuario y frecuencia de exportación; purga de `refresh_tokens`.
- **Alertas:** no se confirmó ninguna alerta nativa de consumo de Workers o D1 en la lista de notificaciones de Cloudflare (la de «Usage Based Billing» no indica si cubre Workers o D1) ni la disponibilidad de Health Checks para `workers.dev`: **[NO VERIFICADO]**. Alternativas: revisión manual del panel (apartado 8), o un workflow programado de GitHub que consulte `/health` y `/me` (dependencia operativa nueva, decisión del usuario). Monitoreo sin datos personales: no activar `observability` hasta revisar qué guarda; conteos agregados de solo lectura.
- **Paid no es protección ilimitada:** quita el techo diario, pero el abuso pasa a ser un costo.
- **Suspensión segura (de menos a más drástico, conservando los datos):** (1) anotar el bookmark de Time Travel; (2) cerrar altas con `MAX_USERS` igual al número actual de usuarios; (3) endurecer los limiters; (4) revocar los `refresh_tokens` del usuario abusivo en D1 (su access cae en ≤ 15 min; rotar `JWT_SECRET` por sí solo no basta); (5) apagar la API pública con `workers_dev: false` y un nuevo despliegue, o rollback a la versión del 2026-10-11 (sin rutas con datos); (6) nunca borrar el Worker ni la D1 como respuesta.

## 14. D1: comandos preparados (NO ejecutar) y salvaguardas

- Crear: `wrangler d1 create controlgastos-db --location=enam` (sin `--update-config`; anotar el UUID con `d1 info`). Pistas válidas: `wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`; `sam`, `afr` y `me` no se admiten hoy. **El hint no está garantizado** («no garantiza que D1 se ejecute en la ubicación preferida»); si se indican jurisdicción y hint, manda la jurisdicción; no se documenta si el hint puede cambiarse después (asumir que no). `enam` es plausible por cercanía a Ecuador, pero **no hay cifras de latencia verificadas**: medirla en F5 desde Ecuador; si es inaceptable, el remedio es crear otra base y migrar datos antes de abrir al público.
- Migrar una base vacía: `wrangler d1 migrations list controlgastos-db --remote --env prod` (deben figurar 5 pendientes), luego `migrations apply controlgastos-db --remote --env prod`, leyendo el nombre y el UUID del aviso antes de confirmar, y `SELECT name FROM sqlite_master` para verificar. Que `--env` se admita en `d1 migrations` **[NO VERIFICADO]**. Las migraciones 0001 a 0005 se aplican en orden; la 0005 inserta 0 filas en una base vacía; ninguna es «down».
- **Prohibiciones:** nunca cargar datos de DEV en PROD (ni `d1 export` o `execute --file` de DEV contra PROD, ni restaurar PROD desde un bookmark o export de DEV). Todo comando D1 remoto declara `--env` y el nombre de la base; el verificador impide que PROD comparta D1 con DEV.
- **Time Travel:** 7 días (Free) o 30 (Paid); siempre activo; restaurar es destructivo y devuelve un bookmark para deshacerlo. Restaurar PROD es un último recurso con autorización expresa. **Riesgo:** puede resucitar perfiles eliminados; las eliminaciones desde la app no dejan registro por diseño, por lo que no podrían reaplicarse (las solicitudes por correo sí figuran en la hoja de control). Un registro de eliminaciones con el hash del `google_sub` permitiría reaplicarlas, pero conserva un seudónimo del usuario y contradice la política de borrado: no se recomienda sin decisión expresa.

## 15. `DELETE /me`: la limitación de `iat` y alternativas (DISEÑO; no se implementó nada)

Un ID token con `iat` ≤ 300 s no demuestra una autenticación interactiva reciente: el SDK heredado (`@react-native-google-signin/google-signin` 16.1.5, API original) no expone `nonce`, y `auth_time` no es fiable. El escenario residual real exige control del dispositivo o de la app (un JWT o refresh robado no basta). Alternativas evaluadas:

| Alternativa | Qué aporta | Costos y riesgos |
| --- | --- | --- |
| (a) nonce HMAC sin estado | prueba que el token se emitió después de un desafío del servidor | necesita un SDK que acepte `nonce`: imposible con 16.1.5 |
| (b) API universal / Credential Manager de la misma librería | nonce probable y SDK vigente | la página de la librería indica que esa funcionalidad es de la **versión con licencia**; precio y soporte de nonce **[NO VERIFICADO]**; cambia el flujo de login (riesgo alto) |
| (c) OIDC con código en Custom Tab | autenticación en navegador | secreto del cliente Web en el Worker, redirect y PKCE; Google no documenta `prompt=login` ni `max_age`, así que no garantiza autenticación interactiva: no recomendada |
| (d) confirmación diferida de 24 a 72 h con aviso | la más fuerte contra token robado: el titular puede cancelar | cambia la norma de eliminación inmediata (docs/001 primero), requiere estado en D1, tarea programada y correo; no recomendada para v1.0 |
| (e) biometría o PIN del dispositivo antes del selector | prueba de presencia local (no verificable por el servidor) | dependencia nueva (`expo-local-authentication`, detalles **[NO VERIFICADO]**), una pantalla del sistema más |

**Propuesta por capas (no depende solo de `iat`):** capa 0, vigente: sesión + confirmación `ELIMINAR` + `sub` coincidente + `iat` ≤ 300 s + borrado atómico; añadir el limitador de `DELETE /me` por `user.id` (apartado 13) y mantener el texto honesto («verificación de identidad con Google», no «reautenticación»). Capa 1, decisión del usuario: (e) como prueba de presencia, para v1.0 o v1.1. No recomendadas para v1.0: (b), (c) y (d). Si se adopta (e), actualizar primero docs/001 (§7 menciona «reautenticarse con Google»), registrar la dependencia en docs/003 y revisar con `mobile-ux-qa`. Para v1.0, aceptar la capa 0 con la limitación explícita requiere tu decisión. Alternativa futura: si la librería pasara a una API con nonce, añadir (a) encima.

## 16. Pendientes de seguridad, por separado (paso 408)

**A. Protección ante abuso (no implementada; sin autorización de implementación):**
1. Rate limiting de autenticación (`POST /auth/google`, `POST /auth/refresh`) y de exportaciones (`GET /export`) con el binding de Workers; confirmar antes su disponibilidad en el plan, los valores de partida y el manejo de `429` con `Retry-After` (apartado 13). Hay que ampliar `ApiError` para admitir cabeceras.
2. Alertas de consumo (solicitudes, CPU, filas de D1 y errores 5xx): no se confirmó ninguna alerta nativa; decidir revisión manual o un monitor programado.
3. Posible límite temporal de usuarios (`MAX_USERS`) durante las pruebas y el arranque: **no se implementa sin autorización expresa** del usuario, junto con su valor, si es variable o secreto y el mensaje 403 de la app.
4. Purga de `refresh_tokens` y tope de movimientos por usuario (apartado 4).

**B. `DELETE /me` — limitación de reautenticación interactiva:** un ID token con `iat` ≤ 300 s acredita que quien llama controla en ese momento una sesión de Google de la **misma cuenta**, pero no demuestra una autenticación interactiva reciente (el SDK heredado no admite `nonce` y `auth_time` no es fiable). **Este punto NO se declara aprobado para el lanzamiento público**: sigue pendiente la decisión expresa del usuario de aceptar el riesgo residual o de adoptar la capa adicional (biometría o PIN del dispositivo, que exige una dependencia nueva y no se ha añadido). Mientras tanto se mantiene la verificación actual, el texto honesto («verificación de identidad con Google») y la constancia en docs/003 y docs/011 §15. No se añadió biometría ni ninguna dependencia nueva.

## 17. Estado de F4 y despliegue seguro en dos fases

**F4 completada (primer despliegue, manual):** se hizo con `wrangler versions upload` y `wrangler versions deploy`, no con el workflow. Versión activa `0cd20e94-64e2-4675-9c2a-a8a1615e2538`, deployment `288a162b-dee9-44fb-b4ea-e67e3bf90c00` (evidencia ya registrada en la conversación del proyecto; el workflow aún no se ha usado para PROD).

**Workflow en dos fases (implementado en local, NO ejecutado):** `.github/workflows/deploy.yml` pasa a `fase = preparar | activar` (detalle en docs/006). `preparar` sube una versión sin tráfico y la verifica con `scripts/verificar-version-prod.js`; `activar` exige el Environment `production-activate`, vuelve a verificar la versión y solo entonces la activa al 100 %. Sin rollback automático.

**Configuración manual de GitHub PENDIENTE (la hace el propietario; ninguna se ha hecho):**

1. Crear el Environment `production-activate` con **revisores requeridos** y **ramas permitidas solo `main`**.
2. Crear en ese Environment el secreto `CLOUDFLARE_API_TOKEN` (exclusivo del Environment, no de repositorio) y las variables `CLOUDFLARE_ACCOUNT_ID` y `WORKER_URL`.
3. Verificar que el Environment `production` conserva su secreto y variables para la fase `preparar`.

El workflow **bloquea la fase `activar`** (paso guardia, antes de usar el token) si el Environment no tiene revisores requeridos y restricción de ramas, o si no se puede leer.

**Verificado en F4 con lecturas reales (versión `0cd20e94`):** formato de `versions view --json` (incluido `workers/triggered_by = "version_upload"`), de `deployments status --json` y la línea `Worker Version ID: <uuid>` de `versions upload`.

**NO VERIFICADO:** la ejecución real del workflow; la lectura de la protección del Environment con `GITHUB_TOKEN` y `actions: read`; y que un Environment referenciado e inexistente se cree sin protección (es la razón del paso guardia y del secreto exclusivo del Environment).

**Límites conocidos de los controles:**

- El guardia no verifica que la política de ramas sea solo `main` (acepta cualquier política personalizada o ramas protegidas), ni `can_admins_bypass` ni `prevent_self_review`.
- El verificador no puede comprobar el contenido del código subido: solo bindings, anotaciones, `compatibility_date` y tráfico.
- Quien posea un token de Cloudflare con permisos de Workers podría subir una versión con las mismas anotaciones (`prep <SHA> ...`, `version_upload`) y que pase la verificación.
- La fase `activar` exige `WORKER_URL`; sin ella el job termina en rojo después de activar (sin rollback automático).

## 18. Estado de F8 y F9 (AAB, 2026-10-22)

- **F8 (EAS):** las cuatro variables `EXPO_PUBLIC_*` existen en el entorno `production` (visibilidad pública); `eas.json` define `environment` en `preview` y `production`. Corrige el §1: `app.json` ya define `blockedPermissions` y `eas.json` ya define `environment`.
- **F9 (AAB):** build `2655c67d-ba26-4d16-9ea0-c417cf3431ec`, commit `65f11f81cbde5562693068b8524fae670c174777`, versionCode 4, targetSdk 36. Permisos verificados en el manifiesto del AAB: sin `VIBRATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `USE_BIOMETRIC`, `USE_FINGERPRINT` ni `SYSTEM_ALERT_WINDOW`; con `INTERNET`. Sin referencias a la API de DEV, solo la API y el cliente Web de producción, URL legales correctas. Firma de subida: SHA-1 `26:E4:…:73:F4` (coincide en inicio y fin con la registrada).
- **Pendiente:** subida a Play Console (no realizada), prueba en dispositivo y la validación E2E de OAuth con Play App Signing (R8 sigue abierto).
