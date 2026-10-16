# Constitución del proyecto: App de Control de Gastos

Versión 1.0 · Documento rector. Todo lo que se construya (por Claude Code o por una persona) debe respetar este documento. Si algo no está aquí, se pregunta antes de inventarlo. Si hay que cambiar algo, se cambia primero este documento y después el código.

## 1. Propósito

Aplicación móvil Android para llevar gastos e ingresos diarios, organizados en cuentas separadas (por ejemplo negocio y casa), con historial, calendario, reportes, exportación y conciliación del saldo con el dinero real. El login es con Google. La primera versión debe ser simple, funcional y casi sin costo de infraestructura.

## 2. Principios

1. **Simple primero.** Una versión funcional antes que una completa. Nada de funciones "por si acaso".
2. **Gratis por diseño.** Toda la infraestructura debe caber en las capas gratuitas de Cloudflare y GitHub. La única herramienta de pago es Claude Code.
3. **El servidor manda.** La app es solo online. Toda regla de negocio se valida en la API; la app valida solo para dar mejor experiencia.
4. **Dinero correcto.** Montos como enteros en centavos. Nunca decimales de punto flotante.
5. **Historial auditable.** Los movimientos anulados se conservan para auditoría y dejan de afectar los saldos. Las cuentas se archivan y las categorías vinculadas a movimientos no se eliminan físicamente. La conciliación se registra como movimiento de ajuste.
6. **Probado y automatizado.** Nada se fusiona sin pruebas ni sin pasar la integración continua.
7. **Reproducible.** Cualquier persona o máquina levanta el proyecto con un comando dentro de un contenedor.
8. **Preparado para crecer sin construir de más.** Se dejan puntos de extensión baratos (por ejemplo la columna `plan`), no funciones.

## 3. Alcance de la versión 1

### Incluye

- Login con Google (Gmail) y cierre de sesión. Se puede entrar con otro usuario y se cargan sus datos.
- Cuentas, cada una con saldo calculado.
- Categorías por cuenta, de tipo ingreso o egreso, con un conjunto por defecto al crear la cuenta.
- Movimientos de ingreso y gasto, registrados manualmente por el usuario.
- Historial con filtros y selector de rango de fechas tipo calendario.
- Calendario mensual que muestra visualmente en qué días hubo movimientos.
- Reportes por mes, por año y entre fechas.
- Conciliación: igualar el saldo de una cuenta con el dinero real.
- Exportación del historial (CSV y PDF) para enviarlo por correo mediante el menú de compartir de Android.
- Administración de catálogos (categorías).

### Decisiones fijas

- Solo online. Sin base de datos local ni sincronización.
- Una sola moneda para toda la aplicación: **USD (dólar estadounidense)**.
- Un solo usuario activo a la vez por instalación.
- Solo Android.
- Sin transferencias entre cuentas.
- Sin movimientos recurrentes.
- Sin planes de pago. La app es completamente gratuita.

### Fuera de alcance de la v1 (fases posteriores)

- Anuncios de Google (AdMob).
- Publicación en Google Play Store y todo lo que implica (política de privacidad pública, eliminación de cuenta desde la app y por web, pruebas cerradas, formularios de Play Console, firma de Play App Signing).
- Planes de pago y Google Play Billing.
- iOS.
- Modo offline, multimoneda, cuentas compartidas, recurrencias, transferencias.

## 4. Arquitectura

Esquema (texto plano):

    App Android (React Native + Expo)
       |  HTTPS + JWT
       v
    Cloudflare Worker (Hono, TypeScript) --> D1 (SQLite)
       |
       +--> validación del ID token de Google

### Tecnologías

