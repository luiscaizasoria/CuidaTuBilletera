# 008 - Diseño visual del rediseño de CuidaTuBilletera

Estado: **iteración 3 APROBADA por el usuario con el diseño completo (paso 347, docs/003 Decisión R0 D6)**. La apariencia de la iteración 2 fue **rechazada** («la pantalla inicial sigue dominada por el verde; aunque cambiaste tokens, visualmente no refleja la imagen de referencia; quiero una app más alegre, colorida y atractiva»). Esta versión rehace la composición, no solo los tokens (sección 16). Autor: `mobile-visual-designer`. Complementa docs/007-DISENO-UX.md (navegación, flujos, textos, §3.6 color por módulo y §5.2 Mis cuentas) y no lo contradice. No se modificó nada en `/app` ni en `/api`, ni `app.json`, ni los assets activos, ni se instaló nada.

Recursos reales de esta propuesta (generados y verificados):

- `docs/design/assets/` (ícono y variantes, sección 13; sin cambios en esta iteración).
- `docs/design/prototipo/index.html` (prototipo navegable sin dependencias ni red; datos de ejemplo; selector de tamaño 360 × 640 / 390 × 800 / 412 × 915).
- `docs/design/contrast.js` (contraste WCAG y distinguibilidad con daltonismo; sección 3).
- `docs/design/capturas/` (renders **SVG aproximados**, no capturas de navegador; sección 14).
- Referencia de dirección artística: el póster aprobado (fondos casi blancos, verde solo en la tarjeta protagonista y el botón, mosaicos pastel por función, ilustraciones, tarjetas de cuenta con ilustración a la izquierda, segmentado coral/menta, íconos de categoría vivos). Se usa como inspiración: **no se incluyen metas** ni la frase «Pequeños hábitos, grandes logros» (no existen en el producto).

Decisiones pendientes: sección 15.

Sincronización con docs/007 (D1, D2, P-1, P-2 y P-3, aprobadas por el usuario en el paso 346; fuente: docs/007 §10 y §14.A y el prototipo): pestañas inferiores (6.8), selector de categorías y `CategoryIcon` (6.7 y 7), chips y segmentados (6.7), calendario (6.10), tarjetas de cuenta 88/92 (6.3), regla de texto truncado (6.12) y objetivos táctiles (5). No cambian colores, tokens de color, composición ni identidad.

---

## 1. Identidad de marca

Alegre y colorida sin perder credibilidad financiera, con el espíritu del póster: **fondo casi blanco cálido con manchas de color suaves**, **la alcancía como personaje** (bienvenida, encabezado de Mis cuentas, tarjeta de saldo, estado vacío), **tarjetas de cuenta de colores suaves** con ícono a la izquierda, **un color distintivo por módulo** (docs/007 §3.6) y **cuadrados de categoría vivos**. El **verde azulado de marca** (`brand700` `#0F5F5A`, el mismo del ícono) deja de ser el color de fondo de la app y queda reservado a la **acción primaria**, al **FAB** y a la **tarjeta de saldo** (la única superficie fuerte, solo en la pestaña Cuenta). El amarillo es el acento alegre (moneda, subrayado del título, destellos, «+» del FAB).

Reglas fijas:

1. **Ingreso = verde. Gasto = coral/rojo.** Solo significan ingreso y gasto (más el rojo de peligro en Archivar/Anular, decisión 15.8). La marca es verde azulado, distinta del verde de ingreso (verificado también con protanopia y deuteranopia, sección 3.2), y nunca se usa para importes.
2. **Una sola superficie fuerte por pantalla** (docs/007 §3.6): la tarjeta de saldo en Cuenta. En el resto, el color fuerte se limita al botón primario o al FAB.
3. El color nunca es el único portador de significado: signo en importes (`+` / `−`), palabra del tipo, nombre de categoría y de cuenta siempre visibles, «✓» en la opción elegida.
4. **Color por módulo = orientación, no dato** (docs/007 §3.6): Cuenta = marca (verde azulado suave), Movimientos = ámbar, Calendario = azul, Reportes = violeta, Más/Categorías = pizarra. Se manifiesta solo en la píldora de la pestaña activa, el mosaico del título y los acentos de controles del módulo. **Nunca** en la barra de cuenta activa, en importes ni en el FAB.
5. **Nuevo/Editar movimiento no tiene color de módulo: manda el tipo** (Gasto en coral suave, Ingreso en verde suave), también en la categoría y la fecha elegidas.
6. Sin degradados reales ni dependencias: la profundidad se construye con **color sólido + capas semitransparentes** (`View` con `opacity`, bandas giradas y círculos con `borderRadius`), sin `expo-linear-gradient` (restricción de `architect`, agentId af59ad590ed09a94f). Las manchas del fondo son círculos con opacidad.
7. Solo modo claro (`userInterfaceStyle: "light"` ya está en `app.json`). Fuentes del sistema. Emojis para íconos mientras siga la decisión 15.2.

## 2. Paleta

**Estado: APROBADA (iteración 3, paso 347, docs/003 Decisión R0 D6).** Historial: paleta de la iteración 1 (fondo `#F4F9F8`, acentos azul/violeta) **rechazada**; paleta de la iteración 2 (esmeralda `#0D6152` en bienvenida a sangre, barra de contexto `brand100` verde, mosaicos pastel con melocotón en Movimientos) **rechazada por segunda vez** por dominancia del verde. Todos los valores se verifican en la sección 3 con `node docs/design/contrast.js --check` y coinciden con el `:root` del prototipo (comprobado por script: 47 valores, 0 diferencias).

### 2.1 Marca (verde azulado del ícono) - uso restringido

| Token | Hex | Uso (lista cerrada) |
| --- | --- | --- |
| `brand800` | `#0B4A46` | Botón primario presionado; `brandInk` (nombre «CuidaTuBilletera» del encabezado, tinta del módulo Cuenta) |
| `brand700` | `#0F5F5A` | **Botón primario**, **FAB**, **tarjeta de saldo**, borde de foco, botón secundario (borde y texto), enlaces de texto. Igual al fondo del ícono (`#0F5F5A`) |
| `brand500` | `#1F8A80` | Solo decorativo: banda al 35 % sobre la tarjeta de saldo |
| `brand100` | `#D3EBF0` | Halo de foco de campos; = `cuentaTile` |
| `onBrandSoft` | `#E6F7F4` | «Saldo actual» y «Actualizando…» sobre la tarjeta de saldo |

### 2.2 Superficies y texto

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#FFFBF5` | Fondo de pantalla (casi blanco cálido) |
| `surface` | `#FFFFFF` | Tarjetas, campos, barra inferior, **barra de contexto de cuenta** |
| `segBg` | `#F3EEE6` | Pista de segmentados neutros, píldora de saldo de la barra de contexto, chip neutro elegido |
| `text` | `#17211F` | Texto principal |
| `text2` | `#4B5653` | Texto secundario, pestaña inactiva, chevrón |
| `text3` | `#5F6B68` | Ayuda y placeholder |
| `border` | `#EEE7DC` | Separadores (decorativo) |
| `borderStrong` | `#7E8A86` | Borde de campos y chips (componente, 3:1) |

### 2.3 Color por módulo (docs/007 §3.6)

| Módulo | Mosaico (`*Tile`) | Tinta (`*Ink`) | Fuerte (solo decorativo o fondo de texto blanco) | Dónde |
| --- | --- | --- | --- | --- |
| Cuenta | `cuentaTile` `#D3EBF0` | `cuentaInk` `#0B4A46` | `brand700` (tarjeta de saldo) | Píldora de la pestaña, ícono «Datos de cuenta» |
| Movimientos (ámbar) | `movTile` `#FFEDA6` | `movInk` `#5C4000` | `movStrong` `#F5A524` (decorativo) | Píldora, mosaico del título, segmentado y chips de filtro activos, ilustración vacía |
| Calendario (azul) | `calTile` `#DCEBFF` | `calInk` `#174C86` | `calStrong` `#2563C9` | Píldora, mosaico del título, **día elegido** (fondo, texto blanco) y borde de **hoy** |
| Reportes (violeta) | `repTile` `#ECE4FF` | `repInk` `#4E2DA3` | — | Píldora, mosaico del título, **segmentado Mes/Año/Rango elegido**. Ingresos/Gastos/Balance no usan violeta |
| Más / Categorías (pizarra) | `masTile` `#E3E8EF` | `masInk` `#334155` | — | Píldora, mosaico del título de Más y Categorías, ícono «Categorías» |

El ámbar sustituye al melocotón de la iteración 2 en Movimientos porque el melocotón se confundía con el coral de gasto (sección 3.2).

### 2.4 Paleta de cuentas (docs/007 §5.2.4, decisiones 14.18 y 14.19)

Seis tonos suaves, asignados por `hash(id) mod 6` (hash de cadena estilo Java: `x = x * 31 + código`, sin signo) para que el color **no cambie** al crear o archivar otras cuentas. **Excluye** el verde de ingreso, el coral de gasto y la marca (por eso no hay «menta»; el «melocotón» pasa a albaricoque, más amarillo). Colisiones permitidas: el nombre es el identificador.

| Índice | Nombre | Fondo de tarjeta (`acc*Card`) | Mosaico del ícono (`acc*Tile`) |
| --- | --- | --- | --- |
| 0 | aguamarina | `#E3F6F8` | `#BDE9EF` |
| 1 | lavanda | `#F0EBFF` | `#D9CCFF` |
| 2 | albaricoque | `#FFF0E0` | `#FFD6A8` |
| 3 | celeste | `#E7F1FF` | `#C5DBFF` |
| 4 | rosa | `#FDEAF2` | `#F8CADD` |
| 5 | limón | `#FFF6D6` | `#FFE58A` |

Ícono decorativo por palabra clave del nombre (14.19 b): «tarjeta» → 💳, «banco» → 🏦, «ahorro» → la **alcancía** (`adaptive-icon-foreground.png`, la misma del personaje), resto → 👛. El mismo mosaico (color + ícono) aparece en la barra de contexto para reconocer la cuenta en las pantallas internas (es color **de la cuenta**, no del módulo).

### 2.5 Semánticos y acento

| Token | Hex | Soft (fondo) | Texto sobre soft | Uso |
| --- | --- | --- | --- | --- |
| `income` (ingreso) | `#12804A` | `incomeSoft` `#D9F4E4` | `incomeText` `#0E6A3D` | Importes `+`, burbuja ↑ de Ingresos, «✓ Ingreso» elegido |
| `expense` (gasto, peligro) | `#D13A2F` | `expenseSoft` `#FFE1D9` | `expenseText` `#B42A20` | Importes `−`, burbuja ↓ de Gastos, «✓ Gasto» elegido, Archivar/Anular |
| `yellow` (acento) | `#FFC93C` | `yellowSoft` `#FFF1C2` | `yellowText` `#6B4E00` | Moneda del Total, subrayado de títulos, destellos, «+» del FAB; guías, avisos, «Archivada», círculo de la bienvenida |

### 2.6 Manchas decorativas del fondo

Círculos de 120-220 dp parcialmente fuera de pantalla, detrás del contenido (`pointerEvents="none"`, ocultos a accesibilidad): amarillo `#FFD966` al 35 %, melocotón `#FFB59A` al 25 %, celeste `#9CC4FF` al 25 %. Solo en Bienvenida y Mis cuentas (se desplazan con el contenido). El contraste se verificó en el peor caso de las tres apiladas (`#E6DACB`).

### 2.7 Categorías: color de la API como fondo del cuadrado

Sin cambios respecto a la iteración 2: las 11 categorías iniciales (`api/src/services/default-categories.ts`) traen `icono` y `color`; el fondo del cuadrado es `catFill = categoryFill(color)` (el color oscurecido en pasos de 1 % hasta que un glifo blanco alcance 3:1; el dato `color` de la API no se toca). La paleta del selector de `CategoriesScreen` (`CATEGORY_COLORS`, 7 colores) no coincide con ellas (decisión 15.4). Valores en la sección 3.3. Los importes usan `income`/`expense`, nunca el color de la categoría; la dona usa `catFill` con leyenda de nombre y porcentaje.

## 3. Contraste WCAG y distinguibilidad (verificado con script)

`node docs/design/contrast.js --check` (sale con código 1 si un par no cumple; salida de esta versión: **código 0**). Mínimos: 4.5:1 texto normal; 3:1 componentes y objetos gráficos. Las capas semitransparentes se evalúan **compuestas** (mezcla alfa, igual que una `View` con `opacity`) y en el **peor caso**: banda = `#156E67`, banda + círculo = `#287A73`, círculo solo = `#226C67`; manchas: amarilla `#FFEFC3`, melocotón `#FFEADE`, celeste `#E6EDF8`, las tres apiladas `#E6DACB`; círculo de la tarjeta de cuenta = fondo de la tarjeta + blanco al 45 %.

### 3.1 Pares de texto y componentes (salida del script, 82 pares)

| Par (texto sobre fondo) | Texto | Fondo | Ratio | Resultado |
| --- | --- | --- | --- | --- |
| Texto principal sobre fondo cálido | `#17211F` | `#FFFBF5` | 15.99:1 | Cumple |
| Texto principal sobre tarjeta | `#17211F` | `#FFFFFF` | 16.49:1 | Cumple |
| Texto secundario sobre tarjeta | `#4B5653` | `#FFFFFF` | 7.62:1 | Cumple |
| Texto secundario sobre fondo cálido | `#4B5653` | `#FFFBF5` | 7.39:1 | Cumple |
| Ayuda/placeholder sobre tarjeta | `#5F6B68` | `#FFFFFF` | 5.54:1 | Cumple |
| Ayuda/placeholder sobre fondo cálido | `#5F6B68` | `#FFFBF5` | 5.38:1 | Cumple |
| Título sobre manchas apiladas (peor caso) | `#17211F` | `#E6DACB` | 11.98:1 | Cumple |
| Texto secundario sobre manchas apiladas (peor caso) | `#4B5653` | `#E6DACB` | 5.54:1 | Cumple |
| brandInk (marca «CuidaTuBilletera») sobre manchas (peor caso) | `#0B4A46` | `#E6DACB` | 7.33:1 | Cumple |
| Texto secundario sobre mancha amarilla | `#4B5653` | `#FFEFC3` | 6.67:1 | Cumple |
| Texto secundario sobre mancha melocotón | `#4B5653` | `#FFEADE` | 6.56:1 | Cumple |
| Texto secundario sobre mancha celeste | `#4B5653` | `#E6EDF8` | 6.47:1 | Cumple |
| Blanco sobre brand700 (botón primario, FAB) | `#FFFFFF` | `#0F5F5A` | 7.49:1 | Cumple |
| Blanco sobre brand800 (botón presionado) | `#FFFFFF` | `#0B4A46` | 10.09:1 | Cumple |
| brand700 como enlace sobre tarjeta | `#0F5F5A` | `#FFFFFF` | 7.49:1 | Cumple |
| brand700 como enlace sobre fondo cálido | `#0F5F5A` | `#FFFBF5` | 7.26:1 | Cumple |
| Subtítulo onBrandSoft sobre brand700 | `#E6F7F4` | `#0F5F5A` | 6.77:1 | Cumple |
| Blanco sobre tarjeta de saldo: banda brand500 35 % | `#FFFFFF` | `#156E67` | 6.07:1 | Cumple |
| Blanco sobre tarjeta de saldo: banda + círculo 8 % (peor caso) | `#FFFFFF` | `#287A73` | 5.10:1 | Cumple |
| onBrandSoft sobre tarjeta de saldo (peor caso) | `#E6F7F4` | `#287A73` | 4.60:1 | Cumple |
| onBrandSoft sobre círculo 8 % sin banda | `#E6F7F4` | `#226C67` | 5.57:1 | Cumple |
| Texto oscuro sobre amarillo («+» del FAB, moneda) | `#17211F` | `#FFC93C` | 10.73:1 | Cumple |
| Segmentado neutro: text2 sobre segBg | `#4B5653` | `#F3EEE6` | 6.60:1 | Cumple |
| Segmentado neutro: texto sobre tarjeta (opción elegida) | `#17211F` | `#FFFFFF` | 16.49:1 | Cumple |
| Aviso breve: blanco sobre texto principal (snackbar) | `#FFFFFF` | `#17211F` | 16.49:1 | Cumple |
| Barra: texto (nombre, ‹ Mis cuentas) sobre superficie | `#17211F` | `#FFFFFF` | 16.49:1 | Cumple |
| Barra: texto principal sobre píldora de saldo segBg | `#17211F` | `#F3EEE6` | 14.28:1 | Cumple |
| Barra: saldo negativo expenseText sobre píldora segBg | `#B42A20` | `#F3EEE6` | 5.52:1 | Cumple |
| Barra: «Archivada» yellowText sobre yellowSoft | `#6B4E00` | `#FFF1C2` | 6.86:1 | Cumple |
| Barra: «Saldo no disponible» expenseText sobre superficie | `#B42A20` | `#FFFFFF` | 6.38:1 | Cumple |
| Ingreso (importe) sobre tarjeta | `#12804A` | `#FFFFFF` | 4.99:1 | Cumple |
| Ingreso (importe) sobre fondo cálido | `#12804A` | `#FFFBF5` | 4.84:1 | Cumple |
| incomeText sobre incomeSoft (burbuja ↑, Ingreso elegido) | `#0E6A3D` | `#D9F4E4` | 5.72:1 | Cumple |
| Gasto (importe) sobre tarjeta | `#D13A2F` | `#FFFFFF` | 4.82:1 | Cumple |
| Gasto (importe) sobre fondo cálido | `#D13A2F` | `#FFFBF5` | 4.67:1 | Cumple |
| expenseText sobre expenseSoft (burbuja ↓, Gasto elegido) | `#B42A20` | `#FFE1D9` | 5.17:1 | Cumple |
| Blanco sobre expense (Anular/Archivar sólido) | `#FFFFFF` | `#D13A2F` | 4.82:1 | Cumple |
| yellowText sobre yellowSoft (aviso, guía) | `#6B4E00` | `#FFF1C2` | 6.86:1 | Cumple |
| cuentaInk sobre cuentaTile (Cuenta) | `#0B4A46` | `#D3EBF0` | 8.12:1 | Cumple |
| movInk sobre movTile (Movimientos, ámbar) | `#5C4000` | `#FFEDA6` | 8.19:1 | Cumple |
| calInk sobre calTile (Calendario) | `#174C86` | `#DCEBFF` | 7.19:1 | Cumple |
| repInk sobre repTile (Reportes, segmentado elegido) | `#4E2DA3` | `#ECE4FF` | 7.68:1 | Cumple |
| masInk sobre masTile (Más, Categorías) | `#334155` | `#E3E8EF` | 8.41:1 | Cumple |
| cuentaInk sobre barra blanca (pestaña activa) | `#0B4A46` | `#FFFFFF` | 10.09:1 | Cumple |
| movInk sobre barra blanca (pestaña activa) | `#5C4000` | `#FFFFFF` | 9.60:1 | Cumple |
| calInk sobre barra blanca (pestaña activa) | `#174C86` | `#FFFFFF` | 8.70:1 | Cumple |
| repInk sobre barra blanca (pestaña activa) | `#4E2DA3` | `#FFFFFF` | 9.42:1 | Cumple |
| masInk sobre barra blanca (pestaña activa) | `#334155` | `#FFFFFF` | 10.35:1 | Cumple |
| Blanco sobre calStrong (día elegido del calendario) | `#FFFFFF` | `#2563C9` | 5.67:1 | Cumple |
| Pestaña inactiva (text2) sobre barra blanca | `#4B5653` | `#FFFFFF` | 7.62:1 | Cumple |
| Borde de campo sobre tarjeta (componente 3:1) | `#7E8A86` | `#FFFFFF` | 3.58:1 | Cumple 3:1 |
| Borde de campo sobre fondo cálido (componente 3:1) | `#7E8A86` | `#FFFBF5` | 3.47:1 | Cumple 3:1 |
| Borde de foco brand700 sobre tarjeta (componente 3:1) | `#0F5F5A` | `#FFFFFF` | 7.49:1 | Cumple 3:1 |
| Borde Gasto elegido (expense) sobre expenseSoft (3:1) | `#D13A2F` | `#FFE1D9` | 3.91:1 | Cumple 3:1 |
| Borde Ingreso elegido (income) sobre incomeSoft (3:1) | `#12804A` | `#D9F4E4` | 4.28:1 | Cumple 3:1 |
| Borde «hoy» calStrong sobre tarjeta (3:1) | `#2563C9` | `#FFFFFF` | 5.67:1 | Cumple 3:1 |
| Borde chip activo movInk sobre movTile (3:1) | `#5C4000` | `#FFEDA6` | 8.19:1 | Cumple 3:1 |
| Botón primario brand700 sobre fondo cálido (componente 3:1) | `#0F5F5A` | `#FFFBF5` | 7.26:1 | Cumple 3:1 |
| Cuenta aguamarina: texto principal sobre tarjeta | `#17211F` | `#E3F6F8` | 14.76:1 | Cumple |
| Cuenta aguamarina: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#E3F6F8` | 6.82:1 | Cumple |
| Cuenta aguamarina: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#E3F6F8` | 5.71:1 | Cumple |
| Cuenta aguamarina: text2 sobre círculo decorativo 45 % | `#4B5653` | `#F0FAFB` | 7.18:1 | Cumple |
| Cuenta lavanda: texto principal sobre tarjeta | `#17211F` | `#F0EBFF` | 14.16:1 | Cumple |
| Cuenta lavanda: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#F0EBFF` | 6.54:1 | Cumple |
| Cuenta lavanda: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#F0EBFF` | 5.48:1 | Cumple |
| Cuenta lavanda: text2 sobre círculo decorativo 45 % | `#4B5653` | `#F7F4FF` | 7.02:1 | Cumple |
| Cuenta albaricoque: texto principal sobre tarjeta | `#17211F` | `#FFF0E0` | 14.75:1 | Cumple |
| Cuenta albaricoque: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#FFF0E0` | 6.82:1 | Cumple |
| Cuenta albaricoque: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#FFF0E0` | 5.71:1 | Cumple |
| Cuenta albaricoque: text2 sobre círculo decorativo 45 % | `#4B5653` | `#FFF7EE` | 7.18:1 | Cumple |
| Cuenta celeste: texto principal sobre tarjeta | `#17211F` | `#E7F1FF` | 14.46:1 | Cumple |
| Cuenta celeste: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#E7F1FF` | 6.69:1 | Cumple |
| Cuenta celeste: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#E7F1FF` | 5.60:1 | Cumple |
| Cuenta celeste: text2 sobre círculo decorativo 45 % | `#4B5653` | `#F2F7FF` | 7.09:1 | Cumple |
| Cuenta rosa: texto principal sobre tarjeta | `#17211F` | `#FDEAF2` | 14.31:1 | Cumple |
| Cuenta rosa: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#FDEAF2` | 6.62:1 | Cumple |
| Cuenta rosa: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#FDEAF2` | 5.54:1 | Cumple |
| Cuenta rosa: text2 sobre círculo decorativo 45 % | `#4B5653` | `#FEF3F8` | 7.04:1 | Cumple |
| Cuenta limón: texto principal sobre tarjeta | `#17211F` | `#FFF6D6` | 15.23:1 | Cumple |
| Cuenta limón: text2 («Saldo actual», ›) sobre tarjeta | `#4B5653` | `#FFF6D6` | 7.04:1 | Cumple |
| Cuenta limón: saldo negativo expenseText sobre tarjeta | `#B42A20` | `#FFF6D6` | 5.89:1 | Cumple |
| Cuenta limón: text2 sobre círculo decorativo 45 % | `#4B5653` | `#FFFAE8` | 7.29:1 | Cumple |

