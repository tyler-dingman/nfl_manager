import { DATABASE_OWNERS, MAPPING_VERSION, type DatabaseOwner } from './multi-d1';
import { digest, utf8, decode } from './core';
import { sealDirectory, unsealDirectory } from './backup-codec';

export interface ShardExport {
  owner: DatabaseOwner;
  mappingVersion: typeof MAPPING_VERSION;
  windowId: string;
  epoch: number;
  // Exporters supply a complete lossless snapshot, including schema, FTS rowids and BLOB framing.
  snapshot: unknown;
}
type Sealed = Awaited<ReturnType<typeof sealDirectory>>;
type ShardSealed = Sealed | { schema: 3; parts: Sealed[] };
export interface MultiD1Archive {
  schema: 1;
  manifest: Sealed;
  shards: Partial<Record<DatabaseOwner, ShardSealed>>;
}
interface Manifest {
  schema: 1;
  mappingVersion: typeof MAPPING_VERSION;
  windowId: string;
  consistency: 'coordinated-maintenance';
  databases: { owner: DatabaseOwner; digest: string; epoch: number }[];
}
function validateExport(value: ShardExport, owner: DatabaseOwner, windowId: string) {
  if (
    value.owner !== owner ||
    value.mappingVersion !== MAPPING_VERSION ||
    value.windowId !== windowId ||
    !Number.isSafeInteger(value.epoch) ||
    value.epoch < 0 ||
    value.snapshot === undefined
  )
    throw Error('Shard export identity mismatch');
}
/** Offline owner tool primitive, never an HTTP handler. The caller must stop ALL writers,
 * acquire every shard fence, export all shards, and keep those fences through verification.
 * This format does not establish a maintenance window or claim an atomic snapshot. */
export async function sealMultiD1Archive(exports: ShardExport[], secret: string, windowId: string) {
  if (!windowId || exports.length !== 10 || new Set(exports.map((x) => x.owner)).size !== 10)
    throw Error('Complete maintenance window required');
  const shards: MultiD1Archive['shards'] = {},
    databases: Manifest['databases'] = [];
  for (const owner of DATABASE_OWNERS) {
    const value = exports.find((x) => x.owner === owner);
    if (!value) throw Error('Missing shard');
    validateExport(value, owner, windowId);
    const hash = await digest(utf8.encode(JSON.stringify(value)));
    shards[owner] = await sealShard(value, secret);
    databases.push({ owner, digest: hash, epoch: value.epoch });
  }
  const manifest: Manifest = {
    schema: 1,
    mappingVersion: MAPPING_VERSION,
    windowId,
    consistency: 'coordinated-maintenance',
    databases,
  };
  return {
    schema: 1 as const,
    manifest: await sealDirectory(manifest, secret, 'binary-v2'),
    shards,
  };
}
/** Authenticate and validate ALL shards before a caller writes any restore destination.
 * Application-level reference reconciliation is an additional mandatory restore step. */
export async function openMultiD1Archive(archive: MultiD1Archive, secret: string) {
  if (archive.schema !== 1) throw Error('Unknown multi-D1 archive');
  const manifest = await unsealDirectory<Manifest>(archive.manifest, secret);
  if (
    manifest.schema !== 1 ||
    manifest.mappingVersion !== MAPPING_VERSION ||
    manifest.consistency !== 'coordinated-maintenance' ||
    !manifest.windowId ||
    !Array.isArray(manifest.databases) ||
    manifest.databases.length !== 10 ||
    new Set(manifest.databases.map((x) => x.owner)).size !== 10 ||
    Object.keys(archive.shards).length !== 10
  )
    throw Error('Invalid recovery manifest');
  const exports: ShardExport[] = [];
  for (const owner of DATABASE_OWNERS) {
    const entry = manifest.databases.find((x) => x.owner === owner),
      sealed = archive.shards[owner];
    if (!entry || !sealed) throw Error('Missing recovery shard');
    const value = await openShard(sealed, secret, owner, manifest.windowId);
    validateExport(value, owner, manifest.windowId);
    if (
      value.epoch !== entry.epoch ||
      (await digest(utf8.encode(JSON.stringify(value)))) !== entry.digest
    )
      throw Error('Recovery shard digest mismatch');
    exports.push(value);
  }
  return { manifest, exports };
}

/** Owner archives may exceed the application's 4 MB immutable object limit.
 * Authenticate independently bounded pieces, then verify the complete export digest.
 * No SQL is exposed or executed until every piece of every shard is verified. */
async function sealShard(value: ShardExport, secret: string): Promise<ShardSealed> {
  const bytes = utf8.encode(JSON.stringify(value));
  if (bytes.length <= 3_000_000) return sealDirectory(value, secret, 'binary-v2');
  if (bytes.length > 256_000_000)
    throw Error('Owner shard export exceeds reviewed 256 MB archive bound');
  const parts: Sealed[] = [],
    count = Math.ceil(bytes.length / 1_000_000);
  for (let index = 0; index < count; index++) {
    const chunk = bytes.subarray(index * 1_000_000, (index + 1) * 1_000_000);
    let binary = '';
    for (let i = 0; i < chunk.length; i += 8192)
      binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
    parts.push(
      await sealDirectory(
        { owner: value.owner, windowId: value.windowId, index, count, bytes: btoa(binary) },
        secret,
        'binary-v2',
      ),
    );
  }
  return { schema: 3, parts };
}
async function openShard(
  sealed: ShardSealed,
  secret: string,
  owner: DatabaseOwner,
  windowId: string,
): Promise<ShardExport> {
  if (sealed.schema !== 3) return unsealDirectory<ShardExport>(sealed, secret);
  if (!Array.isArray(sealed.parts) || sealed.parts.length < 1 || sealed.parts.length > 256)
    throw Error('Invalid archive part count');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (const [index, part] of sealed.parts.entries()) {
    const value = await unsealDirectory<any>(part, secret);
    if (
      value.owner !== owner ||
      value.windowId !== windowId ||
      value.index !== index ||
      value.count !== sealed.parts.length ||
      typeof value.bytes !== 'string' ||
      value.bytes.length > 1_333_336
    )
      throw Error('Archive part identity mismatch');
    const chunk = Uint8Array.from(atob(value.bytes), (c) => c.charCodeAt(0));
    if (
      chunk.length > 1_000_000 ||
      !chunk.length ||
      (index < sealed.parts.length - 1 && chunk.length !== 1_000_000)
    )
      throw Error('Archive part length mismatch');
    size += chunk.length;
    if (size > 256_000_000) throw Error('Owner archive size bound');
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(decode.decode(bytes));
}
