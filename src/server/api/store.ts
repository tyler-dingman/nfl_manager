import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO, SaveUnlocksDTO } from '@/types/save';
import type { DraftSessionState } from '@/types/draft';
import type { NewsItemDTO } from '@/types/news';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import {
  formatMoneyMillions,
  getCapHitSchedule,
  getRookieContract,
  getYearOneCapHit,
} from '@/server/logic/cap';
import { logoUrlFor } from './team';
import { getExpiringContractsByTeam } from '@/lib/expiring-contracts';

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
  draftSessions: Record<string, DraftSessionState>;
  expiringContracts: ExpiringContractRow[];
  newsFeed: NewsItemDTO[];
};

const saveStore = new Map<string, SaveState>();

export const listSaveStates = (): Array<{ saveId: string; state: SaveState }> =>
  Array.from(saveStore.entries()).map(([saveId, state]) => ({ saveId, state }));

const baseRoster: StoredPlayer[] = [
  {
    id: '1',
    firstName: 'Jordan',
    lastName: 'Love',
    position: 'QB',
    contractYearsRemaining: 3,
    capHit: '$7.2M',
    capHitValue: 7.2,
    salary: 7.2,
    guaranteed: 2.1,
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 7.2,
    contract: {
      yearsRemaining: 3,
      apy: 7.2,
      guaranteed: 2.1,
      capHit: 7.2,
      expiresAfterSeason: false,
    },
  },
  {
    id: '2',
    firstName: 'Josh',
    lastName: 'Jacobs',
    position: 'RB',
    contractYearsRemaining: 2,
    capHit: '$6.4M',
    capHitValue: 6.4,
    salary: 6.4,
    guaranteed: 1.8,
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 6.4,
    contract: {
      yearsRemaining: 2,
      apy: 6.4,
      guaranteed: 1.8,
      capHit: 6.4,
      expiresAfterSeason: false,
    },
  },
  {
    id: '3',
    firstName: 'Christian',
    lastName: 'Watson',
    position: 'WR',
    contractYearsRemaining: 1,
    capHit: '$3.1M',
    capHitValue: 3.1,
    salary: 3.1,
    guaranteed: 0.9,
    status: 'Injured',
    headshotUrl: null,
    year1CapHit: 3.1,
    contract: {
      yearsRemaining: 1,
      apy: 3.1,
      guaranteed: 0.9,
      capHit: 3.1,
      expiresAfterSeason: true,
    },
  },
  {
    id: '4',
    firstName: 'Elgton',
    lastName: 'Jenkins',
    position: 'OL',
    contractYearsRemaining: 4,
    capHit: '$12.9M',
    capHitValue: 12.9,
    salary: 12.9,
    guaranteed: 4.2,
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 12.9,
    contract: {
      yearsRemaining: 4,
      apy: 12.9,
      guaranteed: 4.2,
      capHit: 12.9,
      expiresAfterSeason: false,
    },
  },
  {
    id: '5',
    firstName: 'Carrington',
    lastName: 'Valentine',
    position: 'CB',
    contractYearsRemaining: 3,
    capHit: '$1.1M',
    capHitValue: 1.1,
    salary: 1.1,
    guaranteed: 0.3,
    status: 'Practice Squad',
    headshotUrl: null,
    year1CapHit: 1.1,
    contract: {
      yearsRemaining: 3,
      apy: 1.1,
      guaranteed: 0.3,
      capHit: 1.1,
      expiresAfterSeason: false,
    },
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
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
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
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
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
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
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
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
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
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
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

const resolveUnlocksForPhase = (phase: string, current?: SaveUnlocksDTO): SaveUnlocksDTO => {
  const next: SaveUnlocksDTO = {
    freeAgency: current?.freeAgency ?? false,
    draft: current?.draft ?? false,
  };

  if (phase === 'free_agency' || phase === 'draft' || phase === 'season') {
    next.freeAgency = true;
  }
  if (phase === 'draft' || phase === 'season') {
    next.draft = true;
  }

  return next;
};

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
    phase: 'resign_cut',
    unlocked: { freeAgency: false, draft: false },
    createdAt: new Date().toISOString(),
  };

  const state: SaveState = {
    header,
    roster,
    freeAgents,
    draftSessions: {},
    expiringContracts: getExpiringContractsByTeam(teamAbbr),
    newsFeed: [],
  };

  saveStore.set(saveId, state);
  return state;
};

export const setSavePhase = (saveId: string, phase: string): SaveResult<SaveHeaderDTO> => {
  const state = getSaveState(saveId);
  if (!state) {
    return { ok: false, error: 'Save not found' };
  }

  state.header.phase = phase;
  state.header.unlocked = resolveUnlocksForPhase(phase, state.header.unlocked);
  return { ok: true, data: getSaveHeaderSnapshot(state) };
};

export const getSaveState = (saveId: string): SaveState | undefined => saveStore.get(saveId);