Resultado (sección 3.1, iteración 3): los 82 pares cumplen; R4 añade 16 en 3.4. **Mínimo de texto 4.60:1** («Saldo actual» `onBrandSoft` sobre la tarjeta de saldo en el peor caso de banda + círculo); **mínimo de componente 3.47:1** (borde de campo sobre fondo cálido). Gasto sobre fondo cálido: 4.67:1.

### 3.2 Distinguibilidad: módulo frente a semántica de dinero (docs/007 §3.6)

Simulación de protanopia y deuteranopia (Viénot, Brettel y Mollon 1999) y diferencia ΔE76 en CIELAB. Umbral orientativo ΔE ≥ 20.

| Par (distinguibilidad) | A | B | ΔE normal | ΔE protanopia | ΔE deuteranopia | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| Marca brand700 frente a ingreso income | `#0F5F5A` | `#12804A` | 33.0 | 29.6 | 27.8 | Distinto |
| Mosaico Cuenta cuentaTile frente a incomeSoft | `#D3EBF0` | `#D9F4E4` | 11.2 | 10.9 | 10.6 | Cercano: apoyarse en texto/icono |
| Ámbar movStrong frente a gasto expense | `#F5A524` | `#D13A2F` | 54.8 | 51.2 | 35.7 | Distinto |
| Mosaico ámbar movTile frente a expenseSoft | `#FFEDA6` | `#FFE1D9` | 31.8 | 31.2 | 29.8 | Distinto |
| Tinta ámbar movInk frente a expenseText | `#5C4000` | `#B42A20` | 48.7 | 12.2 | 16.4 | Cercano: apoyarse en texto/icono |

Lectura: la marca y el verde de ingreso, y el ámbar fuerte y el coral, se distinguen también con daltonismo. Los tintes muy claros (mosaico Cuenta frente a `incomeSoft`) y las tintas oscuras ámbar/coral quedan «cercanos» con deuteranopia: por eso nunca van solos (la píldora de pestaña lleva ícono y etiqueta; la burbuja de Ingresos lleva «↑» y la palabra; el importe lleva signo). Si en la prueba con usuarios se confunden, aplica la salida prevista en docs/007 §3.6: el módulo cede y usa su tono solo en la píldora de la pestaña.

### 3.3 Categorías (glifo = objeto gráfico, mínimo 3:1)

| Categoría | Color API | Blanco sobre API | Glifo blanco directo | `catFill` | Blanco sobre `catFill` | Oscuro `#17211F` sobre API |
| --- | --- | --- | --- | --- | --- | --- |
| Alimentación | `#F97316` | 2.80:1 | No | `#EF6E15` (−4 %) | 3.04:1 | 5.88:1 |
| Transporte | `#3B82F6` | 3.68:1 | Sí | `#3B82F6` | 3.68:1 | 4.48:1 |
| Servicios básicos | `#EAB308` | 1.92:1 | No | `#B98D06` (−21 %) | 3.05:1 | 8.60:1 |
| Salud | `#EF4444` | 3.76:1 | Sí | `#EF4444` | 3.76:1 | 4.38:1 |
| Educación | `#8B5CF6` | 4.23:1 | Sí | `#8B5CF6` | 4.23:1 | 3.89:1 |
| Hogar | `#14B8A6` | 2.49:1 | No | `#12A695` (−10 %) | 3.04:1 | 6.62:1 |
| Entretenimiento | `#EC4899` | 3.53:1 | Sí | `#EC4899` | 3.53:1 | 4.67:1 |
| Otros gastos | `#6B7280` | 4.83:1 | Sí | `#6B7280` | 4.83:1 | 3.41:1 |
| Sueldo | `#22C55E` | 2.28:1 | No | `#1DA951` (−14 %) | 3.07:1 | 7.24:1 |
| Ventas | `#06B6D4` | 2.43:1 | No | `#05A2BD` (−11 %) | 3.04:1 | 6.79:1 |
| Otros ingresos | `#84CC16` | 1.98:1 | No | `#6AA312` (−20 %) | 3.06:1 | 8.35:1 |

### 3.4 R4: pares nuevos y colores del selector de Categorías

El script suma 16 pares de R4 (98 pares en total, todos cumplen; mínimos: texto 4.60:1, componente 3.47:1): importes de fila `incomeText` 6.67:1 y `expenseText` 6.38:1 sobre tarjeta; cifras de celda del calendario con los mismos colores; anillo «hoy + elegida» `calTile` sobre `calStrong` 4.69:1 (3:1); barras de la serie `income` 4.99:1 y `expense` 4.82:1 sobre tarjeta (3:1); fila archivada `text` 14.52:1 y `text2` 6.71:1 sobre `archivedRow`; insignia «Archivada» 6.86:1; placeholder de la vista previa 5.38:1; chip de filtro activo `movInk` sobre `movTile` 8.19:1 y su borde 9.60:1 (3:1); error de rango sobre `bg` 6.19:1; `ErrorBox` con fondo 5.17:1; anillo del color elegido (`text` sobre tarjeta) 16.49:1.

Siete colores del selector de `CategoriesScreen` (`catFill` = círculo; «✓» blanco y círculo sobre tarjeta, ambos objetos gráficos de 3:1):

| Color | Valor API | Blanco sobre valor | `catFill` | Blanco sobre `catFill` |
| --- | --- | --- | --- | --- |
| Rojo | `#E53935` | 4.23:1 | `#E53935` | 4.23:1 |
| Naranja | `#FB8C00` | 2.37:1 | `#DD7B00` (−12 %) | 3.04:1 |
| Amarillo | `#FDD835` | 1.40:1 | `#AC9324` (−32 %) | 3.02:1 |
| Verde | `#43A047` | 3.30:1 | `#43A047` | 3.30:1 |
| Azul | `#1E88E5` | 3.68:1 | `#1E88E5` | 3.68:1 |
| Morado | `#8E24AA` | 7.04:1 | `#8E24AA` | 7.04:1 |
| Gris | `#757575` | 4.61:1 | `#757575` | 4.61:1 |

Límites honestos de R4: la barra de categoría contra su pista `border` queda entre 2.44 y 4.06:1 (la barra es redundante con el texto); `income` y `expense` son casi iguales en luminosidad (1.03:1), por lo que las barras de la serie se distinguen sin color por orden, signo y leyenda; el contraste de los emojis de `ModuleTile` no se calcula.

Limitaciones honestas:

1. Márgenes justos: `onBrandSoft` en el peor caso de la tarjeta de saldo (4.60), `expense` sobre `bg` (4.67) y `catFill` (3.04). No aclarar esos tokens sin volver a ejecutar el script.
2. El texto **no** se coloca sobre ilustraciones (alcancía del encabezado, de la tarjeta de saldo y de la bienvenida tienen zona reservada); su contraste no se calcula porque no son fondo de texto.
3. Los emojis multicolor no tienen contraste calculable; el nombre siempre acompaña al ícono.
4. Las sombras (`elevation`) no entran en los cálculos.

## 4. Tipografía

Solo fuentes del sistema (Roboto en Android): no se agrega ninguna fuente. **Decisión pendiente 15.1:** una fuente de marca (por ejemplo vía `expo-font`, dependencia nueva y recurso embebido) no se propone ahora. Escala (valores `sp`; respetar el tamaño de fuente del sistema, sin `allowFontScaling={false}`):

| Estilo | Tamaño / interlínea | Peso | Uso |
| --- | --- | --- | --- |
| `amountXl` | 34 / 40 | 800 | Saldo actual |
| `title` | 24 / 30 | 800 | Título de pantalla |
| `h2` | 18 / 24 | 700 | Secciones, títulos de diálogo |
| `body` | 15 / 22 | 400-600 | Texto general |
| `button` | 16 / 20 | 700 | Botones |
| `small` | 13 / 18 | 400-700 | Etiquetas y ayudas |
| `tab` | 11.5 / 14 | 700 | Pestañas |

Los importes usan cifras tabulares (`fontVariant: ['tabular-nums']`). Con fuente al 200 % se usan alturas mínimas y saltos de línea, nunca alturas fijas. Esto sustituye los títulos de 22/24/28 hoy mezclados (hallazgo H4 de docs/007).

Estilos nuevos de esta iteración (Mis cuentas): `rootTitle` 26/32 800 («Mis cuentas», con subrayado amarillo de 40 × 5); `greeting` 16/22 600 `text2` («Hola, Ana»); `brandLabel` 14 800 `brandInk` («CuidaTuBilletera»); `totalAmount` 24/30 800; `accountName` 17/22 800; `accountBalance` 22/28 800 cifras tabulares.

## 5. Espaciado, radios y sombras

- Espaciado (escala de 4): 4, 8, 12, 16, 24, 32. Margen lateral de pantalla 16 (20 con ancho ≥ 400 dp, docs/007 §5.2.5).
- Radios: `sm` 8 (celdas), `md` 12 (botones, campos, filas de categoría), `lg` 16 (tarjetas, botón primario alto), `accountCard` 20 (tarjetas de cuenta), `xl` 24 (tarjeta de saldo, diálogos, hoja de perfil), `pill` 999 (chips, segmentados, FAB).
- Sombras (Android `elevation`, más `shadow*` para compatibilidad): `sh1` tarjeta = elevation 1; `sh2` FAB, tarjeta de saldo y diálogos = elevation 4. No usar más niveles.
- Objetivo táctil mínimo 48 dp de **zona efectiva**; separación mínima 8 dp (docs/007 §10). El aspecto puede ser menor solo en dos casos aprobados (paso 346): chips de filtro de 36 dp con `hitSlop` 6 dp arriba y abajo (P-1) y celdas de día del calendario de 52 dp de alto y ≈ 44,3 dp de ancho a 360 dp (P-3, única excepción al ancho de 48 dp). Ningún otro control baja de 48 dp.


## 6. Componentes visuales

Técnica común de profundidad (sin dependencias): contenedor con `overflow: 'hidden'` y color sólido; dentro, `View` absolutas decorativas (`pointerEvents="none"`, `importantForAccessibility="no-hide-descendants"`). Se usa en la tarjeta de saldo (banda `brand500` al 35 % girada −16° + círculos blancos al 8 %), en las tarjetas de cuenta (círculo blanco al 45 % arriba a la derecha) y en los fondos de Bienvenida y Mis cuentas (manchas, 2.6).

### 6.1 Encabezado de Mis cuentas (docs/007 §5.2.2)

Fondo **claro** (`bg` + manchas), sin franja verde. Fila superior de 48 dp: «CuidaTuBilletera» (`brandLabel`) a la izquierda y **avatar** a la derecha (círculo `surface` de 40 dp con borde 1.5 `border`, `sh1`, inicial 16/800 `text`; objetivo táctil 48 dp; etiqueta «Tu perfil y sesión»). Debajo, saludo + título con subrayado amarillo a la izquierda y la **alcancía** a la derecha, alineada abajo: caja de 72 dp (96 dp con ancho ≥ 400 dp) y la imagen ampliada ×1.4 dentro de la caja para compensar el margen transparente del PNG (el arte visible queda en ~62 dp / ~84 dp); un destello amarillo. Con fuente ≥ 130 % la caja baja a 48 dp; con fuente ≥ 175 % o ancho ≤ 340 dp se oculta (docs/007 §5.2.5).

**Hoja de perfil** (14.17): hoja inferior `surface`, radio 24 arriba, asa de 40 × 4; avatar de 48 dp en `yellowSoft`, nombre 17/800, correo `small`; [Cerrar sesión] `secondary` a todo el ancho y [Cerrar] `ghost`. Tocar fuera la cierra.

### 6.2 Resumen «Total en tus cuentas» (14.16)

Tarjeta `surface`, radio 16, `sh1`, relleno 12/16. A la izquierda, **moneda** amarilla de 40 dp con «$» `text` (10.73:1). Texto: «Total en tus cuentas» `small` 700, importe `totalAmount` (`expenseText` y «-» si es negativo), «Suma de los saldos de {n} cuentas» y, si hay archivadas, «No incluye cuentas archivadas» en línea propia. Superficie neutra: **sin color fuerte**. Solo con ≥ 2 cuentas activas.

### 6.3 Tarjeta de cuenta (`AccountCard`, docs/007 §5.2.4)

Toda la tarjeta es un botón: fondo `acc*Card` (2.4), radio 20, `sh1`, alto mínimo 88 dp (92 con ancho ≥ 400; es mínimo, la tarjeta crece con el contenido y la fuente), relleno 12/14/12/12, separación 10 dp. Capas: círculo blanco de 110 dp al 45 % asomando arriba a la derecha. Izquierda: **mosaico de 52 dp** radio 16 en `acc*Tile` con el ícono de 28 dp (o la alcancía recortada al mosaico). Centro: nombre `accountName` (una línea con elipsis: truncado intencional, ver 6.12; el nombre completo va en `accessibilityLabel` y se ve entero en Datos de cuenta), «Saldo actual» `small`, saldo `accountBalance` (`expenseText` y «-» si es negativo; el fondo no cambia). Derecha: chevrón «›» `text2` 18/800 dentro de un círculo blanco al 70 % de 28 dp. Presionada: escala 0.98. Archivada (lista desplegada): fondo `#F4F0EA`, borde `border`, sin sombra ni color de cuenta, etiqueta «Archivada», [Ver] `ghost` y [Desarchivar] `secondary`. Fila «▸ Archivadas (n)» 48 dp, 15/700 `text2`, sin relleno.

### 6.4 Tarjeta de saldo (`BalanceCard`) - única superficie fuerte

Fondo `brand700`, radio 24, `sh2`, relleno 20/20/22, alto mínimo 132. Capas: banda arriba a la derecha, círculo de 150 dp abajo a la derecha y de 60 dp arriba a la izquierda, destellos amarillos (12 × 4, radio 2, ±35°). Alcancía de 104 dp abajo a la derecha. Texto en columna con `paddingRight: 96`: «Saldo actual» 14/600 `onBrandSoft`, saldo `amountXl` blanco. Fuente > 130 % o ancho ≤ 340 dp: sin ilustración. Recargando: último valor + «Actualizando…» (`busy`). Error: recuadro blanco «Saldo no disponible» `expenseText` + [Reintentar] 48 dp. Nunca «$0.00» inventado.

### 6.5 Mosaicos de resumen (`SummaryTile`)

**Claros** (docs/007 §5.4): `surface`, radio 16, `sh1`, relleno 12/16. Etiqueta 13/700 `text2` con **burbuja** cuadrada de 24 dp radio 8: «↑» `incomeText` sobre `incomeSoft` (Ingresos) o «↓» `expenseText` sobre `expenseSoft` (Gastos). Cifra 19/800 con signo en `income` / `expense`. Neto (Calendario) y Balance (Reportes): cifra en `text`, sin color de módulo.

### 6.6 Botones, FAB y navegación de mes

- Alto mínimo 48 (52 y radio 16 en «+ Nueva cuenta» y «Crear mi primera cuenta»), radio 12, texto 16/700. `primary`: `brand700`, texto blanco (presionado `brand800`). `secondary`: `surface`, borde 2 y texto `brand700`. `danger`: `surface`, borde 2 `expense`, texto `expenseText`. `dangerSolid`: `expense` y texto blanco (solo confirmaciones). `ghost`: solo texto `text`. Deshabilitado: opacidad 0.5 + `disabled`. Cargando: «Guardando…» y bloqueado. **Una sola primaria por pantalla.**
- **FAB «+ Nuevo movimiento»**: píldora `brand700` de 56 dp, texto blanco 16/800, círculo `yellow` de 40 dp con «+» en `text`; `sh2`. Mismo color en Cuenta, Movimientos y Calendario. Deshabilitado (archivada): opacidad 0.5 + nota `yellowSoft` «Cuenta archivada: no admite movimientos nuevos».
- Flechas de mes (‹ ›): círculo `surface` de 32 dp con `sh1`, glifo `text` 800, objetivo 48 dp.
- Enlaces de texto («Ver todo ›»): `brand700` 700 (texto, no superficie).

### 6.7 Campos, chips y segmentados

- Campos: alto 48, radio 12, borde 1.5 `borderStrong`, fondo blanco, etiqueta 14/700, ayuda `text2` 13, error `expenseText` (`role=alert`). Foco: borde 2 `brand700` + halo 3 dp `brand100`.
- Chips (48 dp; **P-1, aprobada:** solo los chips de filtro `.chip.sm` se ven de 36 dp con zona táctil efectiva de 48 dp: `hitSlop={{ top: 6, bottom: 6 }}`, filas separadas 12 dp (36 + 12 = 48 de paso, sin solapar zonas), 8 dp entre chips de una fila; `hitSlop` solo agranda la zona, no cambia el aspecto; docs/007 §10): píldora, borde 1.5 `borderStrong`, `surface`. Elegido neutro: `segBg`, borde `text`, «✓». Elegido en Movimientos: `movTile`, borde y texto `movInk`. Elegido en Nuevo movimiento: el del tipo (`expenseSoft`/`expense`/`expenseText` o `incomeSoft`/`income`/`incomeText`). Filtro activo con «✕».
- Segmentado neutro (Todos/Gastos/Ingresos de la pestaña Cuenta; **P-2, aprobada:** todas las opciones de segmentado, incluidas Mes/Año/Rango y Tipo, miden 48 dp de alto y reparten el ancho por igual; la pista mide 56 dp con su relleno de 4): pista `segBg`, opción elegida `surface` + `text` 800 + `sh1` + «✓». En Reportes, la elegida es `repTile` + `repInk`; en el filtro de Movimientos, `movTile` + `movInk`.
- **Tipo Gasto/Ingreso** (Nuevo movimiento, Categorías): dos botones separados de 48 dp, radio 12, `surface` con borde `border`. «✓ Gasto» = `expenseSoft`, borde 2 `expense`, texto `expenseText`; «✓ Ingreso» = `incomeSoft`, borde 2 `income`, texto `incomeText` (el «segmentado coral/menta» del póster). La categoría elegida usa el mismo tinte y borde del tipo.
- **Selector de categorías de Nuevo movimiento (D2, aprobada):** cuadrícula de **2 columnas** (`minmax(0, 1fr)`, separación 8 dp), cada opción con alto mínimo **56 dp que crece** con el contenido (nunca alto fijo; el mínimo de docs/007 §10 es 48), radio 12, borde 2 `border` (elegida: tinte y borde del tipo, nombre 800, «✓»), relleno horizontal 8, `CategoryIcon` de 32 dp a la izquierda y el **nombre a la derecha en hasta DOS líneas** (14/18, `min-width: 0`, salto en palabras largas). Los nombres habituales (Alimentación, Servicios básicos, Entretenimiento, Otros gastos…) **no se truncan con elipsis**; solo un nombre propio muy largo se corta en la segunda línea (6.12). Probado a 360 y 412 dp y con fuente grande.

### 6.8 Barra inferior

`surface`, borde superior `border`, sombra suave, 5 pestañas, etiquetas siempre visibles. **D1, aprobada:** **ícono encima de la etiqueta COMPLETA** («Cuenta», «Movimientos», «Calendario», «Reportes», «Más»), sin solapamientos ni recortes a 360 y 412 dp. Reparto **no igualitario**: cada pestaña `flex: 1 1 auto` (ancho según su contenido), `minWidth: 48`, relleno horizontal 2 dp, columna ícono-etiqueta con separación 2 dp. Alto de la barra **62 dp** como mínimo (crece si la etiqueta pasa a dos líneas). Etiqueta `tab` 11,5/14 700 (no se reduce a 11; respeta el tamaño de fuente del sistema). Zona táctil ≥ 48 dp de ancho y alto. Inactiva: ícono y texto `text2`. Activa: **píldora compacta de 10 dp de relleno horizontal** (3 dp vertical; antes 16) en el `*Tile` del módulo, ícono y texto en su `*Ink` 800, `selected`, `role=tab` dentro de `tablist`. Con fuente grande la etiqueta puede pasar a dos líneas; no se trunca. Criterio de aceptación: la auditoría no registra «pestañas solapadas».

### 6.9 Barra de contexto de cuenta (`AccountContextBar`) - neutra

Anatomía, datos y accesibilidad en docs/007 §3.5; aquí solo el aspecto. **Cambio de esta iteración:** deja de ser `brand100` (verde) y pasa a **`surface` blanca** con borde inferior `border` y sombra muy suave, **idéntica en todas las pantallas internas** y sin color de módulo (docs/007 §3.6). La barra de estado del sistema usa `surface` en esas pantallas.

| Parte | Estilo |
| --- | --- |
| Contenedor | `surface`, alto mín. 56, relleno 4-6 / 4-12, borde inferior 1 `border`. |
| «‹ Mis cuentas» | Botón 48 × 48 mín., 14/800 `text`; separador vertical 1 dp `border`. |
| Ícono | Mosaico de 30 dp radio 10 con el **color y el ícono de la cuenta** (2.4). |
| Nombre | 15/800 `text`, una línea, elipsis, `flexShrink: 1`. |
| Saldo | Píldora `segBg`, 14/800 `text`, cifras tabulares, `flexShrink: 0`. Negativo: `expenseText` y «-». Omitido en la pestaña Cuenta. |
| Recargando | Indicador de 12 dp (`text2` sobre `#D9D2C6`), `busy`; se mantiene el último saldo. |
| Error | «Saldo no disponible» 13/700 `expenseText` + «Reintentar» subrayado 48 dp. |
| Archivada | Etiqueta «Archivada» 12/800 `yellowText` sobre `yellowSoft`, borde `#E8C560`. |

Solo lectura (Categorías, Historial desde Reportes): igual, con la salida propia. Compacta (Nuevo/Editar movimiento): una línea de 36 dp, `surface`, «Efectivo · $1,876.00», sin ícono ni acción. Estrecha (≤ 340 dp) o fuente 200 %: dos filas. Selector rápido (14.14): «▾» `text` y hoja como 6.1; no simulado.

### 6.10 Calendario, gráficos y estados

- Calendario (aprobado 4.1, solo color): cuadrícula de 7 columnas con separación de 3 dp; celdas de **52 dp de alto**, ancho ≈ 44,3 dp a 360 dp y ≥ 48 dp con ancho de pantalla ≥ ≈ 400 dp (**P-3, aprobada**: única excepción al mínimo de 48 dp; condiciones en docs/007 §10: ≥ 44 dp de ancho, zonas sin superponer, cumple WCAG 2.5.8). Cifra de día 13/700 e importe de celda 10/800 en una columna centrada, sin cambiar de tamaño para ganar espacio. Celdas blancas radio 8; **hoy** con borde 2 `calStrong`; **día elegido** `calStrong` con texto blanco (5.67:1); importes de celda con signo en `incomeText`/`expenseText`.
- Dona (15.3) con `catFill` y leyenda.
- Guía y aviso: `yellowSoft`/`yellowText`. Error: caja `expenseSoft` con [Reintentar]. Snackbar: fondo `text`, texto blanco.

### 6.11 Bienvenida

**Sin verde a sangre** (antes 89-93 % de la pantalla). Fondo `bg` con tres manchas; alcancía de 250 dp (arte visible ~155 dp) sobre un círculo `yellowSoft` de 200 dp con dos destellos; «CuidaTuBilletera» 28/34 800 `text` con subrayado amarillo de 44 × 5; texto `text2` 16/24; botón Google blanco con borde `border`, sombra y «G» azul; aviso de privacidad `text2` 13. El ícono verde de la app sigue siendo el del lanzador (sección 13).

### 6.12 Texto truncado y accesibilidad de texto (docs/007 §10)

- **Truncado intencional:** solo nombres propios del usuario que pueden ser arbitrariamente largos (nombre de cuenta en `AccountCard` y barra de contexto, nota de un movimiento, saludo): una línea con elipsis (`numberOfLines={1}`, `ellipsizeMode="tail"`, `flexShrink: 1`) o, en notas, hasta dos líneas. El **nombre completo** va en `accessibilityLabel` (prototipo: `aria-label` y `title`) y se ve entero en el detalle o la edición. Los importes y el saldo **nunca** se truncan (`flexShrink: 0`).
- **Nunca se trunca con elipsis:** nombres de categorías habituales, etiquetas de pestañas, botones, importes y mensajes de error. Usan hasta dos líneas o saltan de línea; las alturas son mínimas, no fijas.
- Escala `sp` sin `allowFontScaling={false}`; probar al 200 % sin truncar el saldo ni Guardar (docs/007 §10). La etiqueta de pestaña conserva 11,5 sp.
- El color no es el único portador de significado (regla 3 de la sección 1) y los pares de texto de la sección 3 no cambian: esta sincronización no introduce colores.

