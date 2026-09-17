import { normalizeHistoricalStatType, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame } from './types';
import type { SavedLeg, SavedLegStatus } from '@/components/parlay-lab/saved-plays';

export function gradeSavedLeg(
  leg: SavedLeg,
  game: HistoricalPlayerGame | null,
): { status: SavedLegStatus; actualResult: number | null } {
  if (!game || leg.line === null) return { status: 'UNABLE_TO_GRADE', actualResult: null };
  const stat = normalizeHistoricalStatType(leg.normalizedMarketType ?? leg.marketType);
  if (!stat) return { status: 'UNABLE_TO_GRADE', actualResult: null };
  const actualResult = resolveHistoricalStat(game, stat);
  if (actualResult === null) return { status: 'UNABLE_TO_GRADE', actualResult: null };
  if (actualResult === leg.line) return { status: 'PUSH', actualResult };
  const hit = leg.side === 'UNDER' ? actualResult < leg.line : actualResult > leg.line;
  return { status: hit ? 'HIT' : 'MISS', actualResult };
}
