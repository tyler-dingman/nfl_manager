import type { DraftBoardEntry } from '@/lib/draft-board';
import { clampNumber } from '@/lib/draft-utils';
import { resolvePlayerRating } from '@/lib/team-overview';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

export const DRAFT_INTELLIGENCE_CONSTANTS = {
  valueStealThreshold: 8,
  sleeperThreshold: 5,
  positionRunWindow: 6,
  quarterbackRunWindow: 4,
  positionRunCount: 3,
  quarterbackRunCount: 2,
} as const;

const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (['CB', 'S', 'FS', 'SS', 'DB'].includes(normalized)) return 'DB';
  if (['WR'].includes(normalized)) return 'WR';
  if (['QB'].includes(normalized)) return 'QB';
  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'DL', 'NT', 'IDL'].includes(normalized)) return 'DL';
  if (['OT', 'LT', 'RT', 'OL'].includes(normalized)) return 'OL';
  return normalized;
};

const unique = <T>(values: T[]) => Array.from(new Set(values));

const toGrade = (score: number) => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 74) return 'B';
  if (score >= 69) return 'B-';
  if (score >= 64) return 'C+';
  if (score >= 58) return 'C';
  if (score >= 52) return 'C-';
  return 'D';
};

export type DraftRun = {
  position: string;
  count: number;
  window: number;
  headline: string;
  severity: 'warm' | 'hot';
};

export type DraftPickEvaluation = {
  score: number;
  grade: string;
  reasons: string[];
  boardRankScore: number;
  teamNeedScore: number;
  valueAtPickScore: number;
  sleeperScore: number;
  draftRunPressureScore: number;
  tags: string[];
};

export type DraftClassSummary = {
  pickCount: number;
  positionsDrafted: string[];
  overallScore: number;
  overallGrade: string;
  needsAddressed: number;
  bestPickLabel: string | null;
  biggestReachLabel: string | null;
  summaryLines: string[];
  totalValueAdded: number;
};

export const detectActiveDraftRuns = (
  picks: DraftPickDTO[],
  prospects: PlayerRowDTO[],
): DraftRun[] => {
  const selectedPicks = picks
    .filter((pick) => pick.selectedPlayerId)
    .sort((left, right) => left.overall - right.overall);

  const recent = selectedPicks.slice(-DRAFT_INTELLIGENCE_CONSTANTS.positionRunWindow);
  const recentQbWindow = selectedPicks.slice(-DRAFT_INTELLIGENCE_CONSTANTS.quarterbackRunWindow);

  const counts = recent.reduce<Record<string, number>>((acc, pick) => {
    const player = prospects.find((entry) => entry.id === pick.selectedPlayerId);
    if (!player) return acc;
    const position = normalizePosition(player.position);
    acc[position] = (acc[position] ?? 0) + 1;
    return acc;
  }, {});

  const qbCount = recentQbWindow.reduce((total, pick) => {
    const player = prospects.find((entry) => entry.id === pick.selectedPlayerId);
    return total + (player && normalizePosition(player.position) === 'QB' ? 1 : 0);
  }, 0);

  const runs: DraftRun[] = Object.entries(counts)
    .filter(([, count]) => count >= DRAFT_INTELLIGENCE_CONSTANTS.positionRunCount)
    .map(([position, count]) => ({
      position,
      count,
      window: DRAFT_INTELLIGENCE_CONSTANTS.positionRunWindow,
      headline:
        position === 'WR'
          ? 'WR run is heating up'
          : position === 'DB'
            ? 'DBs are flying off the board'
            : `${position} market is moving`,
      severity: count >= 4 ? 'hot' : 'warm',
    }));

  if (qbCount >= DRAFT_INTELLIGENCE_CONSTANTS.quarterbackRunCount) {
    runs.unshift({
      position: 'QB',
      count: qbCount,
      window: DRAFT_INTELLIGENCE_CONSTANTS.quarterbackRunWindow,
      headline: 'QB market is moving',
      severity: qbCount >= 3 ? 'hot' : 'warm',
    });
  }

  return unique(runs.map((run) => run.position)).map(
    (position) => runs.find((run) => run.position === position)!,
  );
};

