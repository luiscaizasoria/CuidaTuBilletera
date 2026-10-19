# Plan de implementación del rediseño UX/UI (propuesta, pendiente de aprobación)

Estado: el usuario **aprobó el prototipo y la navegación con dos observaciones** (2026-10-15): rehacer la paleta inspirándose en el póster de referencia y mostrar la cuenta activa en todas las pantallas internas. Ambas ya están incorporadas en docs/007 §3.5, docs/008 y el prototipo. La **paleta nueva (iteración 3) quedó aprobada con el diseño en el paso 347** (docs/003, Decisión R0 D6). Nada de este plan está implementado. Complementa docs/007-DISENO-UX.md (experiencia) y docs/008-DISENO-VISUAL.md (apariencia). Prototipo: `docs/design/prototipo/index.html` (datos ficticios, sin red). Recursos de ícono generados: `docs/design/assets/` (no sustituyen los assets activos).

Convención: EXISTENTE = ya en el código o la constitución; APROBADO = decidido por el usuario; PROPUESTA = nuevo.

## 1. Restricciones verificadas (architect y lectura de código)

- EXISTENTE: no hay `DELETE /accounts`; las cuentas se archivan con `PATCH {archivada}`; `PATCH /accounts/:id` solo acepta `nombre` y `archivada` (no `saldoInicial`). La eliminación de cuenta y la edición del saldo inicial no se muestran en el diseño.
- EXISTENTE: React Navigation y TanStack Query están nombradas en docs/001 §4 pero **diferidas** (docs/003, decisiones 2B.1 D8, 3.1 D8 y 4.1 D5) por requerir módulos nativos. El diseño usa pila propia y barra inferior propia sin dependencias.
- EXISTENTE: sin metas, presupuestos ni conciliación (Fase 6). No se diseñan.
- EXISTENTE: ningún dato del usuario se cachea fuera de los componentes (docs/001 §4.7); se mantiene.
- EXISTENTE: `app.json` no define `icon`, `adaptiveIcon` ni splash; no hay carpeta `app/assets`.
- Pendiente de verificar: qué módulos nativos (`expo-font`, `@expo/vector-icons`) vienen enlazados en la build actual.

## 2. Fases propuestas (cada una: rama `feat/`, PR propio, pruebas con el código)

Orden lógico `orchestrator` → `architect` (§7 ya actualizado en R0) → `mobile-engineer` → `qa-engineer`. Secuencial, no en paralelo.

| Fase | Contenido | Dependencias nuevas | Nueva build |
| --- | --- | --- | --- |
| R0 | Documentación primero: docs/003 (paleta revisada sin degradado nativo, barra de contexto de cuenta como fuente única con relectura por `GET /accounts/:id/balance`, cuenta archivada o renombrada estando dentro, ratificación de la navegación local 2B.1/3.1 D8 y 4.1 D5, decisiones aprobadas de docs/007 §14 y docs/008 §15); docs/001 §7 solo si cambia una norma (orden del formulario, estructura de pantallas); docs/004 con R0 a R6. | No | No |
| R1 | Tokens y base: `theme/tokens.ts`, `Screen` (safe areas y teclado, opción A), `Button` 48 dp, `Card`, `Segmented`, `Snackbar`, StatusBar explícita. | No | No |
| R2 | Navegación: nuevo `MainNavigator`, Mis cuentas, Crear cuenta, Detalle con barra inferior, «Más». Retirar HomeScreen/HomeDashboard. | No | No |
| R3 | Nuevo movimiento (orden, categoría visual, teclado numérico, selector de fecha, anti doble envío, confirmación). | No | No |
| R4 | Historial, Calendario, Reportes, Categorías con el nuevo sistema visual (sin cambiar cálculos). | Ninguna: barras sin dependencia (docs/003 R4 D1) | No |
| R5 | Guías contextuales y estados vacíos. | No | No |
| R5.1 | Mejoras tras la prueba en Android: Login y botón Google oficial, «Cerrar sesión» en Mis cuentas, ícono de categoría, «+ Crear categoría» en Nuevo movimiento, mitigación de la barra de estado. Bloqueado por autorización: color e ícono de cuenta (migración D1 0004 y API), barra inferior del sistema, `react-native-safe-area-context`. Ver docs/003 «Decisión R5.1». | Ninguna (las bloqueadas requerirían módulos nativos o backend) | No para lo implementado; sí para lo bloqueado |
| R6 | Ícono, ícono adaptable, splash y nombre: `app.json` + `app/assets/`. | `expo-splash-screen` si se decide | **Sí** |

R1 a R5 se pueden entregar con la development build actual. R6 y, según decisión, R4 exigen una nueva build de Android (autorización expresa previa).

## 3. Matriz de cambios por archivo

