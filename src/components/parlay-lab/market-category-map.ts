export type ParlayCategory =
  | 'popular'
  | 'lab-finds'
  | 'passing'
  | 'receiving'
  | 'rushing'
  | 'touchdowns'
  | 'specials'
  | 'defense'
  | 'first-quarter'
  | 'first-half'
  | 'second-half'
  | 'scoring';

export const PARLAY_CATEGORIES: Array<{ id: ParlayCategory; label: string }> = [
  { id: 'passing', label: 'Passing Props' },
  { id: 'receiving', label: 'Receiving Props' },
  { id: 'rushing', label: 'Rushing Props' },
  { id: 'touchdowns', label: 'TD Scorers' },
  { id: 'specials', label: 'Game Specials' },
  { id: 'defense', label: 'D/ST' },
  { id: 'first-quarter', label: '1st Quarter' },
  { id: 'first-half', label: '1st Half' },
  { id: 'second-half', label: '2nd Half' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'lab-finds', label: 'Lab Finds' },
];

export type MarketCategoryInput = {
  marketType: string;
  statId: string;
  period: string;
  isAltLine: boolean;
  playerId: string | null;
  side?: string;
};

const periodCategory = (period: string): ParlayCategory | null => {
  const value = period.toLowerCase();
  if (['1q', 'q1', '1stquarter', 'firstquarter'].includes(value)) return 'first-quarter';
  if (['2q', 'q2', '2ndquarter', 'secondquarter'].includes(value)) return 'first-half';
  if (
    ['3q', 'q3', '3rdquarter', 'thirdquarter', '4q', 'q4', '4thquarter', 'fourthquarter'].includes(
      value,
    )
  )
    return 'second-half';
  if (['1h', 'h1', '1sthalf', 'firsthalf'].includes(value)) return 'first-half';
  if (['2h', 'h2', '2ndhalf', 'secondhalf'].includes(value)) return 'second-half';
  return null;
};

export const periodLabel = (period: string) => {
  const value = period.toLowerCase();
  if (['1q', 'q1', '1stquarter', 'firstquarter'].includes(value)) return '1Q';
  if (['2q', 'q2', '2ndquarter', 'secondquarter'].includes(value)) return '2Q';
  if (['3q', 'q3', '3rdquarter', 'thirdquarter'].includes(value)) return '3Q';
  if (['4q', 'q4', '4thquarter', 'fourthquarter'].includes(value)) return '4Q';
  if (['1h', 'h1', '1sthalf', 'firsthalf'].includes(value)) return '1H';
  if (['2h', 'h2', '2ndhalf', 'secondhalf'].includes(value)) return '2H';
  return period.toUpperCase();
};

const gameLineName = (marketType: string) =>
  marketType === 'MONEYLINE' ? 'Moneyline' : marketType === 'SPREAD' ? 'Spread' : 'Total';

const inferredTypeFromStat = (statId: string) => {
  const stat = statId.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const aliases: Record<string, string> = {
    passingyards: 'PASSING_YARDS',
    passingrushingyards: 'PASSING_RUSHING_YARDS',
    passingtouchdowns: 'PASSING_TD',
    passingattempts: 'PASSING_ATTEMPTS',
    passingcompletions: 'PASSING_COMPLETIONS',
    passinginterceptions: 'PASSING_INTERCEPTIONS',
    longestcompletion: 'PASSING_LONGEST_COMPLETION',
    rushingyards: 'RUSHING_YARDS',
    rushingattempts: 'RUSHING_ATTEMPTS',
    rushingtouchdowns: 'RUSHING_TD',
    longestrush: 'RUSHING_LONGEST_RUSH',
    receivingyards: 'RECEIVING_YARDS',
    receivingreceptions: 'RECEPTIONS',
    receptions: 'RECEPTIONS',
    receivinglongestreception: 'RECEIVING_LONGEST_RECEPTION',
    receivingtouchdowns: 'RECEIVING_TD',
    rushingreceivingyards: 'RUSHING_RECEIVING_YARDS',
    tackles: 'COMBINED_TACKLES',
    solotackles: 'SOLO_TACKLES',
    assistedtackles: 'ASSISTED_TACKLES',
    sacks: 'SACKS',
    kickingpoints: 'KICKING_POINTS',
    extrapointsmade: 'EXTRA_POINTS_MADE',
  };
  return aliases[stat] ?? 'OTHER';
};

export const resolvedMarketType = (market: Pick<MarketCategoryInput, 'marketType' | 'statId'>) => {
  const inferred = inferredTypeFromStat(market.statId);
  if (market.marketType === 'OTHER') return inferred;
  if (
    ['PASSING_RUSHING_YARDS', 'RUSHING_RECEIVING_YARDS', 'RECEIVING_LONGEST_RECEPTION'].includes(
      inferred,
    )
  ) {
    return inferred;
  }
  return market.marketType;
};

const propTypeLabel = (type: string, isAltLine: boolean) => {
  const labels: Record<string, string> = {
    PASSING_YARDS: 'Passing Yards',
    PASSING_RUSHING_YARDS: 'Passing / Rushing Yards',
    PASSING_TD: 'Passing Touchdowns',
    PASSING_COMPLETIONS: 'Passing Completions',
    PASSING_ATTEMPTS: 'Passing Attempts',
    PASSING_LONGEST_COMPLETION: 'Longest Completion',
    PASSING_INTERCEPTIONS: 'Interceptions Thrown',
    RUSHING_YARDS: 'Rushing Yards',
    RUSHING_ATTEMPTS: 'Rushing Attempts',
    RUSHING_LONGEST_RUSH: 'Longest Rush',
    RUSHING_RECEIVING_YARDS: 'Rushing / Receiving Yards',
    RECEIVING_YARDS: 'Receiving Yards',
    RECEPTIONS: 'Receptions',
    RECEIVING_LONGEST_RECEPTION: 'Longest Reception',
    TOUCHDOWNS: 'Touchdowns',
  };
  const label = labels[type] ?? 'Player Props';
  return isAltLine && label !== 'Player Props' ? `Alternate ${label}` : label;
};

