import { randomUUID } from 'crypto';

import type { PlayerRowDTO } from '@/types/player';
import type { DraftMode, DraftPickDTO, DraftSessionDTO, DraftSessionState } from '@/types/draft';

import {
  addDraftedPlayersInState,
  ensureSaveState,
  getSaveStateResult,
  listSaveStates,
  pushNewsItem,
  restoreSaveState,
  transferStoredPlayerToTeam,
} from './store';
import { buildTop32Prospects } from '@/server/data/prospects-top32';
import { createRng } from '@/lib/deterministic-rng';
import { getRandomCpuGrade } from '@/lib/draft-grading';
import { getSaveHeaderSnapshot, getProjectedCapSpaceForTeam } from './store';
import type { TradeOfferDTO } from '@/types/trade-offers';
import type { SaveUnlocksDTO } from '@/types/save';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { computeTeamNeeds } from '@/lib/team-overview';

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

export const findSaveIdForDraftSession = (draftSessionId: string): string | null =>
  listSaveStates().find((entry) => Boolean(entry.state.draftSessions?.[draftSessionId]))?.saveId ?? null;

type DraftSaveSnapshot = {
  teamAbbr: string;
  year?: number;
  capSpace: number;
  capLimit: number;
  roster: PlayerRowDTO[];
  phase?: string;
  unlocked?: SaveUnlocksDTO;
  createdAt?: string;
};

const cloneDraftSessionSnapshot = (session: DraftSessionDTO, saveId: string): DraftSessionState => ({
  ...session,
  rngState: session.rngState ?? session.rngSeed,
  saveId,
  finalized: session.status === 'completed',
  picks: session.picks.map((pick) => ({ ...pick })),
  prospects: session.prospects.map((prospect) => ({
    ...prospect,
    stats: { ...(prospect.stats ?? {}) },
    contract: prospect.contract ? { ...prospect.contract } : prospect.contract,
  })),
});

export const restoreDraftSession = (
  saveId: string,
  session: DraftSessionDTO,
  saveSnapshot?: DraftSaveSnapshot,
): DraftSessionDTO => {
  const state = saveSnapshot
    ? restoreSaveState(saveId, {
      teamAbbr: saveSnapshot.teamAbbr,
      year: saveSnapshot.year,
      capSpace: saveSnapshot.capSpace,
        capLimit: saveSnapshot.capLimit,
        roster: saveSnapshot.roster,
        phase: saveSnapshot.phase,
        unlocked: saveSnapshot.unlocked,
        createdAt: saveSnapshot.createdAt,
      })
    : ensureSaveState(saveId, session.userTeamAbbr);

  state.draftSessions[session.id] = cloneDraftSessionSnapshot(session, saveId);
  return state.draftSessions[session.id];
};

const ROUND_ONE_DRAFT_ORDER = [
  'LV',
  'NYJ',
  'ARI',
  'TEN',
  'NYG',
  'CLE',
  'WAS',
  'NO',
  'KC',
  'CIN',
  'MIA',
  'DAL',
  'LAR',
  'BAL',
  'TB',
  'NYJ',
  'DET',
  'MIN',
  'CAR',
  'DAL',
  'PIT',
  'LAC',
  'PHI',
  'CLE',
  'CHI',
  'BUF',
  'SF',
  'HOU',
  'LAR',
  'DEN',
  'NE',
  'SEA',
];

const TOTAL_DRAFT_ROUNDS = 7;
const PICKS_PER_ROUND = ROUND_ONE_DRAFT_ORDER.length;

export const getMaxDraftPickForSelectedRounds = (roundCount: number) =>
  Math.max(1, Math.min(TOTAL_DRAFT_ROUNDS, Math.round(roundCount))) * PICKS_PER_ROUND;

export const isDraftCompleteForSelection = (
  currentPick: DraftPickDTO | null | undefined,
  roundCount: number,
) => {
  if (!currentPick) return true;
  return currentPick.round > Math.max(1, Math.min(TOTAL_DRAFT_ROUNDS, Math.round(roundCount)));
};

const cloneProspects = (year: number): PlayerRowDTO[] =>
  BASE_PROSPECTS.map((player, index) => ({
    ...player,
    classYear: player.classYear ?? `${year}`,
    projectedPick: player.rank ?? index + 1,
  }));

