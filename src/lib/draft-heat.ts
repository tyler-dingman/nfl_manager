export type HeatLevel = 'neutral' | 'warm' | 'hot';

type ProspectLike = {
  rank?: number;
  position?: string;
  isDrafted?: boolean;
};

export const getPickHeat = ({
  pickIndex,
  currentPickIndex,
  userNextPickIndex,
  teamNeeds,
  remainingProspects,
}: {
  pickIndex: number;
  currentPickIndex: number;
  userNextPickIndex: number | null;
  teamNeeds: string[];
  remainingProspects: ProspectLike[];
}): { level: HeatLevel; reason: string } => {
  if (pickIndex === currentPickIndex) {
    return { level: 'hot', reason: 'On the clock' };
  }

  const blueChipFitsNeed = remainingProspects.some(
    (prospect) =>
      !prospect.isDrafted &&
      (prospect.rank ?? 999) <= 10 &&
      Boolean(prospect.position) &&
      teamNeeds.includes(prospect.position ?? ''),
  );

  if (pickIndex <= currentPickIndex + 3 && blueChipFitsNeed) {
    return { level: 'hot', reason: 'Blue-chip fits team needs' };
  }

  if (
    userNextPickIndex !== null &&
    userNextPickIndex - pickIndex <= 2 &&
    pickIndex < userNextPickIndex
  ) {
    return { level: 'hot', reason: 'Ahead of your pick — trade window' };
  }

  if (pickIndex <= currentPickIndex + 5) {
    return { level: 'warm', reason: 'Near-term pick window' };
  }

  if (
    userNextPickIndex !== null &&
    userNextPickIndex - pickIndex <= 5 &&
    pickIndex < userNextPickIndex
  ) {
    return { level: 'warm', reason: 'Approaching your pick' };
  }

  return { level: 'neutral', reason: 'No immediate pressure' };
};
