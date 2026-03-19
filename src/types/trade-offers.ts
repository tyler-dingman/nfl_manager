import type { PlayerRowDTO } from '@/types/player';

export type TradeOfferPhase = 'manage' | 'freeAgency' | 'draft';

export type TradeChartModel = 'drafttek-classic';

export type TradeFairnessBand =
  | 'reject'
  | 'low_interest'
  | 'fair'
  | 'high_interest'
  | 'smash_accept';

export type TradeOfferArchetype =
  | 'buried_depth'
  | 'veteran_expiring'
  | 'young_expiring'
  | 'cap_casualty'
  | 'needs_based_swap'
  | 'move_up'
  | 'move_down'
  | 'future_pick_package'
  | 'splash_player_pick';

export type TradePickAssetDTO = {
  id: string;
  type: 'pick';
  label: string;
  year: number;
  round: number;
  overallSlot: number | null;
  owningTeamAbbr: string;
  originalTeamAbbr: string;
  projectedRound?: number | null;
  projectedValuePoints: number;
  futureDiscount: number;
};

export type TradePlayerAssetDTO = {
  id: string;
  type: 'player';
  playerId: string;
  teamAbbr: string | null;
  name: string;
  position: string;
  age: number | null;
  rating: number | null;
  capHit: string;
  contractSummary: string;
  headshotUrl?: string | null;
  projectedValuePoints: number;
};

export type TradeOfferAssetDTO = TradePickAssetDTO | TradePlayerAssetDTO;

export type TradeOfferSideDTO = {
  teamAbbr: string;
  teamName: string;
  totalValue: number;
  assets: TradeOfferAssetDTO[];
};

export type TradeOfferInterestDTO = {
  label: string;
  band: TradeFairnessBand;
  score: number;
};

export type TradeOfferDTO = {
  id: string;
  phase: TradeOfferPhase;
  archetype: TradeOfferArchetype;
  trigger: string;
  generatedAt: string;
  chartModel: TradeChartModel;
  proposingTeamAbbr: string;
  proposingTeamName: string;
  proposingTeamLogoUrl: string;
  headline: string;
  summary: string;
  reason: string;
  urgency?: string;
  incoming: TradeOfferSideDTO;
  outgoing: TradeOfferSideDTO;
  userInterest: TradeOfferInterestDTO;
  aiInterest: TradeOfferInterestDTO;
  debug: {
    seed: string;
    candidateScore: number;
    userScore: number;
    aiScore: number;
    reasons: string[];
  };
};

export type TradeEvaluationContext = {
  teamAbbr: string;
  phase: TradeOfferPhase;
  contenderWindow: 'win_now' | 'balanced' | 'rebuild';
  needs: string[];
  capSpace: number;
};

export type TradeAssetPackage = {
  assets: TradeOfferAssetDTO[];
  totalValue: number;
};

export type TradeOfferGenerationContext = {
  saveId: string;
  userTeamAbbr: string;
  phase: TradeOfferPhase;
  trigger: string;
  shownOfferIds?: string[];
  mutedTeamAbbrs?: string[];
  draftSessionId?: string | null;
  draftCurrentPickIndex?: number | null;
};

export type TradeOfferGenerationResult = {
  offers: TradeOfferDTO[];
  debug: Array<{
    offerId: string;
    seed: string;
    candidateScore: number;
    reasons: string[];
  }>;
};

export type TradeValuationDebug = {
  ratingScore: number;
  ageMultiplier: number;
  contractMultiplier: number;
  positionMultiplier: number;
  potentialMultiplier: number;
  productionMultiplier: number;
  needMultiplier: number;
  finalValue: number;
};

export type TradePlayerValueResult = {
  value: number;
  debug: TradeValuationDebug;
};

export type TradeTeamProfile = {
  teamAbbr: string;
  aggressive: number;
  conservative: number;
  winNow: number;
  rebuilding: number;
  capSensitive: number;
  needDriven: number;
  prefersPicks: number;
  prefersVeterans: number;
  futurePickTolerance: number;
  overpayForStars: number;
};

export type TradeOfferCandidate = {
  offer: TradeOfferDTO;
  candidateScore: number;
  reasons: string[];
};

export type DraftPickTradeInput = {
  year: number;
  round: number;
  overallSlot?: number | null;
  owningTeamAbbr: string;
  originalTeamAbbr?: string;
  projectedRound?: number | null;
};

export type TradePlayerInput = Pick<
  PlayerRowDTO,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'teamAbbr'
  | 'position'
  | 'age'
  | 'rating'
  | 'maddenRating'
  | 'baselineRating'
  | 'headshotUrl'
  | 'capHit'
  | 'capHitValue'
  | 'salary'
  | 'averagePerYear'
  | 'contract'
  | 'contractYearsRemaining'
  | 'stats'
>;
