export const SPORTSBOOKS = [
  { id: 'FANDUEL', providerId: 'fanduel', name: 'FanDuel', url: 'https://sportsbook.fanduel.com/' },
  {
    id: 'DRAFTKINGS',
    providerId: 'draftkings',
    name: 'DraftKings',
    url: 'https://sportsbook.draftkings.com/',
  },
  {
    id: 'BETMGM',
    providerId: 'betmgm',
    name: 'BetMGM',
    url: 'https://sports.betmgm.com/en/sports',
  },
  {
    id: 'CAESARS',
    providerId: 'caesars',
    name: 'Caesars',
    url: 'https://www.caesars.com/sportsbook-and-casino',
  },
] as const;

export type Sportsbook = (typeof SPORTSBOOKS)[number]['id'];
export type ProviderSportsbook = (typeof SPORTSBOOKS)[number]['providerId'];

export const SPORTSBOOK_IDS = SPORTSBOOKS.map((book) => book.id);
export const PROVIDER_SPORTSBOOK_IDS = SPORTSBOOKS.map((book) => book.providerId);
export const sportsbookName = (id: Sportsbook) =>
  SPORTSBOOKS.find((book) => book.id === id)?.name ?? id;
export const sportsbookIdFromProvider = (providerId: ProviderSportsbook) =>
  SPORTSBOOKS.find((book) => book.providerId === providerId)!.id;
