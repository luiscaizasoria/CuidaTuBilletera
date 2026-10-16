# Roadmap del Proyecto ControlGastos

## Estado actual

Fase actual:
Fase 2A - D1, usuarios y sesiones (en curso). La subfase 2A.1 (API) tiene su evidencia registrada con un pendiente de pruebas remotas; la subfase 2A.2 (Android) está validada en dispositivo con pendientes (cambio de cuenta, 409 en dispositivo y PR). Detalle y evidencia en «Plan de ejecución de Fase 2».

Nomenclatura: «subfase 2A.1/2A.2» designa los bloques de este plan. Los encabezados «Fase 2A.1 … 2A.7» de docs/003 son decisiones numeradas (Decisión 2A.1 … 2A.7) y no equivalen a estas subfases.

Objetivo de la fase actual:
Persistir usuarios y sesiones en Cloudflare D1, con refresh tokens rotados de forma atómica, según docs/001-CONSTITUCION.md y docs/003-DECISIONES-FASE0.md.

Historial de fases:

- Fase 0 - Preparación del proyecto: completada. Objetivo: construir la base técnica, arquitectura y gobernanza necesaria antes del desarrollo funcional.
- Fase 1 - Autenticación con Google: completada funcionalmente. Es una implementación transitoria sin D1; los pendientes de seguimiento están en la sección Fase 1 y en docs/003.

---

# Fase 0 - Preparación

## Gobernanza Claude Code

[x] CLAUDE.md actualizado.
[x] Documentación del proyecto organizada.
[x] Convención Markdown definida.
[x] Agentes iniciales creados.
[x] Reglas iniciales creadas.
## Estado herramientas IA

Claude Code:
Configurado.

MCP:
- Claude Docs conectado.

Agents:
- orchestrator
- architect
- backend-engineer
- qa-engineer
- devops-engineer
- mobile-engineer
- mobile-ux-designer
- mobile-visual-designer
- mobile-ux-qa

Rules:
- architecture
- workflow
- quality
- project-state
- security

## Infraestructura base

[x] Validar estructura monorepo.
[x] Crear Worker mínimo.
[x] Configurar pruebas API.
[x] Configurar CI.
[x] Configurar CD (despliegues).
[x] Crear proyecto Expo base.
[x] Configurar Dev Container.

Nota CD: validado con el workflow `Deploy API #2` (ejecución 38175964135), estado Success, rama `main`, commit `90ac2dd`. Publicó el Worker `controlgastos-api` en Cloudflare (versión `2657d6c3-e636-433f-89c8-85551d710f03`), con pruebas de la API 3/3 aprobadas y verificación automática de `GET /health` aprobada.

Nota Dev Container: configuración en `.devcontainer/` y `docs/005-DEVCONTAINER.md`, instalada y validada satisfactoriamente.

Evidencias de validación del Dev Container:

- Docker Desktop 4.95.0 y Docker Engine 29.8.2, con Ubuntu sobre WSL 2.
- VS Code conectado al Dev Container `ControlGastos @ desktop-linux`; usuario `node` y directorio `/workspaces/ControlGastos` verificados.
- Node.js 22.16.0, npm 10.9.2 y Git 2.49.0 disponibles; dependencias principales accesibles.
- Pruebas de API con Vitest: 3/3 aprobadas.
- `npm run typecheck --workspace api`: correcto.
- `npm run lint`: correcto.
- `npm run build --workspace api`: correcto mediante Wrangler `--dry-run`, sin desplegar en Cloudflare.

---

# Fase 1 - Autenticación

Estado: los cuatro objetivos están validados funcionalmente en un teléfono Android real (development build, API `controlgastos-api-dev`) y cubiertos por pruebas automatizadas (API 42, app 56). Quedan pendientes de seguimiento, sin bloquear el cierre funcional: la causa del HTTP 401 previo a la renovación y la inspección directa de `iat`/`exp`. Implementación transitoria sin D1, ver `docs/003-DECISIONES-FASE0.md`.

