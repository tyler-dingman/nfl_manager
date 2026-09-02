import { STORY_ENGINE_THRESHOLDS } from './config';
import type { ContentCandidate, StoryRecord } from './types';

const tokens = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
const jaccard = (left: Set<string>, right: Set<string>) => {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  return [...left].filter((word) => right.has(word)).length / union.size;
};

export type StoryMatch = {
  storyId?: string;
  similarity: number;
  confidence: number;
  reason: string;
  ambiguous: boolean;
};

export function findCandidateStory(
  candidate: ContentCandidate,
  stories: StoryRecord[],
): StoryMatch {
  const eligible = stories.filter(
    (story) =>
      (!story.teamId || candidate.candidateTeams.includes(story.teamId)) &&
      Math.abs(
        new Date(candidate.publishedAt).getTime() -
          new Date(story.lastMeaningfulUpdateAt).getTime(),
      ) <=
        72 * 3_600_000,
  );
  const ranked = eligible
    .map((story) => {
      const title = jaccard(tokens(candidate.normalizedTitle), tokens(story.headline));
      const entities = jaccard(
        new Set(candidate.entities.map((item) => item.toLowerCase())),
        new Set(story.entities.map((item) => item.toLowerCase())),
      );
      const type = candidate.storyType === story.storyType ? 1 : 0;
      return { story, similarity: title * 0.5 + entities * 0.35 + type * 0.15 };
    })
    .sort((a, b) => b.similarity - a.similarity);
  const best = ranked[0];
  if (!best || best.similarity < STORY_ENGINE_THRESHOLDS.ambiguous)
    return {
      similarity: best?.similarity ?? 0,
      confidence: 1 - (best?.similarity ?? 0),
      reason: 'No sufficiently similar recent story.',
      ambiguous: false,
    };
  if (best.similarity < STORY_ENGINE_THRESHOLDS.merge)
    return {
      storyId: best.story.id,
      similarity: best.similarity,
      confidence: 0.5,
      reason: 'Possible match requires editorial review.',
      ambiguous: true,
    };
  return {
    storyId: best.story.id,
    similarity: best.similarity,
    confidence: Math.min(1, best.similarity + 0.15),
    reason: 'Team, topic, entities, and headline overlap.',
    ambiguous: false,
  };
}
