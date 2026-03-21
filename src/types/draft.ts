import type { PlayerRowDTO } from '@/types/player';

export type DraftMode = 'mock' | 'real';

export type DraftPickDTO = {
  id: string;
  overall: number;
  round: number;
  ownerTeamAbbr: string;
  originalTeamAbbr: string;
  selectedPlayerId?: string | null;
  selectedByTeamAbbr?: string | null;
  grade?: string | null;
  gradeReasons?: string[] | null;
};

export type DraftSessionStatus = 'in_progress' | 'completed';

export type DraftSessionDTO = {
  id: string;
  rngSeed: number;
  rngState?: number;
  mode: DraftMode;
  userTeamAbbr: string;
  maxRounds: number;
  currentPickIndex: number;
  isPaused: boolean;
  picks: DraftPickDTO[];
  prospects: PlayerRowDTO[];
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