export type SaveResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const getSaveStateResult = (saveId: string): SaveResult<SaveState> => {
  const state = getSaveState(saveId);
  if (!state) {
    return { ok: false, error: 'Save not found' };
  }

  // Ensure draftSessions is initialized
  if (!state.draftSessions) {
    state.draftSessions = {};
  }
  if (!state.expiringContracts) {
    state.expiringContracts = [];
  }
  if (!state.header.unlocked) {
    state.header.unlocked = resolveUnlocksForPhase(state.header.phase);
  }
  if (state.expiringContracts.length === 0) {
    state.expiringContracts = getExpiringContractsByTeam(state.header.teamAbbr);
  }
  if (!state.newsFeed) {
    state.newsFeed = [];
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
    capHitValue: player.year1CapHit,
    salary: player.year1CapHit,
    guaranteed: 0,
    status: 'Active',
    contract: {
      yearsRemaining: 1,
      apy: player.year1CapHit,
      guaranteed: 0,
      capHit: player.year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(
    0,
    Number((state.header.capSpace - player.year1CapHit).toFixed(1)),
  );
  pushNewsItem(state, {
    type: 'freeAgentSigned',
    teamAbbr: state.header.teamAbbr,
    playerName: `${signedPlayer.firstName} ${signedPlayer.lastName}`,
    details: `${state.header.teamAbbr} sign ${signedPlayer.firstName} ${signedPlayer.lastName}.`,
    severity: 'success',
  });

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
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed: 0,
    status: 'Signed',
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: logoUrlFor(state.header.teamAbbr),
    capHitSchedule,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed: 0,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.freeAgents[playerIndex] = signedPlayer;
  state.roster.push(signedPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(0, Number((state.header.capSpace - year1CapHit).toFixed(1)));
  pushNewsItem(state, {
    type: 'freeAgentSigned',
    teamAbbr: state.header.teamAbbr,
    playerName: `${signedPlayer.firstName} ${signedPlayer.lastName}`,
    details: `${state.header.teamAbbr} sign ${signedPlayer.firstName} ${signedPlayer.lastName}.`,
    severity: 'success',
  });

  return {
    header: getSaveHeaderSnapshot(state),
    player: signedPlayer,
  };
};

export const cutPlayerInState = (
  state: SaveState,
  playerId: string,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const [player] = state.roster.splice(playerIndex, 1);
  const cutPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
    status: 'Free Agent',
    signedTeamAbbr: null,
    signedTeamLogoUrl: null,
    contract: {
      yearsRemaining: 0,
      apy: 0,
      guaranteed: 0,
      capHit: 0,
      expiresAfterSeason: false,
    },
  };

  state.freeAgents.unshift(cutPlayer);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace + player.year1CapHit).toFixed(1));
  pushNewsItem(state, {
    type: 'cut',
    teamAbbr: state.header.teamAbbr,
    playerName: `${cutPlayer.firstName} ${cutPlayer.lastName}`,
    details: `${state.header.teamAbbr} cut ${cutPlayer.firstName} ${cutPlayer.lastName}.`,
    severity: 'warning',
  });

  return {
    header: getSaveHeaderSnapshot(state),
    player: cutPlayer,
  };
};

export const resignPlayerInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const player = state.roster[playerIndex];
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const updatedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Active',
    capHitSchedule,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.roster[playerIndex] = updatedPlayer;
  state.header.capSpace = Math.max(0, Number((state.header.capSpace - year1CapHit).toFixed(1)));

  return {
    header: getSaveHeaderSnapshot(state),
    player: updatedPlayer,
  };
};

export const resignExpiringContractInState = (
  state: SaveState,
  contract: ExpiringContractRow,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const nameParts = contract.name.split(' ');
  const firstName = nameParts[0] ?? contract.name;
  const lastName = nameParts.slice(1).join(' ') || contract.name;
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const newPlayer: StoredPlayer = {
    id: contract.id,
    firstName,
    lastName,
    position: contract.pos,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Active',
    headshotUrl: null,
    year1CapHit,
    capHitSchedule,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.roster.push(newPlayer);
  removeExpiringContract(state, contract.id);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Math.max(0, Number((state.header.capSpace - year1CapHit).toFixed(1)));

  return {
    header: getSaveHeaderSnapshot(state),
    player: newPlayer,
  };
};

export const renegotiatePlayerInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const player = state.roster[playerIndex];
  const currentCapHit = player.capHitValue ?? player.contract?.capHit ?? player.year1CapHit ?? 0;
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const updatedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    capHitSchedule,
    disgruntled: false,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: years <= 1,
    },
  };

  state.roster[playerIndex] = updatedPlayer;
  const delta = year1CapHit - currentCapHit;
  state.header.capSpace = Math.max(0, Number((state.header.capSpace - delta).toFixed(1)));

  return {
    header: getSaveHeaderSnapshot(state),
    player: updatedPlayer,
  };
};

export const markPlayerDisgruntled = (state: SaveState, playerId: string): PlayerRowDTO => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const updatedPlayer: StoredPlayer = {
    ...state.roster[playerIndex],
    disgruntled: true,
  };
  state.roster[playerIndex] = updatedPlayer;
  return updatedPlayer;
};

export const upsertExpiringContract = (state: SaveState, contract: ExpiringContractRow): void => {
  const index = state.expiringContracts.findIndex((entry) => entry.id === contract.id);
  if (index === -1) {
    state.expiringContracts.push(contract);
  } else {
    state.expiringContracts[index] = contract;
  }
};

export const removeExpiringContract = (state: SaveState, contractId: string): void => {
  const index = state.expiringContracts.findIndex((entry) => entry.id === contractId);
  if (index !== -1) {
    state.expiringContracts.splice(index, 1);
  }
};

export const pushNewsItem = (
  state: SaveState,
  item: Omit<NewsItemDTO, 'id' | 'createdAt'>,
): NewsItemDTO => {
  const created = {
    id: `news_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...item,
  };
  state.newsFeed.unshift(created);
  state.newsFeed = state.newsFeed.slice(0, 30);
  return created;
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
      capHitValue: year1CapHit,
      salary: year1CapHit,
      guaranteed: 0,
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
