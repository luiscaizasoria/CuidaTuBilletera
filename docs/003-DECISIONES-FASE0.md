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
