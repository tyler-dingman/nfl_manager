export type FrontOfficePath = 'full' | 'free_agency' | 'draft';

export type FrontOfficeEventType =
  | 'breaking_news'
  | 'trade_rumor'
  | 'trade_interest'
  | 'trade_offer'
  | 'free_agent_signing'
  | 'player_release'
  | 'contract_extension'
  | 'draft_buzz'
  | 'deadline_alert'
  | 'league_transaction'
  | 'playoff_update';

export type FrontOfficeEventPriority = 'low' | 'normal' | 'high' | 'urgent';

export type FrontOfficeEvent = {
  id: string;
  saveId: string;
  type: FrontOfficeEventType;
  priority: FrontOfficeEventPriority;
  headline: string;
  summary: string;
  teamAbbr: string | null;
  relatedTeamAbbr: string | null;
  playerId: string | null;
  prospectId: string | null;
  tradeOfferId: string | null;
  simulationSeason: number;
  simulationWeek: number;
  simulationPhase: string;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  surfacedAt: string | null;
};

export type FrontOfficeTradeOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type FrontOfficeSaveMetadata = {
  saveId: string;
  teamAbbr: string;
  season: number;
  selectedPath: FrontOfficePath | null;
  simulationPhase: string | null;
  initializedAt: string | null;
  version?: number;
  simulation?: FranchiseSimulationState | null;
};

export type FranchiseRecord = { wins: number; losses: number; ties: number };

export type FranchiseTeamState = {
  abbr: string;
  conference: string;
  division: string;
  overall: number;
  record: FranchiseRecord;
  pointsFor: number;
  pointsAgainst: number;
};

export type FranchiseGameState = {
  id: string;
  week: number;
  seasonType: 'REG' | 'POST';
  homeTeam: string;
  awayTeam: string;
  neutralSite?: boolean;
  played: boolean;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
};

export type FranchiseTransaction = {
  id: string;
  type: 'cut' | 're-sign' | 'signing' | 'trade' | 'draft';
  teamAbbr: string;
  playerId?: string;
  playerName?: string;
  summary: string;
  capDelta?: number;
  createdAt: string;
};

export type FranchisePlayoffState = {
  seeds: Record<string, string[]>;
  games: FranchiseGameState[];
  champion: string | null;
};

export type FranchiseSimulationState = {
  seed: string;
  season: number;
  currentWeek: number;
  phase: string;
  teams: Record<string, FranchiseTeamState>;
  games: FranchiseGameState[];
  playoffs: FranchisePlayoffState | null;
  draftOrder: string[];
  transactions: FranchiseTransaction[];
  completedAt: string | null;
};
