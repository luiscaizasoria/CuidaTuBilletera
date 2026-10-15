import { ApiError } from './errors';

// Límite preventivo del cuerpo JSON de /auth/*: el mayor campo aceptado es idToken (8192
// caracteres) y 16 KiB deja margen holgado para el envoltorio JSON y secuencias de escape.
export const MAX_JSON_BODY_BYTES = 16 * 1024;

const payloadTooLarge = () =>
  new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande.');

// Lee y parsea el cuerpo JSON sin superar MAX_JSON_BODY_BYTES. Devuelve undefined si el cuerpo
// falta o no es JSON válido (la ruta lo trata como INVALID_REQUEST) y lanza 413 si lo excede.
// No confía en Content-Length: lo usa solo para rechazar pronto y, aun así, cuenta los bytes
// reales del stream, que se cancela al excederse sin acumular el cuerpo completo.
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    // Se cancela el stream sin leerlo; si falla, no importa: la respuesta es la misma.
    await request.body?.cancel().catch(() => undefined);
    throw payloadTooLarge();
  }
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw payloadTooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return undefined; // Error de lectura del stream: se trata como cuerpo inválido.
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}