### 6.13 Formulario de movimiento y Crear cuenta (R3; implementa docs/007 §5.5.1)

Solo tokens existentes, con tres tokens **no cromáticos** nuevos: `typography.amountInput` = 28/34 800 (cifras tabulares), `sizes.dateCell` = 48 y `sizes.categoryIcon` = 32. Ningún color nuevo. Fondo `bg`; el formulario no usa color de módulo: manda el tipo (regla 5 de la sección 1). Etiquetas de sección 14/700 `text` (`brandLabel`), separación 16 dp entre grupos y 8 dp entre etiqueta y control. Orden: Tipo, Categoría, Monto, Fecha, Detalle; pie fijo.

1. **Tipo (solo Nuevo).** Dos botones separados de 48 dp, ancho igual, hueco 8, radio 12, grupo `radiogroup` «Tipo». Reposo: `surface`, borde 1.5 `borderStrong` (3.58:1 como componente), texto `text2` 15/600. Elegido: «✓ Gasto» = `expenseSoft`, borde 2 `expense` (3.91:1), texto `expenseText` 800 (5.17:1); «✓ Ingreso» = `incomeSoft`, borde 2 `income` (4.28:1), texto `incomeText` 800 (5.72:1). No usar `Segmented` neutro ni `Chip`: llevan el tinte del tipo. Editar: fila de solo lectura (sin borde de campo) con el tinte del tipo, «Gasto»/«Ingreso» y la categoría con su `CategoryIcon`; sin aspecto de control.
2. **Rejilla de categorías (solo Nuevo).** 2 columnas iguales (`flex: 1`, separación 8 dp). Opción: alto mínimo 56 (`categoryOptionMin`, crece, nunca fijo), radio 12, relleno horizontal 8 y vertical 8, `CategoryIcon` de 32 dp (radio 10, fondo `categoryFill(color)`, glifo de `categoryGlyph`, blanco en los glifos de texto) a la izquierda, 8 dp, nombre 14/18 en hasta **2 líneas** (`numberOfLines={2}`, `flexShrink: 1`, sin elipsis para nombres habituales). Reposo: `surface`, borde 2 `border`, nombre `text` 600. Elegida: fondo y borde 2 del tipo (`expenseSoft`/`expense` o `incomeSoft`/`income`), nombre 800 en `expenseText`/`incomeText`, «✓» delante del nombre (`importantForAccessibility="no"`). Presionada: opacidad 0.85. Deshabilitada (`busy`): opacidad 0.5. Rol `radio` dentro de `radiogroup` «Categoría», etiqueta «Categoría {nombre}». Cargando: `ActivityIndicator`; error: `ErrorBox`; vacío: texto `text2` + [Ir a Categorías] `secondary`. El color de la categoría solo vive en el cuadrado del ícono, nunca en el importe.
3. **Monto.** Fila de 56 dp (más grande que un campo normal por ser el dato principal): `surface`, radio 12, borde 1.5 `borderStrong`; prefijo «$» (o «-$» en saldo en contra) `amountInput` 800 `text2`, `accessibilityElementsHidden`; campo con `amountInput` `text`, `fontVariant tabular-nums`, `flex: 1`, relleno horizontal 12; placeholder «0.00» en `text3`. Teclado `decimal-pad`, sin `autoFocus`. Ayuda opcional `small` `text2` bajo el campo. Error: ver punto 8. El tamaño de fuente escala con el sistema; el alto crece (`minHeight` 56).
4. **Fecha.** Fila de 3 chips de 48 dp (Hoy, Ayer, «Otra fecha…»), hueco 8, que envuelven a otra línea con fuente grande. Chip = el `Chip` existente de 48 dp; elegido con el **tinte del tipo** (como la categoría) y «✓»; los de Nuevo-Ingreso en verde suave, los de Gasto en coral suave; en Editar con tipo fijado igual. Si la fecha no es hoy ni ayer, el tercer chip muestra la fecha (`formatDateEs`) como elegido; si no, dice «Otra fecha…» y lleva «▾» en `text2`. Etiqueta accesible «Fecha: {fecha completa}».
   **Hoja del selector** (`Sheet` existente, sección 6.1; velo `depth.scrim`): `surface`, radio 24 arriba, asa 40 × 4, relleno horizontal 8, título «Elige una fecha» `h2`. Cabecera del mes: «‹» y «›» como botones de 48 × 48 (círculo `surface` 32 con `sh1`, glifo `text` 800 dentro de la zona de 48) y título del mes centrado (`monthTitle`, `h2`, 18/24 800; a cada lado, misma anchura). Con el límite 2000/2100, la flecha afectada queda `disabled` (opacidad 0.4). Fila de iniciales L M X J V S D `small` 700 `text2`. Cuadrícula de 7 columnas iguales **sin hueco entre celdas**: a 360 dp, (360 − 16) / 7 = 49,1 dp por celda, así que todas las celdas cumplen 48 × 48 (no se usa la excepción P-3). Cada celda: zona de 48 × 48 con un círculo visual de 40 dp y la cifra 15/22 600 `text`. **Día elegido**: círculo de 40 dp en `expense` o `income` (según el tipo del formulario) con la cifra blanca 800 (4.82:1 / 4.99:1). **Hoy**: círculo con borde 2 `text` y fondo transparente (si además es el día elegido, el relleno manda y el borde se omite); accesible «hoy». **Fuera de rango** (antes de 2000-01-01 o después de 2100-12-31; solo se da en los extremos): cifra `text3` con opacidad 0.4, `disabled`, sin acción. Fuera del mes: celda vacía. Fechas futuras permitidas. Tocar un día elige y cierra; Atrás o tocar el velo cierran sin cambio. Pie de la hoja: [Cerrar] `ghost` 48 dp.
5. **Detalle (opcional).** Campo multilínea de `minHeight` 96 (3 líneas; crece), radio 12, borde 1.5 `borderStrong`, relleno 12, texto `body`, `textAlignVertical: 'top'`, `maxLength` 500, placeholder «Detalle» `text3`. Contador «0/500» alineado a la derecha, `small` `text3` (5.54:1 sobre `surface`, 5.38:1 sobre `bg`): neutro hasta 450; desde 450 pasa a `text` 700 (el límite es duro por `maxLength`, no es error, así que no se usa rojo).
6. **Pie fijo** (hermano del `ScrollView`, no descendiente; `testID` propio). Fondo `surface`, borde superior 1 `border`, relleno 12/16 más el margen inferior de sistema, `sh1` hacia arriba. Contenido en columna con hueco 8: (a) error de envío `expenseText` 14/700 con rol `alert` si existe; (b) **Guardar** `primary` + `tall` (52 dp, radio 16, texto 16/700 blanco sobre `brand700` 7.49:1), ancho completo, texto «Guardar gasto» / «Guardar ingreso» / «Guardar cambios»; (c) **Cancelar** `ghost` 48 dp, ancho completo debajo. Variantes de Guardar: normal; presionado `brand800`; **«Guardando…»** con la prop `busy` (fondo `brand700` intacto, opacidad 0.5 por estado inactivo, `accessibilityState busy+disabled`); **deshabilitado** (opacidad 0.5, solo durante guardado: no se deshabilita Guardar por formulario incompleto, para poder mostrar los errores). Cancelar deshabilitado con `busy`. En Editar, «Anular movimiento» (`danger`) va **dentro del scroll**, al final, separado 24 dp, no en el pie. Con teclado abierto el pie queda sobre el teclado; con fuente 200 % el contenido se desplaza y el pie no supera ~35 % de la altura.
7. **Interruptor «Es un saldo en contra (debo dinero)» (solo Crear cuenta).** No es un `Switch` nativo: es un `Chip` de 48 dp a todo el ancho con `accessibilityRole="checkbox"` y `accessibilityState.checked`, bajo el campo Saldo inicial, 8 dp de separación. Apagado: `surface`, borde 1.5 `borderStrong`, texto `text` 15/600, caja «☐» a la izquierda. Encendido: **tono neutro** (`segBg`, borde 1.5 `text`, «✓», texto 800), nunca coral ni verde (esos colores significan gasto e ingreso). El prefijo del campo pasa de «$» a «-$». Texto de ayuda bajo el campo `small` `text2`: «Déjalo vacío si empiezas en 0». El saldo en contra no escribe «-» en el campo.
8. **Foco y error.** Foco (campo de texto, monto, detalle): borde 2 `brand700` más halo de 3 dp `brand100` (en RN, `borderWidth` 2 y un contenedor con `padding` 3 y fondo `brand100`, o `shadow` equivalente; sin saltos de diseño: reservar 3 dp siempre). Error de campo: borde 2 `expense` (4.82:1 sobre `surface`), mensaje debajo en `expenseText` 13/700 (6.38:1 sobre `surface`, 6.19:1 sobre `bg`) con prefijo «⚠ » decorativo (oculto), rol `alert`, `accessibilityLiveRegion="polite"`, 4 dp bajo el control. Error en la rejilla: mensaje bajo la rejilla, y el borde de las opciones no cambia. Error en Fecha: bajo la fila de chips. El error se borra al editar el campo. Foco y error juntos: gana el error en el color del borde; el halo se conserva. El texto del error nunca depende solo del color (palabras y «⚠»). Campos deshabilitados por `busy`: `editable={false}`, fondo `segBg`, texto `text` (sin bajar opacidad al texto, para no perder lectura).
9. **Encabezado y barra compacta.** Fila de 56 dp con título 24/30 800 («Nuevo movimiento» / «Editar movimiento» / «Nueva cuenta») y «✕» de 48 × 48 a la derecha (en Crear cuenta, «‹ Volver» a la izquierda como hoy); debajo, la barra compacta de solo lectura (sección 6.9: una línea de 36 dp, `surface`, «Efectivo · $1,876.00»).

**Conformidad del código actual (HEAD 94e37e0).** Cumple: tokens de color/radios/alturas de `ui.tsx` (`Button` primary/danger/`tall`/`busy`, `Chip` de 48 dp, `Segmented`, `screenStyles.input` con borde 1.5 `borderStrong`, alto 48, radio 12, error con `colors.expenseText` en `ui.tsx`/`ErrorBox`), `Sheet` y `lib/calendar.ts` para el selector, lógica de bloqueo con `busy`. **No cumple:** (a) `TransactionFormScreen.styles.error` usa `#b3261e` literal en lugar de `colors.expenseText`; (b) tipo y categoría son `Chip` (borde neutro, `segBg`/`text`, sin tinte del tipo ni `CategoryIcon`; `CategoryIcon`, `CategoryOption`, `categoryFill` y `categoryGlyph` no existen en `app/src`); (c) Fecha es `TextInput` libre más `Button` Hoy/Ayer; (d) el campo de monto es un `input` genérico sin prefijo ni tipografía de 28; con `autoFocus`; (e) `s.input` no tiene estado de foco (sin borde `brand700` ni halo) ni de error (borde `expense`); (f) «Nota (opcional)» sin contador y sin altura mínima de 96; (g) Guardar/Cancelar/Anular están dentro del `ScrollView`, sin `tall`, sin `busy` y con etiquetas genéricas; (h) el título es 22 bold (`screenStyles.title`), no `title` 24/800; (i) no hay interruptor «saldo en contra» ni hay hoja de selector de fecha; (j) los títulos de sección usan 16/700 en vez de 14/700.

### 6.14 Historial, Calendario, Reportes y Categorías (R4; implementa docs/007 §5.11; base HEAD 281bc86)

Solo tokens existentes de `app/src/theme/tokens.ts`. **Ningún color nuevo.** Cuatro valores **no cromáticos** nuevos para `sizes` (todos de uso único): `moduleTile` 36, `moduleTileSm` 28, `monthArrow` 32 y `categoryBar` 10 (alto de barra; el mínimo visible de 4 dp y el círculo del color de 48 dp se escriben como constantes locales). Fondo `bg`, margen lateral 16 (20 con ancho ≥ 400), separación vertical entre bloques 16, tarjetas `surface` radio 16 con `shadows.card`. Los 16 pares nuevos se verificaron con `node docs/design/contrast.js --check` (salida: código 0, 98 pares + 7 colores del selector; mínimos sin cambio: texto 4.60:1, componente 3.47:1) y están en la sección 3.4.

**1. `ScreenTitle` y `ModuleTile`.**
- `ModuleTile`: cuadrado de 36 dp (28 dp con fuente ≥ 130 %; se oculta con fuente ≥ 175 %), radio 12 (`radii.md`), fondo `moduleColors.*.tile`, glifo de 20 sp centrado (emoji propio, `importantForAccessibility="no"`): Movimientos 📋 (`movimientos`), Calendario 📅 (`calendario`), Reportes 📊 (`reportes`), Categorías 🏷️ (`mas`, pizarra). La tinta del módulo no se usa en el glifo (los emojis llevan su color); `ink` sirve para texto sobre el mosaico si lo hubiera (pares 8.19, 7.19, 7.68 y 8.41:1).
- `ScreenTitle`: fila `ModuleTile` + 12 dp + título `typography.title` (24/30 800) `colors.text`, `accessibilityRole="header"`. Debajo del título, subrayado `colors.yellow` de 40 × 5, radio 3, a 4 dp. Margen inferior 12. El título pasa de una a dos líneas sin recortar; se recomienda `maxFontSizeMultiplier` 1.6 solo en este título (no es `allowFontScaling={false}`). El título no incluye el nombre de la cuenta.

**2. Historial.**
- Contador bajo el título: `small` 13/18 `text2` («14 movimientos»), 4 dp bajo el subrayado.
- Botón «Filtros»: `Button` `secondary`, 48 dp, `alignSelf: flex-start`, relleno horizontal 16, texto «Filtros» o «Filtros (2)» más «▾» (abierto «▴»; decorativo). Con filtros activos el texto no cambia de color (el contador lo dice); sin color de módulo.
- Panel plegable (en línea, bajo el botón, 8 dp): `Card` `surface`, radio 16, `shadows.card`, relleno 12, hueco 16 entre grupos. Etiqueta de cada grupo `brandLabel` (14/18 800) `text`, 8 dp sobre el control. Tipo: `Segmented tone="movimientos"` (elegido `movTile` + `movInk` 800 con «✓»). Categoría: `Chip size="sm"` envueltos, 8 dp entre chips y 12 dp entre filas (P-1); el elegido toma el tono movimientos (`movTile`, borde 1.5 `movInk`, texto `movInk` 800, «✓»); «(archivada)» va en `text2` dentro del mismo texto. Rango: dos botones lado a lado (flex 1, hueco 8) con aspecto de campo: `surface`, borde 1.5 `borderStrong`, radio 12, alto mínimo 48, etiqueta `small` 700 `text2` («Desde») sobre el valor 15/600 `text` («Elegir» en `text3`, o la fecha). Error de rango: `small` 13/700 `expenseText` con «⚠ » decorativo, `role=alert`, 4 dp bajo los botones. Pie: «Limpiar filtros» `ghost`, solo con filtros activos.
- Chips de filtro activo (fila siempre visible, 12 dp bajo el botón, envolviendo, 8 dp entre chips y 12 entre filas): `Chip size="sm"` con **tono movimientos** elegido: fondo `movTile`, borde 1.5 `movInk` (9.60:1 sobre blanco), texto 13/18 800 `movInk` (8.19:1), sufijo «✕» en `movInk`; sin «✓» (el ✕ lo sustituye). Requiere la variante `tone="movimientos"` de `Chip` (nueva, sin color nuevo).
- Encabezado de día (`role=header`): `brandLabel` 14/18 800 `colors.text`, 16 dp arriba y 8 abajo, sin fondo ni línea. «Hoy», «Ayer» o fecha larga, igual de peso.
- `TransactionRow` (sustituye a la fila de borde y punto): `Pressable` `surface`, radio 16, `shadows.card`, `minHeight` 56, relleno 12 horizontal y 8 vertical, fila con hueco 12, centrada, separación entre filas 8. Izquierda `CategoryIcon` de **40 dp** (radio 12; categoría archivada opacidad 0.5; sin categoría: `icono` desconocido y color `#6B7280` vía `categoryFill`, que ya devuelve ese gris). Centro (`flex: 1`, `minWidth: 0`): nombre 15/20 600 `text` hasta 2 líneas sin elipsis; nota `small` 13/18 `text2` hasta 2 líneas con elipsis (`numberOfLines={2}`). Derecha, `flexShrink: 0`: importe 16/22 800, `tabularNums`, «-$6.50» en `expenseText` (6.38:1) o «+$800.00» en `incomeText` (6.67:1). Presionada: opacidad 0.85. No lleva fecha (`showDate` falso) ni punto de color. El color de la categoría vive solo en el cuadrado.
- «Cargar más»: `Button secondary` a ancho completo, «Cargando…» con `busy` y opacidad 0.5. Error al cargar más: `small` `expenseText` 13/700, `role=alert`, sobre el botón.

**3. Calendario.**
- Navegación de mes (fila de 48 dp): flechas «‹» «›» con círculo `surface` de 32 dp (`sizes.monthArrow`), `shadows.card`, glifo 18 `text` 800, dentro de una zona de 48 × 48; deshabilitada: opacidad 0.4. Título del mes (`h2` 18/24 800 `text`, `role=header`) centrado, `flex: 1`. Misma pieza para Reportes (`MonthArrow`).
- Cabecera de días: `small` 12/16 700 `text2` (7.39:1 sobre `bg`), una letra por columna; etiqueta larga accesible.
- Celda (P-3): ancho = (ventana − 2 × margen − 6 × 3) / 7 (44,3 dp a 360 dp; ≥ 48 dp con ≥ ≈ 386 dp; por debajo de ≈ 350 dp baja de 44 dp, D3.3), alto `calendarCellHeight` 52, separación 3 dp en ambos ejes, radio 8, `borderWidth` 2 **siempre** (sin saltos de diseño), relleno horizontal 0. Contenido en columna centrada: número 13/16 700 `text` y, bajo él, hasta dos líneas de 10 sp / 12 800 (`allowFontScaling={false}`, una línea cada una, relleno 2 dp): «+{compacto}» `incomeText` y «−{compacto}» `expenseText` (6.67 y 6.38:1 sobre blanco).
  - Reposo (con o sin movimientos): fondo `surface`, borde 2 `border` (decorativo). **Con movimientos** no cambia el color de la celda: el indicador son las cifras con signo (el color de módulo es orientación, no dato; sección 1, regla 4).
  - Hoy: borde 2 `calStrong` (5.67:1 sobre blanco), número 800.
  - Elegido: fondo `calStrong`, borde 2 `calStrong`, número y cifras en `white` (5.67:1, signo conservado), `selected`.
  - Hoy y elegido: fondo `calStrong` y borde 2 `calTile` (anillo claro, 4.69:1 contra el relleno), de modo que «hoy» no se pierda; la etiqueta dice «, hoy».
  - Fuera del mes: sin vista ni zona táctil. Presionada: opacidad 0.85.
- Resumen del mes: **dos filas**, no tres en una (a 360 dp un `SummaryTile` de una tercera parte mide 104 dp y no cabe «+$12,345.00» a 19 sp sin truncar). Fila 1: «↑ Ingresos» y «↓ Gastos» (`flex: 1`, hueco 8, 140 dp a 360). Fila 2: «Neto» a ancho completo con etiqueta a la izquierda y cifra a la derecha. Los tres son `SummaryTile` (6.5). Neto: cifra `text`, sin burbuja de color. Un solo elemento accesible para el conjunto (docs/007 D.3). Vacío: `small` `text2` «No hay movimientos en este mes.» en lugar de las tarjetas.
- Tarjeta del día: `Card` (`surface`, radio 16, `shadows.card`, relleno 12). Encabezado `h2` 18/24 700 `text` «14 de octubre» (`header`). Si hay movimientos, línea `small` 13/18 con tres trozos: «Ingresos +$X» (`incomeText` 700), «Gastos −$Y» (`expenseText` 700) y «Neto $Z» (`text` 700), separados por «·» `text2`, que envuelven. Sin movimientos: `small` `text2` «Este día no tiene movimientos registrados.» Botón «+ Anotar en este día» `Button secondary`, 48 dp, ancho completo, 12 dp bajo el texto; deshabilitado con opacidad 0.5. Las filas del día (`TransactionRow` sin fecha) van **debajo de la tarjeta**, separadas 8 dp, no anidadas (sin tarjetas dentro de tarjetas).

**4. Reportes.**
- Modo: `Segmented tone="reportes"` (pista `segBg`, elegido `repTile` + `repInk` 800 con «✓», 7.68:1; el elegido se distingue de la pista por «✓» y peso, no solo por tono). Flechas de período y título como en Calendario; «Del 01/10/2026 al 31/10/2026» `small` `text2` centrado. Rango: los botones «Desde»/«Hasta» del Historial (mismo aspecto de campo) y «Aplicar» `secondary` 48 dp.
- Resumen: igual que Calendario (2 + 1). «Ingresos» y «Gastos» son botones: debajo de la cifra, «Ver movimientos ›» `small` 13/18 700 `brand700` (7.49:1 sobre blanco), `minHeight` 48 de la tarjeta, presionada opacidad 0.85. Balance: texto, cifra `text` 800 con «-» si es negativo (`expenseText` no se usa: es el balance, no un gasto).
- Grupo «Gastos por categoría» / «Ingresos por categoría»: `h2` con burbuja ↓/↑ de 24 dp a la izquierda (6.5), y debajo una `Card` con las filas separadas por una línea de 1 dp `border`. Fila (`Pressable`, `minHeight` 56, relleno vertical 8): `CategoryIcon` 32 dp (radio 10, archivada opacidad 0.5), 8 dp, bloque flexible con **nombre** 15/20 600 `text` hasta 2 líneas sin elipsis («(archivada)» en el texto) y, a la derecha, **total** 15/22 800 `text` con `tabularNums`, `flexShrink: 0`. Debajo, alineada con el nombre (sangría 40 dp), una fila: **porcentaje** `small` 13/18 700 `text2` (ancho mínimo 52, p. ej. «40.0%», `formatPercent`) y la **barra** (`flex: 1`).
- Barra (RN, D1): pista `View` alto **10** (`categoryBar`), radio 5, fondo `border`; relleno `View` del mismo alto y radio, fondo `categoryFill(color)` (3.00 a 4.83:1 sobre `surface`; 11 colores en 3.3 y 7 del selector en 3.4), ancho en `%` = `scaleUnits(total, máximo, 1000) / 10`, **mínimo 4 dp** si el total > 0 (`Math.max`, solo presentación); decorativa (`importantForAccessibility="no"`). Límite honesto: contra la pista `border` el relleno queda en 2.44 a 4.06:1 (varios colores < 3:1); es aceptable porque la longitud no es información exclusiva (el importe y el porcentaje están en texto y en la etiqueta accesible) y contra la tarjeta cumple 3:1. Sin color crudo de la API y sin `FALLBACK_COLOR` propio: `categoryFill` ya devuelve `#6B7280` para un color inválido.
- Evolución (solo Año y Rango): `Card` con `h2` «Evolución mensual/anual» (`header`) y `Segmented` neutro «Gráfico | Tabla» (48 dp) a 8 dp. Leyenda en una fila bajo el segmentado: «↑ Ingresos» y «↓ Gastos» `small` 13/18 700 `text`, precedidos de un cuadrado de 12 dp radio 3 en `income` y `expense` (4.99 y 4.82:1 sobre blanco). **Gráfico**: columnas de 56 dp con dos barras de 18 dp (hueco 4, **Ingresos siempre a la izquierda y Gastos a la derecha**), alto máximo 80 dp, radio superior 6, relleno `income`/`expense`, altura mínima 4 dp si > 0, línea base de 1 dp `border`. Cifra compacta con signo sobre cada barra (10 sp 800, `incomeText`/`expenseText`, `allowFontScaling={false}`) y etiqueta del período bajo la columna `small` 12/16 `text2` (sube de 11 a 12; no se usa 10). Aviso «Desliza para ver más períodos.» `small` `text3` solo si hay desplazamiento. Límite honesto: `income` y `expense` tienen casi la misma luminosidad (1.03:1), por lo que **en escala de grises solo se distinguen por el orden fijo, el signo de las cifras y la leyenda**; ninguna barra depende solo del color. **Tabla**: encabezado `small` 12/16 700 `text2` («Período», «Ingresos», «Gastos», «Balance») y una fila por período en la `Card` (separadas por 1 dp `border`, relleno vertical 8): período 14/20 700 `text` (flex 1.2) y tres cifras 14/20 `tabularNums` alineadas a la derecha (`flex: 1`): ingresos `incomeText`, gastos `expenseText`, balance `text` 700 (con «-» si es negativo, `expenseText`). Con fuente ≥ 115 % la fila se apila en dos líneas (período y balance arriba; «Ingresos +$X · Gastos -$Y» debajo) para no truncar cifras.
- Exportación (al final): separador de 1 dp `border` y 24 dp de aire; `h2` «Exportar este período» (`header`); texto `body` 15/22 `text2`; dos `Button secondary` de 48 dp en fila (flex 1, hueco 8; en columna con fuente grande). «Exportando…» con `busy` y los dos bloqueados; indicador `ActivityIndicator` pequeño `brand700`. Error: `ErrorBox` con «Reintentar exportación». Ninguna acción primaria en Reportes.

