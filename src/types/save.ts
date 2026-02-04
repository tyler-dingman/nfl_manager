export type SaveHeaderDTO = {
  id: string;
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
  phase: string;
  createdAt: string;
};

export type SaveBootstrapDTO = {
  ok: true;
  saveId: string;
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
  phase: string;
  createdAt: string;
};