| Capa | Elección |
| --- | --- |
| App | React Native con Expo, TypeScript, React Navigation, TanStack Query, `@react-native-google-signin/google-signin`; cuadrícula mensual del calendario con componentes propios de React Native (Decisión 4.1 de docs/003) |
| API | Cloudflare Workers, Hono, TypeScript, validación de entradas con Zod |
| Base de datos | Cloudflare D1 (SQLite), migraciones versionadas con wrangler |
| Compilación móvil | EAS Build (perfil gratuito) para generar el APK |
| Repositorio y CI/CD | GitHub y GitHub Actions |
| Entorno de desarrollo | Dev container (Docker) |

Nota (Decisiones 2B.1, 3.1 y 4.1 de docs/003, ratificadas en la Decisión R0): React Navigation y TanStack Query siguen diferidos; la app usa navegación por estado local y pestañas propias y no añade dependencias nativas.


Los límites de las capas gratuitas cambian con el tiempo. Antes de cerrar decisiones de capacidad se verifican en la documentación oficial de Cloudflare.

### Estructura del repositorio (monorepo)

- `/app`: aplicación React Native
- `/api`: Worker de Cloudflare (Hono)
- `/docs`: este documento y especificaciones por módulo
- `/.devcontainer`: definición del contenedor de desarrollo
- `/.github/workflows`: integración y despliegue continuos
- `CLAUDE.md`: instrucciones permanentes para Claude Code

### Autenticación y sesión

1. La app obtiene el ID token de Google con Google Sign-In.
2. Envía el token a `POST /auth/google`.
3. El Worker valida el token contra las claves públicas de Google, comprobando firma, emisor, expiración y que la audiencia sea el ID de cliente Web de la aplicación.
4. Si el usuario no existe, se crea (identificado por `google_sub`, no por el correo) junto con su configuración.
5. El Worker devuelve un JWT de acceso de corta duración y un token de refresco.
6. Los tokens se guardan en el almacenamiento seguro de Android (SecureStore).
7. Al cerrar sesión se revoca el token de refresco, se borran los tokens locales y se limpia por completo el caché de la app. Ningún dato de un usuario puede quedar en el teléfono para el siguiente.
8. Toda consulta a datos se filtra por el `user_id` del token. Nunca se confía en un identificador enviado por el cliente.
9. El refresh token tendrá una vigencia de **7 días de inactividad**. Cada renovación exitosa rota el token, invalida el anterior y renueva el plazo de inactividad. La rotación se realiza de forma atómica en D1. No se ha aprobado una duración máxima absoluta adicional.

> **Implementación transitoria de la Fase 1 (histórica, reemplazada en la Fase 2A)** (excepción aprobada, ver docs/003-DECISIONES-FASE0.md): durante la Fase 1 no existían D1, usuarios ni `refresh_tokens`; la API emitía solo un JWT de acceso de 15 minutos, la app lo renovaba repitiendo `POST /auth/google`, no existían `/auth/refresh` ni `/auth/logout` y el logout era solo local. Esa excepción quedó sustituida: la API actual persiste usuarios y refresh tokens en D1, emite JWT v2 y expone `POST /auth/refresh` y `POST /auth/logout`, implementado y desplegado únicamente en el entorno DEV. El diseño de arriba sigue siendo el objetivo; la evidencia de validación y los pendientes están en docs/004-ROADMAP-PROYECTO.md.

### Configuración de Google (requisito desde el inicio)

1. Proyecto en Google Cloud Console con la pantalla de consentimiento OAuth en modo pruebas, agregando como usuarios de prueba los correos que se usarán.
2. ID de cliente tipo **Android**: nombre de paquete de la app y huella SHA-1 de la clave con que se firma el APK.
3. ID de cliente tipo **Web**: es el que usa el backend como audiencia del token.
4. Cuando más adelante se publique en Play Store, se agrega además la huella SHA-1 de la firma de Play App Signing.

## 5. Modelo de datos

Todos los identificadores son UUID en texto. Todas las tablas tienen `created_at` y `updated_at`.