[x] Login Google.
[x] Validación token.
[x] Gestión sesión.
[x] Logout.

Evidencia en el teléfono (verificada manualmente):

- **Login Google**: exitoso tras corregir la SHA-1 del cliente OAuth Android (ver `docs/003-DECISIONES-FASE0.md`).
- **Validación token**: la API de pruebas validó el ID token de Google, emitió su JWT propio y la app mostró la sesión iniciada.
- **Gestión sesión**:
  - Cerrar y reabrir la app recuperó la sesión guardada.
  - Tras 16 minutos (el JWT dura 15) la app siguió mostrando la sesión iniciada sin pedir login.
  - Tras casi una hora sin usarla, al reabrir apareció directamente «Sesión iniciada» sin pulsar «Ingresar con Google». Cloudflare registró dos `POST /auth/google`: primero HTTP 401 y después HTTP 200. La renovación silenciosa quedó validada funcionalmente.
- **Logout**: «Cerrar sesión» y reabrir desde Expo devolvió a la pantalla de login.

Alcance de la validación de la renovación:

- Es una validación **funcional**: la sesión se recuperó sin intervención y la API aceptó el intercambio (HTTP 200).
- **No** se inspeccionaron directamente los claims `iat` y `exp` del JWT nuevo frente al anterior.
- El HTTP 401 previo al 200 **tiene causa aún no determinada** (ver `docs/003-DECISIONES-FASE0.md`).

---

# Fase 2 - Cuentas y categorías

[ ] Modelo usuarios.
[ ] Cuentas.
[ ] Categorías.
[ ] Categorías iniciales.

---

# Fase 3 - Movimientos

[x] Crear ingresos. Implementado y probado en local (Decisión 3.1 de docs/003).
[x] Crear gastos. Implementado y probado en local.
[x] Historial. Implementado y probado en local (paginación 20/100, orden fecha DESC, created_at DESC, id DESC).
[x] Filtros. Tipo, categoría y rango de fechas, implementados y probados en local.
[x] Edición, anulación lógica y saldo calculado (`saldo` en cuentas y `GET /accounts/:id/balance`).

Estado del primer incremento (rama `feat/fase3-movimientos`, sin commit; Pasos 326 y 327):

- Implementación local: migración `api/migrations/0003_transactions.sql`, endpoints `POST/GET /transactions`, `PATCH/DELETE /transactions/:id` y `GET /accounts/:id/balance`; pantallas Android de Inicio (selector de cuenta, saldo y recientes), formulario de movimiento, Historial con filtros y anulación con confirmación. Sin dependencias nuevas.
- Pruebas automatizadas: API **687/687** (19 archivos; 502 anteriores + 185 nuevas); app **808/808** (18 suites; 669 anteriores + 139 nuevas). `tsc`, ESLint y Prettier sin errores. `qa-engineer` APRUEBA: revisión contra el contrato, coherencia cliente-servidor y mutaciones de aislamiento, cálculo de saldo, tipo de categoría y filtro de anulados detectadas por las pruebas.
- Migración 0003 en D1 DEV (Paso 327, 2026-10-15): **aplicada** una sola vez en `controlgastos-db-dev` (la lista de pendientes contenía solo 0003). `d1_migrations`: 0001, 0002 y 0003. Tabla `transactions` con 10 columnas y 0 filas, índices `ix_transactions_account_fecha` e `ix_transactions_account_category`, `category_id` con `ON DELETE RESTRICT` y `account_id` con `ON DELETE CASCADE`, CHECK de tipo y monto, `PRAGMA foreign_key_check` sin filas. Conteos sin cambios: users 1, refresh_tokens 6, accounts 0, categories 0.
- API Fase 3 en `controlgastos-api-dev`: **desplegada** con `--env dev`, versión `e62adad2-f214-4bb0-b763-27a887e4b8ec` (100 % del tráfico), URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev. `GET /health` 200; `GET/POST /transactions`, `PATCH/DELETE /transactions/:id` y `GET /accounts/:id/balance` sin credenciales responden 401 con `Cache-Control: no-store`; tokens inválidos o de firma falsa, 401 `INVALID_TOKEN` sin datos financieros; `qa-engineer` APRUEBA la validación remota (solo lectura). Producción no se tocó. La app exige el campo `saldo` de la API: ambas deben usarse juntas.
- Android real: **no validado** (foco y teclado numérico del formulario, botón «atrás» y flujo completo contra DEV).
- Pruebas autenticadas remotas de Fases 2B y 3 (CRUD, aislamiento entre usuarios, saldo, historial y FK real a través de la API): pendientes por no existir una identidad de prueba DEV autorizada.

