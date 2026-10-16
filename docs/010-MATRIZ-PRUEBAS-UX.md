# Matriz de pruebas UX/UI de la app móvil

Matriz reutilizable con la que `mobile-ux-qa` valida cualquier cambio visible de la interfaz móvil (política de CLAUDE.md, «Coordinación y delegación»). Se aplica al rediseño (docs/007, docs/008 y docs/009) y a las fases siguientes. Los criterios detallados de cada pantalla están en docs/007 §11.2 (criterios 1 a 31, trazados en §9) y los tokens y contrastes en docs/008.

Estado actual: **R2 validada por código y pruebas Jest (nivel A y T) y sin dispositivo**; el resultado está en el §11. **R3 revisada por código y Jest (nivel A y T), sin dispositivo: primera revisión RECHAZADA; revalidada tras las correcciones: APROBADA CON OBSERVACIONES (sin defectos altos ni críticos abiertos; cierre condicionado a nivel D)**; el resultado está en el §12 y la revalidación en el §12.8. Las demás fases (R4 a R6) no están ejecutadas. Ninguna fila está validada en dispositivo Android real (nivel D) ni con TalkBack.

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

## 12. Informe de ejecución R3 (formulario de movimiento y Crear cuenta)

```
Informe de ejecución UX-QA - R3
Fecha: 2026-10-16
Rama y commit evaluados: feat/rediseno-ux-ui sobre 94e37e0 (R2), con los cambios de R3 de app/src SIN commit
Ejecutor: mobile-ux-qa (agentId: lo registra quien coordina; no se dispone aquí)
Alcance: docs/007 §5.5.1 (A a G, criterios 1 a 21), docs/008 §6.13, docs/003 Rediseño R3 D1 a D7.
         TransactionFormScreen, NewAccountScreen, form-ui, DatePickerSheet, MainNavigator (onOpenCategories),
         use-discard-guard, form-dirty, money (sanitizeAmountInput), category-appearance, tokens.
Entorno: niveles A (Jest) y T (contrast.js y cálculo WCAG propio) y revisión de código. Sin R ni D: no hay
         emulador, dispositivo ni TalkBack; no se probó 360/412 dp, teclado real, gestos, tres botones ni fuente 200 %.
Resumen R3: criterios 1 a 20 con nivel A: OK salvo los matizados abajo; 21 (nivel D) PENDIENTE. Defectos: 1 alto, 6 medios, 2 bajos.
Decisión de la primera revisión (superada por el §12.8): RECHAZADO (BLOQUEADO). El defecto alto UXQA-R3-01 (doble registro posible) bloquea cierre, PR y build hasta su
          corrección y nueva validación. Los medios se corrigen o se aceptan expresamente. Sin defectos críticos.
```

### 12.1 Comandos y resultados (nivel A/T)

| Comando | Resultado |
| --- | --- |
| `cd app && npx jest --ci --maxWorkers=2 src/screens/TransactionFormScreen.test.tsx src/screens/NewAccountScreen.test.tsx src/screens/MainNavigator.test.tsx src/lib/money.test.ts src/lib/form-dirty.test.ts src/lib/category-appearance.test.ts src/screens/ui.test.tsx src/theme/tokens.test.ts` | 8 suites, **326 pruebas, todas en verde** |
| `cd app && npx jest --ci --maxWorkers=2` (todo) | 36 suites, **1287 pruebas, todas en verde** |
| `cd app && npx tsc --noEmit` | sin errores |
| `cd app && npx eslint src --max-warnings=0` | sin avisos |
| `node docs/design/contrast.js --check` | código de salida 0 (tabla de `catFill` coincide con `categoryFill`) |
| Cálculo WCAG propio (scratchpad, no versionado) de los pares nuevos | `expenseText`/`expenseSoft` 5,17; `incomeText`/`incomeSoft` 5,72; `expenseText`/blanco 6,38 y /`bg` 6,19 y /`segBg` 5,52; blanco/`expense` 4,82 y blanco/`income` 4,99 (día elegido); borde `borderStrong`/blanco 3,58 y /`bg` 3,47 (componente, mínimo 3); `expense`/`expenseSoft` 3,91 e `income`/`incomeSoft` 4,28 (bordes de elegido, componente); `text3` sobre blanco 5,54, sobre `bg` 5,38 y sobre `segBg` 4,80 (placeholder, contador, campo bloqueado); `text` sobre `segBg` 14,28; `brand700`/`brand100` 6,03 (borde de foco frente al halo). Todos los textos ≥ 4,5 y los componentes ≥ 3 |
| Prueba aleatoria de `categoryFill` (5000 colores `#RRGGBB`, scratchpad) | blanco sobre el fondo ≥ 3,000:1 siempre (mínimo 3,000); las 11 categorías por defecto dan 3,04 a 4,83:1, idéntico a `contrast.js`. Color no `#RRGGBB` usa `#6B7280` (4,83:1). El glifo de texto blanco (`⋯`, `＋`) es gráfico de 16 sp: se acepta el umbral de 3:1 del diseño; los emojis llevan su propio color |
| Sondeo de `sanitizeAmountInput` (scratchpad, 36 entradas) | Ver 12.4 y UXQA-R3-07 |

