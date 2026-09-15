type DisplayMarket = {
  marketType: string;
  playerName: string | null;
  teamId: string | null;
  side: string;
  line: number | null;
  isAltLine: boolean;
};

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const subjectLabel = (market: DisplayMarket) => market.playerName ?? market.teamId ?? 'Game';
const lineLabel = (market: DisplayMarket) =>
  market.line === null
    ? ''
    : market.isAltLine && market.side === 'OVER'
      ? `${Math.ceil(market.line)}+`
      : String(market.line);

export const rowName = (market: DisplayMarket) => {
  const thresholdYes = market.side === 'YES' && market.marketType.includes('TD');
  return [subjectLabel(market), thresholdYes ? '' : market.side ? humanize(market.side) : '']
    .filter(Boolean)
    .join(' ');
};

export const sportsbookLineLabel = (market: DisplayMarket) => {
  if (market.marketType === 'MONEYLINE') return 'ML';
  const threshold = lineLabel(market);
  if (market.side === 'YES' && market.marketType.includes('TD'))
    return market.line === null ? '1+' : `${Math.ceil(market.line)}+`;
  if (market.side === 'OVER') return threshold ? `O ${threshold}` : 'Over';
  if (market.side === 'UNDER') return threshold ? `U ${threshold}` : 'Under';
  if (market.side === 'YES' || market.side === 'NO') return humanize(market.side);
  if (market.line !== null) return `${market.line > 0 ? '+' : ''}${market.line}`;
  return market.side ? humanize(market.side) : market.marketType;
};
