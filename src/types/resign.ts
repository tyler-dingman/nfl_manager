import type { NewsItemDTO } from '@/types/news';

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
};

export type ResignErrorDTO = { ok: false; error: string };
