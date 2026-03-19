import type { PlayerRowDTO } from '@/types/player';

export type TradeBlockCategory =
  | 'buried_depth'
  | 'veteran_expiring'
  | 'young_expiring'
  | 'surplus'
  | 'cap_pressure'
  | 'role_redundancy';

export type TradeBlockRow = PlayerRowDTO & {
  tradeBlockReason: string;
  tradeBlockScore: number;
  tradeBlockCategory: TradeBlockCategory;
  potentialFits: string[];
  contractSummary: string;
  currentDepthRank: number | null;
};