Colores literales: `grep` de `#hex`/`rgb(` en `TransactionFormScreen.tsx`, `NewAccountScreen.tsx`, `form-ui.tsx`, `DatePickerSheet.tsx` y `use-discard-guard.ts`: **0 coincidencias** (el `#b3261e` literal de R2 ya no existe; se usa `colors.expenseText`). Solo tokens (`colors.white` para el glifo y el día elegido).

### 12.2 Resultados por criterio de docs/007 §5.5.1 G

| Criterio | Nivel exigido | Nivel ejecutado | Resultado | Evidencia (archivo: prueba o línea) | Defecto |
| --- | --- | --- | --- | --- | --- |
| G1 Orden Tipo, Categoría, Monto, Fecha, Detalle, Guardar | A | A + código | OK | `TransactionFormScreen.test.tsx` «G1: orden...»; el JSX sigue ese orden (`TransactionFormScreen.tsx` líneas 349 a 533) | - |
| G2 Monto sin foco al abrir | A | A + código | OK | «G2: el monto no recibe foco...»; ningún `autoFocus` en `form-ui.tsx` ni en la pantalla; `decimal-pad`, prefijo «$» oculto, sin campo de fecha de texto | - |
| G3 Filtro «a1b2.3,45» -> «12.34», «abc» -> '', «.5» -> «0.5», «007» -> «7», «1,234.56» -> «1234.56», 3.er decimal | A | A + sondeo | OK con matiz | `money.test.ts`; sondeo propio: coinciden los 6 ejemplos. Casos ambiguos con un solo separador: UXQA-R3-07 | UXQA-R3-07 |
| G4 Tope de dígitos: monto 9, saldo 14 | A | A | OK | `money.test.ts`; sondeo: «1234567890» -> «123456789», 15 enteros de saldo -> 14; `TransactionFormScreen.tsx` líneas 53 a 54, `NewAccountScreen.tsx` líneas 19 a 20 | - |
| G5 Monto vacío/0: error, sin API, foco, rol `alert` | A | A | OK | «G5: monto vacío o cero...» | - |
| G6 Sin categoría antes que el monto, sin llamada | A | A | OK | «G6: sin categoría muestra...» | - |
| G7 El error desaparece al editar; ninguno mientras se escribe | A | A | OK | «G7: el error de un campo desaparece...»; `clearError` en `onChangeText`, fecha y categoría | - |
| G8 Fecha: Hoy/`initialFecha`, Ayer, «Otra fecha…», elegir cierra, Atrás/Cerrar no cambian, sin texto libre | A | A | OK | seis pruebas «G8: ...» (hoy/ayer, selector, Atrás y «Cerrar», `initialFecha` válida e inválida, celdas de 48 dp, límites 2000/2100, «hoy»). `DatePickerSheet.tsx`: `Sheet` con `onRequestClose` | - |
| G9 Doble toque = una llamada | A | A + código | OK | «G9: doble toque...»; además `useMutation.run` descarta una segunda ejecución con `running` (ref) aunque el re-render llegue tarde (`use-loader.ts`) | - |
| G10 Durante el guardado: «Guardando…», `busy`, campos `editable` falso, Cancelar y «✕» deshabilitados, Atrás `true` sin diálogo; tras fallo se rehabilita | A | A | OK | «G10: durante el guardado todo queda bloqueado...»; `MainNavigator.test.tsx` «G10: Atrás se ignora mientras guarda...». Chips, categorías, tipo, «Ir a Categorías» y Anular llevan `disabled={busy}` | - |
| G11 Sin cambios: Atrás, ✕ y Cancelar salen sin `Alert`; prefijados no cuentan | A | A | OK | «G11: Cancelar, ✕ y Atrás sin cambios...», `form-dirty.test.ts`, `MainNavigator.test.tsx` «G11: ... fecha prefijada desde el calendario» | - |
| G12 Con cambios: `Alert` con los textos de §B; [Seguir editando] conserva; [Descartar] llama `onDone(false)`; `onDismiss` = Seguir editando | A | A | OK | `TransactionFormScreen.test.tsx` líneas 691 a 725; `NewAccountScreen.test.tsx` «G12»; `MainNavigator.test.tsx` «G12». Textos exactos en `TransactionFormScreen.tsx` líneas 126 a 127 y `NewAccountScreen.tsx` líneas 48 a 49 (idénticos a docs/007 §B y docs/003 R3 D7). `use-discard-guard.ts`: `cancelable: true`, `onDismiss: close`, `dialogOpen` evita un segundo diálogo (Atrás repetido o Cancelar con el diálogo abierto) | - |
| G13 Volver al valor inicial o Gasto -> Ingreso -> Gasto: sin diálogo | A | A | OK | «G13: ...»; `isFormDirty` compara en centavos y no compara el tipo | - |
| G14 Éxito, anulación y 409 `ACCOUNT_ARCHIVED` salen sin diálogo | A | A | OK con matiz | «G14» (3 pruebas); la salida de éxito/anulación llama a `onDone` sin pasar por `requestLeave`. Matiz del 409: UXQA-R3-06 | UXQA-R3-06 |
| G15 Editar: tipo y categoría de solo lectura; sin cambios no llama a la API; texto de «cambios» | A | A | OK con matiz | «G15: ...» (2 pruebas), «sin cambios no llama a la API». Matiz: etiqueta accesible de los valores de solo lectura, UXQA-R3-05 | UXQA-R3-05 |
| G16 Crear cuenta: nombre vacío, saldo vacío = 0, filtro, 14 enteros, saldo en contra negativo en centavos, tope de la API, guard solo con texto, «Creando…» bloquea Volver y Atrás | A | A | OK | `NewAccountScreen.test.tsx` (G16 x7, G11, G12, «guardando...»). Signo: `enContra && cents !== 0 ? -cents : cents`; prefijo «-$»; `isAccountFormDirty` cuenta el signo y el saldo, no el espacio en blanco | - |
| G17 Pie fuera del `ScrollView`; roles y etiquetas §E; «Detalle (opcional)» 0/500 | A | A | OK | «G17: ...» (3 pruebas); `transaction-form-footer` es hermano del `ScrollView`; Anular va dentro del scroll al final (no en el pie) | - |
| G18 Sin categorías: texto exacto + [Ir a Categorías] | A | A | OK con matiz | «G18: ...» (2 pruebas); `MainNavigator.test.tsx` «[Ir a Categorías]...». Clasificación del destino: UXQA-R3-03 | UXQA-R3-03 |
| G19 409 de categoría obsoleta | A | A | OK | «G19: ...»; mensaje «Esa categoría cambió. Elige otra.» y recarga con `refresh()` | - |
| G20 `money.test.ts`, typecheck, lint | A | A | OK | 12.1 | - |
| G21 Guardar visible con teclado abierto (gestos y tres botones); TalkBack lee etiquetas y anuncia el error | D | - | **PENDIENTE (D)** | No hay dispositivo. Riesgos de código en UXQA-R3-04 | UXQA-R3-04 |

