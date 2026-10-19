# Matriz de pruebas UX/UI de la app móvil

Matriz reutilizable con la que `mobile-ux-qa` valida cualquier cambio visible de la interfaz móvil (política de CLAUDE.md, «Coordinación y delegación»). Se aplica al rediseño (docs/007, docs/008 y docs/009) y a las fases siguientes. Los criterios detallados de cada pantalla están en docs/007 §11.2 (criterios 1 a 31, trazados en §9) y los tokens y contrastes en docs/008.

Estado actual: **R2 validada por código y pruebas Jest (nivel A y T) y sin dispositivo**; el resultado está en el §11. **R3 revisada por código y Jest (nivel A y T), sin dispositivo: primera revisión RECHAZADA; revalidada tras las correcciones: APROBADA CON OBSERVACIONES (sin defectos altos ni críticos abiertos; cierre condicionado a nivel D)**; el resultado está en el §12 y la revalidación en el §12.8. **R4 revisada por código y Jest (nivel A y T), sin dispositivo: APROBADA CON OBSERVACIONES (sin defectos altos ni críticos; defectos R4-01 a R4-03 cerrados tras D6, §13.8; cierre condicionado a nivel D)**; el resultado está en el §13. Las demás fases (R5 y R6) no están ejecutadas. Ninguna fila está validada en dispositivo Android real (nivel D) ni con TalkBack. **R5 revisada por código y Jest (nivel A y T), sin dispositivo: APROBADA CON OBSERVACIONES (§14). La preparación y el procedimiento de la validación en Android están en los §15 y §16 y la verificación funcional previa en el §17; ningún caso se ha ejecutado en un teléfono.**

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
| Omisión declarada: respuesta perdida | **FALLA (alta) — histórico, cerrado: ver §12.8** | Un error de red al crear muestra «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.»; no existe «No pudimos confirmar si se guardó...». UXQA-R3-01 |
| Omisión declarada: estado fuera de rango | Sin defecto | Ver «Selector de fecha» |

### 12.4 Sondeo de `sanitizeAmountInput` (nivel A, scratchpad, 36 entradas; límite de 9 enteros)

Coinciden con docs/007 §C y G3: «a1b2.3,45» -> «12.34»; «abc» -> ''; «.5» y «,5» -> «0.5»; «007» -> «7»; «00» -> «0»; «1,234.56» y «1.234,56» -> «1234.56»; «1,234,567» -> «1234567»; «12.345» -> «12.34»; «-5» -> «5»; «$12.50» -> «12.50»; cifras árabes o de ancho completo -> ''; idempotente sobre sus propias salidas. Ambiguos (ver UXQA-R3-07): «1,234» -> «1.23» y «1.000» -> «1.00» (un pegado de «mil doscientos treinta y cuatro» queda en $1.23), «1e5» -> «15», «1,2345,678» -> «1.23».

### 12.5 Defectos

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R3-01 | Nuevo movimiento | ACC, EST (doble registro) | **Alta (bloqueaba) — cerrado: ver §12.8** | Con la API sin clave de idempotencia, crear un movimiento y que la conexión se corte después de que el servidor lo grabó (o expire la respuesta); la app muestra el error de red y conserva los datos | docs/007 §5.5 «Doble envío»: «el texto de error de red debe invitar a revisar el historial antes de reintentar: No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.»; docs/007 §5.5.1 A punto 13 lo lista como trabajo de R3; docs/010 §7: «doble registro posible» es alta | El mensaje es «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.», que invita a reintentar y puede duplicar el gasto. Ninguna prueba cubre el texto de respuesta perdida | `app/src/lib/resources-messages.ts` (caso `network`); `app/src/screens/TransactionFormScreen.tsx` (`mutation.error`); `TransactionFormScreen.test.tsx` «error de red no cierra el formulario» afirma el mensaje genérico. Nivel A (código y Jest). Para `mobile-engineer`: texto específico en la creación (y en cualquier fallo en que el servidor pudo recibir la solicitud), con prueba. Cierre posible también con aceptación expresa del usuario |
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

## 13. Informe de ejecución R4 (Historial, Calendario, Reportes y Categorías)

```
Informe de ejecución UX-QA - R4
Fecha: 2026-10-16
Rama y commit evaluados: feat/rediseno-ux-ui sobre 281bc86 (R3), con los cambios de R4 de app/src y docs SIN commit
Ejecutor: mobile-ux-qa (agentId: lo registra quien coordina; no se dispone aquí)
Alcance: docs/007 §5.11 (A a M, criterios 1 a 48), docs/008 §6.14 y §3.4, docs/003 Rediseño R4 D1 a D5.
         HistoryScreen, CalendarScreen, ReportsScreen, CategoriesScreen, TransactionRow, DatePickerSheet, ui.tsx
         (ScreenTitle, ModuleTile, SummaryTile, MonthArrow, DateField, LoadingState, EmptyState), form-ui.tsx,
         MainNavigator.tsx, lib/calendar.ts, lib/reports.ts, theme/tokens.ts.
Entorno: niveles A (Jest) y T (contrast.js y cálculo WCAG propio) y revisión de código. Sin R ni D: no hay emulador,
         dispositivo ni TalkBack; no se probó 360/412 dp reales, gestos, tres botones, teclado real ni fuente 130 %/200 %.
Resumen R4: criterios 1 a 40 con nivel A: OK (el 27 con matiz); criterios 41 a 48 (nivel D): PENDIENTE.
            Defectos: 0 críticos, 0 altos, 1 medio, 2 bajos.
Decisión: APROBADO CON OBSERVACIONES. Sin defectos críticos ni altos. El medio (UXQA-R4-01) debe corregirse antes del PR
          (la CI arranca con la caché de Jest fría). El cierre de R4 sigue condicionado al nivel D (criterios 41 a 48).
```

### 13.1 Comandos y resultados (nivel A/T)

| Comando | Resultado |
| --- | --- |
| `cd app && npx jest --ci --maxWorkers=2` (todo, caché caliente) | 38 suites, **1445 pruebas, todas en verde** |
| `cd app && npx jest --ci --maxWorkers=2` de HistoryScreen, TransactionRow, DatePickerSheet, calendar y reports (primera corrida, caché fría) | **1 FALLA** en `HistoryScreen.test.tsx` «muestra carga, luego los movimientos...»: `Exceeded timeout of 5000 ms`. Resto en verde (109 de 110). Ver UXQA-R4-01 |
| `cd app && npx jest --ci --no-cache --maxWorkers=2` de History, Calendar, Reports y Categories | **Reproducido**: solo falla la misma prueba de History (167 de 168). Calendar, Reports y Categories pasan, pero tampoco llaman al helper |
| `cd app && npx jest --ci --maxWorkers=2 src/screens/HistoryScreen.test.tsx` (caché caliente) | 36 pruebas en verde |
| `cd app && npx jest --ci --maxWorkers=2` de Calendar, Reports, Categories y ui | 4 suites, 181 pruebas en verde |
| `cd app && npx jest --ci --maxWorkers=2` de MainNavigator, App.resources y tokens | 3 suites, 71 pruebas en verde |
| `cd app && npx tsc --noEmit` | sin errores |
| `cd app && npx eslint src --max-warnings=0` | sin avisos |
| `cd app && npx prettier --check src` | todos los archivos con el estilo |
| `node docs/design/contrast.js --check` | código de salida 0 (98 pares; mínimo texto 4,60:1; mínimo componente 3,47:1; 7 colores del selector de Categorías con `catFill` ≥ 3:1) |
| `git diff HEAD --stat -- app/package.json app/package-lock.json` y `grep svg app/package.json` | **sin cambios** y sin `react-native-svg` ni dependencia nativa (docs/003 R4 D1) |
| `git diff HEAD --numstat -- app/src/lib/calendar.test.ts app/src/lib/reports.test.ts` | `calendar.test.ts`: 43 líneas añadidas, 0 eliminadas; `reports.test.ts` sin cambios (criterio 30) |
| Cálculo WCAG propio (script en scratchpad, no versionado) | blanco/`calStrong` 5,67; `calStrong`/blanco 5,67 y /`bg` 5,50; `incomeText`/blanco 6,67; `expenseText`/blanco 6,38 y /`expenseSoft` 5,17; `income`/blanco 4,99 y `expense`/blanco 4,82 (cifra de `SummaryTile`, leyenda y barras, objeto gráfico ≥ 3); `text3` sobre `bg` 5,38 y blanco 5,54 (aviso de desplazamiento, placeholder de la vista previa); `text2` sobre `bg` 7,39, sobre `segBg` 6,60, sobre `archivedRow` 6,71; `brand700`/blanco 7,49 («Ver movimientos ›»); `movInk`/`movTile` 8,19; `repInk`/`repTile` 7,68; tinta pizarra/mosaico 8,41; `yellowText`/`yellowSoft` 6,86; `calTile` sobre `calStrong` 4,69 (anillo de hoy+elegida); `borderStrong`/blanco 3,58. Todos los textos ≥ 4,5 y los componentes ≥ 3. Borde `border` de la celda en reposo frente a `bg` 1,19: decorativo (el número del día es el contenido); ver observaciones |
| `grep` de `#hex`/`rgb(` en `HistoryScreen`, `CalendarScreen`, `ReportsScreen`, `CategoriesScreen`, `TransactionRow`, `ui`, `form-ui`, `DatePickerSheet` y `sheets` | **0 coincidencias** fuera de `CATEGORY_COLORS` (siete valores que se envían a la API: datos, no estilos). Los ocho literales de la línea base no existen |

### 13.2 Resultados por criterio de docs/007 §5.11 I

Nivel ejecutado: «A» = prueba Jest con el fake de `ResourcesApi`; «A + código» = además revisión del código; «U» = unitaria. Los números de línea son de las pruebas.

| Criterio | Nivel exigido | Nivel ejecutado | Resultado | Evidencia | Defecto |
| --- | --- | --- | --- | --- | --- |
| 1 Títulos `header` sin nombre de cuenta | A | A + código | OK | `HistoryScreen.test` 87-88; `ReportsScreen.test` 174-175; `CalendarScreen.test` 401; `CategoriesScreen.test` 50; `MainNavigator.test` 190, 205, 302; cada pantalla usa `<ScreenTitle title=... module=...>` (solo «Movimientos», «Calendario», «Reportes», «Categorías») | - |
| 2 Sin colores literales | A (búsqueda) | Búsqueda + código | OK | 13.1: 0 coincidencias; estilos de calendario, filas y barras salen de `colors`, `moduleColors`, `categoryFill` | - |
| 3 Panel cerrado; «Filtros (N)»; `expanded` | A | A + código | OK | `HistoryScreen.test` 488, 504; `HistoryScreen.tsx` 320-330 (`expanded={panelOpen}`, `Filtros, N activos`/`Filtros, ninguno activo`) | - |
| 4 Chips con filtros iniciales y «Quitar filtro» | A | A | OK | 402, 524 (quita solo su filtro y relee la página 1 con los demás) | - |
| 5 Tipo limpia categoría incompatible; «Todas» | A | A | OK | 281, 569 | - |
| 6 Rango con selector, sin `TextInput`, rango invertido sin API | A | A + código | OK | 300, 334, 591; `pickDate` cierra la hoja, no filtra y muestra `RANGE_ORDER_ERROR` con `alert`; sin `TextInput` en `HistoryScreen.tsx` | - |
| 7 «Limpiar filtros» (panel y vacío) | A | A | OK | 359, 430, 604 | - |
| 8 Agrupación por día | A | A + U | OK | 636, 648; `calendar.test` 302 (Hoy, Ayer, «Miércoles 14 de octubre», año distinto); la agrupación se hace sobre la lista fusionada (`HistoryScreen.tsx` 297-304) | - |
| 9 Fila de movimiento | A | A + código | OK | `HistoryScreen.test` 688; `TransactionRow.test.tsx`; `TransactionRow.tsx`: `CategoryIcon` 40, nombre `numberOfLines={2}` con `ellipsizeMode="clip"`, nota 2 líneas, importe `flexShrink: 0`, `minHeight: 56`, etiqueta «Editar movimiento de X del F: gasto de $M, nota: ...» | - |
| 10 Contador = `total` de la API | A | A | OK con matiz | 668 (singular, plural, oculto al cargar o en error). Con total 0 también se oculta (el vacío lo sustituye): conforme, ver 13.4 (d) | - |
| 11 Estados de Historial; «Cargar más» único | A | A | OK | 106, 118, 186 (doble toque = una llamada, «Cargando…»), 206 (error conserva la lista), 736, 744 | - |
| 12 Respuesta tardía no pisa | A | A | OK | 221, 755 | - |
| 13 Cambio de `account.id` sin remontar | A | A + código | OK | 774; `HistoryScreen.tsx` 110-122 reinicia filtros, lista y mensajes en el mismo render (ningún dato anterior se pinta) y el efecto de carga depende de `account.id` | - |
| 14 Día de la semana, sin `Date` | U | U + código | OK | `calendar.test` 59 (contra `Date.UTC`, 2000 a 2100), 302; `calendar.ts` sin `new Date` ni `Date.` | - |
| 15 `calendarCellWidth` y altura 52 | U | U + A | OK | Fórmula `(W - 2×16 - 6×3)/7` truncada a centésimas: **360 dp = 44,28** (≥ 44), **412 dp = 51,71** (≥ 48); 7 celdas + 6 huecos = 327,96 dp ≤ 328 dp disponibles. `calendar.test` 289, 296; `CalendarScreen.test` 409; `sizes.calendarCellHeight` = 52 | - |
| 16 Cuadrícula, estados de celda, cifras con signo | A | A + código | OK | 423, 435, 472, 485; la celda elegida usa `calStrong` y número y cifras en blanco (5,67:1); hoy: borde 2 `calStrong`; hoy+elegida: anillo `calTile` (4,69:1); borde 2 siempre presente (sin saltos); cifras `+`/`−` 10 sp con `allowFontScaling={false}` | - |
| 17 Flechas de mes, anuncio, límites | A | A | OK | 504 (anuncia «Octubre 2026», 48 dp, límites 2000-01 y 2100-12), 142, 148 | - |
| 18 Elegir día | A | A | OK | 154, 522 (sin anuncio adicional) | - |
| 19 Resumen del mes: etiqueta única, «no disponible», mes vacío | A | A + código | OK | 96, 533, 545; contenedor `accessible` con «Resumen de octubre: ingresos $X, gastos $Y, neto $Z»; 2 + 1 de `SummaryTile` (docs/003 R4 D5) | - |
| 20 Detalle del día | A | A | OK | 176, 551 (solo «Este día no tiene movimientos registrados.»; con movimientos, línea con signos) | - |
| 21 «+ Anotar en este día» | A | A | OK | 254, 373, 390, 573, 587; etiqueta «Nuevo movimiento el 14 de octubre», distinta de la del FAB; secundario; `disabled` con la cuenta archivada | - |
| 22 Errores independientes y «Cargar más» | A | A | OK | 208, 226, 238, 602, 614 | - |
| 23 Reportes: mes actual, `Segmented`, flechas | A | A | OK | `ReportsScreen.test` 277, 300, 348, 809, 822 | - |
| 24 Rango: botones, avisos, consultas | A | A + código | OK | 348, 389; «Elige las fechas «Desde» y «Hasta».» y orden inválido sin consulta; `applyRange` valida antes de consultar | - |
| 25 Tarjetas Ingresos/Gastos botones; Balance texto | A | A | OK | 521, 830, 845 (Balance negativo en `text`, no `expenseText`); valores = respuesta de la API | - |
| 26 Barras de categoría | A | A + código | OK | 209, 860, 881, 915; `ReportsScreen.tsx` 561: `scaleUnits(total, max, 1000)/10` % + `minWidth: 4` si `total > 0`; nombre `numberOfLines={2}` con `clip`; porcentaje en texto; barra `importantForAccessibility="no"`; relleno `categoryFill(color)` | - |
| 27 Serie: leyenda, Gráfico/Tabla | A | A + código | OK con matiz | 944, 956, 974, 994. La vista elegida **no** se conserva al cambiar de pestaña (permitido por el criterio: «si no, vuelve a Gráfico») ni, además, al cambiar de mes, año o rango (UXQA-R4-02) | UXQA-R4-02 |
| 28 Exportación al final, anti doble toque | A | A + código | OK | 1005, 1028, 645, 667, 734, 744, 576; la guarda `exporting` es una referencia (síncrona); CSV y PDF conservan sus etiquetas y su entrega; sin movimientos no se ofrece | - |
| 29 Estados de Reportes | A | A | OK | 1038, 1046, 1067, 1085 | - |
| 30 Cálculos de Reportes y Calendario intactos | A | A + diff | OK | `reports.test.ts` sin cambios; `calendar.test.ts` solo con líneas añadidas (0 eliminadas); `lib/reports.ts` sin diff | - |
| 31 Categorías: segmentado, vacío por tipo | A | A | OK | `CategoriesScreen.test` 50, 71, 82, 89; sin «Egresos» en pantalla (el valor interno sigue siendo `egreso`) | - |
| 32 Fila de categoría | A | A + código | OK | 184, 199; `CategoryIcon` 40, nombre sin `numberOfLines`, «Archivada» como texto, «⋮» 48×48 con «Acciones de {nombre}» | - |
| 33 Hoja «⋮» | A | A | OK | 205, 227, 233 (Editar, Archivar/Desarchivar, Eliminar con `danger`; «Cerrar» cierra; `onRequestClose` cierra) | - |
| 34 Formulario: tipo, color, vista previa, validación | A | A + código | OK | 245, 269, 284, 322, 449, 473; 7 colores de 76×72 dp, «✓» y «Color: Rojo»; editar envía solo lo cambiado | - |
| 35 Eliminar y `CATEGORY_IN_USE` | A | A | OK | 364, 377, 387 (aviso con el texto exacto y [Archivar «nombre»] que llama a `updateCategory({ archivada: true })`) | - |
| 36 Descarte y Atrás | A | A + código | OK | 506, 513, 526, 535, 555-621; en `CategoryFormCard` el listener que cierra el formulario se registra antes que el del guard, así que el guard (último registrado) se consulta primero; `MainNavigator.test` 971 | - |
| 37 Cuenta archivada y errores de la API | A | A | OK | 89, 145, 294, 308, 638, 654, 670 | - |
| 38 Llegada desde Nuevo movimiento | A | A | OK | 625; `MainNavigator.test` 903, 941, 961 («‹ Volver» solo si `fromForm`; `fromForm` se pasa en `MainNavigator.tsx` 286) | - |
| 39 `MainNavigator` entre cuentas y Atrás | A | A + código | OK con matiz | `MainNavigator.test` 156 (Reportes -> Historial filtrado -> Atrás conserva modo y período), 353 (Categorías -> Más), 562, 591 (Reportes sin datos de la cuenta anterior); Historial, Calendario, Reportes y Categorías tienen además la prueba de cambio de `account.id` sin remontar y el contenedor las remonta con `key={account.id}` (`MainNavigator.tsx` 202, 282, 307). El matiz: a nivel del navegador solo Reportes se prueba de punta a punta; ver 13.4 (g) | - |
| 40 Typecheck, lint, Prettier y suite | A | A | OK con matiz | 13.1: todo en verde con la caché caliente; con la caché fría falla 1 prueba por tiempo | UXQA-R4-01 |
| 41 Celdas medidas a 360 y 412 dp en el teléfono | D | - | **PENDIENTE (D)** | No hay dispositivo. Cálculo: 44,28 × 52 dp a 360 y 51,71 × 52 a 412; sin solape (hueco 3). Seis semanas: 6 × 52 + 5 × 3 = 327 dp de alto de cuadrícula | - |
| 42 TalkBack en calendario, resumen, filas | D | - | **PENDIENTE (D)** | Roles y etiquetas verificados solo en Jest | - |
| 43 Fuente 130 % y 200 % sin truncar | D | - | **PENDIENTE (D)** | Hay código para fuente grande (tabla apilada con `fontScale ≥ 1,15`, `ModuleTile` 28/oculto, exportación en columna con `≥ 1,3`); sin medir. Riesgo: ver 13.4 (h) | - |
| 44 `DatePickerSheet` con gestos y tres botones | D | - | **PENDIENTE (D)** | `Modal` con edge-to-edge sin probar en dispositivo (riesgo ya anotado en docs/003 R1/R3) | - |
| 45 Hoja «⋮» y formulario con teclado abierto | D | - | **PENDIENTE (D)** | `ScrollView` con `keyboardShouldPersistTaps="handled"`; el comportamiento de `KeyboardAvoidingView` en Android (`behavior` indefinido) y el cálculo de `useSystemInsets` con teclado solo se ven en dispositivo | - |
| 46 Exportar CSV y PDF en Android real | D | - | **PENDIENTE (D)** | La entrega usa `shareExport` (simulado en Jest) | - |
| 47 Scroll largo sin quedar bajo el FAB ni la barra | D | - | **PENDIENTE (D)** | Historial y Calendario pasan `bottomInset` a `contentContainerStyle`; Reportes y Categorías no llevan FAB (conforme a docs/007 §5.11 B.9). AND-09 sin medir | - |
| 48 Zonas de chips `sm` y barras en escala de grises | D | - | **PENDIENTE (D)** | `Chip size="sm"` 36 dp con `hitSlop` 6 arriba y abajo y filas a 12 dp: las zonas se tocan sin solaparse (6 + 6 = 12). Escala de grises: ver 13.4 (i) | - |

### 13.3 Verificaciones solicitadas con atención

| Tema | Resultado | Evidencia |
| --- | --- | --- |
| Título sin cuenta y una sola acción primaria | OK | Historial y Calendario: el único primario es el FAB (`Button` «Filtros» secundario; «+ Anotar en este día» secundario); Reportes: ningún primario (Exportar, Aplicar y tarjetas secundarias); Categorías: «+ Nueva categoría» (`primary tall`) y, con el formulario abierto, «Guardar» (el botón de nueva categoría se oculta mientras el formulario está abierto, así que sigue habiendo uno). Acción destructiva «Eliminar» separada 8 dp en la hoja y en `danger` |
| Historial: plegable, chips, rango, validación, agrupación, contador, estados, paginación, cambio de cuenta | OK (A) | Criterios 3 a 13 |
| Calendario P-3 y estados | OK (A) | Criterios 15 a 22. Celda 44,28 × 52 a 360 dp y 51,71 × 52 a 412; sin solape por tener 3 dp de hueco |
| SummaryTile 2+1 con etiqueta única | OK | `month-summary` es un solo elemento `accessible`; los tres `SummaryTile` quedan dentro y no se anuncian por separado |
| «+ Anotar en este día» frente al FAB | OK | Etiquetas distintas («Nuevo movimiento el 14 de octubre» frente a «Nuevo movimiento»); `getByLabelText` exacto no es ambiguo |
| Reportes: mes por defecto, rango, resumen, barras | OK | Criterios 23 a 26. `package.json` sin cambios y sin `react-native-svg` |
| Reportes: ancho exacto por escala y mínimo 4 dp | OK | `width: ${scaleUnits(...)/10}%` y `minWidth: 4` si `total > 0`; prueba 881. El porcentaje en texto es sobre el total del grupo (docs/003 R4 D3 punto 5, aprobado por defecto) |
| Reportes: nombres sin truncar | OK con matiz | `numberOfLines={2}` con `ellipsizeMode="clip"` (hasta 2 líneas, sin puntos suspensivos) tal como fija docs/007 §5.11 B.4; un nombre de más de dos líneas se recortaría sin aviso (misma discrepancia ya registrada en el §12.6 sobre docs/007 «dos líneas o más» frente a docs/008). Se valida en dispositivo |
| Categorías: operaciones, hoja, color 76×72, vista previa, descarte, Atrás, `CATEGORY_IN_USE`, 409 | OK (A) | Criterios 31 a 38. Crear, editar, archivar, desarchivar, eliminar, interruptor de archivadas y aviso de cuenta archivada conservados |
| Ayuda desde el formulario | OK | `FROM_FORM_HELP` «Crea una categoría y vuelve para anotar tu movimiento.» solo con `fromForm` |
| Contraste y objetivos de 48 dp | OK (A, T) | 13.1. 48 dp: botones (`minHeight` 48), `DateField`, `MonthArrow` (zona 48), «⋮» 48×48, `Segmented` 48, filas ≥ 56, tarjetas de Reportes `minHeight` 48. Excepciones aprobadas P-1 (chips `sm`) y P-3 (celdas de día) |
| Textos exactos en español | OK | Todos los de docs/007 §5.11 G: «Aún no hay movimientos. Cuando anotes el primero, aparecerá aquí.», «Ningún movimiento coincide con estos filtros.», «Cargando movimientos…», «Calculando tu resumen…», «Cargando categorías…», «No hay movimientos en este mes.», «Este día no tiene movimientos registrados.», «Sin movimientos en este período. Prueba con otro mes.» (año/rango), «Elige las fechas «Desde» y «Hasta».», «Exportar este período» y su texto, «Aún no tienes categorías de gasto. Crea la primera.», textos de descarte, `IN_USE_NOTICE`. Sin «Egreso» en pantalla |

