# Matriz de pruebas UX/UI de la app móvil

Matriz reutilizable con la que `mobile-ux-qa` valida cualquier cambio visible de la interfaz móvil (política de CLAUDE.md, «Coordinación y delegación»). Se aplica al rediseño (docs/007, docs/008 y docs/009) y a las fases siguientes. Los criterios detallados de cada pantalla están en docs/007 §11.2 (criterios 1 a 31, trazados en §9) y los tokens y contrastes en docs/008.

Estado actual: **R2 validada por código y pruebas Jest (nivel A y T) y sin dispositivo**; el resultado está en el §11. Las demás fases (R3 a R6) no están ejecutadas. Ninguna fila está validada en dispositivo Android real (nivel D) ni con TalkBack.

## 1. Niveles de evidencia

Cada resultado declara su nivel. Un nivel inferior nunca se presenta como uno superior.

| Nivel | Qué es | Herramienta disponible hoy | Qué no demuestra |
| --- | --- | --- | --- |
| **A** Automática | Jest + Testing Library (`jest-expo`) con API, sesión y `BackHandler` simulados | `npm run test` en `app/` | Diseño real en pantalla, safe areas, teclado, gestos |
| **T** Tokens | Contraste WCAG y uso de tokens | `node docs/design/contrast.js --check` | Que la pantalla use esos tokens |
| **R** Render | Render SVG→PNG aproximado o captura de navegador del prototipo, comparado con `docs/design/capturas/` | Script de render del diseñador (hoy fuera del repositorio, ver §8) | Comportamiento Android real; fuente y emojis exactos |
| **D** Dispositivo | Teléfono Android real con la development build, capturas de pantalla y, si aplica, TalkBack | Manual, con el teléfono del usuario | — |

Sin un emulador ni un dispositivo conectado al entorno, los casos que exigen **D** quedan **pendientes** y así se informan.

## 2. Dimensiones por pantalla

Cada pantalla se evalúa en estas dimensiones. «N/A» se justifica.

| Código | Dimensión | Pregunta de verificación |
| --- | --- | --- |
| NAV | Navegación | ¿Se llega y se sale como dice docs/007 §3 y la tabla de Atrás §3.4? |
| DIS | Diseño | ¿Coincide con el prototipo y las capturas aprobadas (tokens, color del módulo §3.6, una acción principal)? |
| INF | Información | ¿Muestra los datos correctos (saldo, totales, fechas, montos con signo) sin datos inventados? |
| ACC | Acciones | ¿Cada botón hace lo esperado y lleva al destino correcto? ¿Doble envío bloqueado? |
| EST | Estados | Carga, error con reintento, vacío ilustrado, éxito; nunca «$0.00» por fallo |
| A11Y | Accesibilidad | Roles, etiquetas, 48 dp, contraste AA, fuente del sistema al 130 % y 200 %, TalkBack |
| SAFE | Safe areas | Nada bajo la barra de estado ni bajo la barra de navegación del sistema |
| TAM | Tamaños | 360×640 dp (pequeña), 412×915 dp (grande); solo vertical (`orientation: portrait`) |
| CTX | Cuenta activa | Barra de contexto con nombre y saldo coherente (docs/007 §3.5) |

## 3. Matriz pantalla × dimensión

Leyenda: nivel mínimo de evidencia exigido para cerrar (A, T, R, D). «—» = no aplica.

| Pantalla | NAV | DIS | INF | ACC | EST | A11Y | SAFE | TAM | CTX | Puntos clave |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bienvenida / login | A | R+D | A | A | A | A+D | D | R+D | — | Botón Google único; error de login comprensible; sin verde dominante |
| Mis cuentas | A | R+D | A | A | A | A+D | D | R+D | — | Primera pantalla autenticada; tarjetas de color estable; total = suma real; Archivadas colapsadas; perfil y Cerrar sesión |
| Crear cuenta | A | R | A | A | A | A+D | D | D | — | Nombre obligatorio; saldo inicial en centavos; teclado numérico; ayuda del saldo inicial |
| Detalle de cuenta | A | R+D | A | A | A | A+D | D | R+D | A | Tarjeta de saldo; ingresos y gastos del período; semana; barra inferior de 5 pestañas |
| Nuevo movimiento | A | R+D | A | A | A | A+D | D | D | A | Orden aprobado; categorías con ícono; anti doble envío; confirmación; vuelve y refresca saldo |
| Historial | A | R | A | A | A | A+D | D | D | A | Filtros plegables; chips activos; «Cargar más»; anulados |
| Calendario | A | R | A | A | A | A+D | D | D | A | Lógica aprobada intacta; mes, día, totales y neto; registrar desde la fecha |
| Reportes | A | R | A | A | A | A+D | D | D | A | Mes, año y rango; totales; desglose por categoría; sin datos |
| Exportación CSV/PDF | A | R | A | A | A | A+D | D | D | A | Botones con estado «Exportando…»; error comprensible; hoja de compartir (solo D) |
| Más / Configuración | A | R | A | A | A | A+D | D | D | A | Datos de cuenta solo nombre; Archivar separado y confirmado; sin «Eliminar cuenta» |
| Categorías | A | R | A | A | A | A+D | D | D | A | Por tipo; eliminar solo sin movimientos, si no archivar; mensaje `CATEGORY_IN_USE` |
| Cierre de sesión | A | — | A | A | A | A | — | — | — | Vuelve al login; no quedan datos del usuario anterior en memoria ni exportaciones |