### 12.3 Verificaciones solicitadas con atención

| Tema | Resultado | Evidencia |
| --- | --- | --- |
| Textos exactos | OK | «Guardar gasto» / «Guardar ingreso» / «Guardar cambios» / «Guardando…» / «Creando…»; «Ingresa un monto mayor a cero, por ejemplo 12.50.»; «Elige una categoría.»; «Escribe un nombre.»; «El saldo inicial es demasiado grande. Revisa la cifra.»; «Es un saldo en contra (debo dinero)»; «No tienes categorías de gasto activas. Crea una en Más > Categorías.»; títulos y cuerpos del descarte; [Seguir editando] [Descartar]. Variante: el error de fecha dice «Elige una fecha válida (años 2000 a 2100).» (no figura en docs/007; comprensible) y la ayuda del saldo añade una frase a «Déjalo vacío si empiezas en 0» |
| Monto enviado = monto escrito | OK | El estado `montoText` es lo que se ve; se envía `parseCentsFromInput(trimTrailingSeparator(montoText))`. En Editar, `centsToInput` ida y vuelta exacto. El filtro nunca deja pasar algo distinto de lo mostrado. Reserva: lo que el filtro hace con textos pegados ambiguos (UXQA-R3-07) |
| Saldo en contra (signo, «-$») | OK | Prefijo «-$» al marcar; el campo nunca escribe «-»; con importe 0 o vacío no se envía negativo; la casilla cuenta como cambio. Pendiente de nivel R la apariencia |
| Descarte | OK (A) | Solo con cambios; Atrás, ✕, Cancelar, «‹» y [Ir a Categorías] pasan por el guard; con `busy` no hay diálogo; sin diálogo tras éxito, anular o 409. El listener del formulario se registra después del navegador (efecto con dependencias estables), así que Android lo llama primero; sin cambios devuelve `false` y el navegador resuelve Atrás (`MainNavigator.test.tsx` y «registra una sola suscripción...») |
| Cambio de cuenta durante la edición | OK (inalcanzable, A + código) | `AccountSwitcherSheet` solo se monta en la rama `detail`; la ruta del formulario usa la barra `compact` sin `onOpenSwitcher`; `openAccount` solo existe en Mis cuentas. Pruebas: «con el formulario abierto no hay selector accesible», «un movimiento de otra cuenta no abre Editar». Cerrar sesión desmonta el navegador. Sin fuga de datos entre cuentas hoy. Defensa en profundidad ausente: UXQA-R3-09 |
| Objetivos táctiles ≥ 48 dp | OK (A, código) | ✕ 48×48; tipo 48; categoría ≥ 56; `Chip` 48; casilla 48; `Button` 48/52; flechas de mes 48×48; celdas 48 de alto y 49,1 de ancho a 360 dp (`(360 - 16) / 7`; a < 336 dp bajarían de 48: fuera del alcance de 360 dp). Medición real: PENDIENTE (D) |
| Roles y anuncios de errores | OK con matices | `FieldError` con `alert` + `polite` + una sola `announceForAccessibility` por intento (Movimiento); foco en el campo o en el mensaje. Matices: UXQA-R3-05 y UXQA-R3-08 |
| Selector de fecha | OK | Rango 2000 a 2100 (flechas deshabilitadas al borde), hoy marcado, futuras permitidas, tocar elige y cierra, Atrás/«Cerrar»/velo no cambian. «Fuera de rango» (celdas deshabilitadas, docs/008 punto 4) no existe en el código y es inalcanzable: cada mes mostrado está entero dentro del rango y `initialMonthFor` acota. No es defecto; el texto de docs/008 puede simplificarse (ver 12.5) |
| Pie fuera del `ScrollView` | OK | Prueba G17 por `testID`; pie con borde, sombra y margen inferior. Problema de margen doble: UXQA-R3-04 |
| «Ir a Categorías» desde el formulario | **Clasificado: navegación de reemplazo con etiqueta engañosa (media)** | `replaceTopWithCategories` sustituye la ruta del formulario por `categories`; Atrás vuelve a la pestaña de origen (prueba: queda en «Cuenta»), pero la pantalla se titula «‹ Más» / «Volver a Más». Se descarta el formulario (con confirmación si hay cambios). UXQA-R3-03 |
| Omisión declarada: aviso de éxito | **FALLA (media)** | `onDone` solo retira la ruta y relee el saldo; no hay `setSnack` en la salida del formulario (`MainNavigator.tsx`). UXQA-R3-02 |
| Omisión declarada: respuesta perdida | **FALLA (alta)** | Un error de red al crear muestra «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.»; no existe «No pudimos confirmar si se guardó...». UXQA-R3-01 |
| Omisión declarada: estado fuera de rango | Sin defecto | Ver «Selector de fecha» |

