import { BlobPacks } from '../src/blob-packs';
import { retireSyntheticBlobBodies } from '../test/synthetic-blob-retire';
import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { harness } from '../test/harness';
import { candidate, source, story, video, NOW } from '../test/fixtures';
import { TEAM_IDS } from '../src/teams';
import { ColdRecords } from '../src/archive';
import { EditorialR2Archive, LocalR2Objects } from '../src/r2-archive';
import { retireSyntheticCopies } from '../test/synthetic-retire';
import { recordRun } from '../src/metrics';
// Deterministic, unique synthetic vocabulary. No fetched articles or production records.
function sourceText(seed: number, entropy = false) {
  let state = seed + 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  let text = '';
  const words = [
    'team',
    'quarterback',
    'report',
    'practice',
    'coverage',
    'defense',
    'offense',
    'drive',
    'coach',
    'confirmed',
    'season',
    'injury',
    'roster',
    'field',
    'analysis',
    'Sunday',
    'snap',
    'route',
    'block',
    'pressure',
    'tackle',
    'contract',
    'update',
    'evidence',
    'game',
    'player',
    'pass',
    'training',
    'film',
    'source',
    'yard',
    'depth',
  ];
  while (text.length < 8192)
    text += entropy ? next().toString(36) : `${words[(next() >>> 16) & 31]} `;
  return text.slice(0, 8192);
}
const results: Record<string, any> = {};
for (const mode of ['compact', 'entropy'] as const) {
  const h = await harness(true, true),
    cold = new ColdRecords(h.db),
    calls: Record<string, any[]> = {};
  // ColdRecords installs a compact decoder, but inline writer flag remains unchanged.
  const measure = async (label: string, fn: () => Promise<unknown>) => {
    const start = h.db.measurements.length,
      wall = performance.now(),
      cpu = process.cpuUsage();
    await fn();
    const m = h.db.measurements.slice(start),
      usage = process.cpuUsage(cpu);
    (calls[label] ??= []).push({
      statements: m.reduce((s, x) => s + x.statements, 0),
      read: m.reduce((s, x) => s + x.rowsRead, 0),
      written: m.reduce((s, x) => s + x.rowsWritten, 0),
      wallMs: performance.now() - wall,
      hostCpuMs: (usage.user + usage.system) / 1000,
    });
  };
  try {
    for (const t of TEAM_IDS) await h.repo.upsertSource(source(`src-${t}`, t));
    await h.repo.upsertSource(source('source-1', null));
    // Full modeled day, with 10% candidate corrections, 10KB editions and a separate 12KB story sensitivity.
    for (let i = 0; i < 200; i++) {
      const t = TEAM_IDS[i % 32],
        c = { ...candidate(`c-${i}`, 'source-1', t), rawText: sourceText(i, mode === 'entropy') };
      await measure('candidate', () => h.repo.insertCandidate(c));
      if (i % 10 === 0)
        await measure('revision', () =>
          h.repo.insertCandidate({
            ...c,
            rawText: c.rawText + ' Correction with original evidence preserved.',
            fingerprint: `revision-${i}`,
          }),
        );
      if (i < 80) {
        const s = {
          ...story(`s-${i}`, t),
          summary: false ? sourceText(10000 + i).slice(0, 4000) : 'Synthetic summary.',
          claims: [
            {
              text: false ? sourceText(20000 + i) : 'Synthetic verified claim',
              qualifier: null,
            },
          ],
        };
        await measure('story', () => h.repo.createStory(s));
        await measure('evidence', () =>
          h.repo.associateEvidence({
            id: `e-${i}`,
            storyId: s.id,
            candidateId: c.id,
            sourceId: 'source-1',
            firstSeenAt: NOW,
          }),
        );
        await measure('publish', () =>
          h.repo.publishStory({ ...s, version: 2, publicationState: 'PUBLISHED' }, 1, {
            decision: { allowed: true },
            card: { title: s.headline },
            evidenceIds: [`e-${i}`],
            eventId: `event-${i}`,
          }),
        );
      }
    }
    for (let i = 0; i < 40; i++)
      await measure('video', () =>
        h.repo.upsertVideo({
          ...video(`v-${i}`, [TEAM_IDS[i % 32], TEAM_IDS[(i + 1) % 32]]),
          description: sourceText(30000 + i, mode === 'entropy').slice(0, 1000),
        }),
      );
    // Three published stories per team are needed by editions. Reuse the national trio.
    for (let i = 0; i < 3; i++) {
      const s = story(`national-${i}`, null);
      await h.repo.createStory(s);
      await h.repo.associateEvidence({
        id: `en-${i}`,
        storyId: s.id,
        candidateId: `c-${i}`,
        sourceId: 'source-1',
        firstSeenAt: NOW,
      });
      await h.repo.publishStory({ ...s, version: 2, publicationState: 'PUBLISHED' }, 1, {
        decision: { allowed: true },
        card: { title: s.headline },
        evidenceIds: [`en-${i}`],
        eventId: `event-n-${i}`,
      });
    }
    for (const [i, t] of TEAM_IDS.entries())
      await measure('edition', () =>
        h.repo.saveEdition({
          id: `edition-${t}`,
          teamId: t,
          briefingDate: '2027-01-15',
          status: 'PUBLISHED',
          generatedAt: NOW,
          sourceFingerprint: `fp-${t}`,
          items: [0, 1, 2].map((x) => ({
            storyId: `national-${x}`,
            summary: sourceText(40000 + i * 3 + x, mode === 'entropy').slice(0, 3300),
          })),
        }),
      );
    for (let i = 0; i < 1040; i++)
      await measure('check', () =>
        h.repo.recordSourceCheck({
          id: `check-${i}`,
          sourceId: `src-${TEAM_IDS[i % 32]}`,
          attemptedAt: NOW + i,
          successful: i % 20 !== 0,
          nextCheckAt: NOW + 3600000,
          etag: `etag-${i}`,
          cursor: { lastId: i },
        }),
      );
    // Candidate commits already enqueue 220 jobs. Total daily jobs = 1400.
    for (let i = 0; i < 1180; i++)
      await measure('enqueue', () =>
        h.jobs.enqueue({
          id: `job-${i}`,
          jobType: 'SYNTHETIC',
          idempotencyKey: `once-${i}`,
          availableAt: NOW,
          ownerEpoch: 1,
          payload: {
            synthetic: true,
            sourceId: `src-${TEAM_IDS[i % 32]}`,
            checkpoint: i,
            retained: 'Exact historical job metadata. '.repeat(8),
          },
        }),
      );
    for (let i = 0; i < 1400; i++) {
      const job = await h.jobs.claim(NOW + 10000, 30000);
      if (job) await measure('complete', () => h.jobs.complete(job, NOW + 10001));
    }
    await h.binding
      .prepare('UPDATE content_outbox SET acknowledged_at=?')
      .bind(NOW + 10002)
      .run();
    for (let i = 0; i < 32; i++)
      await recordRun(h.db, {
        id: `run-${i}`,
        kind: 'SYNTHETIC',
        occurredAt: NOW,
        metrics: { retained: 'Synthetic execution metrics. '.repeat(10) },
      });
    if (true)
      for (const kind of ['job', 'check', 'outbox'] as const) {
        let n = 1;
        while (n)
          await measure(`compact.${kind}`, async () => {
            n = await cold.compact(kind, NOW + 20000);
          });
      }
    for (const t of TEAM_IDS) await measure('read.feed', () => h.repo.storiesForTeam(t, 20));
    for (let i = 0; i < 20; i++)
      await measure('read.history', () => h.repo.candidateRevision(`c-${i}`, 1));

    const audit = async () => {
      const dir = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
      for (const file of await readdir(dir))
        if (file.endsWith('.sqlite') && !file.includes('metadata')) {
          const x = JSON.parse(
            execFileSync('python3', ['scripts/sqlite-pages.py', join(dir, file)], {
              encoding: 'utf8',
            }),
          );
          if (x.objects.some((o: any) => o.name === 'content_candidates')) return x;
        }
      throw Error('Missing synthetic SQLite');
    };
    const baselineMeters = h.db.measurements.reduce(
      (n, x) => ({
        read: n.read + x.rowsRead,
        written: n.written + x.rowsWritten,
        statements: n.statements + x.statements,
      }),
      { read: 0, written: 0, statements: 0 },
    );
    const before = await audit();
    const objects = new LocalR2Objects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    );
    const archive = new EditorialR2Archive(h.db, objects);
    const baseMeters = h.db.measurements.length,
      cpu = process.cpuUsage(),
      start = performance.now();
    // Exact prior workload: NEW candidates and current editions remain hot.
    for (const kind of (process.argv.includes('--record-archive')
      ? ['revision', 'version', 'operations', 'edition', 'candidate']
      : []) as ('revision' | 'version' | 'operations' | 'edition' | 'candidate')[]) {
      const cutoff = kind === 'operations' ? Math.floor(NOW / 86400000) + 1 : NOW + 30000;
      while (await archive.archive(kind, cutoff, NOW + 40 * 86400000, 7 * 86400000)) {}
    }
    const withRecovery = await audit();
    const retired = process.argv.includes('--record-archive')
      ? await retireSyntheticCopies(h, archive, NOW + 48 * 86400000, 'DISPOSABLE_SYNTHETIC_ONLY')
      : { verifiedManifests: 0, removedUnreferencedBlobs: 0 };
    const legacyAfter = await audit();
    const packStart = h.db.measurements.length,
      packReadStart = objects.reads,
      packWriteStart = objects.writes;
    const packCpu = process.cpuUsage(),
      packWall = performance.now();
    const packs = new BlobPacks(h.db, objects);
    while (await packs.copyBatch()) {}
    const copied = await audit();
    const retiredBodies = await retireSyntheticBlobBodies(h, packs);
    const after = await audit();
    if (!process.argv.includes('--record-archive')) {
      if (after.ownedBytes >= before.ownedBytes)
        throw Error('Storage regression: packed fixture did not reduce owned pages');
      for (const original of before.objects.filter(
        (o: any) =>
          o.type === 'table' &&
          !['editorial_blob_fragments', 'editorial_blob_packs'].includes(o.name),
      )) {
        const current = after.objects.find((o: any) => o.name === original.name);
        if (current?.rows !== original.rows)
          throw Error(`Identity/record count changed: ${original.name}`);
      }
    }
    const packUsage = process.cpuUsage(packCpu);
    const packLocations = await h.db.query<any>(
      'benchmark.pack.locations',
      'SELECT p.pack_hash,sum(b.encoded_length) bytes,count(*) members FROM editorial_blobs b JOIN editorial_blob_packs p ON p.id=b.pack_id GROUP BY p.pack_hash',
      [],
      false,
    );
    const optimization = {
      legacyAfter,
      copied,
      retiredBodies,
      packBytes: packLocations.reduce((n, p) => n + p.bytes, 0),
      packs: packLocations.length,
      reads: objects.reads - packReadStart,
      writes: objects.writes - packWriteStart,
      rowsRead: h.db.measurements.slice(packStart).reduce((n, x) => n + x.rowsRead, 0),
      rowsWritten: h.db.measurements.slice(packStart).reduce((n, x) => n + x.rowsWritten, 0),
      wallMs: performance.now() - packWall,
      hostCpuMs: (packUsage.user + packUsage.system) / 1000,
    };
    const archiveMeters = h.db.measurements.slice(baseMeters),
      usage = process.cpuUsage(cpu);
    const archiveWallMs = performance.now() - start,
      archiveReads = objects.reads,
      archiveWrites = objects.writes;
    const manifests = await h.db.query<any>(
      'benchmark.manifests',
      "SELECT * FROM r2_archive_manifests WHERE state='ACTIVE'",
      [],
      false,
    );
    const latencies: number[] = [];
    const retrievalMeter = h.db.measurements.length,
      readStart = objects.reads;
    for (let repeat = 0; repeat < 5; repeat++) {
      const t = performance.now();
      const value = await h.repo.candidateRevision('c-100', 1);
      if (!value?.rawText) throw Error('Missing source history');
      latencies.push(performance.now() - t);
    }
    const readMeters = h.db.measurements.slice(retrievalMeter);
    const retrievalObjectReads = objects.reads - readStart;
    let restore: any = null;
    if (manifests[0]) {
      const t = performance.now(),
        restoreMeter = h.db.measurements.length,
        restoreReads = objects.reads,
        first = manifests[0];
      await archive.restore(first.id);
      restore = {
        records: first.record_count,
        wallMs: performance.now() - t,
        objectReads: objects.reads - restoreReads,
        rowsRead: h.db.measurements.slice(restoreMeter).reduce((n, x) => n + x.rowsRead, 0),
        rowsWritten: h.db.measurements.slice(restoreMeter).reduce((n, x) => n + x.rowsWritten, 0),
      };
    }
    results[mode] = {
      baselineMeters,
      optimization,
      before,
      withRecovery,
      after,
      retired,
      archival: {
        packs: manifests.length,
        objectBytes: manifests.reduce((n: any, m: any) => n + m.object_bytes, 0),
        rawBytes: manifests.reduce((n: any, m: any) => n + m.raw_bytes, 0),
        objectWrites: archiveWrites,
        objectReads: archiveReads,
        hostCpuMs: (usage.user + usage.system) / 1000,
        wallMs: archiveWallMs,
        rowsRead: archiveMeters.reduce((n, x) => n + x.rowsRead, 0),
        rowsWritten: archiveMeters.reduce((n, x) => n + x.rowsWritten, 0),
      },
      retrieval: {
        latencyMs: latencies,
        objectReads: retrievalObjectReads,
        rowsRead: readMeters.reduce((n, x) => n + x.rowsRead, 0),
        rowsWritten: readMeters.reduce((n, x) => n + x.rowsWritten, 0),
      },
      restore,
    };
    console.log(
      mode,
      JSON.stringify({
        before: before.sqliteBytes,
        after: after.sqliteBytes,
        ownedBefore: before.ownedBytes,
        ownedAfter: after.ownedBytes,
        packs: manifests.length,
      }),
    );
  } finally {
    await h.close();
  }
}
const output = {
  scope:
    'Shared immutable blob-pack experiment; optional --record-archive comparison. Same full-day workload as storage POC. Compact and entropy sensitivities. Age eligibility simulated explicitly; NEW candidates/current editions/current stories stay hot. Private R2 objects contain expanded exact historical records. Recovery copies removed only in disposable synthetic DB after seven days. Physical coherent SQLite snapshot audit; no VACUUM. Host CPU is not Worker CPU; all timings local.',
  results,
};
await writeFile(
  process.argv.includes('--record-archive')
    ? 'measurements/storage-record-archive-benchmark.json'
    : 'measurements/storage-final-benchmark.json',
  JSON.stringify(output, null, 2) + '\n',
);