## 4. Casos Android transversales

| ID | Caso | Pantallas | Qué se verifica | Nivel | Automatizable |
| --- | --- | --- | --- | --- | --- |
| AND-01 | Barra superior con reloj y batería | Todas | Encabezado y barra de contexto por debajo de la barra de estado; texto de la barra legible | D | Parcial: A comprueba que el contenedor `Screen` aplica el relleno superior |
| AND-02 | Barra inferior de navegación del sistema | Con barra inferior propia o botón al pie | Pestañas, FAB y botones no quedan bajo la barra del sistema | D | Parcial: A sobre el relleno inferior |
| AND-03 | Teclado abierto | Crear cuenta, Nuevo movimiento, filtros de Historial, rango de Reportes, Categorías | Campo activo y «Guardar» visibles o alcanzables con scroll; barra de contexto compacta | D | No |
| AND-04 | Teclado cerrado | Las mismas | El diseño vuelve a su estado sin huecos | D | No |
| AND-05 | Botón Atrás | Todas | Sigue la tabla de docs/007 §3.4; en Mis cuentas cierra la app; descarta formulario con confirmación si aplica | A + D | Sí: `BackHandler` simulado en Jest |
| AND-06 | Navegación por gestos | Todas | Gesto Atrás equivale al botón; el gesto inferior no activa pestañas | D | No |
| AND-07 | Navegación con tres botones | Todas | Barra del sistema más alta: contenido inferior alcanzable | D | No |
| AND-08 | Pantalla pequeña (360×640 dp) | Todas | Sin recortes; dos cuentas visibles sin desplazar; etiquetas de pestaña completas | R + D | Parcial: render a 360 |
| AND-09 | Scroll largo | Mis cuentas, Detalle, Historial, Reportes, Categorías | Último elemento alcanzable por encima de la barra inferior y del FAB | D | Parcial: A sobre `contentContainerStyle` |
| AND-10 | Textos extensos | Nombre de cuenta y categoría largos, montos grandes, fuente al 200 % | Elipsis en la barra de contexto; montos completos; nada se superpone | A + R + D | Sí: A con nombres largos |
| AND-11 | Cambio de cuenta | Detalle y pestañas | Barra de contexto, saldo, movimientos y filtros corresponden a la cuenta nueva; no se mezclan datos | A | Sí |
| AND-12 | Sesión cerrada | Desde Más o perfil, y sesión expirada | Vuelve al login; pila descartada; exportaciones borradas; el siguiente usuario no ve datos previos | A | Sí |
| AND-13 | Red lenta o indisponible | Todas las que cargan datos | Indicador de carga; error con «Reintentar»; botones bloqueados durante el envío; saldo nunca inventado | A + D | Sí: API simulada con demora y fallo |

## 5. Pruebas automáticas previstas (nivel A)

Se escriben con la implementación de cada fase de docs/009 y las ejecuta `mobile-ux-qa`, sin modificar las existentes.

| Ámbito | Prueba | Fase |
| --- | --- | --- |
| Navegación | La primera pantalla autenticada es Mis cuentas; entrar a una cuenta abre la pestaña Cuenta; Atrás según §3.4 (`BackHandler` simulado) | R2 |
| Cuenta activa | La barra muestra nombre y saldo en cada pestaña y en Nuevo movimiento; tras guardar se pide `getAccountBalance` y cambia el saldo; con fallo muestra «Saldo no disponible»; archivada deshabilita «Nuevo movimiento» | R2, R3 |
| Formularios | Orden de campos; teclado `decimal-pad`/`number-pad`; validaciones con mensaje; un solo `createTransaction` con doble toque; confirmación y regreso | R3 |
| Acciones | Cada botón de Mis cuentas, Detalle, Más y Categorías invoca el método de API o la ruta esperados | R2 a R4 |
| Estados | Carga, error con reintento, vacío y éxito en cada pantalla con datos | R2 a R5 |
| Accesibilidad | `accessibilityRole`, `accessibilityLabel` y `accessibilityState` en botones, pestañas (`tab`), chips (`radio`) y barra de contexto; `minHeight` ≥ 48 en componentes base | R1 |
| Tokens | Los componentes base usan `theme/tokens.ts`; `contrast.js --check` sin fallos | R1 |
| Textos | Textos clave de docs/007 §7 (ayudas, vacíos, confirmaciones, errores) presentes | R5 |
| Sesión | Cerrar sesión desmonta el navegador y llama a `clearExports` | R2 |
| Regresión | Suites existentes de Calendario, Reportes y exportación siguen en verde | Todas |

Los cálculos financieros y los contratos no se prueban aquí: son de `qa-engineer` y de las pruebas de la API.

## 6. Validación visual