### 12.4 Sondeo de `sanitizeAmountInput` (nivel A, scratchpad, 36 entradas; límite de 9 enteros)

Coinciden con docs/007 §C y G3: «a1b2.3,45» -> «12.34»; «abc» -> ''; «.5» y «,5» -> «0.5»; «007» -> «7»; «00» -> «0»; «1,234.56» y «1.234,56» -> «1234.56»; «1,234,567» -> «1234567»; «12.345» -> «12.34»; «-5» -> «5»; «$12.50» -> «12.50»; cifras árabes o de ancho completo -> ''; idempotente sobre sus propias salidas. Ambiguos (ver UXQA-R3-07): «1,234» -> «1.23» y «1.000» -> «1.00» (un pegado de «mil doscientos treinta y cuatro» queda en $1.23), «1e5» -> «15», «1,2345,678» -> «1.23».

### 12.5 Defectos

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R3-01 | Nuevo movimiento | ACC, EST (doble registro) | **Alta (bloquea)** | Con la API sin clave de idempotencia, crear un movimiento y que la conexión se corte después de que el servidor lo grabó (o expire la respuesta); la app muestra el error de red y conserva los datos | docs/007 §5.5 «Doble envío»: «el texto de error de red debe invitar a revisar el historial antes de reintentar: No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.»; docs/007 §5.5.1 A punto 13 lo lista como trabajo de R3; docs/010 §7: «doble registro posible» es alta | El mensaje es «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.», que invita a reintentar y puede duplicar el gasto. Ninguna prueba cubre el texto de respuesta perdida | `app/src/lib/resources-messages.ts` (caso `network`); `app/src/screens/TransactionFormScreen.tsx` (`mutation.error`); `TransactionFormScreen.test.tsx` «error de red no cierra el formulario» afirma el mensaje genérico. Nivel A (código y Jest). Para `mobile-engineer`: texto específico en la creación (y en cualquier fallo en que el servidor pudo recibir la solicitud), con prueba. Cierre posible también con aceptación expresa del usuario |
| UXQA-R3-02 | Nuevo / Editar movimiento | EST (éxito), ACC | Media | Guardar un gasto de $12.50 en Alimentación | docs/007 §5.5 «Confirmación» y §5.5.1 A punto 12: aviso breve no bloqueante «Gasto de $12.50 guardado en Alimentación» (3 s); docs/007 línea 1008 asigna `MainNavigator` | El formulario se cierra y el saldo cambia, sin aviso de éxito. La omisión está declarada, no aprobada | `app/src/screens/MainNavigator.tsx` (`onDone` del formulario); el `Snackbar` existe y se usa en otros flujos. Nivel A. Implementar o aceptar expresamente y registrar en docs/003 |
| UXQA-R3-03 | Nuevo movimiento -> Categorías | NAV, DIS | Media | Abrir Nuevo movimiento desde Calendario o Cuenta en una cuenta sin categorías del tipo; tocar [Ir a Categorías]; tocar «‹ Más» o Atrás | docs/007 §3.4 (Categorías -> Más) y la etiqueta de la propia pantalla: «‹ Más» / «Volver a Más» deben llevar a Más | Vuelve a la pestaña de origen (Cuenta, Movimientos o Calendario), no a Más; la etiqueta miente. Además el formulario se descarta y hay que volver a abrirlo tras crear la categoría | `app/src/screens/MainNavigator.tsx` (`replaceTopWithCategories`, rama `categories`); `MainNavigator.test.tsx` «[Ir a Categorías]...» afirma `Cuenta`. Opciones para quien coordina: etiqueta neutra según el origen (p. ej. «‹ Volver») o dejar la pestaña en Más al reemplazar. Si se cambia el comportamiento, lo decide `mobile-ux-designer` |
| UXQA-R3-04 | Nuevo / Editar movimiento | SAFE, DIS | Media | Abrir el formulario con barra del sistema inferior (gestos o tres botones) | docs/007 §5.5.1 E y docs/008 §6.13 punto 6: pie fijo con margen inferior del sistema una sola vez | `Screen scroll={false}` sin `bottomBar` añade `screen-bottom-inset` (altura = `insets.bottom`) y además el pie suma `12 + insets.bottom` de relleno: el margen inferior se cuenta dos veces (24 a 48 dp de más con el respaldo de 48 dp), con una franja de `bg` bajo el pie blanco. Con el teclado abierto y `adjustResize`, `useSystemInsets` calcula `screenH - windowH - top` y podría tomar la altura del teclado como margen (dos veces): riesgo no verificable aquí | `app/src/screens/TransactionFormScreen.tsx` (pie, `paddingBottom: 12 + insets.bottom`); `app/src/screens/ui.tsx` (`Screen`, `bottomSpacer`); `app/src/screens/MainNavigator.tsx` (rama `newTx`/`editTx`); `app/src/theme/useSystemInsets.ts`. Nivel A (código). Confirmar en dispositivo (G21); corregir pasando `bottomBar` o quitando el relleno inferior del pie |
| UXQA-R3-05 | Editar movimiento | A11Y | Media | Con TalkBack, abrir Editar y enfocar Tipo y Categoría de solo lectura | docs/007 §5.5.1 E: etiquetas con el valor («Tipo» y su valor, «Categoría {nombre}») | El `Text` con el valor lleva `accessibilityLabel="Tipo"` / `"Categoría"`, que sustituye al contenido: el lector dice «Tipo» y «Categoría», no «Gasto» ni el nombre. Información que solo se lee de ese texto queda sin acceso para TalkBack | `app/src/screens/TransactionFormScreen.tsx` (`readOnlyType`, `readOnlyName`, líneas 357 a 380). Nivel A (código); TalkBack real PENDIENTE. Usar el valor como etiqueta («Tipo: Gasto», «Categoría: Comida») |
| UXQA-R3-06 | Nuevo movimiento | EST, ACC | Media | Crear un movimiento en una cuenta archivada en otro dispositivo (409 `ACCOUNT_ARCHIVED`) | docs/007 §3.5.3 / §5.5 / criterio 20: mensaje «Esta cuenta está archivada, por eso no se guardó el movimiento. Desarchívala desde Mis cuentas...» + [Volver a la cuenta]; datos sin enviar | Muestra el mensaje genérico «La cuenta está archivada. Desarchívala para modificarla.»; no hay [Volver a la cuenta]; Guardar sigue activo (reintento posible con el mismo 409). Se puede salir con Cancelar o Atrás sin diálogo | `app/src/lib/resources-messages.ts` (`ACCOUNT_ARCHIVED`); `app/src/screens/TransactionFormScreen.tsx` (`archivedBlocked` solo anula el guard); `TransactionFormScreen.test.tsx` «R2 (cuenta archivada)». Nivel A. El criterio 14 de G (salida sin diálogo) sí se cumple |
| UXQA-R3-07 | Nuevo movimiento, Crear cuenta | INF, ACC | Media | (a) Pegar «1,234» o «1.000» en Monto. (b) Pegar «12,345,678.90» (13 caracteres) | docs/007 §C: lo pegado se filtra y el usuario no debe recibir un monto distinto del que quiso escribir (docs/010 «dato financiero incorrecto»); el texto visible = el enviado | (a) «1,234» queda en «$1.23» y «1.000» en «$1.00»: un solo separador con tres dígitos se interpreta como decimal y se descarta el tercer dígito, sin aviso (magnitud ×1000). (b) `maxLength` (12 y 17) cuenta los caracteres antes del filtro, así que un pegado con separadores de miles se recorta antes de limpiarse («12,345,678.9» -> «12345678.9»). El monto mostrado coincide siempre con el enviado, y es visible antes de guardar. «1e5» -> «15» | `app/src/lib/money.ts` (`THOUSANDS_ONLY`, `THOUSANDS_WITH_DECIMAL`, regla del decimal único); `TransactionFormScreen.tsx` (`AMOUNT_MAX_LENGTH`), `NewAccountScreen.tsx` (`BALANCE_MAX_LENGTH`). Nivel A (sondeo). Decisión de diseño para `mobile-ux-designer`: cómo tratar un pegado ambiguo (p. ej. rechazarlo o dejar el texto sin filtrar los separadores y avisar) y si `maxLength` debe subir para admitir pegados con miles. El recorte por `maxLength` solo se puede confirmar en dispositivo |
| UXQA-R3-08 | Crear cuenta | A11Y | Baja | Guardar con nombre vacío o saldo inválido, con TalkBack | docs/007 §5.5.1 E: cada error con `announceForAccessibility` (una vez por intento); error de envío con `polite` | `NewAccountScreen` no llama a `announceForAccessibility`; el error de envío tiene `alert` pero no `accessibilityLiveRegion`; solo el foco del campo guía. El formulario de movimiento sí lo hace | `app/src/screens/NewAccountScreen.tsx` (`submit`, `styles.error`). Nivel A (código) |
| UXQA-R3-09 | Editar / Nuevo movimiento | NAV (robustez) | Baja | Hoy no reproducible: ninguna ruta cambia la cuenta con el formulario abierto | docs/003 R3 D4: si un cambio futuro permitiera cambiar de cuenta, el guard confirma y descarta | `TransactionFormScreen` tiene `key={transaction?.id ?? 'new'}` sin `account.id` (las demás pantallas usan `key={account.id}`); si algún día se alcanzara el selector, el estado (`categoryId`, monto) sobreviviría al cambio y la API respondería con `CATEGORY_MISMATCH` en vez de descartar. Hoy sin fuga | `app/src/screens/MainNavigator.tsx` (rama `newTx`/`editTx`). Nivel A (código). Añadir `account.id` a la `key` y, si se abre el selector, pasar por el guard |

