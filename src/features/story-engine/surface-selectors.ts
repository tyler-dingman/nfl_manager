import type { StoryView } from './public-story';
import { rankTeamStories, storyTopicKey } from '@/features/content/team-story-importance-service';
export type DomainEventView = {
  id: string;
  eventType: string;
  storyId: string;
  storyVersion: number;
  occurredAt: string;
  payload: Record<string, unknown>;
};
export function selectWireEvents(events: DomainEventView[]) {
  const priority: Record<string, number> = {
    StoryResolved: 5,
    StoryBecameBreaking: 4,
    StoryUpdated: 3,
    StoryCreated: 2,
    StoryImportanceChanged: 1,
  };
  const byVersion = new Map<string, DomainEventView>();
  for (const event of events.filter((e) =>
    ['StoryCreated', 'StoryUpdated', 'StoryBecameBreaking', 'StoryResolved'].includes(e.eventType),
  )) {
    const key = `${event.storyId}:${event.storyVersion}`,
      existing = byVersion.get(key);
    if (!existing || (priority[event.eventType] ?? 0) > (priority[existing.eventType] ?? 0))
      byVersion.set(key, event);
  }
  return [...byVersion.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
export function selectHuddleStories(stories: StoryView[], excludedIds: string[], limit = 4) {
  const excluded = new Set(excludedIds);
  const tokens = (story: StoryView) =>
    new Set(
      storyTopicKey({
        id: story.id,
        headline: story.headline,
        summary: story.shortSummary,
        category: story.storyType,
        updatedAt: story.lastMeaningfulUpdateAt,
      })
        .split(' ')
        .filter(Boolean),
    );
  const overlap = (left: StoryView, right: StoryView) => {
    const a = tokens(left),
      b = tokens(right);
    return a.size && b.size
      ? [...a].filter((token) => b.has(token)).length / Math.min(a.size, b.size)
      : 0;
  };
  const unique = stories
    .filter((story) => !excluded.has(story.id))
    .filter(
      (story, index, all) =>
        all.findIndex(
          (candidate) => candidate.id === story.id || overlap(candidate, story) >= 0.72,
        ) === index,
    );
  const pool = rankTeamStories(
      unique.map((story) => ({
        ...story,
        updatedAt: story.lastMeaningfulUpdateAt,
        publishedAt: story.firstReportedAt,
        category: story.storyType,
        summary: story.shortSummary,
        sourceCount: story.sources.length,
        officialSource: story.sources.some((source) => source.official),
      })),
    ),
    selected: StoryView[] = [];
  while (pool.length && selected.length < limit) {
    const used = new Set(selected.map((s) => s.storyType)),
      index = pool.findIndex((s) => !used.has(s.storyType));
    selected.push(...pool.splice(index < 0 ? 0 : index, 1));
  }
  if (selected.length < limit)
    selected.push(
      ...unique
        .filter((s) => excluded.has(s.id) && !selected.some((x) => x.id === s.id))
        .slice(0, limit - selected.length),
    );
  return selected.slice(0, limit);
}
