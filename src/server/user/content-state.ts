export type CatchUpStory = { id: string; lastMaterialUpdateAt: string; title: string };

export function buildCatchMeUp(input: {
  previousVisit: { lastVisitedAt?: string | Date; lastSeenSnapshotId?: string | null } | null;
  currentSnapshotId: string;
  stories: CatchUpStory[];
  currentAudioVersion?: string | null;
  previousAudioVersion?: string | null;
}) {
  const visitedAt = input.previousVisit?.lastVisitedAt
    ? new Date(input.previousVisit.lastVisitedAt).getTime()
    : 0;
  const materiallyUpdated = input.stories.filter(
    (story) => Number.isFinite(new Date(story.lastMaterialUpdateAt).getTime()) && new Date(story.lastMaterialUpdateAt).getTime() > visitedAt,
  );
  return {
    hasUpdates: Boolean(input.previousVisit && (materiallyUpdated.length || input.currentSnapshotId !== input.previousVisit.lastSeenSnapshotId)),
    newDevelopmentCount: materiallyUpdated.length,
    materiallyUpdatedStoryIds: materiallyUpdated.map((story) => story.id),
    newAudio: Boolean(input.previousVisit && input.currentAudioVersion && input.currentAudioVersion !== input.previousAudioVersion),
    currentSnapshotId: input.currentSnapshotId,
  };
}