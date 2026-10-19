import { digest } from './core';
const LIMIT = 4_000_000;
/** Physical gzip is optional; the SHA-256 identity always covers original bytes.
 * Readers retain compatibility with all uncompressed Phase 3 objects. */
async function collect(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error('Decoded application object limit');
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function encodeObject(bytes: Uint8Array) {
  if (bytes.length > LIMIT) throw Error('Application object limit');
  if (bytes.length < 1024) return bytes;
  const stream = new Blob([bytes.slice().buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressed = await collect(stream, LIMIT + 65_536);
  return compressed.length < bytes.length * 0.9 ? compressed : bytes;
}
export async function decodeObject(bytes: Uint8Array, hash: string) {
  if (bytes.length > LIMIT) throw Error('Application object limit');
  if ((await digest(bytes)) === hash) return bytes;
  if (bytes[0] !== 31 || bytes[1] !== 139) throw Error('Application object integrity failure');
  const decoded = await collect(
    new Blob([bytes.slice().buffer as ArrayBuffer])
      .stream()
      .pipeThrough(new DecompressionStream('gzip')),
    LIMIT,
  );
  if ((await digest(decoded)) !== hash) throw Error('Decoded application object integrity failure');
  return decoded;
}