**5. Categorías.**
- `ScreenTitle` «Categorías» (pizarra). `Segmented` neutro «Gastos | Ingresos» (elegido `surface`, `text` 800, «✓»). «+ Nueva categoría» `Button primary tall` (52, radio 16), 12 dp bajo el segmentado, oculto con cuenta archivada. «Mostrar archivadas»: fila de 48 dp con `Switch` nativo (pista `borderStrong` apagada / `brand700` encendida, perilla `white`). Ayuda desde el formulario: `small` `text2`.
- Fila: `Card` radio 16 (`shadows.card`), `minHeight` 64, relleno 12, hueco 12: `CategoryIcon` 40 dp, bloque flexible (nombre 16/22 700 `text`, **sin límite de líneas**; descripción `small` 13/18 `text2`; insignia «Archivada» `yellowSoft`, texto 12/16 800 `yellowText` 6.86:1, borde 1 `yellowBorder`, radio pill, relleno 8 × 2, 4 dp arriba) y «⋮» de 48 × 48 (glifo 22 `text` 800, etiqueta «Acciones de {nombre}»). Archivada: fondo `archivedRow`, sin sombra, ícono con opacidad 0.5; texto `text`/`text2` conserva 14.52/6.71:1.
- Hoja «⋮» (`Sheet` existente): título `h2` con el nombre; `Button secondary` «Editar», `Button secondary` «Archivar»/«Desarchivar» (cada uno 48 dp, ancho completo, hueco 8) y, tras 16 dp, `Button danger` «Eliminar» (borde `expense`, texto `expenseText`); [Cerrar] `ghost`. Con `busy` los tres deshabilitados (opacidad 0.5).
- Formulario (`Card` `surface` radio 16 con relleno 16; sustituye al marco `brand700` de 1 dp): título `h2` «Nueva categoría»/«Editar categoría»; campos con `FormTextInput`; tipo con `TypeToggle` (Gasto coral suave, Ingreso verde suave; al editar, `small` `text2` «Tipo: Gasto (no se puede cambiar)»).
- **Selector de color**: etiqueta «Color» `brandLabel` y, debajo, «Color: Rojo» o «Color: sin elegir (se asigna uno por defecto)» `small` `text2`. Siete opciones en cuadrícula envuelta, cada una de **76 × 72 dp** (4 por fila a 360 dp, hueco 8; zona táctil bien por encima de 48 × 48): círculo de 44 dp con borde 3 (transparente en reposo, `colors.text` en la elegida) y relleno interior de 34 dp con `categoryFill(valor)` (3.02 a 7.04:1 sobre blanco); «✓» 18/800 `white` centrado solo en la elegida; nombre bajo el círculo, `small` 12/16 `text2` centrado (elegida: 700 `text`), una línea sin elipsis. `radio` + `selected`, etiqueta «Color {nombre}». El círculo muestra el color tal como se verá (oscurecido si hace falta), por eso «Amarillo» se ve mostaza.
- **Vista previa**: etiqueta `small` 12/16 700 `text2`; caja `bg` con borde 1 `border`, radio 12, relleno 8, fila con `CategoryIcon` de 32 dp (ícono genérico `defaultCategoryGlyph`, color elegido o `#6B7280` si no hay) y el nombre 14/18 600 `text` (vacío: «Nombre de la categoría» `text3`, 5.38:1). Decorativa para lectores salvo el texto del nombre.
- Pie del formulario: «Guardar» `primary tall` («Guardando…» `busy`), «Cancelar» `ghost`, errores `expenseText` 13/700 con `role=alert`. Aviso de categoría en uso: caja `yellowSoft` con texto `yellowText` y botón «Archivar «{nombre}»» `secondary` de 48 dp.

**6. Estados vacío, carga y error (R4).**
- Carga: `ActivityIndicator` (color `brand700`) + texto `body` 15/22 `text2` centrado («Cargando movimientos…», «Calculando tu resumen…», «Cargando categorías…»), `minHeight` 120. No se muestran datos anteriores.
- Vacío: bloque centrado: espacio reservado de 96 dp para la ilustración (R5); mientras tanto, círculo de 96 dp con el `tile` del módulo y su glifo de 40 sp, hueco 12, título `h2` `text` si aplica, texto `body` `text2` (centrado) y la acción de docs/007 §7.2 (`secondary`, p. ej. «Limpiar filtros»). Se oculta el dibujo con fuente ≥ 175 %. Textos de docs/007 §5.11 G.
- Error: `ErrorBox` con fondo `expenseSoft`, radio 16, relleno 16 (cambio de estilo de `ErrorBox`, 5.17:1 el texto `expenseText`); mensaje 15/22 `expenseText` (`role=alert`), `Button secondary` «Reintentar…» (fondo blanco, 48 dp). Mensajes en línea (rango, cargar más, exportar): `small` 13/700 `expenseText`, sin caja.

**Literales de la línea base que deben sustituirse (R4).**

| Literal actual | Dónde | Sustituir por |
| --- | --- | --- |
| `#b3261e` (texto, `error`, `expense`) | los 5 archivos | `colors.expenseText` (texto: importes, errores, 6.38:1); en rellenos de barras (`expenseBg` de Reportes) `colors.expense` |
| `#2e7d32` (texto, `income`) | CalendarScreen, ReportsScreen, TransactionRow | `colors.incomeText` (texto); relleno de barras (`incomeBg`) `colors.income` |
| `#1a73e8` | Calendario (borde y texto de hoy, borde del elegido); Categorías (`chipSelected`) | Hoy: borde `moduleColors.calendario.strong`; elegido: relleno `calendario.strong`; número de hoy `text` 800; en Categorías el chip pasa a `Segmented`/`Chip` (tono neutro) |
| `#e8f0fe` | Calendario (fondo del día elegido); Categorías (`chipSelected`) | Calendario: `calendario.strong` con texto `white`; Categorías: `Segmented` neutro (`surface` + `text`) |
| `#dddddd` | Calendario (`cellActive`), Reportes (borde de tarjeta) | `colors.border` (celda y separadores) o `Card` con `shadows.card` sin borde |
| `#eeeeee` | Reportes (`barTrack`) | `colors.border` (pista de 10 dp) |
| `#555555` | Calendario (`dayLabel`), Reportes (`periodLabel`) | `colors.text2` |
| `#9e9e9e` | Reportes (`FALLBACK_COLOR`) | `categoryFill(color)` (devuelve `#6B7280` si el color es inválido) |
| `#757575` | TransactionRow (punto de respaldo) | `CategoryIcon` con color `#6B7280` vía `categoryFill` |
| `#bbbbbb`, `#000000` | Categorías (`chip` y `colorSelected`) | `colors.borderStrong` para el borde en reposo; `colors.text` para el anillo del color elegido |
| `#E53935`, `#FB8C00`, `#FDD835`, `#43A047`, `#1E88E5`, `#8E24AA`, `#757575` (`CATEGORY_COLORS`) | Categorías | **Se conservan**: son datos que se envían a la API, no estilos. Solo el círculo mostrado usa `categoryFill(valor)` |

Decisiones menores para confirmar (no cromáticas): (a) `SummaryTile` en 2 + 1 en lugar de una fila de tres (docs/007 §5.11 D.3 y su wireframe dibujan una fila; no la exigen); (b) `DatePickerSheet` neutro usa `colors.text` como relleno del día elegido (docs/007 K dice «marca», pero `brand700` está reservado a acción primaria/FAB/foco; la cifra blanca sobre `text` da 16.49:1); (c) `maxFontSizeMultiplier` 1.6 solo en `ScreenTitle`; (d) variante `tone="movimientos"` de `Chip` y fondo `expenseSoft` en `ErrorBox`.

### 6.15 R5.1: Login, botón de Google, cerrar sesión, selector de ícono, «+ Crear categoría» y barra de estado (implementa docs/007 §5.13; docs/003 «Decisión R5.1»)

Ajustes puntuales, sin otra identidad visual: todo sale de tokens existentes salvo la excepción de marca de Google (6.15.2) y tres tamaños. Ningún color de dinero (verde/coral) se usa fuera de su significado: el coral/verde solo aparece en la píldora de tipo de la hoja (6.15.5), donde sí significa Gasto/Ingreso. Estado: PROPUESTA hasta que el usuario la apruebe; contraste verificado con `node docs/design/contrast.js --check` (salida 0; 15 pares nuevos «R5.1» en 3.1). No probado en dispositivo.

#### 6.15.1 Login

- **Fondo**: `colors.bg` (crema) con las tres manchas `depth.blobs` ya aprobadas (6.11 y 2.6), no el verde a sangre (rechazado en la iteración 2). Contenedor `flex: 1`, `overflow: 'hidden'`, `backgroundColor: colors.bg`; manchas `position: 'absolute'`, `pointerEvents="none"`, `importantForAccessibility="no"`, detrás del contenido: amarilla 220 dp en (arriba, derecha) con desplazamiento -70/-60; melocotón 170 dp abajo-izquierda (-60/-50); celeste 190 dp a media altura, derecha (-90). Con altura de ventana < 600 dp (o fuente ≥ 1.5) reducir cada mancha al 75 %. Peor caso apilado `#E6DACB`: `text` 11.98:1, `text2` 5.54:1, `brandInk` verificado en 3.1; borde del botón de Google 3.29:1 (par nuevo).
- **Alcancía en el Login: SÍ, decisión justificada.** docs/003 R2 D2 difiere «la alcancía de Mis cuentas» (encabezado y vacío, UXQA-R2-01) a R6; no prohíbe la alcancía en otra pantalla, y la Bienvenida/Login aprobada (15.13 y 6.11) ya la lleva como personaje. Usar `vacio-alcancia.png` en el Login NO cumple ni adelanta lo pendiente de Mis cuentas: R6 sigue obligado a ponerla allí. Condición: el PNG (360 × 360, transparente, 106 KB) se copia a `app/assets/illustrations/vacio-alcancia.png` (hoy solo hay tres de las cinco; la copia es solo de assets, sin nativo). Si el usuario prefiere atenerse a docs/003 D11.2 al pie de la letra, la alternativa sin recurso es 👛 de 56 sp sobre el mismo círculo. Se pide al usuario confirmar esta decisión (una línea) antes de implementar.
- **Composición vertical** (columna centrada, `maxWidth: 360`, `alignSelf: 'center'`, `width: '100%'`, `alignItems: 'center'`), de arriba abajo:
  1. Marca: círculo `colors.yellowSoft` de 144 dp (`sizes.loginMark`) con la alcancía de 120 dp (`sizes.loginPig`) centrada, `resizeMode="contain"`, decorativa (`accessible={false}`, `importantForAccessibility="no"`, `accessibilityElementsHidden`). Compacto (ventana < 600 dp): círculo 120 / alcancía 96. Fuente ≥ 1.75: se oculta todo el bloque. Separación 16 dp (12 compacto).
  2. «CuidaTuBilletera»: `typography.rootTitle` (26/32 800), `colors.brandInk`, centrado, `accessibilityRole="header"`, `maxFontSizeMultiplier` no se limita; debajo, subrayado amarillo `colors.yellow` de 44 × 5 dp, radio 3, 8 dp bajo el texto (decorativo, oculto).
  3. Mensaje (variante A, docs/003 D11.1): `typography.body` (15/22) `colors.text2`, centrado, hasta 3 líneas a 360 dp y 4 a 320 dp, 12 dp bajo el subrayado.
  4. Avisos (solo si existen): caja a todo el ancho de la columna, radio `radii.md` (12), relleno 12, `typography.small` con `fontWeight: '700'` y prefijo «⚠ » oculto: error = `expenseSoft` + `expenseText` (5.17:1); aviso/motivo de cierre = `yellowSoft` + `yellowText`; rol `alert`. 16 dp sobre el botón.
  5. Botón de Google (6.15.2), 24 dp bajo el mensaje o los avisos.
  6. Nota de privacidad: `typography.small` (13/18) `colors.text2`, centrada, 12 dp bajo el botón. Sobre mancha amarilla 6.67:1, sobre el peor caso 5.54:1.
- **Contenedor**: `ScrollView` con `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: screenMargin(width) + 8 }}` (24 dp lateral a 320-399 dp, 28 dp desde 400 dp) y `keyboardShouldPersistTaps="handled"`; el fondo y las manchas van FUERA del `ScrollView` (hermanos absolutos) para que no se desplacen. A 320 × 568 dp (ventana útil ≈ 500 dp) el contenido compacto mide unos 380 dp más 112 de relleno: cabe sin desplazar; con fuente 200 % se desplaza y el botón sigue alcanzable.
- **StatusBar**: `style="dark"` ya existe en `App.tsx`; el Login pinta bajo la barra de estado (el relleno superior usa `useSystemInsets().top`, que con 6.15.6 vale ≥ 32 dp) y ese espacio tiene el mismo color `bg` y las mismas manchas, por lo que no se ve franja. 412 dp: mismos tamaños, más margen lateral (28), sin crecer la columna (máx. 360).

#### 6.15.2 Botón «Continuar con Google»

Única excepción cromática a los tokens del proyecto, justificada por la guía de marca de Google (botón claro). Valores en un objeto aparte, `brandGoogle`, para que no se confundan con la paleta (6.15.7).