Riesgos y observaciones:

- Inestabilidad por tiempos de espera de 5 s bajo carga: con todos los procesos de Jest o Vitest y otras tareas pesadas en paralelo se observaron fallos intermitentes (API 2 en una de dos corridas; app en 2 de 3). Con `-w 2` la app pasó 2 de 2 y las repeticiones sin carga pasaron completas. Es un riesgo para la integración continua; pendiente de decidir un ajuste de `maxWorkers` o de tiempos de espera.
- El tipo `ajuste` no existe aún: llegará con la conciliación y exigirá reconstruir `transactions` en una migración posterior.
- Suma de saldos limitada a enteros seguros de JavaScript (falla con 500 en lugar de devolver cifras imprecisas).
- POST /transactions no es idempotente.

---

# Fase 4 - Calendario

[x] Vista mensual.
[x] Indicadores diarios.

Evidencia (2026-10-15):

- Local: API Vitest 20 archivos y 723 pruebas aprobadas (36 de `GET /calendar`); app Jest 21 suites y 906 pruebas aprobadas (incluye `CalendarScreen.test.tsx` y el bloque «calendario» de `MainNavigator.test.tsx`). `tsc`, ESLint y Prettier sin errores. Los totales mensuales del cliente usan `safeSumCents`/`monthTotals` y muestran «—» si no son enteros seguros.
- QA (qa-engineer): aprobado para desplegar a DEV, sin hallazgos críticos, altos ni medios.
- Cloudflare DEV: Worker `controlgastos-api-dev` desplegado con `cwrangler deploy --env dev` el 2026-10-15 (18:16 UTC), versionId `67d12824-b751-4f1f-85bf-9a56729ae1e8`, URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev. Migraciones 0001–0003 ya aplicadas, ninguna pendiente ni nueva. Sin cambios en producción.
- QA remoto sin credenciales: `/health` 200; `/calendar` sin JWT 401 y con JWT inválido 401, ambos con `Cache-Control: no-store` y sin datos sensibles; `/accounts`, `/transactions` y categorías sin JWT 401. Conteos D1 DEV sin cambios (users 1, refresh_tokens 6, accounts 0, categories 0, transactions 0).

Pendientes y riesgos:

- Pruebas autenticadas remotas de `/calendar` (200 con JWT válido, aislamiento, validación) por falta de identidad de prueba aislada; D1 DEV no tiene cuentas ni movimientos.
- Sin validación en Android real (cuadrícula, montos compactos, botón atrás).
- Menores: neto del día sin `safeSumCents`; categorías con `pageSize` 100 sin paginar; «hoy» no se actualiza pasada la medianoche; la prueba de remontaje de MainNavigator no simula un cambio real de usuario; sin prueba de neto negativo.
- Mensajes `workerd ... internal error` en stderr de Vitest sin pruebas fallidas.

---

# Fase 5 - Reportes

[x] Reportes mensuales (implementado en local).
[x] Reportes anuales (implementado en local; incluye modo Rango).
[x] Exportación CSV y PDF como archivos adjuntos (implementada en local; sin validar en Android real ni desplegada, decisión 5.3).