- **users**: id, google_sub (único), email, nombre, currency (valor fijo `USD`), plan (valor `free`), plan_expires_at (nulo)
- **accounts**: id, user_id, nombre, saldo_inicial (centavos), archivada
- **categories**: id, account_id, nombre, descripcion (opcional), tipo (`ingreso` o `egreso`), icono, color, archivada
- **transactions**: id, account_id, category_id (nulo solo en ajustes), tipo (`ingreso`, `gasto` o `ajuste`), monto (centavos, entero), fecha (día calendario, formato AAAA-MM-DD), nota, deleted_at (nulo si está activo), created_at
- **refresh_tokens**: id, user_id, family_id, token_hash, expires_at, revoked_at, revoked_reason, replaced_by (detalle en «Modelo persistente de tokens», sección de sesiones de Fase 2A)

Índices mínimos: `transactions(account_id, fecha)`, `transactions(account_id, category_id)`, `categories(account_id, tipo)`, `accounts(user_id)`.

### Reglas de integridad

- Nombre de categoría único por cuenta y tipo.
- Un movimiento solo acepta una categoría de su misma cuenta y cuyo tipo coincida con el del movimiento. La API lo valida.
- Monto de ingreso y gasto siempre positivo; el signo lo da el tipo. El ajuste puede ser positivo o negativo.
- Las cuentas se archivan, no se eliminan físicamente. Una categoría puede eliminarse físicamente solo si no tiene movimientos asociados, incluidos los anulados; si tiene movimientos, puede archivarse. Una cuenta o categoría archivada no admite movimientos nuevos, pero conserva su historial.
- La fecha del movimiento es un día de calendario sin zona horaria. Los reportes agrupan por ese día.

- El tipo de una categoría (`ingreso` o `egreso`) es inmutable después de crearla. Su nombre, descripción, icono y color pueden editarse aunque tenga movimientos asociados.
- El tipo y la categoría de un movimiento son inmutables después de registrarlo. Pueden editarse monto, fecha y nota.
- Un movimiento puede anularse lógicamente sin límite de antigüedad. La anulación establece `deleted_at`, lo excluye del saldo, reportes e historial habitual, y conserva el registro para auditoría.
- Un movimiento anulado sigue contando como referencia a su categoría para impedir la eliminación física de esta.

### Categorías por defecto

Al crear una cuenta, la API copia un conjunto inicial editable.

- Egresos: Alimentación, Transporte, Servicios básicos, Salud, Educación, Hogar, Entretenimiento, Otros gastos.
- Ingresos: Sueldo, Ventas, Otros ingresos.

Después cada cuenta administra sus categorías de forma independiente.

### Creación inicial de cuentas

- Un usuario nuevo crea su primera cuenta manualmente; el inicio de sesión no crea cuentas financieras automáticamente.
- El saldo inicial es opcional en el formulario y en la API. Cuando no se envía, se registra `0` centavos USD.
- La creación de cada cuenta y sus 11 categorías iniciales debe ser atómica.

### Saldo y conciliación

- Saldo de una cuenta = saldo_inicial + suma de ingresos - suma de gastos + suma de ajustes.
- El saldo nunca se guarda: se calcula.
- **Conciliar:** el usuario ingresa el saldo real. La API calcula la diferencia contra el saldo calculado y la app la muestra antes de confirmar. Al confirmar se crea un movimiento de tipo `ajuste` con esa diferencia, con la fecha de hoy y una nota automática.
- Los reportes excluyen los ajustes de los totales de ingresos y gastos y los muestran en una línea aparte.

## 6. API

Todas las rutas, salvo las de autenticación, exigen JWT. Las respuestas de `/auth/*` y `/me` (incluidos los errores) llevan `Cache-Control: no-store`. Fechas en UTC ISO-8601; `refreshExpiresAt` es el vencimiento del refresh token emitido. Todos los listados paginan. Los errores usan un formato único: `{ "error": { "code": "...", "message": "..." } }`. Los cuerpos JSON de `/auth/*` se limitan a 16 KiB: si se exceden, 413 `PAYLOAD_TOO_LARGE`.

