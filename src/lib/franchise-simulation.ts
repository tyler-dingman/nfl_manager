import {
  getFrontOfficePhaseActions,
  normalizeFrontOfficePhase,
  isTeamAliveInPlayoffs,
  frontOfficeLifecycle,
} from '@/lib/front-office-phase';
import type {
  FranchiseGameState,
  FranchisePlayoffState,
  FranchiseSimulationState,
  FranchiseTeamState,
  SimulatedPlayer,
} from '@/types/front-office';
import { createGameSimulationResult } from '@/lib/front-office-game-recap';

export type SimulationTeamInput = Omit<
  FranchiseTeamState,
  'record' | 'pointsFor' | 'pointsAgainst'
>;
export type SimulationGameInput = Pick<
  FranchiseGameState,
  'id' | 'week' | 'homeTeam' | 'awayTeam' | 'startsAt'
>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeFranchiseSimulationState(value: unknown): FranchiseSimulationState | null {
  let simulation = value;
  for (let pass = 0; pass < 8 && typeof simulation === 'string'; pass += 1) {
    try {
      simulation = JSON.parse(simulation);
    } catch {
      return null;
    }
  }
  if (!simulation || typeof simulation !== 'object' || Array.isArray(simulation)) return null;
  const candidate = simulation as Partial<FranchiseSimulationState>;
  if (
    typeof candidate.currentWeek !== 'number' ||
    !candidate.teams ||
    typeof candidate.teams !== 'object' ||
    !Array.isArray(candidate.games)
  ) {
    return null;
  }
  const normalized = {
    ...candidate,
    phase: normalizeFrontOfficePhase(
      candidate.phase ?? 'week-1',
      (candidate as { freeAgencyWave?: number }).freeAgencyWave,
    ),
  } as FranchiseSimulationState;
  // Old post-draft/preseason snapshots retained the previous season's played games.
  // Archive them once before exposing the next Week 1; the returned canonical phase
  // makes normalization idempotent even before the next database write.
  if (
    ['post-draft', 'preseason', 'season'].includes(candidate.phase ?? '') &&
    candidate.season &&
    (candidate.currentWeek > 0 || candidate.games.some((game) => game.played))
  ) {
    return beginNextFranchiseSeason(normalized);
  }
  return normalized;
}

export const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const randomUnit = (seed: string) => hashSeed(seed) / 4_294_967_295;

const scoreFor = (seed: string, offense: number, defense: number, homeBonus: number) => {
  // A large rating gap should matter without making any matchup deterministic.
  const expected = 21.5 + (offense - defense) * 0.24 + homeBonus;
  const variance = (randomUnit(seed) - 0.5) * 17;
  return clamp(Math.round(expected + variance), 3, 49);
};

export function simulateGame(
  game: FranchiseGameState,
  teams: Record<string, FranchiseTeamState>,
  seed: string,
): FranchiseGameState {
  if (game.played) return game;
  const home = teams[game.homeTeam];
  const away = teams[game.awayTeam];
  if (!home || !away) throw new Error(`Unknown team in game ${game.id}.`);
  const homeBonus = game.neutralSite ? 0 : 1.7;
  let homeScore = scoreFor(`${seed}:${game.id}:home`, home.overall, away.overall, homeBonus);
  let awayScore = scoreFor(`${seed}:${game.id}:away`, away.overall, home.overall, 0);
  const ratingEdge = home.overall - away.overall;
  const homeWinChance = clamp(0.5 + ratingEdge * 0.025 + (game.neutralSite ? 0 : 0.05), 0.1, 0.9);
  let homeWins = randomUnit(`${seed}:${game.id}:outcome`) < homeWinChance;

  // No team can finish 17-0. A club that reaches 16 wins takes a loss in its
  // next regular-season game while postseason results remain unconstrained.
  if (game.seasonType === 'REG') {
    const homeAtWinCeiling = home.record.wins >= 16;
    const awayAtWinCeiling = away.record.wins >= 16;
    if (homeAtWinCeiling !== awayAtWinCeiling) homeWins = awayAtWinCeiling;
  }

  const margin = 1 + Math.floor(randomUnit(`${seed}:${game.id}:margin`) * 10);
  if (homeWins && homeScore <= awayScore) {
    homeScore = Math.min(49, awayScore + margin);
    if (homeScore <= awayScore) awayScore = Math.max(3, homeScore - margin);
  } else if (!homeWins && awayScore <= homeScore) {
    awayScore = Math.min(49, homeScore + margin);
    if (awayScore <= homeScore) homeScore = Math.max(3, awayScore - margin);
  }
  const winner = homeWins ? home.abbr : away.abbr;
  home.pointsFor += homeScore;
  home.pointsAgainst += awayScore;
  away.pointsFor += awayScore;
  away.pointsAgainst += homeScore;
  if (!winner) {
    home.record.ties += 1;
    away.record.ties += 1;
  } else if (winner === home.abbr) {
    home.record.wins += 1;
    away.record.losses += 1;
  } else {
    away.record.wins += 1;
    home.record.losses += 1;
  }
  return { ...game, played: true, homeScore, awayScore, winner };
}

