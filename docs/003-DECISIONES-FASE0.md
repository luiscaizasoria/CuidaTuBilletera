# Decisiones de la Fase 0

Complemento de la constitución. Registra las decisiones tomadas antes de empezar la Fase 0. Si algo no está aquí ni en docs/001-CONSTITUCION.md, pregunta antes de inventarlo.

## Repositorio
- Cuenta de GitHub: luiscaizasoria. Repositorio: CuidaTuBilletera, público.
- La carpeta local se llama ControlGastos y no se renombra.
- Rama principal: main. El primer commit (solo documentos y .gitignore) es el único commit directo a main. Todo lo demás va por rama corta y Pull Request.
- La identidad de git de esta carpeta ya está configurada con el correo noreply de GitHub. No toques la configuración global.
- La protección de main se configura cuando exista el CI, para exigir ese chequeo. No la configures antes.

## Herramientas
- Node 22 y npm con workspaces. No usar pnpm ni yarn.
- Estructura: /app (Expo) y /api (Worker con Hono), con un package.json raíz con workspaces.
- gh ya está instalado y autenticado.
- Docker Desktop todavía no está instalado: el dev container va en un Pull Request posterior.

## Pull Requests de la Fase 0 (uno a la vez, espera mi OK entre cada uno)
- a) estructura del monorepo y workspaces
- b) Worker mínimo con GET /health, pruebas y CI
- c) proyecto Expo base
- d) dev container
- e) despliegue a Cloudflare

## Worker
- Solo GET /health. Sin tablas ni migraciones con tablas (eso es de la Fase 2).
- Nombres: Worker controlgastos-api; bases D1 controlgastos-db (producción) y controlgastos-db-dev (dev).
- Producción se despliega al fusionar a main. El entorno dev se despliega a mano.
- No avanzar al Pull Request e hasta que yo confirme que tengo cuenta de Cloudflare. El token lo creo yo y lo guardo en GitHub Secrets. Nunca pidas ni guardes tokens en archivos.

## App y Google
- Nombre visible de la app e identificador de paquete: pendientes. Pregúntame antes del Pull Request c.
- Login con Google y development build: Fase 1. En la Fase 0 el proyecto Expo se verifica en mi celular Android con Expo Go.
- La guía de configuración de Google Cloud la prepara el orquestador, no Claude Code.

## Reglas de trabajo
- Windows con PowerShell. Responde en español.
- Estoy aprendiendo Claude Code: antes de cada comando de git o gh, explica en una línea qué hace y por qué.
- No instales dependencias ni crees archivos fuera del alcance de la tarea actual.

## TAREA 1 (completada)
Objetivo: subir el primer commit y crear el repositorio remoto. Nada más.
1. Revisa con git status el estado de la carpeta. Si la rama se llama master, renómbrala a main.
2. Haz un commit inicial con CLAUDE.md, .gitignore, docs/001-CONSTITUCION.md y docs/003-DECISIONES-FASE0.md. Mensaje en formato Conventional Commits: docs: agrega constitución, instrucciones y decisiones de la fase 0.
3. Crea el repositorio público CuidaTuBilletera con gh, usa esta carpeta como origen, configura el remoto origin y sube main.
4. No escribas código, no crees ramas nuevas y no configures protección de main.
5. Al final muestra git log --oneline y la URL del repositorio, y dime qué sigue.

## TAREA 2 (completada): Pull Request (a), estructura del monorepo

Empieza en modo plan: presenta el plan completo y espera mi aprobación antes de escribir archivos.

Alcance: solo las herramientas comunes de la raíz. NO generes todavía los proyectos de api ni de app: los generadores oficiales los crearán en los Pull Requests b y c.

1. Crea la rama chore/monorepo-structure desde main. Los archivos docs/002-CONVENCIONES.md, CLAUDE.md y este archivo ya tienen cambios sin commit: inclúyelos.
2. En la raíz: package.json privado con npm workspaces para api y app y scripts lint, typecheck, test y format; tsconfig.base.json con TypeScript estricto; configuración de ESLint (flat config) y de Prettier; .editorconfig; README.md breve que enlace a la constitución.
3. Crea api/ y app/ con un archivo .gitkeep. Verifica que npm install funciona con los workspaces vacíos. Si npm se queja, propón la alternativa más simple antes de aplicarla.
4. Antes de instalar dependencias (typescript, eslint, prettier y similares), dime cuáles son y por qué, y verifica sus versiones vigentes con npm view. Pregunta antes de agregar cualquiera fuera de esa lista.
5. Ejecuta npm run lint, npm run typecheck y npm run format y muestra el resultado. Si un script falla solo porque aún no hay proyectos, hazlo tolerante en lugar de fingir que pasa.
6. Configuración de Claude Code, en este mismo Pull Request:
   - En .gitignore agrega CLAUDE.local.md y .claude/worktrees/.
   - Crea .claude/settings.json (se sube a git) con permisos: permitir solo Bash(npm run lint), Bash(npm run typecheck), Bash(npm run test) y Bash(npm run format); denegar Bash(rm -rf *) y la lectura de .env, .env.* y .dev.vars. Verifica la sintaxis exacta de las reglas en la documentación oficial de permisos antes de escribirlas.
   - NO agregues hooks todavía: van en el Pull Request b, con un script de Node, porque jq no existe en Windows.
   - No crees carpetas vacías de rules, skills ni agents. Se crean cuando haya algo que poner.
7. Commits en Conventional Commits y en español. Sube la rama y abre el Pull Request con gh pr create, con una descripción breve. NO fusiones el Pull Request: lo reviso yo.
8. Al final muestra la URL del Pull Request y la lista de archivos cambiados.

Reglas: sigue docs/002-CONVENCIONES.md. No toques docs/001-CONSTITUCION.md. Si algo es ambiguo, pregunta.

## TAREA 2.1: Gobernanza Claude Code

Objetivo:
Definir la estructura de trabajo asistida por Claude Code antes de continuar con el desarrollo funcional.

Decisiones:

- CLAUDE.md es el punto principal de instrucciones para Claude Code.
- docs/001-CONSTITUCION.md mantiene las decisiones del producto, alcance y arquitectura.
- docs/002-CONVENCIONES.md mantiene los estándares técnicos del proyecto.
- La configuración específica de Claude Code vive dentro de .claude/.
- Los agentes, reglas y skills se crean cuando exista una responsabilidad clara.
- Los MCP se incorporan progresivamente cuando aporten valor al desarrollo.

Estructura aprobada:

.claude/
- agents/
- rules/
- skills/
- configuración MCP

Motivo:
Separar conocimiento del producto, estándares técnicos y comportamiento de las herramientas de IA.

Nomenclatura:

- Los archivos reservados por herramientas mantienen sus nombres oficiales.
- El código fuente sigue las convenciones del lenguaje y framework utilizado.
- La documentación Markdown creada por el proyecto utiliza prefijos identificadores según su tipo.
- Los agentes, reglas y skills de Claude Code utilizan nombres descriptivos según su responsabilidad.
## TAREA 3: Pull Request (b), Worker mínimo y CI

Empieza en modo plan: presenta el plan completo y espera mi aprobación antes de escribir archivos. Al aprobar el plan, NO cambies el modo de permisos: quiero seguir aprobando cada comando.

Prueba previa (antes del plan): intenta ejecutar Remove-Item -Recurse -Force .\prueba-inexistente. Es una prueba de la regla de bloqueo de .claude/settings.json: dime si la regla lo bloqueó o si te pidió permiso. No borres nada.

Alcance: el Worker de la API con un solo endpoint y la integración continua. Sin D1, sin tablas, sin autenticación, sin despliegue (el despliegue es el Pull Request e) y sin hooks (van en el Pull Request c).

1. Crea la rama feat/api-health-and-ci desde main. Los cambios sin commit de docs/003-DECISIONES-FASE0.md viajan a la rama: inclúyelos en el primer commit.
2. Crea el proyecto de api/ con el generador oficial de Hono (plantilla de Cloudflare Workers) o, si no es práctico con el directorio no vacío, con la alternativa más simple. Verifica el comando vigente en la documentación oficial y dime cuál usarás antes de ejecutarlo. Quita api/.gitkeep cuando ya haya archivos reales.
3. Estructura según docs/002-CONVENCIONES.md: api/src/index.ts como entrada y las pruebas junto al código.
4. Endpoint GET /health que responde 200 con el JSON { "status": "ok" }.
5. Errores con el formato único de la constitución: { "error": { "code": "...", "message": "..." } }. Ruta no encontrada: 404 con code NOT_FOUND. Errores no controlados: 500 con code INTERNAL_ERROR.
6. Pruebas con Vitest y @cloudflare/vitest-pool-workers: /health devuelve 200 y el JSON esperado; una ruta inexistente devuelve 404 con el formato de error. Verifica en la documentación las versiones compatibles entre vitest y el paquete del pool de Workers antes de instalarlos.
7. Configuración de wrangler en api/ con el nombre controlgastos-api y una compatibility_date válida para la versión instalada. Sin bindings, sin account_id y sin secretos.
8. Scripts en api/package.json: test, typecheck y build. Build debe construir el Worker sin desplegarlo (por ejemplo wrangler deploy --dry-run): verifica el comando en la documentación. Los scripts de la raíz ya los ejecutan mediante scripts/run-workspaces.js.
9. Flujo de CI en .github/workflows/ci.yml: se ejecuta en cada pull_request y en push a main. Un solo job llamado ci con Node 22, caché de npm y estos pasos: npm ci, npm run lint, npm run typecheck, npm test, npm run build --workspace api. Permisos mínimos (contents: read). Fija las acciones a versiones mayores vigentes verificadas en su documentación.
10. Antes de instalar dependencias, dime cuáles son, con su versión verificada con npm view y por qué. Pregunta antes de agregar cualquiera fuera de esa lista. Respeta las versiones fijadas del Pull Request a (TypeScript 6.0.3).
11. Ejecuta localmente npm run lint, typecheck, test y build y muestra el resultado real.
12. Commits en Conventional Commits y en español: uno para el Worker con sus pruebas y otro para el CI. Sube la rama y abre el Pull Request con gh pr create. NO lo fusiones y NO toques la protección de main.
13. Con el Pull Request abierto, espera a que el CI termine con gh pr checks y dime el resultado. Si falla, muéstrame el error antes de corregir.
14. Al final muestra la URL del Pull Request y la lista de archivos cambiados.

Reglas: sigue docs/002-CONVENCIONES.md. No toques docs/001-CONSTITUCION.md. Si algo es ambiguo, pregunta.

### Decisiones de ejecución de la TAREA 3 (pruebas del Worker)

- Paquete de pruebas: `@cloudflare/vitest-plugin` 1.4.0 en lugar de `@cloudflare/vitest-pool-workers`, que npm marca como deprecado ("renombrado a @cloudflare/vitest-plugin; no recibirá más actualizaciones"). Cumple la misma función. La Constitución (sección de pruebas) sigue nombrando el paquete anterior y no se modificó.
- Vitest 5.0.3 (no 4.1.x): npm 10.9.9 falla con un error interno (`Cannot read properties of null (reading 'edgesOut')`) al instalar Vitest 4.1.x, incluso en un directorio vacío; con Vitest 5.0.3 la instalación funciona. Compatibilidad verificada: el plugin declara `vitest ^4.1.0 || ^5.0.0` y depende de wrangler 4.149.0 (la versión instalada); Vitest 5.0.3 exige Node `^22.12.0 || ^24.0.0 || >=26.0.0` y el proyecto usa Node 22.
- Los tipos del runtime se generan con `wrangler types` dentro del script `typecheck`; `worker-configuration.d.ts` no se versiona.

## TAREA 4: Pull Request (c), proyecto Expo base

Objetivo: dejar la aplicación Android base en `app/` con Expo, React Native y TypeScript, sin autenticación, navegación funcional, almacenamiento ni módulos de gastos.

### Decisiones de la app

- Expo SDK 57 estable (expo 57.0.27), con las versiones que fija Expo: React 19.2.3 y React Native 0.86.3. No se usa React Native 0.87.x aunque sea la última, porque no es la del SDK.
- Nombre visible: `CuidaTuBilletera`. Slug: `cuida-tu-billetera`.
- `android.package`: `com.cuidatubilletera.app`. Aprobado por el orquestador y el usuario antes de comenzar la Fase 1 — Autenticación. Plataforma inicial: Android.
- Metro usa la configuración automática de Expo; no se creó `metro.config.js` porque no hizo falta.
- Pruebas de la app con Jest, `jest-expo` y `@testing-library/react-native`, sin `react-test-renderer` como dependencia directa. `jest-expo` lo trae como dependencia propia (19.2.3) y RNTL 14 exige `test-renderer` como peer. Los tests se ejecutan con `jest --ci`.
- El CI agrega el paso `npm run build --workspace controlgastos-app`, que genera el bundle Android con `expo export`, sin build remoto.

### `overrides.react` en el `package.json` raíz

- Motivo: varios paquetes de Expo declaran `react` como peer opcional con rango `*`, y npm instala entonces la última versión (19.3.0) en la raíz, junto a la 19.2.3 que pide la app. El resultado son dos copias de React.
- Versión fijada: `19.2.3`, la que exige el SDK 57.
- Revisión: debe revisarse y actualizarse con cada actualización del SDK de Expo, junto con las versiones de `react` y `react-native` de `app/package.json`.
- Alternativas descartadas: declarar `react` en la raíz (agrega una dependencia espuria) y cambiar de gestor de paquetes (descartado en Herramientas).

### Auditoría de dependencias del 10/10/2026

- `npm audit` señala 59 paquetes (47 de severidad alta, 12 moderada y ninguno crítico). Provienen de cuatro familias de avisos; los demás paquetes aparecen solo por depender de ellas.

| Familia | Severidad | Origen | Herramienta afectada |
| --- | --- | --- | --- |
| `braces` 3.0.3 y `micromatch` | Alta | Jest y Metro | Pruebas y empaquetado |
| `node-forge` 1.4.0 | Alta | `@expo/cli` | CLI de Expo (firma de código) |
| `sprintf-js` 1.0.3 | Moderada | Jest (`babel-plugin-istanbul`) | Pruebas |
| `uuid` 7.0.3 | Moderada | `xcode`, vía `@expo/config-plugins` | Prebuild de iOS |

- Ninguna es dependencia de runtime de la app ni de la API. La exposición se limita al entorno local de desarrollo y al CI.
- No existe versión corregida de `braces`, `node-forge` ni `sprintf-js` en el registro: la última publicada coincide con el límite del rango afectado. Para `uuid` existe una corrección, pero implica forzar un salto de versión mayor sobre `xcode`.
- Las correcciones que propone `npm audit` bajan Expo a 44, React Native a 0.72 o cambian de SDK, por lo que se descartan.
- Decisión: aceptar los avisos de forma provisional, con seguimiento explícito. Esto no afirma que las dependencias sean completamente seguras.
- No se ejecuta `npm audit fix` ni `--force`, y no se actualizan dependencias por este motivo. No se agrega `npm audit` como paso bloqueante del CI mientras no haya correcciones disponibles.
- Seguimiento: reevaluar los avisos al actualizar dependencias o el SDK, y antes del APK de prueba (Fase 7).
- Limitación: no se verificó exhaustivamente el contenido del bundle Android. La conclusión de que estos paquetes no están en runtime se basa en las rutas de dependencia.
- `plugins: ["expo-status-bar"]` en `app.json` es válido pero innecesario por ahora. Se deja sin cambios y no bloquea.

### Pendientes de validación

- Prueba física en un dispositivo Android con Expo Go. El bundle generado solo demuestra que Metro compila. Tampoco se verificó que la versión de Expo Go de la Play Store soporte el SDK 57; si no lo hace, la alternativa es el SDK 56.
- Ejecución del CI en GitHub, incluido el paso nuevo de `expo export`, cuando exista el Pull Request.

## TAREA 5: Pull Request (e), despliegue a Cloudflare (CD inicial)

Esta tarea ajusta por fases la decisión de la sección Worker ("Producción se despliega al fusionar a main"). Guía operativa: docs/006-DESPLIEGUE.md.

### Decisiones

