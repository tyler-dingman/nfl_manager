export type PlayerRowDTO = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  rank?: number;
  college?: string;
  grade?: string;
  projectedRound?: string;
  contractYearsRemaining: number;
  capHit: string;
  status: string;
  headshotUrl?: string | null;
  isDrafted?: boolean;
  signedTeamAbbr?: string | null;
  signedTeamLogoUrl?: string | null;
};
