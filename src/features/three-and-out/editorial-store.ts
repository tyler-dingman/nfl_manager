import type { EditorialOverride, ThreeAndOutStory } from './types';

const globalEditorialStore = globalThis as typeof globalThis & {
  __downDistanceEditorialOverrides?: Map<string, EditorialOverride[]>;
};

const overrides = (globalEditorialStore.__downDistanceEditorialOverrides ??= new Map());

export function getEditorialOverrides(teamId: string) {
  return overrides.get(teamId.toUpperCase()) ?? [];
}

export function saveEditorialOverride(teamId: string, override: EditorialOverride) {
  const key = teamId.toUpperCase();
  overrides.set(key, [...getEditorialOverrides(key), override]);
  return override;
}

export function applyEditorialOverrides(
  stories: ThreeAndOutStory[],
  editorialOverrides: EditorialOverride[],
) {
  const removed = new Set(
    editorialOverrides
      .filter((override) => override.action === 'REMOVE')
      .map((item) => item.storyId),
  );
  return stories
    .filter((story) => !removed.has(story.id))
    .map((story) => {
      const storyOverrides = editorialOverrides.filter((override) => override.storyId === story.id);
      return storyOverrides.reduce((current, override) => {
        if (override.action === 'PIN_FIRST') return { ...current, importanceScore: 101 };
        if (override.action === 'PROMOTE') {
          return {
            ...current,
            importanceScore: Math.min(100, current.importanceScore + Number(override.value ?? 10)),
          };
        }
        if (override.action === 'DEMOTE') {
          return {
            ...current,
            importanceScore: Math.max(0, current.importanceScore - Number(override.value ?? 10)),
          };
        }
        if (override.action === 'SET_STATUS' && typeof override.value === 'string') {
          return { ...current, status: override.value as ThreeAndOutStory['status'] };
        }
        if (override.action === 'EDIT' && typeof override.value === 'object') {
          return { ...current, ...(override.value as Partial<ThreeAndOutStory>), id: current.id };
        }
        return current;
      }, story);
    });
}