const clampDraftRounds = (rounds?: number) =>
  Math.max(1, Math.min(TOTAL_DRAFT_ROUNDS, Math.round(rounds ?? TOTAL_DRAFT_ROUNDS)));

const FALL_REASONS = [
  'Injury Concerns',
  'Character Concerns',
  'Off-field Rumors',
  'Scheme Fit',
  'Combine Disappointment',
] as const;

const selectFallingProspect = (
  sessionId: string,
  saveId: string,
  prospects: PlayerRowDTO[],
): { id: string; reason: string; severity: number } | null => {
  const seed = `${saveId}:${sessionId}:round1`;
  const rng = createRng(seed);
  const roll = rng();
  if (roll > 0.85) {
    return null;
  }
  const candidates = prospects.filter((player) => {
    const projected = player.projectedPick ?? player.rank ?? 999;
    return projected >= 1 && projected <= 25 && (player.rank ?? 999) <= 30;
  });
  if (candidates.length === 0) {
    return null;
  }
  const pickIndex = Math.floor(rng() * candidates.length);
  const reasonIndex = Math.floor(rng() * FALL_REASONS.length);
  const severity = 10 + Math.floor(rng() * 6);
  const player = candidates[pickIndex] ?? candidates[0];
  return {
    id: player.id,
    reason: FALL_REASONS[reasonIndex] ?? FALL_REASONS[0],
    severity,
  };
};

const buildDraftPicks = (): DraftPickDTO[] =>
  Array.from({ length: TOTAL_DRAFT_ROUNDS }, (_, roundIndex) =>
    ROUND_ONE_DRAFT_ORDER.map((teamAbbr, pickIndex) => {
      const overall = roundIndex * ROUND_ONE_DRAFT_ORDER.length + pickIndex + 1;
      return {
        id: `pick-${overall}`,
        overall,
        round: roundIndex + 1,
        ownerTeamAbbr: teamAbbr,
        originalTeamAbbr: teamAbbr,
        selectedPlayerId: null,
        selectedByTeamAbbr: null,
        grade: null,
        gradeReasons: null,
      };
    }),
  ).flat();

const nextRandom = (session: DraftSessionState): number => {
  let seed = session.rngState | 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  session.rngState = seed;
  return result;
};

