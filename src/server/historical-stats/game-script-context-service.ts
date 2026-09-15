import type { HistoricalStatType } from './types';

type StoredMarket = {
  marketType: string;
  entityId?: string;
  teamId: string | null;
  side: string;
  line: number | null;
  available: boolean;
  period?: string;
  isAltLine?: boolean;
};

type EventTeams = {
  homeTeamId: string;
  awayTeamId: string;
};
export type ScriptBucket =
  | 'HEAVY_FAVORITE'
  | 'FAVORITE'
  | 'CLOSE_GAME'
  | 'UNDERDOG'
  | 'HEAVY_UNDERDOG';
export const scriptBucketFor = (teamSpread: number): ScriptBucket =>
  teamSpread <= -7
    ? 'HEAVY_FAVORITE'
    : teamSpread <= -3
      ? 'FAVORITE'
      : teamSpread < 3
        ? 'CLOSE_GAME'
        : teamSpread < 7
          ? 'UNDERDOG'
          : 'HEAVY_UNDERDOG';
export function buildGameScriptContext(
  markets: StoredMarket[],
  teamId: string | null,
  statType: HistoricalStatType,
  eventTeams: EventTeams,
) {
  if (!teamId) return null;
  const normalizedTeamId = teamId.toUpperCase(),
    desiredSide =
      normalizedTeamId === eventTeams.homeTeamId.toUpperCase()
        ? 'HOME'
        : normalizedTeamId === eventTeams.awayTeamId.toUpperCase()
          ? 'AWAY'
          : null;
  if (!desiredSide) return null;
  const spreadMarket = markets.find(
      (market) =>
        market.marketType === 'SPREAD' &&
        market.side === desiredSide &&
        market.isAltLine === false &&
        market.available &&
        market.line !== null &&
        (!market.period || market.period === 'game'),
    ),
    totalMarket = markets.find(
      (market) =>
        market.marketType === 'TOTAL' &&
        market.entityId?.toLowerCase() === 'all' &&
        market.isAltLine === false &&
        market.available &&
        market.line !== null &&
        (!market.period || market.period === 'game'),
    );
  if (!spreadMarket?.line && spreadMarket?.line !== 0) return null;
  const spread = Number(spreadMarket.line),
    scriptBucket = scriptBucketFor(spread),
    isFavorite = spread < 0,
    rushProp = ['RUSHING_YARDS', 'RUSHING_ATTEMPTS', 'RUSHING_TDS'].includes(statType),
    passProp = [
      'PASSING_YARDS',
      'PASSING_RUSHING_YARDS',
      'PASSING_ATTEMPTS',
      'PASSING_COMPLETIONS',
      'PASSING_TDS',
    ].includes(statType),
    receivingProp = ['RECEIVING_YARDS', 'RECEPTIONS', 'RECEIVING_TDS'].includes(statType);
  let relevantInsight = 'The stored spread points to a relatively neutral expected game script.';
  if (isFavorite && rushProp)
    relevantInsight =
      'Playing as a favorite could support rushing volume if the team plays from ahead.';
  else if (scriptBucket === 'HEAVY_FAVORITE' && passProp)
    relevantInsight = 'One thing to watch: a large lead could reduce late-game passing volume.';
  else if (!isFavorite && (passProp || receivingProp))
    relevantInsight =
      'A trailing game script could support passing volume, though it is only context.';
  else if (!isFavorite && rushProp)
    relevantInsight = 'A trailing game script could reduce rushing opportunities.';
  return {
    spread,
    total:
      totalMarket?.line === null || totalMarket?.line === undefined
        ? null
        : Number(totalMarket.line),
    teamRole: isFavorite ? 'FAVORITE' : spread > 0 ? 'UNDERDOG' : 'PICK_EM',
    scriptBucket,
    totalBucket: null,
    relevantInsight,
  };
}