| Propiedad | Valor |
| --- | --- |
| Fondo | `#FFFFFF` (= `surface`) |
| Borde | 1.5 dp `#747775` (`brandGoogle.border`); 4.53:1 sobre blanco, 4.39:1 sobre `bg`, 3.29:1 sobre las manchas apiladas |
| Texto | `#1F1F1F` (`brandGoogle.text`), `typography.button` con `fontWeight: '600'` (16/20); 16.48:1 sobre blanco |
| Tamaño | ancho 100 % de la columna (máx. 360), `minHeight: sizes.primaryTall` (52), crece con la fuente |
| Forma | `borderRadius: radii.md` (12; se mantiene la forma de los botones del proyecto en lugar de píldora), `shadows.card` |
| Contenido | fila centrada, `gap` 12, `paddingHorizontal` 16: logo 20 × 20 + texto (`flexShrink: 1`, hasta 2 líneas, centrado) |
| Presionado | fondo `#E6E6E6` (`brandGoogle.pressed`, #303030 al 12 % sobre blanco, estado «pulsado» de la guía); texto 13.21:1 |
| Cargando (`busy`) | texto «Ingresando…», el logo se sustituye por `ActivityIndicator` (`size` 20, `color={colors.brand700}`, `testID="login-loading"`) en el mismo hueco de 20 × 20 (no cambia el ancho); `disabled`, opacidad 0.6 (la ya existente), `accessibilityState {disabled: true, busy: true}` |
| Deshabilitado | opacidad 0.6; sin otro estado definido por la guía para este caso |
| Accesibilidad | `accessibilityRole="button"`, `accessibilityLabel` = texto visible; logo oculto (`accessibilityElementsHidden`, `importantForAccessibility="no"`) |

Alto 52 dp (la guía de Google muestra 40 dp como medida de referencia; se amplía por la zona táctil, decisión D11.2 de docs/003). El logo no se recolorea, recorta, redondea ni se le pone fondo ni contorno.

**Carga de `google-g.png`.** El original (`docs/design/assets/brand/google-g.png`, 200 × 204, RGBA) se conserva como fuente. No debe mostrarse tal cual a 20 dp: reducir 10x con `Image` de Android sin remuestreo previo da bordes dentados, y su relación 200:204 no es cuadrada. Se generaron versiones por densidad en un lienzo cuadrado transparente (el «G» escalado sin deformar, con Lanczos), verificadas con `file` y con el píxel de esquina en alfa 0:

| Archivo | Píxeles | Densidad |
| --- | --- | --- |
| `docs/design/assets/brand/rn/google-g.png` | 20 × 20 | 1x |
| `docs/design/assets/brand/rn/google-g@2x.png` | 40 × 40 | 2x |
| `docs/design/assets/brand/rn/google-g@3x.png` | 60 × 60 | 3x |
| `docs/design/assets/brand/rn/google-g@4x.png` | 80 × 80 | 4x |

Copiar los cuatro juntos, con estos nombres, a `app/assets/brand/` y cargar con `require('../../assets/brand/google-g.png')`: Metro elige la densidad. Estilo: `style={{ width: sizes.googleLogo, height: sizes.googleLogo }}` (20 × 20, obligatorios), `resizeMode="contain"`. Peso total ≈ 19 KB. No requiere módulo nativo ni build nueva.

#### 6.15.3 Control «Cerrar sesión» del encabezado de Mis cuentas

Implementa docs/007 §5.13 C con la misma familia visual que el avatar (`AccountsScreen.styles.avatar`). Zona táctil 48 × 48 (`sizes.touchMin`) con círculo visual de 40 dp (`sizes.avatar`), a la izquierda del avatar, 8 dp entre zonas (grupo de 104 dp; a 320 dp la marca conserva ≥ 150 dp con `flexShrink: 1` y `numberOfLines={2}`).

| Estado | Aspecto |
| --- | --- |
| Reposo | círculo `colors.surface`, borde 1.5 `colors.border`, `shadows.card`; glifo 🚪 de 20 sp (decorativo, `maxFontSizeMultiplier={1.3}` para que quepa en 40 dp con fuente grande) |
| Presionado | fondo `colors.segBg`, borde 1.5 `colors.borderStrong` (3.10:1 sobre `segBg`) |
| En curso (`busy`) | `disabled`; el glifo se sustituye por `ActivityIndicator` de 18 dp `colors.brand700`; opacidad 0.7; `accessibilityState {disabled: true, busy: true}` |
| Sin sesión / `unavailable` | igual que reposo (sigue activo) |

El borde `border` es decorativo (como el del avatar): el glifo identifica el control y la etiqueta «Cerrar sesión» lo nombra. Diferencia con el avatar: sin letra, con glifo. Sin texto visible; sin confirmación.

#### 6.15.4 Selector de ícono de categoría (30 íconos; docs/007 §5.13 D)

- **Rejilla**: `radiogroup` «Ícono». Celdas de 48 dp de alto mínimo (`sizes.touchMin`), radio `radii.md - 2` (10), glifo 24 sp (`maxFontSizeMultiplier={1.5}`), separación 8 dp (`spacing.sm`) en ambos ejes. Ancho de la celda = `(anchoDisponible - 8 × (columnas - 1)) / columnas`.
- **Columnas** = `clamp(floor((anchoDisponible + 8) / 56), 4, 6)`; con fuente ≥ 1.5, 4 columnas (las celdas crecen en alto, la rejilla no se corta). Ejemplos: formulario de categoría (tarjeta con 16 dp de relleno; ancho = ventana − 2 × margen − 32) a 360 dp (ancho 296) = 5 columnas × 6 filas de 48 dp, a 320 dp (256) = 4 (así lo calcula el código; antes decía 5); hoja de Nuevo movimiento a 360 dp (ancho 312) = 5, a 320 dp (272) = 5 (cabe justo: 5 × 48 + 4 × 8 = 272), a 412 dp (364) = 6. Sin scroll propio en el formulario; dentro de la hoja la rejilla va en el scroll del cuerpo.
- **Reposo**: `surface`, borde 1.5 `border` (decorativo; el glifo identifica la celda, igual que las opciones de categoría, 6.13). **Elegido**: fondo `brand100`, borde **3 dp `colors.text`** (13.28:1 sobre `brand100`) y una insignia «✓» en la esquina superior derecha dentro de la celda (16 dp, círculo `colors.text`, «✓» blanco 11 sp 800, 16.49:1; decorativa y oculta); `accessibilityState {selected: true}`. Presionado: opacidad 0.85. `busy`: opacidad 0.5. La selección no depende del color: borde grueso, insignia y estado accesible.
- **Reserva de espacio**: `borderWidth` 3 y 1.5 se pintan dentro de la caja, el tamaño no cambia al elegir.
- **Vista previa y resumen**: como docs/007 §5.13 D; el ícono elegido se dibuja con `CategoryIcon` y el color elegido.

#### 6.15.5 «+ Crear categoría» y hoja «Nueva categoría»

**Celda en la rejilla** (docs/007 §5.13 E): última celda; mismo ancho (`flex: 1`) y alto mínimo 56 (`sizes.categoryOptionMin`) que una opción; fondo `surface`, borde **2 dp punteado `colors.borderStrong`** (`borderStyle: 'dashed'`; 3.58:1 sobre `surface`), radio `radii.md`, texto «+ Crear categoría» `typography.brandLabel` (14/800) `colors.brand700` (7.49:1) centrado, hasta 2 líneas. Presionado: opacidad 0.85; `busy`: 0.5. Si es la única opción de su fila, ocupa su mitad; no se estira. En el vacío (sin categorías): botón `primary` de 48 dp a ancho completo con el mismo texto.

**Hoja** (`Sheet` existente, sin modificar): `surface`, radio superior 24, asa 40 × 4, relleno horizontal 24 y gap 12 (los propios de `Sheet`); velo `depth.scrim` (`rgba(23,33,31,0.45)`) que cubre también la barra de estado (`statusBarTranslucent`).

1. **Encabezado** (no se desplaza): título «Nueva categoría» `typography.h2` `colors.text` (`header`) y, en la misma fila a la derecha (si no cabe, debajo), la píldora de tipo, no interactiva: «Gasto» (`expenseSoft` + `expenseText`, 5.17:1) o «Ingreso» (`incomeSoft` + `incomeText`, 5.72:1), `typography.small` 700, relleno 4 × 10, radio `radii.pill`; es el tipo fijado del movimiento (la hoja no tiene color de módulo, manda el tipo).
2. **Cuerpo** en `ScrollView` (`keyboardShouldPersistTaps="handled"`, `showsVerticalScrollIndicator`): Nombre, Color, Ícono, Vista previa; separación 16 entre grupos. **Altura máxima de la hoja** = `0.75 × altoVentana − insets.top` (la hoja nunca pasa del 75 %; tope superior ≥ 8 dp bajo la barra de estado). Con el teclado abierto (altura de ventana < 480 dp) subir el máximo a `altoVentana − insets.top − 8`.
3. **Pie fijo** (hermano del `ScrollView`): borde superior 1 `colors.border`, relleno superior 12, gap 8; **Guardar categoría** `primary` + `tall` (52) a ancho completo y **Cancelar** `ghost` (48) debajo. Con el teclado abierto o ventana < 480 dp: ambos en una fila (Cancelar y Guardar `flex: 1`, 48 dp) para ahorrar ≈ 56 dp. Error de envío y avisos van sobre el pie (`expenseText` 13/700, rol `alert`), no dentro del scroll.
4. Con fuente ≥ 1.75: la rejilla de íconos pasa a 4 columnas, la vista previa se mantiene, el cuerpo se desplaza.

#### 6.15.6 Mitigación de la barra de estado (provisional; hipótesis D5)

Valor recomendado: **respaldo superior de 32 dp** y forma `top = Math.max(StatusBar.currentHeight ?? 0, 32)` en `computeInsets` (hoy: `statusBarH > 0 ? statusBarH : 24`). Así: sin recorte (barra de 24 dp) quedan 8 dp de más (dentro de la tolerancia de docs/007 §5.13 F); con recorte (≈ 28 a 40 dp) el valor del sistema, si es mayor, manda, y si el sistema informa 0 se reserva 32. El espacio es del mismo color que la pantalla (`bg` o `surface`, incluida la franja del Login con sus manchas), por lo que no se distingue de una franja de relleno. El respaldo inferior de 48 dp no cambia. Es una aproximación: si en el teléfono la barra mide más de 32 dp, subir a 40 y registrar la medida; la corrección exacta (`react-native-safe-area-context`) sigue bloqueada. Impacto en pruebas: las de `computeInsets` que esperan 24 pasan a 32.

#### 6.15.7 Tokens nuevos (mínimos, sin ningún color de la paleta)

| Token | Valor | Uso |
| --- | --- | --- |
| `brandGoogle` (objeto aparte de `colors`) | `{ bg: '#FFFFFF', border: '#747775', text: '#1F1F1F', pressed: '#E6E6E6' }` | Solo el botón «Continuar con Google» (guía de marca; contrastes en 6.15.2) |
| `sizes.googleLogo` | 20 | Logo «G» |
| `sizes.loginMark` | 144 | Círculo `yellowSoft` del Login (120 en compacto) |
| `sizes.loginPig` | 120 | Alcancía del Login (96 en compacto) |

El resto reutiliza tokens: `sizes.touchMin` (48), `sizes.avatar` (40), `sizes.primaryTall` (52), `sizes.categoryOptionMin` (56), `spacing.*`, `radii.*`, `typography.*`, `depth.blobs`, `depth.scrim`. Sustituir en `LoginScreen.tsx` todos los colores crudos (`#ffffff`, `#444444`, `#b00020`, `#8a6d00`, `#1a73e8`) por tokens.


### 6.16 Apariencia de la cuenta: color e ícono (PROPUESTA; implementa docs/007 §5.14; archivo destino `app/src/lib/account-appearance.ts`)

Solo especificación: no cambia `accountPalette` ni ningún token activo. Ratios calculados con la misma fórmula WCAG de `contrast.js` (script de la sesión en el scratchpad, no incorporado al repositorio).

**6.16.1 Paleta (claves ASCII).** Valores `card` y `tile` idénticos a `accountPalette` (2.4). La clave de API es una constante propia sin tilde; el nombre visible y accesible sale de la columna Etiqueta (`accountPalette.name` `'limón'` no se usa como clave).

| Clave | Etiqueta | `card` | `tile` |
| --- | --- | --- | --- |
| `aguamarina` | Aguamarina | `#E3F6F8` | `#BDE9EF` |
| `lavanda` | Lavanda | `#F0EBFF` | `#D9CCFF` |
| `albaricoque` | Albaricoque | `#FFF0E0` | `#FFD6A8` |
| `celeste` | Celeste | `#E7F1FF` | `#C5DBFF` |
| `rosa` | Rosa | `#FDEAF2` | `#F8CADD` |
| `limon` | Limón | `#FFF6D6` | `#FFE58A` |

**6.16.2 Contraste.** Molde de muestra de `category-form.tsx`: anillo 44 dp (borde 3 dp), relleno 34 dp con `tile`, «✓» dentro, sobre la pantalla `bg` `#FFFBF5` o tarjeta `surface` `#FFFFFF`.

| Clave | `text` sobre card | `text` sobre tile | `text2` sobre tile | Blanco sobre tile («✓» blanco) | Anillo 3 dp `text` sobre tile | `tile` sobre `surface` / `bg` (objeto, 3:1) |
| --- | --- | --- | --- | --- | --- | --- |
| aguamarina | 14.76 | 12.61 | 5.83 | **1.31 FALLA** | 12.61 | 1.31 / 1.27 **FALLA** |
| lavanda | 14.16 | 11.02 | 5.09 | **1.50 FALLA** | 11.02 | 1.50 / 1.45 **FALLA** |
| albaricoque | 14.75 | 12.12 | 5.60 | **1.36 FALLA** | 12.12 | 1.36 / 1.32 **FALLA** |
| celeste | 14.46 | 11.74 | 5.43 | **1.40 FALLA** | 11.74 | 1.40 / 1.36 **FALLA** |
| rosa | 14.31 | 11.37 | 5.26 | **1.45 FALLA** | 11.37 | 1.45 / 1.41 **FALLA** |
| limon | 15.23 | 13.21 | 6.11 | **1.25 FALLA** | 13.21 | 1.25 / 1.21 **FALLA** |

Anillo `text` sobre `surface` 16.49:1 y sobre `bg` 15.99:1 (cumple 3:1); texto de nombre y saldo sobre `card` ya verificados en 3.1 (mínimo 5.48:1 el saldo negativo). Texto y anillo cumplen en las seis; **fallan dos cosas** que el molde de categorías no resuelve porque sus colores son oscuros:

1. **«✓» blanco sobre `tile` pastel (1.25 a 1.50:1)**. Corrección: «✓» en `colors.text` 800 (11.02 a 13.21:1), no blanco. En «Predeterminado» (fondo `brand100`) el «✓» ya es `text` (13.28:1).
2. **Muestra sin seleccionar contra el fondo (1.21 a 1.50:1, exige 3:1)**. Corrección: la muestra en reposo lleva anillo de 1.5 dp `borderStrong` `#7E8A86` (3.58:1 sobre `surface`, 3.47:1 sobre `bg`) en lugar de anillo transparente; al seleccionarla el anillo pasa a 3 dp `text`. El nombre bajo la muestra (12 sp `text2`, 7.62:1 sobre `surface`) sigue siendo obligatorio: identifica la opción sin depender del color.

Selección por tres señales: anillo 3 dp, «✓» y `accessibilityState.selected`. El `card` solo se muestra en la vista previa (fondo de la tarjeta), no en la muestra.

**6.16.3 Catálogo de 12 íconos.** Glifo = emoji (mismo criterio que 7). Los 6 últimos usan exactamente el glifo de `app/src/lib/category-appearance.ts` (leído: 💼 `briefcase`, 🏠 `home`, ✈️ `plane`, 🎁 `gift`, 🛍️ `shopping-bag`, 💰 `money-bag`; `plane` y `shopping-bag` incluyen el selector de variación U+FE0F, hay que copiarlo).

Tamaños: en la vista previa y en `AccountCard` el glifo mide 28 dp sobre mosaico de 52 dp; en la rejilla del selector, celda ≥ 48 × 48 dp con glifo de **24 sp** y `maxFontSizeMultiplier={1.5}` como el `IconPicker` actual (6.15.4). Aviso: docs/007 §5.14.E dice 22 sp y cuadro de 40 dp; para reutilizar el `IconPicker` sin bifurcarlo se prefiere 24 sp (decisión menor, el implementador no debe crear un segundo tamaño).

Compatibilidad (decisión R5.1 D9, Unicode ≤ 11), por conocimiento del estándar, **sin prueba en dispositivo** (docs/010 nivel D pendiente): 👛 U+1F45B (Unicode 6.0), 💳 1F4B3 (6.0), 🏦 1F3E6 (6.0), 🐷 1F437 (6.0), 💵 1F4B5 (6.0), 📈 1F4C8 (6.0), 💼 1F4BC (6.0), 🏠 1F3E0 (6.0), ✈ 2708+FE0F (1.1), 🎁 1F381 (6.0), 🛍 1F6CD+FE0F (7.0), 💰 1F4B0 (6.0). **Ninguno incumple**. Observación (no incumplimiento): 💵 y 📈 son verdes y 💰 amarillo en muchas fuentes; sobre el mosaico pastel y con la etiqueta no se leen como «ingreso» (el color semántico de importes sigue solo en `income`/`expense`).

**6.16.4 Predeterminado (valor `null`).** Color: `accountColors(id)` (hash 31 sin signo `mod 6`, tal como hoy). Ícono: `accountIcon(nombre)` (tarjeta → 💳, banco → 🏦, resto → 👛); la alcancía «ahorro» de 2.4 queda como hoy donde exista. Una clave desconocida equivale a `null`. En Crear, sin id: mosaico y fondo `segBg` (docs/007 §5.14.C).

**6.16.5 Tabla para implementar.**

| Tipo | Clave | Etiqueta (accesible) | Valor |
| --- | --- | --- | --- |
| color | `aguamarina` | Aguamarina | card `#E3F6F8`, tile `#BDE9EF` |
| color | `lavanda` | Lavanda | card `#F0EBFF`, tile `#D9CCFF` |
| color | `albaricoque` | Albaricoque | card `#FFF0E0`, tile `#FFD6A8` |
| color | `celeste` | Celeste | card `#E7F1FF`, tile `#C5DBFF` |
| color | `rosa` | Rosa | card `#FDEAF2`, tile `#F8CADD` |
| color | `limon` | Limón | card `#FFF6D6`, tile `#FFE58A` |
| ícono | `wallet` | Billetera | 👛 |
| ícono | `card` | Tarjeta | 💳 |
| ícono | `bank` | Banco | 🏦 |
| ícono | `piggy-bank` | Alcancía | 🐷 |
| ícono | `cash` | Efectivo | 💵 |
| ícono | `trending-up` | Inversiones | 📈 |
| ícono | `briefcase` | Trabajo | 💼 |
| ícono | `home` | Hogar | 🏠 |
| ícono | `plane` | Viajes | ✈️ |
| ícono | `gift` | Regalos | 🎁 |
| ícono | `shopping-bag` | Compras | 🛍️ |
| ícono | `money-bag` | Ahorros | 💰 |

Etiquetas accesibles: «Color {Etiqueta en minúscula}» e «Ícono {Etiqueta}» (docs/007 §5.14.F). El orden de las filas es el orden de la rejilla.

### 6.17 R5.1b: catálogo único de íconos y selector «Elegir ícono» (PROPUESTA; implementa docs/007 §5.15 A; sin cambios de código)

Solo especificación. Decisiones del coordinador aplicadas: catálogo único en la app compartido por cuentas y categorías (P2), cuentas también usan la hoja (P1), «Usar este ícono» confirma (P4). La API valida solo la clave; el emoji, el grupo y las palabras clave viven en la app. Las 35 claves existentes (12 de cuenta, 30 de categoría, 7 comunes) conservan clave, emoji y nombre. Total propuesto: **249 entradas en 17 grupos**; verificado con un script del scratchpad de la sesión (no incorporado al repositorio): claves únicas, emojis únicos, nombres únicos y todas las claves cumplen `^[a-z0-9-]{1,20}$` (cumplen también `^[a-z0-9_-]{1,40}$`).

#### 6.17.1 Reglas del catálogo

1. Emoji de Unicode 10 o anterior (el más reciente es 🧒 🧠 🧘 🧥, Unicode 10; se evitaron los de Emoji 11 en adelante, p. ej. 🧳 🧭 🧩 🦴 🦷 🧾). Por conocimiento del estándar; **sin prueba en dispositivo** (docs/010 nivel D pendiente).
2. Sin ZWJ, sin tonos de piel y sin banderas. Una sola excepción de forma: los 5 emojis existentes que llevan U+FE0F (🍽️ ✈️ 🛍️ 🏋️ 🏷️) se conservan tal cual. Las 244 entradas restantes usan caracteres con presentación de emoji por defecto (no necesitan U+FE0F); se descartaron los que sí lo necesitan (✂ ⚙ ✉ ❤ ☀ ☁ 🖥 🛠 🏖 ⚠ ♻ 🕹 …).
3. Sin duplicados de emoji entre claves ni de nombre entre entradas (la etiqueta «Ícono {nombre}» es única).
4. Dos entradas existentes son glifos de texto, no emojis: `ellipsis` ⋯ y `plus-circle` ＋ (se dibujan en blanco sobre el color de la categoría, `category-appearance.ts`). Se marcan **T**. Recomendación: son **solo de categorías** (campo `scope`); el selector de cuentas no las muestra (un ＋ o ⋯ no identifica una cuenta). `tag` (🏷️) sigue siendo el predeterminado de categorías y no se ofrece en cuentas.
5. Forma sugerida del dato (decisión de implementación): `{ key, glyph, name, group, keywords, text?, scope? }`; `keywords` en minúscula y sin tildes; la búsqueda normaliza `NFD`. Orden de grupos y de celdas = el de las tablas.
6. Las palabras clave son contenido en español pendiente de revisión del usuario (P5). Incluyen formas comunes regionales («chompa», «bencina», «palta», «planilla»); no hay reglas de singular/plural.

Leyenda de la columna Existente: cuenta, categoría, o ambas (así figuran hoy en `account-appearance.ts` y `category-appearance.ts`).

#### 6.17.2 Catálogo por grupo

**1. Dinero y ahorro** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `wallet` | 👛 | Billetera | monedero, cartera, dinero | cuenta |
| `cash` | 💵 | Efectivo | billetes, dinero, plata, contado | cuenta |
| `money-bag` | 💰 | Ahorros | ahorro, bolsa, dinero, plata | cuenta y categoría |
| `piggy-bank` | 🐷 | Alcancía | chanchito, cerdito, ahorro, guardar | cuenta |
| `trending-up` | 📈 | Inversiones | inversion, sube, ganancia, bolsa, rendimiento | cuenta y categoría |
| `chart-down` | 📉 | Pérdidas | baja, cae, perdida, descenso |  |
| `bar-chart` | 📊 | Estadísticas | grafico, barras, reporte, resumen |  |
| `money-wings` | 💸 | Dinero que sale | gasto, vuela, pago, gastar |  |
| `exchange` | 💱 | Cambio de moneda | divisa, cambio, dolar, tipo de cambio |  |
| `dollar-sign` | 💲 | Dólar | dolares, precio, moneda, usd |  |
| `euro` | 💶 | Euro | euros, moneda, europa |  |
| `yen` | 💴 | Yen | moneda, japon, asia |  |
| `pound` | 💷 | Libra | moneda, esterlina, reino unido |  |
| `gem` | 💎 | Joyas | diamante, lujo, gema, valioso |  |

**2. Bancos y tarjetas** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `card` | 💳 | Tarjeta | credito, debito, pago, visa | cuenta |
| `bank` | 🏦 | Banco | cuenta, ahorros, corriente, entidad | cuenta |
| `atm` | 🏧 | Cajero | retiro, atm, cajero automatico |  |
| `handshake` | 🤝 | Acuerdo | prestamo, trato, deuda, pacto |  |
| `ledger` | 📒 | Libro de cuentas | libreta, registro, contabilidad |  |
| `clipboard` | 📋 | Trámites | tramite, lista, formulario, papeles, impuestos |  |
| `scroll` | 📜 | Documento | contrato, escritura, papel |  |
| `lock` | 🔒 | Seguridad | candado, cerrado, privado, clave |  |
| `key` | 🔑 | Llave | clave, acceso, alquiler, arriendo |  |
| `outbox` | 📤 | Transferencia enviada | envio, enviar, transferencia, salida |  |
| `inbox` | 📥 | Transferencia recibida | recibir, recibido, ingreso, entrada, deposito |  |
| `repeat` | 🔁 | Pago recurrente | suscripcion, mensual, repetir, cuota |  |
| `calendar-due` | 📅 | Vencimientos | fecha, vence, plazo, calendario |  |
| `bell` | 🔔 | Recordatorio | aviso, alerta, notificacion |  |

**3. Hogar** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `home` | 🏠 | Hogar | casa, vivienda, alquiler, arriendo, renta, hipoteca | cuenta y categoría |
| `house-garden` | 🏡 | Casa con jardín | casa, jardin, vivienda, propiedad |  |
| `door` | 🚪 | Puerta | entrada, mudanza, cerradura |  |
| `shower` | 🚿 | Ducha | baño, agua, aseo |  |
| `bathtub` | 🛁 | Bañera | baño, tina, aseo |  |
| `toilet` | 🚽 | Baño | sanitario, inodoro, aseo |  |
| `hammer` | 🔨 | Martillo | herramienta, obra, construccion, carpinteria |  |
| `wrench` | 🔧 | Reparaciones | arreglo, mantenimiento, mecanico, llave inglesa | categoría |
| `nut-bolt` | 🔩 | Tornillería | ferreteria, tuerca, tornillo, repuesto |  |
| `plug` | 🔌 | Enchufe | electricidad, cable, corriente, instalacion |  |
| `plant` | 🌱 | Plantas | planta, brote, vivero, cultivo |  |
| `herb` | 🌿 | Jardín | jardineria, hierba, verde, patio |  |
| `sunflower` | 🌻 | Flores | girasol, flor, decoracion |  |
| `set-square` | 📐 | Obra | escuadra, construccion, remodelacion, medida |  |

**4. Alimentación** (22)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `utensils` | 🍽️ | Comida | restaurante, almuerzo, cena, plato, alimentos | categoría |
| `shopping-cart` | 🛒 | Supermercado | super, compras, mercado, carrito, despensa, alimentos | categoría |
| `coffee` | ☕ | Café | cafeteria, cafe, desayuno, te | categoría |
| `pizza` | 🍕 | Pizza | comida rapida, pizzeria, italiana |  |
| `burger` | 🍔 | Hamburguesa | comida rapida, hamburguesa, fast food |  |
| `fries` | 🍟 | Papas fritas | comida rapida, papas, snack |  |
| `taco` | 🌮 | Taco | mexicana, comida, antojito |  |
| `sushi` | 🍣 | Sushi | japonesa, pescado, arroz |  |
| `ramen` | 🍜 | Sopa | fideos, ramen, caldo, sopa |  |
| `bread` | 🍞 | Pan | panaderia, pan, desayuno |  |
| `meat` | 🍖 | Carne | carniceria, asado, parrilla |  |
| `chicken` | 🍗 | Pollo | presa, pollo frito, aves |  |
| `apple` | 🍎 | Fruta | manzana, frutas, verdura, mercado |  |
| `banana` | 🍌 | Banano | platano, fruta, banana |  |
| `avocado` | 🥑 | Aguacate | palta, verdura, fruta |  |
| `carrot` | 🥕 | Verduras | zanahoria, hortalizas, vegetales |  |
| `salad` | 🥗 | Ensalada | saludable, dieta, vegetariana |  |
| `cake` | 🍰 | Postres | pastel, torta, dulce, pasteleria |  |
| `ice-cream` | 🍦 | Helado | heladeria, postre, dulce |  |
| `cookie` | 🍪 | Galletas | snack, dulce, bocadillo |  |
| `beer` | 🍺 | Cerveza | bar, licor, bebida, alcohol |  |
| `wine` | 🍷 | Vino | licor, bebida, copa, alcohol |  |

**5. Transporte** (16)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `bus` | 🚌 | Transporte público | bus, autobus, pasaje, colectivo | categoría |
| `car` | 🚗 | Auto | carro, coche, vehiculo, automovil | categoría |
| `fuel` | ⛽ | Combustible | gasolina, diesel, gasolinera, bencina, nafta | categoría |
| `taxi` | 🚕 | Taxi | carrera, uber, viaje, movilidad |  |
| `metro` | 🚇 | Metro | subte, subterraneo, tren urbano |  |
| `train` | 🚆 | Tren | ferrocarril, pasaje, viaje |  |
| `tram` | 🚊 | Tranvía | tren ligero, tram, pasaje |  |
| `bike` | 🚲 | Bicicleta | bici, ciclismo, pedal |  |
| `kick-scooter` | 🛴 | Monopatín | patineta, scooter, patin |  |
| `motor-scooter` | 🛵 | Moto | motocicleta, scooter, motoneta |  |
| `truck` | 🚚 | Camión | flete, envio, mudanza, carga |  |
| `van` | 🚐 | Furgoneta | camioneta, minibus, van |  |
| `bus-stop` | 🚏 | Parada | paradero, estacion, bus |  |
| `traffic-light` | 🚦 | Semáforo | transito, trafico, via |  |
| `construction` | 🚧 | Obras viales | obra, via, carretera, peajes |  |
| `siren` | 🚨 | Multas | multa, infraccion, policia, transito |  |

**6. Salud** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `heart-pulse` | 🩺 | Salud | medico, doctor, consulta, estetoscopio, dentista | categoría |
| `pill` | 💊 | Medicinas | medicina, farmacia, pastilla, remedio, medicamentos | categoría |
| `syringe` | 💉 | Vacunas | vacuna, inyeccion, jeringa |  |
| `ambulance` | 🚑 | Emergencia | ambulancia, urgencias, auxilio |  |
| `hospital` | 🏥 | Hospital | clinica, centro medico, internacion |  |
| `glasses` | 👓 | Lentes | gafas, optica, oculista, vista |  |
| `brain` | 🧠 | Salud mental | psicologia, terapia, mente, psicologo |  |
| `massage` | 💆 | Masajes | spa, relajacion, fisioterapia |  |
| `haircut` | 💇 | Peluquería | corte, cabello, barberia, pelo |  |
| `nails` | 💅 | Uñas | manicura, belleza, esteticista |  |
| `mask` | 😷 | Mascarilla | cubrebocas, tapabocas, enfermedad, prevencion |  |
| `microscope` | 🔬 | Laboratorio | examenes, analisis, laboratorio |  |
| `yoga` | 🧘 | Bienestar | yoga, meditacion, relajacion |  |
| `sleep` | 😴 | Descanso | dormir, sueño, reposo |  |

**7. Educación** (12)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `graduation-cap` | 🎓 | Educación | universidad, colegio, titulo, matricula, pension | categoría |
| `book` | 📚 | Libros | libro, lectura, biblioteca, textos | categoría |
| `open-book` | 📖 | Lectura | leer, libro abierto, novela |  |
| `school` | 🏫 | Escuela | colegio, instituto, clases |  |
| `backpack` | 🎒 | Mochila | utiles, escolar, colegio |  |
| `memo` | 📝 | Tareas | apuntes, examen, notas, deberes |  |
| `notebook` | 📓 | Cuaderno | libreta, apuntes, escolar |  |
| `ruler` | 📏 | Regla | utiles, medida, escolar |  |
| `globe` | 🌎 | Idiomas | ingles, idioma, mundo, curso |  |
| `abc` | 🔤 | Alfabeto | letras, lengua, ingles, aprender |  |
| `telescope` | 🔭 | Ciencia | astronomia, investigacion, telescopio |  |
| `speech` | 💬 | Conversación | charla, clases, tutoria, conversacion |  |

**8. Trabajo y negocios** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `briefcase` | 💼 | Trabajo | empleo, sueldo, salario, oficina, nomina | cuenta y categoría |
| `office` | 🏢 | Oficina | edificio, empresa, coworking |  |
| `factory` | 🏭 | Fábrica | industria, produccion, taller |  |
| `store` | 🏪 | Tienda | negocio, local, comercio, bodega |  |
| `department-store` | 🏬 | Centro comercial | mall, almacen, tiendas |  |
| `necktie` | 👔 | Formal | corbata, traje, reunion, empleo |  |
| `folder` | 📁 | Carpeta | archivos, documentos, proyecto |  |
| `package` | 📦 | Paquetes | envio, encomienda, inventario, mercaderia |  |
| `paperclip` | 📎 | Papelería | clip, adjunto, oficina, suministros |  |
| `pushpin` | 📌 | Pendiente | chincheta, fijo, importante |  |
| `megaphone` | 📣 | Publicidad | marketing, anuncio, promocion |  |
| `mailbox` | 📬 | Correspondencia | correo, cartas, buzon |  |
| `worker` | 👷 | Obrero | construccion, jornal, mano de obra |  |
| `card-index` | 📇 | Contactos | clientes, agenda, directorio |  |

**9. Viajes** (16)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `plane` | ✈️ | Viajes | avion, vuelo, pasaje, aeropuerto | cuenta y categoría |
| `hotel` | 🏨 | Hotel | alojamiento, hospedaje, estadia |  |
| `ticket` | 🎫 | Entradas | boleto, ticket, evento, acceso |  |
| `tent` | ⛺ | Camping | carpa, acampar, naturaleza |  |
| `palm` | 🌴 | Vacaciones | playa, palmera, descanso, tropical |  |
| `ship` | 🚢 | Barco | crucero, ferry, navegar |  |
| `sailboat` | ⛵ | Velero | vela, navegar, mar |  |
| `station` | 🚉 | Estación | terminal, tren, anden |  |
| `statue-liberty` | 🗽 | Turismo | ciudad, estatua, visita, destino |  |
| `mountain` | 🗻 | Montaña | excursion, senderismo, volcan, paisaje |  |
| `sunrise` | 🌅 | Paisaje | amanecer, atardecer, mirador |  |
| `passport` | 🛂 | Pasaporte | migracion, visa, frontera, documentos |  |
| `baggage` | 🛄 | Equipaje | maleta, aeropuerto, equipaje |  |
| `departure` | 🛫 | Salida | despegue, vuelo, ida |  |
| `arrival` | 🛬 | Llegada | aterrizaje, vuelo, regreso |  |
| `wave` | 🌊 | Playa | mar, ola, costa, balneario |  |

**10. Compras** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `shopping-bag` | 🛍️ | Compras | bolsa, tienda, shopping | cuenta y categoría |
| `shirt` | 👕 | Ropa | camiseta, polo, prenda, vestimenta | categoría |
| `gift` | 🎁 | Regalos | regalo, obsequio, cumpleaños, detalle | cuenta y categoría |
| `dress` | 👗 | Vestido | ropa, moda, boutique |  |
| `jeans` | 👖 | Pantalón | jean, ropa, pantalones |  |
| `coat` | 🧥 | Abrigo | chaqueta, chompa, chamarra, campera, invierno |  |
| `sneaker` | 👟 | Zapatillas | tenis, calzado, deportivas |  |
| `shoe` | 👞 | Zapatos | calzado, formal, zapateria |  |
| `high-heel` | 👠 | Tacones | calzado, fiesta, zapatos |  |
| `handbag` | 👜 | Cartera | bolso, cartera, accesorio |  |
| `hat` | 🎩 | Sombrero | accesorio, gorro, elegante |  |
| `ring` | 💍 | Anillo | joyeria, compromiso, boda, alianza |  |
| `lipstick` | 💄 | Maquillaje | cosmeticos, belleza, labial |  |
| `watch` | ⌚ | Reloj | accesorio, hora, relojeria |  |

**11. Entretenimiento** (18)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `gamepad` | 🎮 | Juegos | videojuegos, consola, play, gaming | categoría |
| `music` | 🎵 | Música | canciones, spotify, streaming, conciertos | categoría |
| `film` | 🎬 | Cine | pelicula, streaming, series, netflix | categoría |
| `theater` | 🎭 | Teatro | obra, espectaculo, funcion |  |
| `palette` | 🎨 | Arte | pintura, dibujo, manualidades, hobby |  |
| `microphone` | 🎤 | Karaoke | cantar, show, microfono |  |
| `headphones` | 🎧 | Audífonos | musica, podcast, escuchar |  |
| `guitar` | 🎸 | Guitarra | instrumento, banda, rock |  |
| `piano` | 🎹 | Piano | teclado, instrumento, clases |  |
| `drum` | 🥁 | Percusión | tambor, instrumento, percusion |  |
| `dice` | 🎲 | Juegos de mesa | dados, azar, mesa, juego |  |
| `bowling` | 🎳 | Boliche | bolos, juego, salida |  |
| `circus` | 🎪 | Circo | feria, carpa, espectaculo |  |
| `roller-coaster` | 🎢 | Parque de diversiones | montaña rusa, parque, atracciones |  |
| `party` | 🎉 | Fiesta | celebracion, cumpleaños, evento, reunion |  |
| `balloon` | 🎈 | Globos | cumpleaños, decoracion, fiesta |  |
| `popcorn` | 🍿 | Palomitas | cine, snack, pelicula |  |
| `tv` | 📺 | Televisión | tele, cable, streaming, suscripcion |  |

**12. Tecnología** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `phone` | 📱 | Teléfono | celular, movil, plan, smartphone | categoría |
| `wifi` | 📶 | Internet | wifi, red, datos, conexion, plan | categoría |
| `laptop` | 💻 | Computadora | laptop, portatil, pc, ordenador |  |
| `floppy` | 💾 | Almacenamiento | disco, guardar, nube, memoria |  |
| `cd` | 💿 | Disco | cd, musica, software |  |
| `camera` | 📷 | Cámara | foto, fotografia, video |  |
| `video-camera` | 📹 | Video | grabacion, filmacion, camara |  |
| `battery` | 🔋 | Batería | cargador, pila, energia |  |
| `antenna` | 📡 | Antena | señal, satelite, television |  |
| `robot` | 🤖 | Robot | inteligencia artificial, ia, automatizacion |  |
| `handset` | 📞 | Llamadas | telefono, fijo, llamada |  |
| `globe-web` | 🌐 | Sitio web | dominio, hosting, pagina, web |  |
| `search` | 🔍 | Búsqueda | lupa, buscar, investigar |  |
| `flashlight` | 🔦 | Linterna | iluminacion, herramienta, electronica |  |

**13. Mascotas** (12)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `paw` | 🐾 | Mascotas | huellas, animal, veterinario, patas | categoría |
| `dog` | 🐶 | Perro | perrito, cachorro, paseo, veterinario |  |
| `cat` | 🐱 | Gato | felino, minino, arena |  |
| `rabbit` | 🐰 | Conejo | roedor, mascota, jaula |  |
| `hamster` | 🐹 | Hámster | roedor, mascota, jaula |  |
| `fish` | 🐟 | Pez | acuario, pecera, alimento |  |
| `bird` | 🐦 | Ave | pajaro, canario, jaula |  |
| `turtle` | 🐢 | Tortuga | reptil, acuario, mascota |  |
| `horse` | 🐴 | Caballo | equitacion, establo, hipica |  |
| `parrot` | 🦜 | Loro | ave, pajaro, mascota |  |
| `lizard` | 🦎 | Reptil | lagartija, iguana, terrario |  |
| `bee` | 🐝 | Abeja | miel, apicultura, insecto |  |

**14. Familia** (12)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `baby` | 👶 | Bebé | recien nacido, pañales, guarderia |  |
| `child` | 🧒 | Niño | hijos, infantil, menor |  |
| `boy` | 👦 | Hijo | chico, niño, escolar |  |
| `girl` | 👧 | Hija | chica, niña, escolar |  |
| `man` | 👨 | Papá | padre, hombre, pareja |  |
| `woman` | 👩 | Mamá | madre, mujer, pareja |  |
| `older-man` | 👴 | Abuelo | adulto mayor, familia, jubilado |  |
| `older-woman` | 👵 | Abuela | adulta mayor, familia, jubilada |  |
| `family` | 👪 | Familia | hogar, hijos, padres |  |
| `couple` | 💑 | Pareja | novio, novia, aniversario, esposo |  |
| `heart` | 💖 | Cariño | amor, corazon, afecto, donacion |  |
| `baby-bottle` | 🍼 | Biberón | bebe, leche, formula, lactancia |  |

**15. Deportes** (16)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `dumbbell` | 🏋️ | Deporte | gimnasio, pesas, gym, ejercicio | categoría |
| `soccer` | ⚽ | Fútbol | futbol, balon, cancha, pelota |  |
| `basketball` | 🏀 | Baloncesto | basquet, balon, cancha |  |
| `baseball` | ⚾ | Béisbol | beisbol, pelota, bate |  |
| `tennis` | 🎾 | Tenis | raqueta, cancha, pelota |  |
| `volleyball` | 🏐 | Voleibol | voley, pelota, red |  |
| `pingpong` | 🏓 | Ping pong | tenis de mesa, raqueta |  |
| `golf` | ⛳ | Golf | campo, palos, bandera |  |
| `swimmer` | 🏊 | Natación | piscina, nadar, agua |  |
| `runner` | 🏃 | Correr | trote, running, maraton, carrera |  |
| `cyclist` | 🚴 | Ciclismo | bicicleta, ruta, pedalear |  |
| `trophy` | 🏆 | Torneo | copa, campeonato, premio |  |
| `medal` | 🏅 | Medalla | premio, competencia, logro |  |
| `boxing` | 🥊 | Boxeo | guantes, pelea, gimnasio |  |
| `martial-arts` | 🥋 | Artes marciales | karate, judo, taekwondo |  |
| `fishing` | 🎣 | Pesca | pescar, caña, rio |  |

**16. Servicios** (13)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `lightbulb` | 💡 | Servicios básicos | luz, electricidad, planilla, foco, recibo, factura | categoría |
| `water-drop` | 💧 | Agua | agua potable, gota, planilla, recibo, factura |  |
| `tap-water` | 🚰 | Agua potable | grifo, llave de agua, tuberia |  |
| `bolt` | ⚡ | Energía | rayo, electricidad, corriente |  |
| `flame` | 🔥 | Gas | calefaccion, cocina, estufa, combustion |  |
| `litter` | 🚮 | Basura | aseo, recoleccion, reciclaje |  |
| `newspaper` | 📰 | Periódico | diario, revista, suscripcion, noticias |  |
| `post-office` | 🏤 | Correos | envios, correo, oficina postal |  |
| `postbox` | 📮 | Buzón | cartas, correo, envio |  |
| `email` | 📧 | Correo electrónico | email, mail, mensaje |  |
| `fire-engine` | 🚒 | Bomberos | incendio, emergencia, seguro |  |
| `police` | 👮 | Policía | seguridad, vigilancia, denuncia |  |
| `hourglass` | ⌛ | Plazos | tiempo, espera, vencimiento |  |

**17. Otros** (14)

| Clave | Emoji | Nombre | Palabras clave | Existente |
| --- | --- | --- | --- | --- |
| `ellipsis` | ⋯ | Otros | varios, miscelanea, general | categoría (glifo de texto) |
| `plus-circle` | ＋ | Ingreso extra | sumar, adicional, extra, bono | categoría (glifo de texto) |
| `tag` | 🏷️ | Etiqueta | marca, precio, predeterminado, general | categoría |
| `star` | ⭐ | Favorito | estrella, destacado, importante |  |
| `sparkles` | ✨ | Especial | brillo, novedad, limpieza |  |
| `question` | ❓ | Sin clasificar | pregunta, duda, desconocido |  |
| `exclamation` | ❗ | Importante | urgente, aviso, atencion |  |
| `check` | ✅ | Pagado | listo, hecho, completado, confirmado |  |
| `rainbow` | 🌈 | Arcoíris | colores, alegria, suerte |  |
| `moon` | 🌙 | Noche | luna, nocturno, dormir |  |
| `umbrella` | ☔ | Imprevistos | lluvia, paraguas, emergencia, seguro |  |
| `clover` | 🍀 | Suerte | trebol, loteria, azar |  |
| `rocket` | 🚀 | Proyecto | cohete, emprendimiento, inicio, lanzamiento |  |
| `flag` | 🚩 | Marcador | bandera, destacar, pendiente |  |

Resumen: Dinero y ahorro 14; Bancos y tarjetas 14; Hogar 14; Alimentación 22; Transporte 16; Salud 14; Educación 12; Trabajo y negocios 14; Viajes 16; Compras 14; Entretenimiento 18; Tecnología 14; Mascotas 12; Familia 12; Deportes 16; Servicios 13; Otros 14. Total 249.
#### 6.17.3 Reglas visuales del selector

Todo reutiliza tokens existentes (`colors`, `spacing`, `radii`, `typography`, `sizes.touchMin`); no se crea ningún token ni color nuevo.

| Elemento | Regla |
| --- | --- |
| Glifo en la rejilla | 24 sp, `maxFontSizeMultiplier={1.5}`, centrado (igual que 6.15.4 y 6.16.3; el 22 sp de docs/007 §5.15 A.2 no se usa, para no crear un segundo tamaño). Emoji sin recolorear. Glifos de texto T (solo categorías): `colors.text`, no blanco (el fondo de la celda es claro). |
| Celda | ≥ 48 × 48 dp (`sizes.touchMin`), separación 8 dp (`spacing.sm`), radio `radii.md - 2`, columnas = `clamp(floor((ancho + 8) / 56), 4, 6)`. En la hoja a 360 dp (ancho 312): 5 columnas, celda ≈ 56 dp; a 320 dp: 5; a 412 dp: 6; con fuente ≥ 1.5: 4 y las celdas crecen en alto. El grupo más grande (Alimentación, 22) ocupa 5 filas (≈ 272 dp) a 360 dp; se desplaza dentro de la hoja. |
| Reposo | Fondo `surface`, borde 1.5 `border` (decorativo; el glifo y el nombre identifican la celda). Presionado: opacidad 0.85. |
| Seleccionado (3 señales, no solo color) | Fondo `brand100` + borde 3 dp `colors.text` + insignia «✓» (círculo `colors.text` de 16 dp en la esquina superior derecha, «✓» blanco 11 sp 800; decorativa) + `accessibilityState {selected: true}` + línea «Seleccionado: {nombre}» bajo la rejilla (`typography.small`, `text2`). El borde se pinta dentro de la caja: el tamaño no cambia al elegir. |
| Foco (TalkBack/teclado) | Anillo de 2 dp `colors.text`, como `useFocus`. |
| Chips de grupo | Fila de scroll horizontal, 17 chips; alto 48 dp, relleno horizontal 16, separación 8, radio `radii.pill`, texto `typography.brandLabel` (14/800) `colors.text`, una línea. Reposo: `surface` + borde 1.5 `border`. Activo: `brand100` + borde 3 dp `colors.text` + «✓ » antes del texto (la señal no es solo el color). Los chips no llevan emoji (evita ruido y duplicar glifos). Indicio de desplazamiento: dos flechas de 48 dp a los extremos de la fila (6.17.5; el chip parcial en el borde sigue ocurriendo pero ya no es la única señal); al abrir se desplaza hasta dejar el activo visible y centrado. Sin degradados ni sombras (barato de renderizar). Se ocultan mientras hay búsqueda. |
| Buscador | `TextInput` 48 dp, fondo `surface`, borde 1.5 `borderStrong` (3.58:1 sobre `surface`), texto `text`, marcador `text2` (7.62:1 sobre `surface`), radio `radii.md`. Botón «Borrar búsqueda» de 48 dp. |
| Fila «Ícono» del formulario | 56 dp; mosaico de 40 dp con el glifo a 24 sp (fondo `segBg` o el `tile` de la cuenta), texto «Ícono: {nombre}» `text` y «Cambiar» `brand700` (7.49:1 sobre `surface`). |
| Hoja | `Sheet tall` existente: `surface`, radio superior 24, asa 40 × 4, velo `depth.scrim`. Pie fijo con «Usar este ícono» (`primary`, 48) y «Cancelar» (`ghost`, 48), borde superior 1 `border`. Sin animación nueva. |
| Sin resultados | Texto `text2` centrado (7.62:1 sobre `surface`) y botón «Borrar búsqueda». |

Contrastes de la interfaz del selector, calculados con la fórmula WCAG (script del scratchpad): `text` sobre `surface` 16.49; `text` sobre `brand100` (`#D3EBF0`) 13.28; `text2` sobre `surface` 7.62; «✓» blanco sobre `text` 16.49; borde 3 dp `text` sobre `brand100` 13.28 (cumple 3:1); `borderStrong` sobre `surface` 3.58 (cumple 3:1). `brand100` frente a `surface` es solo 1.24:1: por eso el estado seleccionado NUNCA depende del fondo, sino del borde grueso, la insignia, el estado accesible y el texto «Seleccionado».

#### 6.17.4 Legibilidad del glifo sobre los 6 colores de acento

Un emoji es una imagen a color; WCAG 1.4.3 (texto) no lo mide como tal y 1.4.11 aplica solo a gráficos necesarios para entender la interfaz. Aquí el ícono **nunca es la única señal**: el nombre del ícono está en la fila del formulario, en «Seleccionado: {nombre}», y la etiqueta accesible lo repite. Aun así se midió el peor caso con colores de referencia de las fuentes de emoji habituales (contraste WCAG contra cada `tile`; el fondo de la celda del selector es `surface`/`brand100`, no el `tile`):

| Color de referencia | aguamarina | lavanda | albaricoque | celeste | rosa | limón | sobre `surface` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Blanco `#FFFFFF` | 1.31 | 1.50 | 1.36 | 1.40 | 1.45 | 1.25 | 1.00 |
| Gris claro `#CCD6DD` | 1.13 | 1.01 | 1.08 | 1.05 | 1.02 | 1.18 | 1.48 |
| Amarillo `#FFCC4D` | 1.15 | 1.00 | 1.10 | 1.07 | 1.03 | 1.20 | 1.50 |
| Verde `#77B255` | 1.94 | 1.69 | 1.86 | 1.80 | 1.75 | 2.03 | 2.54 |
| Azul `#55ACEE` | 1.89 | 1.65 | 1.81 | 1.75 | 1.70 | 1.97 | 2.46 |
| Rojo `#DD2E44` | 3.53 | 3.08 | 3.39 | 3.29 | 3.18 | 3.70 | 4.62 |
| Marrón `#C1694F` | 2.97 | 2.60 | 2.86 | 2.77 | 2.68 | 3.12 | 3.89 |
| Contorno gris `#66757F` | 3.64 | 3.18 | 3.50 | 3.39 | 3.28 | 3.81 | 4.76 |

Lectura honesta: los rellenos claros (blanco, amarillo, gris claro) no alcanzan 3:1 sobre ningún tono pastel, ni siquiera sobre blanco; los emojis de Android (Noto Color Emoji) llevan contorno oscuro, que sí supera 3:1 en los seis, pero **eso no se pudo verificar aquí** (no hay fuente de emoji en el entorno ni dispositivo). Reglas:

1. El glifo se mantiene a 24 sp en el selector y a 28 dp en la vista previa y `AccountCard` (6.16.3); no se reduce.
2. Lista de vigilancia para la prueba en dispositivo (riesgo de relleno claro): 🛁 🚽 🍦 💿 ⌛ 🍼 🍞 🧥 💍 🔦 ☔ 📓 📒 sobre `limon`, `lavanda` y `rosa`. Criterio: reconocible a 24 sp sin su etiqueta. Si falla alguno, se sustituye por otro emoji (la clave no cambia).
3. Plan alternativo si `mobile-ux-qa` reporta ilegibilidad generalizada sobre un `tile`: dibujar el glifo sobre un círculo `surface` de 40 dp dentro del mosaico (`surface` alcanza ≥ 1.48 y el contorno del emoji queda sobre blanco, no sobre pastel). No se aplica de entrada: cambia la apariencia de las tarjetas de cuenta ya aprobadas.
4. Glifos de texto T (solo categorías): blanco sobre `categoryFill` (≥ 3:1 por construcción, ya existente). En el selector, `colors.text` sobre `surface` 16.49 y sobre `brand100` 13.28.
5. El semántico de importes (verde ingreso, coral gasto) no se usa en ningún estado del selector; los emojis verdes o rojos del catálogo (💵 📈 💸 📉) no cambian esa regla: el color de importes sigue viniendo solo de `income` y `expense`.

Texto del título «Elegir ícono», chips y nombres: español, sin emojis en etiquetas del sistema.

#### 6.17.5 Flechas de grupos (PROPUESTA; paso 366; implementa docs/007 §5.15.1; sin cambios de código)

Dos botones, «Ver grupos anteriores» (izquierda) y «Ver más grupos» (derecha), en los extremos de la fila de chips. No se crea ningún token ni color nuevo. Contrastes calculados con la fórmula WCAG y los valores reales de `app/src/theme/tokens.ts` (script del scratchpad `/tmp/claude-1000/-workspaces-ControlGastos/9e6fdd20-d38f-4bb0-872c-8a0c3aad7f0f/scratchpad/c.py`).

**Glifo: figura dibujada, no texto (recomendado).** Comparación:

| Opción | Ventajas | Riesgos | Veredicto |
| --- | --- | --- | --- |
| Texto «‹» «›» (U+2039/203A) | Sin código de dibujo | El proyecto no carga Nunito (no hay `fontFamily` ni fuente en `app/`): se usaría la fuente del sistema, cuyo guillemet simple es pequeño, de trazo fino y de posición vertical variable según fabricante; escala con la fuente del sistema (el botón es de 48 dp fijos); en algunos teléfonos cae en una fuente de respaldo distinta. Los emojis de los chips de ícono y los chips (800) piden un trazo firme que ese glifo no garantiza | Descartado |
| Ícono vectorial (`@expo/vector-icons`, `react-native-svg`) | Calidad máxima | Dependencias no instaladas; decisión pendiente 15.2 | Descartado (no se introducen dependencias) |
| Figura dibujada con `View` | Idéntica en todo Android, independiente de fuentes y de la escala de fuente, trazo constante de 3 dp (a juego con el borde de 3 dp del chip activo), barata (una `View` sin imágenes ni librerías) | Hay que calibrar el centrado óptico | **Recomendado** |

Construcción del chevron: una `View` de 11 × 11 dp con solo dos bordes visibles de 3 dp `colors.text` y `rotate 45deg`. Flecha derecha «›»: `borderTopWidth: 3`, `borderRightWidth: 3`, `rotate: '45deg'`. Flecha izquierda «‹»: `borderBottomWidth: 3`, `borderLeftWidth: 3`, `rotate: '45deg'`. Otros bordes en 0; fondo transparente; `borderRadius: 1` (esquina apenas redondeada, afín a las esquinas suaves del resto). Tamaño visible resultante ≈ 8 dp de ancho × 16 dp de alto, proporcional al botón de 40 dp. Centrado óptico: `translateX` de -3 dp en «›» y +3 dp en «‹» (la masa de tinta queda en la punta); calibrar ±1 dp en el dispositivo. El glifo es decorativo (`importantForAccessibility="no"`, `accessibilityElementsHidden`); no usa `Text`, así que no crece con la fuente.

**Botón.**
- Zona táctil: `Pressable` de 48 × 48 dp (`sizes.touchMin`) que ocupa el hueco reservado de 48 dp de docs/007 §5.15.1; con fuente 200 % no cambia de tamaño.
- Forma visible: círculo de 40 dp centrado en la zona táctil (4 dp de margen a cada lado, dentro de los 48), `radii.pill`, fondo `colors.segBg`, borde 1.5 `colors.border`. Sin sombra ni elevación.
- Por qué así y no `surface` + `borderStrong` (propuesta inicial de docs/007): un borde `borderStrong` (3.58:1) más oscuro que el de los chips (`border`, 1.23:1) y una forma igual de blanca competirían con los chips y con el chip activo (borde de 3 dp). Un círculo relleno `segBg` se distingue de la píldora blanca de los chips por forma y relleno, y se lee como control (no como grupo) sin llamar más la atención que ellos. El 4 dp de margen añade además respiro frente al chip cortado que asoma junto a la flecha.
- La identidad de botón la da el glifo (≥ 3:1); el borde y el relleno son decorativos (como el borde de los chips, `segBg` frente a `surface` 1.15:1), igual que en el resto del selector, donde ninguna señal depende de un contraste decorativo.
- Estados: reposo como arriba; presionado `opacity: 0.85` (como `styles.pressed`; glifo sobre relleno compuestos 9.16:1); foco: `FocusRing` (anillo de 2 dp `colors.text`, `top/right/bottom/left: 2`, `borderRadius` 22, dentro de la zona de 48; envuelve el círculo de 40 sin pisarlo), visible con TalkBack/teclado; no disponible: `opacity: 0` y fuera de la exploración (docs/007), conserva el hueco, sin estado «deshabilitado gris» (no hay botón muerto). Sin animación propia.

**Contraste (valores reales).**

| Par | Relación | Umbral | Resultado |
| --- | --- | --- | --- |
| Glifo `text` `#17211F` sobre `segBg` `#F3EEE6` (reposo) | 14.28 | ≥ 3 (gráfico); ≥ 4.5 si se considerara texto | Cumple ambos |
| Glifo `text` sobre `surface` (si el fondo fuese blanco) | 16.49 | igual | Cumple |
| Glifo + relleno con opacidad 0.85 (presionado, `#3A4241` sobre `#F5F1EA`) | 9.16 | ≥ 3 | Cumple |
| Anillo de foco `text` sobre `surface` (hoja) | 16.49 | ≥ 3 | Cumple |
| `segBg` frente a `surface` (relleno decorativo) | 1.15 | no exigido (decorativo) | Informativo |
| `border` frente a `surface` / `segBg` | 1.23 / 1.06 | no exigido (decorativo) | Informativo |

Descartados por contraste: `text3` `#5F6B68` y `borderStrong` `#7E8A86` como color de glifo (más tenues; no hay motivo para bajar de `text`); `brand700` (reserva el color de marca para acciones/enlaces).

**Verificación de que no tapan chips.** La geometría es de tres hermanos en fila, no capas: [48][ScrollView `flex: 1`][48]. El círculo de 40 dp está dentro de su zona de 48 y el anillo de foco (≤ 48 dp) también; el contenido del ScrollView se recorta en sus propios bordes, nunca bajo una flecha. Anchos: 360 dp, hoja 312, ventana de chips 216; 412 dp, 268; 320 dp, 176; los 48 dp laterales sumados dejan 96 dp reservados. Un chip cortado por el borde del ScrollView queda a 4 dp (margen del círculo) del círculo y a 0 dp de la zona táctil, sin superponerse. Sin degradados, sombras ni elementos flotantes. La flecha invisible (`opacity: 0`) no se pinta y su hueco queda vacío, así que tampoco aparece un círculo «fantasma».

**Valores para implementar (resumen).** Zona 48 × 48; círculo 40, `radii.pill`, `colors.segBg`, borde 1.5 `colors.border`; chevron 11 × 11, borde 3 `colors.text`, `rotate 45deg`, `borderRadius` 1, `translateX` ∓3; presionado `opacity` 0.85; foco `FocusRing` (inset 2, borde 2 `colors.text`, `borderRadius` 22); no disponible `opacity` 0.

**Nota para coherencia con docs/007 §5.15.1.** Esa subsección fija para el botón fondo `surface`, borde 1.5 `borderStrong` y glifo de texto a 24 sp; esta subsección lo sustituye por círculo `segBg`, borde `border` y chevron dibujado (cierra la pregunta Q5 de docs/007). Debe alinearla `mobile-ux-designer` o quien coordina, junto con la zona de 48 dp (que no cambia).

## 7. Iconografía de categorías

Las categorías ya guardan `icono` (clave tipo Lucide) y `color`. Comparación:

| Opción | Dependencias | Calidad | Riesgo | Veredicto |
| --- | --- | --- | --- | --- |
| Emojis con tabla `icono` a emoji | Ninguna | Buena; varía algo entre fabricantes y versiones de Android | Bajo; `ellipsis` se resuelve con «⋯» | **Propuesta inicial** |
| PNG propios en `app/assets/categories/` | Ninguna | Consistente en todos los teléfonos | Hay que dibujar 11 a 14 y los nuevos íconos futuros no tienen imagen | Alternativa si el emoji no convence |
| `@expo/vector-icons` | Viene con muchos proyectos Expo, pero **no está instalado** (no figura en `app/package.json` ni en `node_modules`) | Alta, vectorial | Agregar dependencia; requiere verificar fuentes y, según el caso, nueva build | Decisión pendiente 15.2 |
| `react-native-svg` | Módulo nativo, **no instalado** | Máxima (también para dona y pestañas) | Nueva development build y APK | Decisión pendiente 15.2; recomendada solo si se aprueba una build nueva |

Propuesta: emoji (o glifo de texto blanco para `ellipsis` y `plus-circle`) sobre cuadrado redondeado de 40 dp con fondo `catFill` (sección 2.7), con un componente `CategoryIcon` (40 dp en listas; **32 dp** en el selector de Nuevo movimiento y en filas compactas, radio 10; el nombre de la categoría nunca depende del ícono ni se trunca en el selector, ver 6.7 y 6.12) que **desacopla** la imagen del nombre de la categoría. Si luego se aprueba `react-native-svg`, solo cambia `CategoryIcon`. Íconos de pestañas: en el prototipo son SVG de trazo propios; en la app, mientras no haya `react-native-svg`, usar emojis o glifos de texto equivalentes (🏠 📋 📅 📊 ⋯); decisión 15.2. La dona del prototipo está en SVG; sin `react-native-svg` se puede aproximar con barras apiladas horizontales (decisión 15.3).

## 8. Gráficos sin dependencias

La dona exige `react-native-svg`. Sin ella: (a) barra horizontal proporcional por categoría (ya existe en `ReportsScreen`) con la paleta nueva, o (b) una barra apilada de 100 % con leyenda. El prototipo muestra la dona como referencia de diseño; **su implementación depende de la decisión 15.3** y no debe darse por aprobada.


## 9. Ilustraciones de estados vacíos y guías contextuales (R5)

Vacío de cuentas: **la alcancía** (120 dp, oculta con fuente ≥ 175 %). Las demás, trazo simple de 96 dp sobre un círculo con el **tinte del módulo** y trazo en su tinta: movimientos (hoja con «+», ámbar `movTile`/`movInk`), filtros (embudo, azul `calTile`/`calInk`), gráfico (barras, violeta `repTile`/`repInk`), con acento amarillo. Ninguna usa ya el trazo verde de marca. Textos: docs/007 §7.2. Tono sereno, sin celebraciones.

### 9.1 Inventario de ilustraciones y recursos generados (R5, verificado con `file`)

Herramienta: ImageMagick 6.9 (`convert`, ya en el entorno; no se instaló nada). Fuentes SVG en `docs/design/assets/illustrations/src/`; PNG a **3x** (nítidos en xxhdpi) en `docs/design/assets/illustrations/`. Todos PNG RGBA con fondo transparente, sin `react-native-svg`: `<Image source={require(...)} />` los muestra directamente.

| Ilustración | Uso (docs/007 §5.12.F) | Archivo | Píxeles | Mostrar a | Estado |
| --- | --- | --- | --- | --- | --- |
| Hoja con «+» (ámbar) | Semana, cuenta recién creada, Historial vacío | `vacio-movimientos.png` | 288 x 288 | 96 x 96 dp | GENERADA |
| Embudo (azul) | Historial con filtros sin resultados | `vacio-filtros.png` | 288 x 288 | 96 x 96 dp | GENERADA |
| Barras (violeta, una amarilla) | Reportes sin movimientos | `vacio-reportes.png` | 288 x 288 | 96 x 96 dp | GENERADA |
| Etiqueta (ámbar, módulo Más) | Categorías sin categorías | `vacio-categorias.png` | 288 x 288 | 96 x 96 dp | GENERADA; NO figuraba en esta sección: es una propuesta nueva (docs/007 §5.12.H.1) y requiere aprobación; sin ella queda el emoji 🏷️ |
| Alcancía (con hojas y moneda) | Mis cuentas sin cuentas o solo archivadas | `vacio-alcancia.png` | 360 x 360 | 120 x 120 dp | GENERADA a partir de `adaptive-icon-foreground.png` (recortada al contenido, con 12 dp de margen interno por lado a 360 px, sin la zona segura del ícono). Es raster de 106 KB; no contiene texto |
| Calendario compacto | Mes/día sin movimientos | ninguna | — | — | Sin ilustración por diseño (`compact`) |

Peso total de los cinco PNG: unos 150 KB. Los círculos de tinte van **dentro** del PNG (dibujo completo en 96 dp); la alcancía no lleva círculo.

Verificación honesta: dimensiones, formato y transparencia comprobados (`file` y lectura del pixel de esquina con alfa 0); revisión visual de una tira con los cinco PNG sobre blanco. NO se probó dentro de la app ni en un dispositivo. El render de ImageMagick no tiene anti-alias de subpíxel perfecto, pero a 3x es suficiente.

**Recomendación: (a) empaquetar en `app/assets/illustrations/`.** Motivo: los PNG existen, son estáticos y se enlazan con `require` (Metro los empaqueta como cualquier asset de JS); no se toca `app.json`, no hay módulo nativo y no exige build nueva (es un cambio solo de JS/assets, entra en una actualización OTA o en la siguiente build sin condiciones adicionales). Costo: unos 150 KB en el paquete y una nota de renombrado (copiar sin cambiar nombres). Riesgo: la etiqueta de Categorías no está aprobada (si no se aprueba se omite el archivo y se conserva el emoji, un solo caso); la alcancía en Mis cuentas es la que docs/003 R4 D6.5 difiere a R6: **su PNG ya existe y puede usarse en R5 si el usuario lo decide; si no, el vacío de Mis cuentas conserva el círculo con 🐷/glifo hasta R6**. Alternativa (b), emoji hasta R6: sin riesgo ni peso, pero R5 pierde la parte visual de los vacíos y no cumple docs/007 §5.12 H.1 (a).

Contrato de `<Image>`: `source={require('../../assets/illustrations/vacio-movimientos.png')}`, `style={{ width: 96, height: 96 }}` (120 para la alcancía), `resizeMode="contain"`, `accessible={false}`, `importantForAccessibility="no"`, `accessibilityElementsHidden`, sin `accessibilityLabel`. Un `Image` sin `width`/`height` explícitos no se muestra: son obligatorios. Mapa sugerido: `art: 'movimientos' | 'filtros' | 'reportes' | 'categorias' | 'alcancia'` (cadena, no la ruta) en `EmptyState`.

### 9.2 Guía contextual (`GuideCard`; implementa docs/007 §5.12.B y C)

- **Superficie:** fondo `moduleColors[módulo].tile` (Mis cuentas y Crear cuenta: `cuenta`; Detalle de cuenta: `cuenta`; Nuevo movimiento: `movimientos`; Calendario: `calendario`; Reportes: `reportes`; Categorías: `mas`). Sin borde y sin sombra (no es error ni elemento elevado): se distingue del fondo por el tinte, el radio 16 (`radii.lg`) y el icono. Es una tarjeta dentro del contenido con scroll, nunca flotante.
- **Medidas:** ancho completo de la columna (margen lateral 16 dp con ancho < 400 dp, 20 dp desde 400 dp, igual que la pantalla); relleno 16 dp (12 dp vertical abajo); separación 12 dp entre elementos; margen inferior 16 dp. Posición: justo bajo el título o la barra de contexto y antes del contenido (docs/007 §5.12.G.3). Altura libre (nunca fija).
- **Contenido:** fila superior: mosaico de 28 dp con radio 8 y fondo `surface` (círculo de apoyo) con el glifo de «ayuda» «💡» de 16 sp (decorativo, `importantForAccessibility="no"`), texto `typography.body` en `colors.text` (alineado a la izquierda, sin truncar, `flex: 1`), y a la derecha [✕]. [✕]: zona de 48 x 48 dp (`minWidth`/`minHeight` 48), glifo «✕» de 18 sp en `ink` del módulo, `accessibilityLabel="Cerrar ayuda"`, `accessibilityRole="button"`, desplazado con margen negativo de 8 dp arriba/derecha para no agrandar la tarjeta. Fila inferior: [Entendido] `secondary` (alto mínimo 48, texto `brand700`, relleno `surface`, borde 2 `brand700`), alineada a la izquierda con ancho natural.
- **Fuente grande:** ≥ 130 %: [Entendido] a ancho completo; ≥ 175 %: se oculta el mosaico «💡», el texto y los dos botones se conservan (nunca se oculta una guía), [✕] se mantiene arriba a la derecha.
- **Animación mínima:** aparición con opacidad 0 a 1 en 180 ms (igual a «aparición de pantalla», §10) y al descartar, opacidad 1 a 0 en 120 ms con `useNativeDriver: true` y luego se desmonta; sin movimiento ni cambio de altura animado (la pantalla debajo salta una sola vez, es aceptable y barato). Con movimiento reducido (`AccessibilityInfo.isReduceMotionEnabled`): sin animación. Regla de memoria: la tarjeta desaparece al instante en el estado aunque la animación no termine.
- **Contraste verificado** (`node docs/design/contrast.js --check`, salida 0, 115 pares, mínimo texto 4.60:1, mínimo componente 3.47:1): `text` sobre los cinco `tile` entre 13.28 y 14.07:1; «✕» (`ink`) sobre `cuentaTile` 8.12:1 (el resto de módulos 7.19 a 8.41:1 por los pares de §3.1); borde y texto de [Entendido] `brand700` sobre los cinco `tile` entre 6.03 y 6.39:1; el relleno de [Entendido] es `surface` (texto `brand700` 8.4:1 verificado en §3.1). Sin ningún color nuevo: tokens existentes.
- **Semántica:** no usa verde ni coral (no es dinero ni error). No es `alert` ni región viva (docs/007 §5.12.G.3).

### 9.3 Composición de `EmptyState` y de cada vacío (implementa docs/007 §5.12.F)

Estructura (columna centrada, `alignItems: 'center'`, `gap` 12, relleno 16, margen lateral de pantalla 16/20): ilustración (96 dp; 120 dp la alcancía; el espacio entre dibujo y título es 12 dp, 16 dp con alcancía) > título `typography.h2` (si existe, `colors.text`, centrado, máx. ancho 320 dp) > mensaje `typography.body` `colors.text2` centrado (máx. ancho 320 dp, sin truncar) > acción (`Button`, ancho natural, mínimo 48 dp; 52 dp `tall` solo para «Crear mi primera cuenta»). Separación vertical entre bloques de pantalla: 16. Altura mínima del bloque 120 (ya existe). Con `fontScale >= 1.75`: sin ilustración y sin hueco reservado; título y mensaje crecen con la fuente, el bloque se desplaza con el scroll de la pantalla y el botón queda a ancho completo (alto mínimo 48). Ilustración siempre decorativa (9.1).

| Estado | Ilustración | Título | Mensaje | Acción |
| --- | --- | --- | --- | --- |
| Mis cuentas sin cuentas | Alcancía 120 dp (o círculo con emoji hasta R6, ver 9.1) | «Todavía no tienes cuentas» | «Una cuenta es el lugar donde anotas tu dinero: efectivo, banco o tarjeta.» | [Crear mi primera cuenta] `primary` `tall` (52 dp), ancho completo hasta 320 dp |
| Mis cuentas, solo archivadas | Alcancía 120 dp | (sin título) | «No tienes cuentas activas. Puedes crear una o desarchivar una de las anteriores.» | [Crear mi primera cuenta] `primary` `tall` |
| Semana (recién creada o sin movimientos) | `vacio-movimientos` 96 dp | «Tu cuenta está lista.» / «Esta semana no has anotado movimientos.» | «Anota tu primer gasto o ingreso con el botón +.» / «Toca + para registrar el primero.» | Ninguna (FAB) |
| Semana filtrada sin resultados | Ninguna (`compact`) | — | «Esta semana no tienes gastos/ingresos anotados.» | Ninguna |
| Historial vacío | `vacio-movimientos` | «Aún no hay movimientos» | «Cuando anotes el primero, aparecerá aquí.» | Ninguna (FAB) |
| Historial filtrado | `vacio-filtros` | — | «Ningún movimiento coincide con estos filtros.» | [Limpiar filtros] `secondary` |
| Calendario, mes o día vacío | Ninguna (`compact`): texto `body` `text2` centrado, relleno vertical 12, sin círculo | — | «No hay movimientos en este mes.» / «Este día no tiene movimientos registrados.» | «+ Anotar en este día» `secondary` (existente) |
| Reportes vacío | `vacio-reportes` | — | «Sin movimientos en este período. Prueba con otro mes/otro año/otro rango.» | Ninguna |
| Categorías vacío | `vacio-categorias` (si se aprueba) | — | «Aún no tienes categorías de gasto/ingreso. Crea la primera.» | Ninguna |

Notas: con la guía visible arriba (Reportes, Calendario, Detalle) la guía va primero y el vacío debajo sin repetir la frase (docs/007 §5.12.C). `compact` no deja ningún hueco reservado para la ilustración. El título (`h2`) solo existe en los tres casos donde el texto de docs/007 lo trae como frase propia; en el resto el mensaje va solo.

### 9.4 Sección «Ayuda» en Más y su aviso (docs/007 §5.12.D)

- Posición: entre «Cuenta» y «Sesión». Encabezado de sección igual a los demás de Más (`sectionHeader` existente de `MoreScreen`: `typography.small` 800 en `colors.text2`, margen superior 12).
- Fila: misma fila `Row` que el resto de Más (lista `surface` de radio 16, alto mínimo 56 y toda la fila táctil); mosaico de 36 dp con radio 10 y tinte `moduleColors.mas.tile`, glifo «💡» de 20 sp (se oculta con fuente ≥ 175 %); título «Ver ayudas otra vez» en 15/700 `colors.text` (el estilo real aprobado de las filas de Más; se unifica aquí en el paso 353, sustituyendo 16/600 y radio 12 que contradecían «mismo estilo»); subtítulo «Vuelve a mostrar las guías que cerraste.» `typography.small` en `colors.text2`; chevron «›» en `text2` a la derecha. Sin color de acción ni de énfasis.
- Estados: normal; presionada (opacidad 0.85); `busy` (indicador pequeño `ActivityIndicator` de 20 dp en lugar de «›», fila deshabilitada, sin cambiar de tamaño); error.
- Aviso de éxito: `Snackbar` existente, texto «Listo. Verás las ayudas otra vez.» (fondo `text`, texto blanco, 3 s, sin acción). Error: «No pudimos restablecer las ayudas. Inténtalo de nuevo.» como `ErrorBox` (fondo `expenseSoft`, texto `expenseText`, 5.17:1) bajo la fila, la fila se reactiva.
- Contraste: título `text` y subtítulo `text2` sobre `surface` (pares de §3.1).

## 10. Microinteracciones baratas (`Animated` nativo)

Sin librerías, con `useNativeDriver: true`:

- Escala 1 a 0.97 al presionar botones y tarjetas (100 ms).
- Aparición de pantalla: opacidad 0 a 1 (180 ms).
- Snackbar: sube 12 dp y aparece (250 ms); desaparece a los 3 s.
- Píldora de pestaña: cambio de fondo (150 ms).
- Indicador de recarga del saldo: giro simple de 12 dp (`ActivityIndicator` nativo, sin librerías) solo mientras se relee.
- Desactivar todas si el sistema pide movimiento reducido (`AccessibilityInfo.isReduceMotionEnabled`). Sin animaciones continuas, sin parpadeos, sin confeti.


## 11. Tokens (bloque TypeScript propuesto)

Para un futuro `app/src/theme/tokens.ts` (se vuelca en la fase R1 de docs/009; lo implementa `mobile-engineer`; docs/003 Decisión R0 D8). Valores idénticos a `docs/design/contrast.js` y al `:root` del prototipo.

```ts
export const colors = {
  // marca: SOLO acción primaria, FAB, tarjeta de saldo, foco, botón secundario y enlaces
  brand800: '#0B4A46',
  brand700: '#0F5F5A',
  brand500: '#1F8A80', // solo decorativo (banda al 35 %)
  brand100: '#D3EBF0',
  brandInk: '#0B4A46',
  onBrandSoft: '#E6F7F4',
  // superficies y texto
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  segBg: '#F3EEE6',
  text: '#17211F',
  text2: '#4B5653',
  text3: '#5F6B68',
  border: '#EEE7DC',
  borderStrong: '#7E8A86',
  // semánticos (fijos)
  income: '#12804A', incomeText: '#0E6A3D', incomeSoft: '#D9F4E4',
  expense: '#D13A2F', expenseText: '#B42A20', expenseSoft: '#FFE1D9',
  // acento
  yellow: '#FFC93C', yellowSoft: '#FFF1C2', yellowText: '#6B4E00',
  white: '#FFFFFF',
} as const;

// Color por módulo (docs/007 §3.6). Nunca en la barra de contexto, importes ni FAB.
export const moduleColors = {
  cuenta: { tile: '#D3EBF0', ink: '#0B4A46' },
  movimientos: { tile: '#FFEDA6', ink: '#5C4000', strong: '#F5A524' }, // ámbar ≠ coral de gasto
  calendario: { tile: '#DCEBFF', ink: '#174C86', strong: '#2563C9' },
  reportes: { tile: '#ECE4FF', ink: '#4E2DA3' },
  mas: { tile: '#E3E8EF', ink: '#334155' }, // también Categorías
} as const;

// Paleta de cuentas (docs/007 §5.2.4). Índice = accountColorIndex(id).
export const accountPalette = [
  { name: 'aguamarina', card: '#E3F6F8', tile: '#BDE9EF' },
  { name: 'lavanda', card: '#F0EBFF', tile: '#D9CCFF' },
  { name: 'albaricoque', card: '#FFF0E0', tile: '#FFD6A8' },
  { name: 'celeste', card: '#E7F1FF', tile: '#C5DBFF' },
  { name: 'rosa', card: '#FDEAF2', tile: '#F8CADD' },
  { name: 'limón', card: '#FFF6D6', tile: '#FFE58A' },
] as const;
// export function accountColorIndex(id: string): number  -> hash de cadena (x = (x * 31 + charCode) >>> 0) mod 6.
// Pura, en lib/ (p. ej. lib/account-appearance.ts, nombre a confirmar), con prueba unitaria: 'a1' -> 2, 'a2' -> 3, 'a4' -> 5.
// export function accountIcon(nombre: string): 'tarjeta' | 'banco' | 'alcancia' | 'billetera'  -> por palabra clave.

// Capas decorativas (View con opacity), verificadas compuestas en docs/008 §3.
export const depth = {
  bandColor: colors.brand500, bandOpacity: 0.35, bandRotate: '-16deg',
  circleColor: colors.white, circleOpacity: 0.08,
  accountCardCircleOpacity: 0.45,
  blobs: [
    { color: '#FFD966', opacity: 0.35 }, // amarillo
    { color: '#FFB59A', opacity: 0.25 }, // melocotón
    { color: '#9CC4FF', opacity: 0.25 }, // celeste
  ],
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16, accountCard: 20, xl: 24, pill: 999 } as const;

export const typography = {
  amountXl: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  rootTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  totalAmount: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  accountBalance: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  accountName: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  greeting: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  brandLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  tab: { fontSize: 11.5, lineHeight: 14, fontWeight: '700' },
} as const;

export const elevation = { card: 1, raised: 4 } as const;
export const sizes = {
  touchMin: 48, tabHeight: 62, contextBar: 56, contextBarCompact: 36, fab: 56, primaryTall: 52,
  accountCardMin: 88, accountCardMinWide: 92, accountIcon: 52, avatar: 40,
  // APROBADOS como valores iniciales (docs/003 Decisión R0 D8; valores del prototipo, docs/007 §10): tabMinWidth 48, tabPillPadX 10, chipSmHeight 36, chipHitSlop 6, segmentOption 48, categoryOptionMin 56, calendarCellHeight 52. El relleno horizontal de la pestaña (2 dp, §6.8) no tiene token propio por ahora
  tabMinWidth: 48, tabPillPadX: 10, chipSmHeight: 36, chipHitSlop: 6, segmentOption: 48, categoryOptionMin: 56, calendarCellHeight: 52,
  headerPig: 72, headerPigWide: 96, headerPigLargeFont: 48, pigZoom: 1.4, balanceCardMin: 132, balanceCardPig: 104,
} as const;

// Fondo del cuadrado de categoría: color de la API oscurecido (mezcla con negro, pasos de 1 %) hasta 3:1 con blanco.
// export function categoryFill(hex: string): string  -> la implementa mobile-engineer, con prueba unitaria.
export const categoryFillExpected: Record<string, string> = {
  '#F97316': '#EF6E15', '#3B82F6': '#3B82F6', '#EAB308': '#B98D06', '#EF4444': '#EF4444',
  '#8B5CF6': '#8B5CF6', '#14B8A6': '#12A695', '#EC4899': '#EC4899', '#6B7280': '#6B7280',
  '#22C55E': '#1DA951', '#06B6D4': '#05A2BD', '#84CC16': '#6AA312',
};

// Glifo por clave `icono` (api/src/services/default-categories.ts). `text: true` = glifo de texto blanco.
export const categoryGlyph: Record<string, { glyph: string; text?: boolean }> = {
  utensils: { glyph: '🍽️' }, bus: { glyph: '🚌' }, lightbulb: { glyph: '💡' }, 'heart-pulse': { glyph: '🩺' },
  'graduation-cap': { glyph: '🎓' }, home: { glyph: '🏠' }, film: { glyph: '🎬' }, ellipsis: { glyph: '⋯', text: true },
  briefcase: { glyph: '💼' }, 'shopping-bag': { glyph: '🛍️' }, 'plus-circle': { glyph: '＋', text: true },
};
export const defaultCategoryGlyph = { glyph: '🏷️' };
```

## 12. Componentes reutilizables (para `mobile-engineer`)

| Componente | Responsabilidad | Estados y variantes |
| --- | --- | --- |
| `Screen` | Safe areas (docs/007 §9, opción A), fondo `bg`, `KeyboardAvoidingView` y scroll; barra de estado `bg` (Bienvenida, Mis cuentas, Crear cuenta) o `surface` (pantallas con barra de contexto) | normal, con barra inferior, con teclado |
| `DecorBlobs` | Manchas de fondo (2.6), `pointerEvents="none"`, ocultas a accesibilidad | Bienvenida, Mis cuentas |
| `AccountsHeader` | Marca + avatar + saludo + título + alcancía (6.1) | normal, sin nombre («Hola»), fuente grande (alcancía 48), muy grande o estrecha (sin alcancía) |
| `ProfileSheet` | Hoja de perfil con nombre, correo y Cerrar sesión (14.17) | abierta, cerrando sesión |
| `AccountsTotal` | Resumen «Total en tus cuentas» (6.2) | visible (≥ 2), con archivadas, negativo; oculto en carga/error/vacío |
| `AccountCard` | Tarjeta de cuenta con color e ícono estables (6.3) | normal, presionada, saldo negativo, nombre largo, archivada, esqueleto de carga |
| `Header` | Título de pantalla de pila con salida («✕», «‹») | simple |
| `ScreenTitle` | Título con `ModuleTile` y subrayado amarillo; `role=header` | por módulo |
| `ModuleTile` | Cuadrado de 36 dp con el color del módulo (2.3) | 36, 28 dp |
| `AccountContextBar` | Barra neutra (6.9); solo props | completa, solo lectura, compacta; normal, recargando, error, archivada, nombre largo, negativo, estrecha |
| `DepthLayers` | Banda + círculos con `opacity` | tarjeta de saldo |
| `BalanceCard` | Saldo grande sobre `brand700` + alcancía (6.4) | normal, recargando, error, sin ilustración |
| `SummaryTile` | Ingresos / Gastos / Neto / Balance claros (6.5) | `income`, `expense`, `neutral`; cargando; sin datos |
| `CategoryIcon` | Cuadrado `catFill` con emoji o glifo blanco | 32 dp (selector de Nuevo movimiento, radio 10), 40 dp (listas, radio 12); archivada (opacidad 0.5) |
| `CategoryOption` | Opción del selector de Nuevo movimiento (6.7, D2): 2 columnas, alto mín. 56 que crece, nombre hasta 2 líneas | normal, elegida (tinte del tipo, «✓»), presionada |
| `TransactionRow` | Ícono, texto e importe con signo | ingreso, gasto, anulado, presionada |
| `Button` | primary, secondary, danger, dangerSolid, ghost; `tall` (52) | normal, presionado, deshabilitado, cargando |
| `Chip` | Selección con «✓»; tono neutro, de módulo o de tipo | normal 48 dp, `sm` de filtro (36 dp visibles, `hitSlop` 6 dp, P-1), elegido, filtro activo (✕), deshabilitado |
| `Segmented` | Neutro, de módulo (Reportes, Movimientos) o de tipo Gasto/Ingreso; opciones de 48 dp (P-2) | normal, elegido («✓»), deshabilitado |
| `Field` | Etiqueta + campo + ayuda + error | normal, foco, error, deshabilitado, solo lectura |
| `AmountInput` / `Keypad` | Monto con signo y teclado numérico estricto | vacío, con valor, error |
| `BottomTabBar` | 5 pestañas con color por módulo; ícono sobre etiqueta completa, `flex: 1 1 auto`, `minWidth` 48, píldora de 10 dp (6.8, D1) | activa, inactiva, etiqueta en dos líneas con fuente grande |
| `Fab` | «+ Nuevo movimiento» `brand700` con «+» amarillo | normal, presionado, deshabilitado con nota |
| `EmptyState` | Ilustración + título + texto + acción | por pantalla (docs/007 §7.2) |
| `Snackbar`, `ConfirmDialog`, `Guide`, `ErrorBox` | Sin cambios de comportamiento; re-estilizados con la paleta | como en la iteración 2 |

Compatibilidad con pruebas: conservar `accessibilityLabel` y `testID` de docs/007 §12 (la etiqueta «Nueva cuenta» del botón primario ya existe en `AccountsScreen.test.tsx`).

## 13. Especificación del ícono Android

Recursos generados desde la imagen aprobada (verificados, ver 13.1). Rutas destino futuras en `app/assets/` (la carpeta hoy **no existe**; no se creó):

| Archivo en `docs/design/assets/` | Destino futuro | Formato y medida | Uso |
| --- | --- | --- | --- |
| `icon.png` | `app/assets/icon.png` | PNG 1024x1024, RGB, **sin canal alfa**, cuadrado completo | Ícono principal de Expo |
| `adaptive-icon-foreground.png` | `app/assets/adaptive-icon-foreground.png` | PNG 1024x1024 RGBA, arte dentro del 62 % central (zona segura Android 66 %) | `android.adaptiveIcon.foregroundImage` |
| `adaptive-icon-background.png` | `app/assets/adaptive-icon-background.png` | PNG 1024x1024 verde sólido `#0F5F5A` (color del ícono aprobado; desde la iteración 3 es exactamente `brand700`) | Fondo adaptable (o usar `backgroundColor`) |
| `adaptive-icon-monochrome.png` | `app/assets/adaptive-icon-monochrome.png` | PNG 1024x1024 RGBA, silueta blanca sobre transparente | `android.adaptiveIcon.monochromeImage` (ícono temático Android 13+) |
| `splash-icon.png` | `app/assets/splash-icon.png` | PNG 1024x1024 RGBA, arte al 78 % | `expo-splash-screen` |
| `favicon.png` | `app/assets/favicon.png` | PNG 48x48 | Solo web; opcional (la app es Android) |

Cambios futuros de `app.json` (**no aplicados**; dependen de la versión de Expo instalada, `expo ~57`; confirmar en la documentación de esa versión):

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "package": "com.cuidatubilletera.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon-foreground.png",
        "backgroundImage": "./assets/adaptive-icon-background.png",
        "monochromeImage": "./assets/adaptive-icon-monochrome.png",
        "backgroundColor": "#0F5F5A"
      }
    },
    "plugins": [
      "expo-status-bar", "expo-secure-store", "expo-sharing",
      ["expo-splash-screen", { "image": "./assets/splash-icon.png", "imageWidth": 200, "backgroundColor": "#0F5F5A" }]
    ]
  }
}
```

`expo-splash-screen` puede no estar instalado: agregarlo es una dependencia nueva (decisión 15.6).

**Qué exige nueva build:** ícono, ícono adaptable, monocromático y splash son recursos nativos: **cambiarlos exige una nueva build** de Android (development build y APK de EAS); no se actualizan con una actualización de JavaScript ni con Expo Go. El color de la barra de estado, los tokens y los componentes sí se prueban con la build actual.

### 13.1 Verificación y limitaciones de los recursos

Verificados con `identify` y con inspección visual: dimensiones, canal alfa y peso en la tabla de abajo.

| Archivo | Medida | Alfa | Peso |
| --- | --- | --- | --- |
| `icon.png` | 1024x1024 | no | 606 746 B |
| `adaptive-icon-foreground.png` | 1024x1024 | sí | 422 026 B |
| `adaptive-icon-background.png` | 1024x1024 | no | 16 050 B |
| `adaptive-icon-monochrome.png` | 1024x1024 | sí | 32 557 B |
| `splash-icon.png` | 1024x1024 | sí | 610 603 B |
| `favicon.png` | 48x48 | no | 3 997 B |

Limitaciones honestas:

1. **La imagen de origen es de baja resolución real** (arte reescalado, bordes algo borrosos). Sirve para el diseño y la revisión; para publicar se recomienda regenerar el arte en vector o a 1024 nativos.
2. **`icon.png` no es el recorte literal** de la imagen aprobada: el recorte con esquinas redondeadas dejaba costuras al rellenar las esquinas. Se recompuso: fondo de degradado vertical `#11706A` a `#0B534F` (dibujado) + la alcancía, hojas, moneda y destellos recortados y ampliados. Resultado fiel en motivo y colores, no pixel a pixel.
3. El recorte del sujeto sobre el verde se hizo por distancia de color: es fiable para la alcancía, la moneda y los destellos (revisado sobre fondo magenta), pero queda un halo/sombra mínima en los pies de la alcancía.
4. El monocromático es una silueta sólida (sin ojos ni detalles). Funciona para el ícono temático, pero un monocromático diseñado a mano (con ojos y ranura) sería mejor.
5. No se probó en un dispositivo ni en un lanzador Android real.


