import draftProspectsJson from './draft-prospects.json';
import draftProspects2027Json from './draft-prospects-2027.json';
import draftProspects2027MetaJson from './draft-prospects-2027.meta.json';

import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type DraftProspectRecord = {
  id: string;
  draftYear?: number;
  sourceRank?: number | null;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  ranking: number | null;
  sourceRanks: {
    pff: number | null;
    espn: number | null;
    consensus: number | null;
    tankathon?: number | null;
  };
  averageRank: number | null;
  confidence: 'high' | 'medium' | 'low';
  espnPlayerId: string | null;
  espnProfileUrl: string | null;
  headshotUrl: string | null;
  headshotSource?: string | null;
  headshotStatus?: string | null;
  headshotSourceUrl?: string | null;
  schoolLogo?: string | null;
  positionRank?: number | null;
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
  sourceUpdatedAt?: string | null;
  sourceProfileUrl?: string | null;
  grade: string | null;
  projectedPick: number | null;
};

const BASE_DRAFT_PROSPECTS = draftProspectsJson as DraftProspectRecord[];
const TANKATHON_DRAFT_PROSPECTS_2027 = draftProspects2027Json as DraftProspectRecord[];

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
export const DRAFT_PROSPECTS_2027 = TANKATHON_DRAFT_PROSPECTS_2027;
export const DRAFT_PROSPECTS_2027_META = draftProspects2027MetaJson;

export const getDraftProspectsForYear = (year: number): DraftProspectRecord[] =>
  year >= 2027 ? DRAFT_PROSPECTS_2027 : DRAFT_PROSPECTS;
