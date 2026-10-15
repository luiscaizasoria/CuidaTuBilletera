import { clearExports, ExportFileError, shareExport } from './export-files';

// Registro ordenado de las operaciones nativas simuladas.
const calls: string[] = [];
const state = {
  dirExists: true,
  sharingAvailable: true,
  failOn: null as null | 'dirCreate' | 'fileCreate' | 'write' | 'delete',
  shareError: null as unknown,
  written: null as Uint8Array | null,
};

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return state.dirExists;
    }
    create(options: unknown) {
      calls.push(`dir.create ${JSON.stringify(options)}`);
      if (state.failOn === 'dirCreate') throw new Error('x');
    }
    delete() {
      calls.push('dir.delete');
      if (state.failOn === 'delete') throw new Error('x');
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    create(options: unknown) {
      calls.push(`file.create ${JSON.stringify(options)}`);
      if (state.failOn === 'fileCreate') throw new Error('x');
    }
    write(content: Uint8Array) {
      calls.push('file.write');
      if (state.failOn === 'write') throw new Error('x');
      state.written = content;
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => {
    calls.push('sharing.isAvailable');
    return state.sharingAvailable;
  },
  shareAsync: async (uri: string, options: unknown) => {
    calls.push(`sharing.share ${uri} ${JSON.stringify(options)}`);
    if (state.shareError) throw state.shareError;
  },
}));

const input = {
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  name: 'movimientos_2026-10-01_2026-10-31.pdf',
  mimeType: 'application/pdf',
};

beforeEach(() => {
  calls.length = 0;
  state.dirExists = true;
  state.sharingAvailable = true;
  state.failOn = null;
  state.shareError = null;
  state.written = null;
});

describe('shareExport', () => {
  it('orden: disponible, limpiar, crear, escribir bytes y compartir; no borra después', async () => {
    await shareExport(input);
    expect(calls).toEqual([
      'sharing.isAvailable',
      'dir.delete',
      'dir.create {"intermediates":true,"idempotent":true}',
      'file.create {"overwrite":true}',
      'file.write',
      'sharing.share file:///cache/exports/movimientos_2026-10-01_2026-10-31.pdf {"mimeType":"application/pdf","dialogTitle":"movimientos_2026-10-01_2026-10-31.pdf"}',
    ]);
    expect(state.written).toBe(input.bytes);
    expect(calls[calls.length - 1]).not.toBe('dir.delete');
  });

  it('usa el mimeType recibido (CSV)', async () => {
    await shareExport({ ...input, name: 'a.csv', mimeType: 'text/csv' });
    expect(calls.at(-1)).toContain('"mimeType":"text/csv"');
  });

  it('sin compartir disponible: EXPORT_UNAVAILABLE y no escribe', async () => {
    state.sharingAvailable = false;
    await expect(shareExport(input)).rejects.toMatchObject({ code: 'EXPORT_UNAVAILABLE' });
    expect(calls).toEqual(['sharing.isAvailable']);
  });

  it.each(['dirCreate', 'fileCreate', 'write'] as const)(
    'fallo de escritura (%s): EXPORT_WRITE_FAILED y no comparte',
    async (failOn) => {
      state.failOn = failOn;
      const error = await shareExport(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ExportFileError);
      expect(error).toMatchObject({ code: 'EXPORT_WRITE_FAILED' });
      expect(calls.some((c) => c.startsWith('sharing.share'))).toBe(false);
    },
  );

  it('un fallo al limpiar no impide exportar', async () => {
    state.failOn = 'delete';
    await expect(shareExport(input)).resolves.toBeUndefined();
    expect(calls.some((c) => c.startsWith('sharing.share'))).toBe(true);
  });

  it('UnavailabilityError al compartir se traduce a EXPORT_UNAVAILABLE', async () => {
    state.shareError = Object.assign(new Error('x'), { code: 'ERR_UNAVAILABLE' });
    await expect(shareExport(input)).rejects.toMatchObject({ code: 'EXPORT_UNAVAILABLE' });
  });

  it('otro error de compartir se propaga tal cual', async () => {
    const boom = new Error('SharingInProgress');
    state.shareError = boom;
    await expect(shareExport(input)).rejects.toBe(boom);
  });
});

describe('clearExports', () => {
  it('borra la carpeta si existe', () => {
    clearExports();
    expect(calls).toEqual(['dir.delete']);
  });

  it('no hace nada si no existe y nunca lanza', () => {
    state.dirExists = false;
    clearExports();
    expect(calls).toEqual([]);
    state.dirExists = true;
    state.failOn = 'delete';
    expect(() => clearExports()).not.toThrow();
  });
});