## 14. Prototipo y verificación visual

`docs/design/prototipo/index.html`: un solo archivo, CSS y JS inline, sin red; usa `../assets/adaptive-icon-foreground.png` (alcancía: bienvenida, encabezado de Mis cuentas, cuenta de ahorro, tarjeta de saldo, vacío de cuentas). Aviso «Datos de ejemplo», casilla «Simular error al releer el saldo» y **selector de tamaño** (360 × 640, 390 × 800, 412 × 915). Sin gradientes CSS. Las medidas de componentes son variables CSS del `:root` (`--hdr-pig`, `--acc-card-min`, `--acc-ico`, `--btn-h`, etc.), las mismas que lee el render.

Pantallas (flujos y textos aprobados sin cambios): Bienvenida, Mis cuentas (encabezado con avatar y alcancía, Total, tres cuentas de colores con nombre largo, Archivadas colapsadas, hoja de perfil), Crear cuenta, Detalle con 5 pestañas, Datos de cuenta, Opciones avanzadas, Categorías y Nuevo movimiento. Cambios de contenido respecto a la iteración 2, todos tomados de docs/007 §5.2 (recién actualizado): «+ Crear cuenta» pasa a «+ Nueva cuenta»; «Cerrar sesión» sale de la lista y va a la hoja de perfil del avatar (Más lo conserva); aparece el Total (14.16) y la guía «Toca una cuenta para anotar sus gastos e ingresos.» bajo la lista.

