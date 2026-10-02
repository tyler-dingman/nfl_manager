export type NewsGraphicVariant =
  | 'trade-rumor'
  | 'trade'
  | 'injury'
  | 'game-recap'
  | 'contract'
  | 'signing'
  | 'player-performance'
  | 'draft'
  | 'standings'
  | 'coach'
  | 'rumor'
  | 'breaking';

export type NewsGraphicTeam = {
  id: string;
  abbreviation: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
};
