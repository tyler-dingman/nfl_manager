export type SaveUnlocksDTO = {
  freeAgency: boolean;
  draft: boolean;
};

export type SaveHeaderDTO = {
  id: string;
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
  phase: string;
  unlocked: SaveUnlocksDTO;
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
  unlocked: SaveUnlocksDTO;
  createdAt: string;
};