### 14.1 Verificación funcional y de color (jsdom, scripts fuera del repositorio, en el scratchpad de la sesión)

- `verify.js` (el de la iteración 2, sin cambios): **56 comprobaciones, 0 fallas, 0 errores de JavaScript**. Incluye la barra de contexto con el nombre correcto en cada pantalla interna (Cuenta, Movimientos, Calendario, Reportes, Más, Datos de cuenta, Categorías en solo lectura, Nuevo movimiento compacta), su ausencia en Bienvenida/Mis cuentas/Crear cuenta, el **saldo que cambia de $1,888.50 a $1,876.00 tras guardar un gasto de $12.50** (con indicador durante la relectura), error de relectura con Reintentar, renombrar, archivar y cuenta archivada con FAB deshabilitado.
- `audit.js` (nuevo): **29 comprobaciones, 0 fallas**. Recalcula la cascada de `background` del CSS (jsdom no resuelve `var()`) y clasifica los fondos de la familia verde/marca (tono HSL 85-182°, saturación ≥ 0,20). Resultados: Bienvenida, **ningún** fondo verde; Mis cuentas, **solo** `button.btn.primary «+ Nueva cuenta»` (`#0F5F5A`); **3 colores de tarjeta distintos** para 3 cuentas (albaricoque `#FFF0E0`, celeste `#E7F1FF`, limón `#FFF6D6`) y ninguno verde; crear «Tarjeta de crédito» no cambia el color de las demás (la nueva sale rosa con 💳); Total = $5,981.50, sin archivadas; avatar abre la hoja y «Cerrar» la cierra; barra de contexto **`#FFFFFF` idéntica** en las 5 pestañas y en Nuevo movimiento; FAB `#0F5F5A` igual en Cuenta, Movimientos y Calendario; píldora activa con **5 colores de módulo**; en Cuenta el verde fuerte está solo en la tarjeta de saldo y el FAB; en Movimientos/Calendario solo el FAB; en Reportes y Más ninguno (aparte de cuadrados de categoría de la API como Hogar o Sueldo y la burbuja semántica de Ingresos, que se listan como permitidos); segmentado de Reportes en violeta; «Gasto»/«Ingreso» en coral/verde suave.

