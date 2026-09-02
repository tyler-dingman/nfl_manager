import type { StoryView } from './public-story';
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
  const excluded = new Set(excludedIds),
    pool = stories
      .filter((s) => !excluded.has(s.id))
      .sort(
        (a, b) =>
          b.importanceScore - a.importanceScore ||
          b.lastMeaningfulUpdateAt.localeCompare(a.lastMeaningfulUpdateAt),
      ),
    selected: StoryView[] = [];
  while (pool.length && selected.length < limit) {
    const used = new Set(selected.map((s) => s.storyType)),
      index = pool.findIndex((s) => !used.has(s.storyType));
    selected.push(...pool.splice(index < 0 ? 0 : index, 1));
  }
  if (selected.length < limit)
    selected.push(
      ...stories
        .filter((s) => excluded.has(s.id) && !selected.some((x) => x.id === s.id))
        .slice(0, limit - selected.length),
    );
  return selected.slice(0, limit);
}
