import { estimateParlayOdds } from './parlay-odds';
import { resolvedMarketType } from './market-category-map';

export type SavedLegStatus =
  | 'UPCOMING'
  | 'LIVE'
  | 'HIT'
  | 'MISS'
  | 'PUSH'
  | 'VOID'
  | 'UNABLE_TO_GRADE';
export type SavedPlayStatus = 'UPCOMING' | 'LIVE' | 'HIT' | 'MISSED' | 'VOID';

export type SavedEvent = {
  id: string;
  season?: number;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
};

export type SavedLeg = {
  id: string;
  playerId?: string | null;
  playerName?: string | null;
  headshotUrl?: string | null;
  teamId?: string | null;
  marketType: string;
  statId?: string;
  normalizedMarketType?: string;
  side: string;
  line: number | null;
  odds: number | null;
  sportsbook: string;
  period?: string;
  isAltLine?: boolean;
  labResearch?: unknown;
  trend?: unknown;
  gradingStatus?: SavedLegStatus;
  actualResult?: number | null;
  gradedAt?: string | null;
  wasLabFindAtSave?: boolean;
};

export type SavedPlay = {
  id: string;
  createdAt?: string;
  event?: SavedEvent | null;
  selections: SavedLeg[];
  savedCombinedOdds?: number | null;
  status?: SavedPlayStatus;
  gradedAt?: string | null;
};

type SaveableLeg = SavedLeg & { available?: boolean; deeplink?: string | null };

export const normalizedSavedMarketType = (leg: Partial<SavedLeg>) => {
  const resolved =
    leg.normalizedMarketType ??
    resolvedMarketType({ marketType: leg.marketType ?? 'OTHER', statId: leg.statId ?? '' });
  const aliases: Record<string, string> = {
    PASSING_TD: 'PASSING_TDS',
    RUSHING_TD: 'RUSHING_TDS',
    RECEIVING_TD: 'RECEIVING_TDS',
    TOUCHDOWNS: 'ANYTIME_TD',
    PASSING_INTERCEPTIONS: 'INTERCEPTIONS',
  };
  return aliases[resolved] ?? resolved;
};

export function snapshotSavedPlay(input: {
  id?: string;
  event?: SavedEvent | null;
  selections: SaveableLeg[];
  createdAt?: string;
}): SavedPlay {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const selections = input.selections.map((selection) => ({
    ...selection,
    normalizedMarketType: normalizedSavedMarketType(selection),
    gradingStatus: selection.gradingStatus ?? 'UPCOMING',
    wasLabFindAtSave:
      selection.wasLabFindAtSave ??
      Boolean(
        selection.labResearch &&
        typeof selection.labResearch === 'object' &&
        'labFindSide' in selection.labResearch &&
        selection.labResearch.labFindSide === selection.side,
      ),
  }));
  return {
    id: input.id ?? `slip-${Date.now()}`,
    createdAt,
    event: input.event ?? null,
    selections,
    savedCombinedOdds: estimateParlayOdds(selections.map((selection) => selection.odds)),
    status: 'UPCOMING',
  };
}

export const normalizeLegacySavedPlay = (play: SavedPlay): SavedPlay => {
  const selections = (play.selections ?? []).map((selection) => ({
    ...selection,
    normalizedMarketType: normalizedSavedMarketType(selection),
    gradingStatus: selection.gradingStatus ?? 'UPCOMING',
  }));
  const derived = deriveSavedPlayStatus(
    selections.map((selection) => selection.gradingStatus ?? 'UPCOMING'),
  );
  return {
    ...play,
    selections,
    savedCombinedOdds:
      play.savedCombinedOdds ?? estimateParlayOdds(selections.map((selection) => selection.odds)),
    status:
      play.status === 'HIT' ||
      play.status === 'MISSED' ||
      play.status === 'UPCOMING' ||
      play.status === 'LIVE' ||
      play.status === 'VOID'
        ? play.status
        : derived,
  };
};

export const deriveSavedPlayStatus = (statuses: SavedLegStatus[]): SavedPlayStatus => {
  if (!statuses.length || statuses.every((status) => status === 'UPCOMING')) return 'UPCOMING';
  if (statuses.some((status) => status === 'LIVE')) return 'LIVE';
  if (statuses.some((status) => status === 'MISS')) return 'MISSED';
  const required = statuses.filter((status) => status !== 'VOID' && status !== 'PUSH');
  if (required.length && required.every((status) => status === 'HIT')) return 'HIT';
  if (!required.length && statuses.every((status) => status === 'VOID' || status === 'PUSH'))
    return 'VOID';
  return 'UPCOMING';
};
