export const SEARCH_INTENTS = [
  'NEXT_GAME',
  'SCHEDULE',
  'PREVIOUS_GAME',
  'SCORE',
  'STANDINGS',
  'TEAM_RECORD',
  'ODDS',
  'PLAYER_PROPS',
  'BETTING_ANALYSIS',
  'SPREAD',
  'TOTAL',
  'MONEYLINE',
  'INJURIES',
  'PLAYER_STATUS',
  'TRANSACTIONS',
  'ROSTER',
  'PLAYER_STATS',
  'TEAM_STATS',
  'NEWS',
  'BREAKING_NEWS',
  'TEAM_BRIEFING',
  'CATCH_ME_UP',
  'PLAYOFF_OUTLOOK',
  'DRAFT',
  'DRAFT_PICKS',
  'PROSPECTS',
  'GENERAL_TEAM_QUESTION',
  'COMPARISON',
  'FOLLOW_UP',
] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];
export type SearchContext = {
  selectedTeamId: string;
  currentTeam: string;
  lastResolvedOpponent?: string;
  lastReferencedGame?: string;
  lastIntent?: SearchIntent;
  lastAnswerEntities?: string[];
};
export type AnswerSource = {
  id: string;
  title: string;
  url: string;
  provider?: string;
  publishedAt?: string | null;
  updatedAt?: string;
  related?: Array<{ title: string; url: string }>;
};
export type SearchGame = {
  id: string;
  home: string;
  away: string;
  startsAt: string;
  week: number | null;
  venue: string | null;
  network: string | null;
  status: 'scheduled' | 'live' | 'final' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
  timeTbd: boolean;
  source: AnswerSource;
};
export type AnswerBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bulletList'; title: string; items: string[] }
  | { type: 'gameCard'; game: SearchGame; timeZone: string }
  | { type: 'schedule'; games: SearchGame[]; timeZone: string }
  | {
      type: 'oddsCard';
      game: SearchGame;
      provider: string;
      timeZone?: string;
      updatedAt: string;
      lines: Array<{ market: string; selection: string; line: number | null; price: number }>;
    }
  | {
      type: 'injuryList' | 'transactionList' | 'standingsSnippet' | 'statTable' | 'roster';
      title: string;
      columns: string[];
      rows: string[][];
    };
export type InformationPlan = {
  intent: SearchIntent;
  teamId: string;
  comparisonTeam?: string;
  afterGame?: string;
  referenceGame?: string;
  needs: Array<
    | 'schedule'
    | 'standings'
    | 'odds'
    | 'roster'
    | 'injuries'
    | 'transactions'
    | 'stats'
    | 'news'
    | 'prospects'
  >;
  ambiguous?: boolean;
};
