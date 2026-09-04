import { loadEnvConfig } from '@next/env';

const hoursArg = Number(
  process.argv.find((arg) => arg.startsWith('--hours='))?.split('=')[1] ?? 24,
);
const teamId = (
  process.argv.find((arg) => arg.startsWith('--team='))?.split('=')[1] ?? 'KC'
).toUpperCase();

async function main() {
  if (!Number.isFinite(hoursArg) || hoursArg <= 0) throw new Error('--hours must be positive.');
  loadEnvConfig(process.cwd());

  const [{ syncMonitoringRegistry }, service, repo, { authDb }, surfaces] = await Promise.all([
    import('../src/server/monitoring/observer'),
    import('../src/server/story-engine/service'),
    import('../src/server/story-engine/repository'),
    import('../src/server/auth/database'),
    import('../src/server/content/canonical-surfaces'),
  ]);
  const registry = await syncMonitoringRegistry(teamId);
  const liveFeeds = registry.filter(
    (source) =>
      source.active && source.availability === 'LIVE' && source.ingestionMethod === 'RSS_ATOM',
  );
  const since = new Date(Date.now() - hoursArg * 3_600_000);
  const fetches = [];

  for (const registered of liveFeeds) {
    const source = await repo.sourceById(registered.id);
    if (!source) continue;
    try {
      fetches.push({
        source: source.name,
        ...(await service.processSource({ ...source, etag: null, lastModified: null }, undefined, {
          publishedSince: since,
        })),
      });
    } catch (error) {
      fetches.push({
        source: source.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const sql = authDb();
  const sourceIds = liveFeeds.map((source) => source.id);
  const candidates = sourceIds.length
    ? await sql<{ id: string; status: string }[]>`
        SELECT id,status
        FROM content_candidates
        WHERE source_id=ANY(${sourceIds})
          AND published_at>=${since}
          AND candidate_teams @> ${sql.json([teamId])}
          AND status IN ('NEW','REVIEW_REQUIRED')
        ORDER BY published_at
      `
    : [];
  const processed = [];
  for (const candidate of candidates) {
    if (candidate.status === 'REVIEW_REQUIRED')
      await sql`UPDATE content_candidates SET status='NEW',rejection_reason=NULL WHERE id=${candidate.id}`;
    processed.push({
      candidateId: candidate.id,
      ...(await service.processCandidate(candidate.id)),
    });
  }
  if (candidates.length)
    await sql`
      UPDATE ingestion_jobs
      SET status='COMPLETED',locked_at=NULL,locked_by=NULL,updated_at=now()
      WHERE job_type='CANDIDATE_PROCESS'
        AND payload->>'candidateId'=ANY(${candidates.map((candidate) => candidate.id)})
    `;

  const replayed = await service.replayRecentStories(teamId, hoursArg);
  const beat = await surfaces.canonicalHuddle(teamId, [], 100, 'LATEST');
  const homepage = await surfaces.getTeamHomepageData(teamId);
  const unavailable = registry
    .filter((source) => source.availability !== 'LIVE' || source.ingestionMethod !== 'RSS_ATOM')
    .map((source) => ({
      source: source.name,
      ingestionMethod: source.ingestionMethod,
      availability: source.availability,
    }));

  console.log(
    JSON.stringify(
      {
        teamId,
        since: since.toISOString(),
        fetches,
        processed,
        replayed,
        beatCount: beat.length,
        homepageCount: homepage.huddle.length,
        homepage: homepage.huddle.map((story) => ({
          headline: story.headline,
          updatedAt: story.updatedAt,
        })),
        unavailable,
      },
      null,
      2,
    ),
  );
  await sql.end({ timeout: 5 });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
