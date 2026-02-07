export type DraftMode = 'mock' | 'real';

export type DraftPickDTO = {
  id: string;
  overall: number;
  round: number;
  ownerTeamAbbr: string;
  originalTeamAbbr: string;
  selectedPlayerId?: string | null;
  selectedByTeamAbbr?: string | null;
};

export type DraftSessionStatus = 'in_progress' | 'completed';

export type DraftSessionDTO = {
  id: string;
  rngSeed: number;
  mode: DraftMode;
  userTeamAbbr: string;
  currentPickIndex: number;
  isPaused: boolean;
  picks: DraftPickDTO[];
  prospects: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    rank?: number;
    projectedPick?: number;
    college?: string;
    grade?: string;
    projectedRound?: string;
    contractYearsRemaining: number;
    capHit: string;
    status: string;
    headshotUrl?: string | null;
    isDrafted?: boolean;
  }>;
  status: DraftSessionStatus;
  fallingProspectId?: string | null;
  fallReason?: string | null;
  fallSeverity?: number | null;
};

export type DraftSessionState = DraftSessionDTO & {
  rngState: number;
  saveId: string;
  finalized?: boolean;
};
