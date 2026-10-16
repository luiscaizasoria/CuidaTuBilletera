# CLAUDE.md - App de Control de Gastos

## Propósito de este archivo

Este archivo contiene las instrucciones permanentes para Claude Code dentro del proyecto.

CLAUDE.md es el punto principal de entrada para Claude Code.

Antes de realizar cualquier cambio:

1. Leer este archivo.
2. Consultar docs/001-CONSTITUCION.md para reglas del producto, alcance y arquitectura.
3. Consultar docs/002-CONVENCIONES.md para estándares técnicos.
4. Consultar docs/003-DECISIONES-FASE0.md para decisiones del proyecto.
5. Consultar docs/004-ROADMAP-PROYECTO.md para el estado y el plan de las fases.
6. Si existe una ambigüedad, preguntar antes de decidir.

---

## Proyecto

App móvil Android de control de gastos e ingresos.

Funcionalidades principales:

- Cuentas.
- Categorías.
- Movimientos.
- Historial.
- Calendario.
- Reportes.
- Exportación.
- Conciliación.
- Login con Google.

Arquitectura:

- /app: React Native + Expo + TypeScript.
- /api: Cloudflare Worker + Hono + D1.
- /docs: documentación del proyecto.
- /.github/workflows: integración continua y despliegues.
- /.devcontainer: entorno reproducible.

---

## Documentación del proyecto

Documento de producto:

- docs/001-CONSTITUCION.md

Estándares técnicos:

- docs/002-CONVENCIONES.md

Historial de decisiones:

- docs/003-DECISIONES-FASE0.md

Estado y plan de las fases:

- docs/004-ROADMAP-PROYECTO.md

Diseño del rediseño UX/UI y su validación:

- docs/007-DISENO-UX.md
- docs/008-DISENO-VISUAL.md
- docs/009-PLAN-IMPLEMENTACION-REDISENO.md
- docs/010-MATRIZ-PRUEBAS-UX.md

Los documentos anteriores son fuentes de verdad del proyecto según su responsabilidad.

---

## Reglas permanentes

- Simple primero: no crear funcionalidades fuera del alcance.
- La API es responsable de validar las reglas de negocio.
- Los montos monetarios se manejan como enteros en centavos.
- La información histórica no se elimina, se archiva.
- Toda consulta debe estar aislada por usuario autenticado.
- Los secretos nunca se almacenan en el repositorio.
- TypeScript estricto.
- ESLint y Prettier obligatorios.

---

## Flujo de trabajo

- Nunca trabajar directamente en main.
- Usar ramas feat/, fix/ o chore/.
- Usar Conventional Commits.
- Crear Pull Request antes de integrar cambios.
- Las pruebas acompañan al código.
- Ejecutar validaciones antes de entregar cambios.
- Los cambios arquitectónicos actualizan primero la documentación correspondiente.

---

## Claude Code Governance

La configuración específica de Claude Code vive en:

.claude/

Estructura:

- .claude/agents/
  Agentes especializados.

- .claude/rules/
  Reglas técnicas específicas.

- .claude/settings.json
  Permisos compartidos del proyecto (versionado).

- .claude/settings.local.json
  Preferencias locales (no versionado).

- .claude/skills/
  Procesos repetibles. Aún no hay skills del proyecto.

- .mcp.json (raíz del repositorio)
  Configuración de los servidores MCP del proyecto. Hoy no existe: el proyecto no define servidores MCP. Los conectores de cuenta (por ejemplo Claude Docs) y el MCP del IDE no son configuración del proyecto.

Los agentes se crean solamente cuando exista una responsabilidad clara.

### Coordinación y delegación

- `orchestrator` coordina las tareas importantes. Una tarea es importante si cambia más de un archivo de código o de configuración, o si toca migraciones, contratos de la API, dependencias, autenticación o sesiones. Antes de delegar consulta docs/004-ROADMAP-PROYECTO.md y .claude/rules/, delimita el alcance y fija los criterios de aceptación.
- Las consultas, las lecturas y los cambios menores no requieren agentes: no se delega por sistema.
- Las ambigüedades, las aprobaciones y las operaciones irreversibles se resuelven con el usuario desde la conversación principal. Los agentes devuelven la pregunta en lugar de decidir.

Política de delegación:

