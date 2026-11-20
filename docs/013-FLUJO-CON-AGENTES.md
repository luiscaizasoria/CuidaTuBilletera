# Flujo de trabajo con agentes

Describe cómo se organizó el trabajo con Claude Code y agentes especializados. Solo se afirma lo que consta en el repositorio (`.claude/`, `CLAUDE.md`, docs y historial de Git). Lo que ocurrió fuera del repositorio está marcado para que lo complete el responsable.

Fecha de esta revisión: 2026-11-20.

## 1. Qué consta en el repositorio

Archivos que definen el flujo:

- `CLAUDE.md`: reglas permanentes, política de delegación, política de cambios de interfaz móvil y formato del registro de ejecución.
- `.claude/agents/`: nueve definiciones de agentes.
- `.claude/rules/`: cinco reglas (`architecture`, `project-state`, `quality`, `security`, `workflow`).
- `.claude/settings.json`: permisos compartidos (lectura permitida de scripts de npm comunes; lectura denegada de archivos de secretos).

### Roles (de `.claude/agents/`)

| Agente                   | Responsabilidad                                                                                                                                              | Herramientas declaradas               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `orchestrator`           | Coordina tareas importantes: consulta el roadmap, delimita el alcance, elige especialistas y consolida la evidencia. No delega consultas ni cambios menores. | no declaradas                         |
| `architect`              | Diseño y revisión estructural (modelo de datos, contratos, dependencias, autenticación). Solo lectura; propone el texto de las decisiones.                   | Read, Grep, Glob, WebFetch, WebSearch |
| `backend-engineer`       | Implementa API y D1 (Workers, Hono, Zod) con sus pruebas, sobre un diseño ya aprobado.                                                                       | no declaradas                         |
| `mobile-engineer`        | Implementa y revisa la app (React Native, Expo, TypeScript, Android) con sus pruebas.                                                                        | no declaradas                         |
| `mobile-ux-designer`     | Especifica navegación, flujos, formularios y accesibilidad antes de cambios significativos; no implementa pantallas.                                         | Read, Grep, Glob, Write, Edit, Bash   |
| `mobile-visual-designer` | Define tokens, íconos, colores y recursos; no implementa pantallas ni reemplaza assets activos.                                                              | Read, Grep, Glob, Write, Edit, Bash   |
| `mobile-ux-qa`           | Validación UX/UI independiente con la matriz de docs/010; no modifica pantallas, registra defectos.                                                          | Read, Grep, Glob, Bash, Write         |
| `qa-engineer`            | Ejecuta pruebas, typecheck y lint y aporta la evidencia de cierre.                                                                                           | no declaradas                         |
| `devops-engineer`        | Wrangler, CI/CD, entornos y despliegues.                                                                                                                     | no declaradas                         |

### Cómo se coordinaban (según `CLAUDE.md` y las reglas)

- **Ejecución secuencial, nunca en paralelo**, para proteger la memoria del Dev Container.
- **Cambios significativos de interfaz móvil:** `architect` (si hay restricciones estructurales) → `mobile-ux-designer` → `mobile-visual-designer` → `mobile-engineer` (solo con el diseño aprobado por el usuario) → `mobile-ux-qa` → `qa-engineer`. Un defecto alto o crítico de `mobile-ux-qa` detiene el cierre y la publicación.
- **Ramas cortas por tarea** (`feat/`, `fix/`, `chore/`), Conventional Commits y Pull Request antes de integrar (`.claude/rules/workflow.md`). El historial de Git lo refleja: 32 commits en `main`, casi todos fusionados mediante PR numerados.
- **Validación independiente:** el implementador no valida su propio trabajo; `mobile-ux-qa` y `qa-engineer` son agentes distintos.
- **Autorización explícita para lo remoto:** ningún agente hace commit, push, PR, migración remota ni despliegue sin autorización expresa del usuario. Las ambigüedades y aprobaciones se resuelven en la conversación principal; los agentes devuelven la pregunta.
- **Evidencia de delegación:** una delegación solo cuenta si hay un `agentId` devuelto por la herramienta Agent. docs/004 y docs/003 registran esos identificadores en las tareas importantes, y cada cierre usa el formato de «Registro de ejecución» de `CLAUDE.md` (agente, trabajo, evidencia, skills, MCP y lo no utilizado).
- **Documentación primero:** los cambios arquitectónicos actualizan antes la documentación; el roadmap solo se actualiza tras validar resultados.
- **Secretos:** los agentes no leen ni imprimen credenciales; `.claude/settings.json` deniega la lectura de archivos de secretos (con los límites que documenta `.claude/rules/security.md`: no es aislamiento completo).

### Límites del flujo

- Los agentes de diseño no tocan reglas financieras, endpoints, D1, sesiones, dependencias nativas ni infraestructura.
- `architect` es de solo lectura y no documenta por sí mismo.
- El sandbox de Claude Code está desactivado (`.claude/rules/security.md`): los controles de lectura reducen el riesgo pero no lo eliminan.
- La delegación depende de que quien coordina la invoque: no hay automatización que la fuerce.
- Los commits recientes llevan la línea `Co-Authored-By` de Claude además de la persona responsable; la revisión y el merge de cada PR son decisiones humanas.

## 2. Qué ocurre fuera del repositorio (completar por el responsable)

El flujo descrito por el responsable incluye un **orquestador conversacional** (Claude en una conversación, fuera de este repositorio) que prepara prompts acotados que Claude Code ejecuta. Nada de esto consta en archivos del repositorio, salvo el agente `orchestrator` de `.claude/agents/orchestrator.md`, que es una definición distinta (un agente dentro de Claude Code).

> **PENDIENTE DE COMPLETAR POR EL RESPONSABLE**
>
> - Herramienta y modelo usados para el orquestador conversacional.
> - Cómo se redactaban y acotaban los prompts (plantilla, alcance autorizado, límites).
> - Cómo se devolvía la evidencia al orquestador y cómo se decidían las aprobaciones.
> - Relación entre el agente `orchestrator` de `.claude/agents/` y el orquestador conversacional (si se usó el primero, cuándo y para qué).
> - Cualquier otra práctica que no deje rastro en Git (revisiones manuales, pruebas en teléfono, etc.).

## 3. Dónde comprobarlo

| Afirmación                                 | Archivo                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| Política de delegación y de interfaz móvil | `CLAUDE.md`                                               |
| Roles y límites de cada agente             | `.claude/agents/*.md`                                     |
| Flujo de ramas, commits y PR               | `.claude/rules/workflow.md`, historial de Git             |
| Seguridad y secretos para agentes          | `.claude/rules/security.md`, `.claude/settings.json`      |
| Evidencia de invocaciones                  | docs/003 y docs/004 (identificadores `agentId` por tarea) |