- El despliegue es **exclusivamente manual** (`workflow_dispatch`) y solo desde `main`. La activación automática al fusionar a `main` requiere una autorización futura y un nuevo registro aquí.
- Workflow `.github/workflows/deploy.yml`, independiente del CI. `ci.yml` no se modifica.
- Se usa Wrangler desde el lockfile (`npx --no-install wrangler`), sin `cloudflare/wrangler-action` ni otra herramienta.
- `actions/checkout` (v7.0.1) y `actions/setup-node` (v7.1.0) fijadas por SHA completo, verificado con la API de GitHub.
- GitHub Environment `production`, con revisor requerido y despliegue restringido a `main`. `CLOUDFLARE_API_TOKEN` es secreto del Environment; `CLOUDFLARE_ACCOUNT_ID` y `WORKER_URL` son variables del Environment.
- El workflow comprueba que la ejecución corresponde a `main` y que el SHA es el vigente antes de publicar. Usa `concurrency` y `permissions: contents: read`.
- `api/wrangler.jsonc`: `workers_dev: true` y `preview_urls: false` explícitos.
- Al registrarse esta decisión solo existía el entorno `production`. *(Actualización Fase 2A: `api/wrangler.jsonc` declara ahora `env.dev` con la base D1 de desarrollo, y el Worker `controlgastos-api-dev` está desplegado solo en DEV; no hay D1 de producción.)*
- La verificación de `GET /health` solo se ejecuta si `WORKER_URL` está configurada; si no, queda **pendiente** y no se considera aprobada.
- Rollback manual documentado, no automatizado.
- La tarea "Configurar CD (despliegues)" del Roadmap sigue sin marcar hasta que exista un despliegue exitoso y verificado.

### Pendientes de validación

- *(Histórico: estado de la Fase 0 al registrar esta decisión; el despliegue se validó después, ver docs/004-ROADMAP-PROYECTO.md.)* Ningún despliegue real se ha ejecutado: no hay cuenta, token ni Environment configurados.
- *(Histórico: estado de la Fase 0.)* El workflow no se ha ejecutado en GitHub; solo se revisó su sintaxis localmente.
- Fijar por SHA las acciones de `ci.yml` queda como decisión aparte.

## FASE 1: Autenticación con Google (implementación transitoria)

Aprobado por el orquestador. Esta sección registra la excepción a la constitución §4 antes de escribir el código.

### Excepción arquitectónica aprobada

- **No se implementa todavía** *(histórico: sustituido por la Fase 2A, ver «Decisión 2A.3» más abajo)*: D1, tabla `users`, tabla `refresh_tokens`, `POST /auth/refresh`, `POST /auth/logout` ni revocación centralizada. Corresponden a la fase con D1 (Fase 2).
- Esta solución es **transitoria**. No es el modelo definitivo de producción. El diseño objetivo sigue siendo el de la constitución §4.
- **Limitación explícita**: un JWT emitido sigue siendo válido hasta su expiración (15 minutos), incluso después del logout local, porque el servidor no puede revocarlo.
- La identidad del usuario es el claim `sub` de Google. No se persiste nada en el servidor; `GET /me` devuelve los claims del JWT propio.

### Decisiones

- **Google Sign-In**: `@react-native-google-signin/google-signin` 16.x, API **Original** (`GoogleSignin`). Sin `GoogleOneTapSignIn` ni licencia comercial. Limitación: la API Original usa el Google Sign-In heredado de Android (Google Play Services), no Credential Manager.
- **Plugin de Expo del módulo de Google: no se usa.** Sin opciones, el plugin aplica la configuración de Firebase (`google-services`) y rompería el build Android sin `google-services.json`; con `iosUrlScheme` solo configura iOS. Para Android sin Firebase el módulo se enlaza por autolinking y no necesita plugin. Se vuelve a evaluar si se añade iOS o Firebase.
- **Clientes OAuth**: el cliente **Web** es el `webClientId` de la app y la audiencia (`aud`) que valida la API. El cliente **Android** solo se registra en Google Cloud (paquete + SHA-1 del keystore de EAS); en la API se usa únicamente para la política `azp` (ver abajo). El Client Secret no se usa.
- **Validación del ID token** (API, `jose` + JWKS de Google): firma RS256 únicamente, emisor `https://accounts.google.com` o `accounts.google.com`, audiencia = `GOOGLE_WEB_CLIENT_ID`, vigencia, `sub` presente y `email_verified === true`.
- **Política `azp`**: si el claim `azp` está presente y existe `GOOGLE_ANDROID_CLIENT_ID` configurado, se acepta `azp` igual al cliente Android o al cliente Web; cualquier otro valor se rechaza. No se exige que `azp` exista. Debe confirmarse con un token real del dispositivo cuando se pruebe el build.
- **JWT de sesión propio**: HS256 con `JWT_SECRET` (mínimo 32 caracteres, sin valor por defecto), 15 minutos, claims `iss`, `aud`, `sub`, `iat`, `exp` y además `email` y `name` para que `GET /me` funcione sin base de datos. Audiencia distinta de la de Google. Sin configuración válida, la API no emite sesiones (500 `CONFIG_ERROR`).
- **Sesión en la app**: `expo-secure-store` guarda solo el JWT propio. Nunca se guarda el ID token de Google. Renovación silenciosa con `signInSilently` + `POST /auth/google`, protegida contra concurrencia y sin reintentos infinitos. Un error de red no borra una sesión aún válida.
- **Backup Android**: se usa el config plugin de `expo-secure-store` con `configureAndroidBackup` en su valor por defecto (activo), que añade reglas de respaldo que excluyen los datos de SecureStore. No se establece `android.allowBackup: false`.
- **UI**: renderizado condicional (inicializando / no autenticado / autenticado), sin React Navigation ni TanStack Query en esta fase.

### Validación en Android y corrección OAuth

- **Verificado en un teléfono real** (development build, API `controlgastos-api-dev`): login con Google, validación del token en la API, restauración de sesión al reabrir, sesión visible tras 16 minutos, renovación silenciosa tras casi una hora y logout. Detalle en `docs/004-ROADMAP-PROYECTO.md`.
- **Incidente `DEVELOPER_ERROR` (código nativo 10)**: el cliente OAuth Android de Google Cloud tenía registrada la SHA-1 `81:BC:E7:00:…:6C:53`, que no pertenece al keystore con que EAS firma el APK. Se corrigió registrando la del keystore actual de EAS.
- **SHA-1 correcta del keystore de EAS** (huella pública de certificado, no es un secreto): `26:E4:D0:9D:2C:EB:53:62:69:B7:1D:FB:5A:CA:4C:BF:36:CE:73:F4`. Verificada sobre el APK con dos herramientas independientes (parseo del bloque de firma v2 y `openssl x509 -fingerprint`) y comprobando la firma contra la clave del certificado.
- **Lección**: un valor `7E:ED:FF:82:…` atribuido al segundo APK resultó ser un error de extracción y no una tercera clave. Las huellas deben verificarse con `apksigner verify --print-certs` (o `eas credentials -p android`), no con scripts propios. `keytool -printcert -jarfile` no sirve para APK con solo firma v2/v3.
- **Aviso**: el keystore de EAS se generó el 13/10/2026. Si se regenera, cambia la SHA-1 y debe actualizarse el cliente OAuth Android. Los comandos `eas` se ejecutan siempre desde `app/` (un `app.json` accidental en la raíz, vacío, se eliminó).
- Se retiraron el diagnóstico en pantalla y los registros temporales usados en la investigación; los mensajes amigables y el tratamiento de errores no cambiaron.

### Renovación silenciosa: evidencia y límites

- **Prueba**: la app estuvo casi una hora sin usarse (más de 3 veces la vida de 15 minutos del JWT). Al reabrirla apareció directamente «Sesión iniciada», sin pulsar «Ingresar con Google».
- **Registros de Cloudflare** (`controlgastos-api-dev`): dos solicitudes `POST /auth/google`, primero HTTP **401** y después HTTP **200**. El 200 confirma un intercambio exitoso y la emisión de un JWT propio, según el flujo implementado (`restore` → `signInSilently` → `POST /auth/google` → guardado en SecureStore).
- **Qué está validado**: el comportamiento funcional (sesión recuperada sin intervención y emisión de JWT en el servidor). Con un JWT guardado vencido, el código solo llega a «autenticado» tras un intercambio exitoso.
- **Qué NO se verificó**: los claims `iat` y `exp` del JWT nuevo no se inspeccionaron ni se compararon con los del anterior. Es una limitación conocida, no un fallo.
- **HTTP 401 previo al 200 — causa NO determinada.** No se conoce qué lo originó ni qué código de error devolvió la API. Observación de la lectura del código, no una explicación: en `doRefresh` un rechazo de la API (`rejected`) cierra la sesión local, por lo que un único flujo con 401 no debería terminar autenticado; el 200 posterior sugiere un segundo intento, por ejemplo una segunda restauración al reabrir la app o un ID token de Google viejo seguido de uno renovado. Son hipótesis sin comprobar. Para investigarlo: obtener el código de error de la respuesta 401 en los registros de la API y comprobar si hubo dos restauraciones simultáneas. No hay corrección planificada hasta conocer la causa.

### Pendientes de validación

- **Causa del 401** previo al 200 en la renovación y, opcionalmente, inspección directa de `iat`/`exp` del JWT renovado (ver sección anterior).
- Política `azp`: el login real fue aceptado, pero no se registró si el token trae `azp` ni su valor; queda por confirmar y documentar.
- `JWT_SECRET` debe crearse como secreto de Cloudflare antes de desplegar. El Client Secret Web que apareció en una captura debe rotarse en Google Cloud.

## Fase 2 — Decisiones funcionales aprobadas (13/10/2026)

### Moneda y cuentas

- La aplicación v1 utiliza exclusivamente USD.
- El usuario crea manualmente su primera cuenta.
- El saldo inicial es opcional; valor por defecto: 0 centavos.
- Cada cuenta nueva recibe sus 11 categorías iniciales en una operación atómica.

### Autenticación persistente

- JWT de acceso: 15 minutos.
- Refresh token: 7 días de inactividad.
- Cada renovación exitosa rota el refresh token e invalida el anterior.
- La rotación será atómica en D1.
- El logout debe revocar el refresh token.
- No se ha aprobado todavía una duración máxima absoluta adicional de sesión.

### Categorías

- El tipo ingreso/egreso es inmutable.
- Se permiten cambios de nombre, descripción, icono y color.
- Una categoría sin movimientos asociados puede eliminarse físicamente.
- Una categoría con movimientos asociados no puede eliminarse; sí puede editarse o archivarse.
- Los movimientos anulados siguen contando como referencias de la categoría.

### Movimientos (implementación funcional en Fase 3)

- No se permite cambiar el tipo ingreso/gasto después de registrar.
- No se permite cambiar la categoría asignada.
- Se permite modificar monto, fecha y nota.
- Se permite eliminar un movimiento de cualquier antigüedad mediante anulación lógica.
- Los movimientos anulados no afectan el saldo ni los reportes ni el historial habitual.
- Los movimientos anulados se conservan para auditoría.

### Límites de esta aprobación

- Las reglas de movimientos se documentan ahora, pero se implementan en Fase 3.
- La estructura técnica de D1, contratos JSON y estrategia de migración de sesiones requieren revisión antes de implementar.
- Los pendientes de seguridad de la Fase 1 permanecen abiertos y no se consideran resueltos.

## Fase 2A — Arquitectura de D1 y sesiones aprobada

> **Nomenclatura.** Los encabezados «Fase 2A.1» a «Fase 2A.7» de este documento son decisiones numeradas en orden cronológico (Decisión 2A.1 a 2A.7). No equivalen a las subfases «Fase 2A.1 — D1, usuarios y sesiones en API» y «Fase 2A.2 — Integración Android» del plan de docs/004-ROADMAP-PROYECTO.md. Para evitar confusiones se cita aquí «Decisión 2A.n» y en el Roadmap «subfase 2A.1/2A.2»; los encabezados existentes no se renumeran.

Decisiones aprobadas por el usuario:

1. Access JWT de 15 minutos.
2. Refresh token de 7 días de inactividad, con ventana deslizante.
3. Rotación atómica en D1.
4. Máximo de 5 sesiones independientes por usuario.
5. En el sexto inicio, expulsar la sesión menos recientemente utilizada.
6. Logout remoto limitado a la familia de la sesión correspondiente.
7. Gracia de 30 segundos para reutilizaciones inmediatas:
   HTTP 409 sin revocación.
8. Reutilización posterior: HTTP 401 y revocación de la familia.
9. Campos `family_id`, `replaced_by` y `revoked_reason` aprobados.
10. JWT v2 con UUID interno en `sub`, conservando `email` y `name`.
11. JSON de API en camelCase, manteniendo compatibilidad cuando sea posible.
12. Migración 0001: `users` y `refresh_tokens`.
13. Migración 0002: `accounts` y `categories`, en el bloque 2B.
14. Cambios Android en un PR independiente.
15. Sin límite absoluto adicional de duración de la sesión.
16. Persistencia en D1 de desarrollo separada de producción.
17. Fechas UTC ISO-8601 y UUID en texto.
18. Se acepta la validez residual de los JWT hasta 15 minutos tras logout.

Pendientes técnicos antes del despliegue:

- Probar atomicidad y concurrencia de la rotación en D1 local y remoto.
- Verificar el índice único parcial y las sentencias SQL utilizadas.
- Validar la transición de JWT antiguos a JWT v2 en Android.
- Revisar el comportamiento ante pérdidas de respuestas y fallos de SecureStore.
- Configurar los bindings y secretos propios de cada entorno.
- Mantener documentados los riesgos de credenciales pendientes de Fase 1.

Las decisiones funcionales de cuentas, categorías y movimientos aprobadas
anteriormente permanecen vigentes.

### Fase 2A.1 — Retención de refresh tokens: sin purga

Decisión aprobada por el usuario:

- En la Fase 2A.1 no se implementa ninguna purga ni limpieza de refresh tokens (ni programada ni oportunista).
- Los tokens rotados, revocados o vencidos se conservan en `refresh_tokens`.
- Para el límite de 5 sesiones solo cuentan las familias vigentes (token activo con `expires_at` posterior al instante actual). Un token activo ya vencido no cuenta, no se expulsa y permanece inerte.
- Motivo: simplicidad y trazabilidad de la reutilización tardía; el volumen esperado es bajo.
- Consecuencia asumida: la tabla crece sin límite hasta que se apruebe una política de retención en una fase posterior (riesgo registrado, sin migración asociada).
- Despliegue: las migraciones remotas y el despliegue son manuales y requieren autorización expresa (docs/001-CONSTITUCION.md §10).

### Fase 2A.2 — Clasificación de un token rotado por el estado vivo de la familia (R1)

Decisión aprobada por architect (sin migración ni cambio de esquema):

- Problema: un token rotado cuya familia se revocó después (logout, expulsión por límite de sesiones o reutilización previa) conserva `revoked_reason = 'rotated'`, porque la revocación de familia solo toca tokens con `revoked_at IS NULL`. Dentro de la ventana de gracia, `refreshSession` devolvía `REFRESH_CONFLICT` aunque no existiera un sucesor vigente.
- Regla: al presentar un token rotado, la API lo clasifica así:
  - A: dentro de gracia y la familia conserva un token vigente (`revoked_at IS NULL` y `expires_at` posterior a ahora) => `REFRESH_CONFLICT`.
  - B: dentro de gracia y la familia no conserva ningún token vigente => `INVALID_TOKEN`, sin escrituras.
  - C: fuera de gracia => reutilización tardía: se revoca la familia y se responde `INVALID_TOKEN`.
- La gracia es estrictamente menor que 30.000 ms: 29.999 ms es A o B; 30.000 ms o más es C.
- Implementación: `findRefreshTokenByHash` calcula `family_live` en la misma consulta (solo para tokens rotados) con un sub-SELECT filtrado por `family_id`, que usa el índice parcial único de familias no revocadas. No añade consultas al refresco exitoso.
- La representación pública de `REFRESH_CONFLICT` e `INVALID_TOKEN` no cambia y ninguna de las dos respuestas incluye credenciales.

### Fase 2A.3 — Integración HTTP de sesiones persistentes (paso 276)

Decisiones aprobadas por el orquestador y el usuario:

