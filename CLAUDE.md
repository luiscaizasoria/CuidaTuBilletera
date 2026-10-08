# CLAUDE.md - App de Control de Gastos

Instrucciones permanentes. El documento rector es `docs/CONSTITUCION.md`: léelo completo antes de empezar cualquier tarea. Si algo no está ahí, pregunta antes de inventarlo.

## Proyecto
App móvil Android de control de gastos e ingresos (cuentas, categorías, historial, calendario, reportes, exportación y conciliación). Login con Google. Monorepo: `/app` (React Native + Expo), `/api` (Cloudflare Worker con Hono y D1), `/docs`, `/.devcontainer`, `/.github/workflows`.

## Reglas que siempre aplican
- Simple primero: nada de funciones "por si acaso".
- Toda la infraestructura dentro de las capas gratuitas de Cloudflare y GitHub.
- El servidor manda: toda regla de negocio se valida en la API.
- Dinero: enteros en centavos, nunca decimales de punto flotante.
- No se borra información, se archiva. La conciliación se registra como movimiento de tipo ajuste.
- Toda consulta se filtra por el user_id del token, nunca por un id enviado por el cliente.
- Secretos nunca en el repositorio (GitHub Secrets y secretos de Cloudflare).
- TypeScript estricto, ESLint y Prettier.

## Flujo de trabajo
- Una rama corta por tarea: feat/..., fix/..., chore/.... Nunca trabajar directo en main.
- Commits con Conventional Commits (feat:, fix:, chore:, test:, docs:).
- Pruebas junto con el código. Ejecutar lint y pruebas antes de proponer el cambio.
- Pull Request con descripción breve, pruebas incluidas y CI en verde.
- Una tarea = un alcance acotado. Ante cualquier ambigüedad, preguntar.
- Si una decisión de diseño cambia, se actualiza primero docs/CONSTITUCION.md.

## Entorno
- Windows con PowerShell. Responder en español.
- Fase actual: 0.