Implementado (2026-10-15, solo local, sin commit): `GET /reports/summary`, `/reports/by-category` y `/reports/by-period` (Decisión 5.1 de docs/003); pantalla Reportes con modos Mes/Año/Rango, totales, desglose por categoría, serie por período y navegación al Historial con filtros. Sin migración ni dependencias nuevas.

Evidencia local:

- API Vitest (máx. 2 workers): 21 archivos y 820 pruebas aprobadas (97 de `reports-api.test.ts`); app Jest (máx. 2 workers): 23 suites y 952 pruebas aprobadas. `tsc`, ESLint y Prettier sin errores.
- QA (qa-engineer): aprobado, sin hallazgos críticos, altos ni medios. Verificó aislamiento por cuenta y usuario, exclusión de anulados, enteros seguros y `no-store`.

Pendientes y riesgos:

- Sin despliegue a DEV ni pruebas remotas de `/reports/*`: la app necesita la API con esas rutas desplegadas.
- Sin validación en Android real (barras, scroll horizontal de la serie, teclado del modo Rango, botón atrás).
- `balance` de reportes es flujo neto (sin saldo inicial); la línea de ajustes llega con la conciliación (Fase 6).
- El desempate por `id` en el orden de categorías no es ejercitable con datos reales (nombre único por cuenta y tipo).
- Cambios sin commit; `tsconfig.json` de la raíz sin rastrear (preexistente) debe quedar fuera del commit.

---

# Fase 6 - Conciliación

[ ] Ajustes de saldo.
[ ] Historial de conciliaciones.

---

# Fase 7 - Preparación entrega

[ ] Pruebas completas.
[ ] APK prueba.
[ ] Revisión final.

## Plan de ejecución de Fase 2 — Detalle aprobado

### Fase 2A.1 — D1, usuarios y sesiones en API

- [x] Migración 0001 de usuarios y refresh tokens.
- [x] Configuración D1 para local y desarrollo.
- [x] Persistencia de usuarios identificados por Google sub.
- [x] JWT v2 con UUID de usuario interno.
- [ ] Rotación de refresh tokens con pruebas de concurrencia. Parcial: probada en D1 local y observada en D1 DEV; la prueba de concurrencia en remoto no está registrada.
- [x] Logout remoto y control de hasta 5 sesiones.
- [x] API validada con pruebas automatizadas y D1 de desarrollo.

Evidencia de la subfase 2A.1 (resultados confirmados por el usuario y verificados en este repositorio el 2026-10-15):

- Pruebas de la API: **329/329** aprobadas (12 archivos; Vitest con D1 local efímera de Miniflare). `tsc`, ESLint y Prettier de `api` sin errores.
- Cloudflare DEV: Worker `controlgastos-api-dev` desplegado, con la base `controlgastos-db-dev` (`env.dev` en `api/wrangler.jsonc`). No existe D1 ni despliegue de producción.
- En D1 DEV se observó la rotación del refresh token y la revocación del logout remoto.
- No se registran aquí el identificador de ejecución de GitHub Actions ni la versión del Worker de DEV; deben anotarse cuando se confirmen.

Pendientes de la subfase 2A.1:

- Concurrencia de la rotación en D1 remoto (docs/003 la exige en local y remoto): ejecutar o registrar la excepción aprobada.
- Retirar `api/src/services/session-service.ts` (JWT v1, sin uso en producción), con autorización.
- Política de retención de `refresh_tokens` (la tabla crece sin límite, Decisión 2A.1).

### Fase 2A.2 — Integración Android

- [x] Almacenar sesión y refresh token mediante SecureStore.
- [x] Consumir POST /auth/refresh.
- [x] Consumir POST /auth/logout.
- [ ] Mantener aislamiento al cambiar de usuario. Parcial: hay pruebas unitarias; falta la prueba manual con una segunda cuenta de Google.
- [x] Validar restauración, renovación y logout en Android.
- [ ] Preparar PR independiente para la aplicación.

