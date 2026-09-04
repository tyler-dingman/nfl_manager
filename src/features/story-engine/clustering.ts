import { STORY_ENGINE_THRESHOLDS, storyClusterWindowHours } from './config';
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
  const windowHours = storyClusterWindowHours(candidate.storyType);
  const eligible = stories.filter(
    (story) =>
      (!story.teamId || candidate.candidateTeams.includes(story.teamId)) &&
      Math.abs(
        new Date(candidate.publishedAt).getTime() -
          new Date(story.lastMeaningfulUpdateAt).getTime(),
      ) <=
        windowHours * 3_600_000,
  );
  const ranked = eligible
    .map((story) => {
      const title = jaccard(tokens(candidate.normalizedTitle), tokens(story.headline));
      const entities = jaccard(
        new Set(candidate.entities.map((item) => item.toLowerCase())),
        new Set(story.entities.map((item) => item.toLowerCase())),
      );
      const exactEntity = candidate.entities.some((entity) =>
        story.entities.some((existing) => existing.toLowerCase() === entity.toLowerCase()),
      );
      const type = candidate.storyType === story.storyType ? 1 : 0;
      const body = jaccard(
        tokens(`${candidate.excerpt} ${candidate.text}`),
        tokens(`${story.summary} ${story.whatHappened}`),
      );
      const analysis = candidate.storyType === 'ANALYSIS' || story.storyType === 'ANALYSIS';
      const concreteEntity = exactEntity || entities > 0;
      let similarity = title * 0.33 + (exactEntity ? 1 : entities) * 0.27 + type * 0.2 + body * 0.1;
      if (exactEntity && type === 1) similarity += 0.2;
      if (type === 0 && !analysis) similarity = Math.min(similarity, 0.49);
      return {
        story,
        similarity: analysis && (!concreteEntity || type !== 1 || title < 0.8) ? 0 : similarity,
        details: { title, entities, type, body },
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
  const best = ranked[0];
  if (!best || best.similarity < STORY_ENGINE_THRESHOLDS.ambiguous)
    return {
      similarity: best?.similarity ?? 0,
      confidence: 1 - (best?.similarity ?? 0),
      reason: `NOT MERGED: no same-event match within the ${windowHours}-hour ${candidate.storyType.toLowerCase()} window.`,
      ambiguous: false,
    };
  if (best.similarity < STORY_ENGINE_THRESHOLDS.merge)
    return {
      storyId: best.story.id,
      similarity: best.similarity,
      confidence: 0.5,
      reason: `PENDING: possible match (semantic similarity ${best.similarity.toFixed(2)}) requires review.`,
      ambiguous: true,
    };
  return {
    storyId: best.story.id,
    similarity: best.similarity,
    confidence: Math.min(1, best.similarity + 0.15),
    reason: `MERGED: same ${candidate.storyType} event with entity/headline/body similarity ${best.similarity.toFixed(2)}.`,
    ambiguous: false,
  };
}
