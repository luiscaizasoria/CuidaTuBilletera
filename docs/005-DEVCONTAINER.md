# Dev Container

Entorno reproducible de desarrollo (Node 22 sobre Debian bookworm) definido en `.devcontainer/devcontainer.json`.

> Estado: **probado en Windows 11 + WSL 2 + Docker Desktop**. Dentro del contenedor se validaron Docker/WSL 2, Node.js y npm, `npm ci`, el typecheck de API y app, las pruebas (1497 de API y 2072 de app aprobadas), Git, Claude Code, Wrangler, EAS CLI 25.3.0 y el acceso a GitHub por HTTPS. La instalación automática de EAS CLI en `postCreateCommand` se incorporó después y **aún no se ha probado con una reconstrucción** del contenedor. Ver "Validaciones pendientes".

## Abrir con VS Code

Requisitos: Docker Desktop con el backend WSL 2 (o motor compatible) y la extensión Dev Containers de VS Code.

1. Abrir la carpeta del repositorio en VS Code.
2. Ejecutar `Dev Containers: Reopen in Container`.
3. Esperar a que termine `postCreateCommand` (puede tardar por `npm ci` y la instalación de EAS CLI).

Alternativa: `Dev Containers: Clone Repository in Container Volume`. El código vive en un volumen Docker (mejor rendimiento de disco en Windows). En ese caso el `workspaceMount` bind de la configuración no aplica a la misma carpeta de Windows; esta alternativa no se ha probado y puede requerir ajustar `workspaceMount`.

## Qué hace la configuración

- Imagen `mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm`, usuario `node` (sin privilegios; `sudo` solo se usa en el chown inicial).
- El repositorio se monta (bind) en `/workspaces/ControlGastos`, igual que `workspaceFolder`.
- Tres volúmenes nombrados, con `${devcontainerId}` para ser únicos por contenedor, cubren `node_modules` de la raíz, `api/` y `app/`. Así los binarios de Windows y Linux no se mezclan y la instalación es más rápida que sobre el bind.
- `postCreateCommand` (solo al crear el contenedor), encadenado con `&&` para que cualquier fallo detenga la creación y se informe:
  1. `sudo chown node:node` sobre los 3 puntos de montaje (no recursivo, los volúmenes nuevos pertenecen a root).
  2. `npm ci`.
  3. `npm install -g eas-cli@25.3.0`, ejecutado desde `$HOME` y sin `sudo`. Se instala en el prefijo npm global del usuario `node` de la imagen (`/usr/local/share/npm-global`, ya incluido en `PATH`).
  4. `eas --version` debe contener `eas-cli/25.3.0`; si la instalación falló o la versión no coincide, el comando termina con error.
- Extensiones: ESLint, Prettier y EditorConfig; formato al guardar con Prettier.
- Sin servicios, secretos, `containerEnv`, red del host, modo privilegiado, Docker-in-Docker ni montaje de credenciales.

Nota: `node_modules` de Windows en el host queda oculto dentro del contenedor por los volúmenes; no se comparten.

### Variables DEV locales

Los archivos locales de desarrollo (por ejemplo `api/.dev.vars` y `app/.env`) viven en la carpeta del repositorio y están en `.gitignore`. Como el repositorio se monta por bind, se conservan al reconstruir el contenedor: no hay que volver a crearlos. Nunca se versionan ni se copian a otro lugar.

### EAS CLI

EAS CLI se instala automáticamente en la versión fija `25.3.0`. Para cambiar de versión se actualiza `postCreateCommand` (instalación y comprobación) y este documento en el mismo cambio. No se usa `npx eas` ni una instalación manual que se pierda al reconstruir.

## Sesiones tras reconstruir el contenedor

Las sesiones de las herramientas viven dentro del contenedor y no se montan desde Windows, por lo que **se pierden al reconstruirlo**. Es el comportamiento esperado: hay que volver a iniciar sesión.

