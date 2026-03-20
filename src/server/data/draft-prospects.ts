import draftProspectsJson from './draft-prospects.json';

import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type DraftProspectRecord = {
  id: string;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  ranking: number | null;
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

export const DRAFT_PROSPECTS = draftProspectsJson as DraftProspectRecord[];