- D1. `POST /auth/google` pasa a emitir JWT v2 y refresh token (reemplazo único, sin ruta paralela). La respuesta añade `refreshToken` y `refreshExpiresAt` (ISO UTC) a los campos ya consumidos por Android (`accessToken`, `tokenType`, `expiresIn`, `user.{id,email,name}`); los campos extra son compatibles.
- D2. `refreshExpiresAt` lo calcula la ruta con `refreshExpiry(now)`, usando un único `now` por petición que también se pasa al servicio; `AuthSession` no cambia.
- D3. `session-service.ts` (JWT v1) queda sin uso en producción. No se borra sin autorización; es deuda a retirar en un cambio posterior.
- D4. El código público para un refresh token inválido es `INVALID_REFRESH_TOKEN` (el servicio usa internamente `INVALID_TOKEN`). El mensaje es idéntico para todos los casos inválidos. `REFRESH_CONFLICT` responde 409. El formato del token (43 caracteres base64url) se valida con 400 `INVALID_REQUEST` antes de hashear o consultar D1.
- D5. `Cache-Control: no-store` en todas las respuestas de `/auth/*` y `/me`, incluidos errores y 204. No aplica a `/health` ni al 404 global. Sin CORS.
- D6. `user.id` pasa del `sub` de Google al UUID interno de `users`. `GET /me` consulta la fila en D1 (nunca confía en los claims).
- D7. Los JWT v1 en circulación se rechazan (401 `INVALID_TOKEN`) en `/me`; la app los renueva repitiendo `POST /auth/google`.
- D8. Sin binding `DB`, las cuatro rutas responden 500 `CONFIG_ERROR` antes de procesar la solicitud. `errorHandler` registra solo el nombre del error inesperado (el mensaje de D1 puede incluir SQL, valores enlazados o hashes); la respuesta pública no cambia.

### Fase 2A.4 — Límite preventivo del cuerpo JSON de /auth/* (paso 277)

- Alcance: `POST /auth/google`, `/auth/refresh` y `/auth/logout`, mediante el helper único `readJsonBody` (`api/src/lib/json-body.ts`), que sustituye a `request.json()`.
- Límite: `MAX_JSON_BODY_BYTES` = 16 KiB (16 384 bytes). El mayor campo aceptado es `idToken` (máximo 8192 caracteres); el resto es margen para el envoltorio JSON y escapes. Se cuentan bytes reales, no caracteres.
- Mecanismo: un `Content-Length` declarado mayor al máximo se rechaza sin leer el cuerpo. Sin `Content-Length` (chunked) o con uno falso, el stream se lee con contador y se cancela al excederse, sin acumular el cuerpo completo.
- Respuesta: 413 `PAYLOAD_TOO_LARGE` ("El cuerpo de la solicitud es demasiado grande."), con el formato de error único y `Cache-Control: no-store`, sin detalles internos. Motivo de 413 en lugar de 400: es el código HTTP semántico y permite distinguirlo de `INVALID_REQUEST`.
- Orden: la configuración (`requireGoogleWebClientId`, `requireJwtSecret`, `requireDb`) se valida primero; luego el tamaño; luego JSON y esquema. JSON inválido o ausente sigue siendo 400 `INVALID_REQUEST`. D1 no se toca en ningún rechazo.
- El contrato JSON de las respuestas existentes no cambia.
- `POST /auth/google` sin la claim `name`: `identity.name ?? null` guarda `nombre` NULL y `user.name` se omite de la respuesta; `GET /me` coincide. Cubierto por prueba.

### Fase 2A.5 — Conservación del nombre persistido y pruebas de borde del límite (paso 278)

- Decisión: el nombre guardado en `users.nombre` se conserva cuando Google no entrega un nombre válido en un login posterior. "Válido" sigue la normalización existente (`normalizeNombre`): se recorta con `trim` y un valor ausente, vacío o solo espacios cuenta como no válido. Google sigue siendo la fuente cuando entrega un nombre válido distinto: en ese caso se actualiza.
- Motivo: un login sin la claim `name` sobrescribía con NULL un nombre ya conocido, degradando `user.name` en la respuesta y en `GET /me` sin que el usuario hubiera cambiado nada.
- Implementación (sin migración): `UPSERT_USER_SQL` usa `nombre = COALESCE(excluded.nombre, users.nombre)` y el `WHERE` compara contra el valor efectivo (`users.nombre IS NOT COALESCE(excluded.nombre, users.nombre)`). `updated_at` solo cambia si cambia el correo o el nombre efectivo; `id` y `google_sub` nunca cambian; sin cambios no hay escritura. Un usuario nuevo sin nombre válido se guarda con NULL; un NULL guardado se completa cuando Google entrega un nombre válido. La firma pública y el resultado de `upsertUserByGoogleSub` no cambian, y `auth-session-service` no se modifica (construye la respuesta desde la fila).
- Límite del cuerpo (2A.4), pruebas de borde: un `Content-Length` no numérico o negativo (`abc`, `1e3`, `12abc`, `-1`, `0x10`, `+5`, vacío) se ignora y se cuentan los bytes reales; no es un bypass del límite (cuerpo > 16 KiB sigue en 413). Un `idToken` de 8193 caracteres responde 400 `INVALID_REQUEST` sin invocar la verificación de Google. El contrato HTTP no cambia.

### Fase 2A.6 — Token de renovación consumido por un 409 en la app móvil (M2)

Contexto: `POST /auth/refresh` responde 409 `REFRESH_CONFLICT` cuando el token presentado ya fue rotado dentro de la gracia de 30 s y la familia conserva un sucesor vigente (2A.2). Ese sucesor puede estar en otro proceso o dispositivo. El token enviado queda consumido y jamás debe reenviarse: pasados 30 s la API lo trata como reutilización, responde 401 y revoca la familia entera, incluido el sucesor legítimo. Sin una marca persistente, un reinicio, un «Reintentar» o el fin del enfriamiento de 60 s podían reenviarlo. No hay cambios en la API, el contrato HTTP ni el esquema D1.

- D1. Marca de consumido. `StoredSessionV2` admite el campo opcional `refreshConsumed?: true` en la misma entrada `session_v2` (`version` sigue siendo 2). Ante un 409 la app marca el token primero en memoria, antes de releer el disco, y luego intenta persistir la marca. Si la persistencia falla se recuerda en `unpersistedMark` y se reintenta antes de cualquier llamada a Google. Un refresh token marcado nunca se envía a `/auth/refresh`: ni en el mismo ciclo, ni tras 60 s, ni con «Reintentar», ni en `authorizedCall`, ni tras reiniciar la app. El único acceso a `/auth/refresh` está detrás de ese guard.
- D2. Relectura del disco. Tras el 409 la app espera 1000 ms más un jitter de hasta 250 ms y relee el almacenamiento por la cola. Si hay una sesión con otro refresh token, la adopta como sucesor (sin heredar la marca) y la publica si su access sigue fresco, o la rota una sola vez. Un segundo 409 sobre el sucesor también lo marca como consumido (memoria y disco) y termina en `unavailable('server')`, sin Google ni familia nueva. Al restaurar, la marca es memoria OR disco, en ambos sentidos.
- D3. Sin sucesor. Si no aparece sucesor, la marca se persiste ANTES de llamar a Google, con compare-and-set por `epoch` y por refresh token dentro de la cola. Si la marca no se puede persistir, no se llama a Google. Solo después se recupera con Google, con el enfriamiento de 60 s, un `exchangeGoogleToken` por ciclo y single-flight.
- D4. Escritura segura. La marca solo se escribe si en disco sigue el mismo refresh token. Con disco vacío, corrupto, legado o con limpieza pendiente (`pendingClear`) no se escribe nada, para no resucitar una sesión cerrada; la marca queda solo en memoria y la recuperación procede. Si en disco hay otro refresh token, se adopta como sucesor sin marcarlo. Todo se revalida contra `epoch`: un logout o un reemplazo concurrente descarta la operación.
- D5. Revocación. Ningún camino con origen 409 llama a `/auth/logout` con el token antiguo, porque `POST /auth/logout` busca por hash también tokens rotados y revoca la familia entera, lo que mataría el sucesor vigente de otro proceso. Solo se revoca la familia NUEVA creada por la propia app cuando no llega a persistirse o publicarse, o cuando Google devuelve otra cuenta. La familia antigua solo se revoca tras una recuperación con origen 401 `INVALID_REFRESH_TOKEN` (token ya muerto; la llamada es idempotente e inocua). El cierre de sesión explícito del usuario no cambia.
- D6. Sesión de versión futura (`unsupported`). Una sesión guardada por una versión futura de la app nunca se borra, se sobrescribe ni se marca. En el camino de un 409 se trata como fallo de almacenamiento: `unavailable('storage')` (o degradada si el access sigue vigente), sin Google, sin `exchangeGoogleToken`, sin reenviar el token, sin familia nueva y sin `/auth/logout`. Lo mismo ocurre en `restore()` y tras reiniciar. La comprobación de `unsupported` en `commit` va antes del atajo de la marca, para que una versión futura persistente no se confunda con «nada que marcar»; de lo contrario cada «Reintentar» crearía y revocaría una familia, pudiendo expulsar sesiones legítimas de otros dispositivos por el límite de 5.
- D7. Reintentos manuales. «Reintentar» respeta un intervalo mínimo de 5 s entre intentos que llegan a la red, y un ciclo activo se espera sin lanzar un segundo refresh por la misma pulsación.
- Compatibilidad hacia atrás. Una sesión v2 sin el campo equivale a «no consumida» y renueva como siempre; `false` se interpreta como sin marca; cualquier otro valor presente se interpreta de forma conservadora como consumido, sin volver corrupta la sesión. `saveSession` solo serializa el campo cuando es `true`; toda sesión nueva (rotación, recuperación, inicio de sesión, migración) se guarda sin él. La migración v1 y la rotación normal no cambian.
- Riesgos residuales aceptados:
  - Marca no persistida más reinicio de la app (SecureStore falla al escribirla): el token consumido se reenvía una vez al arrancar. Con menos de 30 s desde su rotación la API responde 409 y se vuelve a marcar; con 30 s o más la API lo trata como reutilización tardía, revoca la familia entera (incluido el sucesor de otro proceso) y el usuario debe iniciar sesión de nuevo.
  - Si el almacenamiento falla de forma persistente, la app permanece no disponible por almacenamiento hasta que se recupere; no hay cola persistente de reintentos.
  - Procesos o versiones antiguas de la app descartan el campo al guardar y pueden reenviar el token consumido (409 o, pasados 30 s, 401 con revocación de la familia). Solo aplica a una degradación de versión y no tiene mitigación.
  - SecureStore no ofrece compare-and-set entre procesos: el compare-and-set cubre la cola local, pero un proceso puede sobrescribir la marca o un sucesor de otro entre la relectura y la escritura. El enfriamiento de la recuperación vive solo en memoria y un reinicio permite una nueva llamada a Google (una por arranque, sin bucle).
  - Con `unsupported` en disco y origen 401 (no 409), la recuperación con Google puede ejecutarse una vez por enfriamiento; la familia nueva no se puede guardar, se revoca y no se sobrescribe la sesión futura. La rotación exitosa y el inicio de sesión interactivo no releen el disco antes de guardar.
  - Si el logout no pudo borrar el disco (`pendingClear`), la marca no se escribe y `pendingClear` no sobrevive a un reinicio; esa sesión ya fue revocada por el logout.
  - La app no puede distinguir si un sucesor pertenece a otro proceso del mismo dispositivo o a otro dispositivo; solo adopta el que encuentra en su propio almacenamiento. Tras un 409 sin sucesor, la recuperación con Google crea una familia nueva y la antigua, que puede seguir viva en otro proceso, no se revoca y expira sola.

### Fase 2A.7 — Recuperación por AppState y sesión degradada (Decisión 2A.7)

Contexto: decisiones ya implementadas en `app/src/hooks/use-auth.tsx` y `app/src/lib/auth-service.ts`, y validadas con pruebas automatizadas y en un teléfono Android real. No hay cambios en la API, el contrato HTTP ni el esquema D1. Conserva JWT v2, el single-flight, `epoch` y la marca `refreshConsumed` de la Decisión 2A.6.

- D1. Recuperación al volver a primer plano. `AuthProvider` escucha `AppState` y llama a `onForeground()` solo en la transición de segundo plano o inactiva a `active`, con un anti-rebote de 1000 ms. `onForeground()` no hace nada durante la carga inicial, con una operación en vuelo o sin sesión (nunca llama a Google en automático tras un logout). Con la sesión no disponible, o degradada con el access fresco, delega en `restore()`; con el access fresco y sesión normal no usa la red; con el access por vencer (también si está degradada) ejecuta la renovación normal.
- D2. Sesión degradada. Si falla la renovación por una causa transitoria (red, timeout, 5xx) y el access en memoria sigue vigente, la sesión se conserva con `degraded: true` y se muestra «Reintentar» (`restore()`). Sin access vigente queda `unavailable`. Jamás se borra el almacenamiento por un fallo transitorio.
- D3. Revalidación mediante `GET /me`. En una sesión degradada con el access vigente, `restore()` hace una sola comprobación `GET /me` con el access en memoria. Deliberadamente NO usa `authorizedCall`: un 401 allí rotaría el refresh token con el access aún vigente por reloj. Con 200 se quita `degraded` y se publica el usuario; con el access dentro del margen de 60 s, `restore()` renueva con el refresh token en lugar de llamar a `/me`.
- D4. Política conservadora ante un HTTP 401 de `/me` con access vigente. No se rota, no se llama a Google, no se crean familias ni se borra el almacenamiento: la sesión sigue degradada con `error = 'rejected'`, y el siguiente uso real (`authorizedCall`) o la renovación proactiva por margen lo resuelven. Motivo: un 401 con access vigente por reloj es ambiguo (reloj, revocación, fallo transitorio) y una acción destructiva sería irreversible.
- D5. Separación entre conectividad y autenticación. Solo un 401 produce `error = 'rejected'`, que la pantalla muestra como «No pudimos verificar tu sesión…»; red, timeout, 429 y 5xx muestran el aviso de conectividad. Un fallo posterior de otro tipo reemplaza el error anterior; ni un ciclo fallido por red ni un logout arrastran el 401.
- D6. Respuestas tardías. `revalidate()` descarta el resultado si cambió `epoch`, la generación de la sesión, el access en memoria, hay un ciclo activo o terminó uno (`cycleSeq`). `busy` se libera en todas las salidas; un ciclo activo lo libera al publicar.
- D7. Intervalos. `restore()` en estado `unavailable` o degradado respeta 5 s entre intentos que llegan a la red (`RESTORE_MIN_INTERVAL_MS`); un `restore()` normal no está bloqueado por ese intervalo. La recuperación con Google conserva su enfriamiento de 60 s.
- D8. `expo-network` aplazado. La detección automática de conectividad NO está implementada ni se añade ninguna dependencia: hoy el reintento es manual («Reintentar») o por regreso a primer plano. Se evaluará en una decisión futura, con revisión arquitectónica.
- D9. Propiedad de `busy` frente a `signIn()` (Paso 322, riesgo R1). Una operación solo libera `busy` si sigue siendo la propietaria. `signIn()` registra un `signInToken` (síncrono con `busy: true`) que libera en `finally` solo si sigue siendo suyo. `restore()` no hace nada mientras haya un `signIn()` en vuelo y `signIn()` se rechaza si hay `busy` o un `restore()` en curso (exclusión simétrica). `signOut()` anula `signInToken` y `restoring` en su parte síncrona, de modo que ni un `signIn()` ni un `restore()` obsoletos bloquean la operación siguiente. `epoch`, `generation`, `cycleSeq`, el single-flight y los intervalos no cambian.
- Riesgos residuales aceptados: `revalidate` publica el usuario de `/me` en el estado, no en `session.user` de memoria; otras escrituras de `busy: false` (`publishSession`, `markTransient`, `endSession`) pueden venir de un ciclo de renovación iniciado antes o durante un `signIn()` (solución posible: un setter central de `busy`, no implementada); si `signIn()` se invoca en `initializing` antes de `restore()` y se cancela, el estado puede quedar en `initializing` (la interfaz no ofrece el inicio de sesión en ese estado, no verificado); tras un logout con un selector de Google abierto, un `signIn()` nuevo puede convivir con el anterior y el resultado viejo se descarta por `epoch`; un `restore()` obsoleto puede hacer una llamada de red inocua con el token de la sesión nueva, cuyo resultado se descarta. La rama de `commit` posterior a `saveSession` con logout concurrente queda cubierta por pruebas (Paso 322).

### Fase 2B.1 — Primer incremento de cuentas y categorías (Decisión 2B.1)

Contexto: primer incremento de la Fase 2B del Roadmap, definido por `architect` a partir de docs/001 (§5 y §6). Valores por defecto adoptados para D1–D4 sin intervención del usuario; son reversibles.