Evidencia de la subfase 2A.2 (resultados confirmados por el usuario y verificados en este repositorio el 2026-10-15):

- Pruebas de la app: **525/525** aprobadas (8 suites). `tsc`, ESLint y Prettier de `app` sin errores. Cobertura de ramas de `auth-service.ts`: 95,68 % (línea sin cubrir: 347).
- Android real contra `controlgastos-api-dev`: login con Google, logout y renovación (refresh) validados en el dispositivo.
- Recuperación de sesión degradada y botón «Reintentar» comprobados en Android real (Decisión 2A.7 de docs/003).
- Revisión final del Paso 319.5.4: `qa-engineer` APRUEBA, `architect` APRUEBA CON RESERVAS (riesgos residuales en docs/003, Decisión 2A.7).
- Paso 322 (estabilización de concurrencia, riesgo R1): `signIn()` y `restore()` se excluyen mutuamente y `busy` solo lo libera su propietaria (Decisión 2A.7, D9 de docs/003). Pruebas de la app: **543/543** aprobadas (8 suites; 18 nuevas), medidas por `qa-engineer` en el repositorio. `tsc`, ESLint y Prettier sin errores. Cobertura de ramas de `auth-service.ts`: 96,02 % (línea sin cubrir: 350). Verificación por mutación de cada pieza de la corrección. `architect` APRUEBA y `qa-engineer` APRUEBA. Solo pruebas automatizadas: no se realizaron pruebas manuales en dispositivo para este cambio.

Pendientes de la subfase 2A.2 (sin evidencia, no se consideran completados):

- Cambio de cuenta de Google en el dispositivo.
- Respuesta 409 (`REFRESH_CONFLICT`) en dispositivo; solo está cubierta por pruebas automatizadas.
- Detección automática de conectividad: `expo-network` está aplazado y no implementado (Decisión 2A.7, D8).
- Riesgos residuales de concurrencia documentados en las Decisiones 2A.6 y 2A.7 (docs/003).
- Producción bloqueada: no se despliega a producción hasta que el PR de la app JWT v2 esté fusionado, porque la app de `main` aún usa el flujo v1.

### Fase 2B — Cuentas y categorías

- [x] Migración 0002 (`api/migrations/0002_accounts_categories.sql`: `accounts` y `categories`, sin `transactions`). Validada en D1 local y aplicada en D1 DEV (`controlgastos-db-dev`); no existe D1 de producción.
- [x] API de cuentas (`GET/POST/PATCH /accounts`).
- [x] API de categorías (`GET/POST /accounts/:id/categories`, `PATCH/DELETE /categories/:id`).
- [x] Creación atómica de una cuenta y 11 categorías iniciales (un único `db.batch`, con prueba de rollback total).
- [ ] Pantallas Android de cuentas y categorías. Parcial: implementadas y probadas con pruebas automatizadas y API simulada; sin validación en dispositivo ni contra la API desplegada.
- [x] Pruebas de aislamiento entre usuarios (API: 7 endpoints con dos usuarios y pruebas directas de repositorio; app: sin datos del usuario anterior tras cerrar sesión).

Evidencia del primer incremento (Decisión 2B.1 de docs/003; ejecutada en este repositorio el 2026-10-15):

- API: **502/502** pruebas (16 archivos; 329 anteriores + 173 nuevas). `tsc`, ESLint y Prettier de `api/src`, `api/test` y `api/migrations` sin errores. `api/wrangler.jsonc` falla `prettier --check` también en HEAD (previo a este incremento).
- App: **669/669** pruebas (14 suites; 543 anteriores + 126 nuevas). `tsc`, ESLint y Prettier sin errores.
- `qa-engineer` APRUEBA: revisión contra el contrato, coherencia cliente-servidor sin divergencias y mutaciones del filtro de propiedad detectadas por las pruebas. Sin dependencias nuevas.
- No se realizaron pruebas manuales en dispositivo.

Evidencia de la integración en Cloudflare DEV (Paso 324.2, 2026-10-15; `devops-engineer` y verificación independiente de `qa-engineer`):

