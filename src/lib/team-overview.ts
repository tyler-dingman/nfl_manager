export type TeamOverview = {
  overall: number;
  offense: number;
  defense: number;
  specialTeams: number;
  grade: string;
};

export type TeamOverviewRaw = {
  overall: number;
  offense: number;
  defense: number;
  specialTeams: number;
};

export type TeamNeed = 'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'IOL' | 'EDGE' | 'DL' | 'LB' | 'CB' | 'S';

export type OverviewPlayer = {
  position: string;
  rating?: number | null;
  maddenRating?: number | null;
  baselineRating?: number | null;
};

type OverviewBucket =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'LT'
  | 'LG'
  | 'C'
  | 'RG'
  | 'RT'
  | 'EDGE'
  | 'DL'
  | 'LB'
  | 'CB'
  | 'S'
  | 'K'
  | 'P'
  | 'OTHER';

type WeightedSlot = {
  bucket: OverviewBucket;
  count: number;
  weight: number;
};

type NeedGroup = {
  label: TeamNeed;
  buckets: OverviewBucket[];
  starterCount: number;
};

const STARTER_SLOTS: WeightedSlot[] = [
  { bucket: 'QB', count: 1, weight: 1.35 },
  { bucket: 'RB', count: 2, weight: 1.0 },
  { bucket: 'WR', count: 3, weight: 1.2 },
  { bucket: 'TE', count: 1, weight: 0.7 },
  { bucket: 'LT', count: 1, weight: 0.35 },
  { bucket: 'LG', count: 1, weight: 0.35 },
  { bucket: 'C', count: 1, weight: 0.35 },
  { bucket: 'RG', count: 1, weight: 0.35 },
  { bucket: 'RT', count: 1, weight: 0.35 },
  { bucket: 'EDGE', count: 2, weight: 1.1 },
  { bucket: 'DL', count: 2, weight: 1.0 },
  { bucket: 'LB', count: 3, weight: 1.0 },
  { bucket: 'CB', count: 3, weight: 1.15 },
  { bucket: 'S', count: 2, weight: 0.8 },
  { bucket: 'K', count: 1, weight: 0.15 },
  { bucket: 'P', count: 1, weight: 0.1 },
];

const OFFENSE_BUCKETS = new Set<OverviewBucket>([
  'QB',
  'RB',
  'WR',
  'TE',
  'LT',
  'LG',
  'C',
  'RG',
  'RT',
]);
const DEFENSE_BUCKETS = new Set<OverviewBucket>(['EDGE', 'DL', 'LB', 'CB', 'S']);
const SPECIAL_TEAMS_BUCKETS = new Set<OverviewBucket>(['K', 'P']);
const NEED_GROUPS: NeedGroup[] = [
  { label: 'QB', buckets: ['QB'], starterCount: 1 },
  { label: 'RB', buckets: ['RB'], starterCount: 2 },
  { label: 'WR', buckets: ['WR'], starterCount: 3 },
  { label: 'TE', buckets: ['TE'], starterCount: 1 },
  { label: 'OT', buckets: ['LT', 'RT'], starterCount: 2 },
  { label: 'IOL', buckets: ['LG', 'C', 'RG'], starterCount: 3 },
  { label: 'EDGE', buckets: ['EDGE'], starterCount: 2 },
  { label: 'DL', buckets: ['DL'], starterCount: 2 },
  { label: 'LB', buckets: ['LB'], starterCount: 3 },
  { label: 'CB', buckets: ['CB'], starterCount: 3 },
  { label: 'S', buckets: ['S'], starterCount: 2 },
];
const MISSING_STARTER_RATING = 55;

const clampScore = (value: number, min = 60, max = 99) => Math.max(min, Math.min(max, value));

export const resolvePlayerRating = (player: OverviewPlayer): number | null => {
  const resolved = player.rating ?? player.maddenRating ?? player.baselineRating;
  return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : null;
};

