# Convenciones del proyecto

Complemento de la constitución. Fija nombres y ubicaciones. Se hace cumplir con ESLint, Prettier y .editorconfig, no con acuerdos verbales.

## Idioma
- Código (variables, funciones, tipos, archivos, carpetas y ramas): inglés.
- Textos visibles para el usuario, mensajes de commit, documentación y comentarios: español.
- Tablas, columnas, rutas de la API y valores como ingreso, gasto y ajuste se escriben exactamente como en la constitución. Los tipos TypeScript que representan filas usan los mismos nombres de columna, sin traducir.

## Nombres
- Archivos y carpetas: kebab-case, por ejemplo account-service.ts. Componentes de React: PascalCase, por ejemplo TransactionForm.tsx.
- Variables y funciones: camelCase. Tipos, interfaces y componentes: PascalCase. Constantes globales: UPPER_SNAKE_CASE.
- Pruebas: junto al código, con sufijo .test.ts o .test.tsx. Las de integración de la API van en api/test/.
- Ramas: feat/, fix/ o chore/ seguido de una descripción corta en kebab-case, por ejemplo chore/monorepo-structure.

## Ubicaciones
- api/src: index.ts (entrada del Worker), routes/, services/ (reglas de negocio), db/ (acceso a D1) y lib/ (utilidades).
- api/migrations: archivos SQL secuenciales con formato 0001_descripcion.sql. Una migración aplicada nunca se modifica.
- app/src: screens/, components/, hooks/ y lib/ (formato de montos y cliente de la API).
- docs/: constitución, decisiones por fase, convenciones y especificaciones por módulo.
- Las carpetas se crean cuando se necesitan, no por adelantado.

## Calidad
- El formato lo decide Prettier. ESLint con configuración en la raíz. TypeScript estricto.
- Scripts en la raíz: lint, typecheck, test y format, que ejecutan los de cada workspace.
- Agregar solo las dependencias necesarias. Las versiones las fija package-lock.json.

## Recordatorio
- Montos como enteros en centavos. Fechas como AAAA-MM-DD.
