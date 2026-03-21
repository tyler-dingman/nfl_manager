import type { DraftPickDTO } from '@/types/draft';

const CPU_GRADE_WEIGHTS = [
  { grade: 'C-', weight: 5 },
  { grade: 'C', weight: 12 },
  { grade: 'C+', weight: 22 },
  { grade: 'B-', weight: 22 },
  { grade: 'B', weight: 16 },
  { grade: 'B+', weight: 12 },
  { grade: 'A-', weight: 10 },
] as const;

const GRADE_ORDER = ['D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'] as const;

type DraftGradeLetter = (typeof GRADE_ORDER)[number];

type UserPickGradeInput = {
  playerRanking: number | null | undefined;
  pickNumber: number;
  teamNeeds: string[];
  playerPosition: string;
};

type DraftGradeResult = {
  letter: DraftGradeLetter;
  reasons: string[];
};

const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (['LT', 'RT', 'OT', 'OL'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'C', 'IOL'].includes(normalized)) return 'IOL';
  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'DL', 'NT', 'IDL'].includes(normalized)) return 'DL';
  if (['OLB', 'ILB', 'MLB', 'LB', 'EDGE/LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S', 'DB'].includes(normalized)) return 'S';
  return normalized;
};

const shiftGrade = (grade: DraftGradeLetter, amount: number) => {
  const currentIndex = GRADE_ORDER.indexOf(grade);
  const nextIndex = Math.max(0, Math.min(GRADE_ORDER.length - 1, currentIndex + amount));
  return GRADE_ORDER[nextIndex];
};

const getNeedBoost = (teamNeeds: string[], playerPosition: string) => {
  const normalizedNeeds = teamNeeds.map(normalizePosition);
  const normalizedPlayerPosition = normalizePosition(playerPosition);
  const needIndex = normalizedNeeds.findIndex((need) => need === normalizedPlayerPosition);
  if (needIndex >= 0 && needIndex <= 1) {
    return 2;
  }
  if (needIndex >= 2 && needIndex <= 4) {
    return 1;
  }
  return 0;
};

export const calculateValueDelta = (playerRanking: number | null | undefined, pickNumber: number) => {
  if (!Number.isFinite(playerRanking)) {
    return 0;
  }
  return pickNumber - Number(playerRanking);
};

export const getRandomCpuGrade = (): DraftGradeLetter => {
  const totalWeight = CPU_GRADE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let target = Math.random() * totalWeight;

  for (const entry of CPU_GRADE_WEIGHTS) {
    target -= entry.weight;
    if (target <= 0) {
      return entry.grade;
    }
  }

  return 'B';
};

export const getUserPickGrade = ({
  playerRanking,
  pickNumber,
  teamNeeds,
  playerPosition,
}: UserPickGradeInput): DraftGradeResult => {
  if (!Number.isFinite(playerRanking)) {
    return {
      letter: 'B',
      reasons: ['Board ranking was limited, so this lands as a neutral value pick.'],
    };
  }

  const valueDelta = calculateValueDelta(playerRanking, pickNumber);
  const needBoost = getNeedBoost(teamNeeds, playerPosition);

  let baseGrade: DraftGradeLetter = 'B';
  let valueReason = 'Fair value for this draft slot.';

  if (valueDelta >= 15) {
    baseGrade = pickNumber % 2 === 0 ? 'A' : 'A+';
    valueReason = `Elite value after landing a player ranked ${valueDelta} picks earlier than this slot.`;
  } else if (valueDelta >= 8) {
    baseGrade = 'A-';
    valueReason = `Great value with the player coming off the board ${valueDelta} picks later than expected.`;
  } else if (valueDelta >= 3) {
    baseGrade = 'B+';
    valueReason = `Good value at this spot with the player sliding ${valueDelta} picks.`;
  } else if (valueDelta >= -2) {
    baseGrade = 'B';
    valueReason = 'Fair value right around the player’s expected range.';
  } else if (valueDelta >= -7) {
    baseGrade = 'C+';
    valueReason = `Small reach after taking the player ${Math.abs(valueDelta)} picks ahead of consensus.`;
  } else if (valueDelta >= -15) {
    baseGrade = pickNumber % 2 === 0 ? 'C' : 'C-';
    valueReason = `Noticeable reach at ${Math.abs(valueDelta)} picks ahead of the board.`;
  } else {
    baseGrade = pickNumber % 2 === 0 ? 'D+' : 'D';
    valueReason = `Major reach after taking the player ${Math.abs(valueDelta)} picks earlier than expected.`;
  }

  let adjustedGrade: DraftGradeLetter = baseGrade;
  let needReason = 'Best-player-available logic carried more weight than roster need.';

  if (needBoost === 2) {
    adjustedGrade = shiftGrade(adjustedGrade, 2);
    needReason = `${playerPosition} was a primary need, which boosts the pick grade.`;
  } else if (needBoost === 1) {
    adjustedGrade = shiftGrade(adjustedGrade, 1);
    needReason = `${playerPosition} addressed a secondary need for the roster.`;
  }

  return {
    letter: adjustedGrade,
    reasons: [valueReason, needReason],
  };
};

export const getStoredPickGrade = (pick: DraftPickDTO) => pick.grade ?? null;