1. Comparar cada pantalla implementada con el prototipo (`docs/design/prototipo/index.html`) y las capturas aprobadas (`docs/design/capturas/`, renders SVG aproximados).
2. En dispositivo (nivel D): capturas a 360 y 412 dp de ancho, con navegación por gestos y por tres botones. **Nomenclatura única** (la misma de `docs/design/capturas/`): `<pantalla>-<ancho>.png`, donde `<pantalla>` es uno de `bienvenida`, `mis-cuentas`, `crear-cuenta`, `detalle`, `nuevo-movimiento`, `historial`, `calendario`, `reportes`, `mas`, `categorias`, y `<ancho>` el ancho en dp (`360`, `412`). El prefijo `antes-` marca la línea base previa al rediseño (ejemplo `antes-detalle-360.png`). La variante de modo (gestos, tres botones, fuente 130 %/200 %, teclado abierto) **no va en el nombre**: va en la carpeta, `docs/design/capturas/<nivel>/<variante>/<pantalla>-<ancho>.png`, con `<nivel>` = `render` o `dispositivo` y `<variante>` = `gestos`, `tres-botones`, `fuente-130`, `fuente-200`, `teclado`; las capturas de render a fuente 100 % y gestos quedan en la raíz de `docs/design/capturas/`.
3. Revisar: color del módulo, una sola superficie fuerte, tarjetas de cuenta diferenciadas, barra de contexto, jerarquía de botones, ausencia de grandes superficies verdes.
4. Las diferencias se clasifican como defecto (contradice el diseño aprobado) o como observación (mejora no exigida).

Modo oscuro: **no aplica** mientras `app.json` declare `userInterfaceStyle: light`. Si se habilita, se añade la columna correspondiente.

## 7. Defectos y criterio de bloqueo

Formato: `UXQA-<n>` · pantalla · caso (por ejemplo AND-03 o DIS) · severidad · pasos · esperado (con referencia a docs/007 o docs/008) · obtenido · evidencia (nivel y archivo o salida).

| Severidad | Ejemplos | Efecto |
| --- | --- | --- |
| Crítica | Dato financiero incorrecto en pantalla; acción en la cuenta equivocada; contenido inalcanzable bajo una barra del sistema | Bloquea cierre, PR, build y publicación |
| Alta | Barra de cuenta ausente o con saldo desactualizado; Atrás pierde datos sin aviso; contraste por debajo de AA en texto; doble registro posible | Bloquea cierre, PR, build y publicación |
| Media | Jerarquía o color de módulo distinto del aprobado; ayuda ausente; estado vacío sin guía | Se corrige antes de cerrar la fase o se acepta expresamente |
| Baja | Ajustes de espaciado o texto | Se registra; no bloquea |

## 8. Pendientes y riesgos de la matriz

- Sin emulador ni dispositivo en el Dev Container: todo el nivel D depende de pruebas manuales con el teléfono del usuario.
- Herramientas visuales (nivel R) incorporadas en `docs/design/`: `render.js` (capturas `<pantalla>-<ancho>.png` a 360 y 412), `audit.js` (zonas táctiles de 48, desborde horizontal, elementos fuera de borde y controles sin nombre, incluidos el panel de filtros y el modo Rango) y `verify.js` (navegación de 26 pasos, `contrast.js --check`, capturas y auditoría en un informe). Son ESM sin dependencias del proyecto.
- Playwright y Chromium viven FUERA del repo, en `/home/node/herramientas-qa/` (instalados sin tocar `app/` ni `api/`; las librerías del sistema se extrajeron en una carpeta local, sin instalar paquetes). Uso: `source /home/node/herramientas-qa/env.sh` y luego `node docs/design/verify.js`. Las salidas van a `/home/node/herramientas-qa/salidas/`, no sobrescriben `docs/design/capturas/` (aprobadas). En un contenedor nuevo hay que reinstalarlo (`npm i playwright` + `npx playwright install chromium` + librerías `.deb` extraídas); no hay script de instalación versionado.
- Limitaciones: sin fuente emoji ni Nunito en el contenedor, los emojis salen como recuadros y los anchos de texto pueden diferir de Android; las mediciones son de Chromium, no de Android (los niveles A y D siguen pendientes).
- Clasificación de hallazgos de `audit.js` (paso 346): (a) bloqueantes: táctil <48 sin excepción, desborde horizontal, fuera de borde, controles sin nombre, pestañas solapadas, palabras partidas y recorte vertical (`line-clamp`/overflow) —nunca se aceptan—; (b) excepción aprobada P-3 (`EXCEPCIONES`): celdas de día del calendario a <400 dp, ≥44×48 y sin solape; se listan aparte, no se ocultan; (c) truncados permitidos: solo elipsis horizontal con el texto completo en `title`/`aria-label`; (d) pendientes de Android real (no medibles aquí). Estados medidos: 10 pantallas, filtros de Movimientos, rango de Reportes y Nuevo movimiento con nombres de categoría de hasta 40 caracteres inyectados, a 360 y 412.
- Resultado reproducible del paso 346 (nivel R): `verify.js` cumple (navegación de 26 pasos, contraste, 20 capturas, 0 incumplimientos; 31 celdas con P-3 y 4 truncados accesibles aceptados). Copia de los informes en `/home/node/respaldo-diseno-345/salidas-verify/`. Se comprobó que la auditoría detecta el defecto D2 anterior reintroduciéndolo en una copia temporal del prototipo (restaurado y verificado byte a byte).
- Las pruebas de nivel A no detectan problemas de safe areas ni de teclado: no sustituyen al nivel D.

## 9. Trazabilidad: criterio de docs/007 §11.2 -> pantalla -> caso -> nivel

Cada criterio de aceptación se cubre con al menos un caso. «Caso» usa los códigos de §2 (dimensiones) y §4 (AND-nn); «Nivel» es el mínimo para cerrar. Los criterios 24, 25 a 31 dependen de decisiones 14.x aún ABIERTAS (docs/007 §14.A): si se rechazan, el caso se retira. Todos los criterios de objetivos táctiles se miden en el prototipo con los marcadores `data-hit` (`48`, `extended`) y en la app con `minHeight`/`hitSlop`.

