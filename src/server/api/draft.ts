import { randomUUID } from 'crypto';

import type { PlayerRowDTO } from '@/types/player';
import type { DraftMode, DraftPickDTO, DraftSessionDTO, DraftSessionState } from '@/types/draft';

import { addDraftedPlayersInState, getSaveStateResult, pushNewsItem } from './store';
import { buildTop32Prospects } from '@/server/data/prospects-top32';

export type DraftSessionStartResponse = {
  draftSessionId: string;
  rng_seed: number;
};

const USER_TEAM_ABBR = 'GB';

const BASE_PROSPECTS: PlayerRowDTO[] = buildTop32Prospects();

const getSaveStateOrThrow = (saveId: string) => {
  const result = getSaveStateResult(saveId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
};

const getDraftSessionState = (saveId: string, draftSessionId: string) => {
  const state = getSaveStateOrThrow(saveId);
  const session = state.draftSessions[draftSessionId];
  if (!session) {
    throw new Error('Draft session not found');
  }
  return { state, session };
};

const DRAFT_ORDER = [
  'CHI',
  'WAS',
  'NE',
  'ARI',
  'LAC',
  'NYG',
  'TEN',
  'ATL',
  'GB',
  'MIN',
  'DEN',
  'LV',
  'NO',
  'IND',
  'SEA',
  'PIT',
  'DAL',
  'MIA',
  'TB',
  'BUF',
  'DET',
  'SF',
  'KC',
  'GB',
];

const cloneProspects = (): PlayerRowDTO[] => BASE_PROSPECTS.map((player) => ({ ...player }));

const buildDraftPicks = (): DraftPickDTO[] =>
  DRAFT_ORDER.map((teamAbbr, index) => ({
    id: `pick-${index + 1}`,
    overall: index + 1,
    round: 1,
    ownerTeamAbbr: teamAbbr,
    originalTeamAbbr: teamAbbr,
    selectedPlayerId: null,
    selectedByTeamAbbr: null,
  }));

const nextRandom = (session: DraftSessionState): number => {
  let seed = session.rngState | 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  session.rngState = seed;
  return result;
};

const getCandidatePool = (prospects: PlayerRowDTO[]): PlayerRowDTO[] => prospects.slice(0, 12);

const pickFromPool = (session: DraftSessionState, pool: PlayerRowDTO[]): PlayerRowDTO => {
  if (pool.length === 0) {
    throw new Error('No candidates available to pick from');
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const temperature = 0.6 + nextRandom(session) * 1.2;
  const weights = pool.map((player) => {
    const rank = player.rank ?? 999;
    return Math.exp(-(rank - 1) / temperature);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = nextRandom(session) * total;

  let running = 0;
  for (let i = 0; i < pool.length; i += 1) {
    running += weights[i] ?? 0;
    if (target <= running) {
      return pool[i];
    }
  }

  return pool[pool.length - 1];
};

const selectPlayer = (
  session: DraftSessionState,
  pickIndex: number,
  player: PlayerRowDTO,
): void => {
  const pick = session.picks[pickIndex];
  if (!pick) {
    return;
  }

  pick.selectedPlayerId = player.id;
  pick.selectedByTeamAbbr = pick.ownerTeamAbbr;
  player.isDrafted = true;
  player.status = 'Drafted';
  session.currentPickIndex = pickIndex + 1;
};

const finalizeDraftSession = (
  session: DraftSessionState,
  state: ReturnType<typeof getSaveStateOrThrow>,
): void => {
  if (session.finalized || session.mode !== 'real') {
    session.status = 'completed';
    return;
  }

  const userSelections = session.picks
    .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
    .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
    .filter((player): player is PlayerRowDTO => Boolean(player));

  addDraftedPlayersInState(state, userSelections);
  session.status = 'completed';
  session.finalized = true;
};

export const createDraftSession = (mode: DraftMode, saveId: string): DraftSessionStartResponse => {
  const draftSessionId = randomUUID();
  const rngSeed = Math.floor(Math.random() * 1_000_000_000) + 1;
  const state = getSaveStateOrThrow(saveId);
  const userTeamAbbr = state.header.teamAbbr ?? USER_TEAM_ABBR;

  const session: DraftSessionState = {
    id: draftSessionId,
    rngSeed,
    rngState: rngSeed,
    mode,
    saveId,
    userTeamAbbr,
    isPaused: false,
    currentPickIndex: 0,
    picks: buildDraftPicks(),
    prospects: cloneProspects(),
    status: 'in_progress',
  };

  state.draftSessions[draftSessionId] = session;

  return { draftSessionId, rng_seed: rngSeed };
};

export const getDraftSession = (draftSessionId: string, saveId: string): DraftSessionDTO => {
  const { session } = getDraftSessionState(saveId, draftSessionId);
  return session;
};

export const pickDraftPlayer = (
  draftSessionId: string,
  playerId: string,
  saveId: string,
): DraftSessionDTO => {
  const { session, state } = getDraftSessionState(saveId, draftSessionId);
  if (session.isPaused) {
    throw new Error('Draft is paused');
  }

  const currentPick = session.picks[session.currentPickIndex];
  if (!currentPick || currentPick.ownerTeamAbbr !== session.userTeamAbbr) {
    throw new Error('Not user pick');
  }

  const player = session.prospects.find((prospect) => prospect.id === playerId);
  if (!player || player.isDrafted) {
    throw new Error('Player not available');
  }

  const pickNumber = session.currentPickIndex + 1;
  selectPlayer(session, session.currentPickIndex, player);
  pushNewsItem(state, {
    type: 'draftPick',
    teamAbbr: session.userTeamAbbr,
    playerName: `${player.firstName} ${player.lastName}`,
    details: `${session.userTeamAbbr} select ${player.firstName} ${player.lastName} at pick ${pickNumber}.`,
    severity: 'success',
  });
  addDraftedPlayersInState(state, [player]);
  if (session.currentPickIndex >= session.picks.length) {
    finalizeDraftSession(session, state);
  }

  return session;
};

export const advanceDraftSession = (draftSessionId: string, saveId: string): DraftSessionDTO => {
  const { session, state } = getDraftSessionState(saveId, draftSessionId);
  if (session.isPaused) {
    throw new Error('Draft is paused');
  }
  if (session.status === 'completed') {
    return session;
  }

  const currentPick = session.picks[session.currentPickIndex];
  if (!currentPick) {
    finalizeDraftSession(session, state);
    return session;
  }

  if (currentPick.ownerTeamAbbr === session.userTeamAbbr) {
    return session;
  }

  const pool = session.prospects
    .filter((player) => !player.isDrafted)
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  if (pool.length === 0) {
    session.currentPickIndex = session.picks.length;
    finalizeDraftSession(session, state);
    return session;
  }

  const candidatePool = getCandidatePool(pool);
  const player = pickFromPool(session, candidatePool);
  selectPlayer(session, session.currentPickIndex, player);
  pushNewsItem(state, {
    type: 'draftPick',
    teamAbbr: currentPick.ownerTeamAbbr,
    playerName: `${player.firstName} ${player.lastName}`,
    details: `${currentPick.ownerTeamAbbr} select ${player.firstName} ${player.lastName} at pick ${
      currentPick.overall
    }.`,
    severity: 'info',
  });

  if (session.currentPickIndex >= session.picks.length) {
    finalizeDraftSession(session, state);
  }

  return session;
};

export const setDraftSessionPaused = (
  draftSessionId: string,
  saveId: string,
  isPaused: boolean,
): DraftSessionDTO => {
  const { session } = getDraftSessionState(saveId, draftSessionId);
  session.isPaused = isPaused;
  return session;
};

export const applyDraftTrade = (
  draftSessionId: string,
  partnerTeamAbbr: string,
  sendPickIds: string[],
  receivePickIds: string[],
  saveId: string,
): DraftSessionDTO => {
  const { session } = getDraftSessionState(saveId, draftSessionId);
  if (session.isPaused) {
    throw new Error('Draft is paused');
  }

  if (session.mode !== 'mock') {
    throw new Error('Trades are mock-only for now');
  }

  const updatedPicks = new Set<string>([...sendPickIds, ...receivePickIds]);
  session.picks.forEach((pick) => {
    if (!updatedPicks.has(pick.id)) {
      return;
    }
    if (sendPickIds.includes(pick.id)) {
      pick.ownerTeamAbbr = partnerTeamAbbr;
    } else if (receivePickIds.includes(pick.id)) {
      pick.ownerTeamAbbr = session.userTeamAbbr;
    }
  });

  return session;
};