- Migración 0002 aplicada una sola vez en `controlgastos-db-dev` (la lista de pendientes contenía solo 0002). `d1_migrations`: 0001 y 0002. Tablas `accounts` y `categories` (0 filas), índices `ix_accounts_user` y `ux_categories_account_tipo_nombre`, claves foráneas con `ON DELETE CASCADE`, `PRAGMA foreign_key_check` sin filas.
- Integridad de la Fase 2A: `users` = 1 y `refresh_tokens` = 6, iguales antes y después; sin DELETE, DROP ni TRUNCATE.
- Worker `controlgastos-api-dev` desplegado con `--env dev`, versión `ec9bf1fd-55ed-4864-a0b0-22384e77563d` (100 % del tráfico), URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev. Producción no se tocó.
- Verificaciones remotas sin credenciales: `GET /health` 200; las seis rutas de cuentas y categorías sin Authorization responden 401 `UNAUTHORIZED` con `Cache-Control: no-store`; tokens inválidos o de firma falsa, 401 `INVALID_TOKEN`; ruta inexistente, 404 `NOT_FOUND`; cuerpo de 20 KB a `/auth/google`, 413.
- Tras el despliegue, las rutas nuevas devolvieron 404 durante unos 20 s (propagación) antes de responder 401.

Pendientes de la Fase 2B:

- Pruebas autenticadas remotas en DEV, sin realizar por no existir una identidad de prueba autorizada: CRUD de cuentas y categorías, aislamiento entre dos usuarios, creación atómica de las 11 categorías y límites. Solo están cubiertas por pruebas locales.
- Validar las pantallas en Android contra `controlgastos-api-dev` (incluye teclado numérico y botón «atrás»). Estos pendientes no bloquean el avance hacia la Fase 3.
- Fase 3: activar `categoryHasTransactions` con la tabla `transactions` y `ON DELETE RESTRICT` en `category_id`; exponer `balance` en las cuentas.
- Comprobación de límites con COUNT + INSERT no atómica (aceptada, Decisión 2B.1 D6).
- PR: el trabajo está versionado en `feat/fase2b-cuentas-categorias`; el PR no se ha creado.

No se realizarán despliegues automáticos por fusionar a main.
El entorno de producción requiere aprobación expresa.

## Fase 5 - Exportación (incremento 5.2)

Implementada (local, sin commit): `GET /export` en CSV (columnas `fecha,tipo,categoria,nota,monto,monto_centavos`, BOM, CRLF, escapado RFC 4180, neutralización de fórmulas, tope 2000 filas, anulados excluidos) y botón «Exportar CSV» en Reportes con el menú de compartir de Android (`Share` de React Native, texto).

Evidencia local: API Vitest 23 archivos y 933 pruebas; app Jest 23 suites y 971 pruebas; `tsc`, ESLint y Prettier sin errores. QA (qa-engineer): aprobado; corrigió un bloqueo del botón al volver al período original tras descartar una exportación (con prueba de regresión). Hubo fallos intermitentes por carga en una primera corrida (una prueba de `/auth/refresh` en API; CalendarScreen y ReportsScreen en Jest) que pasaron al repetir, riesgo ya registrado en Fase 3.

Pendiente:

- PDF: no implementado. Generarlo a mano en el Worker es viable, pero la app no puede entregar un binario sin `expo-sharing` y `expo-file-system`; requiere autorización para añadir dependencias y una nueva development build.
- CSV como archivo adjunto (hoy se comparte como texto en el cuerpo del mensaje).
- Filtros de tipo y categoría desde Reportes (la API y el cliente ya los soportan).

No validado en Android real: apertura del menú de compartir, tamaño máximo aceptado por el Intent y cómo lo recibe el correo. Sin despliegue a DEV: `/export` y `/reports/*` no están probados en remoto.

## Fase 5 - Exportación como archivo (incremento 5.3)

