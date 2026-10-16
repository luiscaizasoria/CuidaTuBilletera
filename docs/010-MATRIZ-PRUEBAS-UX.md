# Matriz de pruebas UX/UI de la app móvil

Matriz reutilizable con la que `mobile-ux-qa` valida cualquier cambio visible de la interfaz móvil (política de CLAUDE.md, «Coordinación y delegación»). Se aplica al rediseño (docs/007, docs/008 y docs/009) y a las fases siguientes. Los criterios detallados de cada pantalla están en docs/007 §11.2 (criterios 1 a 31, trazados en §9) y los tokens y contrastes en docs/008.

Estado actual: **ninguna fila está ejecutada sobre la app**. El rediseño no está implementado; esta matriz define qué se probará y cómo.

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
| 24 | Selector rápido de cuenta (si se aprueba 14.14) | Barra, Detalle | CTX, NAV, AND-11 | A |
| 25 | Encabezado de Mis cuentas, saludo, avatar 48 dp, alcancía decorativa | Mis cuentas | DIS, A11Y, INF | A + R |
| 26 | Alcancía 72/48/ausente según fuente y ancho | Mis cuentas | TAM, AND-08, AND-10 | R + D |
| 27 | Todo visible sin desplazar en 360 × 640; sin huecos > 24 dp en 412 × 915 | Mis cuentas | TAM, AND-08 | R + D |
| 28 | Total = suma exacta; oculto en carga/error/0-1 cuentas (si 14.16) | Mis cuentas | INF, EST | A |
| 29 | Tarjeta = un botón, ≥ 88 dp (92 con ≥ 400), etiqueta, color estable | Mis cuentas | DIS, A11Y, ACC | A + R (`.acard`) |
| 30 | Una acción primaria; Cerrar sesión en hoja de perfil con confirmación | Mis cuentas | ACC, DIS | A + R |
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
