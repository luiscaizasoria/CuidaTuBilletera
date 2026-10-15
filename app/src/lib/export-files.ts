// Único módulo que usa expo-file-system y expo-sharing (Fase 5). Los módulos se cargan de forma
// diferida y protegida: un APK sin el módulo nativo sigue funcionando y solo falla la exportación.
// El archivo vive en la caché de la app y se borra al iniciar la siguiente exportación, al abrir
// Reportes y al cerrar sesión; no se borra justo después de compartir porque la app receptora
// puede seguir leyéndolo.

export type ExportErrorCode = 'EXPORT_UNAVAILABLE' | 'EXPORT_WRITE_FAILED';

export class ExportFileError extends Error {
  constructor(readonly code: ExportErrorCode) {
    super(code);
    this.name = 'ExportFileError';
  }
}

export interface ShareExportInput {
  bytes: Uint8Array;
  name: string;
  mimeType: string;
}

const EXPORTS_DIRECTORY = 'exports';

type FileSystemModule = typeof import('expo-file-system');
type SharingModule = typeof import('expo-sharing');

function loadFileSystem(): FileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as FileSystemModule;
  } catch {
    return null;
  }
}

function loadSharing(): SharingModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sharing') as SharingModule;
  } catch {
    return null;
  }
}

// Borra la carpeta de exportaciones. Nunca lanza: es una limpieza de mejor esfuerzo.
export function clearExports(): void {
  try {
    const fs = loadFileSystem();
    if (!fs) return;
    const directory = new fs.Directory(fs.Paths.cache, EXPORTS_DIRECTORY);
    if (directory.exists) directory.delete();
  } catch {
    // sin módulo o sin permisos: no hay nada más que hacer
  }
}

// Escribe el archivo en la caché y abre el selector de aplicaciones de Android. No informa si el
// usuario completó o canceló el envío.
export async function shareExport({ bytes, name, mimeType }: ShareExportInput): Promise<void> {
  const fs = loadFileSystem();
  const sharing = loadSharing();
  if (!fs || !sharing) throw new ExportFileError('EXPORT_UNAVAILABLE');

  let available: boolean;
  try {
    available = await sharing.isAvailableAsync();
  } catch {
    available = false;
  }
  if (!available) throw new ExportFileError('EXPORT_UNAVAILABLE');

  clearExports();
  let uri: string;
  try {
    const directory = new fs.Directory(fs.Paths.cache, EXPORTS_DIRECTORY);
    directory.create({ intermediates: true, idempotent: true });
    const file = new fs.File(directory, name);
    file.create({ overwrite: true });
    file.write(bytes);
    uri = file.uri;
  } catch {
    throw new ExportFileError('EXPORT_WRITE_FAILED');
  }

  try {
    await sharing.shareAsync(uri, { mimeType, dialogTitle: name });
  } catch (error) {
    if (isUnavailability(error)) throw new ExportFileError('EXPORT_UNAVAILABLE');
    throw error;
  }
}

// UnavailabilityError de expo-modules-core (código ERR_UNAVAILABLE).
function isUnavailability(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ERR_UNAVAILABLE'
  );
}