Implementada (local, sin commit): `GET /export?format=csv|pdf` (PDF 1.4 real generado en el Worker, sin dependencias en la API) y, en la app, botones «Exportar CSV» y «Exportar PDF» que escriben un archivo temporal en la caché privada y lo comparten con `expo-sharing` (Decisión 5.3 de docs/003, que sustituye la entrega como texto de 5.2).

Dependencias incorporadas con autorización: `expo-sharing ~57.0.23` y `expo-file-system ~57.0.7` (directa), más el plugin `expo-sharing` en `app.json`. Sin cambios en el SDK de Expo ni en otras dependencias; sin migraciones.

Evidencia local: API Vitest 25 archivos y 979 pruebas aprobadas (46 nuevas de PDF); app Jest 25 suites y 990 pruebas aprobadas; `tsc`, ESLint y Prettier sin errores. QA (qa-engineer): aprobado, sin defectos bloqueantes. Validó la estructura de 9 PDF generados (xref, offsets, `/Length`, `/Count`, codificación WinAnsi, paginación y totales contra una suma independiente) con un validador propio, y revisó el ciclo de vida de los archivos temporales y que no se perdieran pruebas en `resources-api.test.ts`.

Pendientes y riesgos:

- **Nueva Development Build obligatoria** (`expo-sharing` es un módulo nativo): no se ejecutó EAS Build. Con el APK actual, la app sigue funcionando y muestra un mensaje al exportar, pero la exportación solo funcionará con la nueva build.
- **No validado en Android real**: compartir el archivo (FileProvider y selector), apertura del PDF y del CSV en las apps receptoras, comportamiento de `isAvailableAsync` en un APK antiguo.
- PDF sin abrir en un visor real: solo hay validación estructural y de contenido con un parser propio.
- CPU del Worker en plan Free con 2000 filas no demostrada (local ~5 ms; ~460 KB y 36 páginas). Medir tras el despliegue a DEV; si hay `exceededCpu`, bajar el tope solo del PDF.
- Sin despliegue a DEV: `/export` y `/reports/*` no están probados en remoto.
- Android no confirma el envío, por lo que no se muestra mensaje de éxito; los archivos temporales permanecen en la caché privada hasta la siguiente limpieza.
- Menores: falta una prueba explícita de igualdad de sumas entre CSV y PDF con el mismo filtro (ambos comparten la lectura); con exactamente 56, 112… filas los totales quedan solos en una página; `tsconfig.json` de la raíz sigue sin rastrear y debe quedar fuera del commit.

## Fase 5 - Cierre (2026-10-15)

Despliegue en Cloudflare DEV (autorizado; solo DEV, sin producción ni migraciones remotas):

- Worker `controlgastos-api-dev`, URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev, versionId `1a73a98a-c358-44df-9429-cb7f1410705b`, desplegado con `cwrangler deploy --env dev` el 2026-10-15 entre 20:01:35 y 20:01:43 UTC. Antes, `d1 migrations list --remote` indicó «No migrations to apply!» (0001–0003 aplicadas) y el dry-run solo mostró el binding `DB` → `controlgastos-db-dev`.
- Verificación remota sin credenciales: `/health` 200; `/reports/summary`, `/reports/by-category`, `/reports/by-period`, `/export` (csv y pdf), `/accounts`, `/transactions` y `/calendar` sin JWT → 401 `UNAUTHORIZED`; con JWT inválido → 401 `INVALID_TOKEN`; todas las respuestas protegidas con `Cache-Control: no-store` y cuerpo genérico. Conteos D1 DEV antes y después idénticos (users 1, refresh_tokens 6, accounts 0, categories 0, transactions 0).
- **No verificado en remoto**: reportes autenticados, CSV ni PDF (no existe identidad de prueba aislada; no se crearon usuarios ni movimientos). D1 DEV no tiene cuentas ni movimientos.

