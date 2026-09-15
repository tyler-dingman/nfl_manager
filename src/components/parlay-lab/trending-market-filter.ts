type TrendingMarket = {
  marketType: string;
  statId?: string | null;
};

type LabPickMarket = {
  side: string;
  labResearch?: { labFindSide: 'OVER' | 'UNDER' | null } | null;
};

export type TrendingMarketFilter = 'ALL' | 'PASSING' | 'RUSHING' | 'RECEIVING' | 'TOUCHDOWN';

const searchableMarketName = (market: TrendingMarket) =>
  `${market.marketType} ${market.statId ?? ''}`.replaceAll('-', '_').toUpperCase();

export function matchesTrendingMarketFilter(
  market: TrendingMarket,
  filter: TrendingMarketFilter | string,
) {
  if (filter === 'ALL') return true;

  const name = searchableMarketName(market);

  switch (filter) {
    case 'PASSING':
      return name.includes('PASS');
    case 'RUSHING':
      return name.includes('RUSH') && !name.includes('PASSING_RUSHING');
    case 'RECEIVING':
      return name.includes('RECEIV') || name.includes('RECEPTION');
    case 'TOUCHDOWN':
      return name.includes('TOUCHDOWN') || /(^|_)TD($|_)/.test(name);
    default:
      return false;
  }
}

export function isLabPickMarket(market: LabPickMarket) {
  return market.labResearch?.labFindSide === market.side;
}
