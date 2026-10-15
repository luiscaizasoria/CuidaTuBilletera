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

[ ] Reportes mensuales.
[ ] Reportes anuales.
[ ] Exportación.

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
