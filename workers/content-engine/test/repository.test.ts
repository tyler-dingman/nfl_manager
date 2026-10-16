import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { candidate, NOW, publishFixture, source, story, video } from './fixtures';
import { TEAM_IDS } from '../src/teams';
import { validateBindings } from '../src/bindings';
import { canonicalUrl } from '../src/database';
let h: Awaited<ReturnType<typeof harness>>;
before(async () => {
  h = await harness();
  await h.repo.upsertSource(source());
});
after(async () => {
  await h?.close();
});

test('binding validation fails closed for absent or production bindings', () => {
  assert.throws(() => validateBindings({}));
  assert.throws(() =>
    validateBindings({
      CONTENT_ENV: 'production',
      CONTENT_NETWORK_ENABLED: 'false',
      EDITORIAL_DB: h.binding,
    }),
  );
  assert.equal(
    validateBindings({
      CONTENT_ENV: 'local',
      CONTENT_NETWORK_ENABLED: 'false',
      EDITORIAL_DB: h.binding,
    }).EDITORIAL_DB,
    h.binding,
  );
});
test('all 32 teams share one database; national sources are single shared records', async () => {
  await h.repo.upsertSource(source('national', null));
  for (const t of TEAM_IDS) {
    await h.repo.upsertSource(source(`source-${t}`, t));
    const relevant = await h.repo.sourcesForTeam(t);
    assert(relevant.some((s) => s.id === 'national'));
    assert(relevant.some((s) => s.id === `source-${t}`));
    await publishFixture(h.repo, `story-${t}`, t);
    assert((await h.repo.storiesForTeam(t)).items.some((s) => s.id === `story-${t}`));
  }
  const rows = await h.db.query<{ n: number }>(
    'test.count',
    'SELECT count(*) AS n FROM content_sources WHERE id=?',
    ['national'],
  );
  assert.equal(rows[0].n, 1);
});
test('source updates preserve IDs and health; unchanged definitions cause no writes', async () => {
  const s = source('health');
  await h.repo.upsertSource(s);
  await h.repo.recordSourceCheck({
    id: 'check-1',
    sourceId: s.id,
    attemptedAt: NOW + 100,
    successful: true,
    nextCheckAt: NOW + 500,
    etag: 'v1',
    cursor: { page: 2 },
  });
  await h.repo.recordSourceCheck({
    id: 'check-old',
    sourceId: s.id,
    attemptedAt: NOW,
    successful: false,
    nextCheckAt: NOW + 10,
  });
  await h.repo.recordSourceCheck({
    id: 'check-304',
    sourceId: s.id,
    attemptedAt: NOW + 150,
    successful: true,
    nextCheckAt: NOW + 700,
    httpStatus: 304,
  });
  await h.repo.recordSourceCheck({
    id: 'check-fail',
    sourceId: s.id,
    attemptedAt: NOW + 200,
    successful: false,
    nextCheckAt: NOW + 800,
  });
  await h.repo.upsertSource({ ...s, name: 'Updated synthetic source' });
  const [row] = await h.db.query<{
    record_json: string;
    next_check_at: number;
    last_successful_at: number;
  }>(
    'test.health',
    'SELECT record_json,next_check_at,last_successful_at FROM content_sources WHERE id=?',
    [s.id],
  );
  assert.equal(row.next_check_at, NOW + 800);
  assert.equal(row.last_successful_at, NOW + 150);
  assert.equal(JSON.parse(row.record_json).metadata.originalNull, null);
  const [checkpoint] = await h.db.query<{ etag: string; cursor_json: string }>(
    'test.checkpoint',
    'SELECT etag,cursor_json FROM source_checkpoints WHERE source_id=?',
    [s.id],
  );
  assert.equal(checkpoint.etag, 'v1');
  assert.deepEqual(JSON.parse(checkpoint.cursor_json), { page: 2 });
  const start = h.db.measurements.length;
  assert.equal(
    (await h.repo.upsertSource({ ...s, name: 'Updated synthetic source' })).changed,
    false,
  );
  assert.equal(
    h.db.measurements.slice(start).reduce((n, m) => n + m.rowsWritten, 0),
    0,
  );
});
test('candidate identity dedupes tracking URLs, keeps independent publishers and records revisions', async () => {
  const c = candidate('dedupe');
  await h.repo.insertCandidate({
    ...c,
    canonicalUrl: c.canonicalUrl + '?utm_source=fixture#section',
  });
  const duplicate = await h.repo.insertCandidate({
    ...c,
    id: 'other-candidate-id',
    canonicalUrl: c.canonicalUrl,
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.candidate.id, c.id);
  assert.equal(duplicate.candidate.originalUrl, c.canonicalUrl + '?utm_source=fixture#section');
  const revised = await h.repo.insertCandidate({
    ...c,
    fingerprint: 'material-revision',
    rawText: 'Corrected synthetic evidence',
  });
  assert.equal(revised.revised, true);
  assert.equal(revised.candidate.id, c.id);
  await h.repo.upsertSource(source('publisher-2'));
  const independent = await h.repo.insertCandidate({
    ...c,
    id: 'independent-id',
    sourceId: 'publisher-2',
  });
  assert.equal(independent.duplicate, false);
  const history = await h.db.query<{ record_json: string }>(
    'test.history',
    'SELECT record_json FROM content_candidate_revisions WHERE candidate_id=? ORDER BY revision',
    [c.id],
  );
  assert.equal(history.length, 2);
  assert.equal(JSON.parse(history[0].record_json).rawText, c.rawText);
  assert.equal(JSON.parse(history[1].record_json).rawText, 'Corrected synthetic evidence');
  const jobs = await h.db.query<{ n: number }>(
    'test.jobs',
    'SELECT count(*) AS n FROM ingestion_jobs WHERE candidate_id=?',
    [c.id],
  );
  assert.equal(jobs[0].n, 2);
  assert.equal(
    canonicalUrl('https://publisher.invalid/a?z=2&utm_medium=x&a=1#x'),
    'https://publisher.invalid/a?a=1&z=2',
  );
});
test('multiple independent sources corroborate one story, retaining source attribution and JSON fields', async () => {
  const s = story('corroborated');
  await h.repo.createStory(s);
  for (const [id, sid] of [
    ['e1', 'source-1'],
    ['e2', 'publisher-2'],
  ]) {
    const c = candidate(`corroborated-${id}`, sid);
    await h.repo.insertCandidate(c);
    await h.repo.associateEvidence({
      id,
      storyId: s.id,
      candidateId: c.id,
      sourceId: sid,
      firstSeenAt: NOW,
      originalEvidence: { confidence: 0.95 },
    });
  }
  await h.repo.publishStory({ ...s, version: 2, publicationState: 'PUBLISHED' }, 1, {
    decision: { allowed: true },
    card: { image: { type: 'descriptor' } },
    evidenceIds: ['e1', 'e2'],
    eventId: 'corroborated-event',
  });
  const attributed = await h.repo.attribution(s.id);
  assert.equal(attributed.length, 2);
  assert.deepEqual(attributed.map((r) => r.source.id).sort(), ['publisher-2', 'source-1']);
  assert.deepEqual(attributed[0].candidate.metadata, { retained: true, nested: [null, false, 7] });
  await assert.rejects(
    h.repo.associateEvidence({
      id: 'false-source',
      storyId: s.id,
      candidateId: 'corroborated-e1',
      sourceId: 'publisher-2',
      firstSeenAt: NOW,
    }),
  );
});
test('story versions and outbox publish atomically; stale CAS leaves no dependent inserts', async () => {
  const s = await publishFixture(h.repo, 'versioned');
  const next = {
    ...s,
    version: 3,
    headline: 'A material synthetic update',
    meaningfulUpdateAt: NOW + 20,
  };
  const details = {
    decision: { allowed: true },
    card: { kind: 'updated' },
    evidenceIds: ['evidence-versioned'],
    eventId: 'event-versioned-v3',
  };
  const outcomes = await Promise.allSettled([
    h.repo.publishStory(next, 2, details),
    h.repo.publishStory({ ...next, headline: 'Competing update' }, 2, {
      ...details,
      eventId: 'event-versioned-race',
    }),
  ]);
  assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  const [versions] = await h.db.query<{ n: number }>(
    'test.versions',
    'SELECT count(*) AS n FROM story_versions WHERE story_id=?',
    [s.id],
  );
  assert.equal(versions.n, 3);
  const [events] = await h.db.query<{ n: number }>(
    'test.events',
    'SELECT count(*) AS n FROM content_outbox WHERE aggregate_id=?',
    [s.id],
  );
  assert.equal(events.n, 2);
  const [guards] = await h.db.query<{ n: number }>(
    'test.guards',
    'SELECT count(*) AS n FROM transaction_assertions',
  );
  assert.equal(guards.n, 0);
});
test('constraint failure after CAS rolls back story, version, decision and outbox', async () => {
  const s = await publishFixture(h.repo, 'rollback');
  await assert.rejects(
    h.repo.publishStory({ ...s, version: 3, headline: 'Must not commit' }, 2, {
      decision: { allowed: true },
      card: { kind: 'rollback' },
      evidenceIds: ['evidence-rollback'],
      eventId: 'event-versioned',
    }),
  );
  const [row] = await h.db.query<{ version: number; headline: string }>(
    'test.rollback',
    'SELECT version,headline FROM canonical_stories WHERE id=?',
    [s.id],
  );
  assert.equal(row.version, 2);
  assert.equal(row.headline, s.headline);
  const [rows] = await h.db.query<{ n: number }>(
    'test.rollback.versions',
    'SELECT count(*) AS n FROM story_versions WHERE story_id=?',
    [s.id],
  );
  assert.equal(rows.n, 2);
});
test('feed publication filters, national stories and stable keyset pagination', async () => {
  await publishFixture(h.repo, 'global', null, NOW + 10);
  for (let i = 0; i < 6; i++) await publishFixture(h.repo, `paged-${i}`, 'kc', NOW + 30);
  await h.repo.createStory(story('not-published'));
  const ids: string[] = [];
  let cursor: import('../src/types').Cursor | undefined;
  do {
    const p = await h.repo.storiesForTeam('kc', 3, cursor);
    ids.push(...p.items.map((s) => s.id));
    cursor = p.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.includes('global'));
  assert(!ids.includes('not-published'));
  assert(!ids.includes('story-sea'));
  assert.deepEqual(
    ids.filter((id) => id.startsWith('paged-')),
    ['paged-5', 'paged-4', 'paged-3', 'paged-2', 'paged-1', 'paged-0'],
  );
  for (const bad of [null, undefined, '', 'NFL', 'KC', "kc' OR 1=1 --"]) {
    await assert.rejects(h.repo.storiesForTeam(bad));
    await assert.rejects(h.repo.videosForTeam(bad));
    await assert.rejects(h.repo.editionsForTeam(bad));
  }
  await assert.rejects(h.repo.storiesForTeam('kc', 101));
  await assert.rejects(h.repo.storiesForTeam('kc', 2, { time: -1, id: 'bad' }));
});
test('one video can belong to multiple teams; unavailable videos and null statistics remain accurate', async () => {
  await h.repo.upsertVideo(video());
  assert((await h.repo.videosForTeam('kc')).items.some((v) => v.videoId === 'video-1'));
  assert((await h.repo.videosForTeam('sea')).items.some((v) => v.videoId === 'video-1'));
  assert.equal((await h.repo.videosForTeam('sea')).items[0].viewCount, null);
  for (let i = 0; i < 5; i++) await h.repo.upsertVideo(video(`video-page-${i}`, ['sea']));
  const one = await h.repo.videosForTeam('sea', 2),
    two = await h.repo.videosForTeam('sea', 2, one.nextCursor!);
  assert.equal(new Set([...one.items, ...two.items].map((v) => v.videoId)).size, 4);
  await h.repo.upsertVideo({ ...video(), availability: 'PRIVATE' });
  assert(!(await h.repo.videosForTeam('kc')).items.some((v) => v.videoId === 'video-1'));
  await h.repo.upsertVideo({ ...video(), availability: 'PUBLIC', teamIds: ['sea'] });
  assert.equal((await h.repo.videosForTeam('kc')).items.length, 0);
});
test('published Three & Out requires three eligible stories; drafts stay private and edition IDs remain intact', async () => {
  const base = {
    id: 'edition-1',
    teamId: 'kc' as const,
    briefingDate: '2027-01-15',
    status: 'PUBLISHED' as const,
    generatedAt: NOW,
    sourceFingerprint: 'synthetic-3',
    items: [{ storyId: 'paged-0' }, { storyId: 'paged-1' }, { storyId: 'paged-2' }],
    audio: null,
    sourceWindow: { from: NOW - 86400000, to: NOW },
  };
  await h.repo.saveEdition(base);
  assert.deepEqual((await h.repo.editionsForTeam('kc')).items[0], base);
  await h.repo.saveEdition({
    ...base,
    id: 'draft-edition',
    status: 'DRAFT',
    briefingDate: '2027-01-16',
  });
  assert.equal((await h.repo.editionsForTeam('kc')).items.length, 1);
  await assert.rejects(h.repo.saveEdition({ ...base, id: 'duplicate-day' }));
  await assert.rejects(
    h.repo.saveEdition({
      ...base,
      id: 'wrong-story',
      briefingDate: '2027-01-17',
      items: [{ storyId: 'not-published' }, { storyId: 'paged-1' }, { storyId: 'paged-2' }],
    }),
  );
});
test('SQLite enforces team, source, boolean, JSON and version relationships', async () => {
  await assert.rejects(
    h.binding
      .prepare("INSERT INTO source_teams(source_id,team_id) VALUES('source-1','invalid')")
      .run(),
  );
  await assert.rejects(
    h.binding.prepare("INSERT INTO source_teams(source_id,team_id) VALUES('missing','kc')").run(),
  );
  await assert.rejects(
    h.binding.prepare("UPDATE content_sources SET enabled=7 WHERE id='source-1'").run(),
  );
  await assert.rejects(
    h.binding
      .prepare("UPDATE content_sources SET record_json='not json' WHERE id='source-1'")
      .run(),
  );
  await assert.rejects(
    h.binding
      .prepare(
        "INSERT INTO editorial_cards(id,story_id,story_version,schema_version,descriptor_json) VALUES('orphan','versioned',999,1,'{}')",
      )
      .run(),
  );
  const original = (await h.repo.sourcesForTeam('kc')).find((s) => s.id === 'source-1');
  assert(original?.enabled);
});

test('a late candidate-job SQL failure leaves neither candidate, revision, associations nor job', async () => {
  await h.binding
    .prepare(
      "CREATE TRIGGER synthetic_fail_job BEFORE INSERT ON ingestion_jobs WHEN NEW.candidate_id='candidate-job-failure' BEGIN SELECT RAISE(ABORT,'synthetic job write failure'); END",
    )
    .run();
  try {
    await assert.rejects(h.repo.insertCandidate(candidate('candidate-job-failure')));
    for (const table of [
      'content_candidates',
      'content_candidate_revisions',
      'candidate_teams',
      'ingestion_jobs',
    ]) {
      const column = table === 'content_candidates' ? 'id' : 'candidate_id';
      const row = await h.binding
        .prepare(`SELECT count(*) AS n FROM ${table} WHERE ${column}=?`)
        .bind('candidate-job-failure')
        .first<{ n: number }>();
      assert.equal(row!.n, 0);
    }
  } finally {
    await h.binding.prepare('DROP TRIGGER synthetic_fail_job').run();
  }
});

test('a new local runtime recovers the exact persisted editorial graph', async () => {
  const persisted = await harness(true);
  try {
    await persisted.repo.upsertSource(source());
    const s = await publishFixture(persisted.repo, 'restart-story');
    const restarted = await persisted.restart();
    const row = await restarted
      .prepare('SELECT record_json FROM canonical_stories WHERE id=?')
      .bind(s.id)
      .first<{ record_json: string }>();
    assert.deepEqual(JSON.parse(row!.record_json), s);
    const event = await restarted
      .prepare('SELECT aggregate_version FROM content_outbox WHERE aggregate_id=?')
      .bind(s.id)
      .first<{ aggregate_version: number }>();
    assert.equal(event!.aggregate_version, 2);
  } finally {
    await persisted.close();
  }
});

test('bounded inputs fail explicitly instead of truncating complete records or exceeding query budgets', async () => {
  await assert.rejects(
    h.repo.insertCandidate({ ...candidate('oversized'), rawText: 'x'.repeat(512001) }),
  );
  assert.throws(() => h.db.statement('SELECT 1', Array(101).fill(1)));
  await assert.rejects(
    h.db.batch(
      'oversized-batch',
      Array.from({ length: 51 }, () => h.db.statement('SELECT 1')),
    ),
  );
  assert.equal((await h.repo.videosForTeam('ari')).items.length, 0);
});