### 12.6 Observaciones sin defecto

- Contraste: ningún par nuevo de R3 incumple AA (12.1). El texto blanco del glifo sobre `categoryFill` se mide como gráfico (3:1), no como texto.
- docs/007 §5.5.1 E pide nombres de categoría «de dos líneas o más, sin elipsis» al 200 % y docs/008 §6.13 punto 2 fija `numberOfLines={2}`: con fuente 200 % y nombres muy largos habría elipsis. El código sigue docs/008; la discrepancia entre documentos se devuelve a `mobile-visual-designer`/`mobile-ux-designer`. Se valida en dispositivo.
- docs/008 §6.13 punto 4 describe celdas «fuera de rango» deshabilitadas, que no ocurren (los meses de los extremos están enteros dentro del rango); basta retirar la frase o dejarla como defensa.
- El encabezado con «✕» está dentro del `ScrollView` (se desplaza con el contenido); «Cancelar» siempre queda en el pie fijo, así que hay salida visible en todo momento.
- Los títulos del formulario usan `typography.title` (24/30, 800) y el monto `typography.amountInput` (28/34, 800, cifras tabulares), conforme a docs/008 §6.13.
- En Editar, si la categoría no carga (o hay más de 100 categorías) el nombre cae en «Categoría del movimiento»; sin reintento visible. Baja probabilidad.

