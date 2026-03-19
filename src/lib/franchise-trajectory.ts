import { computeTeamNeeds, normalizeOverviewPosition, resolvePlayerRating, type TeamNeed } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';

export type FranchiseTrajectoryState =
  | 'Contender'
  | 'Rising'
  | 'Balanced'
  | 'Declining'
  | 'Rebuilding';

export type FranchiseTrajectory = {
  score: number;
  state: FranchiseTrajectoryState;
  ovrScore: number;
  youngCoreScore: number;
  capHealthScore: number;
  depthScore: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeCapLimitMillions = (capLimit: number) => (capLimit > 1_000 ? capLimit / 1_000_000 : capLimit);

const NEED_STARTER_COUNT: Record<TeamNeed, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  OT: 2,
  IOL: 3,
  EDGE: 2,
  DL: 2,
  LB: 3,
  CB: 3,
  S: 2,
};

const toNeedGroup = (position: string): TeamNeed | null => {
  const bucket = normalizeOverviewPosition(position);
  switch (bucket) {
    case 'QB':
      return 'QB';
    case 'RB':
      return 'RB';
    case 'WR':
      return 'WR';
    case 'TE':
      return 'TE';
    case 'LT':
    case 'RT':
      return 'OT';
    case 'LG':
    case 'C':
    case 'RG':
      return 'IOL';
    case 'EDGE':
      return 'EDGE';
    case 'DL':
      return 'DL';
    case 'LB':
      return 'LB';
    case 'CB':
      return 'CB';
    case 'S':
      return 'S';
    default:
      return null;
  }
};

const computeYoungCoreScore = (roster: PlayerRowDTO[]) => {
  const youngCore = roster
    .filter((player) => (player.age ?? 99) <= 25)
    .map((player) => resolvePlayerRating(player))
    .filter((rating): rating is number => rating !== null)
    .sort((left, right) => right - left)
    .slice(0, 8);

  if (youngCore.length === 0) {
    return 42;
  }

  const average = youngCore.reduce((sum, rating) => sum + rating, 0) / youngCore.length;
  const densityBonus = clamp(youngCore.length / 8, 0, 1) * 10;
  return clamp(average + densityBonus - 5, 35, 98);
};

const computeCapHealthScore = (capSpace: number, capLimit: number) => {
  const capLimitMillions = Math.max(1, normalizeCapLimitMillions(capLimit));
  const capRatio = capSpace / capLimitMillions;
  const normalized = 62 + capRatio * 320;
  return clamp(normalized, 20, 96);
};

const computeDepthScore = (roster: PlayerRowDTO[]) => {
  const ratedRoster = roster.filter((player) => resolvePlayerRating(player) !== null);
  if (ratedRoster.length === 0) {
    return 35;
  }

  const needs = computeTeamNeeds(ratedRoster);
  const grouped = new Map<TeamNeed, number[]>();

  ratedRoster.forEach((player) => {
    const needGroup = toNeedGroup(player.position);
    const rating = resolvePlayerRating(player);
    if (!needGroup || rating === null) {
      return;
    }
    const ratings = grouped.get(needGroup) ?? [];
    ratings.push(rating);
    grouped.set(needGroup, ratings);
  });

  grouped.forEach((ratings) => ratings.sort((left, right) => right - left));

  let totalPenalty = 0;
  needs.forEach((need, index) => {
    const starterCount = NEED_STARTER_COUNT[need];
    const room = grouped.get(need) ?? [];
    const starters = room.slice(0, starterCount);
    const average =
      starters.length > 0
        ? starters.reduce((sum, rating) => sum + rating, 0) / starters.length
        : 55;
    const shortagePenalty = starters.length < starterCount ? (starterCount - starters.length) * 5 : 0;
    const weaknessPenalty = Math.max(0, 74 - average) * (index === 0 ? 1.7 : index === 1 ? 1.25 : 0.95);
    totalPenalty += shortagePenalty + weaknessPenalty;
  });

  const depthContribution = clamp(88 - totalPenalty, 28, 92);
  return depthContribution;
};

const resolveTrajectoryState = (score: number): FranchiseTrajectoryState => {
  if (score >= 79) return 'Contender';
  if (score >= 75) return 'Rising';
  if (score >= 67) return 'Balanced';
  if (score >= 58) return 'Declining';
  return 'Rebuilding';
};

export const computeFranchiseTrajectory = ({
  roster,
  teamOverview,
  capSpace,
  capLimit,
}: {
  roster: PlayerRowDTO[];
  teamOverview: number | null | undefined;
  capSpace: number;
  capLimit: number;
}): FranchiseTrajectory => {
  const ovrScore = clamp(teamOverview ?? 68, 45, 97);
  const youngCoreScore = computeYoungCoreScore(roster);
  const capHealthScore = computeCapHealthScore(capSpace, capLimit);
  const depthScore = computeDepthScore(roster);

  const score = Math.round(
    ovrScore * 0.5 + youngCoreScore * 0.2 + capHealthScore * 0.15 + depthScore * 0.15,
  );

  return {
    score,
    state: resolveTrajectoryState(score),
    ovrScore,
    youngCoreScore,
    capHealthScore,
    depthScore,
  };
};
