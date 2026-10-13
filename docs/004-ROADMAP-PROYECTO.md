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
[x] Configurar Dev Container.

Nota CD: validado con el workflow `Deploy API #2` (ejecución 38175964135), estado Success, rama `main`, commit `90ac2dd`. Publicó el Worker `controlgastos-api` en Cloudflare (versión `2657d6c3-e636-433f-89c8-85551d710f03`), con pruebas de la API 3/3 aprobadas y verificación automática de `GET /health` aprobada.

Nota Dev Container: configuración en `.devcontainer/` y `docs/005-DEVCONTAINER.md`, instalada y validada satisfactoriamente.

Evidencias de validación del Dev Container:

- Docker Desktop 4.95.0 y Docker Engine 29.8.2, con Ubuntu sobre WSL 2.
- VS Code conectado al Dev Container `ControlGastos @ desktop-linux`; usuario `node` y directorio `/workspaces/ControlGastos` verificados.
- Node.js 22.16.0, npm 10.9.2 y Git 2.49.0 disponibles; dependencias principales accesibles.
- Pruebas de API con Vitest: 3/3 aprobadas.
- `npm run typecheck --workspace api`: correcto.
- `npm run lint`: correcto.
- `npm run build --workspace api`: correcto mediante Wrangler `--dry-run`, sin desplegar en Cloudflare.

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