La matriz detallada por archivo de `app/src` está en docs/007-DISENO-UX.md §13.1. Resumen por fase:

| Fase | Archivos principales |
| --- | --- |
| R1 | `app/src/theme/tokens.ts` (nuevo), `app/src/screens/ui.tsx`, `app/src/App.tsx` |
| R2 | `AccountContextBar.tsx` (nuevo; quedó dentro de `screens/account-ui.tsx`, docs/003 R2 D9), `lib/resources-api.ts` (`getAccountBalance`, endpoint existente) y `resources-test-utils.ts`, `MainNavigator.tsx` (`refreshKey`), `AccountsScreen.tsx`, `AccountDetailScreen.tsx` (absorbido en `MainNavigator.tsx`, docs/003 R2 D9), `AccountSummaryTab.tsx`, `MoreScreen.tsx` (nuevos), `HomeScreen.tsx` y `HomeDashboard.tsx` (retirar), `lib/dates.ts` |
| R3 | `TransactionFormScreen.tsx` |
| R4 | `HistoryScreen.tsx`, `CalendarScreen.tsx`, `ReportsScreen.tsx`, `CategoriesScreen.tsx`, `TransactionRow.tsx`, `DatePickerSheet.tsx` (tono neutro), `ui.tsx` (`ScreenTitle`, `SummaryTile`), `lib/calendar.ts` (día de la semana y ancho de celda); especificación en docs/007 §5.11 |
| R5 | `lib/guides.ts` (nuevo), pantallas con ayudas |
| R5.1 | `LoginScreen.tsx`, `app/assets/` (logotipo de Google), `AccountsScreen.tsx`, `SessionBanner.tsx`, `MoreScreen.tsx`, `sheets.tsx`, `lib/category-appearance.ts`, `category-form.tsx` (nuevo), `CategoriesScreen.tsx`, `TransactionFormScreen.tsx`, `MainNavigator.tsx`, `theme/useSystemInsets.ts` |
| R6 | `app/app.json`, `app/assets/*` (copiados desde `docs/design/assets/` tras aprobar) |

No se tocan `/api`, D1, sesión y autenticación, `.github/workflows` ni `tsconfig.json` de la raíz.

## 4. Impacto en pruebas

Ver docs/007-DISENO-UX.md §12. Se reescriben casi por completo `MainNavigator.test` y `HomeScreen.test`; se ajustan `App.test`, `App.resources.test`, `AccountsScreen.test`, `TransactionFormScreen.test` e `HistoryScreen.test`; Calendario y Reportes cambian poco. Mantener los `accessibilityLabel` y `testID` actuales reduce el costo. Línea base actual (docs/004, cierre de Fase 5): app 990 pruebas y API 979.

## 5. Cambios nativos (no aplicados)

- Ícono, ícono adaptable, splash y nombre visible: configuración nativa; exigen nueva development build, no se entregan por OTA.
- `react-native-svg` (dona), `expo-navigation-bar` (modo inmersivo, opción B no recomendada) y `expo-splash-screen`: módulos nativos si se eligen.
- Safe areas con la opción A recomendada: sin módulo nativo (insets con `StatusBar.currentHeight` y relleno propio). Su causa raíz (edge-to-edge sin relleno superior) es una hipótesis que hay que confirmar en el teléfono antes de implementar.

## 6. Riesgos técnicos

- Pestañas propias sin React Navigation: foco de TalkBack, restauración de estado y botón Atrás son más frágiles; el diseño permite migrar después.
- Reescritura de la navegación y de decenas de pruebas: riesgo de regresiones; mitigar con fases pequeñas y `qa-engineer` independiente.
- Cuenta archivada mientras se está en su detalle: manejar `409 ACCOUNT_ARCHIVED`.
- Los recursos de ícono salen de una imagen de baja resolución: no aptos para publicar en tienda; regenerar en vector.
- Los colores de categoría reales (API) y los del selector de la app no coinciden (docs/008, decisión 15.4).
- Sin navegador visual en el entorno: el prototipo y los recursos no se revisaron en un teléfono ni en un lanzador Android.

## 7. Decisiones que requieren aprobación

Las listas numeradas con recomendación están en docs/007-DISENO-UX.md §14 (13 decisiones UX, entre ellas el orden del formulario de movimiento, que contradice «monto primero» de docs/001 §7) y en docs/008-DISENO-VISUAL.md §15 (visuales: íconos de categoría, dona, colores de categoría, fuentes, ícono). Además:

1. Aprobar la opción A (barras del sistema respetadas) para Android.
2. Aprobar el plan R0 a R6 y su orden, y si R4 usa `react-native-svg` (nueva build).
3. Autorizar la nueva development build para R6.
4. Confirmar que «solicitar eliminación de cuenta» se resuelve con Archivar (sin cambio de contrato).

