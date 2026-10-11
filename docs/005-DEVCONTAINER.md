# Dev Container

Entorno reproducible de desarrollo (Node 22 sobre Debian bookworm) definido en `.devcontainer/devcontainer.json`.

> Estado: configuración preparada, **NO validada**. Docker no está instalado en la máquina de desarrollo, por lo que nada de lo descrito aquí se ha ejecutado en un contenedor real. Ver "Validaciones pendientes".

## Abrir con VS Code

Requisitos: Docker Desktop (o motor compatible) y la extensión Dev Containers de VS Code.

1. Abrir la carpeta del repositorio en VS Code.
2. Ejecutar `Dev Containers: Reopen in Container`.
3. Esperar a que termine `postCreateCommand` (puede tardar por `npm ci`).

Alternativa: `Dev Containers: Clone Repository in Container Volume`. El código vive en un volumen Docker (mejor rendimiento de disco en Windows). En ese caso el `workspaceMount` bind de la configuración no aplica a la misma carpeta de Windows; esta alternativa tampoco se ha probado y puede requerir ajustar `workspaceMount`.

## Qué hace la configuración

- Imagen `mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm`, usuario `node` (sin privilegios; `sudo` solo se usa en el chown inicial).
- El repositorio se monta (bind) en `/workspaces/ControlGastos`, igual que `workspaceFolder`.
- Tres volúmenes nombrados, con `${devcontainerId}` para ser únicos por contenedor, cubren `node_modules` de la raíz, `api/` y `app/`. Así los binarios de Windows y Linux no se mezclan y la instalación es más rápida que sobre el bind.
- `postCreateCommand` (solo al crear el contenedor):
  `sudo chown node:node` sobre los 3 puntos de montaje (no recursivo, los volúmenes nuevos pertenecen a root) y después `npm ci`.
- Extensiones: ESLint, Prettier y EditorConfig; formato al guardar con Prettier.
- Sin servicios, secretos, `containerEnv`, red del host, modo privilegiado, Docker-in-Docker ni montaje de credenciales (por ejemplo `~/.wrangler`).

Nota: `node_modules` de Windows en el host queda oculto dentro del contenedor por los volúmenes; no se comparten.

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
```

## Expo Go en dispositivo Android físico

Opción inicial recomendada: ejecutar Metro en Windows (fuera del contenedor) para que el teléfono llegue directamente a la IP LAN del PC. El contenedor se usa para lint, typecheck, pruebas y builds.

Alternativas dentro del contenedor (no probadas):

- Definir `REACT_NATIVE_PACKAGER_HOSTNAME` con la IP LAN del host, publicar el 8081 hacia la red y permitirlo en el firewall de Windows.
- Limitaciones: dentro del contenedor la IP es interna (172.x) y el reenvío de VS Code escucha solo en `localhost`, por lo que el teléfono no la alcanza sin lo anterior.

Expo ofrece un túnel (`--tunnel`), pero no se configura ni se recomienda por ahora.

## Validaciones pendientes

Todo lo siguiente está **NO verificado** por ausencia de Docker:

- Arranque del contenedor con la imagen indicada.
- Volúmenes y permisos (chown de los 3 puntos de montaje).
- `npm ci` dentro del contenedor.
- Acceso desde el host a Wrangler y Metro por los puertos reenviados.
- Expo Go contra Metro (en Windows y, si se intenta, desde el contenedor).
- Alternativa "Clone Repository in Container Volume".

## Riesgos

- La etiqueta de la imagen (`1-22-bookworm`) es flotante: puede cambiar con el tiempo. Fijar un digest queda como mejora futura.
- CI usa `actions/setup-node` y no comparte imagen con el Dev Container; pueden aparecer diferencias entre ambos entornos.
- Configuración sin probar: puede requerir ajustes al primer uso real.