### 12.7 Pendientes (no demostrados) y motivo

Todo nivel D por falta de emulador, dispositivo y TalkBack: G21 (Guardar sobre el teclado con gestos y con tres botones, TalkBack leyendo etiquetas y anunciando errores), margen inferior real y posible doble margen (UXQA-R3-04), `maxLength` frente a pegados con separadores (UXQA-R3-07 b), `Modal` del selector de fecha con edge-to-edge, desplazamiento al primer error, foco con `setAccessibilityFocus`, fuente 130 % y 200 %, 360 y 412 dp (celdas de 49,1 dp), Atrás con gestos predictivos, aspecto del halo de foco y del tinte del tipo. Nivel R (comparación con `docs/design/capturas/`): no ejecutado; `verify.js` valida el prototipo, no la app. Capturas: ninguna.

Regresión: suite completa en verde (36 suites, 1287 pruebas), tsc y eslint sin avisos; la repetirá `qa-engineer` como validación técnica. Los archivos del scratchpad (sondeos) no están versionados y no modifican `/app`.

### 12.8 Revalidación tras las correcciones de mobile-engineer

```
Fecha: 2026-10-16 · Rama: feat/rediseno-ux-ui sobre 94e37e0, cambios sin commit · Niveles: A y T (código y Jest); sin R ni D
Comandos: cd app && npx jest --ci --maxWorkers=2 -> 36 suites, 1303 pruebas, todas en verde
          npx tsc --noEmit -> sin errores · npx eslint src --max-warnings=0 -> sin avisos
Decisión: APROBADO CON OBSERVACIONES. No queda ningún defecto alto ni crítico. Abiertos: UXQA-R3-07 (media, decisión pendiente
          del usuario) y G21 / validación de teclado y TalkBack (nivel D, pendiente). El cierre de R3 sigue condicionado a D.
```