## 8. Registro de ejecución del paso de diseño

| Agente | Trabajo realizado | Evidencia de invocación (agentId) |
| --- | --- | --- |
| architect | Restricciones de arquitectura, contrato de cuentas y dependencias nativas. | a3c1d529bb0daabdd |
| general-purpose con el rol de mobile-ux-designer (sustituto) | docs/007-DISENO-UX.md. | a00780c5c7365d0b3 |
| general-purpose con el rol de mobile-visual-designer (sustituto) | docs/008-DISENO-VISUAL.md, recursos de ícono, script de contraste y prototipo. | abf0610e0aeec20b9 |

Iteración 2 (observaciones del usuario: paleta y cuenta activa visible):

| Agente | Trabajo realizado | Evidencia de invocación (agentId) |
| --- | --- | --- |
| architect | Restricciones para la barra de cuenta (fuente única, relectura de saldo, archivada/renombrada), sin cambio de contrato; degradados sin dependencia; contenido de R0. | af59ad590ed09a94f |
| mobile-ux-designer | docs/007 §3.5 (barra de contexto de cuenta), wireframes, criterios 14 a 24, §12 a §14. | a9cd24cb5f6579b9e |
| mobile-visual-designer | docs/008 (paleta nueva, contraste de 54 pares, tokens, `AccountContextBar`), `docs/design/contrast.js` y prototipo. | ad9ae3852a9416551 |

En esta iteración los dos diseñadores se invocaron con su propio tipo de agente: queda verificada su integración.

Iteración 3 (el usuario aprueba el prototipo funcional pero no su apariencia: exceso de verde, poco fiel al póster):

| Agente | Trabajo realizado | Evidencia de invocación (agentId) |
| --- | --- | --- |
| mobile-ux-designer | docs/007 §5.2 (composición de Mis cuentas), §3.6 (color por módulo), criterios 25 a 31, decisiones 14.16 a 14.19. | a549012ca9f602e33 |
| mobile-visual-designer | docs/008 (paleta, color por módulo, §16 comparación 2 → 3), prototipo, renders SVG en `docs/design/capturas/` y auditoría jsdom. | af534942affe32341 |

architect no se convocó en esta iteración: solo cambia la apariencia, sin dependencias ni contratos.

Paso 342 (agente `mobile-ux-qa`, política de interfaz móvil y matriz docs/010): se creó `.claude/agents/mobile-ux-qa.md` y se registró en CLAUDE.md y en el orquestador. La invocación nativa falló con «Agent type 'mobile-ux-qa' not found», porque el registro de agentes se carga al iniciar la sesión. **Integración pendiente de verificar en una sesión nueva**; no se usó un agente `general-purpose` como sustituto.

- Skills usadas: ninguna.
- MCP usados: ninguno.
- No utilizados: `mobile-ux-designer` y `mobile-visual-designer` como tipos de agente, porque el registro de agentes se carga al iniciar la sesión y la invocación directa falló con «Agent type not found». Se ejecutaron con agentes `general-purpose` siguiendo sus archivos de definición. `mobile-engineer`, `qa-engineer`, `backend-engineer` y `devops-engineer`: fuera del alcance de este paso. No hubo agente `orchestrator` subordinado: la coordinación la hizo la conversación principal.

## 9. Estado previo a R0 (paso 346)

- Defectos de la validación UX del prototipo: D1 y D2 (altos) corregidos y revalidados por `mobile-ux-qa` a 360 y 412 px; D3, D4, D6, D7 corregidos; D5 resuelto como excepción aprobada P-3. P-1 y P-2 aprobadas (docs/007 §14.A). No quedan defectos críticos ni altos abiertos a nivel de render.
- Brecha UXQA-D2-02 de `audit.js` (recorte vertical aceptado como accesible): corregida (el recorte vertical ahora es bloqueante) y verificada reintroduciendo el defecto en una copia.
- Condiciones para R0: la validación de Android real (niveles A y D de docs/010: safe areas, teclado, Atrás con gestos y tres botones, fuente 130 % y 200 %, TalkBack, emojis y fuente Nunito reales) sigue PENDIENTE y se ejecutará con el teléfono del usuario; las mediciones de texto deben repetirse allí. Los valores de `sizes` de docs/008 §11 quedaron aprobados como valores iniciales en el paso 347 (docs/003, Decisión R0 D8); se vuelcan a tokens en R1 y se ajustan tras la medición en Android real.
- Herramientas: `docs/design/{render,audit,verify}.js` con Chromium fuera del repo (docs/010 §8); sin script de instalación versionado.

## 10. R5.1 - Ampliación de íconos y estudio de navegación inmersiva (paso 362, 2026-10-17)