- D1. Alcance de la API: migración 0002 con `accounts` y `categories` (UUID y timestamps UTC como en 0001; nombre de categoría único por (`account_id`, `tipo`) ignorando mayúsculas ASCII en la base de datos y, además, mayúsculas no ASCII en la API (`toLocaleLowerCase('es')`); no se ignoran las tildes («Alimentacion» y «Alimentación» son nombres distintos); índices mínimos de docs/001). Endpoints: `GET/POST/PATCH /accounts`, `GET/POST /accounts/:id/categories`, `PATCH/DELETE /categories/:id`. Quedan fuera `/balance`, `/reconcile` y todo lo relacionado con movimientos.
- D2. No se crea `transactions` (Fase 3). La regla «categoría sin movimientos» se centraliza en `categoryHasTransactions`, que devuelve `false` hasta que exista la tabla; en la Fase 3 consultará todos los movimientos, anulados incluidos, y `transactions.category_id` llevará `ON DELETE RESTRICT`. Pendiente de Fase 3. El saldo no se expone: las cuentas devuelven `saldoInicial`; `balance` se añadirá en la Fase 3.
- D3. Creación atómica: la cuenta y sus 11 categorías iniciales se insertan en un único `db.batch`. `tipo` de categoría y `saldoInicial` no son editables por PATCH (los campos desconocidos se rechazan con 400).
- D4. Aislamiento: la propiedad se verifica por `user_id` del JWT; un recurso ajeno responde 404 igual que uno inexistente. Orden de validación: 401, 413/400, 404, 409.
- D5. Contratos: JSON camelCase; listados paginados con `page` y `page_size` (defecto 50, máximo 100) y respuesta `{ items, page, pageSize, total }`; errores 404 `NOT_FOUND`, 409 `ACCOUNT_ARCHIVED`, `CATEGORY_NAME_TAKEN`, `CATEGORY_IN_USE` y `LIMIT_REACHED`. `Cache-Control: no-store` también en estos recursos.
- D6. Límites de protección en `api/src/lib/limits.ts` (10 cuentas por usuario, 60 categorías por cuenta, cuerpos de 4 KiB). La comprobación COUNT + INSERT no es atómica; se acepta porque protege cuotas y no es una regla de integridad. Los límites por minuto se aplazan.
- D7. Valores por defecto: saldo inicial negativo permitido; nombres de cuenta repetidos permitidos; no se puede desarchivar una categoría de una cuenta archivada (409 `ACCOUNT_ARCHIVED`).
- D8. App sin dependencias nuevas: la navegación se resuelve con estado local y `BackHandler`. React Navigation y TanStack Query (docs/001 §4) se difieren a la Fase 3 porque requieren módulos nativos y una nueva development build. Las llamadas usan `authorizedCall`; los datos no se cachean fuera de los componentes, de modo que cerrar sesión no deja datos del usuario anterior.
- D9. La migración 0002 se valida solo en local. Aplicarla en D1 DEV y cualquier despliegue requieren autorización expresa del usuario.

### Fase 3 — Movimientos (Decisión 3.1)

Contexto: primer incremento de la Fase 3, definido por `architect`. Valores por defecto adoptados sin intervención del usuario; son reversibles salvo la migración una vez aplicada.

- D1. Migración 0003: tabla `transactions` (UUID y timestamps como en 0001 y 0002). `tipo` admite solo `ingreso` y `gasto`; `monto` entero de 1 a 99999999999 centavos (999.999.999,99); `fecha` AAAA-MM-DD válida en el calendario (CHECK `date(fecha) IS fecha`) entre 2000-01-01 y 2100-12-31, con fechas futuras permitidas; `nota` opcional de hasta 500 caracteres; `category_id` obligatoria con `ON DELETE RESTRICT`; `account_id` con `ON DELETE CASCADE`. Índices `(account_id, fecha)` y `(account_id, category_id)`. El `ajuste` queda para la conciliación (requerirá reconstruir la tabla en una migración posterior). Un futuro borrado físico de cuentas o usuarios debe borrar antes los movimientos.
- D2. Endpoints: `POST/GET /transactions`, `PATCH/DELETE /transactions/:id` y `GET /accounts/:id/balance`. `account_id` es obligatorio en el listado. Los listados usan `page_size` con defecto 20 y máximo 100, orden `fecha DESC, created_at DESC, id DESC`, y excluyen los anulados. `desde > hasta` responde 400.
- D3. Reglas: la categoría debe ser de la misma cuenta y de tipo compatible (ingreso con ingreso, gasto con egreso), si no 409 `CATEGORY_MISMATCH`. No se crean movimientos en cuentas ni categorías archivadas (409 `ACCOUNT_ARCHIVED` y `CATEGORY_ARCHIVED`). `tipo` y categoría son inmutables (PATCH estricto, 400). Editar o anular movimientos de cuentas o categorías archivadas está permitido.
- D4. Anulación: `DELETE` es una anulación lógica idempotente (204 también si ya estaba anulado; 404 si no existe o es ajeno). `PATCH` sobre un movimiento anulado responde 409 `TRANSACTION_VOIDED`.
- D5. Aislamiento: todo se acota por el `user_id` de la cuenta. Una cuenta o categoría ajena o inexistente en el cuerpo o en los filtros responde 404, no una lista vacía. Orden de validación: 401, 413/400, 404, 409.
- D6. Saldo: nunca se guarda. Las cuentas devuelven `saldo` (centavos) calculado con una consulta de agregados que excluye los anulados (`saldo_inicial + ingresos − gastos`). `/balance` devuelve `{ accountId, saldoInicial, ingresos, gastos, saldo }`. El servicio comprueba `Number.isSafeInteger` y falla (500) en lugar de devolver cifras imprecisas. Riesgo residual aceptado: solo se alcanza con saldos o volúmenes absurdos.
- D7. Atomicidad: el alta es un único `INSERT ... SELECT` condicionado (propiedad, cuenta y categoría activas, mismo tipo), ejecutado en un `db.batch`. El motivo del rechazo se diagnostica solo cuando no inserta. `categoryHasTransactions` consulta `transactions` sin filtrar `deleted_at`; la eliminación de categoría además captura el error de FK RESTRICT como 409 `CATEGORY_IN_USE`.
- D8. App sin dependencias nuevas: navegación por estado local y `BackHandler`; React Navigation y TanStack Query se difieren de nuevo. Cuenta seleccionada solo en memoria; formulario con monto primero, categorías activas filtradas por tipo, `parseCentsFromInput` y fecha AAAA-MM-DD con botones Hoy y Ayer; Historial con «Cargar más» y filtros de tipo, categoría y rango.
- D9. La migración 0003 se valida solo en local. Aplicarla en D1 DEV y cualquier despliegue requieren autorización expresa del usuario.
- Riesgos aceptados: POST no es idempotente (un reintento tras un timeout puede duplicar; la app no reintenta salvo el 401 de `authorizedCall` y deshabilita el botón); la paginación por desplazamiento puede repetir u omitir filas con altas concurrentes (la app deduplica por `id`); el FK RESTRICT escanea `transactions` al borrar una categoría.

### Fase 4 — Calendario (Decisión 4.1)

Contexto: primer incremento de la Fase 4, definido por `architect`. Valores por defecto adoptados sin intervención del usuario; son reversibles salvo lo indicado. Sin migración.

- D1. Endpoint `GET /calendar?account_id=&month=AAAA-MM` (ya previsto en docs/001 §6) en lugar de agregar en la app a partir de `GET /transactions`. Motivo: un mes con muchos movimientos exigiría decenas de páginas, la paginación por desplazamiento puede repetir u omitir filas con escrituras concurrentes y los totales quedarían truncados o inconsistentes. Una consulta agregada por día es más simple, barata y correcta, y usa el índice `(account_id, fecha)`. Sin cambios de esquema.
- D2. Contrato: respuesta `{ accountId, month, days: [{ fecha, ingresos, gastos, cantidad }] }` con solo los días con movimientos vigentes, orden ascendente, importes en centavos enteros seguros (si no, 500, como el saldo en 3.1 D6). `account_id` UUID obligatorio y `month` AAAA-MM válido entre 2000-01 y 2100-12; parámetros repetidos o vacíos, 400. Orden de validación: 401, 400, 404 (cuenta ajena o inexistente); no hay 409 y las cuentas archivadas se pueden consultar. Excluye anulados, no incluye ajustes (no existen) y se acota por el `user_id` de la cuenta. `Cache-Control: no-store`.
- D3. Reglas de calendario en la app: primer día de la semana lunes (constante `WEEK_START`, reversible: es el uso civil en Ecuador y gran parte de Latinoamérica); aritmética de calendario pura (bisiestos gregorianos, día de la semana por el algoritmo de Sakamoto) sin `Date` local ni `toISOString`; navegación de mes limitada a 2000–2100; selección por defecto de hoy si está en el mes visible y, si no, el día 1; la celda muestra importes compactos (truncados) de ingresos y gastos, y el detalle exacto y el neto del día se ven al seleccionarlo.
- D4. La lista del día usa `GET /transactions` con `desde = hasta = fecha`, `page_size` 20, «Cargar más» y deduplicación por `id`. El formulario recibe `initialFecha` opcional. El mes y el día visibles viajan en la ruta del navegador para sobrevivir a la edición y se recargan al volver.
- D5. Desviación de docs/001 §4: se descarta `react-native-calendars`. La cuadrícula mensual se implementa con componentes propios de React Native, sin dependencias nuevas (ni módulos nativos ni nueva development build; mismo criterio que 2B.1 D8 y 3.1 D8). Se reconsiderará si una fase posterior exige un selector de fechas complejo. React Navigation y TanStack Query siguen diferidos.
- D6. Fuera de alcance: recordatorios, movimientos recurrentes, reportes y ajustes.
- D7. La Fase 4 se valida solo en local; desplegar y probar contra D1 DEV requiere autorización expresa. No hay migración.
- Riesgos aceptados: el calendario y la lista del día son dos lecturas separadas y pueden diferir un instante si hay escrituras concurrentes (se recargan al volver); el día visible depende de la fecha local del dispositivo; sin validación en Android real hasta probar en dispositivo.

### Fase 5 — Reportes (Decisión 5.1)

Contexto: primer incremento de la Fase 5, definido por `architect`. Valores por defecto adoptados sin intervención del usuario; son reversibles. Sin migración ni dependencias nuevas. La exportación (CSV/PDF) queda fuera por indicación del usuario.

- D1. Endpoints `GET /reports/summary`, `/reports/by-category` y `/reports/by-period?group=month|year` con `account_id`, `desde` y `hasta` obligatorios (AAAA-MM-DD, 2000–2100, `desde <= hasta`). Agregar en servidor evita paginar el historial y totales truncados (como 4.1 D1). Orden de validación 401, 400, 404; sin 409; las cuentas archivadas se pueden consultar; `Cache-Control: no-store` también en errores.
- D2. Solo movimientos vigentes de tipo `ingreso` y `gasto`, acotados por `account_id` y por el `user_id` de la cuenta. `balance` es el flujo neto del rango (`ingresos − gastos`) y no incluye el saldo inicial. Los ajustes no existen aún: la consulta filtra el tipo de forma explícita y la conciliación añadirá un campo `ajustes` aparte (docs/001 §5) sin romper el contrato.
- D3. `by-category` devuelve `{ ingresos: { total, items }, gastos: { total, items } }`, con categorías archivadas incluidas (`archivada`), solo las que tienen movimientos en el rango, ordenadas por `total DESC, nombre ASC, id ASC`. Sin paginación (máx. 60 categorías por cuenta): excepción a «todos los listados paginan». Sin porcentajes en el servidor.
- D4. `by-period` rellena con ceros los períodos sin movimientos, recorta los extremos al rango y admite como máximo 120 puntos mensuales (si se excede, 400); `group=year` hasta 101.
- D5. Los totales son centavos enteros seguros; si alguno no lo es, 500 controlado (3.1 D6, 4.1 D2). La app valida la coherencia de las respuestas y calcula porcentajes (una décima) y escalas de barras con BigInt.
- D6. App: pantalla Reportes (botón en Inicio) con modos Mes (defecto), Año y Rango, tarjetas de totales, desglose por categoría con barras hechas con `View`, serie por período con columnas `View`, sin librerías de gráficos. La cuenta es la elegida en Inicio. Tocar una categoría o una tarjeta abre el Historial con filtros iniciales (`initialFilters`). Sin caché fuera de los componentes: cerrar sesión desmonta el navegador.
- D7. Fuera de alcance: presupuestos, conciliación, exportación e IA. La Fase 5 se valida solo en local; desplegar y probar contra D1 DEV requiere autorización expresa.
- Riesgos aceptados: reporte e historial son lecturas separadas y pueden diferir un instante con escrituras concurrentes; los porcentajes redondeados pueden no sumar 100; la serie del modo Rango puede tener hasta 120 columnas en scroll horizontal.

### Fase 5 — Exportación (Decisión 5.2)

Contexto: segundo incremento de la Fase 5, definido por `architect`. Sin migración ni dependencias nuevas. Valores por defecto reversibles, salvo D5, que requiere decisión del usuario.

- D1. `GET /export?account_id=&desde=&hasta=&format=csv` (opcionales `tipo` y `category_id`, como en `GET /transactions`). Orden 401, 400, 404. Solo movimientos vigentes de la cuenta del usuario, ordenados como el Historial. Tope de 2000 filas: si se excede, 400 `EXPORT_TOO_LARGE`, sin truncar. `format=pdf` (u otro) responde 400 hasta que exista la entrega (D5).
- D2. Columnas: `fecha,tipo,categoria,nota,monto,monto_centavos`. `monto_centavos` es la fuente de verdad (entero); `monto` es un decimal derivado con aritmética entera. Los números no se prefijan.
- D3. Formato: BOM UTF-8, CRLF, escapado RFC 4180 y neutralización de inyección de fórmulas (prefijo `'` si el texto empieza con `=`, `+`, `-`, `@`, TAB o CR) solo en `categoria` y `nota`. `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` con nombre generado solo con las fechas validadas, `Cache-Control: no-store` también en errores. Sin logs financieros.
- D4. App: botón «Exportar CSV» en Reportes con la cuenta y el rango del reporte activo (hoy sin filtros de tipo ni categoría; el cliente ya los soporta). Se entrega con `Share.share` de React Native como texto, sin BOM. Limitaciones aceptadas: el CSV llega como texto en el mensaje y no como adjunto; hay un tope práctico de tamaño del Intent (~1 MB); Android no informa si se envió, por lo que la app no afirma éxito. No se escribe ningún archivo.
- D5. Pendiente de decisión del usuario: CSV adjunto y PDF requieren `expo-sharing` (módulo nativo, nueva development build) y declarar `expo-file-system` (hoy solo transitiva de `expo`), con archivo temporal en caché y borrado inmediato. Un PDF 1.4 mínimo generado a mano en el Worker es viable sin dependencias, pero no se implementa hasta poder entregarlo como archivo real.
- Riesgos aceptados: la exportación es parcial respecto a docs/001 §3 hasta resolver D5; exportación y reporte son lecturas separadas y pueden diferir un instante con escrituras concurrentes.

### Fase 5 — Exportación como archivo (Decisión 5.3)

Contexto: resuelve D5 de la Decisión 5.2. El usuario autorizó `expo-sharing ~57.0.23` y `expo-file-system ~57.0.7` (dependencia directa de la app) y el plugin `expo-sharing` en `app.json`. No se ejecutó EAS Build: el código queda preparado para una nueva Development Build, necesaria porque `expo-sharing` es un módulo nativo.