- **Wrangler**: usar preferentemente el login por dispositivo (`npx wrangler login --device`, admitido por la versión fijada en `api/package.json`). Evita el callback OAuth a `localhost:8976`, que desde el contenedor puede no llegar al navegador de Windows.
- **EAS**: `eas login --device` (flujo de dispositivo). Cuando corresponda, `--resume` retoma una solicitud de login pendiente por su ID y `--match` envía el número que muestra el navegador; forma no interactiva: `eas login --device --non-interactive --resume REQUEST_ID --match NUMERO` (ver `eas login --help`).
- **Claude Code**: las sesiones pueden requerir una nueva autenticación después de reconstruir.
- **GitHub**: acceso por HTTPS con las credenciales que gestione VS Code.

No se montan credenciales de Windows dentro del contenedor (`~/.wrangler`, `~/.expo`, `~/.claude`, `~/.ssh`, `~/.config` ni similares) y no se crean volúmenes para guardarlas. Reautenticar es preferible a compartir credenciales del anfitrión.

## Compilación Android

- **Flujo oficial: Expo + EAS** (EAS Build y EAS Submit en la nube). Ver docs/006-DESPLIEGUE.md y docs/004-ROADMAP-PROYECTO.md.
- **Android Studio es solo un Plan B** (compilación local en Windows si EAS no está disponible). No forma parte del Dev Container.

## Puertos

| Puerto | Uso      |
| ------ | -------- |
| 8787   | Wrangler |
| 8081   | Metro    |

Se reenvían con `forwardPorts` en modo `silent`. Se espera que el reenvío exponga los puertos solo en `localhost` del host (no verificado); no se configuran puertos públicos.

## Validación manual dentro del contenedor

```
npm ci
npm run lint
npm run typecheck
npm test
npm run build --workspace api
npm run build --workspace controlgastos-app
eas --version
```

## Expo Go en dispositivo Android físico

Opción inicial recomendada: ejecutar Metro en Windows (fuera del contenedor) para que el teléfono llegue directamente a la IP LAN del PC. El contenedor se usa para lint, typecheck, pruebas y builds.

Alternativas dentro del contenedor (no probadas):

- Definir `REACT_NATIVE_PACKAGER_HOSTNAME` con la IP LAN del host, publicar el 8081 hacia la red y permitirlo en el firewall de Windows.
- Limitaciones: dentro del contenedor la IP es interna (172.x) y el reenvío de VS Code escucha solo en `localhost`, por lo que el teléfono no la alcanza sin lo anterior.

Expo ofrece un túnel (`--tunnel`), pero no se configura ni se recomienda por ahora.

## Validaciones pendientes

Validado en Windows 11 + WSL 2 + Docker Desktop: arranque con la imagen indicada, volúmenes y permisos, `npm ci`, typecheck y pruebas de API y app, y la reautenticación de Wrangler (`--device`) y EAS.

Pendiente de verificar:

- Reconstrucción del contenedor con la instalación automática de EAS CLI en `postCreateCommand`.
- Acceso desde el host a Wrangler y Metro por los puertos reenviados.
- Expo Go contra Metro (en Windows y, si se intenta, desde el contenedor).
- Alternativa "Clone Repository in Container Volume".

## Riesgos

- La etiqueta de la imagen (`1-22-bookworm`) es flotante: puede cambiar con el tiempo. Fijar un digest queda como mejora futura.
- CI usa `actions/setup-node` y no comparte imagen con el Dev Container; pueden aparecer diferencias entre ambos entornos.
- `npm install -g eas-cli@25.3.0` fija la versión de EAS CLI pero no sus dependencias transitivas (no usa `package-lock.json`): dos reconstrucciones pueden resolver árboles distintos. `app/eas.json` exige además `cli.version >= 24.13.0`; ambos criterios deben mantenerse coherentes.
- Si la imagen cambia el prefijo npm global del usuario `node`, la instalación de EAS CLI podría fallar; la comprobación final de versión lo haría visible al crear el contenedor.
