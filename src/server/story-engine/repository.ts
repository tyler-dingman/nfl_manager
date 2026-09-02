import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import type {
  ContentCandidate,
  MaterialChangeType,
  RegisteredSource,
  StoryRecord,
  SynthesizedStory,
} from '@/features/story-engine/types';
import type {
  PublishingDecision,
  PublishingOverride,
} from '@/features/story-engine/publishing-policy';

type Sql = ReturnType<typeof authDb>;
const rowSource = (r: any): RegisteredSource => ({
  id: r.id,
  name: r.name,
  sourceType: r.source_type,
  teamId: r.team_id,
  leagueWide: r.league_wide,
  url: r.url,
  feedUrl: r.feed_url,
  fetchStrategy: r.fetch_strategy,
  pollingTier: r.polling_tier,
  priority: r.priority,
  reliabilityScore: Number(r.reliability_score),
  checkIntervalSeconds: r.check_interval_seconds,
  enabled: r.enabled,
  etag: r.etag,
  lastModified: r.last_modified,
  lastCheckedAt: r.last_checked_at,
  lastSuccessfulAt: r.last_successful_at,
  nextCheckAt: r.next_check_at,
  failureCount: r.failure_count,
  lastError: r.last_error,
  metadata: r.metadata ?? {},
});
const rowStory = (r: any): StoryRecord =>
  ({
    id: r.id,
    teamId: r.team_id,
    storyType: r.story_type,
    headline: r.headline,
    summary: r.summary,
    whatHappened: r.what_happened,
    whyItMatters: r.why_it_matters,
    whatsNext: r.whats_next,
    status: r.status,
    publicationState: r.publication_state,
    importanceScore: r.importance_score,
    confidenceScore: r.confidence_score,
    entities: r.entities ?? [],
    firstReportedAt: r.first_reported_at,
    lastMeaningingUpdateAt: r.last_meaningful_update_at,
    lastMeaningfulUpdateAt: r.last_meaningful_update_at,
    version: r.version,
  }) as StoryRecord;