- D1. `GET /export` acepta `format=csv|pdf` (defecto `csv`; cualquier otro valor, vacío, en mayúsculas o repetido, 400). El contrato CSV no cambia. El PDF es un PDF 1.4 generado a mano en el Worker, sin dependencias: Helvetica estándar con WinAnsiEncoding, xref con offsets exactos, cabecera repetida y «Página X de Y», A4, 56 filas por página. Texto fuera de WinAnsi se convierte en `?` (un emoji, un solo `?`), los controles en espacio, y se escapan `\`, `(` y `)`. Categoría (22) y nota (40) se truncan con «…» solo en el PDF. Incluye cuenta, período, filtros activos, totales de ingresos, gastos y balance (negativo con «-») y una página «Sin movimientos» si no hay filas. Mismos filtros, aislamiento, exclusión de anulados y tope de 2000 filas (400 `EXPORT_TOO_LARGE`). Cabeceras: `application/pdf`, `Content-Disposition: attachment; filename="movimientos_<desde>_<hasta>.pdf"`, `no-store`, `nosniff`.
- D2. Los totales del PDF se calculan sumando las filas ya leídas (misma lectura que la tabla), con aritmética entera y control de enteros seguros (500 controlado si no lo son). La lectura y validación se comparten con el CSV (`loadExportRows`).
- D3. Almacenamiento temporal en la app: la respuesta se pide como bytes (`arrayBuffer`, conserva el BOM del CSV), se escribe en `Paths.cache/exports/movimientos_<desde>_<hasta>.<ext>` (caché privada de la app, nombre solo con fechas validadas) y se entrega con `expo-sharing` (`text/csv` o `application/pdf`). El archivo no se borra justo después de compartir, porque la app receptora puede seguir leyéndolo. El directorio se limpia antes de cada exportación, al montar Reportes y al desmontar el navegador (cierre de sesión o cambio de usuario). Nunca se guarda de forma permanente ni se usa almacenamiento compartido. Se descarta el fallback `Share.share` de texto.
- D4. Dos botones, «Exportar CSV» y «Exportar PDF», con un único indicador para evitar doble toque. Android no informa si el usuario compartió: la app no muestra mensaje de éxito. Si el módulo nativo no está (APK anterior), se carga de forma diferida y se muestra «Esta versión de la app no admite compartir archivos; instala la versión actualizada.» sin afectar al resto de la app.
- Riesgos aceptados: CPU del Worker en el plan Free (10 ms) con 2000 filas no demostrada (local: ~5 ms de generación y ~460 KB para 2000 filas; si hay `exceededCpu`, bajar el tope solo del PDF); validación nativa (FileProvider, selector de Android, comportamiento con APK antiguo) pendiente de la nueva Development Build; PDF validado con un parser propio, sin visor real; archivos temporales quedan en la caché privada hasta la siguiente limpieza y el borrado no es seguro a nivel de sistema de archivos.

## Rediseño UX/UI — Decisión R0

Contexto: el usuario aprobó el diseño del rediseño (docs/007, docs/008, docs/009 y docs/010) y, en el paso 347, el diseño completo y los tamaños de docs/008 §11 como valores iniciales; las propuestas P-1, P-2 y P-3 de docs/007 §14.A se aprobaron en el paso 346 y se confirmaron en el 347. Esta decisión documenta, antes de implementar (docs/009, fase R0), lo que afecta a la arquitectura y a docs/001. No hay cambios en la API, en D1, en los contratos, en las sesiones ni en las reglas monetarias, y no se añaden dependencias. Fuentes: docs/007 §3, §10 y §14; docs/008 §6.12 y §11; docs/009 §9. Las decisiones de docs/007 §14 y docs/008 §15 que no figuran abajo siguen abiertas (ver «Pendientes»).

- D1. Arquitectura de navegación. Mis cuentas es la pantalla inicial autenticada y sustituye a Inicio. Tocar una cuenta abre su Detalle, con barra inferior de cinco pestañas (Cuenta, Movimientos, Calendario, Reportes y Más). Cuenta muestra el saldo y los movimientos de la semana. Categorías vive en Más (configuración), junto con renombrar, archivar y cerrar sesión. «Nuevo movimiento» es un botón flotante con texto, visible en Cuenta, Movimientos y Calendario. HomeScreen y HomeDashboard se retiran (docs/007 §14: 14.2 a, 14.3, 14.7). Atrás en una pestaña distinta de Cuenta vuelve a Cuenta; un segundo Atrás vuelve a Mis cuentas (docs/007 §3.4). Las referencias a «Inicio» de 5.1 D6 (y la mención del selector de cuenta y del formulario con monto primero en 3.1 D8) deben leerse según esta decisión: Inicio equivale a la pestaña Cuenta del Detalle; esas decisiones no se reescriben.
- D2. Ratificación de la navegación local. Se confirma 2B.1 D8, 3.1 D8 y 4.1 D5: la pila y la barra inferior se implementan con estado local, `BackHandler` y componentes propios, sin React Navigation ni TanStack Query. Donde 2B.1 D8 dice «se difieren a la Fase 3» se lee «diferidos hasta nueva decisión». La cuenta activa se guarda solo en memoria en el contenedor del Detalle, sin caché fuera de los componentes; cerrar sesión desmonta el navegador y no deja datos del usuario anterior. Se reconsiderará React Navigation cuando exista una nueva development build y haya evidencia en dispositivo de problemas de foco de TalkBack, restauración de estado o Atrás.
- D3. Barra de contexto de cuenta como fuente única. El contenedor del Detalle guarda la cuenta (`id`, `nombre`, `saldo`, `archivada`) en su estado y es la única fuente; la barra solo recibe props y ninguna pestaña ni pantalla de pila consulta el saldo por su cuenta. El valor inicial viene de `GET /accounts` (campo `saldo`, 3.1 D6). Tras crear, editar o anular un movimiento el contenedor incrementa `refreshKey` y relee el saldo con `GET /accounts/:id/balance` mediante un método nuevo del cliente de la app, sin cambiar el contrato. Mientras relee se conserva el último saldo y se indica la actualización. Si la lectura falla, la barra muestra «Saldo no disponible» con «Reintentar» y nunca un valor inventado: debe evitarse `formatCents` ante valores no enteros seguros, porque devuelve «$0.00». La barra es neutra e idéntica en todas las pantallas internas, y en Nuevo y editar movimiento adopta una forma compacta de solo lectura.
- D4. Cuenta renombrada o archivada estando dentro. Renombrar desde Más reemplaza el estado del contenedor con la respuesta de `PATCH /accounts/:id`, sin relectura. Archivar desde Más vuelve a Mis cuentas con un aviso y exige confirmación con el nombre de la cuenta. Si la cuenta se archivó en otro dispositivo, el 409 `ACCOUNT_ARCHIVED` al guardar un movimiento es la confirmación del servidor: se muestra un mensaje con «Volver a la cuenta» y el contenedor la marca como archivada. Una cuenta archivada no admite movimientos nuevos (3.1 D3); su presentación en el Detalle (modo consulta con «Nuevo movimiento» deshabilitado y explicado) es la propuesta de docs/007 14.12 y sigue pendiente de confirmar. El mecanismo exacto con que el contenedor se entera del 409 (docs/007 14.15) queda pendiente de `architect`, porque `/balance` no devuelve `archivada`. La app no ofrece eliminar cuentas (no existe `DELETE /accounts`): solo archivar (docs/007 14.8 a).
- D5. Orden del formulario de movimiento. Cambia a tipo, categoría, monto, fecha y nota. Sustituye «monto primero» de docs/001 §7 y la parte «formulario con monto primero» de 3.1 D8. Cambio de norma confirmado por el usuario en el paso 347 (docs/007 14.4) y registrado en docs/001 §7. Se mantienen la validación de la API, la inmutabilidad de tipo y categoría y `parseCentsFromInput`. Se añaden teclado numérico, protección contra doble envío y confirmación breve de guardado; el selector de fecha propio, sin módulo nativo, sigue pendiente (docs/007 14.5).
- D6. Paleta revisada sin degradado nativo. Se adopta la paleta de docs/008 §1, §2 y §11 (iteración 3), tal como está en el prototipo aprobado por el usuario en el paso 347 (color por módulo, paleta de cuentas y asignación por `hash(id)`): fondo casi blanco cálido; verde azulado de marca solo en la acción primaria, el botón flotante, el foco y la tarjeta de saldo; color distintivo por módulo (docs/007 §3.6) solo en la píldora de la pestaña activa, el mosaico del título y los acentos de controles; paleta de seis tonos de cuentas asignados por `hash(id) mod 6`. Ingreso = verde y gasto = coral conservan su significado y el color nunca es el único indicador. No se usa `expo-linear-gradient` ni otra dependencia: la profundidad se construye con color sólido y capas semitransparentes (resuelve docs/008 15.5, restricción de `architect`). Solo modo claro y fuentes del sistema.
- D7. Accesibilidad aprobada. Objetivo táctil mínimo de 48 dp. P-1: chips pequeños de filtro visibles de 36 dp con zona efectiva de 48 dp (`hitSlop` 6 dp, filas separadas 12 dp), solo en chips de filtro. P-2: opciones de segmentado de 48 dp de alto. P-3: excepción única para las celdas de día del calendario (alto 52 dp, ancho ≥ 44 dp, solo con ancho de pantalla < ≈ 400 dp, sin superponer zonas táctiles, cumple WCAG 2.5.8; con ≥ ≈ 400 dp llegan a 48 dp). Barra de pestañas: ícono sobre la etiqueta completa a 11,5 sp, `minWidth` 48 dp, alto ≥ 62 dp. Selector de categorías en dos columnas con nombre de hasta dos líneas o más, sin elipsis. Texto truncado solo para nombres libres del usuario, con el nombre completo en la etiqueta de accesibilidad; importes, saldo, botones, pestañas y categorías habituales nunca se truncan (docs/007 §10; docs/008 §6.12). Reglas Android de safe areas y teclado: ningún elemento queda bajo las barras del sistema (gestos o tres botones) y con el teclado abierto el campo activo y Guardar permanecen visibles; la opción A de docs/007 14.1 (respetar las barras del sistema, sin módulo nativo ni modo inmersivo) quedó aprobada en el paso 347; su implementación se valida en R1 y en un Android real.
- D7 bis (R1, `architect`). Insets del sistema sin dependencias nuevas: `useSystemInsets` obtiene el superior de `StatusBar.currentHeight` (respaldo 24 dp en Android) y el inferior de la diferencia `Dimensions` screen − window − superior, que con edge-to-edge obligatorio (SDK 57, Android 16) puede dar 0, por lo que se usa un respaldo fijo de 48 dp (mejor esfuerzo, no validado). `Screen` envuelve la raíz en `App.tsx` (sin scroll, sin relleno lateral ni inferior, sin `KeyboardAvoidingView`); R2 debe retirarlo al migrar cada pantalla para no duplicar relleno. La validación es de nivel D (teléfono, gestos y tres botones, teclado abierto). Si el respaldo no es aceptable, se pedirá autorización para `react-native-safe-area-context` (módulo nativo, nueva build). R1 difiere a R2–R4: variante `dangerSolid`, «✓» y forma de píldora del `Chip` (007 §6.7), variante `sm` de 36 dp con `hitSlop` (P-1), radio 16 de `Button tall` y la animación de subida del `Snackbar`.
- D8. Tokens de tamaño. El objeto `sizes` de docs/008 §11 se aprueba como valores iniciales: `touchMin` 48, `tabHeight` 62, `contextBar` 56, `contextBarCompact` 36, `fab` 56, `primaryTall` 52, `accountCardMin` 88, `accountCardMinWide` 92, `accountIcon` 52, `avatar` 40, `tabMinWidth` 48, `tabPillPadX` 10, `chipSmHeight` 36, `chipHitSlop` 6, `segmentOption` 48, `categoryOptionMin` 56, `calendarCellHeight` 52, `headerPig` 72, `headerPigWide` 96, `headerPigLargeFont` 48, `pigZoom` 1.4, `balanceCardMin` 132 y `balanceCardPig` 104. Son valores iniciales, no definitivos: se vuelcan a `app/src/theme/tokens.ts` en la fase R1 y las mediciones de texto se repiten en un Android real (docs/009 §9). Cualquier ajuste posterior se registra aquí.
- D9. Android real pendiente. Hoy solo hay evidencia de niveles A (Jest), T (contraste) y R (renders y prototipo) de docs/010. Siguen sin validar en un teléfono (nivel D): safe areas y barras del sistema, teclado, Atrás con gestos y con tres botones, fuente al 130 % y 200 %, TalkBack, emojis y fuentes reales, y las mediciones de texto. Los renders son aproximados y no sustituyen la captura real. Ninguna fase del rediseño se da por validada en dispositivo sin ese nivel.
- D10. Gobernanza. La política de cambios de interfaz móvil de CLAUDE.md es permanente: secuencia `architect` → `mobile-ux-designer` → `mobile-visual-designer` → `mobile-engineer` → `mobile-ux-qa` → `qa-engineer`, sin ejecución en paralelo. Todo cambio visible exige al menos la revisión de `mobile-ux-qa`, y un defecto alto o crítico detiene el cierre y la publicación. Los diseñadores no tocan reglas financieras, endpoints, D1, sesiones, dependencias nativas ni infraestructura.
- D11. Cuenta activa, selector rápido y resumen (aprobados en el paso 347; docs/007 14.9, 14.14 y 14.16). Tocar el nombre o el saldo de la barra de contexto abre una hoja con las cuentas activas (`listAccounts`, nombre y saldo) y «Ver todas mis cuentas». Al elegir otra cuenta el contenedor del Detalle reemplaza su estado con esa cuenta, conserva la pestaña actual y reinicia el estado por pestaña (filtros, período, mes), porque las categorías son por cuenta; no se conservan datos de la cuenta anterior fuera de la memoria del contenedor. Mis cuentas muestra «Total en tus cuentas» (suma de saldos reales de las cuentas activas devueltos por la API, sin cálculos propios más allá de la suma entera; se oculta si algún saldo no es un entero seguro, docs/007 criterio 28) solo cuando hay al menos dos cuentas activas. Guías contextuales de primera vez con tarjetas descartables guardadas localmente y «Ver ayudas otra vez» en Más. Atrás: ver D1 (el selector rápido y las hojas se cierran primero).
- Pendientes (no aprobados, no implementar sin decisión):
  - docs/007 14.5 (selector de fecha), 14.13 (conciliación) y 14.19 (ícono de cuenta). Quedan incluidos en el diseño aprobado 14.18 (color por cuenta) y, en docs/008, 15.11 y 15.12 (color por módulo y paleta de cuentas).
  - docs/008 15.1 a 15.4 y 15.6 a 15.10. Las filas 15.11 a 15.14 pertenecen a la iteración 3 aprobada.
  - docs/007 14.8 b (supresión de datos de la cuenta, requisito previo a Play Store): abierta.
  - docs/009 §7: R4 con o sin `react-native-svg`, nueva build para R6, y confirmar que «solicitar eliminación de cuenta» se resuelve con Archivar.
  - Confirmaciones al descartar datos sin guardar (docs/007 §3.4) frente a la regla «confirmaciones solo en acciones destructivas o de conciliación» de docs/001 §7: sin resolver.
- Riesgos aceptados:
  - Las pestañas propias, sin React Navigation, hacen más frágiles el foco de TalkBack, la restauración de estado y el Atrás (docs/009 §6); la migración queda abierta.
  - La reescritura de navegación y de decenas de pruebas puede causar regresiones; se mitiga con fases R1 a R6 pequeñas y `qa-engineer` independiente.
  - La causa raíz de los hallazgos H1 y H2 (edge-to-edge sin relleno) es una hipótesis hasta confirmarla en el teléfono.
  - Un saldo en la barra puede quedar desactualizado un instante entre la escritura y la relectura; se muestra el último valor conocido con indicador de actualización.
  - Los renders y el prototipo no se probaron en un Android real.
  - Los colores de categoría de la API y los del selector no coinciden (docs/008 15.4).
  - Los tokens `sizes` pueden ajustarse tras la medición real.

## Rediseño UX/UI — Decisión R2

Contexto: diseño técnico de `architect` para la fase R2 de docs/009 (nueva navegación centrada en cuentas) y decisiones del usuario del paso 349 sobre docs/007 §14. Sin cambios en la API, D1, contratos, sesiones ni reglas monetarias; sin dependencias nuevas.

- D1. Estado del Detalle en `MainNavigator`: la cuenta activa (`id`, `nombre`, `saldo`, `archivada`) es la fuente única, junto con el estado del saldo (`ok`, `refreshing`, `error`), `refreshKey`, la pestaña y el estado por pestaña (mes del calendario, vista de reportes, filtros). Las rutas no guardan copias de la cuenta. Una sola suscripción a `BackHandler` con la lógica de docs/007 §3.4 en una función pura; las hojas (selector de cuenta, perfil) usan `Modal` de React Native y se cierran primero con Atrás. Cerrar sesión desmonta el navegador.
- D2. `getAccountBalance` (endpoint existente `GET /accounts/:id/balance`) valida que `accountId` coincida, que los valores sean enteros seguros y que `saldoInicial + ingresos − gastos = saldo`. `TransactionFormScreen.onDone(changed)`: `refreshKey` solo sube si hubo cambio. Con error se muestra «Saldo no disponible» y «Reintentar», nunca una cifra inventada.
- D3. Cambio de cuenta sin fuga de datos: al elegir otra cuenta se reinician el estado por pestaña, el saldo y `refreshKey`, se conserva la pestaña y el área de pestañas se remonta por `key` de cuenta; los callbacks tardíos se ignoran si el id no coincide con la cuenta activa.
- D4. (resuelve docs/007 14.15) La cuenta se marca como archivada cuando el formulario o Categorías reciben un 409 `ACCOUNT_ARCHIVED`, mediante un callback protegido por id, sin lecturas adicionales. La API permite editar y anular movimientos de una cuenta archivada; solo se deshabilita crear.
- D5. Decisiones del usuario (paso 349): 14.17 (a) y 14.10, avatar en Mis cuentas que abre una hoja de perfil con nombre, correo y «Cerrar sesión», además de «Cerrar sesión» en Más; 14.12, cuenta archivada en modo consulta («Archivada» en la barra, aviso y «Nuevo movimiento» deshabilitado con explicación); 14.6 (a), Movimientos filtrados desde Reportes como pantalla de pila y Atrás vuelve a Reportes; y se monta solo la pestaña activa (su estado se conserva en `MainNavigator` y los datos se recargan al volver), lo que sustituye «cada pestaña monta una vez» de docs/007 §3.3.
- D6. Se retira el `Screen` global de `App.tsx` (D7 bis de R0): un `Screen` por ruta, puesto por el navegador o por la pantalla de la ruta y nunca dentro de las pantallas reutilizadas; `Screen` sin scroll añade el margen inferior salvo con `bottomBar`. Un único `Snackbar` en el navegador con `bottomOffset` sobre la barra de pestañas.
- D7. Confirmación al descartar formularios: sin cambios en R2 (Atrás y Cancelar salen sin preguntar; Atrás se ignora mientras se guarda). Decidida después: se implementa en R3 (Rediseño R3 D1).
- D8. Precisiones de coordinación para R2 (criterios de `mobile-ux-designer`): crear una cuenta entra a su Detalle con el aviso «Cuenta creada. Ya puedes anotar movimientos.»; cerrar sesión desde la hoja de perfil y desde Más no pide confirmación (docs/007 §7.3: no hay envío en curso); con la sesión no disponible la franja conserva un botón «Cerrar sesión» visible, además del avatar; el mes de la pestaña Cuenta y el del Calendario son independientes; el selector no marca ninguna cuenta si la activa está archivada; R2 incluye los estados vacíos de sus pantallas nuevas («Tu cuenta está lista…» solo al llegar desde Crear cuenta) y R5 el resto; R2 hace cambios mínimos de props, sin cambio visual, en el formulario de movimiento (`onDone(changed)`, 409), Categorías (409) y Calendario (crear deshabilitado si archivada), y el navegador pone la barra compacta sobre el formulario; por indicación del usuario, R2 completa `Button dangerSolid`, el radio 16 de `Button tall`, el `Chip` en píldora con «✓» y la variante `Chip sm` de 36 dp con zona de 48 dp.
- D9. Desviaciones de ubicación respecto a docs/009 §3 (R2): `AccountContextBar` quedó en `app/src/screens/account-ui.tsx`, junto con `AccountCard`, `BottomTabs`, `Fab` y `ArchivedNotice`, y no en un archivo propio; `AccountDetailScreen` no existe como archivo, su lógica quedó absorbida en `MainNavigator.tsx`. Las pruebas de la barra fijan la ventana (`mockWindow` en `app/src/test-utils.ts`) porque el mock de `jest-expo` mide 750 dp con `fontScale` 2 y activaría siempre el modo de dos filas; ese modo tiene su propia prueba.
- Riesgos aceptados: recarga de datos al cambiar de pestaña; títulos de las pantallas reutilizadas con el nombre de la cuenta duplicado respecto a la barra hasta R3–R4; `Modal` con edge-to-edge y el respaldo de 48 dp del margen inferior solo se validan en un Android real.

## Rediseño UX/UI — Decisión R3

Registrada en el paso 350, antes de implementar R3.

- D1. Descartar formularios (resuelve R2 D7 y el punto abierto de R0 sobre docs/001 §7). Se confirma al abandonar un formulario únicamente si tiene cambios sin guardar. Aplica a: botón Atrás, navegación interna, cambio de cuenta y cierre del formulario. Sin cambios, se sale normalmente y no se muestra ningún diálogo. Mientras se guarda no se permite navegar ni repetir acciones (anti doble envío). Texto de docs/007 §7.3: «¿Descartar este movimiento?» / [Seguir editando] [Descartar]. docs/001 §7 queda actualizado con esta excepción.
- D2. Alcancía de Mis cuentas. La decoración con alcancía (y las manchas decorativas) se difiere a R6. Sigue siendo obligatoria antes del cierre del rediseño completo; no sale del alcance (defecto UXQA-R2-01, media).
- D3. `tsconfig.json` sin rastrear en la raíz del repositorio: queda excluido. No se modifica, elimina, mueve ni se incluye en ningún commit.
- D4. Mecanismo del descarte (`architect`, R3). El guard vive en cada pantalla de formulario (Nuevo/Editar movimiento y Crear cuenta) mediante un hook `useDiscardGuard({ dirty, busy, onLeave })`, no en `MainNavigator`. Precisa R2 D1: una suscripción de Atrás en el navegador más listeners locales de pantalla con prioridad (LIFO). «Cambio» es diferir de una instantánea inicial calculada al montar; la fecha y la categoría prefijadas no cuentan; el monto se compara en centavos. Se usa `Alert` nativo [Seguir editando] [Descartar], con el cierre fuera del diálogo equivalente a Seguir editando. Con un formulario abierto no se alcanzan el cambio de pestaña ni de cuenta (R2: la ruta del formulario solo muestra la barra compacta); si un rediseño futuro lo permitiera, se confirmará y, al aceptar, se descartará. Cerrar sesión o una sesión expirada desmontan el formulario y descartan sin confirmar (aceptado). Salir tras guardar, anular o un 409 de cuenta archivada no pide confirmación.
- D5. Selector de fecha (aprobado por el usuario en el paso 350; cierra docs/007 14.5): selector propio, con la cuadrícula de `lib/calendar.ts` en una hoja, sin dependencias nativas ni nueva build. Conserva Hoy/Ayer y añade «Otra fecha…».
- D6. Saldo inicial negativo (aprobado por el usuario en el paso 350): el campo solo admite dígitos y un separador (máximo 2 decimales); un interruptor «Es un saldo en contra (debo dinero)» aplica el signo, porque el teclado decimal de Android no tiene «-». No cambia la regla de 2A D7 (la API acepta saldo negativo).
- D7. Textos del descarte (propuestos por `mobile-ux-designer`, docs/007 §5.5.1 B): nuevo movimiento «¿Descartar este movimiento?»; editar «¿Descartar los cambios?» / «Los cambios que hiciste no se guardarán.»; crear cuenta «¿Descartar esta cuenta?»; todos con «Lo que escribiste se perderá.» salvo el de edición.
- D8. Montos ambiguos (R3-07, aprobado por el usuario en el paso 351). La app no interpreta en silencio separadores ambiguos ni notación exponencial. Se rechazan, con un mensaje claro y sin permitir guardar: un solo separador seguido de tres o más dígitos («1.000», «1,234»), varios separadores de miles («1,234.56», «1.234,56») y notación exponencial («1e5»). Se aceptan solo enteros y decimales con coma o punto y hasta dos decimales («1000», «1234», «12.50», «12,50»). Aplica al monto del movimiento y al saldo inicial. `parseCentsFromInput` y los contratos de la API no cambian: la validación ocurre antes, en la interfaz. Sustituye el tratamiento de miles de `sanitizeAmountInput` descrito en el paso 350.

## Rediseño UX/UI — Decisión R4

- D1. Gráficos de Reportes (cierra docs/008 15.3 y docs/009 §7): barras implementadas con componentes de React Native existentes. No se agrega `react-native-svg` ni ninguna dependencia nativa, y R4 no exige nueva build. Los cálculos de Reportes siguen siendo los de la API; la interfaz solo dibuja proporciones y no sustituye sumas financieras por operaciones aproximadas.
- D2. Pendientes que se mantienen: la alcancía decorativa de Mis cuentas es obligatoria en R6; las pruebas en un Android real siguen pendientes; `tsconfig.json` de la raíz permanece excluido.
- D3. Valores por defecto de R4 (recomendaciones de `mobile-ux-designer`, docs/007 §5.11 L; el usuario puede cambiarlas al revisar R4): (1) el panel de filtros del Historial es una sección plegable en línea, no una hoja; (2) R4 incluye `DatePickerSheet` con tono neutro y una función de día de la semana en `lib/calendar.ts`, sin cambiar cálculos; (3) por debajo de ≈350 dp la celda del Calendario puede bajar de 44 dp y queda fuera de P-3; (4) el botón del día en Calendario pasa a secundario «+ Anotar en este día», para no duplicar la acción primaria del FAB; (5) las barras de categoría son relativas a la mayor y el porcentaje en texto es sobre el total; (6) «Egreso» se muestra como «Gasto» (el dato interno no cambia); (7) se conserva «Mostrar archivadas» en Categorías; (8) los mensajes de `resources-messages.ts` que difieren de docs/007 §7.3–7.4 se conservan; (9) UXQA-R3-03 (Categorías desde el formulario descarta el formulario) se mantiene como comportamiento aceptado, con una frase de ayuda.
- D4. Fuera de alcance de R4: la serie de Reportes por día (la API solo agrupa por mes o año; exigiría un cambio de contrato) y el estado «anulado» (la API no devuelve movimientos anulados en las listas).
- D5. Valores visuales por defecto de R4 (`mobile-visual-designer`, docs/008 §6.14; revisables por el usuario): los `SummaryTile` del Calendario van en 2+1 (Ingresos y Gastos arriba, Neto a ancho completo) porque tres en una fila no caben a 360 dp sin truncar importes; el `DatePickerSheet` neutro usa `colors.text` como relleno del día elegido (`brand700` queda para acción primaria, FAB y foco); `maxFontSizeMultiplier` 1.6 solo en `ScreenTitle`; `Chip` gana la variante `tone="movimientos"` y `ErrorBox` usa fondo `expenseSoft`; la cifra de Balance en Reportes va en `text`, también si es negativa; las celdas del Calendario con movimientos no cambian de color (el color de módulo orienta, no representa datos). Límite conocido: la barra de categoría contra su pista queda entre 2,44:1 y 4,06:1, aceptado porque el importe y el porcentaje están en texto.
- D6. Ajustes aprobados en el paso 352 antes del commit de R4. (1) Margen lateral responsive: 16 dp con ancho menor de 400 dp y 20 dp desde 400 dp, en todas las pantallas y en la fórmula de ancho de celda del Calendario (`calendarCellWidth`); alinea el código con docs/007 §5.2.5 y docs/008 §5. (2) Chips pequeños: apariencia compacta con zona táctil efectiva de al menos 48 × 48 dp, también en ancho (no solo en alto), sin solapar zonas de toque. (3) Selector de colores de Categorías: altura adaptable (sin 72 dp rígidos), verificado con fuente ampliada. (4) Jest: se mantiene `relaxTimeoutsForColdCache` mientras las pruebas sean estables; no se modifica `package.json` ni la configuración de Jest en este paso. (5) La alcancía de Mis cuentas sigue diferida a R6 y es obligatoria antes del cierre del rediseño. (6) Las pruebas en Android real siguen pendientes y no pueden marcarse como realizadas.

## Rediseño UX/UI — Decisión R5

Valores por defecto adoptados en el paso 352 (recomendaciones de `mobile-ux-designer`, docs/007 §5.12 H; revisables por el usuario):

- D1. Persistencia de ayudas: `expo-secure-store` (ya instalado), una entrada por usuario con la clave `guias_v1_<user.id>` y contenido `{ v: 1, vistas: [ids] }`. Sin datos financieros. No se agrega `AsyncStorage` ni ningún módulo nativo. Un dato corrupto o un fallo de lectura muestra la guía y no rompe la pantalla.
- D2. Alcance: las guías son por usuario, no por cuenta; cambiar de cuenta no las altera, y cambiar de usuario carga su propia clave.
- D3. Aparición: solo con datos cargados y «sin datos»; una guía a la vez; nunca bloquean; completar la acción también la descarta.
- D4. Cerrar sesión no borra las ayudas descartadas (`clearAll` queda intacto). «Ver ayudas otra vez» en Más las restablece sin diálogo de confirmación y con aviso «Listo. Verás las ayudas otra vez.».
- D5. Se conserva la pista «Toca para ver tus movimientos» de la tarjeta de cuenta; la guía `cuentas-lista` no se muestra con una sola cuenta. El vacío de semana conserva «Toca + para registrar el primero.». Con solo cuentas archivadas el botón es «Crear mi primera cuenta». Historial no tiene guía.
- D6. Ilustraciones de los estados vacíos (paso 352): se empaquetan como PNG en `app/assets/illustrations/` y se cargan con `require` (Metro las incluye; no toca `app.json`, no hay módulo nativo ni nueva build; `react-native-svg` sigue fuera). Entran en R5 las ilustraciones aprobadas de docs/008 §9: hoja (movimientos), embudo (filtros) y barras (reportes). La etiqueta para Categorías es una propuesta nueva sin aprobar: Categorías conserva el círculo con emoji 🏷️ hasta que el usuario la apruebe. La alcancía queda diferida a R6 por decisión previa (R4 D6.5): Mis cuentas conserva el círculo con emoji. Calendario compacto no lleva ilustración. Las ilustraciones son decorativas (`importantForAccessibility="no"`) y se ocultan con `fontScale ≥ 1.75`.
- D7. Decisiones del paso 353: (1) Categorías conserva el emoji 🏷️ hasta R6; no se inventa una ilustración nueva. (2) `expo-splash-screen` no se instala sin revisar antes las dependencias y la configuración existentes. (3) La alcancía de Mis cuentas es obligatoria en R6. (4) docs/008 §9.4 se unifica con el estilo real aprobado de las filas de Más (título 15/700, mosaico de radio 10): resuelve la contradicción interna señalada por `mobile-ux-qa`. (5) `tsconfig.json` de la raíz permanece sin seguimiento y sin modificaciones. (6) Las pruebas en Android real siguen pendientes; ninguna se da por realizada. (7) UXQA-R5-01 (foco de TalkBack al descartar una guía) se decide tras la prueba en el teléfono.

## Rediseño UX/UI — Decisión R5.1

Etapa entre R5 y R6 (paso 356), a partir de la prueba en un Android real con Development Build y Expo Tunnel: Google Login, varias cuentas de Google, datos separados por usuario, navegación y funciones principales correctas; el usuario está satisfecho con el diseño general. Regla principal: preservar lo que funciona (sin rediseño general, sin tocar autenticación, cálculos ni navegación aprobada). R5.1 no se marca completada antes de pasar `mobile-ux-qa` y `qa-engineer`.

- D1. Alcance exacto de R5.1: (1) Login más atractivo; (2) botón «Continuar con Google» con el logotipo oficial; (3) «Cerrar sesión» visible en el encabezado de Mis cuentas; (4) color e ícono al crear y editar una cuenta; (5) ícono al crear y editar una categoría; (6) «+ Crear categoría» dentro de Nuevo movimiento sin abandonar el formulario; (7) ocultar la barra de navegación inferior del sistema Android, si es viable; (8) corregir la superposición del contenido superior con la barra de estado Android.
- D2. Hechos verificados por `architect` (lectura de código, sin ejecutar): `categories` ya tiene `icono` (slug `^[a-z0-9_-]{1,40}$`, defecto `tag`) y `color` (`#RRGGBB`) y sus rutas POST/PATCH los aceptan, por lo que el punto 5 y el punto 6 se resuelven solo en la app. La tabla `accounts` NO tiene color ni ícono (migración 0002): hoy el color sale de `accountColors(id)` y el ícono de `accountIcon(nombre)`, ambos cosméticos y locales.
- D3. Punto 4, **bloqueado por backend**. Exige: migración D1 0004 aditiva con `icono` y `color` NULL en `accounts` (NULL = «sin elegir»; las cuentas antiguas conservan el aspecto derivado), nuevos campos en `AccountDto` y en los esquemas Zod de POST y PATCH (la API usa `strictObject`: una app nueva contra una API vieja recibe 400, por lo que el orden es migración → Worker → app), pruebas de API y despliegue. Requiere autorización expresa para modificar `api/`, aplicar la migración y desplegar, y revierte lo decidido en docs/007 §14.18 (color por hash, sin campo en D1). No se simula con almacenamiento local. Mientras no haya autorización no se implementa su persistencia ni su interfaz de edición.
- D4. Punto 7, **no se implementa**. Ninguna API de React Native oculta la barra de navegación del sistema; exigiría `expo-navigation-bar` (módulo nativo, nueva Development Build) y contradice la norma aprobada de docs/001 §7 («opción A, sin módulo nativo ni modo inmersivo», docs/003 R0 D7, docs/009 §5). Riesgos del modo inmersivo: con gestos el Atrás exige deslizar dos veces (la app depende de `BackHandler`), el teclado puede reaparecer la barra, perjudica a TalkBack y `useSystemInsets` perdería su respaldo de 48 dp. Se presenta como propuesta al usuario: la alternativa recomendada es corregir bien los insets para que la barra no tape contenido.
- D5. Punto 8: la causa más probable (hipótesis sin confirmar en dispositivo) es que `StatusBar.currentHeight`, evaluado una sola vez al importar el módulo, valga 0 y se aplique el respaldo de 24 dp, menor que la altura real en teléfonos con recorte. Corrección exacta: `react-native-safe-area-context` (módulo nativo, nueva build; ya anticipada en R0 D7 bis), pendiente de autorización. Mientras tanto se implementa una mitigación provisional sin dependencias, marcada como tal y pendiente de verificar en el teléfono.
- D6. Punto 3: el avatar de Mis cuentas ya abre una hoja con «Cerrar sesión» (R2 D5 y D8, sin confirmación). R5.1 añade una acción visible en el encabezado y unifica los accesos (encabezado, hoja de perfil, Más y la franja de sesión) en un componente compartido que llama a la misma función `signOut`, sin confirmación y sin borrar datos ni preferencias.
- D7. Punto 2: el logotipo «G» multicolor es un recurso de marca de Google, descargado por autorización expresa del usuario (paso 356) desde `developers.google.com/static/identity/images/g-logo.png` (PNG RGBA 200 × 204). No se dibuja ni se modifica. No cambia el mecanismo de Google Sign-In, los tokens ni los JWT.
- D8. Punto 6: la categoría se crea en una hoja (`Sheet`) montada dentro de `TransactionFormScreen`, de modo que el formulario conserva su estado; la hoja usa `createCategory` existente, bloquea el tipo al del movimiento, tiene su propio guard de descarte y, al guardar, queda seleccionada. Sustituye el botón «Ir a Categorías» (R3, UXQA-R3-03), que abandonaba el formulario.
- D9. Catálogo cerrado de íconos de categoría (slugs ↔ emoji de Unicode 11 o anterior, compatibles con las categorías existentes y `tag` como respaldo); un slug desconocido se dibuja como 🏷️. Las apps ya instaladas degradan a 🏷️.
- D10. Mecanismo de pruebas en el teléfono: Development Build + `npx expo start --dev-client --tunnel` (comprobado por el usuario). ADB y USB no son requisito. Se corrige docs/010 §15.
- D11. Valores por defecto de R5.1 (recomendaciones de `mobile-ux-designer`, docs/007 §5.13 I; el usuario puede cambiarlos al revisar): (1) mensaje del Login, variante A: «Anota lo que entra y lo que sale, y mira cómo está tu dinero.»; (2) el botón de Google usa los colores de la guía de marca de Google (`#FFFFFF`, `#747775`, `#1F1F1F`) como única excepción a los tokens, con 52 dp de alto, y 👛 como marca del Login mientras no haya ilustración; (3) catálogo de 30 íconos de categoría según §5.13 D; (4) la hoja de Nuevo movimiento no incluye la descripción de la categoría; (5) el control de cerrar sesión del encabezado es un ícono 🚪 de 40 dp con zona de 48 dp, sin texto, a la izquierda del avatar; (6) se retiran `onOpenCategories`, `replaceTopWithCategories`, `FROM_FORM_HELP` y la variante `fromForm` de la ruta de Categorías, porque quedan sin uso (ajuste mínimo de `navigation.ts`, sin cambiar la navegación aprobada); (7) mitigación provisional de la barra de estado: respaldo superior de `useSystemInsets` de 24 a 32 dp, marcada como hipótesis hasta medirla en el teléfono; (8) textos nuevos específicos de `LIMIT_REACHED` y del fallo incierto de categorías según §5.13 E.
- D12. La alcancía en el Login (docs/008 §6.15; el paso 356 permite «incorporar la alcancía o recurso gráfico aprobado si se adapta a la pantalla»): el Login usa `vacio-alcancia.png` (copiado a `app/assets/illustrations/`). Esto no adelanta lo diferido a R6: la alcancía decorativa de Mis cuentas sigue siendo obligatoria en R6 y Mis cuentas conserva el círculo con emoji. El logotipo de Google se carga desde cuatro PNG cuadrados por densidad (`app/assets/brand/google-g*.png`, generados a partir del original oficial, que se conserva en `docs/design/assets/brand/google-g.png`). El Login sustituye todos sus colores crudos por tokens, salvo los del botón de Google (`brandGoogle`).
- D12. Personalización de cuenta (color e ícono). Se añaden a `accounts` las columnas nullable `color` e `icono` (migración aditiva `0004_account_appearance.sql`; sin tocar datos ni otras tablas). Guardan identificadores, no valores: `color` es una clave de la paleta aprobada (`aguamarina`, `lavanda`, `albaricoque`, `celeste`, `rosa`, `limon`) e `icono` una clave del catálogo cerrado de cuenta (`wallet`, `card`, `bank`, `piggy-bank`, `cash`, `trending-up`, `briefcase`, `home`, `plane`, `gift`, `shopping-bag`, `money-bag`). La API es la autoridad y valida con enum en Zod; D1 solo restringe la forma (caracteres y largo) para poder ampliar el catálogo sin reconstruir `accounts`, que tiene claves foráneas entrantes. Las cuentas existentes quedan en NULL y conservan su apariencia actual (color por hash del id e ícono por nombre). Respuesta: `color` e `icono` siempre presentes (null si no hay). POST: ausente o null guarda NULL. PATCH: ausente = sin cambio, null = volver al predeterminado, valor = fijar; admite cuatro campos y exige al menos uno. Un identificador desconocido se dibuja como el predeterminado. Compatibilidad: un cliente antiguo ignora los campos nuevos; la app nueva detecta el soporte por la presencia de las claves en `GET /accounts` y, si no están (API antigua con `strictObject`) o la lista está vacía, oculta el selector y no envía los campos; ante un 400 de validación con apariencia no reintenta a medias. Orden de despliegue: migración remota autorizada por el usuario, luego Worker, luego app. Color e ícono no intervienen en saldo, reportes, exportación ni conciliación; el aislamiento por usuario no cambia. Persisten en D1, no solo en el teléfono. Descartado: hex libre (rompe la paleta y el contraste de docs/008), almacenamiento local (no persiste entre dispositivos) y bandera `EXPO_PUBLIC_*` (no refleja el estado real de la API). Valores por defecto adoptados (revisables por el usuario): sin aviso de descarte al editar; la primera cuenta se personaliza solo al editarla; glifo de 24 sp en la rejilla reutilizando `IconPicker`; «✓» en color de texto y anillo de reposo `borderStrong` (docs/008 §6.16).
- D12 (validación UX). `mobile-ux-qa` aprobó sin defectos críticos ni altos. Se aceptan como diseño: el bloque de apariencia de Crear va dentro de una tarjeta de 16 dp (5 columnas a 360 dp, 4 a 320 dp); tras un 400 por apariencia el bloque se oculta (la API no admite los campos) en lugar de quedar visible; el foco de 2 dp no existe en la rejilla de íconos compartida con Categorías. Pendientes menores (bajos): 5xx en Editar usa el mensaje genérico, chip «Predeterminado» de ícono fuera del `radiogroup`, foco que sustituye el borde de selección del chip, subtítulo «Nombre de la cuenta» de la fila de Editar. Validación en dispositivo (CTA-14 a CTA-16) pendiente.