### 13.4 Lo declarado por el implementador

| Punto | Clasificación | Evidencia y razonamiento |
| --- | --- | --- |
| (a) En Reportes los totales no seguros pasan por `formatCents` y podrían mostrar «$0.00» inventado | **Sin defecto (no alcanzable); observación de robustez** | `formatCents` devuelve «$0.00» para un valor no entero seguro (`money.ts`). Pero `ReportsScreen` solo recibe datos de `getReportSummary`, `getReportByCategory` y `getReportByPeriod`, y sus analizadores (`resources-api.ts` `parseReportSummary`, `parseCategoryGroup`, `parsePeriodReport`) rechazan con `invalid()` cualquier importe que no sea entero seguro (`isCents`), cualquier suma que no cuadre (`exactSum`) y cualquier balance incoherente. Un total no seguro llega a la pantalla como **error con «Reintentar reportes»**, nunca como «$0.00» (prueba `ReportsScreen.test` 250 de exactitud con importes grandes y `resources-api.test`). El Calendario sí tolera una suma no segura y muestra «—» (`monthTotals`). Observación: si en el futuro se relajara el analizador, Reportes mostraría «$0.00» sin aviso; conviene que Reportes use el mismo patrón de «—» que Calendario (no es defecto hoy, ver docs/010 §3, fila «EST: nunca \$0.00 por fallo») |
| (b) La vista Gráfico/Tabla se reinicia al cambiar de pestaña | **Permitido en la pestaña; defecto bajo en el cambio de período** | El criterio 27 acepta el reinicio al cambiar de pestaña. Pero `PeriodSeries` vive dentro de `ReportContent`, que se desmonta mientras `shown` es `null` (cada cambio de mes, año, rango o reintento muestra «Calculando tu resumen…»). Quien elige «Tabla» y toca «›» vuelve a «Gráfico». UXQA-R4-02 |
| (c) Margen lateral 16 dp | **Conforme a docs/007; discrepancia documental con docs/008** | `screenStyles.container` usa `padding: 16` y `CALENDAR_SIDE_MARGIN` = 16, coherentes entre sí y con docs/007 §5.11 D.2 («2 × 16 dp»). docs/008 §6.14 dice «16 (20 con ancho ≥ 400)»: ninguna pantalla aplica 20 dp. Con 20 dp a 412 dp la celda sería 50,57 dp (sigue ≥ 48). Se devuelve a `mobile-visual-designer`/`mobile-ux-designer` para alinear los documentos; no es defecto de código |
| (d) Contador oculto con 0 resultados | **Conforme** | docs/007 §5.11 C.1 oculta el contador solo al cargar o con error y no define «0 movimientos»; con 0 resultados la pantalla muestra el vacío («Aún no hay movimientos...» o «Ningún movimiento coincide...»), sin contradecir. Mostrar «0 movimientos» sobre un vacío sería redundante |
| (e) Dos «Limpiar filtros» a la vez | **Observación (conforme a la especificación)** | Con el panel abierto, filtros activos y 0 resultados aparecen el ghost del panel (docs/007 C.2) y el botón del vacío (C.6); el criterio 7 pide ambos («panel y vacío filtrado»). Hacen lo mismo. Un lector de pantalla encuentra dos botones con el mismo nombre y no hay ambigüedad de destino. Se podría ocultar el del panel cuando el vacío lo ofrece; no se exige |
| (f) `relaxTimeoutsForColdCache` en `test-utils.ts` | **Aceptable en sí; mal aplicado: UXQA-R4-01** | Solo sube `jest.setTimeout` a 30 s y `asyncUtilTimeout` a 5 s; no cambia ninguna aserción ni omite pruebas, y es por archivo de prueba. Pero solo la llaman `App.test`, `App.resources.test`, `MainNavigator.test` y `TransactionFormScreen.test`. Las suites nuevas o pesadas de R4 (`HistoryScreen.test`, y por la misma razón `CalendarScreen`, `ReportsScreen`, `CategoriesScreen`) no la llaman y la primera falla con la caché fría, que es el caso de `npm test` en CI |

### 13.5 Defectos

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R4-01 | Historial (pruebas) | Criterio 40 (suite en verde); docs/010 §5 | **Media** (bloquea el PR si la CI falla; corrección trivial) | `cd app && npx jest --ci --no-cache --maxWorkers=2 src/screens/HistoryScreen.test.tsx` (o la primera corrida con la caché de Jest fría) | docs/007 §5.11 I-40: la suite completa en verde; `.github/workflows/ci.yml` ejecuta `npm test` con caché fría (el `cache: npm` solo guarda dependencias) | La prueba «muestra carga, luego los movimientos con categoría y monto con signo» supera los 5000 ms del límite por defecto (transformación en línea de React Native): 1 falla de 168 en las cuatro suites de R4 con `--no-cache`, y 1 de 110 en la primera corrida. Con caché caliente 1445 de 1445 | `app/src/screens/HistoryScreen.test.tsx` (no llama a `relaxTimeoutsForColdCache` de `app/src/test-utils.ts`); mismo riesgo en `CalendarScreen.test.tsx`, `ReportsScreen.test.tsx` y `CategoriesScreen.test.tsx`. Nivel A. Para `mobile-engineer`: llamar al helper una vez al inicio de las cuatro suites (o fijarlo en la configuración de Jest) |
| UXQA-R4-02 | Reportes (Año y Rango) | EST, ACC (docs/007 §5.11 E.4 y criterio 27) | Baja | Abrir Reportes en modo Año, elegir «Tabla» y tocar «Año anterior» o «Año siguiente» (o «Aplicar» en Rango) | La vista elegida («Gráfico» o «Tabla») se conserva al recorrer períodos: el criterio 27 solo admite el reinicio al cambiar de pestaña interna | La vista vuelve a «Gráfico» en cada cambio de período y en cada «Reintentar reportes», porque `PeriodSeries` guarda `seriesView` y se desmonta con `ReportContent` mientras carga. Quien prefiere la tabla (alternativa accesible de la gráfica) debe volver a elegirla cada vez | `app/src/screens/ReportsScreen.tsx` (`PeriodSeries`, `useState<SeriesView>`, líneas 619-621; desmontaje en 362-385). Nivel A (código). Elevar `seriesView` a `ReportsScreen` (o a `detail.views`) |
| UXQA-R4-03 | Historial | EST, A11Y | Baja | Abrir Movimientos filtrado por una categoría desde Reportes mientras la lista de categorías aún no cargó, o con su carga fallida (el panel de filtros está cerrado) | docs/007 §5.11 C.3: chip «{categoría} ✕» con etiqueta «Quitar filtro: {categoría}» | Mientras `byId` no tiene la categoría el chip dice «Categoría ✕» y su etiqueta «Quitar filtro: Categoría», y las filas muestran «Categoría» con el ícono gris. Si la carga de categorías falla, el error solo aparece dentro del panel (cerrado por defecto) y el nombre genérico se queda | `app/src/screens/HistoryScreen.tsx` (línea 271 `?? 'Categoría'`; `categories.state.status === 'error'` solo se pinta en el panel, 348-350). Nivel A (código). Mostrar el aviso fuera del panel o conservar el nombre que ya conoce Reportes (`categoryName` en `HistoryFilters`) |

### 13.6 Observaciones sin defecto

- Contraste: ningún par nuevo de R4 incumple AA (13.1). El borde `border` de la celda del calendario en reposo (1,19:1 frente a `bg`) es decorativo, igual que la separación de las tarjetas: el número y las cifras son el contenido; el límite honesto de las barras contra su pista (2,44 a 4,06:1) está aceptado en docs/003 R4 D5.
- Chips `sm` de categoría: la zona táctil vertical es de 48 dp (P-1), pero el ancho de un chip con un nombre de 3 o 4 letras puede quedar por debajo de 48 dp (relleno de 12 dp a cada lado). Pasa el mínimo de WCAG 2.5.8 (24 dp); se mide en dispositivo (criterio 48).
- Selector de color de Categorías: cada opción mide 76 × 72 dp fijos y el nombre del color es de 12 sp sin límite de líneas; con fuente al 200 % un nombre como «Naranja» podría salirse de los 72 dp. Se valida en dispositivo (criterio 43).
- `RANGE_FORMAT_ERROR` en `lib/reports.ts` («Escribe fechas válidas con formato AAAA-MM-DD...») ya no es alcanzable (el rango sale del selector y las fechas vacías se tratan antes). Texto muerto; conviene retirarlo para no contradecir docs/007 E.1.
- `CalendarScreen` calcula el neto del día restando `ingresos - gastos` en la app (`selectedEntry.ingresos - selectedEntry.gastos`); ambos son enteros seguros, la resta es exacta y la especificación lo conserva como EXISTENTE (docs/007 D.4). Reportes sí muestra el `balance` de la API.
- Foco inicial en el título (docs/007 §5.11 H): no se fuerza con `setAccessibilityFocus`; se confía en el orden de lectura (barra, título, contenido) como en R2 y R3. Se valida con TalkBack (criterio 42).
- `ModuleTile` usa emojis (📋 📅 📊 🏷️) como glifo decorativo, ocultos a los lectores; su apariencia depende de la fuente del sistema Android (nivel D).
- Cobertura del criterio 39: el navegador solo prueba de punta a punta el cambio de cuenta en Reportes; Movimientos y Calendario tienen la prueba de `account.id` en su pantalla y el remontado por `key`. Categorías e Historial filtrado no tienen selector de cuenta alcanzable (barra de solo lectura).

### 13.7 Pendientes (no demostrados) y motivo

Todo nivel D por falta de emulador, dispositivo y TalkBack: criterios 41 a 48 (medición de las celdas a 360 y 412 dp, TalkBack en el calendario, el resumen y las filas, fuente al 130 % y 200 %, `DatePickerSheet` con gestos y tres botones, hoja «⋮» y formulario con el teclado abierto, exportar CSV y PDF en Android real, scroll largo sobre el FAB y la barra de pestañas, zonas de los chips `sm` y barras en escala de grises). Tampoco se ejecutó el nivel R (comparación con `docs/design/capturas/`; `verify.js` valida el prototipo, no la app) ni se tomaron capturas. Safe areas, teclado y `Modal` con edge-to-edge siguen sin demostrarse. Mientras tanto, ninguna de estas filas puede darse por validada en dispositivo.

Regresión: suite completa en verde con la caché caliente (38 suites, 1445 pruebas), tsc, eslint y Prettier sin avisos; la repetirá `qa-engineer` como validación técnica. Los scripts del scratchpad (contraste) no están versionados y no modifican `/app`.

### 13.8 Revalidación R4 tras D6 (margen responsive, chips `sm` y selector de color)

```
Fecha: 2026-10-16 · Rama: feat/rediseno-ux-ui sobre 281bc86, cambios sin commit · Niveles: A y T (código y Jest); sin R ni D
Comandos: cd app && npx jest --ci --maxWorkers=2 -> 38 suites, 1466 pruebas, todas en verde
          npx jest --ci --no-cache de History, Calendar, Reports y Categories -> 180 de 180 (antes fallaba 1)
          tsc --noEmit, eslint --max-warnings=0, prettier --check -> sin avisos · contrast.js --check -> salida 0 · package.json sin cambios
Decisión: APROBADO CON OBSERVACIONES. Ningún defecto alto ni crítico. El cierre sigue condicionado al nivel D (criterios 41 a 48).
```

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Margen 16/20 con `screenMargin(width)` | OK (A, código) | `tokens.ts`: 20 dp desde 400 dp, 16 por debajo. Lo usan `useScreenMargin`/`useScreenContainerStyle` (`ui.tsx`) en Historial, Calendario, Reportes y Categorías; `Screen padded` (Mis cuentas, Crear cuenta), `MoreScreen`, `AccountSummaryTab`, `TransactionFormScreen` (contenido), el aviso de cuenta archivada de `MainNavigator`, el `Fab` (`right`) y `calendarCellWidth` |
| Sin doble margen | OK | El relleno lateral se aplica una sola vez por pantalla: `Screen` de pestaña/formulario/Categorías/Historial filtrado usa `padded={false}` y la pantalla interna pone `padding: margin`; el aviso de archivada tiene su propio `paddingHorizontal` y las pantallas con `Screen padded` no lo repiten. Pruebas de `ui`, `MainNavigator` y cada pantalla en verde |
| Celda del Calendario | OK | `(W - 2m - 18)/7`: 360 dp (m = 16) = **44,29 dp** (≥ 44); 399 dp = 49,86; 400 dp (m = 20) = **48,86**; 412 dp = **50,57** (≥ 48). Alto 52. Siete celdas + 6 huecos = 371,99 dp ≤ 372 dp disponibles a 412 |
| Chips `sm` 48×48 efectivos | OK (cálculo) | `minHeight` 36 + `hitSlop` 6 arriba y abajo = 48 dp vertical; `minWidth` 48 = 48 dp horizontal. Filas separadas 12 dp: las zonas ampliadas (6 + 6) se tocan sin solaparse; horizontalmente no hay `hitSlop` y el hueco es 8 dp. Cierra la observación de ancho del §13.6. Medición real: criterio 48 (D) |
| Selector de color | OK (A, código); fuente grande PENDIENTE (D) | `colorOption`: `width: 76`, `minHeight: 72`, sin `height` fija, así que el nombre del color puede crecer en alto sin recorte. Queda el ancho fijo de 76 dp: un nombre largo («Amarillo») al 200 % puede partirse por letras; se valida en dispositivo (criterio 43) |
| Regresiones en criterios 1 a 40 | Sin regresión | Suite completa en verde (1466). `calendar.test` y `reports.test` sin expectativas eliminadas |

Estado de los defectos de R4:

| ID | Estado | Verificación |
| --- | --- | --- |
| UXQA-R4-01 (media) | **Cerrado (A)** | Las cuatro suites de R4 llaman a `relaxTimeoutsForColdCache()`; con `--no-cache` pasan 180 de 180 |
| UXQA-R4-02 (baja) | **Cerrado (A, código)** | `seriesView` ahora vive en `ReportsScreen` (línea 129) y se pasa a la serie, así que sobrevive al cambio de período y al reintento |
| UXQA-R4-03 (baja) | **Cerrado (A, código)** | Los chips sin nombre usan un texto neutro y el error de nombres de categorías aparece fuera del panel («No pudimos cargar los nombres de las categorías...» con «Reintentar categorías») |

Residuales (ninguno alto ni crítico):

1. **Baja:** quedan en 16 dp fijos, aunque a ≥ 400 dp el contenido va a 20 dp: el pie fijo de `TransactionFormScreen` (`footer.paddingHorizontal: 16`) y la barra de contexto compacta (`barCompact.paddingHorizontal: 16`, `account-ui.tsx`). Con 412 dp el botón «Guardar» y la barra quedan 4 dp más anchos que el contenido. docs/007 §5.2.5 fija el margen de 16/20 para el contenido de Mis cuentas y docs/008 §6.14 para las pantallas; no menciona pie ni barra, por lo que no es contradicción estricta. Decidir con `mobile-visual-designer` si se alinean.
2. **Observación:** el aviso temporal (`Snackbar`, `left/right: 16`) y la barra de contexto completa (8 dp interno) no siguen el margen; son superpuestos o de borde a borde y no están cubiertos por la regla.
3. **Observación:** `LoginScreen` conserva un `#1a73e8` literal y un relleno de 16 dp fijo; es la pantalla del botón de Google (fuera del alcance de R4, no contradice docs/008 mientras se mantenga el color de la marca de Google).
4. Los márgenes de 16 internos de tarjetas (`Card`, `SummaryTile`, tarjeta total de Mis cuentas, formulario de categoría) son relleno de tarjeta, no margen de pantalla: correctos.
5. Nivel D pendiente: 360/412 dp reales, fuente 130 % y 200 % (selector de color, chips), zonas de los chips y el cambio 399/400 dp, TalkBack, teclado y exportación real.

## 14. Informe de ejecución R5 (guías contextuales y estados vacíos ilustrados)

```
Informe de ejecución UX-QA - R5
Fecha: 2026-10-16
Rama y commit evaluados: feat/rediseno-ux-ui sobre 3c5630c (R4), con los cambios de R5 SIN commit
Ejecutor: mobile-ux-qa (agentId: lo registra quien coordina; no se dispone aquí)
Alcance: docs/007 §5.12 (A a K, criterios J1 a J26), docs/008 §9.1 a 9.4 y §3.4, docs/003 R5 D1 a D6 y R4 D6.
         lib/guides.ts, hooks/use-guides.tsx, screens/ui.tsx (GuideCard, EmptyState), AccountsScreen, NewAccountScreen,
         TransactionFormScreen, AccountSummaryTab, CalendarScreen, ReportsScreen, CategoriesScreen, HistoryScreen,
         MoreScreen, MainNavigator, App.tsx y app/assets/illustrations/*.
Entorno: niveles A (Jest y revisión de código) y T (contrast.js y cálculo WCAG propio). Sin R ni D: no hay emulador, dispositivo
         ni TalkBack. Nada de lo de este informe se ejecutó en Android. J21 a J26 y todo lo de TalkBack, fuentes reales,
         teclado real y anchos reales quedan PENDIENTES (nivel D). Las ilustraciones se vieron como PNG sueltos, no dentro de la app.
Resumen R5: J1 a J20 con nivel A: OK (J16 con matiz); J21 a J26 (nivel D): PENDIENTE.
            Defectos: 0 críticos, 0 altos, 0 medios, 3 bajos (UXQA-R5-01 a 03). Observaciones: 14.6.
Decisión: APROBADO CON OBSERVACIONES. Ningún defecto alto ni crítico. El cierre de R5 sigue condicionado al nivel D
          (J21 a J26) y, para el cierre del rediseño, a la alcancía de Mis cuentas (R6, docs/003 R4 D6.5).
```

### 14.1 Comandos y resultados (nivel A/T)

| Comando | Resultado |
| --- | --- |
| `cd app && npx jest --ci --maxWorkers=2` | 42 suites, 1543 pruebas, todas en verde (coincide con lo esperado) |
| `npx jest --ci --no-cache --maxWorkers=2` sobre `guides.test.tsx`, `use-guides.test.tsx`, `guides.test.ts`, `App.guides.test.tsx`, `MoreScreen.test.tsx`, `HistoryScreen.test.tsx` | 6 suites, 129 pruebas en verde con la caché fría (las suites nuevas llaman a `relaxTimeoutsForColdCache`; no se repite UXQA-R4-01) |
| `npx tsc --noEmit`, `npx eslint --max-warnings=0 src`, `npx prettier --check src` | sin errores ni avisos |
| `node docs/design/contrast.js --check` | salida 0 (los 17 pares R5 añadidos al script cumplen) |
| Cálculo WCAG propio (fórmula de luminancia relativa, scratchpad) | `text` sobre `tile` 13,28 a 14,07:1; «✕» (`ink`) sobre `tile` 7,19 a 8,41:1; `brand700` sobre `tile` 6,03 a 6,39:1; `text2` sobre `tile` 6,14 a 6,50:1. Coincide con docs/008 §9.2 |
| `git diff --stat -- package.json package-lock.json app.json ../api` | sin cambios: sin dependencias, sin config nativa, sin API |

### 14.2 Resultados por criterio de docs/007 §5.12.J

| J | Resultado | Nivel | Evidencia |
| --- | --- | --- | --- |
| 1 Catálogo: 8 ids únicos con el texto exacto | OK | A | `guides.ts` coincide palabra por palabra con la tabla C y con §7.1 (revisión propia de los 8 textos) y `guides.test.ts` «tiene exactamente los 8 ids únicos con el texto aprobado» |
| 2 Clave `guias_v1_` + id, caracteres no admitidos a `_`, `/^[A-Za-z0-9._-]+$/` | OK | A | `guideStorageKey`; `guides.test.ts` «guias_v1_ + id y reemplaza lo no admitido» |
| 3 Solo `{v:1,vistas}` con ids del catálogo, sin duplicados ni datos financieros | OK | A | `serializeGuideRecord` solo emite versión e ids en orden de catálogo; `guides.test.ts` «nunca guarda datos financieros ni de identidad»; `App.guides.test` compara el valor guardado con `guideRecord(...)` |
| 4 Lectura tolerante; versión 2 no se sobrescribe | OK | A | `parseGuideRecord`: ausente, JSON inválido, forma inesperada, ids desconocidos ignorados y `v > 1` bloqueada; `markSeen` y `reset` no escriben si `locked` (pruebas «lectura tolerante» y «no sobrescribe una versión mayor») |
| 5 Fallo de lectura o de escritura: sin romper, sin reaparecer, sin error | OK con observación | A | `use-guides.test` y `guides.test.tsx` J5. Ver UXQA-R5-03 (lectura fallida y escritura que sí funciona) |
| 6 Con la lectura pendiente no hay guía | OK | A | `ready` falso hasta resolver; `use-guides.test` y `guides.test.tsx` J6 |
| 7 `cuentas-vacio` + vacío; Entendido descarta y no vuelve al re-montar | OK | A | `guides.test.tsx` «sin cuentas: guía + vacío…» |
| 8 Cada guía con su condición y sin ella con datos, carga, error o cuenta archivada | OK | A | Mis cuentas, Crear cuenta, Detalle, Calendario, Reportes y Categorías con pruebas positivas y negativas; Nuevo movimiento no aparece al editar ni archivada. Condiciones en código: `activeCount === 0 && archivedCount === 0`, `activeCount >= 2` (D5), `monthEmpty && weekEmpty && !archivada` (sin filtro), `entries.size === 0 && !archivada`, `cantidad === 0` sin error, `loaded && !archivada` |
| 9 Nunca dos `GuideCard` a la vez | OK | A | Una sola llamada a `useGuide` por pantalla; `pickGuide` devuelve la primera del catálogo; solo se monta la pestaña activa y la ruta superior de la pila (`MainNavigator` if/else por `route.name`) |
| 10 [Entendido] y [✕] «Cerrar ayuda», 48 dp | OK | A | `guideClose` `minWidth/minHeight: sizes.touchMin` (48); [Entendido] es `Button` (`minHeight` 48); prueba GuideCard J10 |
| 11 Completar la acción descarta | OK | A | `NewAccountScreen` descarta `cuentas-vacio` y `cuenta-crear` solo tras guardar; `TransactionFormScreen` descarta `movimiento-nuevo` y `cuenta-detalle` solo tras guardar (no en error) |
| 12 No reaparece al cambiar de cuenta, de pestaña ni al re-montar | OK | A | Prueba del navegador (cuenta, pestaña y «Ver ayudas otra vez» sin recargar) |
| 13 «Ver ayudas otra vez»: texto, subtítulo, vacía, aviso, efecto inmediato | OK | A | `HELP_RESET_DONE` exacto; `resetAll` pone `seen: []` en memoria tras guardar; sin confirmación; fila entre «Cuenta» y «Sesión» (encabezado «AYUDA») |
| 14 `busy`, un solo guardado, error exacto, fila reactivada | OK | A | `resettingHelp` (ref) + `disabled`/`accessibilityState {disabled, busy}`; prueba de doble toque con una escritura; `HELP_RESET_ERROR` exacto en `ErrorBox`; `helpError` se limpia al reintentar |
| 15 Dos usuarios independientes; sin ids del anterior | OK | A | `use-guides.test` (tres pruebas de cambio de usuario) y `guides.test.tsx` (navegador); ver 14.4 |
| 16 `signOut` no borra la clave de guías | OK con matiz | A | `guides.ts` no tiene operación de borrado (solo `getItemAsync`/`setItemAsync`; `deleteItemAsync` solo aparece en `session-storage.ts`, sin cambios); `App.guides.test` comprueba que la sesión se limpia y que la clave `guias_v1_sub-1` se conserva y no vuelve la guía; `guides.test.ts` comprueba que `deleteItemAsync` nunca se llama. Matiz: la prueba de `App` usa un almacén de guías en memoria, no el espía de `SecureStore.deleteItemAsync` con los dos nombres de sesión que pide la letra del criterio; la garantía es estructural |
| 17 Cada vacío con su texto exacto, su acción y la ilustración decorativa | OK con observación | A | Ver 14.3. `importantForAccessibility="no"`, `accessibilityElementsHidden`, `accessible={false}`, sin etiqueta |
| 18 `fontScale` 1,75 y 2: sin ilustración, texto y acción sí, guía visible | OK | A | `showArt = !compact && !large`; ni dibujo ni círculo con emoji ni hueco; `GuideCard` solo oculta el 💡 y conserva todo; pruebas GuideCard y EmptyState |
| 19 Acciones conservan `testID`, etiquetas y 48 dp | OK | A | «Limpiar filtros» (`secondary`), «+ Anotar en este día», «Crear mi primera cuenta» (`tall`, 52 dp, `stateActionWide`) |
| 20 Regresión | OK | A | Suite completa 42/1543; `package.json`, `session-storage`, `auth-service`, API y navegación sin cambios; tsc, eslint y Prettier limpios |
| 21 Persistencia tras cerrar desde recientes | PENDIENTE | D | Requiere teléfono. En Jest solo se demuestra el re-montaje con el mismo almacén simulado |
| 22 Guía no tapa FAB, pestañas ni barra; con teclado no empuja el monto | PENDIENTE | D | Por código la guía va dentro del contenido con scroll, no flota; el teclado no se prueba en Jest |
| 23 TalkBack (orden, botones, foco, ilustraciones) | PENDIENTE | D | Ver UXQA-R5-01 |
| 24 Fuente 130, 175 y 200 % | PENDIENTE | D | La lógica por `fontScale` está probada con `mockWindow`, no con la fuente real de Android |
| 25 Anchos 360 y 412 dp, ilustración centrada | PENDIENTE | D | |
| 26 Dos cuentas de Google en el mismo teléfono | PENDIENTE | D | Solo la simulación de Jest con dos ids |

