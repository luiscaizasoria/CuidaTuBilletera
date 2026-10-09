# CLAUDE.md - App de Control de Gastos

## Propósito de este archivo

Este archivo contiene las instrucciones permanentes para Claude Code dentro del proyecto.

CLAUDE.md es el punto principal de entrada para Claude Code.

Antes de realizar cualquier cambio:

1. Leer este archivo.
2. Consultar docs/001-CONSTITUCION.md para reglas del producto, alcance y arquitectura.
3. Consultar docs/002-CONVENCIONES.md para estándares técnicos.
4. Consultar docs/003-DECISIONES-FASE0.md para decisiones del proyecto.
5. Si existe una ambigüedad, preguntar antes de decidir.

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

- .claude/skills/
  Procesos repetibles.

- .claude/.mcp.json
  Configuración MCP del proyecto.

Los agentes se crean solamente cuando exista una responsabilidad clara.

---

## Entorno

- Sistema operativo: Windows.
- Shell: PowerShell.
- Idioma de trabajo: español.
- Código y nombres técnicos: según docs/002-CONVENCIONES.md.

## Fase actual

Fase 0 - Preparación del proyecto.
