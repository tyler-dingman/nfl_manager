import type { PlayerRowDTO } from '@/types/player';

export type RenegotiateResultDTO = {
  ok: true;
  accepted: boolean;
  score: number;
  label: string;
  quote: string;
  player?: PlayerRowDTO;
  header?: {
    id: string;
    teamAbbr: string;
    capSpace: number;
    capLimit: number;
    rosterCount: number;
    rosterLimit: number;
    phase: string;
    unlocked?: { freeAgency: boolean; draft: boolean };
    createdAt: string;
  };
};
