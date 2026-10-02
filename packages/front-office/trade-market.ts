import type { PlayerRowDTO } from '../../src/types/player';
export type TradeTarget = PlayerRowDTO & {
  tradeAvailabilityScore: number;
  tradeValueScore: number;
  estimatedCost: string;
  availabilityLabel: string;
  whyAvailable: string[];
  depthPosition: number | null;
  contractSummary: string;
};

export type TradeTeamOutlook = {
  teamAbbr: string;
  record: string;
  capSpace: number;
  score: number;
  label: 'Likely Seller' | 'Possible Seller' | 'Neutral' | 'Possible Buyer' | 'Likely Buyer';
};