export async function dueSources(now = new Date(), limit = 50) {
  const rows =
    await authDb()`SELECT * FROM content_sources WHERE enabled=true AND next_check_at<=${now} ORDER BY priority DESC,next_check_at LIMIT ${limit}`;
  return rows.map(rowSource);
}
export async function sourceById(id: string) {
  const [r] = await authDb()`SELECT * FROM content_sources WHERE id=${id}`;
  return r ? rowSource(r) : null;
}
export async function enqueueJob(
  type: 'SOURCE_FETCH' | 'CANDIDATE_PROCESS',
  key: string,
  payload: object,
) {
  const rows =
    await authDb()`INSERT INTO ingestion_jobs(id,job_type,idempotency_key,payload) VALUES(${randomUUID()},${type},${key},${authDb().json(payload as any)}) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`;
  return Boolean(rows.length);
}
export async function claimJob(workerId: string) {
  return authDb().begin(async (sql) => {
    const [job] =
      await sql`SELECT * FROM ingestion_jobs WHERE status IN ('PENDING','FAILED') AND available_at<=now() AND attempts<max_attempts ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!job) return null;
    const [claimed] =
      await sql`UPDATE ingestion_jobs SET status='RUNNING',attempts=attempts+1,locked_at=now(),locked_by=${workerId},updated_at=now() WHERE id=${job.id} RETURNING *`;
    return claimed;
  });
}
export async function finishJob(id: string) {
  await authDb()`UPDATE ingestion_jobs SET status='COMPLETED',locked_at=NULL,locked_by=NULL,updated_at=now() WHERE id=${id}`;
}
export async function failJob(id: string, error: string, delaySeconds: number) {
  await authDb()`UPDATE ingestion_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'DEAD' ELSE 'FAILED' END,last_error=${error.slice(0, 1000)},available_at=now()+(${delaySeconds}*interval '1 second'),locked_at=NULL,locked_by=NULL,updated_at=now() WHERE id=${id}`;
}
export async function markSourceSuccess(
  source: RegisteredSource,
  etag: string | null,
  lastModified: string | null,
  next: Date,
) {
  await authDb()`UPDATE content_sources SET etag=${etag},last_modified=${lastModified},last_checked_at=now(),last_successful_at=now(),next_check_at=${next},failure_count=0,last_error=NULL,updated_at=now() WHERE id=${source.id}`;
}
export async function markSourceFailure(source: RegisteredSource, error: string, next: Date) {
  await authDb()`UPDATE content_sources SET last_checked_at=now(),next_check_at=${next},failure_count=failure_count+1,last_error=${error.slice(0, 1000)},updated_at=now() WHERE id=${source.id}`;
}

export async function saveCandidate(c: ContentCandidate) {
  const id = randomUUID();
  const sql = authDb();
  const rows =
    await sql`INSERT INTO content_candidates(id,source_id,external_id,canonical_url,title,normalized_title,author,published_at,discovered_at,raw_text,excerpt,entities,candidate_teams,fingerprint,status,metadata) VALUES(${id},${c.sourceId},${c.externalId},${c.url},${c.title},${c.normalizedTitle},${c.author},${c.publishedAt},${c.discoveredAt},${c.text},${c.excerpt},${sql.json(c.entities)},${sql.json(c.candidateTeams)},${c.fingerprint},${c.status},${sql.json({ storyType: c.storyType })}) ON CONFLICT DO NOTHING RETURNING id`;
  return rows[0]?.id as string | undefined;
}
export async function candidateById(id: string): Promise<ContentCandidate | null> {
  const [r] = await authDb()`SELECT * FROM content_candidates WHERE id=${id}`;
  return r
    ? {
        id: r.id,
        sourceId: r.source_id,
        externalId: r.external_id,
        url: r.canonical_url,
        title: r.title,
        normalizedTitle: r.normalized_title,
        author: r.author,
        publishedAt: r.published_at.toISOString(),
        discoveredAt: r.discovered_at.toISOString(),
        text: r.raw_text,
        excerpt: r.excerpt,
        entities: r.entities,
        candidateTeams: r.candidate_teams,
        fingerprint: r.fingerprint,
        status: r.status,
        storyType: r.metadata.storyType,
      }
    : null;
}
export async function recentStories(teams: string[], since: Date) {
  const rows =
    await authDb()`SELECT * FROM canonical_stories WHERE last_meaningful_update_at>=${since} AND (team_id IS NULL OR team_id=ANY(${teams}))`;
  return rows.map(rowStory);
}
export async function storyById(id: string) {
  const [r] = await authDb()`SELECT * FROM canonical_stories WHERE id=${id}`;
  return r ? rowStory(r) : null;
}
export async function evidenceForStory(id: string) {
  const rows =
    await authDb()`SELECT c.*,s.name,s.source_type,s.team_id,s.league_wide,s.url AS source_home,s.feed_url,s.fetch_strategy,s.polling_tier,s.priority,s.reliability_score,s.check_interval_seconds,s.enabled,s.etag,s.last_modified,s.last_checked_at,s.last_successful_at,s.next_check_at,s.failure_count,s.last_error,s.metadata AS source_metadata FROM story_evidence e JOIN content_candidates c ON c.id=e.content_candidate_id JOIN content_sources s ON s.id=e.source_id WHERE e.story_id=${id} ORDER BY e.first_seen_at`;
  return rows.map((r: any) => ({
    candidate: {
      id: r.id,
      sourceId: r.source_id,
      externalId: r.external_id,
      url: r.canonical_url,
      title: r.title,
      normalizedTitle: r.normalized_title,
      author: r.author,
      publishedAt: r.published_at.toISOString(),
      discoveredAt: r.discovered_at.toISOString(),
      text: r.raw_text,
      excerpt: r.excerpt,
      entities: r.entities,
      candidateTeams: r.candidate_teams,
      fingerprint: r.fingerprint,
      status: r.status,
      storyType: r.metadata.storyType,
    },
    source: rowSource({
      ...r,
      id: r.source_id,
      url: r.source_home,
      metadata: r.source_metadata,
    }),
  }));
}

export async function setCandidateStatus(id: string, status: string, reason?: string) {
  await authDb()`UPDATE content_candidates SET status=${status},rejection_reason=${reason ?? null},updated_at=now() WHERE id=${id}`;
}
export async function createStory(
  candidate: ContentCandidate,
  source: RegisteredSource,
  synth: SynthesizedStory,
  publication: string,
  change: MaterialChangeType,
  decision?: PublishingDecision,
) {
  const sql = authDb();
  return sql.begin(async (tx: any) => {
    const storyId = randomUUID(),
      evidenceId = randomUUID();
    await tx`INSERT INTO canonical_stories(id,team_id,story_type,headline,summary,what_happened,why_it_matters,whats_next,status,publication_state,importance_score,confidence_score,entities,first_reported_at,last_meaningful_update_at) VALUES(${storyId},${candidate.candidateTeams[0] ?? source.teamId},${candidate.storyType},${synth.headline},${synth.summary},${synth.whatHappened},${synth.whyItMatters},${synth.whatsNext},${synth.status},${publication},${synth.importanceScore},${synth.confidenceScore},${tx.json(candidate.entities)},${candidate.publishedAt},${candidate.publishedAt})`;
    await tx`INSERT INTO story_evidence(id,story_id,content_candidate_id,source_id,source_url,support_type,confidence) VALUES(${evidenceId},${storyId},${candidate.id},${source.id},${candidate.url},${source.sourceType === 'OFFICIAL_TEAM' || source.sourceType === 'NFL_OFFICIAL' ? 'OFFICIAL_CONFIRMATION' : 'SUPPORTS'},${source.reliabilityScore})`;
    await tx`INSERT INTO story_versions(id,story_id,version,headline,summary,what_happened,why_it_matters,whats_next,status,publication_state,importance_score,confidence_score,evidence_ids,claims,material_change_type) VALUES(${randomUUID()},${storyId},1,${synth.headline},${synth.summary},${synth.whatHappened},${synth.whyItMatters},${synth.whatsNext},${synth.status},${publication},${synth.importanceScore},${synth.confidenceScore},${tx.json([evidenceId])},${tx.json(synth.claims)},${change})`;
    await emit(tx, 'StoryCreated', storyId, candidate.candidateTeams[0] ?? source.teamId, 1, {
      headline: synth.headline,
    });
    if (decision) await recordDecision(tx, storyId, 1, decision);
    if (decision?.breaking) {
      await emit(
        tx,
        'StoryBecameBreaking',
        storyId,
        candidate.candidateTeams[0] ?? source.teamId,
        1,
        { reason: decision.reason },
      );
      await emitBreakingCandidate(
        tx,
        storyId,
        candidate.candidateTeams[0] ?? source.teamId,
        synth.importanceScore,
        1,
        decision.reason,
      );
    }
    await tx`UPDATE content_candidates SET status='CLUSTERED' WHERE id=${candidate.id}`;
    return storyId;
  });
}
async function emit(
  sql: any,
  type: string,
  storyId: string,
  teamId: string | null,
  version: number,
  payload: object,
) {
  await sql`INSERT INTO story_domain_events(id,event_type,story_id,team_id,story_version,idempotency_key,payload) VALUES(${randomUUID()},${type},${storyId},${teamId},${version},${`${type}:${storyId}:${version}`},${sql.json(payload)}) ON CONFLICT(idempotency_key) DO NOTHING`;
}
async function recordDecision(
  sql: any,
  storyId: string,
  version: number,
  decision: PublishingDecision,
) {
  await sql`INSERT INTO story_publication_decisions(id,story_id,story_version,action,reason,confidence) VALUES(${randomUUID()},${storyId},${version},${decision.action},${decision.reason},${decision.confidence}) ON CONFLICT(story_id,story_version) DO NOTHING`;
}
async function emitBreakingCandidate(
  sql: any,
  storyId: string,
  teamId: string | null,
  importanceScore: number,
  version: number,
  reason: string,
) {
  const key = `BREAKING_STORY:${storyId}:${version}`;
  await sql`INSERT INTO notification_events(id,event_type,team_id,story_id,priority,payload,dedupe_key) VALUES(${randomUUID()},'BREAKING_STORY',${teamId},${storyId},'CRITICAL',${sql.json({ storyId, teamId, importanceScore, reason, occurredAt: new Date().toISOString() })},${key}) ON CONFLICT(dedupe_key) DO NOTHING`;
}
export async function activePublishingOverride(storyId: string): Promise<PublishingOverride> {
  const [row] =
    await authDb()`SELECT action FROM story_editorial_overrides WHERE story_id=${storyId} AND active=true AND surface='PUBLIC' AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1`;
  if (row?.action === 'HIDE') return 'HIDE';
  if (row?.action === 'FORCE_PUBLISH') return 'FORCE_PUBLISH';
  if (row?.action === 'FORCE_REVIEW') return 'FORCE_REVIEW';
  return null;
}
export async function attachEvidence(
  story: StoryRecord,
  candidate: ContentCandidate,
  source: RegisteredSource,
  synth: SynthesizedStory | null,
  publication: string | null,
  change: MaterialChangeType,
  decision?: PublishingDecision,
) {
  const sql = authDb();
  return sql.begin(async (tx: any) => {
    const evidenceId = randomUUID();
    await tx`INSERT INTO story_evidence(id,story_id,content_candidate_id,source_id,source_url,support_type,confidence) VALUES(${evidenceId},${story.id},${candidate.id},${source.id},${candidate.url},${source.sourceType === 'OFFICIAL_TEAM' || source.sourceType === 'NFL_OFFICIAL' ? 'OFFICIAL_CONFIRMATION' : 'SUPPORTS'},${source.reliabilityScore}) ON CONFLICT DO NOTHING`;
    await tx`UPDATE content_candidates SET status='CLUSTERED' WHERE id=${candidate.id}`;
    if (!synth) return story.version;
    const version = story.version + 1;
    await tx`UPDATE canonical_stories SET headline=${synth.headline},summary=${synth.summary},what_happened=${synth.whatHappened},why_it_matters=${synth.whyItMatters},whats_next=${synth.whatsNext},status=${synth.status},publication_state=${publication},importance_score=${synth.importanceScore},confidence_score=${synth.confidenceScore},version=${version},last_meaningful_update_at=${candidate.publishedAt},updated_at=now() WHERE id=${story.id} AND version=${story.version}`;
    const evid = await tx`SELECT id FROM story_evidence WHERE story_id=${story.id}`;
    await tx`INSERT INTO story_versions(id,story_id,version,headline,summary,what_happened,why_it_matters,whats_next,status,publication_state,importance_score,confidence_score,evidence_ids,claims,material_change_type) VALUES(${randomUUID()},${story.id},${version},${synth.headline},${synth.summary},${synth.whatHappened},${synth.whyItMatters},${synth.whatsNext},${synth.status},${publication},${synth.importanceScore},${synth.confidenceScore},${tx.json(evid.map((r: any) => r.id))},${tx.json(synth.claims)},${change})`;
    if (decision) await recordDecision(tx, story.id, version, decision);
    await emit(tx, 'StoryUpdated', story.id, story.teamId, version, { change });
    if (story.status !== 'BREAKING' && synth.status === 'BREAKING') {
      await emit(tx, 'StoryBecameBreaking', story.id, story.teamId, version, {
        reason: decision?.reason,
      });
      await emitBreakingCandidate(
        tx,
        story.id,
        story.teamId,
        synth.importanceScore,
        version,
        decision?.reason ?? 'Verified high-importance development.',
      );
    }
    if (story.status !== 'RESOLVED' && synth.status === 'RESOLVED')
      await emit(tx, 'StoryResolved', story.id, story.teamId, version, {});
    if (Math.abs(story.importanceScore - synth.importanceScore) >= 10)
      await emit(tx, 'StoryImportanceChanged', story.id, story.teamId, version, {
        from: story.importanceScore,
        to: synth.importanceScore,
      });
    return version;
  });
}

export async function sourceHealth() {
  return authDb()`SELECT id,name,team_id,enabled,last_checked_at,last_successful_at,next_check_at,failure_count,last_error FROM content_sources ORDER BY failure_count DESC,priority DESC`;
}
export async function reviewRequiredStories(limit = 50) {
  return authDb()`SELECT s.id,s.team_id,s.headline,s.summary,s.status,s.confidence_score,s.importance_score,s.version,d.reason,d.created_at,(SELECT jsonb_agg(jsonb_build_object('name',cs.name,'url',e.source_url)) FROM story_evidence e JOIN content_sources cs ON cs.id=e.source_id WHERE e.story_id=s.id) AS sources FROM canonical_stories s LEFT JOIN story_publication_decisions d ON d.story_id=s.id AND d.story_version=s.version WHERE s.publication_state='REVIEW_REQUIRED' ORDER BY s.updated_at DESC LIMIT ${limit}`;
}
