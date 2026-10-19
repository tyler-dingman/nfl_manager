import argon2 from './vendor/argon2.wasm';
import blake2b from './vendor/blake2b.wasm';
import { passwordEngine } from './implementation';
const engine = passwordEngine({ argon2, blake2b });
/** Internal service binding only; never attach a public route. No credentials/logging. */
export default {
  async fetch(request: Request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/password')
      return new Response(null, { status: 404 });
    const reader = request.body?.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 4096) {
          await reader.cancel();
          return new Response(null, { status: 413 });
        }
        parts.push(chunk.value);
      }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    try {
      const input = JSON.parse(new TextDecoder().decode(bytes));
      if (
        typeof input.password !== 'string' ||
        input.password.length < 1 ||
        input.password.length > 256 ||
        !['hash', 'verify'].includes(input.operation) ||
        (input.operation === 'verify' &&
          (typeof input.encoded !== 'string' || input.encoded.length > 512))
      )
        return new Response(null, { status: 400 });
      return Response.json(
        {
          result:
            input.operation === 'hash'
              ? await engine.hash(input.password)
              : await engine.verify(input.encoded, input.password),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error && error.message === 'Password worker busy'
              ? 'BUSY'
              : 'HASHING_UNAVAILABLE',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  },
};
