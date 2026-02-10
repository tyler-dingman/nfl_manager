import type { NewsItemDTO } from '@/types/news';
import type { PlayerRowDTO } from '@/types/player';

export type ResignResultDTO = {
  ok: true;
  accepted: boolean;
  playerId: string;
  teamAbbr: string;
  years: number;
  apy: number;
  guaranteed: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  interestScore: number;
  agentPersona: string;
  reasoningTags: string[];
  quote: string;
  newsItem: NewsItemDTO;
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
  player?: PlayerRowDTO;
};

export type ResignErrorDTO = { ok: false; error: string };
