export type NewsItemType =
  | 'reSignAccepted'
  | 'reSignDeclined'
  | 'cut'
  | 'trade'
  | 'draftPick'
  | 'freeAgentSigned';

export type NewsItemSeverity = 'info' | 'success' | 'warning';

export type NewsItemDTO = {
  id: string;
  createdAt: string;
  type: NewsItemType;
  teamAbbr: string;
  playerName: string;
  details: string;
  quote?: string;
  severity?: NewsItemSeverity;
};
