# Constitución del proyecto: App de Control de Gastos

Versión 1.0 · Documento rector. Todo lo que se construya (por Claude Code o por una persona) debe respetar este documento. Si algo no está aquí, se pregunta antes de inventarlo. Si hay que cambiar algo, se cambia primero este documento y después el código.

## 1. Propósito

Aplicación móvil Android para llevar gastos e ingresos diarios, organizados en cuentas separadas (por ejemplo negocio y casa), con historial, calendario, reportes, exportación y conciliación del saldo con el dinero real. El login es con Google. La primera versión debe ser simple, funcional y casi sin costo de infraestructura.

## 2. Principios

1. **Simple primero.** Una versión funcional antes que una completa. Nada de funciones "por si acaso".
2. **Gratis por diseño.** Toda la infraestructura debe caber en las capas gratuitas de Cloudflare y GitHub. La única herramienta de pago es Claude Code.
3. **El servidor manda.** La app es solo online. Toda regla de negocio se valida en la API; la app valida solo para dar mejor experiencia.
4. **Dinero correcto.** Montos como enteros en centavos. Nunca decimales de punto flotante.
5. **Historial auditable.** No se pierde información: se archiva en lugar de borrar, y la conciliación se registra como movimiento de ajuste.
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
- Una sola moneda para toda la aplicación.
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
| App | React Native con Expo, TypeScript, React Navigation, TanStack Query, `react-native-calendars`, `@react-native-google-signin/google-signin` |
| API | Cloudflare Workers, Hono, TypeScript, validación de entradas con Zod |
| Base de datos | Cloudflare D1 (SQLite), migraciones versionadas con wrangler |
| Compilación móvil | EAS Build (perfil gratuito) para generar el APK |
| Repositorio y CI/CD | GitHub y GitHub Actions |
| Entorno de desarrollo | Dev container (Docker) |

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

### Configuración de Google (requisito desde el inicio)

1. Proyecto en Google Cloud Console con la pantalla de consentimiento OAuth en modo pruebas, agregando como usuarios de prueba los correos que se usarán.
2. ID de cliente tipo **Android**: nombre de paquete de la app y huella SHA-1 de la clave con que se firma el APK.
3. ID de cliente tipo **Web**: es el que usa el backend como audiencia del token.
4. Cuando más adelante se publique en Play Store, se agrega además la huella SHA-1 de la firma de Play App Signing.

## 5. Modelo de datos

Todos los identificadores son UUID en texto. Todas las tablas tienen `created_at` y `updated_at`.

- **users**: id, google_sub (único), email, nombre, currency, plan (valor `free`), plan_expires_at (nulo)
- **accounts**: id, user_id, nombre, saldo_inicial (centavos), archivada
- **categories**: id, account_id, nombre, tipo (`ingreso` o `egreso`), icono, color, archivada
- **transactions**: id, account_id, category_id (nulo solo en ajustes), tipo (`ingreso`, `gasto` o `ajuste`), monto (centavos, entero), fecha (día calendario, formato AAAA-MM-DD), nota, created_at
- **refresh_tokens**: id, user_id, hash del token, expiración, revocado

Índices mínimos: `transactions(account_id, fecha)`, `transactions(account_id, category_id)`, `categories(account_id, tipo)`, `accounts(user_id)`.

### Reglas de integridad

- Nombre de categoría único por cuenta y tipo.
- Un movimiento solo acepta una categoría de su misma cuenta y cuyo tipo coincida con el del movimiento. La API lo valida.
- Monto de ingreso y gasto siempre positivo; el signo lo da el tipo. El ajuste puede ser positivo o negativo.
- Las cuentas y categorías con movimientos no se borran, se archivan. Una cuenta o categoría archivada no admite movimientos nuevos pero sí aparece en el historial y en los reportes.
- La fecha del movimiento es un día de calendario sin zona horaria. Los reportes agrupan por ese día.

### Categorías por defecto

Al crear una cuenta, la API copia un conjunto inicial editable.

- Egresos: Alimentación, Transporte, Servicios básicos, Salud, Educación, Hogar, Entretenimiento, Otros gastos.
- Ingresos: Sueldo, Ventas, Otros ingresos.

Después cada cuenta administra sus categorías de forma independiente.

### Saldo y conciliación