- `architect`: diseño y revisión estructural. Se consulta antes de implementar cambios estructurales. Es de solo lectura: propone el texto de las decisiones y quien coordina las documenta tras la aprobación del usuario (primero en docs/001 si cambia una norma; el motivo se registra en docs/003).
- `backend-engineer`: implementación API/D1 (Hono, Zod, servicios y acceso a datos) con sus pruebas. No toma decisiones arquitectónicas.
- `mobile-engineer`: implementación y revisión de la app móvil (React Native, Expo, TypeScript y Android) con sus pruebas. Se usa de forma proactiva en las tareas de /app. No toma decisiones arquitectónicas: el diseño arquitectónico móvil se coordina con `architect` y las pruebas móviles con `qa-engineer`.
- `mobile-ux-designer`: experiencia de uso móvil (navegación, flujos, formularios, ayudas, accesibilidad, safe areas, usabilidad). Se consulta ANTES de implementar cambios significativos de navegación o experiencia. Produce especificaciones y prototipos aislados en docs/; no implementa pantallas.
- `mobile-visual-designer`: apariencia móvil (identidad, íconos, colores, tipografía, tarjetas, ilustraciones, consistencia visual). Se consulta en cambios significativos de presentación. Produce tokens, recursos y especificaciones en docs/; no implementa pantallas ni reemplaza assets activos.
- `mobile-ux-qa`: validación UX/UI independiente de la app móvil (fidelidad al diseño aprobado, navegación y Atrás, cuenta activa, formularios, textos, contraste, áreas táctiles, safe areas, teclado y estados) con la matriz de docs/010-MATRIZ-PRUEBAS-UX.md. No modifica pantallas: registra defectos con evidencia y los devuelve al implementador.
- `qa-engineer`: pruebas, regresiones y calidad. Ejecuta pruebas, typecheck y lint y aporta la evidencia con la que se cierra una tarea.
- `devops-engineer`: Wrangler, CI/CD, entornos y despliegues.

Política de cambios de interfaz móvil (permanente, aplica a todas las fases). Los agentes se ejecutan de forma secuencial, nunca en paralelo, para proteger la memoria del Dev Container:

1. Cambio significativo de interfaz (navegación, flujos, pantallas nuevas o rediseño): `architect` cuando haya restricciones estructurales → `mobile-ux-designer` define o revisa el flujo → `mobile-visual-designer` define o revisa la presentación → `mobile-engineer` implementa solo el diseño aprobado por el usuario → `mobile-ux-qa` valida UX/UI de forma independiente → `qa-engineer` valida regresiones técnicas.
2. Cambio mínimo de texto o presentación: proceso proporcional al riesgo (sin diseñadores si no cambia el diseño), pero toda modificación de la interfaz visible exige al menos la revisión de `mobile-ux-qa`.
3. Un defecto alto o crítico de `mobile-ux-qa` detiene el cierre y la publicación (PR, build o entrega) hasta su corrección y nueva validación.

Los diseñadores no modifican reglas financieras, endpoints, D1, sesiones, dependencias nativas, infraestructura ni pantallas funcionales.

Ningún agente hace commit, push, PR, migración remota ni despliegue sin autorización expresa del usuario.

Una delegación solo se da por ocurrida si hay evidencia de invocación: el `agentId` devuelto por la herramienta Agent o su transcript en `subagents/`. Una mención en un texto no cuenta.

Registro de ejecución (al cerrar cada tarea importante):

| Agente | Trabajo realizado | Evidencia de invocación (agentId) |
| --- | --- | --- |

- Skills usadas: ninguna, o la skill con su evidencia.
- MCP usados: ninguno, o el servidor y la herramienta con su evidencia.
- No utilizados: lo que se esperaba usar y no se usó, con el motivo.

---

## Entorno

- Entorno de trabajo actual: Linux (Bash) dentro del Dev Container, en /workspaces/ControlGastos (ver docs/005-DEVCONTAINER.md).
- Sistema anfitrión: Windows (Docker Desktop, WSL 2 y VS Code). PowerShell solo aplica si se trabaja directamente en el anfitrión; las reglas de permisos de PowerShell de .claude/settings.json se conservan para ese caso.
- Idioma de trabajo: español.
- Código y nombres técnicos: según docs/002-CONVENCIONES.md.

## Fase actual

Fase 2A - D1, usuarios y sesiones (en curso).

Historial:

- Fase 0 - Preparación del proyecto: completada.
- Fase 1 - Autenticación con Google: completada funcionalmente. Es una implementación transitoria sin D1, con pendientes de seguimiento en docs/003 y docs/004.

El detalle y la evidencia están en docs/004-ROADMAP-PROYECTO.md.
