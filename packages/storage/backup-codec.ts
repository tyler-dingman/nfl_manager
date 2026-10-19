import { seal, unsealBytes, sealBytes } from './mail';
import { utf8, decode } from './core';
import { encodeObject, decodeObject } from './codec';
import { digest } from './core';
/** Compress directory plaintext before randomized authenticated encryption.
 * Original Phase 3 encrypted chunks remain readable. */
export type DirectoryFormat = 'legacy' | 'binary-v2';
const MAGIC = utf8.encode('DDDIR2\n');
export async function sealDirectory(
  value: unknown,
  secret: string,
  format: DirectoryFormat = 'legacy',
) {
  const bytes = utf8.encode(JSON.stringify(value)),
    encoded = await encodeObject(bytes);
  if (encoded === bytes) return seal(value, secret);
  if (format === 'binary-v2') {
    const hash = await digest(bytes);
    const framed = new Uint8Array(MAGIC.length + 32 + encoded.length);
    framed.set(MAGIC);
    framed.set(
      Uint8Array.from(hash.match(/../g)!, (x) => parseInt(x, 16)),
      MAGIC.length,
    );
    framed.set(encoded, MAGIC.length + 32);
    return sealBytes(framed, secret);
  }
  let binary = '';
  for (let i = 0; i < encoded.length; i += 8192)
    binary += String.fromCharCode(...encoded.subarray(i, i + 8192));
  return seal(
    { $checkpointCodec: 'gzip-v1', hash: await digest(bytes), bytes: btoa(binary) },
    secret,
  );
}
export async function unsealDirectory<T>(value: any, secret: string): Promise<T> {
  const plain = await unsealBytes(value, secret);
  if (MAGIC.every((b, i) => plain[i] === b)) {
    if (plain.length <= MAGIC.length + 32) throw Error('Truncated directory');
    const hash = Array.from(plain.subarray(MAGIC.length, MAGIC.length + 32), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    return JSON.parse(
      decode.decode(await decodeObject(plain.subarray(MAGIC.length + 32), hash)),
    ) as T;
  }
  const result = JSON.parse(decode.decode(plain));
  if (result?.$checkpointCodec !== 'gzip-v1') return result as T;
  const binary = atob(result.bytes),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(decode.decode(await decodeObject(bytes, result.hash))) as T;
}
