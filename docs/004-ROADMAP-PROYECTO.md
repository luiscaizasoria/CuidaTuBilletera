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

Estado: los cuatro objetivos están validados funcionalmente en un teléfono Android real (development build, API `controlgastos-api-dev`) y cubiertos por pruebas automatizadas (API 42, app 56). Quedan pendientes de seguimiento, sin bloquear el cierre funcional: la causa del HTTP 401 previo a la renovación y la inspección directa de `iat`/`exp`. Implementación transitoria sin D1, ver `docs/003-DECISIONES-FASE0.md`.

[x] Login Google.
[x] Validación token.
[x] Gestión sesión.
[x] Logout.

Evidencia en el teléfono (verificada manualmente):

- **Login Google**: exitoso tras corregir la SHA-1 del cliente OAuth Android (ver `docs/003-DECISIONES-FASE0.md`).
- **Validación token**: la API de pruebas validó el ID token de Google, emitió su JWT propio y la app mostró la sesión iniciada.
- **Gestión sesión**:
  - Cerrar y reabrir la app recuperó la sesión guardada.
  - Tras 16 minutos (el JWT dura 15) la app siguió mostrando la sesión iniciada sin pedir login.
  - Tras casi una hora sin usarla, al reabrir apareció directamente «Sesión iniciada» sin pulsar «Ingresar con Google». Cloudflare registró dos `POST /auth/google`: primero HTTP 401 y después HTTP 200. La renovación silenciosa quedó validada funcionalmente.
- **Logout**: «Cerrar sesión» y reabrir desde Expo devolvió a la pantalla de login.

Alcance de la validación de la renovación:

- Es una validación **funcional**: la sesión se recuperó sin intervención y la API aceptó el intercambio (HTTP 200).
- **No** se inspeccionaron directamente los claims `iat` y `exp` del JWT nuevo frente al anterior.
- El HTTP 401 previo al 200 **tiene causa aún no determinada** (ver `docs/003-DECISIONES-FASE0.md`).

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