### 14.2 Renders aproximados (`docs/design/capturas/`)

**No son capturas de navegador** (no hay navegador headless en el entorno y no se instaló ninguno). Son SVG generados por un script (`render.js`, scratchpad) que lee los **tokens y medidas del `:root`** del HTML y el **contenido real del DOM** del prototipo con jsdom (nombres, saldos, filas de la semana), y se rasterizan con `sharp` (librsvg). Aproximaciones: fuente DejaVu Sans escalada en horizontal al ancho estimado de Roboto; emojis sustituidos por íconos vectoriales simples (billetera, banco, tarjeta) y letras blancas en los cuadrados de categoría; sombras simplificadas; estado tras descartar las guías del Detalle. Sirven para juzgar composición, color y proporción, no el píxel exacto.

| Archivo | Contenido |
| --- | --- |
| `mis-cuentas-360.png`, `mis-cuentas-412.png` | Mis cuentas, iteración 3 |
| `detalle-360.png`, `detalle-412.png` | Detalle, pestaña Cuenta (Efectivo), iteración 3 |
| `bienvenida-360.png`, `bienvenida-412.png` | Bienvenida, iteración 3 |
| `antes-mis-cuentas-360.png`, `antes-detalle-360.png`, `antes-bienvenida-360.png` | Las mismas pantallas de la iteración 2 (de `prototipo-antes.html`), para comparar |

## 15. Decisiones pendientes del usuario

| # | Decisión | Propuesta |
| --- | --- | --- |
| 15.0 | **Paleta y composición.** Iteración 1 **RECHAZADA**; iteración 2 **RECHAZADA (segunda vez)** por dominancia del verde. Iteración 3 **APROBADA con el diseño (paso 347, docs/003 Decisión R0 D6)**: secciones 1, 2, 6 y 11 (fondos casi blancos con manchas, verde solo en acción primaria/FAB/tarjeta de saldo, color por módulo, cuentas de colores) | **APROBADA** (paso 347, docs/003 Decisión R0 D6) |
| 15.1 | Fuente de marca (dependencia `expo-font`) | No: solo fuentes del sistema |
| 15.2 | Íconos de categorías, cuentas y pestañas: emoji, PNG propios, `@expo/vector-icons` o `react-native-svg` | Emoji ahora (alcancía PNG para ahorro); revisar con una build nueva |
| 15.3 | Dona en la app (exige `react-native-svg`) o barras apiladas | Barras apiladas hasta aprobar svg |
| 15.4 | Paleta del selector de color de categorías | Usar los 11 colores iniciales + 3 extras |
| 15.5 | Degradado en la tarjeta de saldo | **Resuelta por `architect`**: sin `expo-linear-gradient`; capas semitransparentes |
| 15.6 | Splash con `expo-splash-screen` y cambio de `app.json` (nueva build) | Aprobar junto con la build de rediseño |
| 15.7 | Regenerar el ícono en vector o a 1024 nativos | Sí, antes de Play Store |
| 15.8 | Rojo de gasto también como «peligro» | Sí |
| 15.9 | `catFill` frente a glifo oscuro sobre el color crudo | `catFill` |
| 15.10 | Alcancía en la tarjeta de saldo | Sí; oculta con fuente grande o pantalla estrecha |
| 15.11 | Tonos por módulo (2.3): ámbar `#FFEDA6`/`#5C4000`, azul `#DCEBFF`/`#174C86` (+ `#2563C9`), violeta `#ECE4FF`/`#4E2DA3`, pizarra `#E3E8EF`/`#334155`, Cuenta `#D3EBF0`/`#0B4A46` | Aprobar; si en la prueba se confunden con ingreso/gasto, el módulo usa su tono solo en la píldora (3.2) **APROBADA (paso 347)** |
| 15.12 | Paleta de 6 tonos de cuentas (2.4), sin menta ni coral | Aprobar (depende de 14.18 y 14.19 de docs/007) **APROBADA (paso 347); el ícono de cuenta (14.19) sigue abierto** |
| 15.13 | Bienvenida clara con la alcancía en lugar del panel verde a sangre del póster | Sí (es la queja principal del usuario) **APROBADA (paso 347)** |
| 15.14 | Barra de contexto blanca neutra (antes `brand100` verde) | Sí (docs/007 §3.6: la barra no se tiñe) **APROBADA (paso 347)** |

## 16. Comparación visual iteración 2 → 3

### 16.1 Por pantalla y elemento

| Pantalla / elemento | Iteración 2 (rechazada) | Iteración 3 (propuesta) |
| --- | --- | --- |
| Bienvenida: fondo | `brand800` a sangre con banda y círculos (verde en ~90 % de la pantalla) | `bg` casi blanco con 3 manchas (amarilla, celeste, melocotón) |
| Bienvenida: logotipo | Ícono cuadrado verde de 168 dp | Alcancía grande sobre círculo `yellowSoft` con destellos |
| Bienvenida: textos | Blanco y `onBrandSoft` sobre verde | `text` y `text2` sobre claro; título 28 con subrayado amarillo |
| Barra de estado | `brand800` (bienvenida) / `brand100` menta (internas) | `bg` / `surface` |
| Mis cuentas: encabezado | «Hola, Ana» + «Mis cuentas» sobre liso, sin ilustración | Marca + avatar con inicial + saludo + título 26 + **alcancía** + destello, sobre manchas de color |
| Mis cuentas: resumen | No había | «Total en tus cuentas» con moneda amarilla (14.16) |
| Mis cuentas: tarjetas | Blancas, 76 dp, 👛 en pastel rotativo **por posición** (la primera, menta), saldo a la derecha, chevrón verde | **Tarjetas de color** por cuenta (albaricoque, celeste, limón…; estable **por id**), 88 dp (92 con ancho ≥ 400), mosaico de 52 dp con ícono por tipo (👛, 🏦, 💳, alcancía), círculo decorativo, saldo de 22 en línea propia, chevrón en círculo |
| Mis cuentas: botones | «+ Crear cuenta» primario + «Cerrar sesión» de ancho completo + «▸ Archivadas» verde | Una primaria «+ Nueva cuenta» (52 dp); «▸ Archivadas» gris; Cerrar sesión en la hoja del avatar |
| Mis cuentas: espacio libre (412 × 915) | Mitad inferior vacía | Total + tarjetas más altas + guía «Toca una cuenta…» |
| Barra de contexto | `brand100` verde, texto `brandInk`, ícono 👛 en blanco | **Blanca neutra**, texto `text`, ícono y color **de la cuenta** |
| Detalle: tarjeta de saldo | `brand700` (única superficie fuerte) | Igual (es la protagonista del póster), alcancía 104 |
| Detalle: Ingresos/Gastos | Mosaicos pastel a sangre (`incomeSoft`/`expenseSoft`) | Tarjetas blancas con burbuja de color y cifra semántica |
| Detalle: flechas de mes | «‹ ›» verdes sueltas | Botones circulares blancos |
| Pestaña activa | Pastel por función (Cuenta menta, Movimientos melocotón…) | Color por módulo (Cuenta verde azulado claro, Movimientos **ámbar**, Calendario azul, Reportes violeta, Más pizarra) |
| Movimientos | Mosaico del título melocotón; chips elegidos `brand100` verdes | Mosaico ámbar; segmentado y chips activos ámbar |
| Calendario | Hoy y día elegido `brand700` verde | Hoy y día elegido **azul** `calStrong` |
| Reportes | Segmentado elegido blanco con texto verde; mosaico Balance lavanda | Segmentado elegido **violeta**; Ingresos/Gastos/Balance claros y semánticos |
| Más / Categorías | Mosaico limón; ícono Categorías melocotón | Mosaico **pizarra** |
| Nuevo movimiento | Categoría y fecha elegidas en `brand100` verde | Manda el tipo: coral suave (Gasto) o verde suave (Ingreso) en tipo, categoría y fecha |
| Ilustraciones vacías | Trazo verde de marca | Alcancía (cuentas) y trazo del color del módulo |

### 16.2 Área verde medida en los renders

Medición: píxeles de la familia verde/marca (tono HSL 85-182°, saturación ≥ 0,20, luminosidad 0,08-0,97) sobre el total, contados con `sharp` en bruto sobre los PNG de 14.2. «Sin ilustración» repite la medida con las imágenes de la alcancía ocultas (sus hojas son verdes). Es un render aproximado (14.2), no una captura.

| Pantalla | Tamaño | Iteración 2 | Iteración 3 | Sin ilustración (2 → 3) |
| --- | --- | --- | --- | --- |
| Bienvenida | 360 × 640 | **89,4 %** | **1,2 %** | 92,7 % → 0,0 % |
| Bienvenida | 412 × 915 | 92,8 % | 0,7 % | 94,9 % → 0,0 % |
| Mis cuentas | 360 × 640 | **7,8 %** | **6,5 %** | 7,8 % → 6,2 % |
| Mis cuentas | 412 × 915 | 5,4 % | 5,3 % | 5,4 % → 5,1 % |
| Detalle (Cuenta) | 360 × 640 | **40,3 %** | **23,0 %** | 41,1 % → 23,7 % |
| Detalle (Cuenta) | 412 × 915 | 27,6 % | 15,1 % | 28,0 % → 15,5 % |

Lectura honesta: en la iteración 2 el verde dominante estaba en la **primera pantalla** (Bienvenida, ~90 %), en la barra de contexto y barra de estado menta y en el Detalle (40 %). Mis cuentas ya tenía poco verde por área (botón, primer mosaico menta y textos verdes); allí el cambio de esta iteración no es de porcentaje (7,8 → 6,5 %, casi todo es el botón «+ Nueva cuenta») sino de **color y alegría**: tarjetas de colores, alcancía, manchas y Total. En el Detalle el verde restante es la tarjeta de saldo (≈ 19 % en 360 × 640), que docs/007 §5.4 define como única superficie fuerte, y el FAB.
