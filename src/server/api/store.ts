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
import { buildFreeAgencyPool, buildFreeAgentProfile } from '@/server/logic/free-agency-pool';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { KANSAS_CITY_CHIEFS_ROSTER } from '@/data/rosters/kc';

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
  teamRosters: Record<string, StoredPlayer[]>;
  teamCaps: Record<string, number>;
  transactions: Array<{
    id: string;
    type: 'signing' | 'trade';
    playerId: string;
    fromTeamAbbr?: string;
    toTeamAbbr?: string;
    capHit: number;
    createdAt: string;
  }>;
  draftSessions: Record<string, DraftSessionState>;
  expiringContracts: ExpiringContractRow[];
  newsFeed: NewsItemDTO[];
  rosterMoves: {
    cuts: Array<{ playerId: string; name: string; capSavings: number; timestamp: string }>;
    resigns: Array<{ playerId: string; name: string; timestamp: string }>;
    trades: Array<{ playerId: string; name: string; timestamp: string }>;
  };
};

const saveStore = new Map<string, SaveState>();

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: name, lastName: '' };
  }
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

const getLatestContractByPlayerId = () => {
  const contracts = new Map<string, (typeof NFL_LEAGUE_DATA.contracts)[number]>();
  NFL_LEAGUE_DATA.contracts.forEach((contract) => {
    if (!contracts.has(contract.playerId)) {
      contracts.set(contract.playerId, contract);
    }
  });
  return contracts;
};

const leagueContractsByPlayerId = getLatestContractByPlayerId();

const normalizePlayerName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

const rosterFallbackByTeam = new Map<
  string,
  Map<string, { capHit: number; deadCap: number; yearsRemaining?: number }>
>();

rosterFallbackByTeam.set(
  'KC',
  new Map(
    KANSAS_CITY_CHIEFS_ROSTER.map((entry) => [
      normalizePlayerName(entry.fullName),
      {
        capHit: entry.capHitTop51,
        deadCap: entry.deadCap,
        yearsRemaining: entry.yearsRemaining,
      },
    ]),
  ),
);

const toMillions = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return Number((value / 1_000_000).toFixed(1));
};

const resolvePlayerContractValues = (
  player: (typeof NFL_LEAGUE_DATA.players)[number],
  teamAbbr: string,
) => {
  const unifiedContract = leagueContractsByPlayerId.get(player.id);
  const fallback = rosterFallbackByTeam
    .get(teamAbbr.toUpperCase())
    ?.get(normalizePlayerName(player.name));

  const capHitFromUnified = toMillions(unifiedContract?.capHit ?? null);
  const capHitFromFallback = toMillions(fallback?.capHit ?? null);
  const capHitValue = capHitFromUnified ?? capHitFromFallback ?? 0;

  const guaranteedFromUnified = toMillions(unifiedContract?.guaranteed ?? null);
  const guaranteed = guaranteedFromUnified ?? Math.max(0, Number((capHitValue * 0.4).toFixed(1)));

  const yearsRemaining = Math.max(1, unifiedContract?.years ?? fallback?.yearsRemaining ?? 1);
  const deadCapFromUnified = toMillions(unifiedContract?.deadCap ?? null);
  const releaseSavingsFromUnified = toMillions(unifiedContract?.releaseSavings ?? null);
  const deadCapFromSavings =
    capHitValue > 0 && releaseSavingsFromUnified !== null
      ? Math.max(0, Number((capHitValue - releaseSavingsFromUnified).toFixed(1)))
      : null;
  const deadCapEstimate =
    deadCapFromUnified ??
    deadCapFromSavings ??
    toMillions(fallback?.deadCap ?? null) ??
    Math.max(0, Number((capHitValue * 0.35).toFixed(1)));
  const releaseSavings =
    releaseSavingsFromUnified ?? Math.max(0, Number((capHitValue - deadCapEstimate).toFixed(1)));
  const postJune1Savings = toMillions(unifiedContract?.postJune1Savings ?? null);

  return {
    capHitValue,
    guaranteed,
    yearsRemaining,
    deadCapEstimate,
    releaseSavings,
    postJune1Savings,
  };
};

