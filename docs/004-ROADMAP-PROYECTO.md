# Roadmap del Proyecto ControlGastos

## Estado actual

Fase:
Fase 0 - Preparación del proyecto

Objetivo:
Construir la base técnica, arquitectura y gobernanza necesaria antes del desarrollo funcional.

---

# Fase 0 - Preparación

## Gobernanza Claude Code

[x] CLAUDE.md actualizado.
[x] Documentación del proyecto organizada.
[x] Convención Markdown definida.
[x] Agentes iniciales creados.
[x] Reglas iniciales creadas.
## Estado herramientas IA

Claude Code:
Configurado.

MCP:
- Claude Docs conectado.

Agents:
- orchestrator
- architect
- backend-engineer
- qa-engineer
- devops-engineer

Rules:
- architecture
- workflow
- quality
- project-state

## Infraestructura base

[x] Validar estructura monorepo.
[x] Crear Worker mínimo.
[x] Configurar pruebas API.
[x] Configurar CI.
[x] Configurar CD (despliegues).
[x] Crear proyecto Expo base.
[ ] Configurar Dev Container.

Nota CD: validado con el workflow `Deploy API #2` (ejecución 38175964135), estado Success, rama `main`, commit `90ac2dd`. Publicó el Worker `controlgastos-api` en Cloudflare (versión `2657d6c3-e636-433f-89c8-85551d710f03`), con pruebas de la API 3/3 aprobadas y verificación automática de `GET /health` aprobada.

Nota: configuración preparada (`.devcontainer/`, `docs/005-DEVCONTAINER.md`), pendiente de validación con Docker y VS Code Dev Containers.

---

# Fase 1 - Autenticación

[ ] Login Google.
[ ] Validación token.
[ ] Gestión sesión.
[ ] Logout.

---

# Fase 2 - Cuentas y categorías

[ ] Modelo usuarios.
[ ] Cuentas.
[ ] Categorías.
[ ] Categorías iniciales.

---

# Fase 3 - Movimientos

[ ] Crear ingresos.
[ ] Crear gastos.
[ ] Historial.
[ ] Filtros.

---

# Fase 4 - Calendario

[ ] Vista mensual.
[ ] Indicadores diarios.

---

# Fase 5 - Reportes

[ ] Reportes mensuales.
[ ] Reportes anuales.
[ ] Exportación.

---

# Fase 6 - Conciliación

[ ] Ajustes de saldo.
[ ] Historial de conciliaciones.

---

# Fase 7 - Preparación entrega

[ ] Pruebas completas.
[ ] APK prueba.
[ ] Revisión final.
