# Plan ejecutable de producción en Cloudflare (paso 406)

**Estado: PLAN. No se ha creado, desplegado, migrado ni modificado ningún recurso remoto.** Cada fase que modifica algo remoto exige la autorización expresa del usuario en la conversación principal; ningún agente aprueba por otro. Complementa docs/006 (puertas G2 a G7) y docs/003 (Decisiones L1 y G1). Los comandos son orientativos y se confirman contra la documentación vigente antes de ejecutarlos; lo marcado **[NO VERIFICADO]** no se confirmó en documentación oficial. Fecha de las consultas a documentación: 2026-10-21 (revisar de nuevo las cifras críticas antes de cerrar G2).

## 1. Hechos del repositorio que condicionan el plan

- `api/wrangler.jsonc` solo define `env.dev`. El nivel superior (`controlgastos-api`) **no tiene D1 ni variables**: un `wrangler deploy` sin `--env` publica hoy un Worker sin base de datos (como los dos despliegues manuales del 2026-10-11).
- Los bindings, `vars` y secretos **no se heredan** entre entornos de Wrangler. `deploy.yml` ejecuta `wrangler deploy` sin `--env` (nivel superior) con el Environment `production` de GitHub (revisor requerido).
- La API lee `DB`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` y `JWT_SECRET`.
- `app/eas.json` no define `environment` en `preview` ni `production`: hoy esos builds saldrían sin `EXPO_PUBLIC_*`. `app/app.json` no define `blockedPermissions`.
- La app incrusta `EXPO_PUBLIC_API_URL` al empaquetar; cambiarla exige un build nuevo.

## 2. Arquitectura propuesta

| Elemento | DEV (existe) | PROD (propuesto, no creado) |
| --- | --- | --- |
| Worker | `controlgastos-api-dev` (`--env dev`) | `controlgastos-api` (nivel superior de `wrangler.jsonc`) |
| D1 | `controlgastos-db-dev` | `controlgastos-db`, **nueva**, nunca reutilizar el id de DEV |
| `JWT_SECRET` | secreto de DEV | secreto **distinto** (`wrangler secret put` sin `--env`), ≥ 32 caracteres, generado sin imprimirlo |
| Cliente OAuth Web (`aud`) | actual | propio de PROD (recomendado), mismo valor en el Worker y en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Cliente(s) OAuth Android (`azp`) | uno | uno por huella: upload key de EAS y firma de Play (ver §4, hallazgo B1) |
| Despliegue | manual con `cwrangler ... --env dev` | solo el workflow «Deploy API» con aprobación del Environment `production` |
| Migraciones | `d1 migrations apply` manual | manual, con la sesión del propietario, nunca con el token de CI |
| URL de la API | `controlgastos-api-dev.<subdominio>.workers.dev` | `workers.dev` (gratis) o dominio propio (decisión D3) |

Diff de configuración propuesto (sin valores sensibles; `database_id` es un marcador):

```jsonc
{
  "name": "controlgastos-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,          // revisar según D3
  "preview_urls": false,
  // "observability": { ... }   // solo si el usuario lo decide (D8)
  "d1_databases": [
    { "binding": "DB", "database_name": "controlgastos-db", "database_id": "<ID_D1_PROD>", "migrations_dir": "migrations" }
  ],
  "vars": {
    "GOOGLE_WEB_CLIENT_ID": "<CLIENTE_WEB_PROD>",
    "GOOGLE_ANDROID_CLIENT_ID": "<CLIENTE_ANDROID_PROD>"   // o GOOGLE_ANDROID_CLIENT_IDS si se adopta la lista (D5)
  },
  "env": { "dev": { /* sin cambios; fijar explícitamente lo que no deba heredar */ } }
}
```

Alternativa `env.prod`: más segura frente a un despliegue accidental sin `--env` (el nivel superior quedaría sin bindings y fallaría de forma visible), pero cambia `deploy.yml` (`--env prod`), el nombre (`controlgastos-api-prod`) y la URL, y deja huérfano el Worker antiguo. Con nivel superior = PROD hay que respetar: **todo despliegue a DEV lleva `--env dev`; PROD solo por el workflow**.

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
| **F2** Secretos y variables | A2 (2a `JWT_SECRET`, 2b token, 2c GitHub) | `node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" \| cwrangler secret put JWT_SECRET` (sin `--env` = PROD; confirmar que `cwrangler` reenvía stdin **[NO VERIFICADO]**; si no, usar el prompt oculto); token personalizado (§3); `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `WORKER_URL` en el Environment `production`; comprobar *Prevent self-review* desactivado y ramas solo `main` | `secret list` con el nombre; token con vencimiento | el valor aparece en una salida, log o historial; token con permisos de zona o «Edit all» | rotar o borrar el secreto; revocar el token |
| **F3** Migraciones | A3 (base `controlgastos-db` con UUID) | `d1 info` y `d1 list`; `migrations list --remote` (5 pendientes); bookmark; `migrations apply controlgastos-db --remote` (el **nombre**, no el binding; sin `--env dev`); `migrations list` (0 pendientes); `SELECT name FROM sqlite_master`; bookmark | 5 tablas más `d1_migrations`; la 0005 inserta 0 filas | nombre o UUID distinto, migraciones ya aplicadas o mención de `controlgastos-db-dev` | Time Travel al bookmark o recrear la base (sin usuarios); nunca editar una migración aplicada |
| **F4** Despliegue | A4a (PR de `wrangler.jsonc`), A4b (ejecutar «Deploy API» y aprobar el Environment) | rama con la configuración PROD (revisión de `architect`); `deploy --dry-run` sin `--env`: debe mostrar `controlgastos-db` y no `-dev`; `--dry-run --env dev` debe mostrar lo de DEV; merge con CI verde; workflow desde `main` | ejecución verde, `/health` = `{"status":"ok"}`, VersionId en `deployments list` | el dry-run de PROD muestra la D1 de DEV o ninguna; `main` avanzó | `rollback <VERSION_ID>` (la versión anterior es la del 2026-10-11, sin rutas con datos: equivale a apagar la API); no toca D1 |
| **F5** Smoke tests | A5 (escritura sintética en PROD, incluido un `DELETE /me` real) | `/health`; 401 sin token con `no-store`; 413 y 400; login QA-A y QA-B sin fugas (404 por id directo, reportes, exportación); cuenta nueva con 13 categorías; conciliación; reportes; CSV; **PDF de 2000 filas con CPU medida**; `DELETE /me` con QA-C (204, token y refresh en 401, 0 filas en las 5 tablas, otras cuentas intactas, relogin vacío); 0 respuestas 5xx; uso de cuota | tabla con estado HTTP y hora UTC, sin tokens | fuga entre identidades; 5xx reproducible; PDF fuera de CPU; aparece un secreto | apagar la API (§8); borrar los datos sintéticos con `DELETE /me` |
| **F6** Aislamiento | A6 (lecturas) | un access token de DEV contra PROD debe dar 401 (si da 200, rotar `JWT_SECRET` de PROD); los datos de DEV no aparecen en PROD y viceversa; UUID de las dos D1 distintos; `database_id` del nivel superior ≠ el de `env.dev`; `WORKER_URL` es la de PROD | cada punto verificado | cualquier cruce | apagar PROD y corregir `wrangler.jsonc` |
| **F7** Páginas legales | A7 (ejecutar `pages.yml` y aprobar `github-pages`) | recomendado **después de F1 a F6** para que lo publicado coincida con la configuración final; `curl -I` a las tres URL | 200 en las tres URL | alguna página contradice la configuración real | deshabilitar Pages o desplegar la corrección; no registrar URL en Play hasta que respondan 200 |
| **F8** EAS | A8 (variables) y PR de `eas.json` | `eas env:set` (o `env:create`, **[NO VERIFICADO]**) para las 4 variables en `production` (`plaintext`); `environment` en los perfiles; `preview` con los mismos valores; extraer el artefacto en un directorio nuevo y buscar el host de DEV (debe haber 0) y `http://` | `env:list`; 0 coincidencias del host DEV | host de DEV en el bundle; una URL no https; faltan variables | cambiar el valor y rehacer el build |
| **F9** AAB | A9 (build y upload key) | PR de `app.json` con `blockedPermissions` según el manifiesto real; upload key generada por EAS y respaldada; registrar en Google Cloud los clientes Android de **ambas** huellas; build `preview` (APK) y luego `production` (AAB, `versionCode` mayor que el remoto); inspeccionar el manifiesto (`targetSdk` 36, permisos, sin `cleartext`, sin dev launcher) | `eas build:list`, manifiesto limpio | `cleartext`, permiso no declarado, host DEV | el build no se «deshace»: no se sube; `versionCode` mayor |
| **F10** Google Play | A10 (cada envío) | ficha, política y URL de eliminación, Seguridad de los datos (coherente con el manifiesto), IARC, público objetivo (pendiente), cuenta de revisión, prueba interna y, si aplica, cerrada (≥ 12 testers y 14 días continuos para cuentas personales creadas desde 2023-11-13; confirmar la fecha de la cuenta) | formularios aceptados | `DEVELOPER_ERROR` en la pista de Play; contradicción con el manifiesto | pausar la pista; `versionCode` mayor |

