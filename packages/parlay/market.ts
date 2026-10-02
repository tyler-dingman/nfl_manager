import type { Sportsbook } from '../../src/server/odds/sportsbooks';
export type Market = {
  id: string;
  marketType: string;
  statId: string;
  entityId: string;
  playerId: string | null;
  playerName: string | null;
  headshotUrl?: string | null;
  teamId: string | null;
  period: string;
  side: string;
  line: number | null;
  normalizedKey: string;
  isAltLine: boolean;
  lineType?: 'main' | 'alternate' | 'unknown';
  mainLine?: number | null;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
  researchStatus?: 'FULL' | 'PARTIAL' | 'NONE';
  labResearch?: {
    labFindSide: 'OVER' | 'UNDER' | null;
    over: LabSideSummary | null;
    under: LabSideSummary | null;
  } | null;
};
type LabSignal = { label: string; value: string };
type LabSideSummary = {
  sampleSize: number;
  positiveSignals: LabSignal[];
  concerns: LabSignal[];
};
