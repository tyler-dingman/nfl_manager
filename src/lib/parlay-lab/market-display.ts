const MARKET_NAMES: Record<string, string> = {
  PASSING_YARDS: 'Passing Yards',
  PASSING_RUSHING_YARDS: 'Passing / Rushing Yards',
  RUSHING_YARDS: 'Rushing Yards',
  RECEIVING_YARDS: 'Receiving Yards',
  RECEPTIONS: 'Receptions',
  PASSING_TDS: 'Passing TDs',
  RUSHING_TDS: 'Rushing TDs',
  RECEIVING_TDS: 'Receiving TDs',
  ANYTIME_TD: 'Touchdowns',
  RUSH_RECEIVE_YARDS: 'Rushing / Receiving Yards',
  RUSHING_RECEIVING_YARDS: 'Rushing / Receiving Yards',
  PASSING_COMPLETIONS: 'Completions',
  PASSING_ATTEMPTS: 'Passing Attempts',
  RUSHING_ATTEMPTS: 'Rushing Attempts',
  INTERCEPTIONS: 'Interceptions',
};
export const marketDisplayName = (statType: string) =>
  MARKET_NAMES[statType] ??
  statType
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const unit = (statType: string, amount: number) => {
  const plural = amount !== 1;
  if (statType === 'RECEPTIONS') return plural ? 'receptions' : 'reception';
  if (statType === 'PASSING_TDS') return plural ? 'passing TDs' : 'passing TD';
  if (statType === 'RUSHING_TDS') return plural ? 'rushing TDs' : 'rushing TD';
  if (statType === 'RECEIVING_TDS') return plural ? 'receiving TDs' : 'receiving TD';
  if (statType === 'ANYTIME_TD') return plural ? 'touchdowns' : 'touchdown';
  if (statType === 'PASSING_COMPLETIONS') return plural ? 'completions' : 'completion';
  if (statType === 'INTERCEPTIONS') return plural ? 'interceptions' : 'interception';
  return marketDisplayName(statType).toLowerCase();
};
export function formatLineLadderThreshold(
  statType: string,
  threshold: number,
  side: 'OVER' | 'UNDER',
) {
  if (side === 'UNDER')
    return `Under ${Math.floor(threshold)} ${unit(statType, Math.floor(threshold))}`;
  const amount = Math.floor(threshold) + 1;
  return `${amount}+ ${unit(statType, amount)}`;
}
export const ladderDescriptionUnit = (statType: string) => {
  if (statType === 'RECEPTIONS') return 'reception total';
  if (statType === 'PASSING_YARDS') return 'passing-yard total';
  if (statType === 'RUSHING_YARDS') return 'rushing-yard total';
  if (statType === 'RECEIVING_YARDS') return 'receiving-yard total';
  return `${marketDisplayName(statType).toLowerCase()} total`;
};