| Criterio | Resumen | Pantalla(s) | Caso | Nivel |
| --- | --- | --- | --- | --- |
| 1 | Nada bajo barra de estado ni inferior (gestos y 3 botones) | Todas | SAFE, AND-01, AND-02, AND-06, AND-07 | D (A parcial) |
| 2 | Barra de contexto y 5 pestañas; estado por pestaña | Detalle y pestañas | NAV, CTX, AND-11 | A |
| 3 | Tras login, Mis cuentas; sin «Sesión iniciada» | Bienvenida, Mis cuentas | NAV, INF | A |
| 4 | Atrás según tabla 3.4 | Todas | NAV, AND-05 | A + D |
| 5 | Orden del formulario, teclado numérico, fecha, anti doble envío | Nuevo movimiento | ACC, EST | A |
| 6 | Éxito, regreso y Reintentar sin perder datos | Nuevo movimiento | EST, ACC, AND-13 | A |
| 7 | Saldo, ingresos, gastos del período y semana | Detalle | INF | A |
| 8 | Más: solo nombre, Archivar confirmado, sin eliminar cuenta | Más | ACC, INF | A |
| 9 | `CATEGORY_IN_USE` con alternativa de archivar | Categorías | EST, ACC | A |
| 10 | 48 dp efectivos, roles, etiquetas, sin información solo por color | Todas | A11Y, TAM | A + R (`data-hit`) + D |
| 11 | Fuente 200 % sin truncar T2 | Nuevo movimiento, Detalle | A11Y, AND-10 | R + D |
| 12 | Cierre de sesión borra pila, cuenta y exportaciones | Cierre de sesión | AND-12 | A |
| 13 | Typecheck, lint, Prettier y pruebas en verde | `app` | (qa-engineer) | A |
| 14 | Barra de contexto presente/ausente por pantalla; saldo salvo en Cuenta | Todas las internas, Login, Mis cuentas, Crear cuenta | CTX, DIS | A + R |
| 15 | Fuente única: pestañas no piden saldo | Detalle y pestañas | CTX, ACC | A |
| 16 | Un solo `getAccountBalance` tras crear/editar/anular | Nuevo movimiento, Detalle | CTX, ACC, INF | A |
| 17 | Saldo pendiente/fallido nunca «$0.00» | Barra de contexto | EST, AND-13 | A |
| 18 | Renombrar actualiza la barra sin pedir saldo | Más, barra | CTX, ACC | A |
| 19 | Archivar vuelve a Mis cuentas; archivada deshabilita Nuevo movimiento | Más, Detalle, Calendario | ACC, EST, CTX | A |
| 20 | 409 `ACCOUNT_ARCHIVED` con «Volver a la cuenta» | Nuevo movimiento | EST, ACC | A |
| 21 | Nombre de 60 caracteres y saldo negativo | Barra, Mis cuentas | AND-10, INF | A + R |
| 22 | Accesibilidad de la barra (sin `header`, etiqueta, 48 dp, foco) | Barra de contexto | A11Y | A + D (TalkBack) |
| 23 | Teclado abierto: barra compacta y Guardar visible | Nuevo movimiento | AND-03, AND-04 | D |
| 24 | Selector rápido de cuenta (14.14 aprobada) | Barra, Detalle | CTX, NAV, AND-11 | A |
| 25 | Encabezado de Mis cuentas, saludo, avatar 48 dp, alcancía decorativa | Mis cuentas | DIS, A11Y, INF | A + R |
| 26 | Alcancía 72/48/ausente según fuente y ancho | Mis cuentas | TAM, AND-08, AND-10 | R + D |
| 27 | Todo visible sin desplazar en 360 × 640; sin huecos > 24 dp en 412 × 915 | Mis cuentas | TAM, AND-08 | R + D |
| 28 | Total = suma exacta; oculto en carga/error/0-1 cuentas (14.16 aprobada) | Mis cuentas | INF, EST | A |
| 29 | Tarjeta = un botón, ≥ 88 dp (92 con ≥ 400), etiqueta, color estable | Mis cuentas | DIS, A11Y, ACC | A + R (`.acard`) |
| 30 | Una acción primaria; Cerrar sesión en hoja de perfil, sin confirmación (docs/003 Decisión R2 D8) | Mis cuentas | ACC, DIS | A + R |
| 31 | Color por módulo: estado en escala de grises, título `header`, FAB uniforme | Detalle y pestañas | DIS, A11Y | T + R |

Cobertura: criterios 1 a 31 sin huecos. Los casos AND-nn sin criterio propio (AND-09 scroll largo) se ejecutan como regresión de las pantallas con lista.

## 10. Plantilla de informe de ejecución

Un informe por ejecución. Se guarda en la conversación del encargo (no en el repositorio) salvo que el usuario pida archivarlo. No se declara «aprobado» un criterio cuyo nivel exigido no se ejecutó: queda **PENDIENTE** y se dice por qué.