const buildLeagueRoster = (teamAbbr: string): StoredPlayer[] => {
  const players = NFL_LEAGUE_DATA.players.filter(
    (player) => player.teamAbbr === teamAbbr.toUpperCase(),
  );
  const roster = players.map((player) => {
    const { firstName, lastName } = splitName(player.name);
    const resolved = resolvePlayerContractValues(player, teamAbbr);
    const year1CapHit = resolved.capHitValue;
    const guaranteed = resolved.guaranteed;
    const yearsRemaining = resolved.yearsRemaining;
    const apy = year1CapHit;
    const deadCap = resolved.deadCapEstimate;
    const releaseSavings = resolved.releaseSavings;
    const postJune1Savings = resolved.postJune1Savings;
    return {
      id: `${teamAbbr.toLowerCase()}-${player.id}`,
      firstName,
      lastName,
      position: player.position,
      contractYearsRemaining: yearsRemaining,
      capHit: formatMoneyMillions(year1CapHit),
      capHitValue: year1CapHit,
      salary: apy,
      guaranteed,
      deadCap,
      releaseSavings,
      postJune1Savings: postJune1Savings ?? undefined,
      status: 'Active',
      headshotUrl: player.headshotUrl,
      year1CapHit,
      contract: {
        yearsRemaining,
        apy,
        guaranteed,
        capHit: year1CapHit,
        expiresAfterSeason: yearsRemaining <= 1,
      },
    };
  });

  if (process.env.NODE_ENV !== 'production' && roster.length > 0) {
    const capRecord = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === teamAbbr.toUpperCase());
    const samplePlayer = players[0];
    const sampleContract = samplePlayer ? leagueContractsByPlayerId.get(samplePlayer.id) : undefined;
    const sampleResolved = roster[0];
    console.info('[roster-cap-debug]', {
      teamAbbr,
      selectedTeamCap: capRecord,
      sampleContract,
      sampleResolved: sampleResolved
        ? {
            id: sampleResolved.id,
            name: `${sampleResolved.firstName} ${sampleResolved.lastName}`,
            capHitValue: sampleResolved.capHitValue,
            deadCap: sampleResolved.deadCap,
          }
        : null,
    });
  }

  return roster;
};

const buildRosterForTeam = (teamAbbr: string): StoredPlayer[] => buildLeagueRoster(teamAbbr);

const clonePlayers = (players: StoredPlayer[]) => players.map((player) => ({ ...player }));

const capSpaceMillionsForTeam = (teamAbbr: string): number => {
  const capSeed = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === teamAbbr.toUpperCase());
  return Number(((capSeed?.availableCap ?? 0) / 1_000_000).toFixed(1));
};

const capLimitMillionsForTeam = (teamAbbr: string, roster: StoredPlayer[]): number => {
  const capSeed = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === teamAbbr.toUpperCase());
  if (capSeed?.totalCap !== null && capSeed?.totalCap !== undefined) {
    return Number((capSeed.totalCap / 1_000_000).toFixed(1));
  }

  const availableCap = capSpaceMillionsForTeam(teamAbbr);
  const commitments = roster
    .filter((player) => player.status.toLowerCase() !== 'cut')
    .reduce((sum, player) => sum + (player.capHitValue ?? player.year1CapHit ?? 0), 0);

  return Number((availableCap + commitments).toFixed(1));
};

export const getProjectedRosterForTeam = (state: SaveState, teamAbbr: string): StoredPlayer[] =>
  clonePlayers(state.teamRosters[teamAbbr.toUpperCase()] ?? []);

export const getProjectedCapSpaceForTeam = (state: SaveState, teamAbbr: string): number =>
  Number((state.teamCaps[teamAbbr.toUpperCase()] ?? capSpaceMillionsForTeam(teamAbbr)).toFixed(1));