- D13. Ampliación de íconos (2026-10-17, local; sin migración ni despliegue). Los catálogos pasan de 12 (cuentas) y 30 (categorías) a 246 y 249 entradas en 17 grupos (docs/008 §6.17). Las claves son slugs ASCII `^[a-z0-9-]{1,20}$`; las 42 claves previas conservan clave y emoji. Emojis Unicode 10 o anterior, sin ZWJ. El catálogo de la app es único (`app/src/lib/icon-catalog.ts`) y compartido; `tag`, `ellipsis` y `plus-circle` son solo de categorías. La API valida al escribir: enum de cuentas ampliado a 246 claves (`api/src/lib/account-appearance.ts`) y regex de categorías sin cambios; no valida al leer. No hay migración (el CHECK de la 0004 ya lo admite). **El Worker DEV debe redesplegarse antes de usar la app nueva con íconos nuevos de cuenta** (si no, la API responde 400 y la app oculta el bloque de apariencia, D12); requiere autorización expresa. El selector es la hoja «Elegir ícono» (docs/007 §5.15). Palabras clave en español pendientes de revisión del usuario. Paso 363: revisión de búsqueda y palabras clave por `mobile-ux-designer` (19 entradas ajustadas, p. ej. «pañales», «anden», sinónimos de recibo, renta, nómina; sin cambiar claves, emojis ni conteos) y `construction` renombrado «Peaje» → «Obras viales» (`mobile-visual-designer`). Hallazgos de agrupación no aplicados por alterar los conteos documentados: 💎 Joyas (Dinero y ahorro vs. Compras), 🚉 Estación (Viajes vs. Transporte), 📒/📓 y 📬/📮 de apariencia similar. La búsqueda es por subcadena (ruido en 2 o 3 letras, p. ej. «can», «mas»); no se cambia. `mobile-ux-qa` APROBADO CON OBSERVACIONES y `qa-engineer` verificó la sincronización app/API (246 claves idénticas).
- D14. Navegación inmersiva Android (estudio, sin implementar): viable con `expo-navigation-bar` (`NavigationBar`/`setHidden`; `setVisibilityAsync` figura como obsoleta y `setBehaviorAsync` no aparece en la documentación vigente), pero no recomendada. Exige dependencia nativa, cambio de `app.json` y nueva Development Build, y contradice docs/001 línea 230 («sin módulo nativo ni modo inmersivo»), que habría que cambiar primero. Con gestos el beneficio de espacio es mínimo; con tres botones la barra se recupera deslizando desde el borde, con riesgo para Atrás (`BackHandler`), TalkBack y teclado. `useSystemInsets` calcula `bottom` por diferencia pantalla−ventana con respaldo de 48 dp: con barra oculta dejaría de ser fiable, por lo que cualquier prueba exige antes `react-native-safe-area-context`. Se mantiene la opción A hasta decisión del usuario. Propuesta de prueba acotada si se aprueba: rama aparte, solo barra de navegación, comportamiento transitorio, barra visible con teclado y hojas, desactivable, y validación en gestos y tres botones.
- D15. Flechas de la barra de grupos (paso 366, local, sin commit). El usuario probó en Android el catálogo ampliado y confirmó búsqueda y selección de íconos, persistencia de íconos de cuentas, íconos de categorías, creación de categoría desde Nuevo movimiento con conservación de datos, y el funcionamiento con teclado. Observó que solo se ven ~3 grupos y no es evidente que la barra se desplaza. Se añaden dos flechas de 48 dp a los extremos de la fila (docs/007 §5.15.1, docs/008 §6.17.5), sin dependencias nuevas, etiquetas «Ver grupos anteriores» y «Ver más grupos». Efecto: la ventana de chips mide 216 dp a 360 dp. Se corrige además el recentrado del grupo activo tras borrar la búsqueda. Validación en Android pendiente (ICO-16 a ICO-24).
- D16. Propuesta nativa para ocultar la barra de navegación del sistema (paso 366, NO implementada ni aprobada; el usuario lo solicita expresamente). Según el architect: viable con `expo-navigation-bar ~57.0.3` y `react-native-safe-area-context ~5.7.0` (versiones de la rama sdk-57; se confirman al instalar con `npx expo install`), plugin `expo-navigation-bar` en `app.json`, una única Development Build nueva y nuevo APK. API vigente: `NavigationBar.setHidden` (en SDK 57 también se aplica a las ventanas de `<Modal>`); `setVisibilityAsync` está obsoleta y `setBehaviorAsync` no figura, por lo que no se usan (las menciones previas en docs/007 y docs/009 quedan desfasadas). `setHidden(true)` fija el comportamiento transitorio por deslizamiento. El módulo no reaplica al reanudar: ocultar al montar y en cada `AppState` activo, salvo con TalkBack. No se añade `edgeToEdgeEnabled` (sin efecto en Android 16+). `useSystemInsets` pasaría a `useSafeAreaInsets()` con `SafeAreaProvider`, manteniendo el contrato `{top, bottom}` y los cuatro contenedores (Screen, barra de pestañas, Sheet, Snackbar). Sin ajuste de usuario en la primera iteración (recomendación). Primero habría que cambiar docs/001 (línea ~230, «sin módulo nativo ni modo inmersivo»), y es una decisión del usuario junto con la autorización de las dependencias nativas. Limitaciones inevitables: depende de la versión de Android, del modo (gestos o tres botones), del teclado y del launcher; con gestos el beneficio de espacio es mínimo; el primer deslizamiento desde el borde puede solo revelar la barra; no se prueba en emulador (el aviso de Expo lo desaconseja en Android 15). Cierre solo con INM-01 a INM-10 en dispositivo.
- D17. Aprobación de D16: ocultar la barra de navegación del sistema Android (2026-10-17, paso 367; docs/001 actualizado primero). El usuario autoriza: (1) instalar `expo-navigation-bar ~57.0.3` y `react-native-safe-area-context ~5.7.0` (verificadas contra `bundledNativeModules` de Expo 57.0.27); (2) el plugin `expo-navigation-bar` en `app.json` sin `hidden` ni otras opciones; (3) una Development Build nueva (perfil `development`); (4) `SafeAreaProvider` en la raíz y `useSystemInsets` sobre los insets reales, con contrato `{top, bottom}`, respaldo 32/48 dp solo para ausencia de provider o valores no finitos o negativos, y `computeInsets` retirado; (5) un módulo de modo inmersivo (`lib/immersive.ts` y `hooks/use-immersive-navigation.ts`) que oculta la barra al montar y en cada `AppState` activo, solo en Android, la muestra con TalkBack o con el teclado abierto, degrada en silencio ante errores y sin ajuste de usuario en esta iteración. `Sheet` añade `navigationBarTranslucent`. Se mantienen los cuatro contenedores de insets (Screen, barra de pestañas, Sheet, Snackbar). No se aprueba: ocultar la barra de estado, ajuste de usuario, ramas por modelo de teléfono ni reglas de teclado nuevas. Riesgos aceptados: con la barra oculta `bottom` puede valer 0; un fotograma de desajuste del offset del Snackbar al ocultar o revelar; posible hueco bajo «Guardar» con el teclado abierto; el primer deslizamiento solo revela la barra y Atrás por gestos puede exigir un gesto previo. Cierre solo con la matriz del rediseño más INM-01 a INM-10 en dispositivo (gestos y tres botones). Un defecto alto o crítico de `mobile-ux-qa` detiene la integración. Los APK anteriores no cargan este código: hay que instalar la build nueva antes de usar Expo Tunnel. Estado: implementación y build en el paso 367; **sin validación en Android real**.
- D18. Cierre funcional de R5.1 (2026-10-19, paso 372). El usuario instaló y probó la Development Build `7c58a37f-e2d5-4e27-85f7-2c3fedb575a9` en Android real y confirmó: arranque correcto, errores `ExpoNavigationBar` y `RNCSafeAreaProvider` superados, barra inferior del sistema oculta, flechas del selector de grupos de íconos funcionando, y las funcionalidades de R5.1 solicitadas. El adaptador `lib/immersive.ts` carga `expo-navigation-bar` de forma diferida solo si `requireOptionalNativeModule('ExpoNavigationBar')` existe; sin el módulo desactiva el modo inmersivo sin bloquear el arranque. La huella nativa local coincide con la registrada de la build (los cambios posteriores son solo JS). Es una validación funcional del usuario sin evidencia instrumentada; **no** equivale a la cobertura QA completa: INM-01 a INM-24 e ICO-16 a ICO-24 siguen «pendiente en dispositivo» (TalkBack, fuente ampliada, teclado y modales en configuraciones especiales y otros dispositivos no se han probado). Riesgos sin demostrar anotados por `mobile-ux-qa`: estado de la barra con teclado flotante o dividido y con `Modal`, y posible parpadeo al pasar a segundo plano. Sin cambios de API ni D1.
- Validación Android comunicada por el usuario (Expo Tunnel, sin evidencia instrumentada): funcionan Google Login y nuevo diseño, cierre de sesión desde Mis cuentas, colores e íconos de cuentas y de categorías, crear categoría en Nuevo movimiento y separación de datos entre usuarios. Los cambios de D13 no se han probado en Android real.

