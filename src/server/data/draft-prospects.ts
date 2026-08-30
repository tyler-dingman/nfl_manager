import draftProspectsJson from './draft-prospects.json';

import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type DraftProspectRecord = {
  id: string;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  ranking: number | null;
  sourceRanks: {
    pff: number | null;
    espn: number | null;
    consensus: number | null;
  };
  averageRank: number | null;
  confidence: 'high' | 'medium' | 'low';
  espnPlayerId: string | null;
  espnProfileUrl: string | null;
  headshotUrl: string | null;
  age: number | null;
  classYear: string | null;
  height: string | null;
  weight: number | null;
  hometown: string | null;
  stats: UnifiedPlayerStats;
  summary: string | null;
  archetype: string | null;
  projectedRange: string | null;
  source: string | null;
  grade: string | null;
  projectedPick: number | null;
};

const BASE_DRAFT_PROSPECTS = draftProspectsJson as DraftProspectRecord[];

const buildConsensusOnlyDraftProspects = (
  prospects: DraftProspectRecord[],
  year: number,
): DraftProspectRecord[] =>
  prospects
    .filter((prospect) => prospect.sourceRanks.consensus !== null)
    .map((prospect) => {
      const consensusRank = prospect.sourceRanks.consensus ?? prospect.ranking ?? 999;
      return {
        ...prospect,
        ranking: consensusRank,
        averageRank: consensusRank,
        confidence: prospect.confidence === 'high' ? 'medium' : prospect.confidence,
        projectedPick: consensusRank,
        source: `consensus-big-board-${year}`,
      };
    })
    .sort(
      (left, right) =>
        (left.ranking ?? Number.MAX_SAFE_INTEGER) - (right.ranking ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name),
    );

export const DRAFT_PROSPECTS = BASE_DRAFT_PROSPECTS;
export const DRAFT_PROSPECTS_2027 = buildConsensusOnlyDraftProspects(BASE_DRAFT_PROSPECTS, 2027);

export const getDraftProspectsForYear = (year: number): DraftProspectRecord[] =>
  year >= 2027 ? DRAFT_PROSPECTS_2027 : DRAFT_PROSPECTS;