```
Informe de ejecución UX-QA
Fecha / hora:
Rama y commit evaluados:
Ejecutor (agente) y agentId:
Alcance (fase de docs/009, pantallas):
Entorno: nivel(es) usados (A / T / R / D), versión del prototipo o build,
         dispositivo y Android (nivel D), anchos probados (360 / 412), modo de navegación

Resumen: criterios OK n / FALLA n / PENDIENTE n de 31 ; defectos por severidad (C / A / M / B)
Decisión: PUEDE CERRAR | BLOQUEADO (defecto crítico o alto abierto) | CIERRE CON ACEPTACIÓN EXPRESA

Resultados por criterio (uno por fila del §9)
| Criterio | Pantalla | Caso | Nivel exigido | Nivel ejecutado | Resultado (OK / FALLA / PENDIENTE) | Evidencia (ruta o salida) | Defecto |

Defectos (formato del §7)
UXQA-<n> · pantalla · caso · severidad · pasos · esperado (docs/007 o 008) · obtenido · evidencia

Capturas (nomenclatura del §6): lista de rutas <pantalla>-<ancho>.png

Pendientes y limitaciones (qué no se pudo demostrar y por qué)
Regresión: suites relacionadas ejecutadas por qa-engineer (comando y resultado)
```

## 11. Informe de ejecución R2 (navegación centrada en cuentas)

```
Informe de ejecución UX-QA - R2
Fecha: 2026-10-16
Rama y commit evaluados: feat/rediseno-ux-ui sobre 107a495, con los cambios de app/src SIN commit
Ejecutor: mobile-ux-qa (agentId: lo registra quien coordina; no se dispone aquí)
Alcance: R2 de docs/009 (Mis cuentas, Crear cuenta, Detalle con 5 pestañas, Más, selector y hoja de perfil,
         barra de contexto) y cambios visuales recientes (Button link, accountIcon, archivedRow, yellowBorder, depth.scrim)
Entorno: niveles A (Jest) y T (contrast.js + cálculo WCAG propio) y revisión de código. Sin R ni D:
         no hay emulador, dispositivo ni TalkBack; no se probó 360/412 dp, gestos ni tres botones.
Resumen R2: no se ha ejecutado ningún nivel D ni R; criterios con nivel A completo: OK; el resto PENDIENTE.
Decisión: sin defectos críticos ni altos. APROBADO CON OBSERVACIONES (4 medias/bajas a corregir o aceptar; ver abajo).
          El cierre de R2 sigue condicionado a la validación en dispositivo (nivel D) de los criterios marcados PENDIENTE.
```

### 11.1 Comandos y resultados (nivel A/T)

| Comando | Resultado |
| --- | --- |
| `cd app && npx jest --ci --maxWorkers=2` | 34 suites, **1168 pruebas, todas en verde** |
| `cd app && npx tsc --noEmit` | sin errores |
| `cd app && npx eslint src --max-warnings=0` | sin avisos |
| `node docs/design/contrast.js --check` | código de salida 0 |
| Cálculo WCAG propio de pares de `tokens.ts` (script en scratchpad, no versionado) | `expenseText`/`segBg` 5,52; `expenseText`/blanco 6,38; `expenseText` sobre tarjetas rosa/albaricoque 5,54/5,71; `income`/blanco 4,99; `expense`/blanco 4,82; blanco/`dangerSolid` 4,82; `yellowText`/`yellowSoft` 6,86; `brand700`/blanco 7,49 y /`bg` 7,26; `text2`/`archivedRow` 6,71; `text2` sobre las 6 tarjetas de cuenta 6,5 a 7,0; tinta/mosaico de módulo 7,2 a 8,4; blanco/`brand700` 7,49. Todos ≥ 4,5 (texto). `yellowBorder` frente a blanco 1,67 y a `yellowSoft` 1,48: borde decorativo, la etiqueta «Archivada» lleva texto (ver UXQA-R2-03). |

### 11.2 Resultados por criterio de docs/007 §11.2 relevantes para R2