| Ruta | Función |
| --- | --- |
| `POST /auth/google` | Valida el token de Google, devuelve la sesión (JWT v2 y refresh token): `{ accessToken, tokenType, expiresIn, user: { id, email, name }, refreshToken, refreshExpiresAt }` |
| `POST /auth/refresh` | Rota el refresh token y devuelve `{ accessToken, tokenType, expiresIn, refreshToken, refreshExpiresAt }`. Errores: 400 `INVALID_REQUEST` (formato), 401 `INVALID_REFRESH_TOKEN` (inexistente, vencido, revocado o reutilizado), 409 `REFRESH_CONFLICT` (reutilización dentro de la gracia de 30 s, sin credenciales ni revocación) |
| `POST /auth/logout` | Revoca la familia del refresh token recibido. Responde 204 sin cuerpo siempre que la solicitud sea válida (idempotente), exista o no el token; 400 `INVALID_REQUEST` si el cuerpo es inválido |
| `GET /me` | Datos del usuario y configuración. Lee al usuario de D1 por el `sub` (UUID) del JWT v2; usuario inexistente o JWT inválido (incluido v1): 401 `INVALID_TOKEN` |
| `GET /accounts`, `POST /accounts`, `PATCH /accounts/:id` | Gestión de cuentas (incluye archivar) |
| `GET /accounts/:id/balance` | Saldo calculado |
| `POST /accounts/:id/reconcile` | Recibe el saldo real, crea el ajuste |
| `GET /accounts/:id/categories`, `POST /accounts/:id/categories`, `PATCH /categories/:id`, `DELETE /categories/:id` | Gestión de categorías por cuenta; eliminación solo si no tienen movimientos asociados |
| `GET /transactions` | Filtros: cuenta, tipo, categoría, desde, hasta, página |
| `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` | Gestión de movimientos; PATCH no cambia tipo ni categoría y DELETE realiza anulación lógica |
| `GET /calendar?account_id=&month=AAAA-MM` | Totales por día para pintar el calendario: ingresos, gastos y cantidad por día con movimientos vigentes del mes, en centavos |
| `GET /reports/summary` | Ingresos, gastos y balance en un rango |
| `GET /reports/by-category` | Totales por categoría en un rango |
| `GET /reports/by-period?group=month` o `group=year` | Serie por mes o por año |
| `GET /export?account_id=&desde=&hasta=&format=csv` o `format=pdf` | Exportación del historial |

Movimientos (Decisión 3.1 de docs/003): en este incremento `transactions.tipo` admite solo `ingreso` y `gasto` (el `ajuste` llega con la conciliación). `GET /transactions` exige `account_id` y usa `page_size` con defecto 20 y máximo 100. Las cuentas devuelven además `saldo` (centavos, calculado). Códigos 409 adicionales: `CATEGORY_ARCHIVED`, `CATEGORY_MISMATCH` y `TRANSACTION_VOIDED`. El monto máximo es 99999999999 centavos, la nota admite hasta 500 caracteres y las fechas futuras están permitidas.

Recursos de cuentas y categorías (Decisión 2B.1 de docs/003): los listados usan los parámetros de query `page` y `page_size` (defecto 50, máximo 100) y responden `{ items, page, pageSize, total }`; las respuestas llevan `Cache-Control: no-store`; los recursos ajenos responden 404 `NOT_FOUND`; los conflictos de negocio usan 409 con los códigos `ACCOUNT_ARCHIVED`, `CATEGORY_NAME_TAKEN`, `CATEGORY_IN_USE` y `LIMIT_REACHED`.

Límites de protección opcionales (para cuidar las cuotas gratuitas, no como plan comercial): máximo de cuentas por usuario, de categorías por cuenta y de solicitudes por minuto, definidos en un único archivo de configuración.