| ID | Estado | Verificación independiente (código y prueba) |
| --- | --- | --- |
| UXQA-R3-01 (alta) | **Cerrado (A)** | `resources-messages.ts`: `LOST_RESPONSE_MOVEMENT` («No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.») y `LOST_RESPONSE_ACCOUNT`. `isUncertainWriteFailure`: `ApiRequestError` solo si `status >= 500` (todo 4xx, incluidos 409, 413 y 429, garantiza que no se guardó y no usa el texto); `AuthError` solo `network` y `server` (`rejected`, `conflict`, `storage` no); error desconocido cuenta como dudoso (criterio conservador); `ExportFileError` no. Se aplica solo al CREAR movimiento y cuenta (`uncertain.current` en el `catch`; se reinicia en cada intento). Al EDITAR no se usa: el fallo de red o 5xx conserva el mensaje genérico de `mutation.error` (el PATCH no duplica) y no se pierde. Pruebas: `TransactionFormScreen.test.tsx` «UXQA-R3-01» x3 (red, 5xx y desconocido; 4xx no; se retira al reintentar), `NewAccountScreen.test.tsx` «UXQA-R3-01». Sin regresión: el 409 de cuenta archivada y de categoría obsoleta mantienen su flujo |
| UXQA-R3-02 (media) | **Cerrado (A)** | `onDone(changed, message?)`; solo la creación exitosa entrega «Gasto/Ingreso de $X guardado en {categoría}» y `MainNavigator` lo envía a `setSnack`. Cancelar, descartar, editar, anular y el 409 llaman a `onDone(false)` o `onDone(true)` sin mensaje. Pruebas: `MainNavigator.test.tsx` «UXQA-R3-02: guardar muestra el aviso…» y «Cancelar y editar sin cambios no muestran aviso»; `TransactionFormScreen.test.tsx` «el éxito entrega el aviso…» y «editar y anular no emiten aviso». Observación: sin nombre de categoría resoluble no hay aviso (caso improbable) |
| UXQA-R3-03 (media) | **Cerrado (A)** | La ruta `categories` lleva `fromForm`; la barra dice «‹ Volver» (etiqueta accesible «Volver») y Atrás/«‹» llevan a la pestaña de origen, ahora coherente. «‹ Más» se conserva cuando se llega desde Más. Sigue descartándose el formulario (con confirmación si hay cambios), comportamiento aceptado |
| UXQA-R3-04 (media) | **Cerrado a nivel A; riesgo de teclado PENDIENTE (D)** | La rama del formulario pasa `bottomBar` a `Screen`: ya no se añade `screen-bottom-inset` y el margen inferior se cuenta una sola vez en el pie. Queda sin verificar en dispositivo cómo calcula `useSystemInsets` el margen con el teclado abierto (parte de G21) |
| UXQA-R3-05 (media) | **Cerrado (A); TalkBack PENDIENTE (D)** | Etiquetas «Tipo: Gasto/Ingreso» y «Categoría: {nombre}» en los valores de solo lectura. Observación baja: si la categoría aún no cargó se lee «Categoría: Categoría del movimiento» |
| UXQA-R3-06 (media) | **Cerrado (A)** | Con 409 `ACCOUNT_ARCHIVED` el error es `ACCOUNT_ARCHIVED_ON_SAVE` (texto de §3.5.3, rol `alert`), el pie muestra solo [Volver a la cuenta] (`onDone(false)`, sin mensaje de éxito), sin Guardar ni Cancelar. No queda atrapado: [Volver a la cuenta], «✕» y Atrás salen sin diálogo (`dirty` es falso con `archivedBlocked`). El 409 al EDITAR no activa este modo. Prueba «UXQA-R3-06» |
| UXQA-R3-07 (media) | **Cerrado (A)** (ver §12.9) | Decidido en docs/003 R3 D8 y corregido con `validateAmountText`; revalidado |
| UXQA-R3-08 (baja) | **Cerrado (A)** | `NewAccountScreen` anuncia los errores con `announceForAccessibility` y el error de envío lleva `accessibilityLiveRegion="polite"` |
| UXQA-R3-09 (baja) | **Cerrado (A)** | `key={`${account.id}:${transaction?.id ?? 'new'}`}` en `MainNavigator`: un cambio de cuenta remontaría el formulario. El selector sigue siendo inalcanzable con el formulario abierto |