| Criterio | Pantalla | Nivel exigido | Nivel ejecutado | Resultado | Evidencia (archivo: prueba) | Defecto |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Safe areas | Todas | D (A parcial) | A parcial | PENDIENTE | `ui.test.tsx` (relleno superior/inferior de `Screen`); `MainNavigator.test.tsx` «cada ruta tiene exactamente un Screen» (sin doble relleno en código: `Screen` con scroll suma `insets.bottom`, sin scroll usa `screen-bottom-inset`, con `bottomBar` lo pone `BottomTabs`). Lo real depende del respaldo de 48 dp de `useSystemInsets` | — |
| 2 Barra de contexto y 5 pestañas | Detalle | A | A | OK | `MainNavigator.test.tsx` «las cinco pestañas; FAB solo en Cuenta, Movimientos y Calendario», «la barra muestra el saldo en las pestañas distintas de Cuenta»; `account-ui.test.tsx` «tablist con cinco pestañas» | — |
| 3 Tras login, Mis cuentas; sin «Sesión iniciada» | Bienvenida, Mis cuentas | A | A | OK | `App.test.tsx` (`findHome` = encabezado «Mis cuentas»); no queda «Sesión iniciada» en `app/src` fuera de pruebas | — |
| 4 Atrás (tabla 3.4) | Todas | A + D | A | A: OK; D: PENDIENTE | `MainNavigator.test.tsx` (Atrás: pestaña -> Cuenta -> Mis cuentas; Categorías -> Más; Nuevo movimiento -> origen; Reportes -> Historial filtrado -> Reportes; ignorado al guardar; raíz no se intercepta; una sola suscripción); `navigation.test.ts`; `sheets.test.tsx` y `AccountsScreen.test.tsx` (hoja cerrada con `onRequestClose`). Gestos y tres botones: sin dispositivo | — |
| 5-6 Formulario de movimiento | Nuevo movimiento | A | — | FUERA DE R2 (R3) | Solo se comprobó el cableado de R2 (`onDone(changed)`, 409) | — |
| 7 Saldo, ingresos/gastos del mes y semana | Detalle | A | A | OK | `AccountSummaryTab.test.tsx` (saldo del contenedor, resumen `GET /reports/summary`, semana lunes a domingo, máx. 10, filtros, vacíos) | — |
| 8 Más: solo nombre, Archivar confirmado, sin eliminar | Más | A | A | OK | `MoreScreen.test.tsx` (título/secciones sin eliminar ni conciliar; renombrar solo `nombre`; archivar con `Alert` que nombra la cuenta, Cancelar no llama al PATCH). Texto del `Alert` idéntico a docs/007 §7 | — |
| 9 `CATEGORY_IN_USE` | Categorías | A | — | FUERA DE R2 (R4) | Solo cableado del 409 `ACCOUNT_ARCHIVED` | — |
| 10 48 dp, roles, etiquetas | Todas | A + R + D | A (código) | A: OK; R y D: PENDIENTE | `minHeight` ≥ 48 en `Button`, `Chip`, pestañas (62), `exit`/`retry`/`infoTouch` de la barra, avatar (48×48), `MonthArrow` (`arrowTouch` 48×48, círculo visible 40; prueba «flechas de mes: zona táctil de 48 dp»), filas del selector (56), «Opciones avanzadas» y «Archivadas (n)» (48). `Chip sm` 36 dp + `hitSlop` 6 arriba y abajo = 48 en vertical (`ui.test.tsx`); **no se usa aún en ninguna pantalla** y `hitSlop` es solo vertical (ver UXQA-R2-05). Roles: `tab`, `tablist`, `radio`/`radiogroup`, `button` con estado `expanded`/`selected`/`busy`/`disabled` | UXQA-R2-05 |
| 11 Fuente 200 % | Detalle | R + D | A (modo de dos filas de la barra) | PENDIENTE | `account-ui.test.tsx` «fuente grande: dos filas» | — |
| 12 Cierre de sesión | Mis cuentas, Más | A | A | OK | `MainNavigator.test.tsx` (desmontar llama a `clearExports`; otro usuario sin rastro), `App.resources.test.tsx` (sin fuga entre usuarios), `AccountsScreen.test.tsx`/`MoreScreen.test.tsx` (Cerrar sesión sin confirmación, docs/003 R2 D8) | — |
| 13 Typecheck, lint, pruebas | `app` | A | A | OK (ver §11.1) | — | — |
| 14-15 Barra por pantalla; fuente única | Internas | A + R | A | A: OK; R: PENDIENTE | Variantes `full`/`readOnly`/`compact` según ruta (`MainNavigator.tsx`); «recorrer las pestañas no relee el saldo ni la lista» | — |
| 16 Un solo `getAccountBalance` | Detalle | A | A | OK | `MainNavigator.test.tsx` «guardar (changed=true) relee el saldo exactamente una vez»; «Cancelar o editar sin cambios no relee»; «anular relee» | — |
| 17 Saldo nunca «$0.00» | Barra, Mis cuentas | A | A | OK | `account-ui.test.tsx` (`balanceText` null ante valores no enteros seguros; error: «Saldo no disponible», sin saldo viejo); `AccountSummaryTab.test.tsx`; `MainNavigator.test.tsx` «error de saldo ... Reintentar» | — |
| 18 Renombrar actualiza la barra sin pedir saldo | Más, barra | A | A | OK | `MainNavigator.test.tsx` «renombrar actualiza la barra con la respuesta del PATCH, sin releer el saldo» | — |
| 19 Archivar vuelve a Mis cuentas; archivada deshabilita Nuevo movimiento | Más, Detalle | A | A | OK | `MainNavigator.test.tsx` «archivar con confirmación vuelve a Mis cuentas con Archivadas desplegada y el aviso», «cancelar el archivado...», «una cuenta archivada se abre en modo consulta»; `account-ui.test.tsx` «deshabilitado (cuenta archivada)» | — |
| 20 409 `ACCOUNT_ARCHIVED` con «Volver a la cuenta» | Nuevo movimiento | A | A (solo marcar la cuenta) | OK en R2 / resto R3 | «409 ACCOUNT_ARCHIVED marca la cuenta como archivada (modo consulta)» | — |
| 21 Nombre de 60 caracteres y saldo negativo | Barra, Mis cuentas | A + R | A (código: `numberOfLines={1}` + elipsis, signo y `expenseText` en negativos) | A: OK; R: PENDIENTE | `AccountsScreen.test.tsx` «tarjetas: ... saldo con signo»; Total con negativos | — |
| 22 Accesibilidad de la barra | Barra | A + D (TalkBack) | A | A: OK; TalkBack: **PENDIENTE (no ejecutado)** | Rol `text` (sin `header`), etiqueta con nombre/saldo/«archivada», selector con pista; `account-ui.test.tsx` | — |
| 23 Teclado abierto | Crear cuenta, Nuevo movimiento | D | — | **PENDIENTE (D)** | `KeyboardAvoidingView` sin comportamiento en Android (`behavior` indefinido): depende de `adjustResize`/edge-to-edge, no verificable aquí | — |
| 24 Selector rápido de cuenta | Barra | A | A | OK | `sheets.test.tsx` (solo activas, ✓ aparte, ninguna marcada si la activa está archivada, error con Reintentar, cerrada no carga); `MainNavigator.test.tsx` «cambiar de cuenta conserva la pestaña, reinicia la vista y lo anuncia», «una respuesta tardía del saldo de A no se aplica tras cambiar a B» (sin fuga entre cuentas: pestañas remontadas por `key` de cuenta) | — |
| 25 Encabezado de Mis cuentas, avatar 48 dp, alcancía decorativa | Mis cuentas | A + R | A | **PARCIAL**: marca, saludo (primer nombre), título `header`, avatar 48×48 y hoja de perfil OK; **alcancía ausente** | `AccountsScreen.test.tsx`; `tokens.ts` define `headerPig*` pero ningún componente lo usa; `app/assets/` no existe | UXQA-R2-01 |
| 26 Alcancía 72/48/ausente | Mis cuentas | R + D | — | PENDIENTE (depende de UXQA-R2-01) | — | UXQA-R2-01 |
| 27 Todo visible en 360 × 640 | Mis cuentas | R + D | — | PENDIENTE | — | — |
| 28 Total = suma exacta; oculto con 0-1 cuentas, carga y error | Mis cuentas | A | A | OK | `accounts.test.ts` (suma exacta con negativos, excluye archivadas, null con 0-1 o valor no seguro), `AccountsScreen.test.tsx` (con 2+ activas visible, excluye archivadas y lo indica, sin Total en 1 cuenta, carga y error sin cifras) | — |
| 29 Tarjeta = un botón, ≥ 88/92 dp, color estable | Mis cuentas | A + R | A | A: OK; R: PENDIENTE | `account-ui.test.tsx` (etiqueta «{nombre}, saldo actual {saldo}. Abrir cuenta», 92 dp con ≥ 400), `accounts.test.ts` (hash estable y valores conocidos) | — |
| 30 Una acción primaria; Cerrar sesión en hoja de perfil sin confirmación | Mis cuentas | A + R | A | A: OK; R: PENDIENTE | `AccountsScreen.test.tsx` (avatar abre la hoja; se cierra con «Cerrar», fuera o Atrás). Hay una sola primaria («+ Nueva cuenta»); en vacío, «Crear mi primera cuenta» | — |
| 31 Color por módulo | Pestañas | T + R | T + A | T/A: OK; R: PENDIENTE | `account-ui.test.tsx` (pestaña activa con su color de módulo, FAB uniforme `brand700`); tokens de `moduleColors` verificados | — |