- Saldo de una cuenta = saldo_inicial + suma de ingresos - suma de gastos + suma de ajustes.
- El saldo nunca se guarda: se calcula.
- **Conciliar:** el usuario ingresa el saldo real. La API calcula la diferencia contra el saldo calculado y la app la muestra antes de confirmar. Al confirmar se crea un movimiento de tipo `ajuste` con esa diferencia, con la fecha de hoy y una nota automática.
- Los reportes excluyen los ajustes de los totales de ingresos y gastos y los muestran en una línea aparte.

## 6. API

Todas las rutas, salvo las de autenticación, exigen JWT. Todos los listados paginan. Los errores usan un formato único: `{ "error": { "code": "...", "message": "..." } }`.

| Ruta | Función |
| --- | --- |
| `POST /auth/google` | Valida el token de Google, devuelve la sesión |
| `POST /auth/refresh` | Renueva el token de acceso |
| `POST /auth/logout` | Revoca el token de refresco |
| `GET /me` | Datos del usuario y configuración |
| `GET /accounts`, `POST /accounts`, `PATCH /accounts/:id` | Gestión de cuentas (incluye archivar) |
| `GET /accounts/:id/balance` | Saldo calculado |
| `POST /accounts/:id/reconcile` | Recibe el saldo real, crea el ajuste |
| `GET /accounts/:id/categories`, `POST`, `PATCH /categories/:id` | Gestión de categorías por cuenta |
| `GET /transactions` | Filtros: cuenta, tipo, categoría, desde, hasta, página |
| `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` | Gestión de movimientos |
| `GET /calendar?account_id=&month=AAAA-MM` | Totales por día para pintar el calendario |
| `GET /reports/summary` | Ingresos, gastos y balance en un rango |
| `GET /reports/by-category` | Totales por categoría en un rango |
| `GET /reports/by-period?group=month` o `group=year` | Serie por mes o por año |
| `GET /export?account_id=&desde=&hasta=&format=csv` o `format=pdf` | Exportación del historial |

Límites de protección opcionales (para cuidar las cuotas gratuitas, no como plan comercial): máximo de cuentas por usuario, de categorías por cuenta y de solicitudes por minuto, definidos en un único archivo de configuración.

## 7. Pantallas de la app

1. **Login**: botón de Google. Al abrir la app con sesión válida se entra directo.
2. **Inicio**: selector de cuenta, saldo, últimos movimientos y botón de nuevo movimiento.
3. **Nuevo y editar movimiento**: tipo (ingreso o gasto), monto, categoría (solo las de esa cuenta y tipo), fecha y nota.
4. **Historial**: lista paginada con filtros por tipo y categoría y selector de rango de fechas con calendario.
5. **Calendario**: vista mensual con indicador por día; al tocar un día se ven sus movimientos.
6. **Reportes**: por mes, por año y entre fechas, con totales y desglose por categoría.
7. **Cuentas**: crear, renombrar y archivar.
8. **Categorías**: crear, editar y archivar, separadas por ingreso y egreso, dentro de la cuenta elegida.
9. **Conciliación**: ingreso del saldo real, muestra de la diferencia y confirmación.
10. **Ajustes**: exportar, cerrar sesión.

Reglas de experiencia: formulario de movimiento rápido de completar (monto primero), confirmaciones solo en acciones destructivas o de conciliación, mensajes de error claros y estados de carga y vacío en todas las pantallas.

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
  1. Al fusionar a `main`, aplica las migraciones de D1 y despliega el Worker al entorno de producción.
  2. Un entorno `dev` separado (otra base D1) sirve para pruebas antes de producción.
  3. La app se compila con EAS Build para generar el APK de prueba.
- **Migraciones:** archivos SQL versionados y secuenciales, aplicados automáticamente por el pipeline. Nunca se modifica una migración ya aplicada.
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

- Este documento vive en `/docs/CONSTITUCION.md` y `CLAUDE.md` lo referencia y resume sus reglas permanentes.
- Cada fase se entrega a Claude Code como una tarea acotada, con las reglas detalladas de las pantallas y rutas que toca.
- Claude Code debe: leer este documento antes de empezar, trabajar en una rama, escribir las pruebas junto con el código, ejecutar lint y pruebas antes de proponer el cambio y preguntar ante cualquier ambigüedad en lugar de inventar.
- Si una decisión de diseño cambia, se actualiza primero esta constitución.

## 13. Definición de terminado

Una tarea está terminada cuando: cumple la especificación, tiene pruebas que pasan, el CI está en verde, no introduce secretos ni dependencias innecesarias, la documentación afectada está actualizada y el cambio se puede desplegar.