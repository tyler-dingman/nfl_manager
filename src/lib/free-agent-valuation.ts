import { getDemandAavMillions } from '@/lib/contract-demand';

type FreeAgentValueInput = {
  position: string;
  rating?: number | null;
  marketValue?: number | null;
};

export const getFreeAgentExpectedApy = ({
  position,
  rating,
  marketValue,
}: FreeAgentValueInput): number | null => {
  if (typeof rating === 'number' && Number.isFinite(rating)) {
    return getDemandAavMillions({ position, ovr: rating });
  }

  if (typeof marketValue === 'number' && Number.isFinite(marketValue) && marketValue > 0) {
    return Number((marketValue / 1_000_000).toFixed(2));
  }

  return null;
};

export const getFreeAgentExpectedApyDollars = (input: FreeAgentValueInput): number | null => {
  const expectedApy = getFreeAgentExpectedApy(input);
  if (expectedApy === null) return null;
  return Math.round(expectedApy * 1_000_000);
};