### 11.3 Casos transversales (AND-nn) en R2

| Caso | Resultado | Nota |
| --- | --- | --- |
| AND-01, AND-02, AND-06, AND-07 (barras del sistema, gestos, tres botones) | PENDIENTE (D) | `useSystemInsets` usa respaldos (24 dp arriba, 48 dp abajo): mejor esfuerzo no validado (docs/003 R0 D7 bis). `Modal` con edge-to-edge sin validar |
| AND-03, AND-04 (teclado) | PENDIENTE (D) | Sin emulador |
| AND-05 (Atrás) | A: OK; D: PENDIENTE | Ver criterio 4. La confirmación de descarte no existe en R2 (docs/003 R2 D7, diferida) |
| AND-08 (360 × 640) | PENDIENTE (R + D) | Riesgo a revisar: barra de contexto completa a 360 dp (salida + mosaico + nombre mín. 64 + selector + saldo) y etiqueta «Movimientos» a 11,5 sp en 72 dp de pestaña; el código envuelve (`flexWrap`) pero no hay medición |
| AND-09 (scroll largo) | A parcial | `bottomInset` = FAB + 32 (+40 si archivada) en Cuenta, Movimientos y Calendario; Reportes y Más no llevan FAB |
| AND-10 (textos extensos) | A parcial | Elipsis a una línea en tarjeta y barra; fuente grande en dos filas; sin render |
| AND-11 (cambio de cuenta sin fuga) | OK (A) | Ver criterio 24 |
| AND-12 (sesión cerrada) | OK (A) | Ver criterio 12 |
| AND-13 (red lenta/indisponible) | OK (A) para Mis cuentas, barra, Cuenta, selector | Carga con esqueleto sin cifras, error fijo en español con Reintentar, nunca «$0.00» |

### 11.4 Cambios visuales recientes

| Cambio | Resultado | Evidencia |
| --- | --- | --- |
| `Button` variante `link` | OK con observación | Texto `brand700` 700 sobre fondo/blanco 7,3 a 7,5:1; `minHeight` 48 heredado; usada en «Ver todo ›», «Ver» y «Ver todas mis cuentas». **Sin prueba propia en `ui.test.tsx`** (el `it.each` omite `link`): UXQA-R2-04 |
| `accountIcon` | OK con observación | `accounts.test.ts` («tarjeta» 💳, «banco» 🏦, resto 👛). docs/008 §2.4 pide «ahorro» -> alcancía; no implementado: UXQA-R2-02 |
| `colors.archivedRow` `#F4F0EA` | OK | Coincide con docs/008 (tarjeta archivada); `text2`/fila 6,71:1; sin sombra ni color de cuenta |
| `colors.yellowBorder` `#E8C560` | OK con observación | Coincide con docs/008 §6 (etiqueta «Archivada»). Borde decorativo 1,48:1 frente a `yellowSoft`; la información no depende del borde (texto 6,86:1). Se registra para que el contraste no se cite como cumplido |
| `depth.scrim` `rgba(23,33,31,0.45)` | Observación | No figura en docs/008 y el prototipo usa 0,55: UXQA-R2-03 |