Pendientes que impiden declarar R3 cerrada: G21 y todo el nivel D listado en el §12.7 (teclado real, margen inferior, TalkBack, fuente 200 %, 360/412 dp, `Modal` del selector de fecha) y el nivel R. Defectos abiertos por severidad: críticos 0, altos 0, medios 1 (R3-07, aceptado-pendiente), bajos 0.

### 12.9 Revalidación de UXQA-R3-07 (montos ambiguos, docs/003 R3 D8)

```
Fecha: 2026-10-16 · Niveles: A y T (código, Jest y sondeo propio en scratchpad); sin R ni D
Comandos: cd app && npx jest --ci --maxWorkers=2 -> 36 suites, 1348 pruebas, todas en verde
          npx tsc --noEmit -> sin errores · npx eslint src --max-warnings=0 -> sin avisos
Decisión: APROBADO CON OBSERVACIONES. UXQA-R3-07 CERRADO (A). Sin defectos altos ni críticos abiertos.
```

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Rechazar «1.000», «1,234», «1e5»; aceptar «1000», «1234», «12.50», «12,50» | OK (A) | Sondeo de `validateAmountText`: «1.000» y «1,234» -> `thousands`; «1e5» -> `chars`; «1000» -> 100000, «1234» -> 123400, «12.50» y «12,50» -> 1250. Extras: «1,234.56», «1.234.567», «100.000», «12.345» -> `thousands`; «0.123», «1234.567» -> `decimals`; «-5», «$5», «12 50», cifras árabes o de ancho completo -> `chars`; «» y «.» -> `empty`. Ambos formularios llaman a la misma función: `TransactionFormScreen.validate` y `NewAccountScreen.submit` (saldo vacío = 0 sin error; el resto de rechazos no llama a la API) |
| Coherencia de «007», «.5», «5.», «0.07» | OK | «007» -> 700 (7,00), «.5» y «,5» -> 50, «5.» -> 500, «0.07» -> 7, «00.5» -> 50, « 12 » -> 1200. El texto crudo se conserva y siempre se envía el importe que ese texto representa; no hay reinterpretación silenciosa. «0» y «0.00» pasan el formato y el movimiento los rechaza con «mayor a cero» |
| Monto mostrado = enviado | OK | El estado guarda el texto crudo (`maxLength` 24); `validate()` y `submit()` usan el mismo `validateAmountText(montoText)`; un valor ambiguo nunca llega a la API. Tope: 9 enteros del movimiento por `MAX_AMOUNT_CENTS` («El monto máximo es $999999999.99.») y saldo hasta 9 007 199 254 740 991 centavos, sobre él «El saldo inicial es demasiado grande. Revisa la cifra.» (sondeo: «90071992547409.92» -> `too-large`) |
| Claridad y tono | OK | «Escribe solo números, por ejemplo 12.50.» · «Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.» · «Usa como máximo 2 decimales, por ejemplo 12.50.» · «Ingresa un monto mayor a cero, por ejemplo 12.50.»: español cotidiano, de «tú», con ejemplo y acción. Observación baja: «12.345» recibe el mensaje de miles aunque quien lo escribe pudo pensar en decimales; el mensaje ofrece ambos ejemplos, aceptable |
| Descarte con texto crudo | OK | `isFormDirty` compara en centavos cuando el texto se puede interpretar («12,50» frente a «12.50» no es cambio) y por texto si no («1.000» o «1e5» cuentan como cambio, «.» también); espacios solos no cuentan. `isAccountFormDirty` usa `saldo.trim()` |
| Accesibilidad del error | OK (A); TalkBack PENDIENTE (D) | Mismo `FieldError` (rol `alert`, `polite`), foco al campo y un `announceForAccessibility` por intento en el movimiento; en Crear cuenta foco al saldo y anuncio. El error se borra al editar |
| Regresiones en G1 a G20 | Sin regresión | Suite completa en verde (1348). `sanitizeAmountInput` ya no existe en `app/src` |
| Documentación | Observación baja | docs/007 §5.5.1 C conserva el párrafo «Helper PROPUESTA: `sanitizeAmountInput`…» (línea 561) y el criterio 20 sigue citándolo; el resto (C.1 y criterios 3 y 4) ya describe `validateAmountText`. Devolver a quien coordina para alinear el texto |

Estado de defectos tras esta revalidación: críticos 0, altos 0, medios 0, bajos 0 de código (R3-07 cerrado); queda la observación documental y los pendientes de nivel D del §12.7 (G21: teclado real, margen inferior, TalkBack, fuente 200 %, 360/412 dp, comportamiento de pegado con `maxLength` 24 en Android). El cierre de R3 sigue condicionado a ese nivel D.
