# Decisiones de la Fase 0

Complemento de la constitución. Registra las decisiones tomadas antes de empezar la Fase 0. Si algo no está aquí ni en docs/CONSTITUCION.md, pregunta antes de inventarlo.

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
2. Haz un commit inicial con CLAUDE.md, .gitignore, docs/CONSTITUCION.md y docs/DECISIONES-FASE0.md. Mensaje en formato Conventional Commits: docs: agrega constitución, instrucciones y decisiones de la fase 0.
3. Crea el repositorio público CuidaTuBilletera con gh, usa esta carpeta como origen, configura el remoto origin y sube main.
4. No escribas código, no crees ramas nuevas y no configures protección de main.
5. Al final muestra git log --oneline y la URL del repositorio, y dime qué sigue.

## TAREA 2: Pull Request (a), estructura del monorepo

Empieza en modo plan: presenta el plan completo y espera mi aprobación antes de escribir archivos.

Alcance: solo las herramientas comunes de la raíz. NO generes todavía los proyectos de api ni de app: los generadores oficiales los crearán en los Pull Requests b y c.

1. Crea la rama chore/monorepo-structure desde main. Los archivos docs/CONVENCIONES.md, CLAUDE.md y este archivo ya tienen cambios sin commit: inclúyelos.
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

Reglas: sigue docs/CONVENCIONES.md. No toques docs/CONSTITUCION.md. Si algo es ambiguo, pregunta.