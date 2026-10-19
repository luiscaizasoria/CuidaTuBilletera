import type { GuideStorage } from './lib/guides';

// Almacén de guías en memoria: registra lecturas y escrituras y permite fallos y compuertas.
export function memoryGuideStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const writes: { key: string; value: string }[] = [];
  const reads: string[] = [];
  let failRead = 0;
  let failWrite = false;
  let readGate: Promise<void> | null = null;

  const storage: GuideStorage = {
    async read(key) {
      reads.push(key);
      if (readGate) await readGate;
      if (failRead > 0) {
        failRead -= 1;
        throw new Error('fallo nativo simulado');
      }
      return data.get(key) ?? null;
    },
    async write(key, value) {
      if (failWrite) throw new Error('fallo nativo simulado');
      writes.push({ key, value });
      data.set(key, value);
    },
  };

  return Object.assign(storage, {
    data,
    writes,
    reads,
    // true/false = siempre/nunca; un número = esas próximas lecturas fallan.
    setFailRead: (value: boolean | number) => {
      failRead = value === true ? Number.POSITIVE_INFINITY : value === false ? 0 : value;
    },
    setFailWrite: (value: boolean) => {
      failWrite = value;
    },
    // Retiene las lecturas hasta llamar a la función devuelta.
    holdReads: () => {
      let release!: () => void;
      readGate = new Promise<void>((resolve) => {
        release = () => {
          readGate = null;
          resolve();
        };
      });
      return release;
    },
  });
}

export const guideRecord = (...ids: string[]) => JSON.stringify({ v: 1, vistas: ids });