### 14.3 Textos y estados vacíos (nivel A, revisión de código y pruebas)

| Vacío | Texto en el código | Ilustración | Resultado |
| --- | --- | --- | --- |
| Mis cuentas sin cuentas | Título «Todavía no tienes cuentas»; mensaje «Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.»; [Crear mi primera cuenta] `tall` | Círculo con 🐷 (la alcancía es de R6, D6) | OK |
| Mis cuentas, solo archivadas | «No tienes cuentas activas. Puedes crear una o desarchivar una de las anteriores.»; mismo botón | Círculo con 🐷 | OK |
| Pestaña Cuenta recién creada | «Tu cuenta está lista.» + «Anota tu primer gasto o ingreso con el botón +.» | Hoja (PNG) | OK |
| Pestaña Cuenta, semana vacía | «Esta semana no has anotado movimientos.» + «Toca + para registrar el primero.» (archivada: solo la primera frase) | Hoja (PNG) | OK con observación 14.6-3 |
| Pestaña Cuenta, filtro sin resultados | «Esta semana no tienes gastos/ingresos anotados.» | Ninguna (`compact`) | OK |
| Historial vacío | Título «Aún no hay movimientos» + mensaje «Cuando anotes el primero, aparecerá aquí.» | Hoja (PNG) | OK con observación 14.6-4 |
| Historial filtrado | «Ningún movimiento coincide con estos filtros.» + [Limpiar filtros] `secondary` | Embudo (PNG) | OK |
| Calendario, mes y día | «No hay movimientos en este mes.» / «Este día no tiene movimientos registrados.» | Ninguna (`compact`) | OK |
| Reportes | «Sin movimientos en este período. Prueba con otro mes/otro año/otro rango.» | Barras (PNG) | OK |
| Categorías | «Aún no tienes categorías de gasto/ingreso. Crea la primera.» (archivada: sin la última frase) | Círculo con 🏷️ (sin etiqueta aprobada, D6) | OK |

Ilustraciones: en `app/assets/illustrations/` solo hay `vacio-movimientos.png`, `vacio-filtros.png` y `vacio-reportes.png` (288 x 288, RGBA, idénticos byte a byte a los de `docs/design/assets/illustrations/`, `cmp`). Vistos como imagen: hoja con «+» ámbar, embudo azul y barras violeta con una amarilla, sobre su círculo de tinte; coinciden con docs/008 §9. No hay alcancía ni etiqueta (correcto según D6). `EmptyState` las muestra con `<Image style={{width: 96, height: 96}} resizeMode="contain">`, es decir con ancho y alto fijos. Metro las incluye con `require`; el empaquetado real no se verificó (no se ejecutó build).

### 14.4 Verificaciones solicitadas con atención

| Punto | Resultado | Razonamiento |
| --- | --- | --- |
| No bloquean; una a la vez; solo con datos cargados y «sin datos»; no se repiten; completar descarta | OK (A) | `GuideCard` es una `Animated.View` dentro del flujo, sin `Modal` ni posición absoluta ni foco; `useGuide` exige `ready` y la condición de la pantalla; las condiciones se evalúan solo con `status === 'ready'` |
| Persistencia por usuario y formato | OK (A) | Clave `guias_v1_<id>` y valor `{"v":1,"vistas":[...]}` (14.2, J2 a J4). Sin montos, nombres, correos ni ids de cuenta |
| `deleteItemAsync` nunca llamado en `signOut` | OK (A) | 14.2, J16 |
| Cambio de cuenta sin ayudas incorrectas | OK (A) | Las guías son por usuario; la barra de solo lectura y el cambio de cuenta solo afectan a las condiciones «sin datos», que dependen de la cuenta cargada |
| Cambio de usuario: ¿fuga de la clave de otro usuario? | **Sin fuga hallada** (A, código y pruebas) | (a) `dismiss` y `resetAll` capturan el `userId` de su render: un descarte tardío del usuario A escribe solo en `guias_v1_A` (prueba «un descarte tardío…»). (b) `setLoaded` solo actualiza si `previous.userId === userId`. (c) `current` es `null` mientras `loaded.userId !== userId`, así que al cambiar a B no se ven ids de A y no hay guía hasta leer B. (d) La lectura lenta de A se descarta con `cancelled` (prueba «una lectura lenta…»). (e) `known` solo se usa si `latest.current.userId === userId`. (f) Al cerrar sesión el proveedor se desmonta (el árbol cambia a `LoginScreen`), y entre usuarios `MainNavigator` se remonta por `key`. Riesgos residuales sin efecto financiero: la carga (`store.load`) no pasa por la cola por clave, y un descarte hecho antes de terminar de leer podría ser pisado en memoria por la lectura; no es alcanzable porque no hay guía visible antes de `ready` |
| «Ver ayudas otra vez» | OK (A) | `busy`, error, doble toque, efecto inmediato y aviso verificados (J13 y J14). Con una versión mayor `reset` no escribe pero `resetAll` devuelve true y la pantalla muestra el aviso: coherente, porque esa versión se lee como vacía (todas las guías se muestran) |
| `GuideCard`: ✕ 48 dp, [Entendido] 48 dp, ancho completo a 130 %, movimiento reducido | OK (A) con UXQA-R5-02 | Con movimiento reducido no anima |
| Margen 16/20 | OK (A, código) | La guía no pone margen lateral propio: hereda el de la pantalla (`useScreenContainerStyle`, `Screen padded`, `useScreenMargin` en Detalle y en el formulario), de modo que sigue la regla de R4 D6. Medición real: D |
| Colores literales | OK | Las líneas añadidas por R5 en `app/src` no contienen ningún literal `#RRGGBB` ni `rgb(`; todo sale de `colors`, `moduleColors` y `radii` |
| Criterios previos R2 a R4 | Sin regresión | Suite completa 42/1543. Los textos que cambian son los de los vacíos descritos en 14.3 |

### 14.5 Lo declarado por el implementador

| Punto | Clasificación | Evidencia y razonamiento |
| --- | --- | --- |
| (a) Foco de accesibilidad al encabezado al descartar: no implementado | **Defecto bajo UXQA-R5-01** (pasa a medio si TalkBack confirma la pérdida de foco) | docs/007 §5.12.G.3 lo pide. Es la misma decisión que en R2 a R4 (no se fuerza `setAccessibilityFocus`; se confía en el orden de lectura). Al desmontarse el botón pulsado, Android deja el foco sin destino claro. No se puede demostrar sin TalkBack (J23) |
| (b) Animación de salida de 120 ms omitida | **Conforme a docs/007; discrepancia menor con docs/008 §9.2** | docs/007 §5.12.C dice «sin animación obligatoria» y la regla de memoria de docs/008 §9.2 exige que la tarjeta desaparezca al instante. Omitirla es la opción más simple y no afecta ningún criterio J. Observación 14.6-1: documentar la omisión en docs/008 |
| (c) Fila de Ayuda con estilo de `Row` (15/700, radio 10) frente a 16/600 (`greeting`) y radio 12 | **Observación; contradicción documental, no defecto de código** | docs/008 §9.4 dice a la vez «mismo estilo que las demás filas de Más» y fija 16/600 con mosaico de radio 12 y glifo de 20 sp. El código sigue la primera frase: todas las filas de Más comparten tipografía, radio 10 y glifo de tamaño por defecto, por lo que la fila nueva es coherente con su entorno. Alinear una sola fila con la medida de §9.4 la haría distinta de «Datos de cuenta», «Categorías» y «Exportar». Se devuelve a `mobile-visual-designer` para decidir si se cambian las medidas del documento o todas las filas (UXQA-R5-04 si se confirma el cambio) |
| (d) Escritura con lectura fallida: reescribe solo lo conocido en memoria | **Defecto bajo UXQA-R5-03** | Sí puede perder descartes previos, ver abajo |

### 14.6 Defectos

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R5-01 | Todas las guías | ACC; docs/007 §5.12.G.3; J23 | Baja (pendiente de TalkBack; media si se confirma) | Con TalkBack, abrir una pantalla con guía, ir a [Entendido] o «Cerrar ayuda» y activarlo | Al descartar, el foco de accesibilidad pasa al encabezado de la pantalla, sin anuncio extra | No hay código que mueva el foco: el nodo enfocado se desmonta y el foco queda sin destino definido (lo decide TalkBack; puede saltar al inicio o a un elemento arbitrario) | `app/src/screens/ui.tsx` (`GuideCard`, `onDismiss` sin `AccessibilityInfo.setAccessibilityFocus`). Nivel A (código); comportamiento real sin demostrar (D) |
| UXQA-R5-02 | Todas las guías | EST, microinteracción; docs/008 §9.2 | Baja | Abrir cualquier pantalla donde aparezca una guía (movimiento reducido apagado) | La tarjeta aparece con opacidad 0 a 1 en 180 ms | `opacity` nace en 1 (`new Animated.Value(1)`) y solo pasa a 0 cuando `isReduceMotionEnabled()` resuelve: la tarjeta se pinta completa, desaparece un instante y luego se desvanece (parpadeo). Con movimiento reducido no hay parpadeo | `app/src/screens/ui.tsx` (`GuideCard`, `useRef(new Animated.Value(1))` y `opacity.setValue(0)` dentro del `.then`). Nivel A (código); se aprecia en D. `Snackbar` ya empieza en 0 |
| UXQA-R5-03 | Persistencia | EST; docs/007 §5.12.B.8 y J5 | Baja | 1) El usuario tiene `vistas: ["calendario"]` guardado. 2) Una lectura de SecureStore falla de forma puntual al arrancar (`load` devuelve «ninguna descartada»). 3) El usuario descarta otra guía y la escritura sí funciona | Las guías ya descartadas no se vuelven a mostrar y no se pierde lo guardado | `markSeen` vuelve a leer, cae al `catch` de `readRecord` (vacío) y escribe `addSeen([], known + nuevas)` con lo conocido en memoria, que también está vacío: se sobrescribe `calendario` y esa guía reaparece. Un valor corrupto se sobrescribe a propósito (correcto); el problema es confundir «no pude leer» con «no hay nada». Efecto: solo ayudas repetidas, sin datos financieros ni bloqueo | `app/src/lib/guides.ts` (`readRecord`, `markSeen`, `reset`); `app/src/hooks/use-guides.tsx` (`known`). Nivel A (código); sin prueba que lo cubra. Sugerencia: distinguir el fallo de lectura de «ausente» y, ante un fallo, no sobrescribir (queda descartada solo en memoria) |

### 14.7 Observaciones sin defecto

1. Documentar en docs/008 §9.2 la omisión de la animación de salida y la regla de que la guía desaparece al instante (declarado (b)).
2. `cuentas-lista` (abrir una cuenta), `calendario` (tocar un día con movimientos) y `reportes` («Ver movimientos ›») se descartan al hacer la acción aunque la guía nunca se haya mostrado (por ejemplo, con una sola cuenta o con datos). Conforme a docs/007 §5.12.C («se descarta también al»), pero el usuario que ya tenía datos no verá después esa guía cuando se cumpla su condición. Decisión de producto, sin cambio.
3. Pestaña Cuenta con cuenta archivada: la primera frase del vacío («Esta semana no has anotado movimientos.») se muestra como mensaje `body` en `text2`, no como título `h2` como en la cuenta activa; el estilo cambia entre las dos variantes del mismo vacío. docs/008 §9.3 no distingue las dos.
4. Historial vacío y semana vacía parten la frase en título y mensaje (docs/008 §9.3); docs/007 §5.12.F y §7.2 tienen una sola frase. Para un lector de pantalla son dos elementos. Aceptado por docs/008; alinear docs/007.
5. Pestaña Cuenta: al cambiar de mes con la guía visible, `MonthSummary` vuelve a cargar, `monthEmpty` pasa a `null` y la guía desaparece mientras carga, con salto de diseño al reaparecer. Es una consecuencia de exigir «datos cargados» (regla B.3); lo mismo ocurre en Calendario al cambiar de mes. Sin cambio exigido.
6. Con cuenta recién creada coexisten la guía `cuenta-detalle` y el vacío «Tu cuenta está lista»: dos mensajes sobre el botón «+», con texto distinto. Aceptado en docs/007 §5.12.C (notas).
7. Pestañas de Más: `Row` ahora aplica opacidad 0,85 al presionar a todas las filas, no solo a la de Ayuda (cambio inocuo y coherente con docs/008 §9.4).
8. `GuideCard` agrupa el texto, ✕ y [Entendido] como elementos separados, con ✕ antes de [Entendido] en el orden de lectura; la etiqueta «Cerrar ayuda» es correcta. Se valida con TalkBack (J23).
9. `tsconfig.json` en la raíz del repositorio (`extends expo/tsconfig.base`, sin `include`) está sin seguimiento y es anterior a R5 (fecha 15 de octubre); no forma parte de R5. Conviene que quien coordina decida si se versiona o se descarta antes del commit.

### 14.8 Pendientes (no demostrados) y motivo

Todo el nivel D por falta de emulador, dispositivo y TalkBack: J21 a J26 (persistencia tras cerrar desde recientes, guía y FAB, barra de pestañas y barra del sistema, teclado abierto en Nuevo movimiento, TalkBack, fuente 130, 175 y 200 %, 360 y 412 dp, dos cuentas de Google). Tampoco se hizo el nivel R (comparación con `docs/design/capturas/` y con el prototipo), no se tomaron capturas de la app y no se comprobó el empaquetado de los PNG con Metro ni la fuente de los emojis (💡, 🐷, 🏷️) en Android. Mientras tanto ninguna de estas filas puede darse por validada en dispositivo. Pendiente de otros agentes: `qa-engineer` repite typecheck, lint y regresión; la alcancía de Mis cuentas sigue obligatoria antes del cierre del rediseño (R6).

## 15. Preparación técnica de la validación Android

> **Corrección del paso 356.** La primera versión de este apartado recomendaba USB con `adb reverse` y afirmaba que `@expo/ngrok` no estaba instalado. Ambas afirmaciones eran erróneas. El mecanismo utilizado y comprobado en este proyecto es el **túnel de Expo (ngrok)**: `cd /workspaces/ControlGastos/app && npx expo start --dev-client --tunnel`, con la Development Build ya instalada en el teléfono (evidencia: informe del usuario del 13/10/2026 sobre las reconexiones del túnel ngrok, y sesiones de Fase 3 con `expo start --tunnel` en marcha; `@expo/ngrok@4.1.3` está instalado en el directorio global de npm del contenedor). **No se requieren ADB, cable USB ni depuración USB.** Las menciones a USB y `adb` de este documento son alternativas históricas no utilizadas; donde un texto posterior diga «opción 1», debe leerse «túnel». Los comandos de `adb` para capturas o `logcat` son opcionales y solo aplican si el usuario los tiene disponibles.

Fecha: 2026-10-16. Rama `feat/rediseno-ux-ui`, HEAD `a64e746` (R5). Solo lectura e inspección: no se inició Metro, no se instaló nada, no se generó APK ni EAS Build, no se tocó `app/` ni `api/` y no se leyó ningún `.env` real (de `app/.env.example` solo se comprobó el nombre de las variables). Este apartado prepara la validación de los niveles D y R pendientes en §14.8; no valida nada por sí mismo.

### A. Compatibilidad de la development build existente con el código actual