const removePlayerFromAllRosters = (state: SaveState, playerId: string): void => {
  Object.keys(state.teamRosters).forEach((abbr) => {
    state.teamRosters[abbr] = state.teamRosters[abbr].filter((player) => player.id !== playerId);
  });
};

export const listSaveStates = (): Array<{ saveId: string; state: SaveState }> =>
  Array.from(saveStore.entries()).map(([saveId, state]) => ({ saveId, state }));

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
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const roster = buildRosterForTeam(normalizedTeamAbbr);
  const freeAgents = buildFreeAgencyPool({
    saveId,
    league: NFL_LEAGUE_DATA,
    teamAbbr: teamAbbr.toUpperCase(),
  }).map((player) => ({
    ...player,
    year1CapHit:
      player.freeAgentProfile?.expectedAnnualValue ?? (player.marketValue ?? 1_000_000) / 1_000_000,
  })) as StoredPlayer[];
  const capSpace = capSpaceMillionsForTeam(normalizedTeamAbbr);
  const capLimit = capLimitMillionsForTeam(normalizedTeamAbbr, roster);
  const header: SaveHeaderDTO = {
    id: saveId,
    teamAbbr: normalizedTeamAbbr,
    capSpace,
    capLimit,
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
    teamRosters: { [normalizedTeamAbbr]: roster },
    teamCaps: { [normalizedTeamAbbr]: capSpace },
    transactions: [],
    draftSessions: {},
    expiringContracts: getExpiringContractsByTeam(teamAbbr),
    newsFeed: [],
    rosterMoves: { cuts: [], resigns: [], trades: [] },
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

export const ensureSaveState = (saveId: string, teamAbbr: string): SaveState => {
  const existing = getSaveState(saveId);
  if (existing) {
    return existing;
  }
  return createSaveState(saveId, teamAbbr);
};

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
  if (!state.rosterMoves) {
    state.rosterMoves = { cuts: [], resigns: [], trades: [] };
  }
  if (!state.teamRosters) {
    state.teamRosters = { [state.header.teamAbbr]: state.roster };
  }
  if (!state.teamCaps) {
    state.teamCaps = { [state.header.teamAbbr]: state.header.capSpace };
  }
  if (!state.transactions) {
    state.transactions = [];
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
  if (state.header.capSpace < player.year1CapHit) {
    throw new Error('Signing would exceed available cap space');
  }
  const signedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: 1,
    capHit: formatMoneyMillions(player.year1CapHit),
    capHitValue: player.year1CapHit,
    salary: player.year1CapHit,
    guaranteed: 0,
    status: 'Active',
    signedAt: new Date().toISOString(),
    freeAgentProfile: player.freeAgentProfile
      ? {
          ...player.freeAgentProfile,
          marketStatus: 'signed',
          availabilityStatus: 'signed',
          available: false,
          refreshedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
      : player.freeAgentProfile,
    contract: {
      yearsRemaining: 1,
      apy: player.year1CapHit,
      guaranteed: 0,
      capHit: player.year1CapHit,
      expiresAfterSeason: false,
    },
  };

  removePlayerFromAllRosters(state, signedPlayer.id);
  const userTeam = state.header.teamAbbr.toUpperCase();
  const currentRoster = state.teamRosters[userTeam] ?? [];
  state.teamRosters[userTeam] = [...currentRoster, signedPlayer];
  state.roster = state.teamRosters[userTeam];
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace - player.year1CapHit).toFixed(1));
  state.teamCaps[userTeam] = state.header.capSpace;
  state.transactions.push({
    id: `tx_sign_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'signing',
    playerId: signedPlayer.id,
    toTeamAbbr: userTeam,
    capHit: signedPlayer.year1CapHit,
    createdAt: new Date().toISOString(),
  });
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
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.freeAgents.findIndex((agent) => agent.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Free agent not found');
  }

  const [player] = state.freeAgents.splice(playerIndex, 1);
  const capHitSchedule = getCapHitSchedule(apy, years);
  const year1CapHit = getYearOneCapHit(apy, years);
  const signedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Signed',
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: logoUrlFor(state.header.teamAbbr),
    signedAt: new Date().toISOString(),
    capHitSchedule,
    freeAgentProfile: player.freeAgentProfile
      ? {
          ...player.freeAgentProfile,
          marketStatus: 'signed',
          availabilityStatus: 'signed',
          available: false,
          refreshedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
      : player.freeAgentProfile,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  removePlayerFromAllRosters(state, signedPlayer.id);
  const userTeam = state.header.teamAbbr.toUpperCase();
  const currentRoster = state.teamRosters[userTeam] ?? [];
  state.teamRosters[userTeam] = [...currentRoster, signedPlayer];
  state.roster = state.teamRosters[userTeam];
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  state.teamCaps[userTeam] = state.header.capSpace;
  state.transactions.push({
    id: `tx_sign_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'signing',
    playerId: signedPlayer.id,
    toTeamAbbr: userTeam,
    capHit: year1CapHit,
    createdAt: new Date().toISOString(),
  });
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

  const player = state.roster[playerIndex];
  const existingCut = state.rosterMoves.cuts.find((cut) => cut.playerId === playerId);
  if (existingCut || player.status.toLowerCase() === 'cut') {
    throw new Error('Player already cut');
  }

  const capHitValue = player.capHitValue ?? player.year1CapHit ?? 0;
  const deadCap = player.deadCap ?? 0;
  const capSavings = player.releaseSavings ?? Math.max(0, capHitValue - deadCap);
  const cutPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
    status: 'Cut',
    cutAt: new Date().toISOString(),
    contract: {
      yearsRemaining: 0,
      apy: 0,
      guaranteed: 0,
      capHit: 0,
      expiresAfterSeason: false,
    },
  };

  state.roster[playerIndex] = cutPlayer;
  const generatedAt = new Date().toISOString();
  const cutFreeAgent: StoredPlayer = {
    ...cutPlayer,
    status: 'Free Agent',
    year1CapHit: capHitValue > 0 ? capHitValue : 1,
    marketValue: Math.round((capHitValue > 0 ? capHitValue : 1) * 1_000_000),
    freeAgentProfile: buildFreeAgentProfile({
      playerId: cutPlayer.id,
      saveId: state.header.id,
      position: cutPlayer.position,
      age: cutPlayer.age,
      lastContractApy: (player.contract?.apy ?? player.salary ?? capHitValue) * 1_000_000,
      lastGuaranteed: (player.contract?.guaranteed ?? player.guaranteed ?? 0) * 1_000_000,
      teamAbbr: state.header.teamAbbr,
      generatedAt,
      source: 'released',
    }),
  };
  if (!state.freeAgents.some((agent) => agent.id === cutFreeAgent.id)) {
    state.freeAgents.push({
      ...cutFreeAgent,
      freeAgentProfile: cutFreeAgent.freeAgentProfile
        ? {
            ...cutFreeAgent.freeAgentProfile,
            source: 'released',
            availabilityStatus: 'available',
            marketStatus: 'available',
          }
        : cutFreeAgent.freeAgentProfile,
    });
  }
  state.rosterMoves.cuts.push({
    playerId,
    name: `${cutPlayer.firstName} ${cutPlayer.lastName}`,
    capSavings,
    timestamp: new Date().toISOString(),
  });
  state.header.rosterCount = state.roster.filter(
    (rosterPlayer) => rosterPlayer.status !== 'Cut',
  ).length;
  state.header.capSpace = Number((state.header.capSpace + capSavings).toFixed(1));
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
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));

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
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));

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
  state.header.capSpace = Number((state.header.capSpace - delta).toFixed(1));

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
    state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  });

  return {
    header: getSaveHeaderSnapshot(state),
    players: addedPlayers,
  };
};
