import type { SourceDefinition } from '@/data/sources';

import { clusterSourceItems } from './clustering';
import { calculateHuddleScore, confidenceFor, determineStatus, freshnessFor } from './scoring';
import type { CanonicalEvent, EventType, HuddleWeights, SourceItem, Story } from './types';

const eventImportance: Record<EventType, number> = {
  TRADE: 95,
  SIGNING: 88,
  RELEASE: 86,
  INJURY: 92,
  SUSPENSION: 92,
  COACHING: 90,
  DRAFT: 88,
  CONTRACT: 82,
  TRANSACTION: 80,
  DEPTH_CHART: 76,
  ROSTER: 74,
  GAME: 72,
  PRACTICE: 66,
  QUOTE: 55,
  RUMOR: 50,
  ANALYSIS: 45,
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);

export const buildCanonicalEvents = ({
  teamId,
  items,
  sources,
  weights,
}: {
  teamId: string;
  items: SourceItem[];
  sources: SourceDefinition[];
  weights?: HuddleWeights;
}): { stories: Story[]; events: CanonicalEvent[] } => {
  const definitions = new Map(sources.map((source) => [source.id, source]));
  const events = clusterSourceItems(items).map((cluster, index) => {
    const first = cluster[0];
    if (!first) throw new Error('Cannot build an event from an empty cluster');
    const sorted = [...cluster].sort((left, right) =>
      left.publishedAt.localeCompare(right.publishedAt),
    );
    const status = determineStatus(sorted, definitions);
    const firstReportedAt = sorted[0]?.publishedAt ?? new Date().toISOString();
    const updatedAt = sorted.at(-1)?.publishedAt ?? firstReportedAt;
    const officialItem = sorted.find(
      (item) => definitions.get(item.sourceId)?.category === 'OFFICIAL',
    );
    const uniqueEntities = [...new Set(sorted.flatMap((item) => item.entities))];
    const uniqueTags = [...new Set(sorted.flatMap((item) => item.tags))];
    const sourceDefinitions = sorted
      .map((item) => definitions.get(item.sourceId))
      .filter((source): source is SourceDefinition => Boolean(source));
    const importanceScore = Math.min(
      100,
      eventImportance[first.type] + (officialItem ? 4 : 0) + Math.min(4, sorted.length),
    );
    const confidenceScore = confidenceFor(status, sorted, definitions);
    const freshnessScore = freshnessFor(updatedAt);
    const fanInterestScore = Math.min(
      100,
      Math.max(
        35,
        ...sourceDefinitions.map((source) => source.fanInterestScore ?? 0),
        ...sorted.map((item) => item.engagementScore ?? 0),
      ),
    );
    const teamRelevanceScore = Math.max(
      0,
      ...sourceDefinitions.map((source) => source.teamRelevanceScore),
    );
    const id = `${teamId.toLowerCase()}-${first.type.toLowerCase()}-${slug(uniqueEntities.join('-') || first.title)}-${index}`;
    const storyId = `${teamId.toLowerCase()}-story-${slug(uniqueEntities.join('-') || first.title)}`;
    const headline = officialItem?.title ?? sorted.at(-1)?.title ?? first.title;
    const summary = sorted
      .filter(
        (item, itemIndex) =>
          itemIndex === 0 ||
          item.claims.some(
            (claim) =>
              !sorted
                .slice(0, itemIndex)
                .flatMap((prior) => prior.claims)
                .includes(claim),
          ),
      )
      .slice(0, 3)
      .map((item) => item.excerpt)
      .join(' ');

    return {
      id,
      storyId,
      teamId,
      sport: 'NFL' as const,
      type: first.type,
      headline,
      summary,
      status,
      importanceScore,
      confidenceScore,
      freshnessScore,
      fanInterestScore,
      teamRelevanceScore,
      huddleScore: calculateHuddleScore(
        {
          importance: importanceScore,
          teamRelevance: teamRelevanceScore,
          freshness: freshnessScore,
          fanInterest: fanInterestScore,
          confidence: confidenceScore,
        },
        weights,
      ),
      createdAt: firstReportedAt,
      updatedAt,
      firstReportedAt,
      officialAt: officialItem?.publishedAt,
      entities: uniqueEntities,
      sourceItems: sorted,
      relatedVideos: sorted.filter(
        (item) => definitions.get(item.sourceId)?.platform === 'YOUTUBE' || Boolean(item.videoId),
      ),
      communityLinks: sorted.filter(
        (item) => definitions.get(item.sourceId)?.category === 'COMMUNITY',
      ),
      tags: uniqueTags,
      updates: sorted.map((item, updateIndex) => ({
        id: `${id}-update-${updateIndex}`,
        eventId: id,
        sourceItemIds: [item.id],
        headline: item.title,
        summary: item.excerpt,
        status: determineStatus(sorted.slice(0, updateIndex + 1), definitions),
        createdAt: item.publishedAt,
      })),
    } satisfies CanonicalEvent;
  });

  const stories = new Map<string, Story>();
  events.forEach((event) => {
    const existing = stories.get(event.storyId);
    stories.set(event.storyId, {
      id: event.storyId,
      teamId,
      title: existing?.title ?? event.headline,
      eventIds: [...(existing?.eventIds ?? []), event.id],
      createdAt: existing?.createdAt ?? event.createdAt,
      updatedAt:
        event.updatedAt > (existing?.updatedAt ?? '') ? event.updatedAt : existing!.updatedAt,
    });
  });

  return {
    stories: [...stories.values()],
    events: events.sort((left, right) => right.huddleScore - left.huddleScore),
  };
};