Build de referencia (docs/004, Fase 5): EAS build `375e4dc0-2e61-4fb8-b411-9e06a9a93456`, perfil `development`, Android, distribución interna, SDK 57, 15/10/2026 20:05-20:14 (hora local), keystore remoto existente. EAS empaqueta el árbol de trabajo; la base fue `bc75b03` y el manifiesto de la app en esa build es el que quedó confirmado en `0e0b5f8` (PR #15, integrado ese mismo día). Es el último commit que modificó `app/package.json` y `app/app.json`.

Evidencia de comandos:

| Comando | Resultado |
| --- | --- |
| `git log -- app/package.json app/app.json app/eas.json` | Último cambio: `0e0b5f8` (Fase 5). R1 a R5 (`107a495`, `94e37e0`, `281bc86`, `3c5630c`, `a64e746`) no aparecen. |
| `git diff --stat 0e0b5f8 HEAD -- app/package.json app/app.json app/eas.json package.json package-lock.json app/index.ts` | Vacío: ningún cambio en dependencias, plugins, configuración Expo, EAS, lockfile ni punto de entrada. |
| `git diff --name-only 0e0b5f8 HEAD -- app` filtrando `.ts`/`.tsx` | Solo 3 archivos no TypeScript: `app/assets/illustrations/vacio-filtros.png`, `vacio-movimientos.png`, `vacio-reportes.png`. |
| Imports nuevos en `app/src` desde `0e0b5f8` | Solo `react-native` (API del núcleo: `AccessibilityInfo`, `Alert`, `Animated`, `BackHandler`, `Dimensions`, `Platform`, `StatusBar`, `useWindowDimensions`, etc.) y `expo-secure-store`/`expo-status-bar`/`@react-native-google-signin/google-signin`, que ya estaban. No hay módulos nuevos. |
| Versiones instaladas (`node_modules`) | `expo 57.0.27`, `react-native 0.86.3`, `expo-dev-client 57.0.20`: coinciden con `app/package.json` (`~57.0.27`, `0.86.3`, `~57.0.20`). |

Módulos nativos y plugins vigentes (idénticos a los de la build):

- Plugins de `app.json`: `expo-status-bar`, `expo-secure-store`, `expo-sharing`. Paquete Android `com.cuidatubilletera.app`, `userInterfaceStyle: light`, `owner: luiscaizasoria`, `extra.eas.projectId` presente.
- Dependencias de `app/package.json`: `@react-native-google-signin/google-signin ^16.1.5`, `expo ~57.0.27`, `expo-dev-client ~57.0.20`, `expo-file-system ~57.0.7`, `expo-secure-store ~57.0.4`, `expo-sharing ~57.0.23`, `expo-status-bar ~57.0.1`, `react 19.2.3`, `react-native 0.86.3`.

Conclusión: R1 a R5 son solo JavaScript/TypeScript y assets. La development build existente es compatible y no hace falta una nueva. Limitaciones de esta conclusión: (1) no se puede inspeccionar el APK instalado en el teléfono desde el contenedor; se asume que el teléfono tiene instalado el APK de la build `375e4dc0` (docs/004 lo deja como «instalar el APK de Development»; si nunca se instaló o se instaló una build anterior de Fase 3 o 4, `expo-sharing` no estará y la exportación fallará con mensaje, sin afectar al resto del rediseño). (2) La coincidencia de versiones se comprobó contra `node_modules` y `package.json`, no contra el binario.

Cambios que llegan por Metro sin recompilar: todo `app/src/**` (tokens, componentes base, navegación, formularios, pantallas, guías) y los PNG de `app/assets/illustrations/` cargados con `require` (Metro los empaqueta; docs/003 3.x D6). Cambios que NO llegarían por Metro y por eso siguen fuera de R1 a R5: ícono, splash y nombre (R6, requiere nueva build y autorización expresa) y cualquier plugin o módulo nativo.

### B. Comandos exactos

Estado del entorno comprobado:

- `which adb`: no existe en el contenedor (no se necesita). `@expo/ngrok@4.1.3` SÍ está instalado en el directorio global de npm (`npm ls -g`; `npm ls` local no lo muestra y de ahí el error inicial): `--tunnel` funciona sin instalar nada.
- `devcontainer.json` reenvía `8787` (Wrangler) y `8081` (Metro), ambos `onAutoForward: silent`. El reenvío de VS Code escucha en `localhost` del anfitrión, no en la IP LAN.
- IP del contenedor `172.17.0.2` (red interna Docker, inalcanzable desde el teléfono).
- docs/005 declara que el contenedor está «instalado y validado», pero que Expo Go contra Metro, tanto desde Windows como desde el contenedor, sigue NO verificado, y recomienda ejecutar Metro en Windows. La variable que fija el host que anuncia Metro es `REACT_NATIVE_PACKAGER_HOSTNAME`.

Con la información disponible la LAN directa desde el contenedor probablemente NO funciona (IP interna y reenvío solo a `localhost`). Opciones ordenadas:

| # | Opción | Pros | Contras |
| --- | --- | --- | --- |
| 1 | USB + `adb reverse` con `adb` de Windows (platform-tools) y Metro en el contenedor (reenviado a `localhost:8081` del anfitrión por VS Code) | Sin túnel, sin dependencias nuevas, independiente de Wi-Fi y firewall; el teléfono ve `localhost:8081` | Requiere platform-tools en Windows, depuración USB activa y cable; además `adb screencap`/`logcat` quedan disponibles |
| 2 | LAN con Metro en Windows (fuera del contenedor), según docs/005 | Es la opción documentada como inicial | Requiere `npm` y `node_modules` de Windows (el repo usa volúmenes Linux en el contenedor, así que habría que instalar dependencias en Windows: es una acción que no se hizo ni se autoriza aquí); firewall de Windows y misma red |
| 3 | LAN desde el contenedor con `REACT_NATIVE_PACKAGER_HOSTNAME=<IP LAN de Windows>` | Sin instalar nada | Requiere publicar el 8081 hacia la red (no solo `localhost`) y regla de firewall; no probado |
| 4 | `--tunnel` | Funciona con cualquier red | Necesita `@expo/ngrok` (dependencia no instalada, requiere autorización), más lento, expone el bundle por un túnel público |

Recomendación vigente (paso 356): **opción 4, `--tunnel`**, que es la que el usuario ya utilizó y comprobó; no necesita cable ni `adb`. Las opciones 1 a 3 son alternativas no utilizadas.

Comandos (a ejecutar por el usuario o con su autorización; no se ejecutaron):

```
# En el contenedor, carpeta de la app. Puerto 8081, modo development build:
cd /workspaces/ControlGastos/app && npx expo start --dev-client

# Variantes
npx expo start --dev-client --localhost                      # solo localhost: pareja de «adb reverse»
npx expo start --dev-client --lan                            # IP del contenedor (172.17.0.2): normalmente inútil para el teléfono
REACT_NATIVE_PACKAGER_HOSTNAME=<IP-LAN-de-Windows> npx expo start --dev-client --lan   # opción 3
npx expo start --dev-client --tunnel                         # opción 4 (la utilizada): @expo/ngrok ya está instalado globalmente
npx expo start --dev-client --clear                          # primer arranque tras muchos cambios, limpia la caché de Metro

# En Windows (PowerShell), con el teléfono por USB y depuración USB activa:
adb devices
adb reverse tcp:8081 tcp:8081
```

Notas: `npx expo start` sin `--dev-client` abre Expo Go en lugar del dev client y no sirve (la app usa Google Sign-In nativo). El script `npm start` de `app/package.json` ejecuta `expo start` sin esa bandera: usar `npx` con `--dev-client`. Las variables `EXPO_PUBLIC_*` se leen al arrancar Metro: tras cambiarlas reiniciar con `--clear`.

### C. Pasos breves en el teléfono

1. Confirmar que está instalada la development build «CuidaTuBilletera» (paquete `com.cuidatubilletera.app`) de la build `375e4dc0`. No instalar otra.
2. Con el servidor activo y la ruta elegida en §B, abrir la app. En la pantalla del dev client: elegir el servidor detectado, o «Enter URL manually» y escribir `http://localhost:8081` (opción 1) o `http://<IP-LAN>:8081` (opciones 2 y 3). Con `--tunnel`, la URL `https://...exp.direct` que muestra Metro. El QR de la terminal también se puede leer desde la cámara o desde el propio dev client.
3. Esperar el primer empaquetado (puede tardar). Si aparece «Configuración incompleta», ver §E.
4. Iniciar sesión con la cuenta de prueba, recorrer los casos de §4 y los pendientes J21 a J26 de §14.8, y registrar cada resultado con la plantilla de §10.
5. Para recargar JS: menú del dev client (agitar el teléfono o `adb shell input keyevent 82`) -> Reload; en la terminal de Metro, tecla `r`.

### D. Registro de evidencias

- Capturas: botones del teléfono (encendido + bajar volumen) o, con adb, `adb exec-out screencap -p > nombre.png` (en PowerShell usar `adb shell screencap -p /sdcard/x.png` seguido de `adb pull`, porque la redirección de PowerShell altera el binario).
- Grabación: `adb shell screenrecord --time-limit 60 /sdcard/x.mp4` y `adb pull /sdcard/x.mp4`; o la grabadora de pantalla del teléfono. Máximo 180 s por archivo.
- Logs: `adb logcat -c` antes del caso y luego `adb logcat ReactNativeJS:V AndroidRuntime:E *:S > caso.log` (los errores JS del dev client aparecen con la etiqueta `ReactNativeJS`; los cierres inesperados, con `AndroidRuntime`). Revisar el archivo antes de guardarlo: no debe contener tokens, correos ni importes personales (la app no registra tokens, pero un error de red puede incluir texto de respuesta).
- Errores del dev client: pantalla roja o amarilla (copiar el mensaje y la pila visibles), menú del dev client (agitar) -> «Open JS debugger» o «Show element inspector», y la terminal de Metro, que imprime los `console.*` y los errores de empaquetado. Fotografiar o capturar el aviso, no pegar contenido con datos.
- Ubicación: no existe hoy una carpeta de evidencias ignorada. `docs/design/capturas/` es la referencia de diseño versionada y no debe usarse. `.gitignore` ignora `.expo/`, `dist/`, `coverage/`, `*.log`, `.env*` y credenciales, pero no capturas ni vídeos. Propuesta: guardar fuera del repositorio (por ejemplo en una carpeta del anfitrión Windows, como `C:\evidencias-cuidatubilletera\R5\`) o, si se quiere dentro del árbol, crear `evidencias-local/` y excluirla con `.git/info/exclude` (regla local que no modifica `.gitignore`). Nombre sugerido: `<caso>_<pantalla>_<AAAAMMDD-HHMM>.png`, con el id de la matriz (J21, etc.). Solo se versiona el resumen en este documento (§10), nunca capturas con importes, correos o nombres reales; si hay que adjuntarlas, usar datos ficticios de una cuenta de prueba.

### E. Riesgos, bloqueos y lo que no se pudo verificar sin teléfono

Configuración de la API de DEV (sin valores):

- Variables: `EXPO_PUBLIC_API_URL` (URL base de la API, sin barra final) y `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (ID de cliente OAuth tipo Web de Google). Se leen en `app/src/lib/config.ts` con la forma literal `process.env.EXPO_PUBLIC_*`; Metro las incrusta al empaquetar.
- Dónde definirlas: en `app/.env` (ignorado por git; plantilla `app/.env.example`, que solo contiene marcadores) antes de arrancar Metro, o exportadas en el entorno del proceso. Ese archivo ya existe en el árbol de trabajo; no se abrió y se desconoce si su contenido apunta a DEV. El usuario debe comprobar que la URL sea la del Worker `controlgastos-api-dev` (docs/004) y no otra. Las variables del entorno `development` de EAS no aplican al ejecutar Metro localmente.
- Si faltan: `readConfig` devuelve `null` y se muestra `ConfigMissingScreen` («Configuración incompleta», menciona ambas variables y `app/.env.example`); la app no intenta autenticar. Si el valor existe pero es erróneo (URL equivocada), aparecerán errores de red o de login, no esta pantalla.
- La API de DEV debe tener desplegadas las rutas de Fase 5: según docs/004 se desplegó el 15/10/2026 (versión `1a73a98a-...`). R1 a R5 no cambian `api/`.

Riesgos y bloqueos:

1. La development build no apunta por defecto a un Metro fijo: el dev client pide el servidor al abrirse; no hay URL grabada en `app.json`. Si hay un servidor guardado de una sesión anterior (por ejemplo una IP LAN antigua), puede aparecer en la lista y fallar: elegir o escribir la URL correcta.
2. Red: ver §B. El mayor riesgo práctico es que la ruta elegida no funcione por Docker/WSL2/firewall (ninguna combinación está verificada, docs/005). Sin `adb` en el contenedor, `adb reverse` y las capturas por adb deben hacerse desde Windows.
3. Google Sign-In: el login depende de que el cliente OAuth Android tenga la SHA-1 del keystore remoto de EAS (`26:E4:D0:9D:...:73:F4`, docs/003, huella pública) y de la cuenta Google. Si el keystore de EAS se regenera, la SHA-1 cambia y falla con `DEVELOPER_ERROR` (código 10). La build `375e4dc0` reutilizó el keystore existente, así que debería seguir vigente. Si la pantalla de consentimiento está en modo «Prueba», solo entran las cuentas añadidas como usuarios de prueba: confirmar en Google Cloud (no verificable desde aquí).
4. Cuentas de prueba: docs/004 registra que no existe una identidad de prueba aislada; el D1 DEV tiene 1 usuario, 0 cuentas, 0 categorías y 0 movimientos. Cualquier prueba crea datos reales en DEV bajo la cuenta que inicie sesión. Usar una cuenta de Google de prueba, no la personal si hay datos propios, y no cargar datos reales (importes, nombres de comercios). Para J21 a J26 el usuario deberá crear cuentas y movimientos ficticios; el estado vacío ilustrado (R5) solo se ve con la cuenta sin movimientos.
5. DEV frente a producción: no existe D1 ni Worker de producción (docs/004), así que el riesgo de tocar datos de producción es nulo mientras la URL sea la de DEV. La sesión del APK previo (JWT v2) se restaura por SecureStore: puede haber una sesión antigua en el teléfono; cerrar sesión antes de la ronda para partir de cero.
6. Zona horaria: el calendario y las fechas dependen de la fecha del dispositivo; confirmar que el teléfono está en la zona horaria esperada (Ecuador, UTC-5, a juzgar por la hora local de las builds) y la fecha automática, o los casos de cambio de día y de mes darán resultados engañosos.
7. Expiración: una development build interna no caduca como las builds de Expo Go ligadas a un SDK, pero el APK es un artefacto de EAS con enlace temporal: si hace falta reinstalarlo, descargarlo de la página de la build (docs/004) y no generar otro.
8. Primer empaquetado lento y reinicios: cambios grandes (R1 a R5 suman unos 20 000 líneas en el diff) pueden requerir `--clear`. Si tras recargar se ve código viejo, reiniciar Metro con `--clear`.
9. Tamaño de la ilustración: los PNG se cargan con `require` (docs/003 3.x D6); nunca se comprobó su empaquetado ni la fuente de los emojis (💡, 🐷, 🏷️) en Android (§14.8). Es lo primero que debe mirarse en el teléfono. Si faltan, aparecería un error de Metro «Unable to resolve» (empaquetado) o un recuadro vacío/cuadrado (fuente), no un fallo de la build.
10. Compartir/exportar: depende de `expo-sharing` presente en la build `375e4dc0`; no probado en dispositivo (docs/004).

No se pudo verificar sin teléfono ni sin ejecutar Metro: que el APK instalado sea el de la build `375e4dc0`; que Metro arranque en este contenedor y que el teléfono lo alcance por cualquiera de las rutas; que `app/.env` apunte a DEV; que el login con Google funcione hoy (SHA-1, usuarios de prueba); el empaquetado de los PNG y la fuente de emojis; el comportamiento de teclado, safe areas, barra del sistema, TalkBack, escala de fuente y anchos de 360 y 412 dp; y la comparación visual con `docs/design/capturas/` (nivel R). Nada de esto se debe dar por validado hasta contar con evidencia de dispositivo.

## 16. Procedimiento de validación Android (matriz priorizada)

**Esta sección es un procedimiento. Ningún caso se ha ejecutado en Android.** No hay teléfono conectado al entorno; todas las casillas de resultado y de observaciones están vacías a propósito y solo las rellena quien ejecute la prueba en un dispositivo real. Nada de lo que sigue se debe leer como evidencia de nivel D. Un caso solo pasa a «OK» con la evidencia indicada (captura, vídeo o logcat) archivada según el §15.D; sin evidencia queda «PENDIENTE». Este procedimiento cubre R2 a R5 (HEAD `a64e746`); R6 (alcancía, ícono, splash) queda fuera.

### 16.0 Precondiciones y reglas de ejecución

1. Preparación técnica según el §15: development build ya instalada, Metro en el contenedor con `npx expo start --dev-client --tunnel` (sin `adb` ni cable), `app/.env` apuntando a la API de DEV (lo confirma el usuario; no se abre aquí), zona horaria y fecha automáticas del teléfono.
2. Datos: el D1 DEV tiene 1 usuario, 0 cuentas, 0 categorías y 0 movimientos (docs/003 y docs/004). Cada prueba crea datos en DEV. Usar solo una cuenta de Google de prueba y datos ficticios (nombres como «Prueba Efectivo»; ningún importe ni comercio real). Los pasos siguen un orden que reutiliza lo creado antes: no saltar pasos sin anotarlo.
3. Se necesitan dos cuentas de Google de prueba (A y B) para el V30. Las dos deben estar autorizadas como usuarios de prueba en Google Cloud (§15.E-3).
4. Ancho de pantalla: anotar siempre el ancho real en dp (Ajustes > Opciones de desarrollador > «Ancho mínimo», o el menú del dev client). Si el teléfono no mide 360 ni 412 dp, se puede acercar con Ajustes > Pantalla > «Tamaño de pantalla» o el «Ancho mínimo»; si no se logra, el criterio dependiente queda abierto y se declara el ancho probado. Nunca se informa 360/412 si no se midió.
5. Variantes del sistema: gestos (V24) y tres botones (V25) se prueban con el mismo recorrido corto; el resto del recorrido se hace en gestos con fuente 100 %, salvo V27 y V28.
6. Capturas con la nomenclatura del §6 (`<pantalla>-<ancho>.png`, variante en la carpeta `dispositivo/<variante>/`) y el nombre sugerido del §15.D `<caso>_<pantalla>_<AAAAMMDD-HHMM>.png`. Fuera del repositorio o en una carpeta excluida con `.git/info/exclude`. No usar `docs/design/capturas/`.
7. Antes de cada caso con logcat: `adb logcat -c`; al terminar, `adb logcat ReactNativeJS:V AndroidRuntime:E *:S > <caso>.log`. Revisar que no contenga tokens ni correos antes de guardarlo.
8. Cualquier fallo se registra con la plantilla del §16.3. Los defectos críticos y altos bloquean el cierre, el PR y el build (§7).
9. Lo que la app no debe mostrar nunca: «$0.00» por un fallo, «Sesión iniciada», «Egreso» en pantalla.

### 16.1 Recorrido ordenado (30 pasos)

Prioridad: **P0** bloqueante (dato financiero, pérdida de datos, contenido inalcanzable, sesión o aislamiento; si falla, R2 a R5 no se cierran), **P1** necesario para cerrar los criterios D pendientes, **P2** complementario (el criterio ya tiene respaldo fuerte en nivel A; se ejecuta si hay tiempo).

| Paso | Prio | Qué se recorre |
| --- | --- | --- |
| V01 | P0 | Arranque del dev client y login con Google |
| V02 | P0 | Mis cuentas vacío con guía y estado vacío ilustrado |
| V03 | P0 | Crear cuenta con saldo vacío y guía |
| V04 | P0 | Saldo inicial y «saldo en contra» |
| V05 | P0 | Montos rechazados (1.000, 1e5 y otros) y pegado |
| V06 | P2 | Nombre largo de 60 caracteres y pantalla de 360 dp en Mis cuentas |
| V07 | P0 | Selección y cambio de cuenta, total y Atrás básico |
| V08 | P0 | Registrar un gasto (orden de campos, un solo registro, saldo) |
| V09 | P0 | Registrar un ingreso |
| V10 | P2 | Validaciones del formulario |
| V11 | P0 | Formulario con el teclado abierto |
| V12 | P0 | Descarte de cambios (Atrás, ✕, Cancelar) |
| V13 | P1 | Selector de fecha |
| V14 | P0 | Calendario: celdas medidas a 360 y 412 dp |
| V15 | P1 | Calendario: selección de día y «+ Anotar en este día» |
| V16 | P1 | Historial y filtros |
| V17 | P1 | Reportes: totales, barras, Gráfico/Tabla |
| V18 | P1 | Reportes: barras en escala de grises |
| V19 | P1 | Exportación CSV real |
| V20 | P1 | Exportación PDF real |
| V21 | P1 | Categorías (⋮, color, eliminar y archivar) |
| V22 | P1 | Guías: descartar y persistencia tras cerrar la app |
| V23 | P2 | «Ver ayudas otra vez» |
| V24 | P0 | Safe areas con navegación por gestos |
| V25 | P0 | Safe areas con tres botones |
| V26 | P0 | Botón Atrás de Android en todas las pantallas |
| V27 | P1 | Fuente ampliada al 130 % |
| V28 | P1 | Fuente ampliada al 175 % y al 200 % |
| V29 | P1 | TalkBack (etiquetas, errores, foco al descartar una guía) |
| V30 | P0 | Cierre de sesión y segundo usuario de Google |

### 16.2 Tabla priorizada de casos

Leyenda de criterios: «R2-n» = criterio n de docs/007 §11.2 (§9 y §11.2 de este documento); «G21» = §12.2; «R4-n» = criterio n de docs/007 §5.11 I (§13.2); «J-n» = criterio n de docs/007 §5.12.J (§14.2); «AND-nn» = §4. Severidad «si falla»: C crítica, A alta, M media, B baja. El resultado se marca solo en el teléfono: OK, FALLA o N/A (con motivo). Todas las casillas están **sin marcar**.

#### P0 (bloqueantes)

| ID | Paso | Qué hacer exactamente | Resultado esperado | Criterio que cierra | Evidencia a capturar | Sev. si falla | Resultado | Obs. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V01 | Login | Cerrar sesión si hay una antigua (SecureStore conserva la anterior). Abrir el dev client, elegir el servidor Metro. Si sale «Configuración incompleta», anotarlo y detener. Pulsar «Ingresar con Google» y elegir la cuenta A | Pantalla de bienvenida con «Ingresar con Google» y «Inicia sesión para continuar.»; sin barra de estado superpuesta. Tras elegir la cuenta, llega a **Mis cuentas** (encabezado «Mis cuentas») sin ningún aviso «Sesión iniciada». Un fallo de login muestra un error comprensible en español, no un código | R2-3; SAFE de Bienvenida (§3); R2-1 (parcial) | `bienvenida-<ancho>.png`, `mis-cuentas-<ancho>.png`; logcat si hay error (`DEVELOPER_ERROR` = SHA-1) | A | [ ] | [ ] |
| V02 | Mis cuentas vacío | Con la cuenta A recién creada (0 cuentas) observar Mis cuentas sin tocar nada. Comprobar el emoji 🐷 y la ilustración | Guía «Bienvenido. Empieza creando una cuenta: puede ser tu efectivo, tu banco o tu tarjeta.» con [Entendido] y «Cerrar ayuda». Debajo, «Todavía no tienes cuentas», «Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.» y el botón [Crear mi primera cuenta]. Sin «Total en tus cuentas». Avatar de 48 dp que abre la hoja de perfil. El emoji se ve (no un recuadro) y ningún error de Metro «Unable to resolve» | J-7, J-17, J-22 (parcial); R2-3, R2-28; riesgo §15.E-9 (emojis y PNG) | `mis-cuentas-<ancho>.png` en 360 y 412 (o ancho real); captura de la hoja de perfil | M (emoji o ilustración rota); A si falta la acción para crear | [ ] | [ ] |
| V03 | Crear cuenta | Pulsar [Crear mi primera cuenta]. Observar el formulario. Escribir «Prueba Efectivo» y dejar el saldo vacío. Pulsar [Crear cuenta] | Título «Nueva cuenta»; etiqueta «Saldo inicial (opcional)» y la ayuda «Es el dinero que ya tienes hoy en esta cuenta. Déjalo vacío si empiezas en 0.»; guía «El saldo inicial es lo que ya tienes hoy. Si no estás seguro, déjalo vacío.». El botón pasa a «Creando…» y no admite doble toque. Se crea una sola cuenta con saldo $0.00 (anotar a qué pantalla navega) y la guía de cuentas vacías no vuelve | R2-23 (parcial); G16; J-7, J-11; AND-03 (parcial) | `crear-cuenta-<ancho>.png`; captura de la cuenta creada con su saldo; contar las tarjetas en Mis cuentas | A si se crea más de una cuenta (doble registro); M si falta una ayuda | [ ] | [ ] |
| V04 | Saldo inicial y saldo en contra | Crear «Prueba Banco» con saldo 100.50. Crear «Prueba Deuda» marcando «Es un saldo en contra (debo dinero)» con saldo 25 | Banco muestra $100.50 en su tarjeta y en la barra de contexto. Con la casilla marcada el campo muestra el prefijo «-$» (el teclado nunca escribe «-») y la tarjeta de Deuda muestra −$25.00 con signo y en rojo (`expenseText`), no «$25.00». Con importe 0 o vacío y la casilla marcada se guarda 0, no un negativo | G16; R2-21 (parcial, saldo negativo); R2-17 (saldo nunca inventado) | Captura de ambos formularios y de Mis cuentas con las tres tarjetas | C si el signo o el importe son incorrectos | [ ] | [ ] |
| V05 | Montos rechazados | En el saldo inicial de Crear cuenta y luego en el Monto de un movimiento escribir, uno por uno: «1.000», «1,234», «1e5», «12.345», «0.123». Después pegar «1,234.56» (copiado de una nota) y escribir «1000» y «12,50» | «1.000», «1,234», «12.345» y «1,234.56»: «Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.». «1e5»: «Escribe solo números, por ejemplo 12.50.». «0.123»: «Usa como máximo 2 decimales, por ejemplo 12.50.». Ninguno llama a la API (no se crea nada, no cambia el saldo). «1000» y «12,50» se aceptan y el importe guardado coincide con el visible. El pegado no se recorta sin aviso (la longitud máxima es 24) | G3, G4 (R3-07 cerrado en A); residual §12.9 (pegado con `maxLength` 24 en Android); R2-17 | Captura de cada mensaje; captura del pegado antes y después; cuenta o movimiento de «1000» guardado | C si un monto ambiguo se guarda con otro importe; A si el mensaje es incomprensible | [ ] | [ ] |
| V07 | Selección y cambio de cuenta | Con tres cuentas (Efectivo, Banco, Deuda) ver «Total en tus cuentas». Tocar «Prueba Banco». Ver la barra de contexto y las 5 pestañas. Abrir el selector de la barra y elegir «Prueba Efectivo». Volver con Atrás hasta Mis cuentas | Total = suma de las activas (con Banco 100.50, Efectivo 0.00 y Deuda −25.00: $75.50) y el texto «suma de 3 cuentas activas» en la etiqueta. Cada tarjeta es un único botón («{nombre}, saldo actual {saldo}. Abrir cuenta»). Al abrir: barra con nombre y saldo de Banco, pestañas Cuenta, Movimientos, Calendario, Reportes, Más. Cambiar de cuenta conserva la pestaña, cambia nombre y saldo y no muestra datos de la cuenta anterior. Atrás: pestaña → Cuenta → Mis cuentas | R2-2, R2-24, R2-28, R2-29, R2-4 (D); AND-11 | `detalle-<ancho>.png`; captura del selector; captura de Mis cuentas con el Total | C si se muestra o se actúa sobre la cuenta equivocada; A si el saldo de la barra es de otra cuenta | [ ] | [ ] |
| V08 | Registrar gasto | En «Prueba Banco» pulsar el FAB «+». Revisar el orden: Tipo, Categoría, Monto, Fecha, Detalle, [Guardar gasto]. Si no hay categorías de gasto (DEV las tenía en 0), debe verse «No tienes categorías de gasto activas. Crea una en Más > Categorías.» con [Ir a Categorías]: crear «Alimentación» (V21 parcial) y volver con «‹ Volver». Elegir Gasto, Alimentación, monto 12.50, fecha «Hoy», sin detalle. Pulsar [Guardar gasto] dos veces seguidas muy rápido | El orden es el indicado y el teclado no se abre solo al entrar. Se registra **un solo** gasto. Aviso «Gasto de $12.50 guardado en Alimentación». El formulario se cierra, la barra de contexto muestra el saldo nuevo (100.50 − 12.50 = $88.00) y el movimiento aparece en la semana de la pestaña Cuenta con signo y color de gasto | R2-5 y R2-6 (formulario); R2-16; G1, G2, G9, G10, G18; AND-13 (parcial) | Captura del formulario vacío, del aviso y de la pestaña Cuenta con el saldo nuevo; conteo de movimientos en Historial | C si se registra dos veces o el saldo es incorrecto; A si falta el aviso o la barra no se actualiza | [ ] | [ ] |
| V09 | Registrar ingreso | FAB «+», elegir Ingreso, crear la categoría «Sueldo» si falta, monto 50, fecha «Ayer». Guardar | Aviso «Ingreso de $50.00 guardado en Sueldo»; saldo $138.00; el movimiento aparece como ingreso (+, color de ingreso, no solo por color: lleva signo y etiqueta). Con fecha «Ayer» aparece en «Ayer» del Historial | R2-5; R2-16; G1, G8; INF | Captura del aviso, del saldo y del Historial | C si el signo o el importe es incorrecto | [ ] | [ ] |
| V11 | Teclado abierto | Abrir Nuevo movimiento y tocar Monto (teclado numérico `decimal-pad`). Repetir con Detalle y con Nombre/Saldo en Crear cuenta. Con el teclado abierto, comprobar que el botón de guardar y el campo activo se ven o se alcanzan con scroll. Cerrar el teclado. Repetir con gestos y con tres botones | El campo activo y [Guardar gasto]/[Crear cuenta] quedan visibles sobre el teclado (el pie es fijo); la barra de contexto pasa a compacta; no hay hueco blanco ni franja de fondo bajo el pie y el margen inferior no se cuenta dos veces (UXQA-R3-04). Al cerrar el teclado el diseño vuelve a su estado sin huecos. El Monto no recibe foco al abrir | G21; R2-23; AND-03, AND-04; J-22 (guía no empuja el monto); R4-45 (formulario de Categorías, ver V21) | Captura con teclado abierto (gestos y tres botones) en `dispositivo/teclado/` y captura con teclado cerrado | A si Guardar queda tapado por el teclado o la barra; C si es inalcanzable | [ ] | [ ] |
| V12 | Descarte de cambios | (a) Nuevo movimiento sin tocar nada: Atrás, luego ✕, luego Cancelar. (b) Escribir un monto y repetir Atrás hardware, ✕ y Cancelar. En el diálogo tocar [Seguir editando], luego volver a salir y tocar [Descartar]. (c) Tocar fuera del diálogo. (d) Repetir en Crear cuenta con un nombre escrito | (a) Salen sin diálogo. (b) Aparece «¿Descartar este movimiento?» / «Lo que escribiste se perderá.» con [Seguir editando] y [Descartar]; Seguir editando conserva lo escrito; Descartar vuelve a la pantalla de origen sin guardar. (c) Cerrar el diálogo equivale a Seguir editando. (d) «¿Descartar esta cuenta?» / «Lo que escribiste se perderá.». Con el guardado en curso («Guardando…»/«Creando…») Atrás no abre diálogo y se ignora. En Editar: «¿Descartar los cambios?» / «Los cambios que hiciste no se guardarán.» | G11, G12, G13, G10; R2-4 (D); AND-05 | Captura del diálogo; vídeo corto de Atrás con y sin cambios | A si Atrás pierde datos sin aviso (§7) | [ ] | [ ] |
| V14 | Calendario: celdas | Abrir la pestaña Calendario. Medir el ancho real del teléfono en dp. Capturar a 360 dp (o lo más cercano) y a 412 dp. Con seis semanas en el mes mostrado, comprobar el alto total y el desplazamiento. Si el ancho es ≥ 400 dp, comprobar que el margen es de 20 dp | A 360 dp la celda mide 44,29 × 52 dp (≥ 44) y a 412 dp 50,57 × 52 dp (≥ 48), con 3 dp entre celdas y sin solapes. Las cifras de ingreso y gasto con signo no se cortan; el día elegido y «hoy» se distinguen sin depender solo del color. Todo el contenido llega hasta encima del FAB y de la barra de pestañas | R4-41; R4-15 (D); R2-1; AND-08, AND-09 | `calendario-360.png`, `calendario-412.png` (o el ancho real) y la medición en dp (captura de Opciones de desarrollador) | A si las celdas se solapan o no se pueden tocar; M si hay recorte leve | [ ] | [ ] |
| V24 | Safe areas: gestos | Con navegación por gestos recorrer una pantalla por módulo: Login, Mis cuentas, Crear cuenta, Detalle (con FAB), Nuevo movimiento, Movimientos, Calendario, Reportes, Más, Categorías. Abrir cada hoja y modal: perfil, selector de cuenta, selector de fecha, hoja «⋮» y un diálogo. Desplazar hasta el último elemento de cada lista | Ninguna pantalla queda bajo la barra de estado (reloj y batería) ni bajo la barra de gestos. La barra de contexto y el título se ven completos. Pestañas, FAB, [Guardar] y los botones al pie no quedan bajo la línea de gestos. Las hojas y modales respetan los bordes (se prueba el `Modal` con edge-to-edge). El último elemento de cada lista es alcanzable sin quedar tapado por el FAB | R2-1; AND-01, AND-02, AND-06, AND-09; R4-44, R4-47; J-22 | Una captura por pantalla y por modal en `dispositivo/gestos/` | C si hay contenido inalcanzable bajo una barra del sistema | [ ] | [ ] |
| V25 | Safe areas: tres botones | Cambiar a navegación con tres botones (Ajustes > Sistema > Gestos). Repetir el recorrido de V24 con las mismas pantallas, hojas y modales | Igual que V24 con la barra del sistema más alta: pestañas, FAB y botones no quedan bajo los tres botones; el margen no se cuenta dos veces; las hojas llegan hasta el borde correcto. El gesto inferior no activa pestañas | R2-1; AND-02, AND-07; R4-44, R4-47; G21 (tres botones) | Capturas en `dispositivo/tres-botones/` de las mismas pantallas | C si hay contenido inalcanzable; A si se solapa un botón de acción | [ ] | [ ] |
| V26 | Botón Atrás | Con gestos y luego con tres botones, ejecutar Atrás en: Mis cuentas (raíz); pestañas Movimientos/Calendario/Reportes/Más; Categorías (desde Más y desde el formulario con «Ir a Categorías»); Nuevo movimiento; Reportes → Historial filtrado (tocar un total de Reportes) → Atrás; hoja de perfil, selector y diálogo | Mis cuentas: cierra la app (nunca vuelve a Login). Pestañas: vuelven a Cuenta y desde Cuenta a Mis cuentas. Categorías desde Más → Más; desde el formulario, «‹ Volver» y Atrás llevan a la pestaña de origen. Reportes → Historial filtrado → Atrás vuelve a Reportes con el mismo modo y período. Las hojas se cierran sin salir de la pantalla. Un gesto Atrás equivale al botón | R2-4 (D), AND-05, AND-06; R4-39 (D) | Vídeo corto del recorrido de Atrás | A si Atrás sale a una pantalla distinta de la tabla de docs/007 §3.4 o pierde datos | [ ] | [ ] |
| V30 | Cierre de sesión y segundo usuario | Con la cuenta A tener cuentas, movimientos y guías descartadas. Avatar → [Cerrar sesión]. Iniciar sesión con la cuenta B. Ver Mis cuentas, descartar la guía y cerrar sesión. Volver a la cuenta A | Cerrar sesión no pide confirmación y lleva al login. La cuenta B ve Mis cuentas vacío con la guía «Bienvenido. Empieza creando…» (las guías son por usuario) y **ningún dato de A** (cuentas, saldos, exportaciones). Al volver a A, sus guías descartadas siguen descartadas y sus datos están intactos; las de B no se mezclan | R2-12; AND-12; J-15, J-16, J-26 | Capturas del login tras cerrar, de Mis cuentas de B y de A al regresar | C si B ve datos de A; M si las guías se mezclan | [ ] | [ ] |

#### P1 (cierran criterios D)

| ID | Paso | Qué hacer exactamente | Resultado esperado | Criterio que cierra | Evidencia a capturar | Sev. si falla | Resultado | Obs. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V13 | Selector de fecha | En Nuevo movimiento tocar «Otra fecha…»; recorrer meses con las flechas; elegir un día. Reabrir y cerrar con Atrás, con «Cerrar» y tocando el velo. Repetir con gestos y tres botones | La hoja muestra el mes, las flechas «Mes anterior/siguiente» (48 dp), hoy marcado y los días a 48 dp. Elegir un día cierra la hoja y el botón muestra la fecha elegida («Otra fecha, {fecha}»). Atrás, «Cerrar» y el velo no cambian la fecha. La hoja no queda bajo la barra del sistema | G8; R4-44; AND-06, AND-07 | Capturas de la hoja en gestos y tres botones | A si queda bajo la barra o no se puede cerrar; M si la fecha cambia sin elegirla | [ ] | [ ] |
| V15 | Calendario: día | Tocar un día con movimientos y uno sin movimientos. Pulsar «+ Anotar en este día». Cambiar de mes con las flechas (TalkBack apagado) | Día con movimientos: detalle con los importes con signo. Día sin movimientos: «Este día no tiene movimientos registrados.». Mes vacío: «No hay movimientos en este mes.». «+ Anotar en este día» abre el formulario con esa fecha ya elegida y un descarte sin cambios no pregunta. Las flechas cambian de mes y respetan los límites; la guía «Los días con movimientos muestran sus importes. Toca un día para ver el detalle.» se descarta al tocar un día con movimientos | R4-16 a R4-21 (D complementario); R4-42 (sin TalkBack); J-8 | Capturas del día elegido, del día vacío y del formulario prefijado | A si el formulario abre con otra fecha; M si el detalle no coincide | [ ] | [ ] |
| V16 | Historial y filtros | Abrir Movimientos. Ver los movimientos de V08 y V09. Abrir «Filtros»: tipo, categoría y rango con el selector de fecha (elegir «Hasta» anterior a «Desde»). Ver los chips activos, quitar uno, «Limpiar filtros». Con un filtro sin resultados ver el vacío. Con el teclado no se usa campo de texto. Desplazar hasta el final | Lista agrupada por día («Hoy», «Ayer»), contador de movimientos, «Filtros (N)» con el panel plegable. Rango invertido: error visible sin consulta. Sin resultados: «Ningún movimiento coincide con estos filtros.» con [Limpiar filtros] y la ilustración del embudo. Chips «{categoría} ✕» con «Quitar filtro». Con pocos movimientos no aparece «Cargar más». El último movimiento queda sobre el FAB. Los chips pequeños se pueden tocar sin errar | R4-3 a R4-13 (D complementario); R4-47, R4-48; AND-09; J-17 | Capturas del panel, de los chips, del vacío filtrado y del final de la lista | M si un filtro devuelve datos incorrectos; A si inalcanzable bajo el FAB | [ ] | [ ] |
| V17 | Reportes | Abrir Reportes (mes actual). Comparar «Ingresos», «Gastos» y «Balance» con los movimientos creados (50.00, 12.50, balance 37.50). Cambiar a Año y a Rango (con el selector). Tocar la tarjeta Gastos. Alternar Gráfico/Tabla, cambiar de período y comprobar que la vista se conserva. Con un período vacío ver el vacío | Los totales coinciden exactamente con los movimientos (balance $37.50). Resumen accesible por mes. Barras por categoría con nombre, importe y porcentaje en texto. Tocar una tarjeta abre Movimientos filtrado. Período vacío: «Sin movimientos en este período. Prueba con otro mes.» con la ilustración de barras. La vista Tabla se conserva al cambiar de período. Nunca se ve «$0.00» por un fallo | R4-23 a R4-29 (D complementario); R4-27; J-17 | Capturas de Mes, Año, Rango, Tabla y vacío | C si un total no coincide; M si no se conserva la vista | [ ] | [ ] |
| V18 | Reportes: escala de grises | Activar escala de grises (Ajustes > Accesibilidad > Corrección de color > Escala de grises, o Opciones de desarrollador > «Simular espacio de color» > Acromatopsia). Abrir Reportes con al menos dos categorías de gasto. Capturar. Desactivarlo | Las barras de categoría se distinguen por longitud, por el nombre y por el porcentaje en texto, no solo por color. Ingresos/Gastos/Balance se entienden sin color (signo y etiqueta). Las pestañas activas y los chips seleccionados siguen identificables | R4-48 (barras en escala de grises); R2-10 (información no solo por color); R2-31 (estado en escala de grises) | Captura de Reportes y de Detalle en escala de grises | M si una información depende solo del color | [ ] | [ ] |
| V19 | Exportar CSV | En Reportes, con movimientos, tocar «Exportar CSV». Esperar la hoja de compartir y guardar o enviar el archivo a un destino de prueba. Abrir el CSV | Durante la exportación el botón dice «Exportando…» y no admite un segundo toque. Se abre la hoja de compartir de Android (la app tiene `expo-sharing`). El CSV se abre y sus cifras coinciden con Reportes. Sin movimientos no se ofrece exportar. Un error se muestra en español con la opción de reintentar | R4-46; R4-28; AND-13 | Captura de «Exportando…», de la hoja de compartir y del archivo abierto (con datos ficticios) | A si la exportación falla sin mensaje comprensible o se cuelga; M si cifras distintas | [ ] | [ ] |
| V20 | Exportar PDF | Igual que V19 con «Exportar PDF» | Igual que V19 con un PDF legible, con las mismas cifras del período y sin cortes de texto | R4-46; R4-28 | Captura de la hoja de compartir y del PDF abierto | A / M como V19 | [ ] | [ ] |
| V21 | Categorías | Abrir Más > Categorías. Pulsar «+ Nueva categoría»; con el teclado abierto escribir un nombre y elegir cada uno de los 7 colores (ver «✓» y «Color: Rojo»). Guardar. En una categoría con movimientos (Alimentación) abrir «⋮» (Acciones de Alimentación) y elegir Eliminar. En una sin movimientos, Eliminar. Archivar y Desarchivar | Segmentado Gastos/Ingresos sin «Egresos». Formulario con vista previa y [Guardar] visible con el teclado; los 7 colores son tocables (76×72 dp) y el nombre del color se lee completo. Hoja «⋮»: Editar, Archivar/Desarchivar y Eliminar (separado, destructivo). Eliminar con movimientos: «Esta categoría tiene movimientos, por eso no se puede eliminar. Puedes archivarla: no aparecerá al anotar movimientos nuevos, pero tu historial se conserva.» con [Archivar «Alimentación»]. Sin movimientos se elimina. Descartar el formulario con texto pide «¿Descartar esta categoría?». Guía «Las categorías ordenan tus gastos e ingresos. Puedes cambiarles el nombre y el color.» | R4-31 a R4-38 (D complementario); R4-45; R4-43 (selector de color); R4-48 (chips `sm`); G18 | Capturas del formulario con teclado, del selector de color, de la hoja «⋮» y del aviso de categoría en uso | A si se elimina una categoría con movimientos o se pierde el historial; M si el teclado tapa Guardar | [ ] | [ ] |
| V22 | Guías y persistencia | En V02 y V03 tocar [Entendido] en las guías. Cambiar de cuenta y de pestaña: no reaparecen. Cerrar la app **desde recientes** (deslizar fuera) y abrirla de nuevo con el mismo usuario. Comprobar que la guía no tapa el FAB, las pestañas ni la barra, y que no empuja el monto con el teclado abierto | Las guías descartadas no vuelven tras cerrar la app desde recientes ni al cambiar de cuenta o pestaña. Nunca hay dos guías a la vez. La guía va dentro del contenido: no tapa el FAB, las pestañas ni la barra del sistema; con el teclado abierto en Nuevo movimiento no empuja el campo de Monto fuera de la vista. [Entendido] y «Cerrar ayuda» miden 48 dp | J-21, J-22, J-12; J-10 (48 dp) | Capturas antes y después del reinicio; captura con teclado y guía | M si reaparece una guía descartada; A si tapa un control | [ ] | [ ] |
| V27 | Fuente 130 % | Ajustes > Pantalla > Tamaño de fuente al 130 % (o el valor más cercano; anotar la escala). Recorrer Login, Mis cuentas, Crear cuenta, Detalle, Nuevo movimiento, Calendario, Reportes, Categorías y las guías | Textos legibles sin cortes; las pestañas conservan sus etiquetas («Movimientos» completa); los montos no se truncan; la barra de contexto y los botones siguen siendo de al menos 48 dp; nada se superpone. El Calendario sigue usable | R4-43; AND-10; R2-10 | Capturas por pantalla en `dispositivo/fuente-130/` | M si hay texto cortado; A si un botón de acción queda inalcanzable | [ ] | [ ] |
| V28 | Fuente 175 % y 200 % | Poner la fuente en su máximo (anotar la escala real, 175 % o 200 %) y repetir el recorrido de V27 con foco en: barra de contexto, Mis cuentas con nombre largo, Nuevo movimiento (nombres de categoría), selector de color, Reportes, Calendario, vacíos y guías | Barra de contexto en dos filas; en los vacíos y guías sin ilustración (texto y acción visibles); tabla de Reportes apilada; exportación en columna; nombres de categoría y de color sin salirse de su caja (un nombre de color largo no se parte letra por letra); [Guardar] sigue siendo alcanzable. Los montos completos | R2-11; R4-43; J-18, J-24; AND-10 | Capturas en `dispositivo/fuente-200/` (y fuente-175 si aplica) | M si hay truncado; A si se pierde una acción o un monto | [ ] | [ ] |
| V29 | TalkBack | Activar TalkBack. Recorrer Mis cuentas (tarjeta), la barra de contexto, las pestañas, Nuevo movimiento (campos y errores: guardar vacío), Editar un movimiento (valores de solo lectura), el calendario (celdas y resumen) y las filas del Historial. En una pantalla con guía, activar [Entendido] y observar dónde queda el foco | Cada elemento tiene rol y etiqueta comprensibles: tarjeta «{nombre}, saldo actual {saldo}. Abrir cuenta»; pestañas con rol de pestaña y estado; la barra de contexto es texto (no encabezado) con nombre, saldo y «archivada» si aplica; «Tipo: Gasto» y «Categoría: {nombre}» en Editar; los errores se anuncian una vez por intento y el foco va al campo con error; celdas del calendario y resumen con su etiqueta; las ilustraciones y emojis decorativos no se leen. **Al descartar una guía, el foco debe quedar en el encabezado de la pantalla** (UXQA-R5-01); si TalkBack salta al inicio o a un elemento arbitrario, el defecto sube de baja a media | R2-22; J-23; R4-42; R2-10; UXQA-R5-01; R3 (etiquetas) | Vídeo con audio o captura con la transcripción de lo leído; nota del foco tras descartar la guía | M (UXQA-R5-01 confirmado) o A si no se puede completar un formulario con TalkBack | [ ] | [ ] |

#### P2 (complementarios)

| ID | Paso | Qué hacer exactamente | Resultado esperado | Criterio que cierra | Evidencia a capturar | Sev. si falla | Resultado | Obs. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V06 | Nombre largo y 360 dp | Crear una cuenta con un nombre de 60 caracteres y saldo negativo grande. Verlo en Mis cuentas y en la barra de contexto a 360 dp (o el ancho real). Comprobar que dos tarjetas caben sin desplazar en 360 × 640 | Elipsis a una línea en la tarjeta y en la barra, con el nombre completo en la etiqueta accesible; el saldo negativo conserva signo y color y no se superpone al nombre. Con 2 cuentas, ambas visibles sin desplazar a 360 × 640 | R2-21; R2-27 (D); R2-26 (parcial: alcancía ausente); AND-08, AND-10 | `mis-cuentas-360.png` y `detalle-360.png` | M si hay solape; B si es solo estético | [ ] | [ ] |
| V10 | Validaciones | En Nuevo movimiento tocar [Guardar gasto] sin categoría; con categoría y monto vacío; con «0» | Sin categoría: «Elige una categoría.»; monto vacío o 0: «Ingresa un monto mayor a cero, por ejemplo 12.50.»; foco en el campo con error; el error desaparece al editar; ninguna llamada a la API. En Crear cuenta con nombre vacío: «Escribe un nombre.» | G5, G6, G7; R2-5 | Captura de cada error | M si el mensaje es incomprensible | [ ] | [ ] |
| V23 | «Ver ayudas otra vez» | Más > AYUDA > «Ver ayudas otra vez». Volver a Mis cuentas, a la pestaña Cuenta y a Categorías. Cerrar la app desde recientes y reabrir | Aviso «Listo. Verás las ayudas otra vez.»; las guías vuelven a aparecer según su condición sin recargar la app y sin confirmación previa; tras reiniciar siguen disponibles. La fila mide al menos 48 dp. Con el almacenamiento sin respuesta: «No pudimos restablecer las ayudas. Inténtalo de nuevo.» (solo si se logra provocar) | J-13, J-14 (D complementario), J-21 | Capturas del aviso y de una guía reaparecida | B (texto) o M (no restablece) | [ ] | [ ] |

### 16.3 Plantilla para registrar un defecto Android

Un defecto por bloque. Se guarda en la conversación del encargo o en este documento si el usuario lo pide; las capturas y los logs quedan fuera del repositorio.

```
UXQA-AND-<nn> · <pantalla> · caso <V.. / AND-nn> · severidad <crítica | alta | media | baja>
Dispositivo: <marca y modelo> · Android <versión y parche> · ancho real <dp> × alto <dp>
Pantalla: tamaño de fuente <%> · navegación <gestos | tres botones> · TalkBack <sí | no> · escala de grises <sí | no>
Build: development build 375e4dc0 · commit del código servido por Metro <hash> · fecha y hora <AAAA-MM-DD HH:MM>
Pasos para reproducir:
  1.
  2.
Esperado (texto exacto y referencia a docs/007, docs/008 o este §16):
Obtenido:
Frecuencia: <siempre | a veces | una vez>
Evidencia: <ruta de la captura o vídeo> · <logcat ReactNativeJS/AndroidRuntime sin datos personales, o «no aplica»>
Criterio de docs/010 afectado: <R2-n | G21 | R4-n | J-n | AND-nn>
Regresión de un criterio ya aprobado en nivel A: <sí, cuál | no>
```

Reglas: la numeración `UXQA-AND-nn` es independiente de `UXQA-R2/R3/R4/R5-nn`; un defecto crítico o alto bloquea el cierre y la publicación (§7) hasta su corrección y nueva validación; un defecto que contradiga el diseño aprobado se devuelve a `mobile-ux-designer` o `mobile-visual-designer` a través de quien coordina, no al implementador.

### 16.4 Criterios de nivel D que cierra cada caso y cuáles seguirán abiertos

Los criterios solo se cierran si el caso correspondiente pasa **con su evidencia**; un caso a medias deja el criterio abierto.

| Criterio de nivel D | Casos que lo cierran (todos deben pasar) |
| --- | --- |
| R2-1 Safe areas (gestos y tres botones) | V24, V25 (AND-01, AND-02, AND-06, AND-07) |
| R2-4 / AND-05 Atrás en dispositivo | V07, V12, V26 |
| R2-10 48 dp, roles, no solo color (parte D) | V18, V27, V29 (las medidas de 48 dp, por inspección visual o la herramienta de accesibilidad del sistema) |
| R2-11 Fuente 200 % en Detalle | V28 |
| R2-22 TalkBack de la barra | V29 |
| R2-23 / G21 Teclado abierto con Guardar visible | V11 (gestos y tres botones), V25 |
| R2-27 Todo visible en 360 × 640 y AND-08 | V06 (solo si el ancho real o el ajustado es 360 dp) |
| R4-41 Celdas medidas a 360 y 412 dp | V14 |
| R4-42 TalkBack en calendario, resumen y filas | V29 |
| R4-43 Fuente 130 y 200 % sin truncar | V27, V28 |
| R4-44 `DatePickerSheet` con gestos y tres botones | V13, V24, V25 |
| R4-45 Hoja «⋮» y formulario con teclado | V21, V11 |
| R4-46 Exportar CSV y PDF reales | V19, V20 |
| R4-47 Scroll largo sin quedar bajo el FAB ni la barra | V14, V16, V24, V25 (AND-09) |
| R4-48 Chips `sm` y barras en escala de grises | V16, V18, V21 |
| J-21 Persistencia tras cerrar desde recientes | V22 (y V23) |
| J-22 Guía sin tapar controles ni empujar el monto | V22, V11, V24 |
| J-23 TalkBack en las guías (orden, foco, ilustraciones) | V29 (UXQA-R5-01) |
| J-24 Fuente 130, 175 y 200 % en vacíos y guías | V27, V28 |
| J-25 Anchos 360 y 412 dp | V14, V06, V02 (solo si se miden ambos anchos) |
| J-26 Dos cuentas de Google | V30 |
| AND-12 Sesión cerrada (D) y aislamiento | V30 |

**Seguirán abiertos aunque todo el procedimiento pase:**

1. **Nivel R (comparación con `docs/design/capturas/` y el prototipo)**: criterios 14, 25, 26, 29, 30 y 31 de R2, la fidelidad visual de las pantallas (DIS) y las columnas «R» de la matriz §3. Las capturas del teléfono se pueden contrastar a ojo con las aprobadas, pero eso no es un render ni lo sustituye; la comparación la registra `mobile-ux-qa` aparte. Las ilustraciones y los emojis ya se miran en V02, pero el empaquetado y la fuente no son «fidelidad».
2. **R2-25 y R2-26 (alcancía de Mis cuentas, UXQA-R2-01)**: la alcancía no está implementada (R6). Ningún caso lo puede cerrar; queda abierto hasta R6.
3. **R2-27 y AND-08 a 360 × 640** y **J-25** si el teléfono no admite 360 dp ni se logró ajustar; **R4-41 a 412 dp** si el teléfono no mide 412 dp. Se cierran solo en los anchos medidos.
4. **Diversidad de dispositivos**: un solo teléfono y una sola versión de Android no demuestran el comportamiento en otras marcas, fabricantes de teclado, versiones de Android, gestos predictivos distintos ni fuentes del sistema alternativas. El cierre se declara «validado en {modelo, Android {versión}}».
5. **No cubiertos por este recorrido** (huecos declarados, sin caso): archivar y desarchivar una cuenta y el modo de solo consulta con el aviso de cuenta archivada (R2-8, R2-19, R2-20, solo A hoy); renombrar cuenta desde Más (R2-18); red caída o lenta con «Reintentar» y el texto «No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.» (AND-13 en D; ver §16.5); selector de cuenta con cuentas archivadas; editar y anular un movimiento; «Cargar más» del Historial (requiere más movimientos que el tamaño de página); año/rango de Reportes con muchos datos; sesión expirada.
6. **Aspectos de UXQA abiertos fuera de D**: UXQA-R2-02 a R2-05, observaciones documentales de §12.6, §13.4 y §14.7 y la fidelidad del arranque de Bienvenida (no rediseñada), que no cierran con pruebas de dispositivo.
7. **R6** (ícono, splash, nombre de la app, alcancía) y modo oscuro (no aplica con `userInterfaceStyle: light`).

Cierre de fase: aunque V01 a V30 pasen, R2 a R5 solo pueden declararse «cerradas en dispositivo» con la salvedad de los puntos 1 a 5 y con `qa-engineer` repitiendo la validación técnica; la decisión de cierre la toma quien coordina junto con el usuario.

### 16.5 Extensiones opcionales (si hay tiempo, sin contar entre los 30 pasos)

- **AND-13 (red)**: con modo avión, abrir Mis cuentas (debe verse el error con «Reintentar» y nunca «$0.00»); con modo avión justo antes de pulsar [Guardar gasto] debe verse «No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.», sin cerrar el formulario ni perder lo escrito. Antes de reintentar, revisar el Historial para no duplicar.
- **Archivar cuenta**: Más > «Archivar esta cuenta» debe pedir «Archivar cuenta» / «¿Archivar «{nombre}»? Dejará de aparecer en tu lista y no podrás anotarle movimientos. Podrás desarchivarla cuando quieras.» con [Cancelar] y [Archivar]; luego vuelve a Mis cuentas con Archivadas desplegada.

## 17. Verificación funcional previa a Android

Fecha: 2026-10-16. Rama `feat/rediseno-ux-ui`, HEAD `a64e746` (R5). Verificación hecha por `qa-engineer` solo con Jest, TypeScript, ESLint y lectura de código. **No se ejecutó nada en Android, ni en emulador, ni con Metro, ni contra la API real.** Ningún caso de §16 pasa a «OK» por este apartado: sigue exigiendo su evidencia de nivel D. Aquí solo se dice qué comportamiento ya está respaldado por pruebas automáticas (nivel A) y qué queda por comprobar en el teléfono. No se modificó `app/` ni `api/` y no se abrió ningún `.env`.

### 17.1 Verificación base

| Comando | Resultado |
| --- | --- |
| `cd app && npx tsc --noEmit` | Sin errores (código de salida 0) |
| `npx eslint app/src` (raíz) | Sin errores ni avisos (código de salida 0) |
| `npx prettier --check app/src docs` | Todos los archivos con el estilo correcto |
| `cd app && npx jest --ci --maxWorkers=2` | 42 suites, 1550 pruebas, todas pasan |

Nota de ejecución: Jest se debe lanzar desde `app/` (su configuración vive en `app/package.json`). Lanzado desde la raíz falla las 67 suites con «Cannot use import statement outside a module», al no aplicar la configuración de Jest de `app/`. No es un defecto del código.

### 17.2 Casos P0 y su respaldo automatizado

Todas las pruebas de la columna 2 se ejecutaron por archivo y filtro de nombre (`-t`) y pasaron. ✔ significa que la prueba pasa y cubre la lógica descrita; **no** significa que el caso esté validado en dispositivo.

| Caso | Pruebas Jest que cubren el comportamiento | Resultado | Lo que NO cubren (sigue en D) |
| --- | --- | --- | --- |
| V01 | `App.test.tsx`: sin configuración, sin sesión guardada muestra el login, login exitoso lleva a la pantalla principal, cancelar no muestra error, mensaje comprensible si Google falla, carga sin doble pulsación | ✔ | Google Sign-In real, SHA-1 (`DEVELOPER_ERROR`), barra de estado del dispositivo |
| V02 | `screens/guides.test.tsx` «Mis cuentas» (guía + vacío, Entendido la descarta y no vuelve, círculo con emoji, botón de 52 dp); `AccountsScreen.test.tsx` vacío sin archivadas y avatar que abre la hoja | ✔ | Que el emoji 🐷 y los PNG se vean y empaqueten en Android (Metro) |
| V03 | `NewAccountScreen.test.tsx` (estructura y ayuda, saldo vacío equivale a 0, «Creando…» y una sola llamada, éxito sin diálogo); `MainNavigator.test.tsx` «Crear cuenta: entra al Detalle…»; `guides.test.tsx` (`cuenta-crear` siempre visible y guardar marca `cuentas-vacio`) | ✔ | Doble toque con el dedo real |
| V04 | `NewAccountScreen.test.tsx` bloque G16 (casilla de 48 dp, prefijo «-$», saldo en contra sin importe o con 0 no envía negativo); `AccountsScreen.test.tsx` tarjetas con signo; `account-ui.test.tsx` (color `expenseText`) | ✔ | Aspecto real y contraste. Ver discrepancia D-1 |
| V05 | `money.test.ts` (117 pruebas); `NewAccountScreen.test.tsx` bloque R3 D8; `TransactionFormScreen.test.tsx` bloque R3 D8 y montos (`1.000`, `1,234`, `1,234.56`, `12.345` → miles; `1e5` → solo números; `0.123` → decimales; `12,50` y `1000` aceptados) | ✔ | Pegado con `maxLength` 24 en el teclado Android (residual §12.9) |
| V07 | `AccountsScreen.test.tsx` (Total de 2 o más activas con negativos, etiqueta accesible, tocar tarjeta abre la cuenta); `MainNavigator.test.tsx` (cinco pestañas, Atrás pestaña → Cuenta → Mis cuentas, selector rápido conserva pestaña y no mezcla datos) | ✔ | Toque real del selector y de la barra |
| V08 | `TransactionFormScreen.test.tsx` G1 (orden), G2 (sin foco), G9 (doble toque = una llamada), G18 (sin categorías, [Ir a Categorías]), UXQA-R3-02 (aviso), «crea un gasto»; `MainNavigator.test.tsx` (aviso en el Snackbar, relectura única del saldo, [Ir a Categorías] y Atrás) | ✔ | Teclado que no se abre solo en el dispositivo; saldo contra la API real |
| V09 | `TransactionFormScreen.test.tsx` «crea un ingreso», UXQA-R3-02 ingreso («Ingreso de $100.00 guardado en Sueldo»), G8 (Hoy/Ayer); `HistoryScreen.test.tsx` agrupa por Hoy y Ayer | ✔ | Recorrido completo hasta el Historial con datos reales |
| V11 | `TransactionFormScreen.test.tsx` G2 y G17 (pie fuera del `ScrollView`, objetivos de 48 dp); `MainNavigator.test.tsx` UXQA-R3-04 (un solo margen inferior); `ui.test.tsx` (51 pruebas, incluye el margen inferior de `Screen`) | ✔ parcial | **Hueco**: el teclado real y su altura no se pueden simular; solo se prueba la estructura (pie fijo, un solo margen) |
| V12 | `TransactionFormScreen.test.tsx` G10 a G14 y «Seguir editando»; `MainNavigator.test.tsx` «R3 confirmación de descarte con Atrás» (15 pruebas); `NewAccountScreen.test.tsx` G11, G12, G14 | ✔ | Botón Atrás físico y gesto reales, toque fuera del diálogo |
| V14 | `CalendarScreen.test.tsx` bloques R4 (celda de 52 dp; ≥ 44 dp a 360 y ≥ 48 dp a 412; siete columnas y 3 dp de separación; margen responsive) | ✔ | Medida real en dp, recortes, desplazamiento y FAB sobre el contenido |
| V24 | `theme/useSystemInsets.test.ts` (6 pruebas de `computeInsets`); `ui.test.tsx` «reserva el margen inferior del sistema» | ✔ parcial | **Hueco principal**: no hay prueba de `Modal`/hojas con edge-to-edge ni de la barra de gestos real |
| V25 | Las mismas que V24 | ✔ parcial | **Hueco**: tres botones solo se comprueba en dispositivo |
| V26 | `MainNavigator.test.tsx` (29 pruebas con «Atrás»: raíz sin interceptar, pestañas, Categorías, formulario, Reportes → Historial filtrado conserva modo y período, ignorado mientras guarda) | ✔ | Botón y gesto de Atrás de Android real; cierre efectivo de la app en la raíz |
| V30 | `App.guides.test.tsx` (cerrar sesión conserva la preferencia); `guides.test.tsx` «cambio de usuario» y «Navegador»; `hooks/use-guides.test.tsx` «cambio de usuario»; `MainNavigator.test.tsx` (sin rastro de la sesión anterior; limpia los archivos exportados); `App.test.tsx` cerrar sesión regresa al login; `AccountsScreen.test.tsx` cerrar sesión sin confirmación | ✔ | Aislamiento de datos entre usuarios en la API real (lo garantiza `api/`, no se ejecutó aquí); dos cuentas de Google |

Resumen: 15 de 15 casos P0 tienen respaldo automatizado de la lógica; ninguno sustituye al nivel D. Los casos con respaldo solo parcial son V11, V24 y V25.

### 17.3 Textos exactos: §16 contra el código

Se buscaron en `app/src` (código de producción) los textos que §16 espera. Coinciden literalmente:

- V01: «Ingresar con Google», «Inicia sesión para continuar.», «Configuración incompleta». No existe ningún «Sesión iniciada».
- V02: «Bienvenido. Empieza creando una cuenta: puede ser tu efectivo, tu banco o tu tarjeta.», «Todavía no tienes cuentas», «Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.», «Crear mi primera cuenta», «Cerrar ayuda», «Entendido».
- V03: «Saldo inicial (opcional)», «El saldo inicial es lo que ya tienes hoy. Si no estás seguro, déjalo vacío.», «Creando…».
- V04: «Es un saldo en contra (debo dinero)».
- V05: «Escribe el monto sin separador de miles, por ejemplo 1000 o 12.50.», «Escribe solo números, por ejemplo 12.50.», «Usa como máximo 2 decimales, por ejemplo 12.50.».
- V07: etiqueta «{nombre}, saldo actual {saldo}. Abrir cuenta» y «Total en tus cuentas, {total}, suma de {n} cuentas activas».
- V08: «Gasto de $12.50 guardado en Alimentación» (plantilla `{Gasto|Ingreso} de {importe} guardado en {categoría}`), «No tienes categorías de gasto activas. Crea una en Más > Categorías.» (plantilla con gasto/ingreso), [Ir a Categorías]. V09: «Ingreso de $50.00 guardado en Sueldo» sale de la misma plantilla.
- V12: «¿Descartar este movimiento?», «¿Descartar esta cuenta?», «Lo que escribiste se perderá.», «¿Descartar los cambios?», «Los cambios que hiciste no se guardarán.», [Seguir editando], [Descartar].
- V23 (fuera de P0): «Listo. Verás las ayudas otra vez.» coincide (`HELP_RESET_DONE`, comprobada por `guides.test.tsx`).

Discrepancias texto o formato esperado contra real (a corregir en §16 o a tener en cuenta al comparar, no son defectos de la app):

| Id | §16 dice | El código hace | Efecto |
| --- | --- | --- | --- |
| D-1 | V04: la tarjeta de Deuda muestra «−$25.00» (signo menos tipográfico U+2212) | `formatCents` antepone el guion ASCII: «-$25.00» (lo comprueban `money.test.ts` y `AccountsScreen.test.tsx` con «-$25.50») | Si se busca el carácter «−» en una captura parecerá un fallo. El signo existe y el rojo `expenseText` también |
| D-2 | V04: la tarjeta de Banco muestra «$100.50» | Correcto. Pero los importes no llevan separador de miles («$1234.56», no «$1,234.56»), decisión de `formatCents` | Sin efecto en los datos de prueba (todos menores de 1000); a tenerlo presente si se prueba un importe mayor |
| D-3 | V03: la ayuda es «Es el dinero que ya tienes hoy en esta cuenta. Déjalo vacío si empiezas en 0.» | El texto real continúa: «… Después no se puede cambiar; lo demás lo registras con movimientos.» | §16 cita el principio; no es un fallo, solo no se debe exigir coincidencia de la frase completa |
| D-4 | V07: «suma de 3 cuentas activas» en la etiqueta | Correcto en la etiqueta accesible. El texto visible es «Suma de los saldos de N cuentas» | Verificar el texto visible con la cadena distinta; no hay Total con menos de 2 cuentas activas |

### 17.4 V03: qué hace la app al crear una cuenta (hecho verificado en el código)

Tras pulsar [Crear cuenta] con éxito, la app **no vuelve a Mis cuentas**. `MainNavigator` (`onCreated`) reemplaza «Nueva cuenta» por el **Detalle de la cuenta recién creada, en la pestaña «Cuenta»**, y muestra el aviso «Cuenta creada. Ya puedes anotar movimientos.». Con una cuenta sin movimientos, la pestaña Cuenta muestra el estado vacío «Tu cuenta está lista.» (con la ilustración). La prueba `MainNavigator.test.tsx` «Crear cuenta: entra al Detalle con el aviso y “Tu cuenta está lista”; Atrás vuelve a Mis cuentas» lo respalda: desde ahí Atrás lleva directamente a Mis cuentas (no pasa por «Nueva cuenta»).

Consecuencias para ejecutar §16:

- La anotación pendiente de V03 («anotar a qué pantalla navega») queda así: **navega al Detalle de la cuenta nueva (pestaña Cuenta), con aviso**; el criterio «contar las tarjetas en Mis cuentas» exige pulsar Atrás primero.
- Para V04 (crear «Prueba Banco» y «Prueba Deuda») hay que volver con Atrás a Mis cuentas y pulsar «+ Nueva cuenta» (en la lista con cuentas ya no existe [Crear mi primera cuenta]). El orden con la primera cuenta no exige ningún paso extra.
- La guía `cuentas-vacio` queda descartada al guardar la primera cuenta (por eso «no vuelve»). La guía `cuentas-lista` solo aparece con 2 o más cuentas activas.

### 17.5 Configuración de runtime

Leído `app/src/lib/config.ts`, `config.test.ts`, `App.tsx` y `ConfigMissingScreen.tsx` (sin abrir `.env`):

- `readConfig()` lee `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` con la forma literal de Expo. Recorta espacios y quita barras finales de la URL.
- Variable **ausente, vacía o solo espacios** → devuelve `null` → `App.tsx` muestra `ConfigMissingScreen`: «Configuración incompleta. Faltan EXPO_PUBLIC_API_URL o EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Revisa app/.env.example.». Respaldado por `config.test.ts` (4 casos de ausencia) y por `App.test.tsx` «sin configuración pública…».
- **No hay ninguna validación de formato.** Una URL mal formada (sin esquema, con un error tipográfico) o con `http://` se acepta tal cual; el error aparecería después, al primer `fetch`, como fallo de red en español. No existe en la app una comprobación de HTTPS, ni de que la URL sea la de DEV (la app no distingue DEV de PRODUCCIÓN). El ID de cliente tampoco se valida. Un Android de release bloquea el tráfico `http` por defecto; el dev client suele permitirlo, así que **una URL `http://` o la de producción no será rechazada por la app**.
- Las variables `EXPO_PUBLIC_*` se incrustan al empaquetar el JS: tras cambiar `app/.env` hay que reiniciar Metro (conviene `--clear`). No hace falta nueva build.
- Hueco: ninguna prueba cubre una URL no HTTPS o mal formada (comportamiento actual, no un defecto de R1 a R5). Si se quiere endurecer, es un cambio funcional fuera de este alcance: consultar a `architect`.

### 17.6 Estado del árbol de trabajo

`git status --short`: solo `M docs/010-MATRIZ-PRUEBAS-UX.md` y `?? tsconfig.json` (archivo de la raíz sin seguimiento: `{"extends": "expo/tsconfig.base"}`, no pertenece a ninguna tarea del rediseño; decidir si se ignora o se elimina antes del PR). `api/`, `package.json`, `package-lock.json` y `app/app.json` sin cambios.

### 17.7 Lista de verificaciones del usuario antes de salir al teléfono

1. `app/.env` apunta a la API de **DEV** (no a PRODUCCIÓN) y es `https://`; la app no lo comprueba. Si se cambió, reiniciar Metro con `--clear`.
2. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` es el cliente OAuth tipo Web, el mismo que `GOOGLE_WEB_CLIENT_ID` de la API DEV.
3. SHA-1 del keystore de EAS (build `375e4dc0`) registrada en el cliente OAuth Android de Google Cloud con el paquete `com.cuidatubilletera.app`. Si falta: `DEVELOPER_ERROR` en logcat.
4. Dos cuentas de Google de prueba (A y B) añadidas como usuarios de prueba en la pantalla de consentimiento (necesarias para V30).
5. APK de la development build `375e4dc0` instalado en el teléfono (no una anterior sin `expo-sharing`) y compatible: R1 a R5 no cambian dependencias nativas.
6. Metro iniciado en el contenedor con `npx expo start --dev-client --tunnel` (sin `adb` ni cable USB; el túnel ya está soportado) y la app abierta desde el teléfono con el código QR o la URL del túnel.
7. La API DEV responde y D1 DEV tiene 1 usuario, 0 cuentas, 0 categorías y 0 movimientos, como supone §16.0.
8. Sesión antigua cerrada en el teléfono (SecureStore conserva la anterior) y fecha, hora y zona horaria automáticas.
9. Medir el ancho real en dp (Opciones de desarrollador > «Ancho mínimo») y anotar navegación por gestos o tres botones; carpeta de evidencias del §15.D creada.
10. Datos ficticios solamente (nombres «Prueba …») y recordar que D-1 a D-4 de §17.3 no son defectos al comparar textos.


## 18. Informe de ejecución R5.1 (Login, «Cerrar sesión», ícono de categoría, «+ Crear categoría» y barra de estado)

```
Informe de ejecución UX-QA - R5.1
Fecha: 2026-10-16
Rama y commit evaluados: feat/rediseno-ux-ui sobre dbe5201, con los cambios de R5.1 SIN commit
Ejecutor: mobile-ux-qa (agentId: lo registra quien coordina; no se dispone aquí)
Alcance: docs/003 «Decisión R5.1» D1 a D12, docs/007 §5.13 (A a J; R51-01 a R51-28 y D1 a D12), docs/008 §6.15.
         LoginScreen, session-ui, AccountsScreen, SessionBanner, MoreScreen, sheets (Sheet tall/compact), category-form,
         category-create-sheet, CategoriesScreen, TransactionFormScreen, form-ui, MainNavigator, navigation, App,
         lib/category-appearance, theme/tokens, theme/useSystemInsets y los assets de brand/ e illustrations/.
Entorno: niveles A (Jest y revisión de código) y T (contrast.js y cálculo WCAG propio). Sin R ni D: no hay emulador,
         dispositivo ni TalkBack. NADA de este informe se ejecutó en Android. Los criterios D1 a D12 quedan PENDIENTES.
Resumen: R51-01 a R51-28 con nivel A/T: OK (R51-05 con matiz); D1 a D12 (nivel D): PENDIENTE.
         Defectos: 0 críticos, 0 altos, 0 medios, 2 bajos (UXQA-R51-01 y 02). Observaciones: 18.6.
Decisión: APROBADO CON OBSERVACIONES. Ningún defecto alto ni crítico abierto. El cierre de R5.1 sigue condicionado al
          nivel D (D1 a D12) y a `qa-engineer`; R5.1 no puede marcarse completada antes.
```

### 18.1 Comandos y resultados (nivel A/T)

| Comando | Resultado |
| --- | --- |
| `cd app && npx jest --ci --maxWorkers=2` | 49 suites, 1643 pruebas, todas en verde (coincide con lo esperado) |
| `npx jest --ci --no-cache --maxWorkers=2` sobre `LoginScreen`, `session-ui`, `TransactionFormScreen.createCategory`, `CategoriesScreen.icons`, `sheets.tall`, `App.r51`, `MainNavigator.r51` | 7 suites, 90 pruebas en verde con la caché fría (la de `createCategory` tarda ≈ 60 s en frío y la de `icons` ≈ 46 s, sin agotar tiempos) |
| `npx tsc --noEmit`, `npx eslint --max-warnings=0 src`, `npx prettier --check src` | sin errores ni avisos |
| `node docs/design/contrast.js --check` | salida 0; 130 pares, mínimo texto 4,60:1, mínimo componente 3,10:1; los 15 pares «R5.1» cumplen |
| Cálculo WCAG propio (fórmula de luminancia relativa, scratchpad) | pares no incluidos en el script: `incomeText` sobre `bg` (aviso de éxito) 6,47:1; `yellowText` sobre `surface` (aviso del pie) 7,74:1; `text` sobre `brand100` 13,28:1; `brand700` sobre `brand100` 6,03:1; `brandInk` sobre `yellowSoft` 8,94:1. Los pares del script coinciden con docs/008 §6.15.2 (Google 16,48:1 / 13,21:1 / borde 4,53:1 y 3,29:1 sobre las manchas). Texto de Google con opacidad 0,6 (cargando): ≈ 4,35:1, estado deshabilitado exento de WCAG 1.4.3 |
| `git diff --stat -- api app/package.json app/app.json app/src/lib/auth-service.ts app/src/lib/session-storage.ts app/src/hooks/use-auth.tsx` | sin cambios. `package.json` no contiene `react-native-safe-area-context` ni `expo-navigation-bar`; ninguno se importa en `app/src` (solo aparece el nombre en un comentario de `useSystemInsets.ts`) |
| `cmp` de assets | `app/assets/brand/google-g.png`, `@2x`, `@3x`, `@4x` idénticos byte a byte a `docs/design/assets/brand/rn/*` (20, 40, 60 y 80 px, RGBA); `app/assets/illustrations/vacio-alcancia.png` idéntico a `docs/design/assets/illustrations/vacio-alcancia.png` (360 × 360, RGBA) |

### 18.2 Resultados por criterio de docs/007 §5.13.H (nivel A salvo indicación)

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| R51-01 Nombre `header`, mensaje variante A, nota de privacidad | OK | `LOGIN_MESSAGE` y `LOGIN_PRIVACY` coinciden letra por letra con docs/007 §5.13.A/B y docs/003 D11.1; `LoginScreen.test` «muestra el nombre como encabezado…». La marca (círculo `yellowSoft`, alcancía) y el subrayado están ocultos a TalkBack (`importantForAccessibility="no"`, `accessibilityElementsHidden`, `accessible={false}`) |
| R51-02 «Continuar con Google»; ya no existe «Ingresar con Google» | OK | `LoginScreen.test` R51-02; `grep` sin restos en `app/src` (solo el prototipo HTML, que es referencia histórica) |
| R51-03 Logotipo oculto a lectores | OK | `Image` con `importantForAccessibility="no"` y `accessibilityElementsHidden`; la etiqueta del botón no lo menciona; prueba R51-03 |
| R51-04 `busy`: `login-loading`, «Ingresando…», `{disabled, busy}`, sin segundo `signIn` | OK | pruebas R51-04 (reposo: una llamada; ocupado: sin llamada). Se verificó en código que el logo se sustituye por el indicador en el mismo hueco de 20 dp |
| R51-05 Error `alert` sobre el botón; aviso y motivo con los textos existentes | OK con matiz | pruebas R51-05. Matiz en 18.6-1: error y aviso pueden pintarse a la vez (comportamiento existente) pero `signIn` limpia `notice`, por lo que no coexisten en la práctica |
| R51-06 Botón ≥ 48 dp y contenido en `ScrollView` | OK | `minHeight: sizes.primaryTall` (52), radio 12, borde 1,5; `ScrollView` con `keyboardShouldPersistTaps="handled"` y `flexGrow: 1`; pruebas R51-06 y «estilo de la guía de marca» |
| R51-07 Control «Cerrar sesión» junto al avatar, 48 × 48, separados | OK | `session-ui.test` R51-07 (48 dp, círculo de 40, glifo oculto) y «🚪 y avatar… 8 dp… 🚪 primero» |
| R51-08 Un toque = un `signOut`; sin `Alert`; segundo toque ignorado | OK | `useRef` `running` + `pending`; pruebas R51-08, incluida la que libera el control si `signOut` lanza |
| R51-09 Mismo componente y mismo `signOut` en los cuatro accesos | OK | `SignOutControl` es la única implementación: encabezado (`icon`), `ProfileSheet`, `MoreScreen` y `SessionBanner` (`button`); `grep` confirma que ya nadie llama a `signOut` directamente salvo `session-ui.tsx`; prueba R51-09 |
| R51-10 Visible y activo con `unavailable` y degradada; avatar abre el perfil | OK | pruebas R51-10. Con sesión degradada la franja solo ofrece «Reintentar» (sin cierre propio); el control del encabezado cubre la salida |
| R51-11 No borra guías ni preferencias | OK | `SignOutControl` solo llama a `signOut`; prueba R51-11 («no escribe ni borra nada del almacén de guías») y `App.r51` «conserva las guías» |
| R51-12 30 íconos, slugs válidos, nombres únicos; 11 existentes + `tag`; desconocido da 🏷️ | OK | `category-appearance.test` R51-12 (dos pruebas). Revisión propia: los 30 slugs, glifos y nombres de `CATEGORY_ICON_OPTIONS` coinciden con la tabla de docs/007 §5.13.D |
| R51-13 `radiogroup` «Ícono», 30 `radio` «Ícono {nombre}», ≥ 48 dp, `selected` solo en el elegido, 4 a 6 columnas | OK | `CategoriesScreen.icons.test` R51-13 e `iconColumns`. Cálculo propio de celdas: formulario a 360 dp = 5 columnas de 56 dp; a 320 dp = 4 de 58; hoja a 320 dp = 5 de 48 dp exactos; a 412 dp = 6 de 54; con fuente ≥ 1,5 = 4 columnas. Ninguna baja de 48 |
| R51-14 Crear sin elegir no envía `icono`; elegir envía el slug; vista previa | OK | pruebas R51-14 |
| R51-15 Editar: ícono del catálogo preseleccionado; fuera del catálogo sin selección y 🏷️ | OK | pruebas R51-15 |
| R51-16 Editar: `icono` solo si cambió | OK | pruebas R51-16 (incluye elegir el mismo: PATCH vacío) |
| R51-17 Solo el ícono ensucia el formulario; volver al inicial lo limpia | OK | pruebas R51-17 y «al crear, elegir un ícono cuenta para el descarte» |
| R51-18 Última celda «+ Crear categoría», no es `radio`; ausente en Editar; sin «Ir a Categorías», `onOpenCategories`, `FROM_FORM_HELP` ni `fromForm` | OK | `createCategory.test` R51-18 (cinco pruebas: carga, error, editar, archivada, `busy`). Retiro verificado con `grep` en `app/src`: no quedan `replaceTopWithCategories`, `FROM_FORM_HELP`, `fromForm` ni «Ir a Categorías» fuera de las pruebas negativas. La prop `onOpenCategories` que sigue existiendo es la de `MoreScreen` (fila «Categorías»), no la retirada |
| R51-19 Vacío por tipo con texto nuevo y botón; sin «Más > Categorías» | OK | prueba R51-19 (gasto e ingreso). Con la cuenta archivada el texto no invita a crear y no hay botón |
| R51-20 Hoja con «Tipo: …» fijo, nombre, color, ícono y vista previa; sin descripción | OK con observación | prueba R51-20. Ver UXQA-R51-01 («Tipo: Gasto» aparece dos veces) |
| R51-21 Abrir, cancelar y descartar no alteran el movimiento ni llaman a `onDone` | OK | pruebas R51-21 (cuatro) |
| R51-22 «Escribe un nombre.»; una sola llamada con el tipo del movimiento aunque se toque dos veces | OK | pruebas R51-22. `tipo` sale del movimiento (`toCategoryType(tipo)`) y la hoja no tiene control de tipo: no puede crearse una categoría del otro tipo |
| R51-23 Éxito: cierra, selecciona, aviso `status`, borra «Elige una categoría.», no envía el movimiento | OK | pruebas R51-23 (tres). El aviso se retira al elegir otra categoría o cambiar de tipo; `dismiss('categorias')` se llama en `finish` |
| R51-24 Descarte con y sin cambios por Cancelar, velo y Atrás; ignorado con `busy`; Atrás no llega al guard del movimiento | OK | pruebas R51-24 (cuatro) y `MainNavigator.r51` «Atrás con la hoja abierta la cierra…». Orden de los listeners revisado en código: guard de la hoja, luego cierre de la hoja (siempre `true`), por lo que el guard del formulario nunca se consulta |
| R51-25 `NAME_TAKEN`, `LIMIT_REACHED`, `ACCOUNT_ARCHIVED`, otro 4xx | OK | pruebas R51-25 (cuatro). Textos de `LIMIT_REACHED` y del fallo incierto idénticos a docs/007 §5.13.E. El código `LIMIT_REACHED` (409) existe en `category-service.ts` de la API |
| R51-26 Fallo incierto: sin reintento a ciegas, «Revisar la lista», relectura | OK | pruebas R51-26 (cinco). Guardar queda deshabilitado; la relectura usa `listCategories` sin archivadas, `pageSize: 100` (el máximo de la API) y compara nombre y tipo sin distinguir mayúsculas |
| R51-27 Con `fontScale` 2: cuerpo desplazable, pie alcanzable, 48 dp | OK (A) | prueba R51-27 y `sheets.tall.test` (75 % de la ventana menos el margen superior; compacto: ventana menos margen y 8 dp). El comportamiento real con la fuente de Android y el teclado es nivel D |
| R51-28 Alcance: sin cambios en `api/`, auth, `session-storage`, `app.json`, `package.json`; suites previas pasan; test/typecheck/lint | OK | 18.1. Las pruebas previas modificadas solo cambian lo que el propio criterio permite (textos de «Ir a Categorías», `fromForm`, «Ingresar con Google», respaldo de 32 dp) |

### 18.3 Verificaciones solicitadas con atención

| Punto | Resultado | Razonamiento |
| --- | --- | --- |
| Login fuera de `Screen`: relleno superior ni duplicado ni ausente | OK (A, código) | `Root` monta `LoginScreen` sin `Screen`, de modo que no existe `screen-top-inset`; el Login suma una sola vez `useSystemInsets().top + 16` en el `ScrollView` y el fondo `bg` más las manchas ocupan toda la ventana (`container` `flex: 1`, `overflow: 'hidden'`). `StatusBar style="dark"` sigue en `App`. El resto de pantallas con `Screen` ponen su único `screen-top-inset`; las hojas no suman relleno superior (solo lo restan de su altura máxima). Sin franja visible: PENDIENTE (D1 a D5) |
| Respaldo de 32 dp (`useSystemInsets`) | OK (A) con hipótesis | `top = max(altura informada, 32)`; el inferior conserva la fórmula anterior (la barra informada, o 24 si no hay) y su respaldo de 48, por lo que no cambia. `ui.test` y `useSystemInsets.test` actualizados con intención. Es una hipótesis marcada como provisional; solo se puede validar con el teléfono (D4: hueco de más de 8 dp en teléfonos sin recorte) |
| Cerrar sesión unificado, doble toque, sin borrar datos, otro usuario sin fuga | OK (A) | ver R51-07 a R51-11 y `App.r51` («cierra la sesión sin confirmar, conserva las guías y no filtra datos al siguiente usuario»); `MainNavigator` se remonta por `key` de usuario y `GuidesProvider` es por usuario (R5) |
| Selector de ícono: compatibilidad y envío | OK (A) | los 11 slugs de las categorías por defecto de la API y `tag` están en el catálogo; un slug desconocido no preselecciona ni se envía; descarte contado |
| «+ Crear categoría»: conserva el movimiento; errores; aislamiento por cuenta y usuario | OK (A) | el estado de la hoja vive solo mientras está abierta (`visible ? <Open/> : null`); `createCategory(token, account.id, …)` usa la cuenta del formulario, que no cambia mientras está abierto (sin selector de cuenta, prueba `MainNavigator.r51`); `createdCategories` es estado del formulario, filtrado por tipo y deduplicado contra la relectura |
| No aparece al editar ni con cuenta archivada; Sheet tall/compact no altera las otras hojas | OK (A) | `canCreateCategory = !editing && !account.archivada && !archivedBlocked`; `Sheet` solo añade `maxHeight` si `tall`; ninguna otra hoja lo pasa (`sheets.tall.test` «por defecto no limita la altura») |
| Tipo bloqueado al del movimiento | OK | no hay `TypeToggle` en la hoja; `draft.tipo` y la petición usan el `tipo` recibido |
| Retirada de «Ir a Categorías»/`fromForm` sin código muerto ni romper Atrás | OK con observación | `navigation.ts`, `MainNavigator` y `CategoriesScreen` sin restos; Atrás desde Categorías cubierto en `MainNavigator.r51`. Código muerto distinto: ver UXQA-R51-02 |
| Nada bloqueado implementado | OK | sin color ni ícono de cuenta (`NewAccountScreen`, `accounts`, API sin cambios), sin barra inferior oculta, sin `safe-area-context`, sin dependencias ni `app.json` |
| Contraste y 48 dp | OK (T) | 18.1. Zonas táctiles: Google 52, 🚪 48 (círculo 40), avatar 48, celdas de ícono ≥ 48, «+ Crear categoría» ≥ 56 en la rejilla y 48 como botón, «Revisar la lista»/Guardar/Cancelar `Button` (48; Guardar 52 en la hoja alta) |
| Colores crudos | OK | en `LoginScreen`, `session-ui`, `category-create-sheet` y `form-ui` no hay literales `#RRGGBB` ni `rgb(`; el Login usa `colors`, `depth` y `brandGoogle`. Los literales de `category-form.tsx` son la paleta de datos `CATEGORY_COLORS` (se envían a la API, existente desde R3) |
| Decisión del implementador: aviso y error a la vez en el Login | Observación (18.6-1) | conforme al comportamiento existente; no alcanzable tras `signIn` |
| Decisión del implementador: hoja sin animación de salida | Observación (18.6-2) | consecuencia de montar la hoja solo mientras está abierta; las otras hojas sí animan la salida. No contradice ningún criterio R51 |
| Decisión del implementador: `role="status"` | Aceptada (A); validación en D8 | RN 0.86 admite `role="status"` en `Text` y `tsc` lo acepta. Se combina con `accessibilityLiveRegion="polite"` y `setAccessibilityFocus`, como pide docs/007 §5.13.E; el riesgo de doble lectura solo se descarta con TalkBack |

### 18.4 «Tipo: Gasto» duplicado en la hoja

Clasificación: **defecto bajo UXQA-R51-01** (texto redundante; la causa es una contradicción documental entre docs/007 y docs/008 que el implementador resolvió aplicando las dos). docs/007 §5.13.E pide una línea fija `small` «Tipo: Gasto»; docs/008 §6.15.5 pide una píldora no interactiva «Gasto» en el encabezado. El código pinta ambas, la píldora con el texto «Tipo: Gasto» y la línea con el mismo texto, sin ocultar ninguna: TalkBack lee «Tipo: Gasto» dos veces y a vista se repite a una distancia de unos 60 dp.

### 18.5 Defectos

| ID | Pantalla | Caso | Severidad | Pasos | Esperado | Obtenido | Evidencia / archivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXQA-R51-01 | Hoja «Nueva categoría» (Nuevo movimiento) | INF/ACC; R51-20; docs/007 §5.13.E y docs/008 §6.15.5 | Baja | Abrir Nuevo movimiento, tocar «+ Crear categoría» y leer la hoja (con TalkBack, pasar por los elementos) | Un solo indicador del tipo fijado: o la píldora «Gasto»/«Ingreso» (docs/008) o la línea «Tipo: …» (docs/007) | Dos: la píldora del encabezado con «Tipo: Gasto» y la línea fija «Tipo: Gasto» bajo el nombre; ambas accesibles | `app/src/screens/category-create-sheet.tsx` (`styles.pill`, `pillText`) y `app/src/screens/category-form.tsx` (`fixedType`, prop `fixedTypeText`). Nivel A (código). Corrección sugerida: mantener la píldora (docs/008, que es el más reciente) con el texto «Gasto»/«Ingreso» y no pasar `fixedTypeText`, o conservar la línea y ocultar la píldora a los lectores; `mobile-ux-designer` y `mobile-visual-designer` deben unificar docs/007 y docs/008 |
| UXQA-R51-02 | Código compartido de categorías | Calidad (retirada sin código muerto) | Baja | `grep -rn lockedTipo app/src` | Sin código sin uso tras la retirada de `fromForm`/«Ir a Categorías» | La prop `lockedTipo` de `CategoryFormCard` (y su rama de `fixedTypeText`) solo la usan las pruebas; en producción la hoja usa `CategoryFormFields` directamente. `CATEGORY_ICON_SLUG` solo la usa una prueba | `app/src/screens/category-form.tsx` (`lockedTipo` en las líneas de props, estado inicial y `fixedTypeText`), `app/src/lib/category-appearance.ts` (`CATEGORY_ICON_SLUG`); pruebas `CategoriesScreen.icons.test.tsx` («lockedTipo»). No afecta a la interfaz |

Los dos defectos son bajos y no bloquean. No se hallaron defectos medios, altos ni críticos.

### 18.6 Observaciones sin defecto

1. Login, error y aviso a la vez: `LoginScreen` pinta `notice`, el motivo (solo si no hay `notice` ni error) y `error` sin exclusión entre `notice` y `error`, aunque docs/007 §5.13.A habla de prioridad error, aviso, motivo. Es el comportamiento del Login anterior y `signIn` pone `notice: null` al empezar (`use-auth.tsx`), por lo que solo coexistirían si el cierre publica un error junto con un aviso, caso que `endSession` no produce. Se acepta; si el diseñador quiere una sola caja, se pide la exclusión explícita.
2. La hoja «Nueva categoría» no tiene animación de salida (se desmonta al cerrar), a diferencia de las otras cuatro hojas. Declarado por el implementador; coherente con la omisión de salida de R5 (§14.5-b). Para el usuario es un cierre brusco, no un fallo. Se puede mantener la hoja montada con `visible` si se quiere la animación.
3. Contradicciones documentales sin efecto funcional, a devolver a los diseñadores: (a) docs/007 §5.13.B fija el fondo pulsado de Google en `#F1F3F4`; docs/008 §6.15.2 y el código usan `#E6E6E6` (y docs/003 D11.2 menciona solo tres colores de Google; el cuarto sale de docs/008); (b) docs/007 §5.13.D pide borde del ícono elegido `brand700` y docs/008 §6.15.4 `text`, que es lo implementado; (c) docs/008 §6.15.4 calcula 5 columnas a 320 dp en el formulario; el código da 4 (más holgado, 58 dp por celda); (d) la píldora o la línea de tipo (UXQA-R51-01).
4. Tamaño de «CuidaTuBilletera» con fuente ampliada: `rootTitle` (26 sp, 800) no limita `maxFontSizeMultiplier` y es una sola palabra de 16 letras. A 175 % y 200 % es probable que Android la parta dentro de la palabra a 320 y a 360 dp (estimación por ancho medio, sin medir). El Login anterior tenía el mismo riesgo. Se verifica en D (anotarlo en la prueba de fuente grande).
5. `Sheet` con `tall` calcula su altura con `useWindowDimensions().height` y `useSystemInsets().top`, que dependen de la misma hipótesis de la barra de estado; si el respaldo de 32 dp resulta corto o largo, la hoja alta cambia unos dp. Sin efecto grave: el pie va dentro de la hoja.
6. La hoja alta pone `paddingBottom: 24 + insets.bottom` (con el respaldo de 48, 72 dp bajo el pie) incluso con el teclado abierto; ya era así en las otras hojas. Con el teclado abierto en pantallas bajas esos 72 dp restan espacio al cuerpo; D6 lo comprueba.
7. `tsconfig.json` en la raíz sigue sin seguimiento (ya señalado en §14.7-9); no forma parte de R5.1. Coordinar si se versiona o se descarta antes del commit.
8. Las suites nuevas son lentas con la caché fría (≈ 60 s `createCategory`, ≈ 46 s `icons`); hoy no agotan tiempos, pero conviene que `qa-engineer` las repita con `--no-cache` en CI (riesgo análogo a UXQA-R4-01).

### 18.7 Pendientes (no demostrados) y motivo

Todo el nivel D por falta de emulador, dispositivo y TalkBack. No se tomaron capturas de la app ni se hizo la comparación de nivel R con `docs/design/capturas/` y el prototipo (el prototipo conserva «Ingresar con Google» y la «G» dibujada: es anterior a R5.1, no es la referencia de este texto).

| Criterio | Qué falta | Nivel |
| --- | --- | --- |
| D1 Barra de estado en Login | Reloj, íconos y recorte sin tapar «CuidaTuBilletera» ni el botón | D |
| D2 Barra de estado en Mis cuentas, Más, Reportes, Calendario y Nuevo movimiento | Encabezado (marca, 🚪, avatar) completamente bajo la barra | D |
| D3 Hojas | Velo que cubre la barra; sin salto al abrir ni cerrar | D |
| D4 Teléfono con y sin recorte | Hueco de más de 8 dp respecto de la barra real con el respaldo de 32 dp; anotar modelo y altura | D |
| D5 Rotación o fuente grande | La reserva superior no cambia ni se duplica | D |
| D6 Hoja con teclado abierto | Nombre, vista previa y pie visibles o alcanzables; no se pierde lo escrito | D |
| D7 Hoja a fuente 200 % | Se desplaza; los 30 íconos tocables; Guardar y Cancelar alcanzables | D |
| D8 TalkBack | «Cerrar sesión» como botón; «Ícono {nombre}, botón de opción, seleccionado»; «+ Crear categoría»; aviso de éxito sin mover el foco de forma confusa (`role="status"` + región viva + foco); logo de Google no se lee dos veces; «Tipo: Gasto» leído dos veces (UXQA-R51-01) | D |
| D9 Pulgar a 360 dp | «Continuar con Google» y «Cerrar sesión» alcanzables; 10 toques a cada uno entre 🚪 y avatar sin error | D |
| D10 Logotipo de Google | Nitidez en densidad alta y media (cuatro PNG por densidad, no se pudo ver el empaquetado de Metro) | D |
| D11 Red lenta o modo avión al guardar la categoría | Mensaje de fallo incierto y «Revisar la lista» | D |
| D12 Cerrar sesión y entrar con otra cuenta de Google | Datos separados y ayudas por usuario | D |

Tampoco se comprobó en dispositivo: la apariencia del emoji 🚪 y de los glifos del catálogo (🍽️, 🏋️, ＋, ⋯) con la fuente de Android, la carga real de los PNG y el Login a 320 × 568 y fuente 175 % (solo cubierto por las ramas `compact` y `showMark` en Jest). Pendiente de otros agentes: `qa-engineer` repite typecheck, lint y regresión con caché fría; la alcancía de Mis cuentas sigue obligatoria en R6.

## 19. Casos de apariencia de cuenta (color e ícono; docs/007 §5.14)

Nivel A salvo indicación; D = dispositivo.

| Caso | Pantalla | Procedimiento | Esperado | Nivel |
| --- | --- | --- | --- | --- |
| CTA-01 | Crear/Editar | API con `color`/`icono` en la lista | Se muestra «Apariencia» (vista previa, Color, Ícono) | A |
| CTA-02 | Crear/Editar | API sin las claves (DEV actual) | Bloque oculto; POST/PATCH sin `color` ni `icono` | A |
| CTA-03 | Crear | Lista vacía | Bloque oculto; el POST envía solo nombre y saldo | A |
| CTA-04 | Crear | Elegir «limón» | Se envía `color: "limon"` (sin tilde); etiqueta «Color limón» | A |
| CTA-05 | Crear | No tocar Apariencia | No se envían color ni ícono | A |
| CTA-06 | Editar | Cambiar solo el color | PATCH con solo `color` | A |
| CTA-07 | Editar | Pasar de un color guardado a «Predeterminado» | PATCH con `color: null`; de `null` a Predeterminado no envía nada | A |
| CTA-08 | Editar | Sin cambios | Sin PATCH | A |
| CTA-09 | Ambas | Vista previa | Cambia al instante; Crear sin color muestra neutro y «El color se asigna al crear la cuenta»; ícono Predeterminado = `accountIcon(nombre)` | A |
| CTA-10 | Ambas | Roles, etiquetas y estados | `radiogroup` «Color de la cuenta» / «Ícono de la cuenta»; `radio` con `selected`; «Color predeterminado», «Ícono predeterminado» | A |
| CTA-11 | Crear | Elegir solo un color y pulsar Atrás o «‹ Volver» | Aviso «¿Descartar esta cuenta?»; con Predeterminado y sin más datos, no hay aviso | A |
| CTA-12 | Ambas | Guardar con `busy` | Opciones y botones inertes; un solo envío | A |
| CTA-13 | Ambas | Falla de red o 5xx al guardar | Editar: «No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.». Crear: se mantiene el aviso de respuesta perdida (docs/007 §5.14.I). En ambas, selección conservada y Guardar reactivado. Un 400 por apariencia oculta el bloque (la API no admite esos campos) y muestra el texto anterior | A |
| CTA-14 | Ambas | Teclado abierto, tocar una opción | Selecciona sin perder el texto; Guardar alcanzable; nada bajo la barra del sistema | D |
| CTA-15 | Ambas | Fuente 200 %, 320 y 360 dp | Zonas ≥ 48 dp y nombres de color a 2 líneas sin recorte. El selector de ícono ya no es una rejilla en línea: es la fila «Ícono» + hoja «Elegir ícono» (ver ICO-01 a ICO-12). Estado: pendiente en dispositivo | D |
| CTA-16 | Ambas | TalkBack | La fila se lee «Ícono {nombre}, cambiar, botón»; en la hoja, cada celda «Ícono Billetera, botón de opción, seleccionado»; el foco no salta al cambiar (ver ICO-05 a ICO-07). Estado: pendiente en dispositivo | D |
| CTA-17 | Lista/Detalle | Guardar con color e ícono | `AccountCard`, Detalle y barra de contexto los reflejan | A |

## 20. Casos futuros propuestos: avisos de versión y multidioma (no existen en la matriz vigente)

Propuestos el 2026-10-17 por `mobile-ux-designer` para las etapas futuras F-A y F-B (docs/003 «Decisión F-A / F-B», docs/004 «Capacidades futuras»). **No están aprobados, no están implementados y no cuentan para ningún cierre.** Los IDs son provisionales y se confirman cuando el usuario apruebe cada etapa.

| ID | Caso | Qué se verificaría |
| --- | --- | --- |
| CTA-F-01 | Estado ok | Sin aviso, espacio reservado ni parpadeo. |
| CTA-F-02 | update_available en Mis cuentas | Tarjeta con [Actualizar] y [Ahora no]; no modal; 48 dp. |
| CTA-F-03 | Descartar aviso opcional | Desaparece, no reaparece en la sesión, datos intactos. |
| CTA-F-04 | Opcional con formulario abierto | No se muestra durante la captura; sí al volver a la lista. |
| CTA-F-05 | update_required con movimiento a medio capturar | Sin bloqueo; datos conservados; el bloqueo aparece al terminar o descartar. |
| CTA-F-06 | Guardado rechazado por versión no soportada | Se conservan los datos y se ofrece actualizar. |
| CTA-F-07 | Bloqueante: Atrás | No abre pantallas de datos; cierra la app o el aviso permanece. |
| CTA-F-08 | Bloqueo sin conexión tras update_required previo | El bloqueo se mantiene y se informa si Actualizar falla. |
| CTA-F-09 | Tienda no disponible | Mensaje claro con [Reintentar] y opción de cerrar la app. |
| CTA-F-10 | Error del servicio de versión | Se trata como ok; no se bloquea a nadie. |
| CTA-F-11 | TalkBack en el aviso | Foco inicial en el título del bloqueante; el opcional se anuncia en modo polite. |
| CTA-F-12 | 360x640 con fuente al 200 % | El opcional no tapa el saldo; el bloqueante se desplaza y sus acciones se alcanzan. |
| CTA-F-13 | Opcional y exportación en curso | No interrumpe la exportación; sin doble aviso. |
| CTA-F-14 | Tono y textos | Español cotidiano, sin tecnicismos ni urgencia falsa. |
| CTA-F-15 | Sin dark patterns | [Ahora no] igual de visible que [Actualizar]; sin contadores ni presión. |
| CTA-F-16 | Idioma: ubicación y valor por defecto | Fila «Idioma» en Más; «Automático» por defecto; opciones en su propio idioma. |
| CTA-F-17 | Cambio inmediato de idioma | Sin reinicio ni cierre de sesión; conserva cuenta, pestaña, filtros, mes y período. |
| CTA-F-18 | Cambio de idioma con borrador | El formulario conserva lo escrito. |
| CTA-F-19 | Automático ante cambio del idioma del teléfono | Se aplica de inmediato o al siguiente arranque, con aviso. |
| CTA-F-20 | Fechas y meses por idioma | Presentación correcta; la fecha enviada sigue siendo AAAA-MM-DD. |
| CTA-F-21 | Montos por idioma | Siempre 2 decimales y separador inequívoco; misma cifra en centavos. |
| CTA-F-22 | Entrada de monto ambigua | «1.250» o «1,250» se aclara, no se adivina (coherente con R3 D8). |
| CTA-F-23 | Plurales | «1 cuenta» y «2 cuentas» correctos en cada idioma. |
| CTA-F-24 | Errores por código | Cada código conocido muestra su texto traducido; uno desconocido, el genérico traducido. |
| CTA-F-25 | Pseudo-localización +30–40 % | Sin textos cortados ni superpuestos en las pantallas principales. |
| CTA-F-26 | Pseudo-localización en 360x640 con fuente al 200 % | Barra inferior con 5 etiquetas, botones de 48 dp, saldos sin truncar. |
| CTA-F-27 | TalkBack en el idioma elegido | Etiquetas, pistas, anuncios, importes y fechas en el idioma de la app. |
| CTA-F-28 | Datos del usuario | Nombres de cuentas y categorías, notas y descripciones no se traducen ni se alteran. |
| CTA-F-29 | Exportación | CSV estable e independiente del idioma; PDF según decisión aprobada. |
| CTA-F-30 | Idioma desconocido | Quien no entiende el idioma actual puede volver a la fila «Idioma». |

### Verificación puntual de UXQA-R3-01 (2026-10-17, lectura de código en HEAD b7e82fa)

Estado: **cerrado, no reintroducido** (consistente con §12.8). Tras un fallo incierto al crear un movimiento (red, timeout, 5xx, 429 o error desconocido) el formulario muestra «No pudimos confirmar si se guardó. Revisa tus movimientos antes de volver a intentar.» (`resources-messages.ts`, `isUncertainWriteFailure`; `TransactionFormScreen.tsx`). No hay reintento automático de `POST /transactions` (solo el reintento del 401 con token renovado); un cerrojo síncrono (`use-loader.ts`) y el botón deshabilitado evitan el doble toque. Persiste el riesgo aceptado de duplicado por reintento manual sin revisar (docs/003): no hay idempotencia en la API. **Verificado solo en código y pruebas Jest; no observado en dispositivo.** Pendiente de nivel D: modo avión justo tras pulsar Guardar, anuncio de TalkBack y que el aviso no quede tras el teclado; después abrir Movimientos y comprobar si el gasto llegó.

## 21. Casos de R5.1b: selector de ícono en hoja «Elegir ícono» (docs/007 §5.15 A, docs/008 §6.17)

Creados por `mobile-ux-qa` el 2026-10-17. Nivel: A = automática (mock, Jest), D = dispositivo Android real. **Todos los casos están «pendiente en dispositivo»**; la columna Nivel indica si además hay prueba automática (A+D) o solo se puede comprobar en el teléfono (D). Respaldo automático: `app/src/screens/icon-picker-sheet.test.tsx`, `app/src/lib/icon-catalog.test.ts`.

| ID | Caso | Procedimiento | Esperado | Nivel | Estado |
| --- | --- | --- | --- | --- | --- |
| ICO-01 | Hoja a 360 × 640 dp | Abrir «Elegir ícono» con insets inferiores 0, 24 y 48 dp | «Cancelar» y «Usar este ícono» siempre visibles; al menos 2 filas de celdas; sin recortes del buscador ni de los chips | A+D | pendiente en dispositivo |
| ICO-02 | Hoja a 412 × 915 dp | Igual que ICO-01 | Hoja alta (75 %), rejilla amplia, pie visible | A+D | pendiente en dispositivo |
| ICO-03 | Teclado y modo compacto | Tocar «Buscar ícono» a 360 × 640 | La hoja pasa a casi pantalla completa; buscador y pie alcanzables; el pie no queda bajo el teclado; «Intro» cierra el teclado | A+D | pendiente en dispositivo |
| ICO-04 | Atrás en hoja sobre hoja | Abrir «Elegir ícono» desde «+ Crear categoría» y pulsar Atrás (gesto y tres botones) | Cierra solo la hoja de ícono, sin guardar; la hoja de categoría conserva lo escrito; un segundo Atrás actúa según la hoja de categoría | A+D | pendiente en dispositivo |
| ICO-05 | TalkBack: foco inicial | Abrir la hoja con TalkBack | El foco cae en el título «Elegir ícono» | A (llamada) + D | pendiente en dispositivo |
| ICO-06 | TalkBack: anuncio de grupo | Elegir un chip de grupo | Anuncia «{grupo}, N íconos»; los chips se leen «Grupo {nombre}, botón de opción, seleccionado» | A (llamada) + D | pendiente en dispositivo |
| ICO-07 | TalkBack: foco devuelto | Cerrar la hoja con Usar, Cancelar, ✕ y Atrás | El foco vuelve a la fila «Ícono» del formulario | A (llamada) + D | pendiente en dispositivo |
| ICO-08 | Fuente 200 % | Abrir la hoja a 360 × 640 con fuente máxima | Botones apilados, ambos visibles; cuerpo desplazable si hace falta; celdas ≥ 48 dp en 4 columnas; sin texto recortado | A+D | pendiente en dispositivo |
| ICO-09 | Render de los 249 emojis | Recorrer todos los grupos de cuentas y categorías | Ningún cuadro vacío («tofu»); tamaño uniforme a 24 sp | D | pendiente en dispositivo |
| ICO-10 | Lista de vigilancia docs/008 §6.17.4 | Ver 🛁 🚽 🍦 💿 ⌛ 🍼 🍞 🧥 💍 🔦 ☔ 📓 📒 sobre limón, lavanda y rosa | Reconocibles a 24 sp sin etiqueta; si fallan, sustituir el emoji (la clave no cambia) | D | pendiente en dispositivo |
| ICO-11 | Cuentas antiguas y categorías existentes | Editar una cuenta con ícono antiguo o sin ícono, y una categoría existente | La hoja abre en el grupo del ícono actual y se desplaza hasta él; sin ícono muestra «predeterminado»; «Usar este ícono» inactivo hasta cambiar | A+D | pendiente en dispositivo |
| ICO-12 | Borrador y doble toque | Elegir, Cancelar/✕/fondo/Atrás; elegir y pulsar «Usar este ícono» dos veces | Cancelar descarta; el formulario cambia solo con Usar; un único `onChange` | A | pendiente en dispositivo (confirmación visual) |
| ICO-13 | Búsqueda | Buscar un término con y sin resultados | Sin chips al buscar; vacío «No encontramos íconos con «…»…» y «Borrar búsqueda»; ✕ borra | A | pendiente en dispositivo |
| ICO-14 | Foco visible | Navegar con teclado externo o TalkBack por celdas y chips | Aro de 2 dp `colors.text` interior; no sustituye el borde de 3 dp de la selección | A (estilo) + D | pendiente en dispositivo |
| ICO-15 | Teclado abierto en pantalla pequeña con fuente grande | 360 × 640, fuente 200 %, teclado abierto, hoja compacta | Cálculo de `qa`: el cuerpo desplazable puede quedar sin altura y el pie recortarse; comprobar que el pie sigue alcanzable | D | pendiente en dispositivo |

#### Casos ICO-16 a ICO-24: flechas de la barra de grupos (docs/007 §5.15.1, docs/008 §6.17.5; paso 366)

Todos pendientes en dispositivo: las pruebas Jest (mock) no miden layout, foco de TalkBack ni parpadeo.

| ID | Caso | Pasos | Resultado esperado | Nivel | Estado |
| --- | --- | --- | --- | --- | --- |
| ICO-16 | Ancho visible 360 / 412 / 320 dp | Abrir la hoja a cada ancho con fuente 100 % | Ventana de chips ≈ 216 / 268 / 176 dp; flechas de 48 dp en los extremos; ningún chip bajo una flecha; fuente de chips sin reducir | D | pendiente en dispositivo |
| ICO-17 | Centrado inicial con grupo activo al final | Editar una cuenta o categoría cuyo ícono esté en el último grupo; abrir la hoja | Grupo activo visible y centrado (o pegado al final); solo «Ver grupos anteriores» visible; sin salto visible tras reservar los huecos | D | pendiente en dispositivo |
| ICO-18 | Parpadeo de flechas | Abrir la hoja, desplazar con dedo y con flechas hasta ambos extremos, ±1 px del borde | Las flechas no parpadean ni oscilan; los chips no se mueven al aparecer o desaparecer una flecha | D | pendiente en dispositivo |
| ICO-19 | Paso y gesto | Tocar «Ver más grupos» y «Ver grupos anteriores» varias veces seguidas; arrastrar con el dedo | Cada toque desplaza ≈ 80 % del ancho visible, sin estancarse ni retroceder; el arrastre sigue funcionando y actualiza las flechas | D | pendiente en dispositivo |
| ICO-20 | TalkBack: orden y foco | Explorar con TalkBack; activar flecha hasta el extremo | Orden: «Ver grupos anteriores» → chips → «Ver más grupos»; etiquetas exactas; la flecha no disponible no se lee; al llegar al extremo se anuncia «Último grupo» / «Primer grupo» y el foco no se pierde (la implementación solo anuncia; no mueve el foco a un chip: comprobar en el teléfono) | D | pendiente en dispositivo |
| ICO-21 | Rotación y fuente 200 % | Girar la pantalla y subir la fuente al 200 % con la hoja abierta | Grupo activo conservado y visible; flechas recalculadas; zonas ≥ 48 dp; un chip más ancho que la ventana se muestra parcial y se alcanza con la flecha; botones del pie alcanzables | D | pendiente en dispositivo |
| ICO-22 | Calibración del chevron | Observar ambas flechas a 360 dp | Chevron dibujado centrado ópticamente en el círculo de 40 dp (translateX ∓3 dp, ajuste ±1 dp); trazo de 3 dp legible; círculo `segBg` distinguible de los chips | D | pendiente en dispositivo |
| ICO-23 | Buscar y borrar | Escribir en el buscador y luego borrar con ✕ o «Borrar búsqueda» | Durante la búsqueda no hay chips ni flechas; al borrar vuelven con el grupo activo visible y las flechas correctas; los 17 grupos se conservan | D | pendiente en dispositivo |
| ICO-24 | Reducir movimiento y chip cortado | Activar «Quitar animaciones» y usar las flechas; tocar un chip parcialmente cortado | Con el ajuste, salto directo; sin él, animado; el chip tocado queda completo y seleccionado; las flechas no alteran grupo, borrador ni búsqueda | D | pendiente en dispositivo |

### 21.1 Casos INM-01 a INM-24: modo inmersivo (docs/007 §5.15 B y C) — aprobada (D17), pendiente en dispositivo

**Registro de validación del usuario (2026-10-19, paso 372, docs/003 D18).** El usuario probó la Development Build `7c58a37f` en Android real, de forma manual y sin captura ni grabación, y confirmó: la app abre, la barra de navegación del sistema se oculta y las flechas de grupos del selector de íconos funcionan. Es una validación **funcional**, no cobertura QA completa: ningún caso INM-01 a INM-24 ni ICO-16 a ICO-24 pasa individualmente a «aprobada» y todos permanecen «pendiente en dispositivo». Solo consta, como observación de INM-01, que la barra se oculta (sin comprobar encabezados ni recorte). No probados: TalkBack, fuente ampliada, teclado y modales en configuraciones especiales, otros dispositivos Android, gestos frente a tres botones.

Aprobados el 2026-10-17 (docs/003 D17). Estado de todos: **aprobada, pendiente en dispositivo**. Nivel D (Android real con la Development Build nueva; no emulador). Cada caso se ejecuta con navegación por gestos y con tres botones salvo que se indique. Ningún caso se da por pasado sin evidencia (captura o grabación). El cierre del modo exige INM-01 a INM-10 más la matriz del rediseño; los casos INM-11 en adelante cubren los riesgos y límites aceptados en D17. Un defecto alto o crítico detiene la integración.

Comportamiento esperado global: barra de navegación oculta al abrir y tras volver a primer plano; barra de estado siempre visible; `bottom` puede valer 0 con la barra oculta (válido, no un error); contenido, barra de pestañas, pie de hojas, Snackbar y botones primarios siempre enteros y tocables (≥ 48 dp), nunca bajo el recorte, el borde ni la barra revelada; sin ajuste de usuario; excepciones automáticas: TalkBack activo y teclado abierto.

| ID | Caso | Qué se verifica (criterio observable) | Nivel | Estado |
| --- | --- | --- | --- | --- |
| INM-01 | Abrir la app (frío), 3 botones y gestos | La barra de navegación se oculta; la barra de estado sigue visible; contenido a pantalla completa; ningún título ni botón bajo el recorte ni el gesto | D | aprobada, pendiente en dispositivo |
| INM-02 | Deslizar desde el borde inferior | Aparece la barra unos segundos y se oculta sola; la app no ejecuta ninguna acción propia; el primer deslizamiento solo revela | D | aprobada, pendiente en dispositivo |
| INM-03 | Atrás con hoja abierta, teclado abierto y formulario sucio | Orden idéntico al de siempre (teclado, hoja o aviso, pila, Cuentas); sin cierre accidental de la app | D | aprobada, pendiente en dispositivo |
| INM-04 | Abrir teclado en un formulario | La barra del sistema se muestra mientras el teclado está abierto; campo y «Guardar» visibles; al cerrar el teclado la barra se oculta | D | aprobada, pendiente en dispositivo |
| INM-05 | Hoja «Elegir ícono» con barra oculta y revelada | Pie y «Usar este ícono» enteros y tocables (≥ 48 dp), nunca bajo la barra; con `bottom = 0` el pie conserva su relleno propio | D | aprobada, pendiente en dispositivo |
| INM-06 | TalkBack activado | Barra visible; todos los controles alcanzables; el gesto de revelado no es necesario | D | aprobada, pendiente en dispositivo |
| INM-07 | Atrás en la raíz y volver desde segundo plano | Atrás sale de la app sin confirmación; al volver, la barra vuelve a ocultarse | D | aprobada, pendiente en dispositivo |
| INM-08 | Barra de pestañas con y sin barra del sistema revelada | Sin solape con la barra; objetivos ≥ 48 dp; con `bottom = 0` pestañas enteras al borde inferior, íconos y rótulos completos; sin salto brusco del contenido al revelar | D | aprobada, pendiente en dispositivo |
| INM-09 | Recorte (notch) y barra de estado | Encabezados fuera del recorte; sin margen arbitrario por modelo; la barra de estado no se oculta | D | aprobada, pendiente en dispositivo |
| INM-10 | Buscar un ajuste para desactivar el modo | NO existe ajuste en Más (decisión D17); el comportamiento no cambia tras reiniciar; las únicas excepciones son TalkBack y teclado | D | aprobada, pendiente en dispositivo |
| INM-11 | Reaplicar al volver de segundo plano | Ir a otra app y volver (y bloquear y desbloquear la pantalla): al volver la barra está oculta de nuevo sin tocar nada | D | aprobada, pendiente en dispositivo |
| INM-12 | TalkBack activado y desactivado en caliente | Con la app abierta: activar TalkBack muestra la barra; desactivarlo la oculta, sin reiniciar la app ni perder la pantalla | D | aprobada, pendiente en dispositivo |
| INM-13 | Teclado abierto y cerrado repetidamente | Abrir y cerrar 10 veces: un cambio de barra por evento, sin parpadeo continuo ni bucle; sin saltos persistentes del diseño | D | aprobada, pendiente en dispositivo |
| INM-14 | Hoja con `Modal` y `navigationBarTranslucent` | Abrir una hoja con la barra oculta: el scrim cubre hasta el borde inferior; la barra no reaparece por abrir el modal; al cerrarlo se mantiene el estado | D | aprobada, pendiente en dispositivo |
| INM-15 | Atrás con gestos (barra oculta) | Primer Atrás desde el borde puede solo revelar la barra (riesgo aceptado); el siguiente actúa; ninguna pantalla se cierra por error | D | aprobada, pendiente en dispositivo |
| INM-16 | Atrás con tres botones | Con la barra revelada, el botón Atrás sigue el mismo orden; con ella oculta se revela primero y luego actúa; sin pérdida de datos del formulario sin aviso | D | aprobada, pendiente en dispositivo |
| INM-17 | Rotación | No aplica: la app es solo vertical (`portrait`); al girar el teléfono la pantalla no rota ni se rompe. Registrar «no aplica» | D | aprobada, pendiente en dispositivo |
| INM-18 | Salir de la app y recuperar la barra del sistema | Al ir al inicio o a otra app, la barra de navegación vuelve a verse normalmente fuera de la app; no queda oculta en el sistema | D | aprobada, pendiente en dispositivo |
| INM-19 | Hueco bajo «Guardar» con teclado abierto | En formularios de movimiento, cuenta y categoría con el teclado abierto: sin hueco visible entre «Guardar» y el teclado ni «Guardar» tapado. Si hay hueco, registrar medida (dp) y captura como defecto; no se arregla con reglas de teclado nuevas | D | aprobada, pendiente en dispositivo |
| INM-20 | Snackbar y FAB al ocultar o revelar la barra | Como máximo un fotograma de desajuste; luego Snackbar y FAB en su posición, sin solape con la barra de pestañas ni con la barra del sistema | D | aprobada, pendiente en dispositivo |
| INM-21 | `bottom = 0` con la barra oculta | Contenido, lista y botones primarios enteros hasta el borde; el último elemento de listas largas se alcanza con el desplazamiento y no queda tapado por las pestañas | D | aprobada, pendiente en dispositivo |
| INM-22 | Fallo del modo (degradación) | Si el sistema no permite ocultar (p. ej. launcher o versión): la barra queda visible, la app funciona igual y no hay error visible ni cierre | D | aprobada, pendiente en dispositivo |
| INM-23 | Fuente 200 % y pantalla pequeña con la barra oculta | Sin recortes ni solapes en pestañas y pies de hoja; botones alcanzables | D | aprobada, pendiente en dispositivo |
| INM-24 | Regresión de la matriz del rediseño | Ejecutar los casos Android transversales (§4) y las pantallas con la build nueva; sin regresiones respecto a la validación previa | D | aprobada, pendiente en dispositivo |

## 22. Casos de R6: identidad visual nativa (aprobados para ejecución en el paso 374; solo R6-10 y R6-11 tienen evidencia)

Estado: R6-10 y R6-11 tienen evidencia automática o de cálculo (paso 374). Los demás siguen **pendientes en dispositivo** como casos individuales; no se marca ninguno como «aprobada».

**Registro de validación del usuario (2026-10-19, paso 376, docs/003).** El usuario probó la Development Build `bcc026f3` (versionCode 2) en Android real, de forma manual y sin evidencia instrumentada, y confirmó: la app abre y permite iniciar sesión; la barra inferior permanece oculta; el nuevo ícono aparece correctamente; la alcancía aparece en el encabezado de Mis cuentas; la ilustración se ve sin recortes ni superposiciones; y cuentas, categorías y movimientos siguen funcionando. Es una validación **funcional**, no cobertura QA completa. Relación con los casos: R6-08 (regresión) solo parcial; R6-01 solo parcial (se vio el ícono, sin máscaras alternativas); R6-05 solo parcial (se vio en el dispositivo del usuario, sin 320 dp ni fuentes 1,3 y 1,75); R6-04 no confirmado (no consta que se revisara el nombre). **No ejecutados:** R6-02 (ícono temático) y R6-03 (splash), que exigen una build de distribución `preview`; R6-06 (vacío con alcancía de 120 dp); R6-07 (TalkBack); R6-09 (fuente 175 % y 200 %); fuente ampliada, teclado en configuraciones especiales y otros dispositivos. R6 se considera cerrada funcionalmente con estos pendientes no bloqueantes.

| ID | Caso | Procedimiento | Esperado | Nivel | Estado |
| --- | --- | --- | --- | --- | --- |
| R6-01 | Ícono en el lanzador | Ver el ícono en el lanzador con máscara circular, squircle y esquinas redondeadas | Alcancía completa, sin hojas ni moneda cortadas; fondo `#0F5F5A` sin bordes | D | pendiente en dispositivo |
| R6-02 | Ícono temático (Android 13+) | Activar íconos temáticos | Silueta reconocible (moneda con «$», ojo, ranura); no una mancha | D | pendiente en dispositivo |
| R6-03 | Splash en frío | Abrir la app desde cero en Android 12+ y en uno anterior (build `preview`) | Android 12+: arte completo dentro de la máscara circular; Android anterior: arte completo sobre fondo `#0F5F5A`; sin parpadeo blanco; el splash coincide con el ícono del lanzador (mismo verde y motivo) | D | pendiente en dispositivo |
| R6-04 | Nombre visible | Ver el nombre bajo el ícono, con fuente del sistema normal y grande | «CuidaTuBilletera» legible o decisión de cambiar a «Cuida tu Billetera» | D | pendiente en dispositivo |
| R6-05 | Alcancía del encabezado | Mis cuentas con cuentas a 360, 412 y 320 dp, y con fuente 130 % y 175 % | 320 dp: oculta; 360 dp: 72 dp; 412 dp: 96 dp; fuente 130 %: 48 dp; fuente 175 %: oculta (docs/008 §13.2); no trunca «Mis cuentas» ni el saludo | D | pendiente en dispositivo |
| R6-06 | Alcancía de estados vacíos | Sin cuentas y solo archivadas | Una sola alcancía de 120 dp, centrada, 16 dp sobre el título; el encabezado no la repite | D | pendiente en dispositivo |
| R6-07 | Accesibilidad de la alcancía | TalkBack en Mis cuentas con y sin cuentas | TalkBack no anuncia la imagen; orden de lectura idéntico al actual | D | pendiente en dispositivo |
| R6-08 | Regresión | Login, navegación y modo inmersivo tras la build nueva | Sin regresiones respecto a la validación del usuario (D18) | D | pendiente en dispositivo |
| R6-09 | Vacío de cuentas con fuente grande | Sin cuentas con fuente 175 % y 200 % | La alcancía se oculta sin hueco; título, mensaje y «Crear mi primera cuenta» visibles y tocables | D | pendiente en dispositivo |
| R6-10 | Una sola alcancía por pantalla | Prueba Jest de Mis cuentas (con cuentas, sin cuentas, solo archivadas, fuente 1,75) | Siempre a lo sumo una alcancía, decorativa, con los tamaños de docs/008 §13.2 | A | **aprobada (automática, Jest; 59 suites y 1855 pruebas, paso 374)** |
| R6-11 | Contraste del amarillo de marca | Calcular `#FFC93C` sobre `#0F5F5A` | Razón registrada (≥ 3:1 como gráfico); el splash no lleva texto | A | **aprobada (cálculo WCAG: 4,87:1, paso 374)** |

## 23. Casos de la conciliación manual (docs/003 Decisión 6.1; implementada en local en el paso 381; CMN-01 a CMN-06 cubiertos por pruebas automáticas; CMN-07 a CMN-11 pendientes en dispositivo)

Sustituyen a los casos CON-01 a CON-21 planteados para una pantalla de conciliación (descartada). Nivel A = automática (Jest o Vitest), D = dispositivo Android real. Estado paso 381: CMN-01 a CMN-06 tienen pruebas automáticas aprobadas en local (API: 30 archivos y 1305 pruebas; app: 59 suites y 1858 pruebas); la migración se probó sobre el D1 local de Vitest, **no** sobre D1 DEV. CMN-07 a CMN-11 siguen **pendientes en dispositivo**; ninguno se ha ejecutado. Se añade la prueba de la guía `categorias`: texto con «Conciliación», no reaparece si se descartó y se ve con fuente 200 % (automática).

| ID | Caso | Procedimiento | Esperado | Nivel | Estado |
| --- | --- | --- | --- | --- | --- |
| CMN-01 | Cuenta nueva con las dos categorías | Crear una cuenta (API) | 13 categorías: «Conciliación» de ingreso y de egreso, `exchange`, `#6366F1`, sin duplicados | A | aprobada (automática, paso 381) |
| CMN-02 | Migración en cuentas existentes | Aplicar la 0005 con cuentas de prueba (sin la categoría, con tilde, sin tilde, mayúsculas, archivada, renombrada, 58/59/60 categorías, dos usuarios) | Se crea solo lo que falta, sin duplicar, respetando el límite de 60; no toca otras filas | A | aprobada (automática, paso 381) |
| CMN-03 | Idempotencia y deriva | Aplicar el SQL dos veces; comparar sus literales con `DEFAULT_CATEGORIES` | Tabla idéntica; nombre, tipo, ícono y color coinciden | A | aprobada (automática, paso 381) |
| CMN-04 | Efecto en el saldo | Gasto y ingreso con «Conciliación» | El gasto resta y el ingreso suma; saldo = inicial + ingresos − gastos | A | aprobada (automática, paso 381) |
| CMN-05 | Aparición en listados | Historial, calendario, reportes y exportación con esos movimientos | Aparecen como cualquier categoría, sin fórmulas nuevas ni línea de ajustes | A | aprobada (automática, paso 381) |
| CMN-06 | Edición de la categoría | Renombrar, archivar y eliminar (sin movimientos) | Como cualquier categoría; con movimientos, 409 `CATEGORY_IN_USE` | A | aprobada (automática, paso 381) |
| CMN-07 | Nombre a 320 dp y fuente grande | Selector de categoría de Nuevo movimiento a 320 dp con fuente 100 % y 130 % (y observar 200 %) | «Conciliación» legible, sin solape con el ícono; registrar el comportamiento a 200 % | D | propuesta, pendiente |
| CMN-08 | Selector con 9 categorías | Nuevo gasto con teclado abierto | El formulario se desplaza hasta Monto y Guardar | D | propuesta, pendiente |
| CMN-09 | TalkBack | Seleccionar la categoría | Se lee «Categoría Conciliación, botón de opción, seleccionado» | D | propuesta, pendiente |
| CMN-10 | Flujo completo | Crear, ver en Historial, Calendario y Reportes, editar y anular (gasto e ingreso) | Todo funciona como un movimiento normal | D | propuesta, pendiente |
| CMN-11 | Cuenta antigua sin la categoría | Usar una cuenta sin migrar | El formulario funciona con 8 o 3 categorías y «+ Crear categoría» | D | propuesta, pendiente |
