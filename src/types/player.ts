export type PlayerRowDTO = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  contractYearsRemaining: number;
  capHit: string;
  status: string;
  headshotUrl?: string | null;
  isDrafted?: boolean;
};
