import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { harness } from '../test/harness';
import { candidate, source, story, video, NOW } from '../test/fixtures';
import { TEAM_IDS } from '../src/teams';
import { ColdRecords } from '../src/archive';
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
for (const mode of ['inline', 'compact', 'entropy', 'large-versions'] as const) {
  const h = await harness(true, mode !== 'inline'),
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
          summary:
            mode === 'large-versions' ? sourceText(10000 + i).slice(0, 4000) : 'Synthetic summary.',
          claims: [
            {
              text: mode === 'large-versions' ? sourceText(20000 + i) : 'Synthetic verified claim',
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
    if (mode !== 'inline')
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
    const counts: Record<string, unknown> = {};
    for (const { name } of (
      await h.binding
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
        )
        .all<{ name: string }>()
    ).results)
      counts[name] = await h.binding.prepare(`SELECT count(*) n FROM "${name}"`).first();
    const duplicates = await h.binding
      .prepare(
        'SELECT count(*) records,count(DISTINCT record_json) distinctPayloads,sum(length(record_json)) encodedBytes FROM content_candidate_revisions',
      )
      .first();
    const blobStats = await h.binding
      .prepare(
        'SELECT count(*) chunks,sum(byte_length) uncompressedBytes,sum(length(body)) storedBytes FROM editorial_blobs',
      )
      .first();
    const averages = Object.fromEntries(
      Object.entries(calls).map(([label, xs]) => [
        label,
        Object.fromEntries(
          ['statements', 'read', 'written', 'wallMs', 'hostCpuMs'].map((key) => [
            key,
            xs.reduce((s, x) => s + x[key], 0) / xs.length,
          ]),
        ),
      ]),
    );
    const totals = h.db.measurements.reduce(
      (s, x) => ({
        read: s.read + x.rowsRead,
        written: s.written + x.rowsWritten,
        statements: s.statements + x.statements,
      }),
      { read: 0, written: 0, statements: 0 },
    );
    await h.mf.dispose();
    const dir = join(h.directory, 'd1', 'miniflare-D1DatabaseObject'),
      files = (await readdir(dir)).filter((x) => x.endsWith('.sqlite') && !x.includes('metadata'));
    let physical: any;
    for (const file of files) {
      const audit = JSON.parse(
        execFileSync('python3', ['scripts/sqlite-pages.py', join(dir, file)], { encoding: 'utf8' }),
      );
      if (audit.objects.some((x: any) => x.name === 'content_candidates')) physical = audit;
    }
    if (!physical) throw Error('No closed synthetic database found');
    results[mode] = { physical, counts, duplicates, blobStats, averages, totals };
    console.log(mode, physical.sqliteBytes, totals);
  } finally {
    await h.close();
  }
}
const output = {
  scope:
    'One full modeled synthetic day; unique 8KB candidates, 10% corrections, ordinary fixture stories, ~10KB editions; large-versions separately stresses ~12KB versions. Host CPU is not Worker CPU. Physical closed SQLite B-tree+overflow audit; no VACUUM.',
  results,
};
await writeFile('measurements/storage-benchmark.json', JSON.stringify(output, null, 2) + '\n');