## 7. Pantallas de la app

Estructura aprobada en el rediseño UX/UI (Decisión R0 de docs/003). El detalle de flujos, estados y textos está en docs/007-DISENO-UX.md y la apariencia en docs/008-DISENO-VISUAL.md. Este apartado fija solo las normas.

1. **Login**: botón de Google. Al abrir la app con sesión válida se entra directo a Mis cuentas.
2. **Mis cuentas** (pantalla inicial autenticada): cuentas activas con su saldo actual, acción «Nueva cuenta» y acceso a las archivadas. Con al menos dos cuentas activas muestra el total de sus saldos. Tocar una cuenta abre su Detalle. Sin cuentas, invita a crear la primera.
3. **Crear cuenta**: nombre y saldo inicial opcional.
4. **Detalle de cuenta**: contenedor con barra inferior de cinco pestañas (Cuenta, Movimientos, Calendario, Reportes y Más):
   - **Cuenta**: saldo y movimientos de la semana.
   - **Movimientos**: historial paginado con filtros por tipo y categoría y selector de rango de fechas con calendario.
   - **Calendario**: vista mensual con indicador por día; al tocar un día se ven sus movimientos.
   - **Reportes**: por mes, por año y entre fechas, con totales, desglose por categoría y exportación (CSV y PDF).
   - **Más** (configuración de la cuenta y de la sesión): datos de la cuenta (renombrar), **Categorías**, opciones avanzadas (archivar) y cerrar sesión. La conciliación podría ubicarse aquí en la Fase 6 (docs/007 14.13, abierta).
5. **Nuevo y editar movimiento** (pantalla sobre el Detalle): tipo (ingreso o gasto), categoría (solo las de esa cuenta y tipo), monto, fecha y nota, en ese orden. «Nuevo movimiento» es una acción destacada visible en Cuenta, Movimientos y Calendario.
6. **Categorías** (dentro de Más): crear, editar y archivar, separadas por ingreso y egreso, dentro de la cuenta activa; eliminar solo si no tienen movimientos.
7. **Conciliación** (Fase 6): ingreso del saldo real, muestra de la diferencia y confirmación.

### Navegación

- La navegación se resuelve con estado local y pestañas propias, sin dependencias nuevas (Decisión R0 de docs/003, que ratifica 2B.1, 3.1 y 4.1).
- La cuenta activa se conserva solo en memoria mientras dure la sesión; cerrar sesión la borra.
- Tocar el nombre o el saldo de la barra de contexto abre un selector rápido de las cuentas activas; al cambiar de cuenta se conserva la pestaña y se reinicia el estado por pestaña (filtros, período).
- Guías contextuales de primera vez, descartables y reactivables desde Más.
- Atrás en una pestaña distinta de Cuenta vuelve a Cuenta; Atrás en Cuenta vuelve a Mis cuentas; Atrás en Mis cuentas sale de la app sin cerrar sesión. Una acción «‹ Mis cuentas» con zona táctil de 48 dp está siempre visible en el Detalle, además del Atrás del sistema.

### Cuenta activa visible

- Toda pantalla interna de una cuenta (Detalle, Categorías, Nuevo y editar movimiento) muestra una barra de contexto con el nombre de la cuenta, su estado «Archivada» si aplica y, salvo en la pestaña Cuenta, su saldo.
- El contenedor del Detalle es la única fuente de esos datos; ninguna pestaña consulta el saldo por su cuenta. Tras crear, editar o anular un movimiento el contenedor relee el saldo con `GET /accounts/:id/balance`.
- Si el saldo no se puede leer, se muestra «Saldo no disponible» con opción de reintentar; nunca se inventa un valor.

### Archivado en lugar de eliminación

