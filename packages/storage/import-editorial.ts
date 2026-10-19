import { Storage } from './core';
import { D1EditorialIngestion } from './editorial-ingestion';
import { PublicEditorial } from './editorial';
import { DailyBriefings } from './briefings';
import { selectPrimarySource, type StoryView } from '../../src/features/story-engine/public-story';
import type { PostgresExport } from './import';
import type {
  StoryRecord,
  RegisteredSource,
  ContentCandidate,
} from '../../src/features/story-engine/types';
const stamp = (v: any) => (v == null ? null : new Date(v).getTime()),
  iso = (v: any) => (v == null ? null : new Date(v).toISOString());
export async function importEditorial(s: Storage, source: PostgresExport) {
  const rows = (name: string) =>
      source.tables.find((t) => t.name === name)?.rows.map((r) => JSON.parse(r)) ?? [],
    repo = new D1EditorialIngestion(s),
    sources = new Map<string, RegisteredSource>(),
    candidates = new Map<string, ContentCandidate>();
  let typed = 0;
  for (const r of rows('content_sources')) {
    const value: RegisteredSource = {
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
      lastCheckedAt: r.last_checked_at ? new Date(r.last_checked_at) : null,
      lastSuccessfulAt: r.last_successful_at ? new Date(r.last_successful_at) : null,
      nextCheckAt: new Date(r.next_check_at),
      failureCount: r.failure_count,
      lastError: r.last_error,
      metadata: r.metadata ?? {},
    };
    await repo.syncSource(value, true);
    await s
      .statement(
        'UPDATE app_editorial_sources SET etag=?,last_modified=?,last_checked_at=?,last_successful_at=?,last_item_at=?,failure_count=?,consecutive_failures=?,average_latency_ms=?,request_count=?,last_error=? WHERE id=?',
        [
          r.etag ?? null,
          r.last_modified ?? null,
          stamp(r.last_checked_at),
          stamp(r.last_successful_at),
          stamp(r.last_item_at),
          r.failure_count ?? 0,
          r.consecutive_failures ?? 0,
          r.average_latency_ms == null ? null : Number(r.average_latency_ms),
          r.request_count ?? 0,
          r.last_error ?? null,
          r.id,
        ],
      )
      .run();
    sources.set(r.id, value);
    typed++;
  }
  for (const r of rows('content_candidates')) {
    const c: ContentCandidate = {
      id: r.id,
      sourceId: r.source_id,
      externalId: r.external_id,
      url: r.canonical_url,
      title: r.title,
      normalizedTitle: r.normalized_title,
      author: r.author,
      publishedAt: iso(r.published_at)!,
      discoveredAt: iso(r.discovered_at)!,
      text: r.raw_text,
      excerpt: r.excerpt,
      entities: r.entities ?? [],
      candidateTeams: r.candidate_teams ?? [],
      fingerprint: r.fingerprint,
      status: r.status,
      storyType: r.metadata?.storyType ?? 'ANALYSIS',
    };
    if ((await repo.saveCandidate(c)) !== r.id) throw Error('Candidate import identity conflict');
    candidates.set(r.id, c);
    typed++;
  }
  const evidence = rows('story_evidence'),
    versions = rows('story_versions'),
    storyRows = rows('canonical_stories');
  for (const r of storyRows) {
    const story: StoryRecord = {
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
      firstReportedAt: iso(r.first_reported_at)!,
      lastMeaningfulUpdateAt: iso(r.last_meaningful_update_at)!,
      version: r.version,
      sourceItemCount: r.source_item_count,
      publisherCount: r.publisher_count,
      independentSourceCount: r.independent_source_count,
      hotReadQualifiedAt: iso(r.hot_read_qualified_at),
      hotReadUntil: iso(r.hot_read_until),
      clusterReason: r.cluster_reason,
    };
    const hash = await s.put({ schema: 1, story });
    await s
      .statement(
        'INSERT INTO app_editorial_stories(id,team_id,story_type,publication_state,status,version,object_hash,first_reported_at,last_meaningful_update_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          r.id,
          r.team_id,
          r.story_type,
          r.publication_state,
          r.status,
          r.version,
          hash,
          stamp(r.first_reported_at),
          stamp(r.last_meaningful_update_at),
          stamp(r.created_at),
          stamp(r.updated_at),
        ],
      )
      .run();
    typed++;
    const ev = evidence
      .filter((e) => e.story_id === r.id)
      .sort((a, b) => Date.parse(a.first_seen_at) - Date.parse(b.first_seen_at));
    for (const e of ev) {
      await s
        .statement(
          'INSERT INTO app_editorial_evidence(id,story_id,candidate_id,source_id,first_seen_at) VALUES(?,?,?,?,?)',
          [e.id, e.story_id, e.content_candidate_id, e.source_id, stamp(e.first_seen_at)],
        )
        .run();
      typed++;
    }
    const revisions = versions
      .filter((v) => v.story_id === r.id)
      .sort((a, b) => a.version - b.version);
    for (const v of revisions) {
      const snapshot = {
        ...story,
        headline: v.headline,
        summary: v.summary,
        whatHappened: v.what_happened,
        whyItMatters: v.why_it_matters,
        whatsNext: v.whats_next,
        status: v.status,
        publicationState: v.publication_state,
        importanceScore: v.importance_score,
        confidenceScore: v.confidence_score,
        version: v.version,
      };
      await s
        .statement(
          'INSERT INTO app_editorial_versions(id,story_id,version,object_hash,created_at) VALUES(?,?,?,?,?)',
          [
            v.id,
            r.id,
            v.version,
            await s.put({
              schema: 1,
              story: snapshot,
              synth: { ...snapshot, claims: v.claims ?? [] },
              change: v.material_change_type,
              evidenceIds: v.evidence_ids ?? [],
            }),
            stamp(v.created_at),
          ],
        )
        .run();
      typed++;
    }
    const publicSources = ev.map((e, i) => {
      const c = candidates.get(e.content_candidate_id),
        src = sources.get(e.source_id);
      if (!c || !src) throw Error('Missing editorial attribution relationship');
      return {
        id: e.id,
        name: src.name,
        url: e.source_url,
        publishedAt: c.publishedAt,
        official: ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(src.sourceType),
        original: i === 0,
      };
    });
    if (
      r.team_id &&
      ev.some(
        (e) =>
          sources.get(e.source_id)?.sourceType !== 'YOUTUBE' &&
          sources.get(e.source_id)?.metadata.platform !== 'YOUTUBE',
      )
    ) {
      const view: StoryView = {
        id: r.id,
        teamId: r.team_id,
        storyType: r.story_type,
        headline: r.headline,
        shortSummary: r.summary,
        whatHappened: r.what_happened,
        whyItMatters: r.why_it_matters,
        whatsNext: r.whats_next,
        status: r.status,
        importanceScore: r.importance_score,
        confidenceScore: r.confidence_score,
        firstReportedAt: iso(r.first_reported_at)!,
        lastMeaningfulUpdateAt: iso(r.last_meaningful_update_at)!,
        sources: publicSources,
        primarySource: selectPrimarySource(publicSources),
        version: r.version,
        sourceItemCount: r.source_item_count,
        publisherCount: r.publisher_count,
        independentSourceCount: r.independent_source_count,
        hotReadUntil: iso(r.hot_read_until),
        clusterReason: r.cluster_reason,
      };
      await new PublicEditorial(s).publish(view, r.publication_state);
    }
  }
  for (const r of rows('story_publication_decisions')) {
    await s
      .statement(
        'INSERT INTO app_editorial_decisions(id,story_id,story_version,action,reason,confidence,created_at) VALUES(?,?,?,?,?,?,?)',
        [r.id, r.story_id, r.story_version, r.action, r.reason, r.confidence, stamp(r.created_at)],
      )
      .run();
    typed++;
  }
  for (const r of rows('story_domain_events')) {
    const event = {
        id: r.id,
        eventType: r.event_type,
        storyId: r.story_id,
        storyVersion: r.story_version,
        occurredAt: iso(r.occurred_at),
        payload: r.payload ?? {},
      },
      hash = await s.put(event);
    await s
      .statement(
        'INSERT INTO app_editorial_events(id,event_type,story_id,team_id,story_version,idempotency_key,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?)',
        [
          r.id,
          r.event_type,
          r.story_id,
          r.team_id,
          r.story_version,
          r.idempotency_key,
          hash,
          stamp(r.occurred_at),
        ],
      )
      .run();
    if (r.team_id)
      await s
        .statement(
          'INSERT INTO app_public_wire(id,event_type,story_id,team_id,story_version,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?)',
          [r.id, r.event_type, r.story_id, r.team_id, r.story_version, hash, stamp(r.occurred_at)],
        )
        .run();
    typed++;
  }
  for (const r of rows('ingestion_jobs')) {
    await s
      .statement(
        'INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,status,attempts,max_attempts,available_at,created_at,updated_at,last_error) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          r.id,
          r.job_type,
          r.idempotency_key,
          JSON.stringify(r.payload),
          r.status === 'RUNNING' ? 'FAILED' : r.status,
          r.attempts,
          r.max_attempts,
          stamp(r.available_at),
          stamp(r.created_at),
          stamp(r.updated_at),
          r.last_error ?? null,
        ],
      )
      .run();
    typed++;
  }
  const incompleteBriefings: string[] = [];
  for (const r of rows('three_and_out_snapshots')) {
    if (r.status !== 'PUBLISHED' || !Array.isArray(r.items) || r.items.length !== 3) {
      incompleteBriefings.push(r.id);
      continue;
    }
    await new DailyBriefings(s).publish({
      id: r.id,
      teamId: r.team_id,
      briefingDate: String(r.briefing_date).slice(0, 10),
      generatedAt: iso(r.generated_at)!,
      publishedAt: iso(r.published_at),
      sourceWindowStart: iso(r.source_window_start),
      sourceWindowEnd: iso(r.source_window_end),
      summaryVersion: r.summary_version,
      items: r.items,
    });
    typed++;
  }
  return { typedRows: typed, incompleteBriefings };
}
