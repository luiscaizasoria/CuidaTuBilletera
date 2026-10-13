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
- Solo existe el entorno `production`. El entorno `dev` y D1 se añaden en la Fase 2, con revisión arquitectónica previa.
- La verificación de `GET /health` solo se ejecuta si `WORKER_URL` está configurada; si no, queda **pendiente** y no se considera aprobada.
- Rollback manual documentado, no automatizado.
- La tarea "Configurar CD (despliegues)" del Roadmap sigue sin marcar hasta que exista un despliegue exitoso y verificado.

### Pendientes de validación

- Ningún despliegue real se ha ejecutado: no hay cuenta, token ni Environment configurados.
- El workflow no se ha ejecutado en GitHub; solo se revisó su sintaxis localmente.
- Fijar por SHA las acciones de `ci.yml` queda como decisión aparte.

## FASE 1: Autenticación con Google (implementación transitoria)

Aprobado por el orquestador. Esta sección registra la excepción a la constitución §4 antes de escribir el código.

### Excepción arquitectónica aprobada

- **No se implementa todavía**: D1, tabla `users`, tabla `refresh_tokens`, `POST /auth/refresh`, `POST /auth/logout` ni revocación centralizada. Corresponden a la fase con D1 (Fase 2).
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