export const evaluateDraftPick = ({
  player,
  currentPickOverall,
  teamNeeds,
  boardEntry,
  activeRuns,
}: {
  player: PlayerRowDTO;
  currentPickOverall: number;
  teamNeeds: string[];
  boardEntry?: DraftBoardEntry | null;
  activeRuns?: DraftRun[];
}): DraftPickEvaluation => {
  const playerRank = player.rank ?? player.projectedPick ?? currentPickOverall;
  const valueDelta = currentPickOverall - playerRank;
  const normalizedPlayerPosition = normalizePosition(player.position);
  const matchingNeedIndex = teamNeeds.findIndex(
    (need) => normalizePosition(need) === normalizedPlayerPosition,
  );
  const isNeed = matchingNeedIndex !== -1;
  const boardRankScore = clampNumber(34 - Math.max(0, playerRank - currentPickOverall), 8, 34);
  const teamNeedScore = isNeed ? ([22, 18, 14][matchingNeedIndex] ?? 10) : 4;
  const valueAtPickScore = clampNumber(14 + valueDelta * 2.2, 0, 30);
  const sleeperScore =
    boardEntry?.tags.includes('Sleeper') || boardEntry?.tags.includes('Steal')
      ? 10
      : valueDelta >= DRAFT_INTELLIGENCE_CONSTANTS.sleeperThreshold
        ? 6
        : 0;
  const runPressureScore = activeRuns?.some((run) => run.position === normalizedPlayerPosition)
    ? 8
    : 0;

  const totalScore = clampNumber(
    Math.round(boardRankScore + teamNeedScore + valueAtPickScore + sleeperScore + runPressureScore),
    45,
    99,
  );

  const reasons: string[] = [];
  const tags: string[] = [];

  if (isNeed) {
    reasons.push('Filled a major team need');
    tags.push('Team Need');
  }
  if (valueDelta >= DRAFT_INTELLIGENCE_CONSTANTS.valueStealThreshold) {
    reasons.push('Strong value at this slot');
    tags.push('Steal');
  } else if (valueDelta >= 3) {
    reasons.push('Solid board value at this pick');
  }
  if (valueDelta <= -8) {
    reasons.push('Slight reach relative to the board');
  } else if ((resolvePlayerRating(player) ?? 0) >= 78 && (player.age ?? 22) <= 23) {
    reasons.push('Adds long-term upside');
  }
  if (boardEntry?.tags.includes('Sleeper')) {
    reasons.push('Sleeper profile with better value than expected');
    tags.push('Sleeper');
  }
  if (activeRuns?.some((run) => run.position === normalizedPlayerPosition)) {
    reasons.push(`${player.position} market was moving, so timing matters`);
  }
  if (reasons.length === 0) {
    reasons.push('Clean, balanced pick for your roster');
  }

  return {
    score: totalScore,
    grade: toGrade(totalScore),
    reasons: reasons.slice(0, 4),
    boardRankScore,
    teamNeedScore,
    valueAtPickScore,
    sleeperScore,
    draftRunPressureScore: runPressureScore,
    tags: unique(tags),
  };
};

export const summarizeDraftClass = ({
  picks,
  evaluations,
  teamNeeds,
}: {
  picks: Array<{ player: PlayerRowDTO; pick: DraftPickDTO }>;
  evaluations: DraftPickEvaluation[];
  teamNeeds: string[];
}): DraftClassSummary => {
  if (picks.length === 0 || evaluations.length === 0) {
    return {
      pickCount: 0,
      positionsDrafted: [],
      overallScore: 0,
      overallGrade: 'C',
      needsAddressed: 0,
      bestPickLabel: null,
      biggestReachLabel: null,
      summaryLines: ['No picks made yet.'],
      totalValueAdded: 0,
    };
  }

  const overallScore = Math.round(
    evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length,
  );
  const positionsDrafted = unique(picks.map(({ player }) => player.position));
  const addressedNeedPositions = unique(
    picks
      .map(({ player }) => normalizePosition(player.position))
      .filter((position) => teamNeeds.some((need) => normalizePosition(need) === position)),
  );
  const bestPickIndex = evaluations.reduce(
    (bestIndex, evaluation, index, array) =>
      evaluation.score > array[bestIndex].score ? index : bestIndex,
    0,
  );
  const biggestReachIndex = evaluations.reduce(
    (worstIndex, evaluation, index, array) =>
      evaluation.valueAtPickScore < array[worstIndex].valueAtPickScore ? index : worstIndex,
    0,
  );

  const bestPick = picks[bestPickIndex];
  const biggestReach = picks[biggestReachIndex];

  const summaryLines = [
    addressedNeedPositions.length > 0
      ? `Addressed ${addressedNeedPositions.length} core need${addressedNeedPositions.length > 1 ? 's' : ''}`
      : 'Still building toward your biggest needs',
    positionsDrafted.length > 0
      ? `Added youth at ${positionsDrafted.slice(0, 2).join(' and ')}`
      : 'No position groups improved yet',
  ];

  if (teamNeeds.length > addressedNeedPositions.length) {
    const remainingNeed = teamNeeds.find(
      (need) => !addressedNeedPositions.includes(normalizePosition(need)),
    );
    if (remainingNeed) {
      summaryLines.push(`Still need ${remainingNeed} help`);
    }
  }

  return {
    pickCount: picks.length,
    positionsDrafted,
    overallScore,
    overallGrade: toGrade(overallScore),
    needsAddressed: addressedNeedPositions.length,
    bestPickLabel: bestPick
      ? `${bestPick.player.firstName} ${bestPick.player.lastName} · Pick ${bestPick.pick.overall}`
      : null,
    biggestReachLabel: biggestReach
      ? `${biggestReach.player.firstName} ${biggestReach.player.lastName} · Pick ${biggestReach.pick.overall}`
      : null,
    summaryLines: summaryLines.slice(0, 3),
    totalValueAdded: evaluations.reduce(
      (sum, evaluation) => sum + Math.max(0, evaluation.valueAtPickScore - 14),
      0,
    ),
  };
};
