export type Opportunity = {
  carries: number | null;
  targets: number | null;
  passingAttempts: number | null;
  snapShare: number | null;
  routes: number | null;
};
export type RoleObservation = {
  playerId: string;
  teamId: string;
  position: string;
  playerName?: string;
  source: string;
  kind: 'official_injury' | 'inactive' | 'depth' | 'report' | 'usage';
  /** Source publication time, never substituted with retrieval time. */
  sourceAt: string;
  receivedAt: string;
  status?: 'AVAILABLE' | 'OUT' | 'IR' | 'SUSPENDED' | 'QUESTIONABLE' | 'RETURNING';
  depthRank?: number;
  expected?: Partial<Opportunity>;
  change?: 'PROMOTED' | 'DEMOTED' | 'TRADED' | 'SIGNED' | 'RELEASED' | 'COACHING';
};
export type RoleContext = {
  asOf: string;
  teamId?: string | null;
  observations?: RoleObservation[];
  /** Coverage only means a current complete feed was received, not that all players are healthy. */
  coverageAt?: string | null;
};
