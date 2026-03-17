export type ExpiringContractRow = {
  id: string;
  name: string;
  pos: string;
  teamAbbr: string;
  contractType: string;
  interestPct: number;
  age: number;
  rating?: number;
  estValue: number;
  currentSalary: number;
  maxValue: number;
  headshotUrl?: string | null;
  lastTeamAbbr?: string;
  previousTeamAbbr?: string;
};