### 11.5 Defectos

Sin defectos críticos ni altos. No bloquean el cierre ni el PR por regla de severidad; el cierre de R2 exige igualmente la validación D pendiente.

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R2-01 | Mis cuentas | DIS, criterios 25 y 26 | Media | Iniciar sesión y abrir Mis cuentas | docs/007 §5.2 y docs/008: alcancía decorativa en el encabezado (72/48 dp o ausente por ancho y fuente) | No hay alcancía; `sizes.headerPig*` sin uso y `app/assets/` no existe. La omisión no está registrada como diferida en docs/003 R2 D1 a D9 ni en docs/009 (asset de R6) | `app/src/screens/AccountsScreen.tsx` (encabezado); `app/src/theme/tokens.ts`. Nivel A (código). Decidir: diferir a R6 con registro o implementar |
| UXQA-R2-02 | Crear cuenta / Mis cuentas | INF, DIS | Baja | (a) Escribir «Fondo de ahorro» como nombre de cuenta. (b) Escribir «12,5» o «1.2.3» en saldo inicial | (a) docs/008 §2.4: «ahorro» -> alcancía. (b) docs/007 §5.3: `decimal-pad` «con filtrado de caracteres» | (a) Muestra 👛. (b) Se acepta la entrada y el error llega al guardar («El saldo inicial no es válido...») | `app/src/lib/accounts.ts` (`accountIcon`); `app/src/screens/NewAccountScreen.tsx` (`onChangeText={setSaldo}` sin filtro). Nivel A (código) |
| UXQA-R2-03 | Hojas (perfil, selector) | DIS (tokens) | Baja | Abrir el avatar o el selector | Todo token visual descrito en docs/008 (velo detrás de la hoja); prototipo con 0,55 | `depth.scrim` = 0,45, no documentado; además `archivedRow` y `yellowBorder` están en docs/008 como literales y no en la lista de tokens de §11 | `app/src/theme/tokens.ts`; `docs/008-DISENO-VISUAL.md`. Devolver al diseñador visual para documentar o ajustar |
| UXQA-R2-04 | Componente base | A11Y, tokens | Baja | Revisar `ui.test.tsx` | docs/010 §5: roles y `minHeight` ≥ 48 de los componentes base con prueba | La variante `link` (usada en 3 pantallas) no tiene prueba propia; solo la cubre indirectamente `AccountSummaryTab.test.tsx` | `app/src/screens/ui.test.tsx` (`it.each` omite `link`). Para `mobile-engineer` |
| UXQA-R2-05 | Mis cuentas, componentes base | DIS, A11Y | Baja | Revisar la lista Archivadas y `Chip sm` | docs/008 §6: [Ver] `ghost`; fila «Archivadas» 15/700 `text2`; tarjeta presionada con escala 0,98; `Chip sm` con zona de 48 dp | [Ver] usa `link` (`brand700`); la fila usa 16/700 `text`; la tarjeta baja la opacidad a 0,85; «Desarchivar» muestra `busy` en todas las filas a la vez; `Chip sm` amplía solo en vertical (hitSlop arriba y abajo: en horizontal depende del texto) y aún no se usa | `app/src/screens/AccountsScreen.tsx`, `app/src/screens/account-ui.tsx`, `app/src/screens/ui.tsx`. Verificar que las desviaciones fueron aprobadas por el diseñador; si no, ajustar |

### 11.6 Observaciones sin defecto

- Decisión R2 D7 (confirmación al descartar formularios diferida): Crear cuenta y Nuevo movimiento salen con Atrás o Cancelar sin preguntar aunque haya texto escrito (docs/007 §3.4 y §7). Es una decisión del usuario pendiente, no un defecto; AND-05 queda parcial hasta resolverla.
- Pantalla de Bienvenida: sin rediseñar (botón azul `#1a73e8`, colores literales fuera de `tokens.ts`; blanco sobre ese azul da 4,51:1, AA justo) y docs/009 no le asigna ninguna fase. Se devuelve a quien coordina para planificarla; no es parte de R2.
- `tsconfig.json` sin seguimiento en la raíz del repositorio (`extends: expo/tsconfig.base`); docs/009 §3 dice que no se toca el de la raíz. Confirmar si es un artefacto del entorno y, si lo es, no incluirlo en el commit.
- `archivedOpen` de `MainNavigator` se mantiene en `true` tras archivar hasta abrir una cuenta; efecto menor (Archivadas aparece desplegada al volver a Mis cuentas).

### 11.7 Pendientes (no demostrados) y motivo

Todo el nivel D (safe areas, teclado, gestos, tres botones, 360/412 dp, fuente 130/200 %, TalkBack, `Modal` con edge-to-edge) y el nivel R (comparación con `docs/design/capturas/`) por falta de emulador, dispositivo y de la build; no se ejecutó `verify.js` porque valida el prototipo, no la app. Capturas: ninguna.

Regresión: la suite completa (1168 pruebas, incluidas Calendario, Reportes y exportación) pasa; lo repetirá `qa-engineer` como validación técnica.