- La app no ofrece eliminar cuentas, solo archivarlas (docs/001 §5). Archivar exige una confirmación que muestra el nombre de la cuenta.
- Una cuenta archivada se consulta en Mis cuentas > Archivadas, puede desarchivarse, conserva su historial y no admite movimientos nuevos (cómo se presenta en el Detalle, p. ej. «Nuevo movimiento» deshabilitado con su explicación, está pendiente: docs/007 14.12).
- Sin movimientos, cada categoría puede eliminarse; con movimientos solo puede archivarse (docs/001 §5).

### Reglas de experiencia

- Formulario de movimiento rápido de completar: tipo, categoría y monto en ese orden, con teclado numérico, fecha «Hoy» por defecto y protección contra doble envío.
- Confirmaciones solo en acciones destructivas o de conciliación, y al abandonar un formulario con cambios sin guardar (docs/003, Rediseño R3 D1). Sin cambios, se sale sin diálogo.
- Mensajes de error claros y estados de carga, vacío y error en todas las pantallas.

### Android: safe areas, teclado y accesibilidad

- La app respeta las barras del sistema (estado y navegación): ningún título, botón ni acción queda bajo ellas, con navegación por gestos o por tres botones. Opción A aprobada (sin módulo nativo ni modo inmersivo; docs/003, Decisión R0 D7); se implementa y valida en R1 y en un Android real.
- Con el teclado abierto, el campo activo y «Guardar» permanecen visibles; las pantallas se desplazan.
- Todo objetivo táctil mide al menos 48 dp. Excepciones aprobadas y acotadas (docs/007 §10): chips pequeños de filtro de 36 dp con zona táctil efectiva de 48 dp; celdas de día del calendario de 52 dp de alto y al menos 44 dp de ancho con ancho de pantalla de hasta unos 400 dp.
- El texto escala con el tamaño de fuente del sistema sin bloquearlo. El saldo, los importes, los botones, las pestañas y las categorías habituales no se truncan. Solo los nombres libres del usuario (cuenta, nota) se truncan con elipsis y su texto completo está en la etiqueta de accesibilidad.
- El color nunca es el único portador de significado: los importes llevan signo y los tipos llevan palabra.

### Validación UX/UI

- Todo cambio visible de la interfaz móvil exige la revisión independiente de `mobile-ux-qa` con docs/010-MATRIZ-PRUEBAS-UX.md. Un defecto alto o crítico detiene el cierre y la publicación hasta su corrección y nueva validación.
- La validación en un teléfono Android real (nivel D de docs/010) es evidencia distinta de las pruebas automáticas; ninguna sustituye a la otra.
- El flujo de agentes para cambios de interfaz está en CLAUDE.md («Coordinación y delegación»).

## 8. Calidad y pruebas

- **Unitarias de la API:** Vitest con el entorno de Workers de Cloudflare (`@cloudflare/vitest-pool-workers`) y D1 local. Se cubren como mínimo: cálculo de saldo, conciliación, validación categoría-cuenta-tipo, filtros por rango de fechas, reportes, aislamiento entre usuarios y validación del token de Google (con claves simuladas).
- **Unitarias de la app:** Jest y React Native Testing Library para lógica de formato de montos, validación de formularios y componentes clave.
- **Integración de la API:** pruebas que recorren los flujos completos (login simulado, crear cuenta, movimientos, conciliar, reportar) sobre D1 local.
- **Reglas:** todo cambio de regla de negocio incluye su prueba; los errores corregidos incluyen una prueba que los reproduzca; meta inicial de cobertura de 80 % en la lógica de negocio de la API.
- **Calidad estática:** TypeScript estricto, ESLint y Prettier. El CI falla ante cualquier error.

## 9. GitHub y flujo de trabajo

- Un repositorio en GitHub. La rama `main` siempre está desplegable y está protegida: solo se cambia mediante Pull Request con el CI en verde.
- Ramas cortas por tarea: `feat/...`, `fix/...`, `chore/...`.
- Commits con formato Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Cada Pull Request: descripción breve, pruebas incluidas, sin secretos.
- Los secretos viven en GitHub Secrets y en secretos de Cloudflare. Nunca en el repositorio.

