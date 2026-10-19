/** Local owner-maintenance tool. No remote mode, credentials or deployment. */
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import step from '../packages/storage/maintenance-step.ts';
const { maintenanceStep } = step;
import retention from '../packages/storage/derived-retention.ts';
const { expireSupersededScores } = retention;
import core from '../packages/storage/core.ts';
import objects from '../packages/storage/d1-objects.ts';
const { Storage } = core;
const { D1Objects } = objects;
import repack from '../packages/storage/repack.ts';
const { repackLegacyPayload } = repack;
import { resolve } from 'node:path';
import gc from '../packages/storage/garbage-collection.ts';
const { collectPayloadGarbage, storageCapacity } = gc;
const [directory, mode = '--dry-run', count = '5'] = process.argv.slice(2);
if (
  !directory ||
  ![
    '--dry-run',
    '--apply',
    '--repack-binary',
    '--repack-base64',
    '--prepare',
    '--step',
    '--expire-scores',
  ].includes(mode) ||
  process.env.DD_STORAGE_MAINTENANCE !== 'RAW_WRITERS_STOPPED'
)
  throw Error(
    'Stop ALL local writers, then DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --dry-run|--apply',
  );
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: 'export default {}',
    resourcePersistencePath: resolve(directory, 'v3'),
    d1Databases: { APP_DB: '00000000-0000-0000-0000-000000000000' },
  }),
);
try {
  const db = await mf.getD1Database('APP_DB');
  const before = await storageCapacity(db);
  const result =
    mode === '--step'
      ? await maintenanceStep(db, count, 'OWNER_PRIVATE_MAINTENANCE')
      : mode === '--expire-scores'
        ? await expireSupersededScores(new Storage(db, new D1Objects(db)), Number(count))
        : mode.startsWith('--repack')
          ? await repackLegacyPayload(
              db,
              count,
              'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
              mode === '--repack-base64' ? 'base64' : 'binary',
            )
          : await collectPayloadGarbage(db, {
              dryRun: mode !== '--apply' && mode !== '--prepare',
              prepareOnly: mode === '--prepare',
              limit: Number(count),
              expireDerived: true,
              acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
            });
  console.log(JSON.stringify({ before, result, after: await storageCapacity(db) }, null, 2));
} finally {
  await mf.dispose();
}
