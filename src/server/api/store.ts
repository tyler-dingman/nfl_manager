import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';
import {
  formatMoneyMillions,
  getCapHitSchedule,
  getRookieContract,
  getYearOneCapHit,
} from '@/server/logic/cap';

export type PlayerFilters = {
  position?: string;
  status?: string;
  query?: string;
};

type StoredPlayer = PlayerRowDTO & {
  year1CapHit: number;
  capHitSchedule?: number[];
};

export type SaveState = {
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

const clonePlayers = (players: StoredPlayer[]) => players.map((player) => ({ ...player }));

export const getSaveHeaderSnapshot = (state: SaveState): SaveHeaderDTO => ({
  ...state.header,
  rosterCount: state.roster.length,
});

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
    phase: 'free_agency',
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

export const getSaveState = (saveId: string): SaveState | undefined => saveStore.get(saveId);

export type SaveResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const getSaveStateResult = (saveId: string): SaveResult<SaveState> => {
  const state = getSaveState(saveId);
  if (!state) {
    return { ok: false, error: 'Save not found' };
  }

  return { ok: true, data: state };
};

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

export const filterPlayers = (players: StoredPlayer[], filters?: PlayerFilters): StoredPlayer[] =>
  players.filter((player) => matchesFilter(player, filters));

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
    capHit: formatMoneyMillions(player.year1CapHit),
    status: 'Active',
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${state.header.teamAbbr.toLowerCase()}.png`,
  };

  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(
    0,
    Number((state.header.capSpace - player.year1CapHit).toFixed(1)),
  );

  return {
    header: getSaveHeaderSnapshot(state),
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

  const player = state.freeAgents[playerIndex];
  const capHitSchedule = getCapHitSchedule(apy, years);
  const year1CapHit = getYearOneCapHit(apy, years);
  const signedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    status: 'Signed',
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${state.header.teamAbbr.toLowerCase()}.png`,
    capHitSchedule,
  };

  state.freeAgents[playerIndex] = signedPlayer;
  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(0, Number((state.header.capSpace - year1CapHit).toFixed(1)));

  return {
    header: getSaveHeaderSnapshot(state),
    player: signedPlayer,
  };
};

export const addDraftedPlayersInState = (
  state: SaveState,
  draftedPlayers: PlayerRowDTO[],
): { header: SaveHeaderDTO; players: PlayerRowDTO[] } => {
  const addedPlayers: StoredPlayer[] = [];

  draftedPlayers.forEach((player) => {
    if (state.roster.some((rosterPlayer) => rosterPlayer.id === player.id)) {
      return;
    }

    const { years, year1CapHit } = getRookieContract(player.rank);
    const rookiePlayer: StoredPlayer = {
      ...player,
      contractYearsRemaining: years,
      capHit: formatMoneyMillions(year1CapHit),
      status: 'ROOKIE',
      year1CapHit,
    };

    state.roster.push(rookiePlayer);
    addedPlayers.push(rookiePlayer);
    state.header.rosterCount = state.roster.length;
    state.header.capSpace = Math.max(0, Number((state.header.capSpace - year1CapHit).toFixed(1)));
  });

  return {
    header: getSaveHeaderSnapshot(state),
    players: addedPlayers,
  };
};
