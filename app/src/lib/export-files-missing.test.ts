import { clearExports, shareExport } from './export-files';

// APK sin módulos nativos: cargarlos falla y la app no debe romperse.
jest.mock('expo-file-system', () => {
  throw new Error('Cannot find native module');
});
jest.mock('expo-sharing', () => {
  throw new Error('Cannot find native module');
});

describe('módulos nativos ausentes', () => {
  it('clearExports no lanza', () => {
    expect(() => clearExports()).not.toThrow();
  });

  it('shareExport rechaza con EXPORT_UNAVAILABLE', async () => {
    await expect(
      shareExport({ bytes: new Uint8Array([1]), name: 'a.csv', mimeType: 'text/csv' }),
    ).rejects.toMatchObject({ code: 'EXPORT_UNAVAILABLE' });
  });
});