export const normalizeOverviewPosition = (position: string): OverviewBucket => {
  const normalized = position.trim().toUpperCase();

  if (normalized === 'QB') return 'QB';
  if (['HB', 'RB', 'FB'].includes(normalized)) return 'RB';
  if (normalized === 'WR') return 'WR';
  if (normalized === 'TE') return 'TE';
  if (normalized === 'LT') return 'LT';
  if (normalized === 'LG') return 'LG';
  if (normalized === 'C') return 'C';
  if (normalized === 'RG') return 'RG';
  if (normalized === 'RT') return 'RT';
  if (['LE', 'RE', 'DE', 'EDGE', 'ED', 'OLB', 'LOLB', 'ROLB'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(normalized)) return 'DL';
  if (['LB', 'ILB', 'MLB', 'MIKE', 'SAM', 'WILL'].includes(normalized)) return 'LB';
  if (normalized === 'CB') return 'CB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  if (normalized === 'K') return 'K';
  if (normalized === 'P') return 'P';

  return 'OTHER';
};

export const computeOverviewGrade = (overall: number): string => {
  if (overall >= 90) return 'A+';
  if (overall >= 87) return 'A';
  if (overall >= 84) return 'A-';
  if (overall >= 81) return 'B+';
  if (overall >= 78) return 'B';
  if (overall >= 75) return 'B-';
  if (overall >= 72) return 'C+';
  if (overall >= 69) return 'C';
  if (overall >= 66) return 'C-';
  if (overall >= 63) return 'D+';
  if (overall >= 60) return 'D';
  return 'F';
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const buildGroupedRatings = (players: OverviewPlayer[]) => {
  const groupedRatings = new Map<OverviewBucket, number[]>();
  const resolvedRatings: number[] = [];

  players.forEach((player) => {
    const rating = resolvePlayerRating(player);
    if (rating === null) return;

    resolvedRatings.push(rating);
    const bucket = normalizeOverviewPosition(player.position);
    const bucketRatings = groupedRatings.get(bucket) ?? [];
    bucketRatings.push(rating);
    groupedRatings.set(bucket, bucketRatings);
  });

  groupedRatings.forEach((ratings) => ratings.sort((a, b) => b - a));

  return { groupedRatings, resolvedRatings };
};

const scoreWeightedSlots = (
  groupedRatings: Map<OverviewBucket, number[]>,
  slots: WeightedSlot[],
): { score: number | null; starterRatings: number[] } => {
  const usedCounts = new Map<OverviewBucket, number>();
  let weightedTotal = 0;
  let weightTotal = 0;
  const starterRatings: number[] = [];

  slots.forEach((slot) => {
    const ratings = groupedRatings.get(slot.bucket) ?? [];
    const alreadyUsed = usedCounts.get(slot.bucket) ?? 0;
    const selected = ratings.slice(alreadyUsed, alreadyUsed + slot.count);
    if (selected.length === 0) return;

    const selectedAverage = average(selected);
    if (selectedAverage === null) return;

    weightedTotal += selectedAverage * slot.weight;
    weightTotal += slot.weight;
    starterRatings.push(...selected);
    usedCounts.set(slot.bucket, alreadyUsed + selected.length);
  });

  if (weightTotal === 0) {
    return { score: null, starterRatings: [] };
  }

  return {
    score: weightedTotal / weightTotal,
    starterRatings,
  };
};

const scoreSide = (groupedRatings: Map<OverviewBucket, number[]>, buckets: Set<OverviewBucket>) => {
  const ratings = Array.from(buckets)
    .flatMap((bucket) => groupedRatings.get(bucket) ?? [])
    .sort((a, b) => b - a);

  if (ratings.length === 0) return null;

  return average(ratings.slice(0, 11));
};

export const computeTeamOverviewRaw = (players: OverviewPlayer[]): TeamOverviewRaw => {
  const { groupedRatings, resolvedRatings } = buildGroupedRatings(players);
  const starterScore = scoreWeightedSlots(groupedRatings, STARTER_SLOTS);
  const starterAverage = starterScore.score ?? average(resolvedRatings) ?? 60;

  const starterRatingsUsage = new Map<number, number>();
  starterScore.starterRatings.forEach((rating) => {
    starterRatingsUsage.set(rating, (starterRatingsUsage.get(rating) ?? 0) + 1);
  });

  const remainingDepthRatings = [...resolvedRatings]
    .sort((a, b) => b - a)
    .filter((rating) => {
      const count = starterRatingsUsage.get(rating) ?? 0;
      if (count <= 0) return true;
      starterRatingsUsage.set(rating, count - 1);
      return false;
    });

  const depthAverage = average(remainingDepthRatings.slice(0, 10));
  const overallRaw = starterAverage + ((depthAverage ?? starterAverage) - 70) * 0.15;
  const offenseRaw = scoreSide(groupedRatings, OFFENSE_BUCKETS) ?? overallRaw;
  const defenseRaw = scoreSide(groupedRatings, DEFENSE_BUCKETS) ?? overallRaw;
  const specialTeamsRaw = scoreSide(groupedRatings, SPECIAL_TEAMS_BUCKETS) ?? overallRaw;

  return {
    overall: overallRaw,
    offense: offenseRaw,
    defense: defenseRaw,
    specialTeams: specialTeamsRaw,
  };
};

export const scaleOverviewScore = (
  rawValue: number,
  minRaw: number,
  maxRaw: number,
  minScore = 68,
  maxScore = 92,
): number => {
  if (!Number.isFinite(rawValue)) {
    return minScore;
  }

  if (maxRaw <= minRaw) {
    return Math.round((minScore + maxScore) / 2);
  }

  const normalized = (rawValue - minRaw) / (maxRaw - minRaw);
  return clampScore(Math.round(minScore + normalized * (maxScore - minScore)), minScore, maxScore);
};

export const computeTeamOverview = (players: OverviewPlayer[]): TeamOverview => {
  const raw = computeTeamOverviewRaw(players);
  const overall = scaleOverviewScore(raw.overall, 70, 90);
  const offense = scaleOverviewScore(raw.offense, 70, 90);
  const defense = scaleOverviewScore(raw.defense, 70, 90);
  const specialTeams = scaleOverviewScore(raw.specialTeams, 60, 90, 60, 90);

  return {
    overall,
    offense,
    defense,
    specialTeams,
    grade: computeOverviewGrade(overall),
  };
};

export const computeTeamNeeds = (players: OverviewPlayer[], count = 3): TeamNeed[] => {
  const { groupedRatings } = buildGroupedRatings(players);

  return NEED_GROUPS.map((group) => {
    const starterRatings = group.buckets
      .flatMap((bucket) => groupedRatings.get(bucket) ?? [])
      .sort((a, b) => b - a)
      .slice(0, group.starterCount);

    const paddedRatings = [
      ...starterRatings,
      ...Array.from(
        { length: Math.max(0, group.starterCount - starterRatings.length) },
        () => MISSING_STARTER_RATING,
      ),
    ];

    const needScore = average(paddedRatings) ?? MISSING_STARTER_RATING;
    const weakestStarter = paddedRatings[paddedRatings.length - 1] ?? MISSING_STARTER_RATING;

    return {
      label: group.label,
      needScore,
      weakestStarter,
      filledStarters: starterRatings.length,
    };
  })
    .sort((a, b) => {
      if (a.needScore !== b.needScore) return a.needScore - b.needScore;
      if (a.weakestStarter !== b.weakestStarter) return a.weakestStarter - b.weakestStarter;
      if (a.filledStarters !== b.filledStarters) return a.filledStarters - b.filledStarters;
      return a.label.localeCompare(b.label);
    })
    .slice(0, count)
    .map((entry) => entry.label);
};