## 7. Matriz de riesgos de operación

| Riesgo | Prob. | Impacto | Prevención |
| --- | --- | --- | --- |
| R1 Despliegue manual sin `--env` (cae en PROD y salta la aprobación del Environment) | Media | Alto | Nivel superior = PROD; PROD solo por el workflow; `--env dev` explícito; el dry-run muestra Worker y D1; valorar que `cwrangler` rechace `deploy` sin `--env` **[no revisado]** |
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

1. **Worker:** `cwrangler deployments list` y `cwrangler rollback <VERSION_ID> --message "motivo"`, o PR `revert:` y nueva ejecución del workflow. No revierte datos, esquema ni (a comprobar) secretos.
2. **Apagar la API sin borrar datos, de menos a más drástico:** (a) rollback a la versión del 2026-10-11, que no tiene rutas con datos; (b) rotar `JWT_SECRET`, que invalida todas las sesiones; (c) `workers_dev: false` y redesplegar, o desactivar el subdominio en el panel **[NO VERIFICADO el procedimiento]**; (d) borrar el Worker (no es la vía preferida; verificar antes el alcance sobre los recursos asociados). Con (a) a (c) los datos permanecen en D1.
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

Corrección pendiente de documentación: docs/003 (línea de Decisión L1 sobre el consentimiento en modo Testing) debe revisarse con la ayuda de Google (https://support.google.com/cloud/answer/15549945), que indica que las solicitudes limitadas a `openid`, `userinfo.email` y `userinfo.profile` quedan exentas de la lista de usuarios de prueba y de la caducidad de 7 días; aun así se recomienda publicar el consentimiento «En producción».

## 10. Cómo se produjo este plan

Revisión de solo lectura por `architect` (arquitectura y cifras oficiales), `backend-engineer` (seguridad de la API y CPU local, sin tocar el repositorio) y `devops-engineer` (runbook). No se ejecutó ninguna operación remota.
