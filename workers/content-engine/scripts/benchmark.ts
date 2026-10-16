import { writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { harness } from '../test/harness';
import { TEAM_IDS } from '../src/teams';
import { candidate, NOW, publishFixture, source, story, video } from '../test/fixtures';
import { recordRun } from '../src/metrics';
const h = await harness(true);
const latencies: Record<
  string,
  { wallMs: number; hostCpuMs: number; statements: number; rowsRead: number; rowsWritten: number }[]
> = {};
async function measure<T>(label: string, action: () => Promise<T>) {
  const wall = performance.now(),
    cpu = process.cpuUsage(),
    start = h.db.measurements.length;
  const value = await action();
  const usage = process.cpuUsage(cpu);
  (latencies[label] ??= []).push({
    wallMs: performance.now() - wall,
    hostCpuMs: (usage.user + usage.system) / 1000,
    statements: h.db.measurements.slice(start).reduce((s, m) => s + m.statements, 0),
    rowsRead: h.db.measurements.slice(start).reduce((s, m) => s + m.rowsRead, 0),
    rowsWritten: h.db.measurements.slice(start).reduce((s, m) => s + m.rowsWritten, 0),
  });
  return value;
}
const percentile = (values: number[], p: number) =>
  values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
try {
  const emptySize = (await h.binding.prepare('SELECT 1 AS value').all()).meta.size_after;
  for (const t of TEAM_IDS)
    for (let i = 0; i < 3; i++) await h.repo.upsertSource(source(`rss-${t}-${i}`, t));
  await h.repo.upsertSource(source('source-1', null));
  for (let i = 0; i < 66; i++)
    await h.repo.upsertSource({ ...source(`youtube-${i}`, TEAM_IDS[i % 32]), platform: 'YOUTUBE' });
  for (const [index, t] of TEAM_IDS.entries()) {
    for (let i = 0; i < 20; i++) {
      const id = `bench-${t}-${i}`,
        c = candidate(`candidate-${id}`, 'source-1', t);
      c.rawText = 'Synthetic source text, never fetched. '.repeat(220);
      await measure('candidate.new', () => h.repo.insertCandidate(c));
      await measure('candidate.duplicate', () =>
        h.repo.insertCandidate({ ...c, id: `duplicate-${id}` }),
      );
      const s = story(id, t);
      s.meaningfulUpdateAt = NOW + i;
      await measure('story.new', () => h.repo.createStory(s));
      await measure('evidence.new', () =>
        h.repo.associateEvidence({
          id: `evidence-${id}`,
          storyId: id,
          candidateId: c.id,
          sourceId: 'source-1',
          firstSeenAt: NOW + i,
        }),
      );
      await measure('story.publication', () =>
        h.repo.publishStory({ ...s, version: 2, publicationState: 'PUBLISHED' }, 1, {
          decision: { allowed: true },
          card: { title: s.headline },
          evidenceIds: [`evidence-${id}`],
          eventId: `event-${id}`,
        }),
      );
      if (i === 0)
        await measure('candidate.revision', () =>
          h.repo.insertCandidate({
            ...c,
            fingerprint: `revision-${id}`,
            rawText: c.rawText + ' Material correction.',
          }),
        );
    }
    await measure('source.check', () =>
      h.repo.recordSourceCheck({
        id: `check-${t}`,
        sourceId: `rss-${t}-0`,
        attemptedAt: NOW,
        successful: true,
        nextCheckAt: NOW + 3600000,
        etag: `etag-${t}`,
        cursor: { lastItem: 20 },
      }),
    );
    const items = [0, 1, 2].map((i) => ({ storyId: `bench-${t}-${i}` }));
    await measure('edition.publish', () =>
      h.repo.saveEdition({
        id: `edition-${t}`,
        teamId: t,
        briefingDate: '2027-01-15',
        status: 'PUBLISHED',
        generatedAt: NOW,
        sourceFingerprint: `edition-fingerprint-${t}`,
        items,
      }),
    );
    for (let i = 0; i < 30; i++)
      await measure('video.upsert', () =>
        h.repo.upsertVideo({
          ...video(`clip-${index}-${i}`, [t, TEAM_IDS[(index + 1) % 32]]),
          publishedAt: NOW + i,
          sourceId: `youtube-${index}`,
        }),
      );
  }
  for (let i = 0; i < 20; i++) await publishFixture(h.repo, `national-${i}`, null, NOW + i);
  for (const t of TEAM_IDS)
    for (let round = 0; round < 3; round++) {
      const p = await measure('read.story.page', () => h.repo.storiesForTeam(t, 20));
      if (p.nextCursor)
        await measure('read.story.cursor', () => h.repo.storiesForTeam(t, 20, p.nextCursor!));
      await measure('read.video.page', () => h.repo.videosForTeam(t, 20));
      await measure('read.edition', () => h.repo.editionsForTeam(t));
      await measure('read.attribution', () => h.repo.attribution(`bench-${t}-0`));
    }
  for (let i = 0; i < 32; i++) {
    const job = await measure('job.claim', () => h.jobs.claim(NOW + 1000, 10000));
    if (job) await measure('job.complete', () => h.jobs.complete(job, NOW + 1001));
  }
  await measure('job.enqueue', () =>
    h.jobs.enqueue({
      id: 'bench-job',
      jobType: 'SYNTHETIC',
      idempotencyKey: 'bench-job',
      availableAt: NOW + 100000,
      ownerEpoch: 1,
      payload: { synthetic: true },
    }),
  );
  await measure('run.record', () =>
    recordRun(h.db, {
      id: 'bench-run',
      kind: 'SYNTHETIC',
      occurredAt: NOW,
      metrics: { synthetic: true },
    }),
  );
  const aggregate: Record<
    string,
    {
      calls: number;
      statements: number;
      rowsRead: number;
      rowsWritten: number;
      localD1DurationMs: number;
    }
  > = {};
  for (const m of h.db.measurements) {
    const v = (aggregate[m.label] ??= {
      calls: 0,
      statements: 0,
      rowsRead: 0,
      rowsWritten: 0,
      localD1DurationMs: 0,
    });
    v.calls++;
    v.statements += m.statements;
    v.rowsRead += m.rowsRead;
    v.rowsWritten += m.rowsWritten;
    v.localD1DurationMs += m.durationMs;
  }
  const averages = Object.fromEntries(
    Object.entries(aggregate).map(([label, m]) => [
      label,
      {
        calls: m.calls,
        statementsPerCall: m.statements / m.calls,
        rowsReadPerCall: m.rowsRead / m.calls,
        rowsWrittenPerCall: m.rowsWritten / m.calls,
      },
    ]),
  );
  const timings = Object.fromEntries(
    Object.entries(latencies).map(([label, values]) => [
      label,
      {
        samples: values.length,
        meanStatements: values.reduce((s, v) => s + v.statements, 0) / values.length,
        meanRowsRead: values.reduce((s, v) => s + v.rowsRead, 0) / values.length,
        meanRowsWritten: values.reduce((s, v) => s + v.rowsWritten, 0) / values.length,
        p50WallMs: percentile(
          values.map((v) => v.wallMs),
          0.5,
        ),
        p99WallMs: percentile(
          values.map((v) => v.wallMs),
          0.99,
        ),
        p99HostCpuMs: percentile(
          values.map((v) => v.hostCpuMs),
          0.99,
        ),
      },
    ]),
  );
  const counts: Record<string, number> = {};
  for (const table of [
    'content_sources',
    'content_candidates',
    'content_candidate_revisions',
    'canonical_stories',
    'story_evidence',
    'story_versions',
    'editorial_cards',
    'film_room_videos',
    'film_room_video_teams',
    'three_and_out_snapshots',
    'ingestion_jobs',
    'content_outbox',
  ]) {
    const result = await h.binding
      .prepare(`SELECT count(*) AS n FROM ${table}`)
      .first<{ n: number }>();
    counts[table] = result!.n;
  }
  const sizeAfter = (await h.binding.prepare('SELECT count(*) FROM canonical_stories').all()).meta
    .size_after;

  const plans: Record<string, unknown> = {};
  plans.story = await h.binding
    .prepare(
      "EXPLAIN QUERY PLAN SELECT id FROM canonical_stories WHERE team_id=? AND publication_state='PUBLISHED' ORDER BY meaningful_update_at DESC,id DESC LIMIT 21",
    )
    .bind('kc')
    .all();
  plans.video = await h.binding
    .prepare(
      "EXPLAIN QUERY PLAN SELECT v.video_id FROM film_room_video_teams vt CROSS JOIN film_room_videos v ON v.video_id=vt.video_id WHERE vt.team_id=? AND v.availability='PUBLIC' ORDER BY v.published_at DESC,v.video_id DESC LIMIT 21",
    )
    .bind('kc')
    .all();
  plans.edition = await h.binding
    .prepare(
      "EXPLAIN QUERY PLAN SELECT id FROM three_and_out_snapshots WHERE team_id=? AND status='PUBLISHED' ORDER BY generated_at DESC,id DESC LIMIT 21",
    )
    .bind('kc')
    .all();
  const responseBytes = {
    story: Buffer.byteLength(JSON.stringify(await h.repo.storiesForTeam('kc'))),
    video: Buffer.byteLength(JSON.stringify(await h.repo.videosForTeam('kc'))),
    edition: Buffer.byteLength(JSON.stringify(await h.repo.editionsForTeam('kc'))),
  };
  const jsonBytes: Record<string, { rows: number; bytes: number; meanBytes: number }> = {};
  for (const [table, column] of Object.entries({
    content_sources: 'record_json',
    source_checks: 'record_json',
    content_candidates: 'record_json',
    content_candidate_revisions: 'record_json',
    canonical_stories: 'record_json',
    story_versions: 'record_json',
    story_evidence: 'record_json',
    story_publication_decisions: 'record_json',
    editorial_cards: 'descriptor_json',
    film_room_videos: 'record_json',
    three_and_out_snapshots: 'record_json',
    ingestion_jobs: 'payload_json',
    content_outbox: 'payload_json',
    content_run_log: 'record_json',
  })) {
    const row = await h.binding
      .prepare(
        `SELECT count(*) AS rows,COALESCE(sum(length(CAST(${column} AS BLOB))),0) AS bytes FROM ${table}`,
      )
      .first<{ rows: number; bytes: number }>();
    jsonBytes[table] = { ...row!, meanBytes: row!.bytes / (row!.rows || 1) };
  }
  const output = {
    jsonBytes,
    scope:
      'Synthetic local Miniflare D1 only; CPU is Node host CPU, not Cloudflare Worker CPU or production metering.',
    versions: { node: process.version },
    counts,
    emptySqliteBytes: emptySize,
    sqliteBytes: sizeAfter,
    averages,
    timings,
    responseBytes,
    plans,
  };
  await mkdir('measurements', { recursive: true });
  await writeFile('measurements/local-benchmark.json', JSON.stringify(output, null, 2) + '\n');
  console.log(
    JSON.stringify({ sqliteBytes: output.sqliteBytes, counts, responseBytes, averages }, null, 2),
  );
} finally {
  await h.close();
}
