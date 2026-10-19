import { DATABASE_OWNERS, MAPPING_VERSION, type DatabaseOwner } from './multi-d1';
import { digest, utf8 } from './core';
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
export interface MultiD1Archive {
  schema: 1;
  manifest: Sealed;
  shards: Partial<Record<DatabaseOwner, Sealed>>;
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
    shards[owner] = await sealDirectory(value, secret, 'binary-v2');
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
    const value = await unsealDirectory<ShardExport>(sealed, secret);
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