- Implementado en local: `icon-catalog.ts` (249 entradas), `icon-picker-sheet.tsx` (fila «Ícono» y hoja «Elegir ícono», con `iconSheetLayout` para repartir alturas), enum de cuentas de la API ampliado a 246 claves y pruebas (docs/003 D13).
- Orden de despliegue: pruebas de la API, Worker DEV (autorización expresa), luego app. Sin migración.
- Navegación inmersiva (docs/003 D14): no implementada. Si se aprueba requiere, en este orden: cambio de docs/001, `react-native-safe-area-context` (insets), `expo-navigation-bar`, cambio de `app.json` y nueva Development Build; pruebas INM-01 a INM-10 (docs/010 §21.1) en gestos y tres botones.
- Safe areas: `useSystemInsets` seguiría siendo el único origen aplicado solo por `Screen`, `MainNavigator`, `Sheet` y `Snackbar`; sin márgenes por modelo.
- La prueba inmersiva se propone para R6 (requiere aprobación, cambio de docs/001, dependencias nativas y nueva Development Build).
- Las etapas futuras F-A y F-B se conservan sin cambios.

## 11. R5.1 - Flechas de grupos y plan de barra inferior (paso 366, 2026-10-17)

- Implementado en local: `GroupBar` y `lib/chip-scroll.ts` (docs/003 D15); sin dependencias, API ni D1.
- Plan nativo (docs/003 D16), en este orden y solo con autorización: (1) cambiar docs/001 línea ~230; (2) `npx expo install expo-navigation-bar react-native-safe-area-context`; (3) plugin `expo-navigation-bar` en `app.json`; (4) `SafeAreaProvider` en `App.tsx` y `useSystemInsets` sobre `useSafeAreaInsets()` conservando `{top, bottom}` (Screen, MainNavigator, Sheet y Snackbar no cambian); (5) componente que llama a `NavigationBar.setHidden(true)` al montar y en `AppState` activo, desactivado con TalkBack y sin reocultar con teclado abierto; (6) Development Build nueva y APK; (7) INM-01 a INM-10 con gestos y tres botones en teléfono real.
- No se usan `setVisibilityAsync` ni `setBehaviorAsync` (obsoleta/no disponible en SDK 57).
- Las etapas futuras F-A y F-B se conservan sin cambios.

## 12. R5.1 - Modo inmersivo e insets reales implementados (paso 367, 2026-10-17)

- Aprobado en docs/001 y docs/003 D17; el plan nativo de §11 se ejecutó: dependencias, plugin, `SafeAreaProvider`, `useSystemInsets` sobre `SafeAreaInsetsContext`, `navigationBarTranslucent` en `Sheet`, `lib/immersive.ts` y `hooks/use-immersive-navigation.ts`.
- Corrección de diseño: `NavigationBar.setHidden` ignora valores repetidos (caché JS), por lo que al pasar a segundo plano se pide `false` y al volver a `active` se reaplica el valor vigente.
- Development Build `7c58a37f-e2d5-4e27-85f7-2c3fedb575a9` (docs/004). El código del modo inmersivo se consolida en commits locales en el paso 372 (cierre funcional en docs/003 D18 y docs/004).
- Sin validación en dispositivo: INM-01 a INM-24 (docs/010 §21.1), con gestos y tres botones. Los APK anteriores no cargan este código.
- Las etapas futuras F-A y F-B se conservan sin cambios.

## 13. R6 - Preparación (paso 373) e implementación (paso 374, sin commit de código ni validación en dispositivo)

- Decisiones y recursos en docs/003 «Decisión R6» y docs/008 §13.2; vista previa en `docs/design/prototipo/r6-vista-previa.html`.
- Secuencia al aprobarse: `mobile-visual-designer` (regenerar primer plano, monocromático y splash) → `mobile-engineer` (copiar recursos, `app.json`, `expo-splash-screen`, alcancía y pruebas) → `mobile-ux-qa` → `qa-engineer` → `devops-engineer` (Development Build nueva, con autorización expresa) → validación en Android real (build `preview` para splash e ícono temático).
- Archivos previstos: `app/app.json`, `app/package.json`, `package-lock.json`, `app/assets/*`, `app/src/screens/ui.tsx`, `AccountsScreen.tsx`, `app/src/theme/tokens.ts` (retirar `pigZoom`) y sus pruebas.
- Las etapas futuras F-A y F-B se conservan sin cambios.
- Paso 374: R6 implementada (docs/003 «Decisión R6», docs/004 paso 374). Development Build `bcc026f3-b895-4a7a-a036-ec173e01c934` (versionCode 2). Pendiente: validar en Android real y, para splash e ícono temático, en una build `preview`; commit y PR del código (con autorización).
