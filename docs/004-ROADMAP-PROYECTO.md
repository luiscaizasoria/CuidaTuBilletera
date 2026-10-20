# Roadmap del Proyecto ControlGastos

## Estado actual

Fase actual:
Fases 3, 4 y 5 integradas en main (PR #13, #14 y #15). Rediseño UX/UI R0 a R6 integrado en main (PR #16, cerrado funcionalmente; sección al final). Fase 6 (conciliación manual con categorías, docs/003 Decisión 6.1) cerrada funcionalmente en el paso 384 (rama `feat/categoria-conciliacion` pendiente de push y PR). La Fase 2A conserva pendientes de validación: la subfase 2A.1 (API) tiene su evidencia registrada con un pendiente de pruebas remotas; la subfase 2A.2 (Android) está validada en dispositivo con pendientes (cambio de cuenta, 409 en dispositivo y PR). Detalle y evidencia en «Plan de ejecución de Fase 2».

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
- El tipo `ajuste` no existirá: la conciliación es manual con categorías «Conciliación» (docs/003 Decisión 6.1; la previsión anterior de reconstruir `transactions` queda sustituida).
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
- `balance` de reportes es flujo neto (sin saldo inicial); no habrá línea de ajustes: los movimientos con la categoría «Conciliación» cuentan como ingresos o gastos normales (docs/003 Decisión 6.1).
- El desempate por `id` en el orden de categorías no es ejercitable con datos reales (nombre único por cuenta y tipo).
- Cambios sin commit; `tsconfig.json` de la raíz sin rastrear (preexistente) debe quedar fuera del commit.

---

Seguimiento de seguridad de dependencias (paso 379, 2026-10-19): alertas de Dependabot sobre `braces`, `node-forge`, `sprintf-js` y `uuid`, documentadas en docs/003 «Decisión S1» (versión instalada, cadena, alcance, limitaciones, parche, riesgo residual y revisión propuesta 2026-11-19). Las tres primeras no tienen parche publicado; uuid tiene parche pero está bloqueado por `xcode 3.0.1` (override opcional sin aplicar). Los fallos de Dependabot son independientes del CI: PR #16 y main pasaron el CI. `package.json` y `package-lock.json` no se modificaron.

# Fase 6 - Conciliación manual mediante categorías (CERRADA funcionalmente, paso 384)

**Alcance vigente (paso 380, decisión definitiva del usuario; docs/003 «Decisión 6.1» y docs/001 §5):** conciliación **exclusivamente manual** con el formulario de movimientos existente y una categoría predeterminada «Conciliación» de ingreso y otra de egreso (ícono `exchange`, color `#6366F1`). Sin pantalla, endpoint, tipo `ajuste`, previsualización ni cálculo automático; los movimientos cuentan en reportes y exportaciones como cualquier otro. El alcance anterior (pantalla en Más, `POST /accounts/:id/reconcile`, tipo `ajuste`, migración de ajustes, historial independiente y línea de ajustes en reportes) fue **sustituido por decisión del usuario** y no es requisito.

[x] Categorías predeterminadas «Conciliación» (ingreso y egreso) en cuentas nuevas (`DEFAULT_CATEGORIES`: 13 categorías por cuenta). Implementado y probado en local (paso 381; sin commit funcional ni push).
[x] Categorías «Conciliación» en cuentas existentes: migración D1 0005 de solo datos, probada en local y **aplicada en D1 DEV el 2026-10-19 (paso 382)**; verificada con consultas de solo lectura (+10 categorías, sin cambios en usuarios, cuentas, movimientos ni saldos). No existe D1 de producción; sin push ni PR.
[x] Ayuda breve en la guía `categorias` (texto en `app/src/lib/guides.ts`; pruebas Jest). Sin validar en Android.
[x] Pruebas automáticas (API y migración): API 30 archivos y 1305 pruebas; app 59 suites y 1858 pruebas.
[x] Validación funcional del usuario en Android real (Expo Tunnel contra DEV; paso 384): seis resultados correctos (categoría en Gasto e Ingreso; gasto y ingreso de $5 modifican el saldo $5; aparecen en Historial, Calendario y Reportes; se editan y anulan con el saldo actualizado; cuentas nuevas con 13 categorías). Sin capturas ni grabaciones. **No ejecutadas** (no bloqueantes): 320 dp y fuente ampliada, selector con 9 categorías con teclado, TalkBack y otros dispositivos.

Paso 382 (2026-10-19, autorizado; solo DEV): consolidada en commits locales (`6a6a8e8`, `dd85288`, `186945f` más el de registro de este paso) y habilitada en DEV: respaldo verificable de `controlgastos-db-dev` (40 722 bytes, SHA-256 `2c25e747…8f34ce`, punto de Time Travel anotado; el volcado contiene datos de usuarios y está fuera del repositorio), Worker `controlgastos-api-dev` desplegado (VersionId `2be5b60a-6735-49f5-8ea6-564e207df2f6`, https://controlgastos-api-dev.luis-caiza-soria.workers.dev) y migración 0005 aplicada una vez. Conteos DEV antes → después: usuarios 2 → 2; cuentas 5 → 5; categorías 58 → 68 (47 egresos y 21 ingresos); movimientos 8 → 8 (1 anulado); saldos idénticos; esquema de 22 objetos idéntico; 0 duplicados. Agentes: `architect` aa166da9def201bd1, `backend-engineer` ab8ca968e80c3e1dd, `qa-engineer` a39cc61278ce949c5 (APRUEBA), `devops-engineer` aa09b53ea48f0c2b1. Detalle y salvedades en docs/003 Decisión 6.1. Producción no existe ni se tocó. **Pendiente:** validación en Android real (resuelto en el paso 384), push y PR.

Paso 384 (2026-10-19, local): **Fase 6 cerrada funcionalmente.** El usuario confirmó en Android real los seis escenarios de conciliación manual (ver la casilla de validación y docs/003 Decisión 6.1). Alcance conservado: conciliación manual con la categoría «Conciliación» de ingreso y de gasto, sin pantalla nueva, sin endpoint de conciliación, sin importaciones bancarias y sin tipos de movimiento nuevos. Migración 0005 aplicada **únicamente en D1 DEV** (no existe D1 de producción); Worker DEV `2be5b60a-6735-49f5-8ea6-564e207df2f6`. QA final del paso 384: `architect` a581878c1192a2e56 (COMPATIBLE), `mobile-ux-qa` a91513b124fd7af29 (CON OBSERVACIONES, sin defectos altos ni críticos; sus observaciones documentales se corrigieron), `qa-engineer` y `devops-engineer` (ver registro en docs/003 Decisión 6.1). Pendiente: push y PR de `feat/categoria-conciliacion` (con autorización). F-A y F-B se conservan como etapas futuras.

Estado (paso 381): **implementada en local** en la rama `feat/categoria-conciliacion` (desde `main` 1ed6e27 + commit documental `6a6a8e8`; código sin commit, sin push). QA: `qa-engineer` a35822681dfeb7bf7 APROBADO (API 30 archivos y 1305 pruebas; app 59 suites y 1858 pruebas, con `--maxWorkers=2`), `mobile-ux-qa` aa1ab86b80eea287c sin defectos; detalle en docs/003 Decisión 6.1. **Pendiente:** aplicar 0005 en DEV, desplegar el Worker DEV y validar en Android (docs/010 §23). Plan original del paso 380: Revisión del paso 380: `architect` af7582bfdbdc5bbe8, `backend-engineer` a13538e1fd01df0cb (borrador de SQL probado en SQLite en memoria, no en D1), `mobile-ux-designer` a45b54cb5cd5a0b4a (sin cambios de UI; ayuda opcional en la guía `categorias`), `qa-engineer` aa0fe68be97a38a82. Etapas: (1) docs/001 y 003 (hecho en este paso) → (2) `backend-engineer`: `DEFAULT_CATEGORIES`, migración 0005 si se aprueba y pruebas → (3) `qa-engineer` → (4) `mobile-engineer` y `mobile-ux-qa` solo si se aprueba la ayuda en la guía → (5) `devops-engineer`: procedimiento de respaldo y aplicación en DEV (con autorización expresa). Sin dependencias nativas ni nueva Development Build. La migración remota y el despliegue exigen autorización expresa; no existe D1 de producción.

---

# Alcance de la versión 1.0 (paso 386, 2026-10-19; decisión del usuario)

El usuario decidió **cerrar la versión actual y publicarla oficialmente en Google Play**, sin Expo Tunnel ni Metro.

- **Incluido en v1.0:** funcionalidades originales (autenticación con Google, cuentas, categorías, movimientos, historial, calendario, reportes y exportación CSV y PDF), el rediseño UX/UI R0 a R6 (PR #16) y la conciliación manual mediante la categoría «Conciliación» (Fase 6, PR #17), ambos fusionados en `main` (`a482048`, CI verde), más lo imprescindible para publicar en Google Play (docs/001 §3, docs/003 «Decisión L1»).
- **Excluido (futuro, no iniciado, sin cambios):** F-A (versiones y actualización avanzada: EAS Update, `runtimeVersion`, canales, avisos de versión) y F-B (multidioma). El versionado mínimo para publicar (`version` 1.0.0 y `versionCode` creciente por EAS) no es F-A.
- **Sin funcionalidades nuevas de producto:** solo correcciones imprescindibles de publicación, privacidad, seguridad o estabilidad, que no se implementan sin autorización.
- **Estado (verificado el 2026-10-19 en solo lectura):** no hay D1 productiva ni `JWT_SECRET` de producción; el Worker `controlgastos-api` de las ejecuciones manuales del 2026-10-11 es código antiguo sin D1 ni variables; EAS solo tiene Development Builds (versionCode 1 y 2) y sus variables `production` y `preview` están vacías; el Environment `production` de GitHub existe; GitHub Pages inactivo; cuenta de Play Console no verificada. **Nada productivo se ha creado ni modificado.**
- **API 36:** el proyecto genera `targetSdk` 36 por defecto (React Native 0.86.3 y el plugin raíz de Expo); sin actualización de SDK; a confirmar en el manifiesto de la AAB final.
- **Puertas de lanzamiento (detalle y criterios en docs/006):**
  - [x] **G0** Fase 6 integrada en `main` con CI verde (PR #17).
  - [ ] **G1** Bloqueos de Google Play. **Eliminación de cuenta y datos: implementada y probada en local (paso 388; `DELETE /me` con confirmación y verificación de identidad con Google (ID token emitido hace ≤ 300 s; no equivale a reautenticar con contraseña o biometría: docs/003, revisión del paso 389, pendiente de tu aceptación); app: sección «PRIVACIDAD Y DATOS»; sin validación en dispositivo ni en D1 remota; docs/003 «Decisión G1»).** Pendiente: política de privacidad pública y su enlace (variables `EXPO_PUBLIC_PRIVACY_POLICY_URL` y `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, borradores no publicables en `docs/borradores-legales/`), URL web de eliminación y procedimiento por correo verificado, recursos de ficha, cuenta de revisión, validación en una cuenta QA desechable de DEV (con autorización). Rama local: `chore/g1-privacidad-eliminacion`. **Estado tras el paso 395 (2026-10-20):** corrección del teclado de la confirmación (`04e9e39`); Worker DEV desplegado con `DELETE /me` (VersionId `afbd3ac3-538a-47d1-b2bd-fd2b4bb47373`) y respaldo previo verificado; el usuario confirma en Android que una eliminación se completó contra DEV y que la app volvió a Login; las consultas D1 de solo lectura son coherentes con la eliminación de un usuario (1 usuario, 0 filas huérfanas, sin violaciones de claves foráneas), pero **no se encontró el perfil nuevo que el usuario describe** y no se conservó el id eliminado (sin corroborar, docs/003); la causa de los rechazos previos de la verificación con Google no se determinó; diagnósticos temporales retirados. G1 sigue **abierto**: faltan la aclaración anterior, ELIM-j/k/l y TalkBack en dispositivo, y la política de privacidad y las páginas legales publicadas.
  - [ ] **G2** Cloudflare producción aprobada: estructura, D1 propia, secretos y política.
  - [ ] **G3** Backend productivo desplegado y comprobado (smoke, aislamiento, `DELETE /me`).
  - [ ] **G4** AAB de producción (variables de EAS, perfiles, permisos, upload key).
  - [ ] **G5** Instalación y pruebas sin Metro (APK equivalente y pista interna; login con la firma de Play).
  - [ ] **G6** Play Console completa y prueba cerrada si la cuenta lo exige (12 testers, 14 días).
  - [ ] **G7** Publicación en producción y verificación de disponibilidad.
- **Riesgo documentado S1 (Dependabot):** `braces`, `node-forge`, `sprintf-js` sin parche y `uuid` bloqueado por `xcode`; excepción con revisión el 2026-11-19 (docs/003 Decisión S1).

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
[x] R5.1 - Mejoras UX y ajustes Android (docs/003 «Decisión R5.1»). **Cerrada funcionalmente (paso 372): implementada y validada funcionalmente por el usuario en Android real; la cobertura QA completa en dispositivo sigue pendiente (ver paso 372).** Implementado y validado en local: Login renovado con el botón oficial de Google, «Cerrar sesión» en Mis cuentas, selección de ícono de categoría, «+ Crear categoría» dentro de Nuevo movimiento y mitigación provisional de la barra de estado (commit `948d310`); personalización de cuentas con color e ícono (docs/003 D12), implementada en local con migración 0004 y Worker ya aplicados en DEV (2026-10-17). Pendiente: pruebas autenticadas de personalización en Android real, validación en Android real (docs/010 niveles A y D, casos CTA-14 a CTA-16), ocultar la barra inferior del sistema (módulo nativo y cambio de norma) y la corrección exacta de insets (`react-native-safe-area-context`), ambos bloqueados por autorización.
Actualización 2026-10-17 (paso 362, local, sin commit): el usuario comunicó la validación en Android (Expo Tunnel) de Login, cierre de sesión, colores e íconos de cuentas y categorías, crear categoría en Nuevo movimiento y separación de datos entre usuarios. Íconos ampliados a 246 (cuentas) y 249 (categorías) con selector «Elegir ícono» (docs/003 D13): `mobile-ux-qa` APROBADO CON OBSERVACIONES tras corregir un defecto alto (R51-01) y `qa-engineer` APROBADO (app: 53 suites y 1776 pruebas; API: 28 archivos y 1287 pruebas; tsc, ESLint y Prettier limpios). Pendiente: redesplegar el Worker DEV (autorización), validar en dispositivo ICO-01 a ICO-15 (docs/010 §21) y decidir la barra inferior (docs/003 D14, estudiada, no implementada). **R5.1 sigue sin completarse** mientras la barra inferior esté pendiente.

Paso 363 (2026-10-17): catálogo consolidado en un commit local (sin push) tras revisar palabras clave y agrupación y repetir QA (app: 53 suites y 1778 pruebas; API: 28 archivos y 1287 pruebas; tsc, ESLint y Prettier limpios). La prueba de las 246 claves en PATCH recibió un timeout explícito de 120 s (tardaba ~17 s bajo carga y excedía los 5 s por defecto). La prueba inmersiva (docs/003 D14) queda propuesta para R6, sujeta a aprobación; no está implementada. Las etapas F-A y F-B no cambian.

Despliegue DEV del paso 363 (2026-10-17, autorizado, solo DEV, sin migración, sin producción, sin push): commit local `e9dfcaa`. D1 `controlgastos-db-dev`: sin migraciones pendientes (0004 aplicada). Dry-run correcto con el único binding de datos `DB` → `controlgastos-db-dev` (951,37 KiB, gzip 164,62 KiB). `cwrangler deploy --env dev`: Worker `controlgastos-api-dev`, URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev, versionId `7c540b46-2ef0-491e-9292-4d0640023f69`. Smoke tests de solo lectura: `/health` 200; `/accounts`, `/transactions` y `/me` sin JWT 401 con `Cache-Control: no-store`; `/accounts` con JWT inválido 401 con `no-store`. No se crearon registros en D1. **Pendiente: probar en Android real el nuevo selector (ICO-01 a ICO-15, docs/010 §21) y decidir la barra inferior; R5.1 no está completada.**

Paso 366 (2026-10-17, local, sin commit): el usuario confirmó en Android la búsqueda y selección de íconos, la persistencia de íconos de cuentas, los íconos de categorías, la creación de categoría desde Nuevo movimiento con conservación de datos y el teclado. Hallazgos: los grupos del selector no se descubrían (solo ~3 visibles) y la barra inferior del sistema sigue visible. Corrección de grupos: flechas de 48 dp con recentrado tras buscar (docs/003 D15); `mobile-ux-qa` APROBADO CON OBSERVACIONES y `qa-engineer` APROBADO (app: 54 suites y 1795 pruebas); pendiente probarlo en Android (ICO-16 a ICO-24). Barra inferior: plan nativo preparado y no implementado (docs/003 D16); requiere decisión del usuario, cambio previo de docs/001, dos módulos nativos y una Development Build nueva. **R5.1 sigue abierta.**

Paso 367 (2026-10-17, autorizado): flechas de grupos consolidadas en el commit local `62100f0`. Modo inmersivo Android aprobado por el usuario (docs/001 y docs/003 D17): `expo-navigation-bar ~57.0.3` y `react-native-safe-area-context ~5.7.0` instaladas (`npx expo install`; `package-lock.json` solo añade esos paquetes), plugin `expo-navigation-bar` en `app.json`, `SafeAreaProvider` en la raíz, `useSystemInsets` sobre insets reales (respaldo 32/48 dp solo sin provider o con valores inválidos), `navigationBarTranslucent` en `Sheet` y módulo de modo inmersivo (oculta al abrir, la muestra con teclado o TalkBack, reaplica al volver de segundo plano reiniciando antes la caché de `setHidden`, que de otro modo ignora valores repetidos). No se añadió `edgeMin` (decisión: sin mínimos fijos; se evalúa en INM-08, 20 y 21). QA: `mobile-ux-qa` APROBADO CON OBSERVACIONES y `qa-engineer` APROBADO (app: 58 suites y 1819 pruebas; tsc, ESLint y Prettier limpios; API sin cambios). `expo-doctor`: 20 de 21; falla un desajuste previo (expo 57.0.27→~57.0.30, jest-expo 57.0.5→~57.0.6) ajeno a este cambio. **Development Build nueva** (autorizada): Build ID `7c58a37f-e2d5-4e27-85f7-2c3fedb575a9`, perfil `development`, Android, distribución interna, SDK 57, FINISHED (22:25–22:32 UTC, ~7,3 min), appVersion 1.0.0 versionCode 1, fingerprint `dd1bb9b0…`; página https://expo.dev/accounts/luiscaizasoria/projects/cuida-tu-billetera/builds/7c58a37f-e2d5-4e27-85f7-2c3fedb575a9; APK https://expo.dev/artifacts/eas/R34Z-UwwEEGQAvd6NXbS-jX-rzkgHemgsJNuclCNkkY.apk. La build empaqueta el árbol de trabajo sin commitear. No se comprobó el SHA-1 de firma (build `--non-interactive`, sin credenciales nuevas): verificarlo con `eas credentials` (solo lectura) si Google Sign-In falla. Sin OTA, Play ni producción. **Sin validación en Android real: pendientes INM-01 a INM-24, ICO-16 a ICO-24 y la matriz del rediseño. El código del modo inmersivo no está commiteado. R5.1 sigue abierta.**

Paso 372 (2026-10-19, local): cierre formal de R5.1. **Validado por el usuario en Android real** con la Development Build `7c58a37f-e2d5-4e27-85f7-2c3fedb575a9` (validación manual comunicada, sin capturas ni grabaciones): la app abre; los errores `ExpoNavigationBar` y `RNCSafeAreaProvider` quedaron superados; la barra de navegación inferior del sistema se oculta; las flechas del selector de íconos funcionan; y, de pasos anteriores, login, cierre de sesión, colores e íconos de cuentas y categorías, persistencia y creación de categoría desde Nuevo movimiento con conservación de datos. El usuario considera implementadas las funcionalidades solicitadas. Correcciones previas: adaptador opcional de `expo-navigation-bar` (`lib/immersive.ts` con `requireOptionalNativeModule`, solo JS). **QA**: `architect` APROBADO (a4bbea6dcb181b27b), `mobile-ux-qa` sin defectos altos ni críticos (a3ca21104cc7c07f3; validación parcial, sin dispositivo), `qa-engineer` APROBADO (a65a7447b342cd6c7), `devops-engineer` CONSISTENTE (ac4ab1c9b7361246a): la huella nativa local `dd1bb9b023d2…` coincide con la registrada de la build (cálculo local; no se consultó EAS ni el SHA-1 de firma). Automatizado: tsc, ESLint y Prettier limpios; app: 58 suites y 1821 pruebas. **No probado por el usuario (pendiente en dispositivo, no aprobado individualmente)**: INM-01 a INM-24 y ICO-16 a ICO-24 como casos de la matriz (de INM-01 solo se confirmó que la barra se oculta); TalkBack; fuente ampliada; teclado y modales en configuraciones especiales; otros dispositivos Android; gestos frente a tres botones. Validación funcional del usuario no equivale a cobertura QA completa. Commits locales, sin push ni PR.

Paso 373 (2026-10-19, solo documentación): preparación de R6 sin implementar (docs/003 «Decisión R6», docs/008 §13.2, vista previa `docs/design/prototipo/r6-vista-previa.html`). Corregido docs/008 §6.18 (D17 ya implementada; `edgeMin` no adoptado). Revisión de `architect` (ab934d196b7eb4c47), `mobile-visual-designer` (a549452c6fb821cef), `mobile-ux-designer` (a46182cc85331ebed) y `mobile-ux-qa` (ac085fe64fb89e47c, CON OBSERVACIONES, sin defectos altos; las incoherencias documentales encontradas se corrigieron): el primer plano adaptable, el monocromático y el splash actuales se regeneran; fondo adaptable por color; alcancía de Mis cuentas sin escala ×1.4; `expo-splash-screen` es dependencia nativa nueva y exige Development Build nueva. Pendiente de aprobación del usuario antes de copiar recursos, instalar dependencias o tocar `app.json`. Sin commit, push, build ni cambios de código.

Paso 374 (2026-10-19, autorizado): R6 implementada en el árbol de trabajo (código sin commit; commit documental `409ad89`). `expo-splash-screen@~57.0.10`, recursos vectoriales regenerados en `app/assets/` (fuentes en `docs/design/assets/r6/`), `app.json` con `icon`, `adaptiveIcon` (fondo por color) y plugin de splash (`imageWidth` 288, `#0F5F5A`), alcancía de Mis cuentas (una por pantalla) y pruebas. Agentes (agentId): `architect` ab5f415218699758b, `mobile-visual-designer` a787738c21573f0fa, `mobile-ux-designer` a5f9bd9610db8d473, `mobile-engineer` a8deebb98930dd503, `mobile-ux-qa` a41c7918399ade7f8 (APRUEBA CON OBSERVACIONES, sin defectos), `qa-engineer` ae35bee264b70e9b5 (APROBADO), `devops-engineer` ac795b5d44214fc01. Automatizado: tsc, ESLint y Prettier limpios; app: 59 suites y 1855 pruebas. **Development Build** (una sola, autorizada, sin preview, sin Play, sin EAS Update): Build ID `bcc026f3-b895-4a7a-a036-ec173e01c934`, perfil `development`, SDK 57, FINISHED (16:28–17:02 UTC, ~34 min), appVersion 1.0.0, **versionCode 2** (el remoto era 1; `eas build:version:set`, sin tocar `app.json`); página https://expo.dev/accounts/luiscaizasoria/projects/cuida-tu-billetera/builds/bcc026f3-b895-4a7a-a036-ec173e01c934; APK https://expo.dev/artifacts/eas/oKDq-xNvaKWdo7176i4pyGPrVgZPNN_zMM7WstmQLrs.apk. Salvedades: fingerprint de EAS `b075289e…` distinto del local `1fcadfd2…` (no investigado); no se verificó en el log la instalación de `expo-splash-screen`; no se comprobó el SHA-1 de firma; la build empaqueta el árbol sin commitear. **Pendiente en Android real** (R6-01 a R6-09 de docs/010 §22 y los casos de TalkBack, fuente ampliada y otros dispositivos); splash e ícono temático exigen una build `preview`. **R6 sigue abierta hasta validar en dispositivo.** F-A y F-B se conservan como etapas futuras.

Paso 376 (2026-10-19, local): cierre funcional de R6. **Validado por el usuario en Android real** con la Development Build `bcc026f3-b895-4a7a-a036-ec173e01c934` (versionCode 2; manual, sin capturas ni grabaciones): (1) la app abre y permite iniciar sesión; (2) la barra inferior permanece oculta; (3) el nuevo ícono aparece correctamente; (4) la alcancía aparece en el encabezado de Mis cuentas; (5) la ilustración se ve sin recortes ni superposiciones; (6) cuentas, categorías y movimientos siguen funcionando. QA final: `architect` COHERENTE (ae998a10bd91559c1), `mobile-visual-designer` APRUEBA (a2cb40f89e75ff56d), `mobile-ux-qa` sin defectos altos ni críticos (a8baa205b29b72b67), `qa-engineer` sin regresión (a7e383d95b9831fa9), `devops-engineer` (a6fcd120ccebb1d0d). Automatizado: tsc, ESLint y Prettier limpios; app con dos workers: 59 suites y 1855 pruebas. Corregido un defecto de lint demostrado en `docs/design/assets/r6/generar.mjs` (globales de Node; `npm run lint` de la raíz, el del CI, fallaba). Pruebas en este Dev Container (8 CPU, ~3,7 GB): con workers por defecto (`npx jest --ci`, `npm test` de la raíz) fallan por tiempo de espera (5000 o 30000 ms, sin fallos de aserción) 3 a 8 suites de la app (p. ej. `sheets.tall`, `App`, `MainNavigator`) y 2 pruebas de la API (`accounts-api`, `accounts-appearance-api`) que pasan solas (417 de 417) y con `--maxWorkers=2` (59 suites y 1855 pruebas); es contención de recursos, no un defecto, y no se aumentaron los timeouts. Fingerprints EAS y local: hipótesis del versionCode refutada, causa no demostrada, sin evidencia de defecto. **Pendientes no bloqueantes (sin ejecutar):** TalkBack, fuente ampliada, comportamientos especiales del teclado, otros dispositivos Android, splash e ícono monocromático en una build de distribución, revisión de la firma antes de publicar. **R6 y el rediseño R0 a R6 quedan cerrados funcionalmente; falta integrar a main (push y PR con autorización).** Riesgo: la migración D1 0004 solo está en DEV (aplicarla en producción antes de desplegar el Worker). F-A y F-B se conservan como etapas futuras.

[x] R6 - Ícono, splash y nombre (requiere nueva development build y autorización expresa).

Pendiente transversal: validación en Android real (niveles A y D de docs/010) y decisiones abiertas listadas en docs/003 (Decisión R0, «Pendientes»). No se toca la API, D1, sesiones ni dependencias nativas salvo decisión posterior.

## Rediseño R5.1 - Personalización de cuentas (2026-10-17, local y DEV)

Implementado en local, sin migración remota ni despliegue (docs/003 D12): migración aditiva `api/migrations/0004_account_appearance.sql` (columnas `color` e `icono` nullable en `accounts`, CHECK de forma, sin tocar filas), API de cuentas con `color` e `icono` en las respuestas y en POST/PATCH (enum en Zod; PATCH ausente = sin cambio, null = predeterminado), y en la app selectores de color (6) e ícono (12) en Crear y Editar cuenta con vista previa. Sin soporte de la API (DEV actual o lista vacía) la app oculta el selector y no envía los campos. No se guardan solo en el teléfono. Saldos, reportes y exportación no usan los campos.

Despliegue en DEV (2026-10-17, autorizado expresamente; solo DEV, sin cambios en producción): migración `0004_account_appearance.sql` aplicada en D1 `controlgastos-db-dev` (antes: 0001–0003 aplicadas y solo 0004 pendiente; después: ninguna pendiente). Conteos conservados antes y después (users 2, refresh_tokens 13, accounts 3, categories 34, transactions 5). `accounts` incorpora `color` e `icono` TEXT opcionales, sin valor por defecto; las 3 cuentas existentes conservan NULL. El esquema completo (22 objetos) solo difiere en `accounts`. Worker `controlgastos-api-dev` actualizado con `cwrangler deploy --env dev` (dry-run sin bindings nuevos): versionId `1e918a4a-fc03-45d2-8a84-f79ac9a095ff`, 2026-10-17 12:02:56–12:03:03 UTC, URL https://controlgastos-api-dev.luis-caiza-soria.workers.dev. Smoke tests no autenticados aprobados: `/health` 200; `/accounts` sin JWT y con JWT inválido 401 con `Cache-Control: no-store`. `qa-engineer`: verificación independiente APROBADA. Pendientes: pruebas autenticadas de personalización en Android (no realizadas), ajustes de barra inferior e insets. R5.1 queda parcialmente completada; R6 no iniciado.

Evidencia: API 27 archivos y 1034 pruebas; app 51 suites y 1721 pruebas (líneas base 979 y 1641 de antes de este trabajo); `tsc` y ESLint sin errores; Prettier sin errores en los archivos tocados (`api/wrangler.jsonc` ya fallaba antes y no se modificó). `mobile-ux-qa`: sin defectos críticos ni altos; medios aceptados (UX-CTA-01: tras un 400 por apariencia el bloque se oculta; UX-CTA-02: texto de CTA-13 alineado en docs/010) y 5 bajos registrados en docs/003. `qa-engineer`: aprobado.

Suites completas: aprobadas en una corrida con concurrencia reducida (API `npx vitest run --maxWorkers=1 --no-file-parallelism`, 229 s; app `npx jest --ci --maxWorkers=2`, 24 s). Con la concurrencia por defecto hubo timeouts intermitentes y cambiantes (5000 ms en API; `findBy` en app) que pasan aislados. Causa investigada: presión de memoria del Dev Container (3,7 GB de RAM y swap lleno), no defectos de las pruebas ni de este cambio (indicios, no prueba directa). No se subieron timeouts ni se debilitaron pruebas. Comando de cierre recomendado con concurrencia reducida; reducir la memoria usada por el entorno antes de cerrar.

Pendientes y riesgos: validar en Android (migración 0004 y Worker ya en DEV) la vista previa visible en 360x640, el render de los emojis, la fuente al 200 %, el teclado y la barra inferior; con lista vacía la primera cuenta solo se personaliza al editarla. R6 no iniciado.

# Capacidades futuras (no iniciadas)

Registradas el 2026-10-17 por petición del usuario, fuera del alcance original. **Ninguna está implementada ni aprobada; no hay EAS Update ni i18n configurados.** Propuestas y decisiones pendientes en docs/003 «Decisión F-A / F-B»; casos de experiencia propuestos en docs/010 §20.

Orden de prioridad vigente (sin renumerar etapas existentes):

1. Completar R5.1.
2. Validar en Android real.
3. Completar R6.
4. Integrar el rediseño.
5. Retomar el alcance funcional pendiente del roadmap (Fase 6, conciliación manual con categorías, docs/003 Decisión 6.1).
6. Actualización de versiones y multidioma, en etapas posteriores.

[ ] F-A - Versiones y actualización de la app: versionName y versionCode de Android, EAS Build, EAS Update (runtimeVersion y canales), Google Play cuando corresponda, detección de nueva versión, aviso opcional y obligatorio según compatibilidad con la API, rollback, separación DEV/producción y pruebas de compatibilidad entre versiones. Estado verificado: `expo-updates`, `runtimeVersion`, `updates` y canales no existen; `eas.json` tiene `appVersionSource: remote`. Publicar en Google Play requiere cambiar primero docs/001 §3.
[ ] F-B - Multidioma: español inicial, inglés propuesto, arquitectura de traducciones y centralización de textos, formato de fechas, montos y números, mensajes del backend por código de error, detección y persistencia del idioma, accesibilidad y pruebas con textos largos. Estado verificado: sin capa de i18n; 300 a 450 cadenas estimadas por revisar.

Relación con la Fase 6: la Fase 6 vigente (conciliación manual con categorías) no añade pantallas ni códigos de error; si se añade una ayuda, su texto va en el módulo de guías para que F-B sea una migración mecánica.

## Verificación puntual de UXQA-R3-01 (2026-10-17)

Revisado en código en HEAD b7e82fa, sin ejecución en dispositivo: el defecto está **cerrado y no fue reintroducido** (docs/010 §12.8 y «Verificación puntual» en §20). Ante un fallo incierto al guardar un gasto se muestra «No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.»; `POST /transactions` no se reintenta automáticamente y no hay idempotencia (riesgo aceptado en docs/003). Se corrigieron en docs/010 las filas históricas que aún figuraban como abiertas. Pendiente en nivel D: corte de red real tras pulsar Guardar.
