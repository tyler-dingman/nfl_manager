import type { StoryScoreSignals, ThreeAndOutStory } from './types';

export const DEFAULT_RANKING_WEIGHTS = {
  footballImpact: 0.35,
  sourceStrength: 0.2,
  velocity: 0.15,
  freshness: 0.1,
  fanInterest: 0.1,
  novelty: 0.1,
} satisfies Record<keyof StoryScoreSignals, number>;

export type RankingWeights = typeof DEFAULT_RANKING_WEIGHTS;

export function calculateImportanceScore(
  signals: StoryScoreSignals,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
) {
  return Math.round(
    (Object.keys(weights) as (keyof StoryScoreSignals)[]).reduce(
      (total, key) => total + Math.max(0, Math.min(100, signals[key])) * weights[key],
      0,
    ),
  );
}

export function rankThreeAndOutStories(stories: ThreeAndOutStory[]) {
  return [...stories]
    .sort((left, right) => {
      if (left.status === 'BREAKING' && right.status !== 'BREAKING') return -1;
      if (right.status === 'BREAKING' && left.status !== 'BREAKING') return 1;
      return right.importanceScore - left.importanceScore;
    })
    .map((story, index) => ({ ...story, currentRank: index + 1 }));
}