export function marketPlacements(market: MarketCategoryInput) {
  const placements: Array<{ primaryCategory: ParlayCategory; subcategory: string }> = [];
  const period = periodCategory(market.period);
  // Older local imports kept some supported props as OTHER. Categorize those
  // from their provider stat id so the UX improves without another API call.
  const type = resolvedMarketType(market);

  if (period) {
    const label = ['MONEYLINE', 'SPREAD', 'TOTAL'].includes(type)
      ? `${periodLabel(market.period)} ${gameLineName(type)}`
      : `${periodLabel(market.period)} ${propTypeLabel(type, market.isAltLine)}`;
    placements.push({ primaryCategory: period, subcategory: label });
    return placements;
  }

  if (['MONEYLINE', 'SPREAD', 'TOTAL'].includes(type)) {
    placements.push({
      primaryCategory: 'popular',
      subcategory: market.isAltLine ? 'Alternate Game Lines' : 'Game Lines',
    });
    placements.push({
      primaryCategory: 'specials',
      subcategory: market.isAltLine ? `Alternate ${gameLineName(type)}` : gameLineName(type),
    });
  }

  if (type.startsWith('PASSING_')) {
    const labels: Record<string, string> = {
      PASSING_YARDS: market.isAltLine ? 'Alternate Passing Yards' : 'Passing Yards',
      PASSING_RUSHING_YARDS: market.isAltLine
        ? 'Alternate Passing / Rushing Yards'
        : 'Passing / Rushing Yards',
      PASSING_TD:
        market.side === 'YES' || market.isAltLine
          ? 'Alternate Passing Touchdowns'
          : 'Passing Touchdowns',
      PASSING_COMPLETIONS: 'Passing Completions',
      PASSING_ATTEMPTS: 'Passing Attempts',
      PASSING_LONGEST_COMPLETION: 'Longest Completion',
      PASSING_INTERCEPTIONS: 'Interceptions Thrown',
    };
    placements.push({
      primaryCategory: 'passing',
      subcategory: labels[type] ?? 'Quarterback Specials',
    });
    placements.push({ primaryCategory: 'popular', subcategory: 'Popular Player Props' });
  }

  if (type.startsWith('RECEIVING_') || type === 'RECEPTIONS') {
    const label =
      type === 'RECEPTIONS'
        ? market.isAltLine
          ? 'Alternate Receptions'
          : 'Receptions'
        : type === 'RECEIVING_YARDS'
          ? market.isAltLine
            ? 'Alternate Receiving Yards'
            : 'Receiving Yards'
          : 'Receiving Touchdowns';
    placements.push({ primaryCategory: 'receiving', subcategory: label });
    placements.push({ primaryCategory: 'popular', subcategory: 'Popular Player Props' });
  }

  if (type === 'RUSHING_RECEIVING_YARDS') {
    const subcategory = market.isAltLine
      ? 'Alternate Rushing / Receiving Yards'
      : 'Rushing / Receiving Yards';
    placements.push({ primaryCategory: 'rushing', subcategory });
    placements.push({ primaryCategory: 'receiving', subcategory });
    placements.push({ primaryCategory: 'popular', subcategory: 'Popular Player Props' });
  }

  if (type.startsWith('RUSHING_') && type !== 'RUSHING_RECEIVING_YARDS') {
    const labels: Record<string, string> = {
      RUSHING_YARDS: market.isAltLine ? 'Alternate Rushing Yards' : 'Rushing Yards',
      RUSHING_ATTEMPTS: 'Rushing Attempts',
      RUSHING_LONGEST_RUSH: 'Longest Rush',
      RUSHING_TD: 'Rushing Touchdowns',
    };
    placements.push({ primaryCategory: 'rushing', subcategory: labels[type] ?? 'Rushing Props' });
    placements.push({ primaryCategory: 'popular', subcategory: 'Popular Player Props' });
  }

  if (type.includes('TD') || type === 'TOUCHDOWNS') {
    placements.push({ primaryCategory: 'touchdowns', subcategory: 'Anytime Touchdown' });
    placements.push({ primaryCategory: 'popular', subcategory: 'Player Touchdowns' });
  }

  if (['COMBINED_TACKLES', 'SOLO_TACKLES', 'ASSISTED_TACKLES', 'SACKS'].includes(type)) {
    placements.push({
      primaryCategory: 'defense',
      subcategory: type === 'SACKS' ? 'Sacks' : 'Defensive Player Props',
    });
  }
  if (['KICKING_POINTS', 'EXTRA_POINTS_MADE'].includes(type))
    placements.push({ primaryCategory: 'defense', subcategory: 'Kicker Props' });
  if (type === 'BOTH_TEAMS_TO_SCORE' || market.statId === 'bothTeamsScored')
    placements.push({ primaryCategory: 'scoring', subcategory: 'Both Teams to Score' });
  if (!placements.length)
    placements.push({
      primaryCategory: 'specials',
      subcategory: market.playerId ? 'Other Player Props' : 'Other Game Markets',
    });
  return placements;
}
