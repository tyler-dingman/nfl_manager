import { authDb } from '@/server/auth/database';
import {
  isStoryPublishable,
  selectPrimarySource,
  type StorySourceView,
  type StoryView,
} from '@/features/story-engine/public-story';
import type { StoryRecord } from '@/features/story-engine/types';
import { selectWireEvents } from '@/features/story-engine/surface-selectors';

const storyRecord = (r: any): StoryRecord => ({
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
  lastMeaningfulUpdateAt: r.last_meaningful_update_at,
  version: r.version,
  sourceItemCount: r.source_item_count,
  publisherCount: r.publisher_count,
  independentSourceCount: r.independent_source_count,
  hotReadQualifiedAt: r.hot_read_qualified_at,
  hotReadUntil: r.hot_read_until,
  clusterReason: r.cluster_reason,
});
export async function listPublicStories(teamId: string, limit = 30): Promise<StoryView[]> {
  const sql = authDb();
  const rows =
    await sql`SELECT s.*,COUNT(e.id)::int AS source_count FROM canonical_stories s LEFT JOIN story_evidence e ON e.story_id=s.id WHERE s.team_id=${teamId} AND s.publication_state IN ('PUBLISHED','AUTO_PUBLISHED') AND s.status<>'HOLDING' GROUP BY s.id ORDER BY s.importance_score DESC,s.last_meaningful_update_at DESC LIMIT ${limit}`;
  const published = rows.filter((r: any) =>
    isStoryPublishable({ ...storyRecord(r), sourceCount: r.source_count }),
  );
  if (!published.length) return [];
  const ids = published.map((r: any) => r.id);
  const ev =
    await sql`SELECT e.story_id,e.id,e.source_url,e.first_seen_at,e.support_type,c.published_at,s.name,s.source_type FROM story_evidence e JOIN content_candidates c ON c.id=e.content_candidate_id JOIN content_sources s ON s.id=e.source_id WHERE e.story_id=ANY(${ids}) ORDER BY e.first_seen_at`;
  const by = new Map<string, StorySourceView[]>();
  for (const r of ev) {
    const list = by.get(r.story_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      url: r.source_url,
      publishedAt: r.published_at.toISOString(),
      official: r.source_type === 'OFFICIAL_TEAM' || r.source_type === 'NFL_OFFICIAL',
      original: list.length === 0,
    });
    by.set(r.story_id, list);
  }
  return published.map((r: any) => {
    const sources = by.get(r.id) ?? [];
    return {
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
      firstReportedAt: r.first_reported_at.toISOString(),
      lastMeaningfulUpdateAt: r.last_meaningful_update_at.toISOString(),
      sources,
      primarySource: selectPrimarySource(sources),
      version: r.version,
      sourceItemCount: r.source_item_count,
      publisherCount: r.publisher_count,
      independentSourceCount: r.independent_source_count,
      hotReadUntil: r.hot_read_until?.toISOString() ?? null,
      clusterReason: r.cluster_reason,
    };
  });
}

export async function getPublicStoryById(id: string): Promise<StoryView | null> {
  const sql = authDb();
  const [row] =
    await sql`SELECT s.*,COUNT(e.id)::int AS source_count FROM canonical_stories s LEFT JOIN story_evidence e ON e.story_id=s.id WHERE s.id=${id} AND s.publication_state IN ('PUBLISHED','AUTO_PUBLISHED') AND s.status<>'HOLDING' GROUP BY s.id`;
  if (!row || !isStoryPublishable({ ...storyRecord(row), sourceCount: row.source_count }))
    return null;
  const evidence =
    await sql`SELECT e.id,e.source_url,c.published_at,s.name,s.source_type FROM story_evidence e JOIN content_candidates c ON c.id=e.content_candidate_id JOIN content_sources s ON s.id=e.source_id WHERE e.story_id=${id} ORDER BY e.first_seen_at`;
  const sources: StorySourceView[] = evidence.map((item: any, index: number) => ({
    id: item.id,
    name: item.name,
    url: item.source_url,
    publishedAt: item.published_at.toISOString(),
    official: item.source_type === 'OFFICIAL_TEAM' || item.source_type === 'NFL_OFFICIAL',
    original: index === 0,
  }));
  return {
    id: row.id,
    teamId: row.team_id,
    storyType: row.story_type,
    headline: row.headline,
    shortSummary: row.summary,
    whatHappened: row.what_happened,
    whyItMatters: row.why_it_matters,
    whatsNext: row.whats_next,
    status: row.status,
    importanceScore: row.importance_score,
    confidenceScore: row.confidence_score,
    firstReportedAt: row.first_reported_at.toISOString(),
    lastMeaningfulUpdateAt: row.last_meaningful_update_at.toISOString(),
    sources,
    primarySource: selectPrimarySource(sources),
    version: row.version,
    sourceItemCount: row.source_item_count,
    publisherCount: row.publisher_count,
    independentSourceCount: row.independent_source_count,
    hotReadUntil: row.hot_read_until?.toISOString() ?? null,
    clusterReason: row.cluster_reason,
  };
}

export type WireEntry = {
  id: string;
  storyId: string;
  storyVersion: number;
  teamId: string;
  type: 'NEW' | 'UPDATE' | 'BREAKING' | 'RESOLVED' | 'OFFICIAL';
  headline: string;
  summary: string;
  occurredAt: string;
  sources: StorySourceView[];
  primarySource: StorySourceView | null;
};
export async function listWireEntries(teamId: string, limit = 20): Promise<WireEntry[]> {
  const stories = await listPublicStories(teamId, 50),
    byId = new Map(stories.map((s) => [s.id, s]));
  if (!stories.length) return [];
  const rows =
    await authDb()`SELECT * FROM story_domain_events WHERE team_id=${teamId} AND story_id=ANY(${stories.map((s) => s.id)}) ORDER BY occurred_at DESC LIMIT ${limit * 2}`;
  const selected = selectWireEvents(
    rows.map((r: any) => ({
      id: r.id,
      eventType: r.event_type,
      storyId: r.story_id,
      storyVersion: r.story_version,
      occurredAt: r.occurred_at.toISOString(),
      payload: r.payload ?? {},
    })),
  ).slice(0, limit);
  return selected.flatMap((event) => {
    const r = rows.find((row: any) => row.id === event.id)!;
    const story = byId.get(r.story_id);
    if (!story) return [];
    const type =
      r.event_type === 'StoryCreated'
        ? 'NEW'
        : r.event_type === 'StoryResolved'
          ? 'RESOLVED'
          : r.event_type === 'StoryBecameBreaking'
            ? 'BREAKING'
            : r.payload?.change === 'OFFICIAL_CONFIRMATION'
              ? 'OFFICIAL'
              : 'UPDATE';
    return [
      {
        id: r.id,
        storyId: story.id,
        storyVersion: r.story_version,
        teamId,
        type,
        headline: story.headline,
        summary: story.shortSummary,
        occurredAt: r.occurred_at.toISOString(),
        sources: story.sources,
        primarySource: story.primarySource,
      },
    ];
  });
}