## 10. DevOps, contenedores y despliegue

**Aclaración técnica importante:** Cloudflare Workers no ejecuta contenedores Docker, y Cloudflare Containers es de pago. Por eso los contenedores se usan donde sí aportan sin costo: desarrollo, pruebas y construcción. El runtime de producción es el Worker.

- **Dev container:** definición en `/.devcontainer` con Node, wrangler y dependencias. Un comando deja el entorno listo y es idéntico para cualquier persona y para el CI.
- **Imagen de CI:** el CI corre en contenedores con la misma versión de Node que el dev container.
- **Pipeline de CI (en cada Pull Request):** instalar dependencias, lint, comprobación de tipos, pruebas unitarias y de integración, y construcción de la API.
- **Pipeline de CD:**
  1. Las migraciones de D1 y el despliegue del Worker a producción son manuales y requieren autorización expresa. Fusionar a `main` no los ejecuta.
  2. Un entorno `dev` separado (otra base D1) sirve para pruebas antes de producción.
  3. La app se compila con EAS Build para generar el APK de prueba.
- **Migraciones:** archivos SQL versionados y secuenciales. Se validan en local y en desarrollo; su aplicación remota es manual y requiere autorización expresa (producción incluida). Nunca se modifica una migración ya aplicada.
- **Configuración por entorno:** variables en archivos de wrangler y secretos fuera del código.
- **Observabilidad básica:** registros de Cloudflare y códigos de error consistentes.

## 11. Fases

| Fase | Contenido |
| --- | --- |
| 0 | Repositorio, dev container, CI, Worker mínimo desplegado, proyecto Expo, configuración de Google Cloud |
| 1 | Autenticación completa: login, sesión, cierre de sesión, cambio de usuario |
| 2 | Cuentas y categorías (con las por defecto) |
| 3 | Movimientos, historial y filtros |
| 4 | Calendario |
| 5 | Reportes y exportación |
| 6 | Conciliación |
| 7 | Pulido, pruebas de punta a punta y APK de prueba |
| Futuro | Play Store, anuncios, planes de pago, iOS |

Cada fase termina con pruebas en verde, CI exitoso y despliegue funcionando.

## 12. Cómo se trabaja con Claude Code

- Este documento vive en `/docs/001-CONSTITUCION.md` y `CLAUDE.md` lo referencia y resume sus reglas permanentes.
- Cada fase se entrega a Claude Code como una tarea acotada, con las reglas detalladas de las pantallas y rutas que toca.
- Claude Code debe: leer este documento antes de empezar, trabajar en una rama, escribir las pruebas junto con el código, ejecutar lint y pruebas antes de proponer el cambio y preguntar ante cualquier ambigüedad en lugar de inventar.
- Si una decisión de diseño cambia, se actualiza primero esta constitución.

## 13. Definición de terminado

Una tarea está terminada cuando: cumple la especificación, tiene pruebas que pasan, el CI está en verde, no introduce secretos ni dependencias innecesarias, la documentación afectada está actualizada y el cambio se puede desplegar. Si el cambio altera la interfaz móvil visible, además la revisión de `mobile-ux-qa` no deja defectos altos ni críticos abiertos.

### Política definitiva de sesiones — Fase 2A

- El JWT de acceso dura 15 minutos.
- El refresh token vence después de 7 días de inactividad.
- Cada renovación exitosa rota el refresh token de forma atómica.
- Cada usuario puede mantener un máximo de 5 sesiones activas e independientes.
- Al crear una sexta sesión, se revoca la menos recientemente utilizada.
- El logout remoto revoca únicamente la familia de la sesión correspondiente.
- Los access tokens ya emitidos pueden seguir siendo válidos hasta su expiración.
- No se establece una duración máxima absoluta adicional de sesión.