const winPct = (team: FranchiseTeamState) => {
  const games = team.record.wins + team.record.losses + team.record.ties;
  return games ? (team.record.wins + team.record.ties * 0.5) / games : 0;
};

export const sortStandings = (teams: FranchiseTeamState[]) =>
  [...teams].sort(
    (left, right) =>
      winPct(right) - winPct(left) ||
      right.record.wins - left.record.wins ||
      right.pointsFor - right.pointsAgainst - (left.pointsFor - left.pointsAgainst) ||
      right.pointsFor - left.pointsFor ||
      hashSeed(left.abbr) - hashSeed(right.abbr),
  );

export function seedPlayoffs(teams: Record<string, FranchiseTeamState>) {
  const result: Record<string, string[]> = {};
  for (const conference of ['AFC', 'NFC']) {
    const conferenceTeams = Object.values(teams).filter((team) => team.conference === conference);
    const divisions = [...new Set(conferenceTeams.map((team) => team.division))];
    const divisionWinners = divisions
      .map(
        (division) =>
          sortStandings(conferenceTeams.filter((team) => team.division === division))[0],
      )
      .filter(Boolean);
    const winnerIds = new Set(divisionWinners.map((team) => team.abbr));
    const wildCards = sortStandings(
      conferenceTeams.filter((team) => !winnerIds.has(team.abbr)),
    ).slice(0, 3);
    result[conference] = [...sortStandings(divisionWinners), ...wildCards].map((team) => team.abbr);
  }
  return result;
}

const makePlayoffGame = (
  state: FranchiseSimulationState,
  round: number,
  conference: string,
  homeTeam: string,
  awayTeam: string,
  index: number,
  neutralSite = false,
): FranchiseGameState => ({
  id: `${state.season}-post-${round}-${conference}-${index}`,
  week: round,
  seasonType: 'POST',
  homeTeam,
  awayTeam,
  neutralSite,
  played: false,
  homeScore: null,
  awayScore: null,
  winner: null,
});

function createPlayoffRound(state: FranchiseSimulationState, round: number) {
  const playoff = state.playoffs;
  if (!playoff) return [];
  if (round === 1) {
    return ['AFC', 'NFC'].flatMap((conference) => {
      const seeds = playoff.seeds[conference];
      return [
        makePlayoffGame(state, round, conference, seeds[1], seeds[6], 0),
        makePlayoffGame(state, round, conference, seeds[2], seeds[5], 1),
        makePlayoffGame(state, round, conference, seeds[3], seeds[4], 2),
      ];
    });
  }
  if (round === 2) {
    return ['AFC', 'NFC'].flatMap((conference) => {
      const seeds = playoff.seeds[conference];
      const winners = playoff.games
        .filter((game) => game.week === 1 && game.id.includes(conference))
        .map((game) => game.winner!)
        .sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
      const lowest = winners.at(-1)!;
      const remaining = winners.filter((team) => team !== lowest);
      return [
        makePlayoffGame(state, round, conference, seeds[0], lowest, 0),
        makePlayoffGame(state, round, conference, remaining[0], remaining[1], 1),
      ];
    });
  }
  if (round === 3) {
    return ['AFC', 'NFC'].map((conference) => {
      const seeds = playoff.seeds[conference];
      const winners = playoff.games
        .filter((game) => game.week === 2 && game.id.includes(conference))
        .map((game) => game.winner!)
        .sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
      return makePlayoffGame(state, round, conference, winners[0], winners[1], 0);
    });
  }
  const finalists = playoff.games.filter((game) => game.week === 3).map((game) => game.winner!);
  return [makePlayoffGame(state, 4, 'SB', finalists[0], finalists[1], 0, true)];
}