const normalizeDraftNeedPosition = (position: string): string => {
  const normalized = position.trim().toUpperCase();

  if (['LT', 'RT', 'T', 'OT', 'OL'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G', 'C', 'IOL'].includes(normalized)) return 'IOL';
  if (['DE', 'LE', 'RE', 'EDGE', 'ED'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(normalized)) return 'DL';
  if (['MLB', 'ILB', 'OLB', 'LOLB', 'ROLB', 'LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S', 'SAFETY'].includes(normalized)) return 'S';
  if (['CB', 'CORNER'].includes(normalized)) return 'CB';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  if (['WR'].includes(normalized)) return 'WR';
  if (['TE'].includes(normalized)) return 'TE';
  if (['QB'].includes(normalized)) return 'QB';

  return normalized;
};

const getOrderedTeamNeeds = (
  state: ReturnType<typeof getSaveStateOrThrow>,
  teamAbbr: string,
): string[] => {
  const projectedRoster = state.teamRosters[teamAbbr]?.filter((player) => player.status?.toLowerCase() !== 'cut');
  if (projectedRoster && projectedRoster.length > 0) {
    return computeTeamNeeds(projectedRoster);
  }

  return (
    NFL_LEAGUE_DATA.teams.find((team) => team.abbr === teamAbbr)?.allTeamNeeds ??
    NFL_LEAGUE_DATA.teams.find((team) => team.abbr === teamAbbr)?.teamNeeds ??
    ['QB', 'OT', 'CB']
  );
};

const getActiveOrderedTeamNeeds = (
  state: ReturnType<typeof getSaveStateOrThrow>,
  session: DraftSessionState,
  teamAbbr: string,
): string[] => {
  const orderedNeeds = getOrderedTeamNeeds(state, teamAbbr).map(normalizeDraftNeedPosition);
  const draftedPositions = new Set(
    session.picks
      .filter((pick) => pick.selectedByTeamAbbr === teamAbbr && pick.selectedPlayerId)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter((player): player is PlayerRowDTO => Boolean(player))
      .map((player) => normalizeDraftNeedPosition(player.position)),
  );

  const remainingNeeds = orderedNeeds.filter((need, index) => {
    if (draftedPositions.has(need)) {
      return false;
    }
    return orderedNeeds.indexOf(need) === index;
  });

  return remainingNeeds.length > 0 ? remainingNeeds : orderedNeeds;
};

const buildNeedAwareCandidatePool = (
  state: ReturnType<typeof getSaveStateOrThrow>,
  session: DraftSessionState,
  teamAbbr: string,
  round: number,
  prospects: PlayerRowDTO[],
): PlayerRowDTO[] => {
  const needs = getActiveOrderedTeamNeeds(state, session, teamAbbr);
  const topNeed = needs[0] ?? null;
  const primaryNeeds = new Set(needs.slice(0, 2));
  const secondaryNeeds = new Set(needs.slice(2, 5));
  const firstRound = round === 1;
  const earlyRound = round <= 3;
  const candidateDepth = firstRound ? 40 : earlyRound ? 30 : 24;

  return prospects
    .slice(0, candidateDepth)
    .slice()
    .sort((left, right) => {
      const leftNeed = normalizeDraftNeedPosition(left.position);
      const rightNeed = normalizeDraftNeedPosition(right.position);

      const scoreNeedFit = (need: string) => {
        if (topNeed && need === topNeed) return firstRound ? 42 : earlyRound ? 26 : 14;
        if (primaryNeeds.has(need)) return firstRound ? 28 : earlyRound ? 18 : 10;
        if (secondaryNeeds.has(need)) return firstRound ? 14 : earlyRound ? 9 : 5;
        return 0;
      };

      const leftRank = left.rank ?? 999;
      const rightRank = right.rank ?? 999;
      const leftScore = scoreNeedFit(leftNeed) + (100 - leftRank) * 0.55 + nextRandom(session) * 2;
      const rightScore =
        scoreNeedFit(rightNeed) + (100 - rightRank) * 0.55 + nextRandom(session) * 2;
      return rightScore - leftScore;
    })
    .slice(0, 12);
};

const pickFromPool = (session: DraftSessionState, pool: PlayerRowDTO[]): PlayerRowDTO => {
  if (pool.length === 0) {
    throw new Error('No candidates available to pick from');
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const temperature = 0.6 + nextRandom(session) * 1.2;
  const weights = pool.map((player) => {
    const slot = pool.indexOf(player);
    return Math.exp(-slot / temperature);
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

export const createDraftSession = (
  mode: DraftMode,
  saveId: string,
  maxRounds?: number,
): DraftSessionStartResponse => {
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
    maxRounds: clampDraftRounds(maxRounds),
    isPaused: false,
    currentPickIndex: 0,
    picks: buildDraftPicks(),
    prospects: cloneProspects(state.header.year ?? 2026),
    status: 'in_progress',
  };

  const falling = selectFallingProspect(draftSessionId, saveId, session.prospects);
  if (falling) {
    session.fallingProspectId = falling.id;
    session.fallReason = falling.reason;
    session.fallSeverity = falling.severity;
  }

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
  if (
    session.currentPickIndex >= session.picks.length ||
    isDraftCompleteForSelection(session.picks[session.currentPickIndex], session.maxRounds)
  ) {
    finalizeDraftSession(session, state);
  }

  return session;
};

export const advanceDraftSession = (
  draftSessionId: string,
  saveId: string,
  mode: 'default' | 'best_available' = 'default',
): DraftSessionDTO => {
  const { session, state } = getDraftSessionState(saveId, draftSessionId);
  if (session.isPaused) {
    throw new Error('Draft is paused');
  }
  if (session.status === 'completed') {
    return session;
  }

  const currentPick = session.picks[session.currentPickIndex];
  if (!currentPick || isDraftCompleteForSelection(currentPick, session.maxRounds)) {
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

  const fallingProspect = session.fallingProspectId
    ? session.prospects.find((player) => player.id === session.fallingProspectId)
    : null;
  const pickNumber = session.currentPickIndex + 1;
  let filteredPool = pool;
  if (fallingProspect && !fallingProspect.isDrafted) {
    const projected = fallingProspect.projectedPick ?? fallingProspect.rank ?? 999;
    const severity = session.fallSeverity ?? 10;
    const fallLimit = projected + severity;
    const panicThreshold = projected + 12;
    if (pickNumber < fallLimit) {
      const allowChance = pickNumber >= panicThreshold ? nextRandom(session) < 0.08 : false;
      if (!allowChance) {
        filteredPool = pool.filter((player) => player.id !== fallingProspect.id);
      }
    }
  }

  const player =
    mode === 'best_available'
      ? filteredPool[0] ?? pool[0]
      : pickFromPool(
          session,
          buildNeedAwareCandidatePool(
            state,
            session,
            currentPick.ownerTeamAbbr,
            currentPick.round,
            filteredPool,
          ),
        );
  const pick = session.picks[session.currentPickIndex];
  selectPlayer(session, session.currentPickIndex, player);
  if (pick) {
    pick.grade = getRandomCpuGrade();
    pick.gradeReasons = ['League reaction sees this as a reasonable mix of value and fit.'];
  }
  pushNewsItem(state, {
    type: 'draftPick',
    teamAbbr: currentPick.ownerTeamAbbr,
    playerName: `${player.firstName} ${player.lastName}`,
    details: `${currentPick.ownerTeamAbbr} select ${player.firstName} ${player.lastName} at pick ${
      currentPick.overall
    }.`,
    severity: 'info',
  });

  if (
    session.currentPickIndex >= session.picks.length ||
    isDraftCompleteForSelection(session.picks[session.currentPickIndex], session.maxRounds)
  ) {
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

const capHitMillions = (player: PlayerRowDTO) =>
  Number(player.capHit.replace(/[^0-9.]/g, '')) || 0;

const computeTradeCapSpace = (
  baseCapSpace: number,
  outgoingPlayers: PlayerRowDTO[],
  incomingPlayers: PlayerRowDTO[],
) => {
  const outgoingCap = outgoingPlayers.reduce((sum, player) => sum + capHitMillions(player), 0);
  const incomingCap = incomingPlayers.reduce((sum, player) => sum + capHitMillions(player), 0);
  return Number((baseCapSpace + outgoingCap - incomingCap).toFixed(1));
};

export const acceptDraftTradeOffer = (
  draftSessionId: string,
  saveId: string,
  offer: TradeOfferDTO,
) => {
  const { session, state } = getDraftSessionState(saveId, draftSessionId);
  if (session.status === 'completed') {
    throw new Error('Draft is already complete');
  }

  const currentPick = session.picks[session.currentPickIndex];
  if (!currentPick || currentPick.ownerTeamAbbr !== session.userTeamAbbr) {
    throw new Error('You are not on the clock');
  }
  if (offer.phase !== 'draft') {
    throw new Error('This route only accepts draft offers');
  }

  const outgoingPickAssets = offer.outgoing.assets.filter(
    (asset): asset is Extract<(typeof offer.outgoing.assets)[number], { type: 'pick' }> =>
      asset.type === 'pick',
  );
  const incomingPickAssets = offer.incoming.assets.filter(
    (asset): asset is Extract<(typeof offer.incoming.assets)[number], { type: 'pick' }> =>
      asset.type === 'pick',
  );

  const outgoingPlayerIds = new Set(
    offer.outgoing.assets
      .filter((asset): asset is Extract<(typeof offer.outgoing.assets)[number], { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const incomingPlayerIds = new Set(
    offer.incoming.assets
      .filter((asset): asset is Extract<(typeof offer.incoming.assets)[number], { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );

  const userRoster = (state.teamRosters[session.userTeamAbbr] ?? state.roster).filter(
    (player) => player.status?.toLowerCase() !== 'cut',
  );
  const partnerRoster = (state.teamRosters[offer.proposingTeamAbbr] ?? []).filter(
    (player) => player.status?.toLowerCase() !== 'cut',
  );

  const outgoingPlayers = userRoster.filter((player) => outgoingPlayerIds.has(player.id));
  const incomingPlayers = partnerRoster.filter((player) => incomingPlayerIds.has(player.id));

  if (outgoingPlayers.length !== outgoingPlayerIds.size || incomingPlayers.length !== incomingPlayerIds.size) {
    throw new Error('Unable to resolve one or more player assets in the offer');
  }

  const activeDraftYear = state.header.year ?? 2026;
  const outgoingSessionPicks = outgoingPickAssets
    .filter((asset) => asset.year === activeDraftYear)
    .map((asset) =>
      session.picks.find(
        (entry) =>
          entry.round === asset.round &&
          entry.overall === asset.overallSlot &&
          entry.ownerTeamAbbr === session.userTeamAbbr,
      ),
    )
    .filter((pick): pick is DraftPickDTO => Boolean(pick));
  const incomingSessionPicks = incomingPickAssets
    .filter((asset) => asset.year === activeDraftYear)
    .map((asset) =>
      session.picks.find(
        (entry) =>
          entry.round === asset.round &&
          entry.overall === asset.overallSlot &&
          entry.ownerTeamAbbr === offer.proposingTeamAbbr,
      ),
    )
    .filter((pick): pick is DraftPickDTO => Boolean(pick));

  if (
    outgoingSessionPicks.length !==
    outgoingPickAssets.filter((asset) => asset.year === activeDraftYear).length
  ) {
    throw new Error('A current draft pick in the offer is no longer available');
  }
  if (
    incomingSessionPicks.length !==
    incomingPickAssets.filter((asset) => asset.year === activeDraftYear).length
  ) {
    throw new Error('The offering team no longer controls one of the live picks in this offer');
  }

  outgoingSessionPicks.forEach((pick) => {
    if (pick.selectedPlayerId) {
      throw new Error('A pick in the offer is no longer available');
    }
  });
  incomingSessionPicks.forEach((pick) => {
    if (pick.selectedPlayerId) {
      throw new Error('The offering team no longer owns a pick in this offer');
    }
  });

  const nextUserCapSpace = computeTradeCapSpace(
    getProjectedCapSpaceForTeam(state, session.userTeamAbbr),
    outgoingPlayers,
    incomingPlayers,
  );
  const nextPartnerCapSpace = computeTradeCapSpace(
    getProjectedCapSpaceForTeam(state, offer.proposingTeamAbbr),
    incomingPlayers,
    outgoingPlayers,
  );

  if (nextUserCapSpace < 0 || nextPartnerCapSpace < 0) {
    throw new Error('One team would exceed the cap after this draft-day trade');
  }

  if (outgoingSessionPicks.length > 0 || incomingSessionPicks.length > 0) {
    applyDraftTrade(
      draftSessionId,
      offer.proposingTeamAbbr,
      outgoingSessionPicks.map((pick) => pick.id),
      incomingSessionPicks.map((pick) => pick.id),
      saveId,
    );
  }

  if (outgoingPlayerIds.size > 0 || incomingPlayerIds.size > 0) {
    state.teamRosters[session.userTeamAbbr] = userRoster
      .filter((player) => !outgoingPlayerIds.has(player.id))
      .concat(incomingPlayers.map((player) => transferStoredPlayerToTeam(player, session.userTeamAbbr)));
    state.teamRosters[offer.proposingTeamAbbr] = partnerRoster
      .filter((player) => !incomingPlayerIds.has(player.id))
      .concat(
        outgoingPlayers.map((player) => transferStoredPlayerToTeam(player, offer.proposingTeamAbbr)),
      );
    state.roster = state.teamRosters[session.userTeamAbbr];
    state.header.rosterCount = state.roster.length;
    state.header.capSpace = nextUserCapSpace;
    state.teamCaps[session.userTeamAbbr] = nextUserCapSpace;
    state.teamCaps[offer.proposingTeamAbbr] = nextPartnerCapSpace;
  }

  pushNewsItem(state, {
    type: 'trade',
    teamAbbr: session.userTeamAbbr,
    playerName: incomingPlayers[0]
      ? `${incomingPlayers[0].firstName} ${incomingPlayers[0].lastName}`
      : 'Draft pick package',
    details: `${session.userTeamAbbr} accepted a draft-day trade with ${offer.proposingTeamAbbr}.`,
    severity: 'info',
  });

  return {
    session,
    roster: state.roster,
    header: {
      saveId,
      ...getSaveHeaderSnapshot(state),
    },
  };
};
