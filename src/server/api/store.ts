import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

export type PlayerFilters = {
  position?: string;
  status?: string;
  query?: string;
};

type StoredPlayer = PlayerRowDTO & {
  year1CapHit: number;
  capHitSchedule?: number[];
};

type SaveState = {
  header: SaveHeaderDTO;
  roster: StoredPlayer[];
  freeAgents: StoredPlayer[];
};

const saveStore = new Map<string, SaveState>();

const baseRoster: StoredPlayer[] = [
  {
    id: '1',
    firstName: 'Jordan',
    lastName: 'Love',
    position: 'QB',
    contractYearsRemaining: 3,
    capHit: '$7.2M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 7.2,
  },
  {
    id: '2',
    firstName: 'Josh',
    lastName: 'Jacobs',
    position: 'RB',
    contractYearsRemaining: 2,
    capHit: '$6.4M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 6.4,
  },
  {
    id: '3',
    firstName: 'Christian',
    lastName: 'Watson',
    position: 'WR',
    contractYearsRemaining: 1,
    capHit: '$3.1M',
    status: 'Injured',
    headshotUrl: null,
    year1CapHit: 3.1,
  },
  {
    id: '4',
    firstName: 'Elgton',
    lastName: 'Jenkins',
    position: 'OL',
    contractYearsRemaining: 4,
    capHit: '$12.9M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 12.9,
  },
  {
    id: '5',
    firstName: 'Carrington',
    lastName: 'Valentine',
    position: 'CB',
    contractYearsRemaining: 3,
    capHit: '$1.1M',
    status: 'Practice Squad',
    headshotUrl: null,
    year1CapHit: 1.1,
  },
];

const baseFreeAgents: StoredPlayer[] = [
  {
    id: '6',
    firstName: 'Tee',
    lastName: 'Higgins',
    position: 'WR',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
    year1CapHit: 13.5,
  },
  {
    id: '7',
    firstName: 'Danielle',
    lastName: 'Hunter',
    position: 'DL',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
    year1CapHit: 15.2,
  },
  {
    id: '8',
    firstName: 'Xavien',
    lastName: 'Howard',
    position: 'CB',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
    year1CapHit: 9.4,
  },
  {
    id: '9',
    firstName: 'Kevin',
    lastName: 'Zeitler',
    position: 'OL',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
    year1CapHit: 6.7,
  },
  {
    id: '10',
    firstName: 'Geno',
    lastName: 'Stone',
    position: 'S',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
    year1CapHit: 4.8,
  },
];

const clonePlayers = (players: StoredPlayer[]) =>
  players.map((player) => ({ ...player }));

export const createSaveState = (saveId: string, teamAbbr: string): SaveState => {
  const roster = clonePlayers(baseRoster);
  const freeAgents = clonePlayers(baseFreeAgents);
  const header: SaveHeaderDTO = {
    id: saveId,
    teamAbbr,
    capSpace: 50.0,
    capLimit: 255.4,
    rosterCount: roster.length,
    rosterLimit: 53,
    createdAt: new Date().toISOString(),
  };

  const state: SaveState = {
    header,
    roster,
    freeAgents,
  };

  saveStore.set(saveId, state);
  return state;
};

export const getSaveState = (saveId: string): SaveState | undefined =>
  saveStore.get(saveId);

const matchesFilter = (player: StoredPlayer, filters?: PlayerFilters): boolean => {
  if (!filters) {
    return true;
  }

  if (filters.position && player.position !== filters.position) {
    return false;
  }

  if (filters.status && player.status !== filters.status) {
    return false;
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    if (!fullName.includes(query)) {
      return false;
    }
  }

  return true;
};

export const filterPlayers = (
  players: StoredPlayer[],
  filters?: PlayerFilters,
): StoredPlayer[] => players.filter((player) => matchesFilter(player, filters));

export const formatCapHit = (value: number): string => `$${value.toFixed(1)}M`;

const CAP_HIT_MULTIPLIERS: Record<number, number[]> = {
  1: [1.0],
  2: [0.7, 1.3],
  3: [0.5, 0.9, 1.2],
  4: [0.45, 0.8, 1.05, 1.2],
  5: [0.4, 0.7, 0.95, 1.1, 1.25],
};

export const signFreeAgentInState = (
  state: SaveState,
  playerId: string,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.freeAgents.findIndex((agent) => agent.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Free agent not found');
  }

  const [player] = state.freeAgents.splice(playerIndex, 1);
  const signedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: 1,
    capHit: formatCapHit(player.year1CapHit),
    status: 'Active',
  };

  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(
    0,
    Number((state.header.capSpace - player.year1CapHit).toFixed(1)),
  );

  return {
    header: state.header,
    player: signedPlayer,
  };
};

export const offerContractInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.freeAgents.findIndex((agent) => agent.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Free agent not found');
  }

  const multipliers = CAP_HIT_MULTIPLIERS[years];
  if (!multipliers) {
    throw new Error('Invalid contract length');
  }

  const player = state.freeAgents[playerIndex];
  const capHitSchedule = multipliers.map((multiplier) =>
    Number((apy * multiplier).toFixed(1)),
  );
  const signedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatCapHit(capHitSchedule[0] ?? apy),
    status: 'Signed',
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: `https://static.nfl.com/static/content/public/static/wildcat/assets/img/logos/teams/${state.header.teamAbbr}.svg`,
    capHitSchedule,
  };

  state.freeAgents[playerIndex] = signedPlayer;
  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(
    0,
    Number((state.header.capSpace - (capHitSchedule[0] ?? apy)).toFixed(1)),
  );

  return {
    header: state.header,
    player: signedPlayer,
  };
};
