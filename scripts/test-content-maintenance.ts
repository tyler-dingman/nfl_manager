import { harness } from '../workers/content-engine/test/harness';
import { Storage } from '../packages/storage/core';
import { D1Objects } from '../packages/storage/d1-objects';
import { replayMaintenance } from './content-maintenance-replay';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
async function main() {
  const h = await harness(false, true, 999, undefined, false);
  const baseline = process.env.DD_MAINTENANCE_BASELINE === 'true';
  const files = {
    retention: resolve(`packages/storage/.maintenance-baseline-${process.pid}.ts`),
    export: resolve(`scripts/.maintenance-baseline-${process.pid}.mjs`),
  };
  try {
    if (baseline) {
      await writeFile(
        files.retention,
        execFileSync('git', ['show', 'eb8af327:packages/storage/approved-retention.ts']),
        { flag: 'wx' },
      );
      await writeFile(
        files.export,
        execFileSync('git', ['show', 'eb8af327:scripts/export-no-billing.mjs']),
        { flag: 'wx' },
      );
    }
    const s = new Storage(h.binding as any, new D1Objects(h.binding as any));
    await s.put({ schema: 1, synthetic: 'verified unreferenced test object' });
    for (let batch = 0; batch < 4; batch++)
      await h.binding
        .prepare(
          "INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,status,available_at,created_at,updated_at) SELECT value,'SYNTHETIC',value,'{}','COMPLETED',1,1,1 FROM json_each(?)",
        )
        .bind(
          JSON.stringify(
            Array.from(
              { length: 500 },
              (_, i) => 'job-' + (batch * 500 + i).toString().padStart(6, '0'),
            ),
          ),
        )
        .run();
    const referenceHash = await s.put({ schema: 1, required: 'Composite cursor reference' });
    for (const namespace of ['cursor-a', 'cursor-b'])
      await h.binding
        .prepare(
          "INSERT INTO app_reference_packs(namespace,id,subject,season,metadata_json,object_hash) SELECT ?,value,'subject',2026,'{}',? FROM json_each(?)",
        )
        .bind(
          namespace,
          referenceHash,
          JSON.stringify(
            Array.from({ length: 150 }, (_, i) => 'key-' + i.toString().padStart(4, '0')),
          ),
        )
        .run();
    await h.binding
      .prepare(
        "INSERT INTO app_search(rowid,id,team_id,title,content,source_id,source_url) SELECT -1000+cast(value AS INTEGER),value,'KC','Original quote','Escaped quote and semicolon; retained','source','https://example.invalid' FROM json_each(?)",
      )
      .bind(JSON.stringify(Array.from({ length: 500 }, (_, i) => String(i))))
      .run();
    const result = await replayMaintenance(
      h.binding,
      Date.now(),
      h.directory,
      baseline ? files : undefined,
    );
    if (
      !result.restoreVerified ||
      result.gc.deletedObjects !== 1 ||
      (baseline ? result.preparation.rowsRead < 40000 : result.preparation.rowsRead > 40000)
    )
      throw Error('Maintenance qualification failed');
    await mkdir('reports/content-engine-capacity', { recursive: true });
    await writeFile(
      `reports/content-engine-capacity/maintenance${baseline ? '-baseline' : ''}-smoke.json`,
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log('Full encrypted export/restore comparison and verified GC passed');
  } finally {
    await h.close();
    if (baseline) {
      await unlink(files.retention).catch(() => {});
      await unlink(files.export).catch(() => {});
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