## Decisión R6 — Identidad visual nativa (paso 373 propuesta; paso 374 IMPLEMENTADA, 2026-10-19)

Contexto: R5.1 cerrada funcionalmente (D18). R6 cubre ícono, ícono adaptable, monocromático, splash, nombre visible y la alcancía de Mis cuentas (obligatoria desde R2 D2 y R4 D7(3)). Detalle visual en docs/008 §13.2; vista previa en `docs/design/prototipo/r6-vista-previa.html`.

- D1. Alcance: ícono (`expo.icon`), `android.adaptiveIcon` (`foregroundImage`, `backgroundColor` `#0F5F5A`, `monochromeImage`), splash con `expo-splash-screen` y la alcancía de Mis cuentas. Sin cambios de flujos, pantallas funcionales, API, D1 ni sesiones.
- D2. Dependencia nativa nueva: `expo-splash-screen` (`npx expo install`, ~57.0.9) como plugin en `app.json`. Es la única; **requiere autorización expresa del usuario** (R4 D7(2)). `architect`: sin decisión arquitectónica adicional (es de apariencia y dependencia). Releer la documentación oficial de SDK 57 antes de implementar (la consulta del `architect` fue a las páginas «latest»).
- D3. Una Development Build nueva (perfil `development`) cambia la huella nativa por ícono, splash, nombre y el módulo. El splash y el ícono temático se validan en una build `preview` en Android 12+ real. Las ilustraciones PNG no requieren build.
- D4. Recursos (docs/008 §13.2): `icon.png` reutilizable; primer plano, monocromático y splash se **regeneran** (zona segura y máscara circular); fondo adaptable solo por color; `adaptive-icon-background.png` y `favicon.png` no se copian; arte a 1024 nativos antes de Google Play.
- D5. Alcancía de Mis cuentas: sin escala ×1.4 (corrige docs/008 §6.1 y `pigZoom`); reglas de tamaño y ocultación en docs/008 §13.2; decorativa; **una sola por pantalla** (con cuentas en el encabezado; sin cuentas la del vacío). Cambios mínimos previstos: retirar `pigZoom` de `theme/tokens.ts` y `tokens.test.ts`; `EMPTY_ART.alcancia` y tamaño por ilustración en `ui.tsx`; `art="alcancia"` en los dos vacíos y alcancía responsive del encabezado en `AccountsScreen.tsx`; ajustar `guides.test.tsx` (espera `🐷`), `AccountsScreen.test.tsx` y `ui.test.tsx`.
- D6. Nombre visible: se mantiene «CuidaTuBilletera»; alternativa «Cuida tu Billetera» si el lanzador lo trunca (decisión tras verlo en el teléfono).
- **Pendientes de aprobación del usuario:** (a) `expo-splash-screen`; (b) arte: regenerar ahora o usar el actual ajustado para la build de prueba; (c) monocromático: rehacer u omitir; (d) regla «una sola alcancía por pantalla»; (e) nombre; (f) agrupar o no F-A1/F-B en la misma build (amplía el alcance); (g) autorizar la build.
- Riesgos: arte de baja resolución real; sin pruebas en lanzador ni splash reales; recorte del nombre; la alcancía del encabezado no debe truncar el título con fuente grande. Casos de accesibilidad pendientes (TalkBack, fuente ampliada, otros dispositivos) siguen sin ejecutarse (D18). Las etapas futuras F-A y F-B se conservan sin cambios.

