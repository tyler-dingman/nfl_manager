import type { PlayerRowDTO } from '@/types/player';
import { createRng } from '@/lib/deterministic-rng';

export const clampYears = (years: number) => Math.max(1, Math.min(5, Math.round(years)));

const normalizeWeights = (weights: number[]) => {
  const total = weights.reduce((sum, value) => sum + value, 0);
  return total > 0 ? weights.map((value) => value / total) : weights.map(() => 0);
};

export const getYearsFit = (preferredYears: number, years: number) => {
  const diff = Math.abs(preferredYears - years);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.85;
  if (diff === 2) return 0.65;
  if (diff === 3) return 0.45;
  return 0.3;
};

export const getPreferredYearsForPlayer = (player: PlayerRowDTO): number => {
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  let weights = [0.25, 0.4, 0.25, 0.08, 0.02];

  if (age >= 32) {
    weights = [weights[0] + 0.1, weights[1] + 0.05, weights[2] - 0.08, weights[3] - 0.05, weights[4] - 0.02];
  } else if (age >= 30) {
    weights = [weights[0] + 0.05, weights[1] + 0.05, weights[2] - 0.05, weights[3] - 0.03, weights[4] - 0.02];
  }

  if (age <= 29 && rating >= 85) {
    weights = [weights[0] - 0.05, weights[1] - 0.05, weights[2] + 0.05, weights[3] + 0.03, weights[4] + 0.02];
  }

  const normalized = normalizeWeights(weights);
  const rng = createRng(`preferred-years:${player.id}:${age}:${rating}`);
  const roll = rng();
  let running = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    running += normalized[i] ?? 0;
    if (roll <= running) {
      return clampYears(i + 1);
    }
  }
  return 2;
};

export const getAllowedYearOptions = (player: PlayerRowDTO): number[] => {
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const preferred = getPreferredYearsForPlayer(player);
  const rng = createRng(`allowed-years:${player.id}:${age}:${rating}`);
  const options = new Set<number>([1, 2, 3]);

  if (preferred >= 4 || (age <= 29 && rating >= 85 && rng() < 0.35)) {
    options.add(4);
  }
  if (preferred >= 5 || (age <= 27 && rating >= 90 && rng() < 0.12)) {
    options.add(5);
  }

  return Array.from(options).sort((a, b) => a - b);
};

if (process.env.NODE_ENV !== 'production') {
  const sample: PlayerRowDTO = {
    id: 'sample-player',
    firstName: 'Sample',
    lastName: 'Player',
    position: 'QB',
    contractYearsRemaining: 1,
    capHit: '$0.0M',
    status: 'Free Agent',
  };
  let max = 0;
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 500; i += 1) {
    const years = getPreferredYearsForPlayer({ ...sample, id: `p-${i}` });
    counts[years - 1] += 1;
    max = Math.max(max, years);
  }
  console.assert(max <= 5, 'Preferred years should never exceed 5');
  const shareOneToThree = (counts[0] + counts[1] + counts[2]) / 500;
  console.assert(shareOneToThree >= 0.7, 'Preferred years should mostly be 1–3');
}