export function createFranchiseSimulation(input: {
  seed: string;
  season: number;
  teams: SimulationTeamInput[];
  games: SimulationGameInput[];
}): FranchiseSimulationState {
  const teams = Object.fromEntries(
    input.teams.map((team) => [
      team.abbr,
      { ...team, record: { wins: 0, losses: 0, ties: 0 }, pointsFor: 0, pointsAgainst: 0 },
    ]),
  );
  return {
    seed: input.seed,
    season: input.season,
    currentWeek: 0,
    phase: 'week-1',
    teams,
    games: input.games.map((game) => ({
      ...game,
      seasonType: 'REG',
      played: false,
      homeScore: null,
      awayScore: null,
      winner: null,
    })),
    playoffs: null,
    draftOrder: [],
    transactions: [],
    completedAt: null,
  };
}

/** Starts a new save at the Week 1 decision point without playing its opening game. */
export function startFranchiseAtWeekOne(state: FranchiseSimulationState): FranchiseSimulationState {
  const next = structuredClone(state);
  next.currentWeek = 0;
  next.phase = 'week-1';
  return next;
}

function beginNextFranchiseSeason(state: FranchiseSimulationState): FranchiseSimulationState {
  const { seasonHistory, ...finishedSeason } = state;
  const fresh = createFranchiseSimulation({
    seed: `${state.seed}:${state.season + 1}`,
    season: state.season + 1,
    teams: Object.values(state.teams),
    // Retain the valid 18-week matchup structure, with new IDs and no stale dates/results.
    games: state.games
      .filter((game) => game.seasonType === 'REG')
      .map((game, index) => ({
        id: `${state.season + 1}-reg-${index}`,
        week: game.week,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
  });
  return {
    ...fresh,
    transactions: state.transactions,
    seasonHistory: [...(seasonHistory ?? []), finishedSeason],
  };
}

export function hasCompletedFranchiseDraft(
  state: FranchiseSimulationState,
  sessions: Array<
    Pick<import('@/types/draft').DraftSessionDTO, 'mode' | 'status' | 'draftYear'>
  > = [],
) {
  return [state.completedDraft, ...sessions].some(
    (session) =>
      session?.mode === 'real' &&
      session.status === 'completed' &&
      session.draftYear === state.season + 1,
  );
}

export function advanceSimulation(
  state: FranchiseSimulationState,
  target: string,
  options: {
    players?: SimulatedPlayer[];
    recapTeamAbbr?: string;
    completedDraftSessions?: Array<
      Pick<import('@/types/draft').DraftSessionDTO, 'mode' | 'status' | 'draftYear'>
    >;
  } = {},
) {
  const normalized = normalizeFranchiseSimulationState(state);
  if (!normalized) throw new Error('The saved franchise simulation state is invalid.');
  const next = structuredClone(normalized);
  if (
    !/^week-(?:[1-9]|1[0-8])$/.test(target) &&
    ![
      'wild-card',
      'divisional',
      'conference',
      'super-bowl',
      'resign_cut',
      'scouting_combine',
      'free_agency',
      'free_agency_open',
      'draft',
      'post-draft',
      'season',
      'preseason',
    ].includes(target)
  )
    throw new Error('Invalid franchise transition target.');
  target = normalizeFrontOfficePhase(target);
  if (
    next.phase === 'draft' &&
    target === 'week-1' &&
    !hasCompletedFranchiseDraft(next, options.completedDraftSessions)
  )
    throw new Error('Complete the NFL Draft before beginning the next season.');
  const actions = getFrontOfficePhaseActions(next.phase, {
    draftCompleted: hasCompletedFranchiseDraft(next, options.completedDraftSessions),
    playoffEliminated: Boolean(
      options.recapTeamAbbr && next.playoffs && !isTeamAliveInPlayoffs(next, options.recapTeamAbbr),
    ),
  });
  if (
    ![actions.primary, ...actions.jumps].some((action) => !action.href && action.target === target)
  ) {
    throw new Error(`Invalid franchise transition: ${next.phase} → ${target}`);
  }
  if (next.phase === 'draft' && target === 'week-1') {
    if (!hasCompletedFranchiseDraft(next, options.completedDraftSessions))
      throw new Error('Complete the NFL Draft before beginning the next season.');
    return beginNextFranchiseSeason(next);
  }
  if (
    target === 'scouting_combine' &&
    frontOfficeLifecycle(next.phase).mainPhase === 'PLAYOFFS' &&
    next.phase !== 'super-bowl'
  ) {
    return finishRemainingPlayoffs(next);
  }
  const targetWeek = target.startsWith('week-')
    ? clamp((Number(target.slice(5)) || 1) - 1, 0, 18)
    : target === 'wild-card'
      ? 18
      : next.currentWeek;
  for (let week = next.currentWeek + 1; week <= targetWeek; week += 1) {
    next.games = next.games.map((game) => {
      if (game.week !== week) return game;
      const simulated = simulateGame(game, next.teams, next.seed);
      if (
        !simulated.result &&
        options.players &&
        (!options.recapTeamAbbr ||
          [simulated.homeTeam, simulated.awayTeam].includes(options.recapTeamAbbr))
      ) {
        simulated.result = createGameSimulationResult({
          game: simulated,
          teams: next.teams,
          players: options.players,
          seed: next.seed,
        });
      }
      return simulated;
    });
    next.currentWeek = week;
  }
  if (target.startsWith('week-')) next.phase = target;
  if (target === 'wild-card' && !next.playoffs) {
    const seeds = seedPlayoffs(next.teams);
    next.playoffs = { seeds, games: [], champion: null };
    next.playoffs.games.push(...createPlayoffRound(next, 1));
    next.phase = 'wild-card';
  } else if (['divisional', 'conference', 'super-bowl'].includes(target)) {
    if (!next.playoffs) throw new Error('Regular season must be completed first.');
    const priorRound = { divisional: 1, conference: 2, 'super-bowl': 3 }[target]!;
    next.playoffs.games = next.playoffs.games.map((game) =>
      game.week === priorRound ? simulateGame(game, next.teams, next.seed) : game,
    );
    const nextRound = priorRound + 1;
    if (!next.playoffs.games.some((game) => game.week === nextRound))
      next.playoffs.games.push(...createPlayoffRound(next, nextRound));
    next.phase = target;
  } else if (target === 'scouting_combine' && next.phase === 'super-bowl') {
    if (!next.playoffs) throw new Error('Playoffs are unavailable.');
    next.playoffs.games = next.playoffs.games.map((game) =>
      game.week === 4 ? simulateGame(game, next.teams, next.seed) : game,
    );
    next.playoffs.champion = next.playoffs.games.find((game) => game.week === 4)?.winner ?? null;
    next.completedAt = new Date().toISOString();
    // The lowest regular-season finisher picks first; playoff finish can be layered on
    // later without ever making the champion pick ahead of a non-playoff club.
    const regularOrder = sortStandings(Object.values(next.teams))
      .reverse()
      .map((team) => team.abbr);
    const playoffTeams = new Set(Object.values(next.playoffs.seeds).flat());
    const nonPlayoff = regularOrder.filter((team) => !playoffTeams.has(team));
    const eliminated = [1, 2, 3].flatMap((round) =>
      next
        .playoffs!.games.filter((game) => game.week === round)
        .map((game) => (game.winner === game.homeTeam ? game.awayTeam : game.homeTeam))
        .sort((left, right) => regularOrder.indexOf(left) - regularOrder.indexOf(right)),
    );
    const superBowl = next.playoffs.games.find((game) => game.week === 4)!;
    const runnerUp =
      superBowl.winner === superBowl.homeTeam ? superBowl.awayTeam : superBowl.homeTeam;
    next.draftOrder = [...nonPlayoff, ...eliminated, runnerUp, next.playoffs.champion!];
    next.phase = 'scouting_combine';
  } else if (['scouting_combine', 'free_agency', 'free_agency_open', 'draft'].includes(target)) {
    next.phase = target;
  }
  if (
    options.recapTeamAbbr &&
    frontOfficeLifecycle(next.phase).mainPhase === 'PLAYOFFS' &&
    !isTeamAliveInPlayoffs(next, options.recapTeamAbbr)
  ) {
    return finishRemainingPlayoffs(next);
  }
  return next;
}

function finishRemainingPlayoffs(state: FranchiseSimulationState): FranchiseSimulationState {
  let next = state;
  while (frontOfficeLifecycle(next.phase).mainPhase === 'PLAYOFFS') {
    next = advanceSimulation(next, getFrontOfficePhaseActions(next.phase).primary.target);
  }
  return next;
}
