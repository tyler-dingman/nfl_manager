import { seal, unseal } from './mail';
import { utf8, decode } from './core';
import { encodeObject, decodeObject } from './codec';
import { digest } from './core';
/** Compress directory plaintext before randomized authenticated encryption.
 * Original Phase 3 encrypted chunks remain readable. */
export async function sealDirectory(value: unknown, secret: string) {
  const bytes = utf8.encode(JSON.stringify(value)),
    encoded = await encodeObject(bytes);
  if (encoded === bytes) return seal(value, secret);
  let binary = '';
  for (let i = 0; i < encoded.length; i += 8192)
    binary += String.fromCharCode(...encoded.subarray(i, i + 8192));
  return seal(
    { $checkpointCodec: 'gzip-v1', hash: await digest(bytes), bytes: btoa(binary) },
    secret,
  );
}
export async function unsealDirectory<T>(value: any, secret: string): Promise<T> {
  const result = await unseal<any>(value, secret);
  if (result?.$checkpointCodec !== 'gzip-v1') return result as T;
  const binary = atob(result.bytes),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(decode.decode(await decodeObject(bytes, result.hash))) as T;
}