Development Build Android (autorizada): EAS build `375e4dc0-2e61-4fb8-b411-9e06a9a93456`, perfil `development`, plataforma Android, distribución interna, SDK 57, estado final FINISHED (~3 min en cola y ~9,5 min de compilación, 20:05–20:14 hora local). Credenciales: keystore remoto existente, sin credenciales nuevas. Variables del entorno `development` de EAS: `EXPO_PUBLIC_API_URL` apunta a la URL de DEV y `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` existe. APK: https://expo.dev/artifacts/eas/VR-HEbIBa2Hmb4R51Ha_sF0GKS0jh7qE4bDJ9zK4yDY.apk (página: https://expo.dev/accounts/luiscaizasoria/projects/cuida-tu-billetera/builds/375e4dc0-2e61-4fb8-b411-9e06a9a93456). EAS empaqueta el árbol de trabajo, por lo que la build incluye los cambios de Fase 5 aunque se lanzó antes del commit (base `bc75b03`). Sin OTA ni publicación en tiendas.

QA final (qa-engineer): aprobado, sin hallazgos críticos, altos ni medios. Pruebas dirigidas de hoy: API 477 pruebas en 9 archivos y app 223 pruebas en 8 suites aprobadas; `tsc`, ESLint y Prettier sin errores. Las suites completas (API 979, app 990) vienen de la corrida previa, sin cambios de código desde entonces.

Alcance de la validación:

- Local: reportes, exportación CSV/PDF, archivos temporales (con mocks), regresión de calendario, historial y movimientos.
- Cloudflare DEV: solo disponibilidad y rutas protegidas (sin credenciales).
- Compilación Android: la build termina y empaqueta `expo-sharing` y `expo-file-system`; no equivale a validación funcional.
- **No validado en dispositivo real**: pantalla de Reportes, hoja de compartir, apertura del CSV (BOM y acentos en Excel) y del PDF en un visor real, rendimiento con 2000 filas, comportamiento de `FileProvider` y renovación de sesión durante la exportación.

Pendientes: instalar el APK de Development y probar Fase 5 en un dispositivo; crear una identidad de prueba aislada para validar en DEV los reportes autenticados, CSV y PDF y medir la CPU del Worker con 2000 filas (plan Free, 10 ms); `tsconfig.json` de la raíz sigue sin rastrear y queda fuera del commit; el Pull Request y la integración a `main` no se han hecho.

# Rediseño UX/UI (R0 a R6)

Línea de trabajo transversal, no es una fase numerada de docs/001 §11. Plan en docs/009-PLAN-IMPLEMENTACION-REDISENO.md, diseño en docs/007 y docs/008, matriz de validación en docs/010. Decisiones en docs/003 («Rediseño UX/UI — Decisión R0»). Rama: `feat/rediseno-ux-ui`. Línea base de pruebas: app 990 y API 979 (cierre de Fase 5).

[x] R0 - Documentación (docs/001 §7, docs/003 «Decisión R0», docs/004). Evidencia: revisión de `architect` (coherencia), `mobile-ux-designer` (navegación), `mobile-visual-designer` (identidad) y `mobile-ux-qa` (trazabilidad) con correcciones aplicadas; solo documentación, sin cambios en `app/` ni `api/`. Commits locales sin push.
[ ] R1 - Tokens y base (`theme/tokens.ts`, `Screen`, botones de 48 dp).
[ ] R2 - Navegación: Mis cuentas, Detalle con barra inferior, Más, barra de contexto.
[ ] R3 - Nuevo movimiento (orden aprobado).
[ ] R4 - Historial, Calendario, Reportes y Categorías con el nuevo sistema visual.
[ ] R5 - Guías contextuales y estados vacíos.
[ ] R6 - Ícono, splash y nombre (requiere nueva development build y autorización expresa).

Pendiente transversal: validación en Android real (niveles A y D de docs/010) y decisiones abiertas listadas en docs/003 (Decisión R0, «Pendientes»). No se toca la API, D1, sesiones ni dependencias nativas salvo decisión posterior.
