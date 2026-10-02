export function selectBeatHeroStories<
  T extends { id: string; headline: string; sourceCount?: number; updatedAt: string },
>(
  current: T[],
  catchUp?: {
    eligible: boolean;
    mode?: string;
    items: {
      storyId: string;
      headline: string;
      sourceCount: number;
      occurredAt?: string;
      importanceScore?: number;
    }[];
  } | null,
) {
  const changes =
    catchUp?.eligible && catchUp.mode === 'CHANGES'
      ? [...catchUp.items].sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0))
      : [];
  const ranked = changes.map((item) => ({
    id: item.storyId,
    headline: item.headline,
    sourceCount: item.sourceCount,
    updatedAt: item.occurredAt ?? '',
    briefing: current.find((story) => story.id === item.storyId),
    isNew: true,
  }));
  const seen = new Set(ranked.map((story) => story.id));
  const stories = [
    ...ranked,
    ...current
      .filter((story) => !seen.has(story.id))
      .map((story) => ({
        id: story.id,
        headline: story.headline,
        sourceCount: story.sourceCount,
        updatedAt: story.updatedAt,
        briefing: story,
        isNew: false,
      })),
  ];
  return stories
    .filter((story, index) => stories.findIndex((other) => other.id === story.id) === index)
    .slice(0, 3);
}

export function selectFilmHeroVideos<
  T extends { score?: number; publishedAt: string | null; addedAt?: string },
>(videos: T[]) {
  const time = (video: T) => Date.parse(video.publishedAt ?? video.addedAt ?? '') || 0;
  return [...videos]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || time(b) - time(a))
    .slice(0, 3);
}