- **Aprobación y ejecución (paso 374).** El usuario autorizó: instalar `expo-splash-screen`, regenerar los recursos nativos, ícono monocromático reconocible, una sola alcancía por pantalla, mantener el nombre «CuidaTuBilletera», F-A y F-B fuera de R6 y una única Development Build tras la QA. Implementado sin commit de código todavía:
  - Dependencia: `expo-splash-screen@~57.0.10` (la resuelta por `npx expo install`; `bundledNativeModules` decía ~57.0.9), una sola copia, `package-lock.json` +15 líneas. Documentación consultada: páginas SDK 57.0.0 de Expo (splash-screen y config/app).
  - `app.json`: `icon`, `android.adaptiveIcon` (`foregroundImage`, `monochromeImage`, `backgroundColor` `#0F5F5A`, sin `backgroundImage`), plugin `expo-splash-screen` (`image`, `imageWidth` 288, `backgroundColor` `#0F5F5A`, `resizeMode` `contain`); sin `splash` heredado ni `dark`; `name` sin cambio.
  - Recursos (reconstruidos como vectores, no ampliando el raster; fuentes y script en `docs/design/assets/r6/`): `icon.png` (RGB sin alfa), `adaptive-icon-foreground.png` (0 píxeles fuera del círculo de 628 px), `adaptive-icon-monochrome.png` (con ojo, hocico, ranura y «$»; sin recorte de la oreja), `splash-icon.png` (0 píxeles fuera del círculo de 640 px), copiados a `app/assets/`. Es una reconstrucción fiel en motivo y paleta, más plana que el arte 3D original.
  - Alcancía: `headerPigSize(ancho, fontScale)` (≤340 dp u fuente ≥1,75 oculta; 72 dp de 341 a 399; 96 dp desde 400; 48 dp con fuente ≥1,3), `EmptyState art="alcancia"` de 120 dp con 16 dp hasta el título, `pigZoom` retirado; «con cuentas» = estado listo y al menos una cuenta activa.
  - QA: `architect` (ab5f415218699758b), `mobile-visual-designer` (a787738c21573f0fa), `mobile-ux-designer` (a5f9bd9610db8d473), `mobile-engineer` (a8deebb98930dd503), `mobile-ux-qa` APRUEBA CON OBSERVACIONES (a41c7918399ade7f8), `qa-engineer` APROBADO (ae35bee264b70e9b5), `devops-engineer` (ac795b5d44214fc01). App: 59 suites y 1855 pruebas; tsc, ESLint y Prettier limpios.
  - Development Build `bcc026f3-b895-4a7a-a036-ec173e01c934` (versionCode 2, appVersion 1.0.0). Limitaciones: la Development Build no refleja del todo el splash ni el ícono temático (se validan en una build `preview`, no generada en este paso); el fingerprint de EAS (`b075289e…`) no coincide con el calculado en local (`1fcadfd2…`) y no se investigó; no se pudo comprobar en el log que se instalara `expo-splash-screen`; el SHA-1 de firma no se comprobó. **Sin validación en Android real.**

- **Cierre funcional de R6 (paso 376, 2026-10-19).** El usuario instaló y probó en Android real la Development Build `bcc026f3-b895-4a7a-a036-ec173e01c934` (versionCode 2; validación manual, sin evidencia instrumentada) y confirmó: (1) la app abre y permite iniciar sesión; (2) la barra inferior de Android permanece oculta; (3) el nuevo ícono aparece correctamente; (4) la alcancía aparece en el encabezado de Mis cuentas; (5) la ilustración se ve sin recortes ni superposiciones; (6) cuentas, categorías y movimientos siguen funcionando. R6 queda **cerrada funcionalmente**. QA final: `architect` COHERENTE (ae998a10bd91559c1), `mobile-visual-designer` APRUEBA (a2cb40f89e75ff56d), `mobile-ux-qa` sin defectos altos ni críticos (a8baa205b29b72b67), `qa-engineer` sin regresión (a7e383d95b9831fa9), `devops-engineer` (a6fcd120ccebb1d0d). Fingerprints: la hipótesis de que el versionCode remoto explicara la diferencia entre EAS (`b075289e…`) y el cálculo local (`1fcadfd2…`) **quedó refutada** (con `android.versionCode` ausente, 1 o 2 la huella local no cambia, porque `@expo/fingerprint` descarta `version` y `versionCode`); la causa sigue sin demostrarse (la más probable: EAS calcula sobre el árbol que sube, con recursos y dependencias aún sin commit) y no hay evidencia de defecto en el binario. Pendientes **no bloqueantes**, sin ejecutar: TalkBack, fuente ampliada, comportamientos especiales del teclado, otros dispositivos Android, splash e ícono monocromático en una build de distribución (`preview`), estado vacío con la alcancía de 120 dp, alcancía a 320 dp y con fuente 1,3 y 1,75, y revisión de la firma (SHA-1) antes de publicar. F-A y F-B se conservan como etapas futuras. Riesgo de integración: la migración D1 `0004_account_appearance.sql` solo está aplicada en DEV; el CD manual no aplica migraciones, por lo que antes de desplegar el Worker de producción hay que aplicar 0004 en producción (con autorización y respaldo).

## Capacidades futuras — Decisión F-A (versiones y actualización) y F-B (multidioma)

**Estado: PROPUESTAS, NO APROBADAS, NO IMPLEMENTADAS (2026-10-17).** Registradas a petición del usuario como capacidades fuera del alcance original. Prioridad 6, posterior al rediseño y al alcance funcional pendiente (Fase 6). Las propuestas salen de `architect` (viabilidad) y `mobile-ux-designer` (criterios de experiencia). Nada de lo siguiente cambia una norma vigente: si se aprueba, docs/001 se actualiza primero (publicación en Google Play, que docs/001 §3 deja fuera de alcance, e idiomas soportados) y docs/002 recoge las convenciones.

### F-A — Versiones y actualización de la app

Estado verificado: `app.json` tiene `version` 1.0.0 y `android.package`, pero no `versionCode`, `runtimeVersion`, `updates` ni canal; `eas.json` usa `appVersionSource: remote` y `autoIncrement` en `production`, sin canales ni `env` por perfil; `expo-updates` no está instalado. **EAS Update no está configurado.** La app no envía versión ni la API publica una política de versión mínima.

Decisiones iniciales propuestas (todas pendientes de aprobación):

- F-A1. Dos mecanismos: EAS Build y Google Play para cambios de binario; EAS Update solo para JavaScript y recursos compatibles. Adoptar `expo-updates` es una dependencia nativa y exige nueva build (alinear con R6).
- F-A2. `runtimeVersion` con política `appVersion` (alternativa `fingerprint`): una actualización OTA solo llega a binarios con la misma runtimeVersion.
- F-A3. Canales `development`, `preview` y `production` alineados con los perfiles de EAS; cada perfil fija su canal y `EXPO_PUBLIC_API_URL` (DEV o producción). Una OTA nunca cambia la URL de la API.
- F-A4. `version` (versionName) manual en `app.json`; `versionCode` lo gestiona EAS en remoto.
- F-A5. Compatibilidad app–API decidida por la API (consistente con «la API valida las reglas»): la app envía su versión y la API responde un estado `ok`, `update_available` o `update_required` (p. ej. `GET /app-config` sin autenticación). Requiere decisión de contrato.
- F-A6. Contratos de la API y migraciones aditivos y compatibles hacia atrás: la API debe servir a la versión mínima soportada de la app (como la migración 0004).
- F-A7. Aviso opcional descartable y obligatorio bloqueante, sin interrumpir capturas en curso ni bloquear si falla la comprobación; textos por la capa de F-B.
- F-A8. Rollback: OTA republicando la versión anterior o con el rollback de EAS Update; el binario no se revierte (despliegue escalonado y subir la versión mínima). Documentar el procedimiento antes de usarlo.
- F-A9. Pruebas de compatibilidad: app N y N-1 contra la API actual y la siguiente en DEV; contrato de `/app-config`; una runtimeVersion nueva no recibe OTA de la anterior.

Riesgos: OTA incompatible con el binario; build de producción apuntando a la API DEV; bloqueo obligatorio sin acceso a la tienda; Google Play arrastra compromisos de docs/001 §3 (política de privacidad, eliminación de cuenta) hoy excluidos; secretos de EAS/Play solo en los mecanismos del proveedor. El comportamiento de EAS Update y de las políticas de runtimeVersion salió de conocimiento general y debe validarse con la documentación vigente antes de decidir.

### F-B — Soporte multidioma

Estado verificado: no existe capa ni librería de i18n; los textos están escritos en español en `app/src` (estimación por patrón de 300 a 450 cadenas únicas; hace falta un inventario exacto). Hay centralización parcial (`resources-messages.ts`, `auth-messages.ts`, `guides.ts`, `category-appearance.ts`). Formatos propios: `formatCents` (`$1234.56`), `formatDateEs`, `formatPercent`; `Intl` no se usa a propósito. La API responde `{ error: { code, message } }` con `message` en español.

Decisiones iniciales propuestas (todas pendientes de aprobación):

- F-B1. Español idioma inicial y de respaldo; inglés propuesto como siguiente. Sin traducir ni instalar nada ahora.
- F-B2. Diccionario tipado por idioma en `app/src/i18n/` (`es.ts` como fuente, `en.ts` con la misma forma) y función `t(clave, params)` con plurales; capa propia mínima mientras haya dos idiomas. `expo-localization` solo para detectar el idioma del teléfono (dependencia nueva, a aprobar).
- F-B3. Centralización por pantalla, empezando por los módulos de mensajes existentes; las pruebas se ejecutan con `es` por defecto. Convención ligera durante la Fase 6: textos nuevos en módulos de mensajes agrupados, no en el JSX.
- F-B4. Los montos siguen siendo enteros en centavos; solo cambia la presentación, con un único punto de formato y separador decimal inequívoco. Decisión pendiente sobre formato regional e `Intl`.
- F-B5. Mensajes de la API: la app traduce por `error.code`; el `message` queda solo como respaldo y registro. Un código desconocido muestra un genérico traducido. Sin cambio de contrato.
- F-B6. Resolución del idioma: preferencia guardada > idioma del teléfono (si es es/en) > español. Persistencia local primero; en D1 solo si luego hiciera falta.
- F-B7. Accesibilidad: etiquetas, pistas y anuncios también se traducen; el lector de pantalla lee en el idioma elegido.
- F-B8. Pruebas con pseudo-localización (+30 a 40 %), 360x640 y fuente al 200 %.
- F-B9. Los nombres de cuentas y categorías creados por el usuario no se traducen. Las categorías predeterminadas necesitarían una clave estable (posible cambio en D1): decisión expresa.
- F-B10. Exportación: CSV estable e independiente del idioma (recomendado); PDF según decisión.

Riesgo principal: un separador decimal ambiguo en montos (1.234 frente a 1,234), que debe resolverse antes de añadir un segundo idioma. Otros: textos largos en la barra de 5 pestañas, traducciones parciales, usuario atrapado en un idioma que no entiende (mitigación: fila «Idioma / Language» estable) y revisión humana de cada idioma.

### Dependencias y orden

- F-A depende de F-B solo para los textos de sus avisos (pueden nacer en español y migrarse). F-B no depende de F-A.
- Ambas pueden requerir una build nativa nueva (`expo-updates`, `expo-localization`): agrupar con R6 o con una build planificada, siempre con autorización expresa.
- Orden vigente: 1 completar R5.1, 2 validar en Android real, 3 R6, 4 integrar el rediseño, 5 retomar el alcance funcional pendiente (Fase 6), 6 F-A y F-B.

### Decisiones pendientes del usuario

1. Confirmar F-A y F-B como capacidades futuras de prioridad 6. 2. Si Google Play entra en el alcance (cambia docs/001 §3). 3. Adoptar EAS Update y `expo-updates`. 4. Política de `runtimeVersion` y nombres de canales. 5. Contrato de compatibilidad app–API. 6. Política de actualización obligatoria y opcional, y su frecuencia. 7. Inglés como segundo idioma. 8. Capa propia o librería, y `expo-localization`. 9. Dónde se guarda el idioma. 10. Categorías predeterminadas y exportación. 11. Formato regional de montos y fechas e `Intl`. 12. Builds nativas junto con R6. 13. Convención de textos durante la Fase 6. 14. Si el bloqueo obligatorio impide también cerrar sesión.