#### Modelo persistente de tokens

La tabla `refresh_tokens` incluye:

- `id`: UUID en texto, clave primaria.
- `user_id`: referencia obligatoria a `users`.
- `family_id`: UUID que identifica la sesión independiente.
- `token_hash`: hash SHA-256 único del refresh token.
- `expires_at`: vencimiento UTC.
- `revoked_at`: momento de revocación; nulo mientras el token está activo.
- `revoked_reason`: motivo de revocación; nulo mientras el token está activo. Valores permitidos: `rotated` (sustituido por su sucesor en una renovación), `logout` (cierre de sesión), `evicted` (expulsado por el límite de 5 sesiones) y `reuse` (revocación de la familia por reutilización tardía de un token rotado).
- Consistencia de la revocación: `revoked_at` y `revoked_reason` están ambos nulos (token activo) o ambos informados (token revocado). La base de datos lo impone con un `CHECK`.
- `replaced_by`: identificador del token sucesor; solo se informa en tokens con motivo `rotated`. Que el sucesor tenga el mismo `user_id` y `family_id` no lo impone la base de datos (un `CHECK` no puede consultar otras filas y una clave foránea compuesta añadiría un índice por token): lo garantiza la lógica de rotación, que inserta el sucesor copiando ambos valores de la fila reemplazada, y lo verifican pruebas específicas de la API.
- `created_at` y `updated_at`: timestamps UTC.

El token original nunca se almacena en D1.

Un índice único parcial sobre `family_id`, para registros no revocados,
impide tener dos refresh tokens activos en una misma familia.

#### Rotación y concurrencia

- La rotación debe ejecutarse mediante un batch transaccional en D1.
- Solo una renovación concurrente puede tener éxito con el mismo token.
- La reutilización dentro de los 30 segundos posteriores a una rotación
  devuelve HTTP 409 sin revocar la familia.
- Una reutilización posterior devuelve HTTP 401 y revoca la familia.
- La reutilización no demuestra por sí sola un ataque: puede deberse
  a reintentos o respuestas perdidas.
- Un refresh token que recibió 409 `REFRESH_CONFLICT` está consumido
  y el cliente no debe reenviarlo automáticamente:
  - Antes de iniciar una recuperación con Google, el cliente lo marca
    como consumido en su almacenamiento seguro. Si no puede persistir
    la marca, no inicia la recuperación.
  - Si la marca se persistió, no se reutiliza el token después del
    enfriamiento de la recuperación ni después de reiniciar la
    aplicación.
  - Como consecuencia de un 409, el cliente no llama a
    `POST /auth/logout` con el token antiguo: la API revoca la familia
    completa a partir de cualquier token conocido, y esa familia puede
    tener un sucesor legítimo en otro proceso.
  - Limitación: si la aplicación termina antes de persistir la marca,
    el token consumido puede reenviarse una vez al reiniciar. Con
    menos de 30 segundos desde su rotación la API responde 409; con 30
    segundos o más lo trata como reutilización posterior (401) y
    revoca la familia. La protección no es absoluta entre varios
    procesos: el almacenamiento seguro no ofrece comparación y
    escritura atómicas entre ellos.
- Las pruebas de concurrencia son obligatorias antes de desplegar.

#### JWT v2

- El claim `sub` identifica el UUID interno del usuario en D1.
- Se utiliza una audiencia nueva para distinguirlo del JWT anterior.
- Se conservan `email` y `name` por compatibilidad transitoria con Android.
- Los JWT antiguos no autorizan consultas del modelo persistente.
- Toda consulta de datos se restringe al usuario autenticado.

#### Despliegue

- Las migraciones se validan primero en local y después en desarrollo.
- Producción requiere autorización explícita.
- El despliegue sigue siendo manual; fusionar un PR no lo ejecuta.
- La integración Android de refresh tokens y logout remoto se realiza
  en un PR separado.
