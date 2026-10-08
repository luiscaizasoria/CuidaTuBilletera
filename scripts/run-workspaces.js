// Ejecuta un script de npm en los workspaces que ya tengan proyecto.
// Mientras api/ y app/ no tengan package.json, avisa y termina sin error
// (no hay nada que verificar). Si hay proyectos, cualquier fallo se propaga.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = process.argv[2];
const hasProject = ['api', 'app'].some((dir) => existsSync(`${dir}/package.json`));

if (!hasProject) {
  console.log(`Aviso: aún no hay proyectos en api/ ni app/; "${script}" no verificó nada.`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', script, '--workspaces', '--if-present'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
