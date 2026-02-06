import { randomUUID } from 'crypto';

import type { PlayerRowDTO } from '@/types/player';
import type { DraftMode, DraftPickDTO, DraftSessionDTO, DraftSessionState } from '@/types/draft';

import { addDraftedPlayersInState, getSaveStateResult } from './store';

export type DraftSessionStartResponse = {
  draftSessionId: string;
  rng_seed: number;
};

const USER_TEAM_ABBR = 'GB';

const BASE_PROSPECTS: PlayerRowDTO[] = [
  {
    id: 'p1',
    firstName: 'Caleb',
    lastName: 'Williams',
    position: 'QB',
    rank: 1,
    college: 'USC',
    grade: '94.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p2',
    firstName: 'Marvin',
    lastName: 'Harrison Jr.',
    position: 'WR',
    rank: 2,
    college: 'Ohio State',
    grade: '93.4',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p3',
    firstName: 'Drake',
    lastName: 'Maye',
    position: 'QB',
    rank: 3,
    college: 'North Carolina',
    grade: '92.8',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p4',
    firstName: 'Malik',
    lastName: 'Nabers',
    position: 'WR',
    rank: 4,
    college: 'LSU',
    grade: '92.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p5',
    firstName: 'Joe',
    lastName: 'Alt',
    position: 'OL',
    rank: 5,
    college: 'Notre Dame',
    grade: '91.7',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p6',
    firstName: 'Dallas',
    lastName: 'Turner',
    position: 'LB',
    rank: 6,
    college: 'Alabama',
    grade: '90.9',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p7',
    firstName: 'Brock',
    lastName: 'Bowers',
    position: 'TE',
    rank: 7,
    college: 'Georgia',
    grade: '90.2',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p8',
    firstName: 'Jared',
    lastName: 'Verse',
    position: 'DL',
    rank: 8,
    college: 'Florida State',
    grade: '89.8',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p9',
    firstName: 'Quinyon',
    lastName: 'Mitchell',
    position: 'CB',
    rank: 9,
    college: 'Toledo',
    grade: '89.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p10',
    firstName: 'Terrion',
    lastName: 'Arnold',
    position: 'CB',
    rank: 10,
    college: 'Alabama',
    grade: '88.6',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p11',
    firstName: 'Rome',
    lastName: 'Odunze',
    position: 'WR',
    rank: 11,
    college: 'Washington',
    grade: '88.2',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p12',
    firstName: 'JC',
    lastName: 'Latham',
    position: 'OL',
    rank: 12,
    college: 'Alabama',
    grade: '87.9',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p13',
    firstName: 'Kool-Aid',
    lastName: 'McKinstry',
    position: 'CB',
    rank: 13,
    college: 'Alabama',
    grade: '87.2',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p14',
    firstName: 'Laiatu',
    lastName: 'Latu',
    position: 'DL',
    rank: 14,
    college: 'UCLA',
    grade: '86.9',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p15',
    firstName: 'Cooper',
    lastName: 'DeJean',
    position: 'CB',
    rank: 15,
    college: 'Iowa',
    grade: '86.4',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p16',
    firstName: 'Taliese',
    lastName: 'Fuaga',
    position: 'OL',
    rank: 16,
    college: 'Oregon State',
    grade: '86.0',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p17',
    firstName: 'Brian',
    lastName: 'Thomas Jr.',
    position: 'WR',
    rank: 17,
    college: 'LSU',
    grade: '85.7',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p18',
    firstName: 'Jeremiah',
    lastName: 'Trotter Jr.',
    position: 'LB',
    rank: 18,
    college: 'Clemson',
    grade: '85.3',
    projectedRound: 'Round 1-2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p19',
    firstName: 'Nate',
    lastName: 'Wiggins',
    position: 'CB',
    rank: 19,
    college: 'Clemson',
    grade: '85.0',
    projectedRound: 'Round 1-2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p20',
    firstName: 'Troy',
    lastName: 'Fautanu',
    position: 'OL',
    rank: 20,
    college: 'Washington',
    grade: '84.7',
    projectedRound: 'Round 1-2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p21',
    firstName: 'Xavier',
    lastName: 'Legette',
    position: 'WR',
    rank: 21,
    college: 'South Carolina',
    grade: '84.2',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p22',
    firstName: 'Zach',
    lastName: 'Frazier',
    position: 'OL',
    rank: 22,
    college: 'West Virginia',
    grade: '83.9',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p23',
    firstName: 'Adonai',
    lastName: 'Mitchell',
    position: 'WR',
    rank: 23,
    college: 'Texas',
    grade: '83.5',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p24',
    firstName: 'J.J.',
    lastName: 'McCarthy',
    position: 'QB',
    rank: 24,
    college: 'Michigan',
    grade: '83.1',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p25',
    firstName: 'Payton',
    lastName: 'Wilson',
    position: 'LB',
    rank: 25,
    college: 'NC State',
    grade: '82.8',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p26',
    firstName: 'Jackson',
    lastName: 'Powers-Johnson',
    position: 'OL',
    rank: 26,
    college: 'Oregon',
    grade: '82.4',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p27',
    firstName: 'Tyler',
    lastName: 'Guyton',
    position: 'OL',
    rank: 27,
    college: 'Oklahoma',
    grade: '82.1',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p28',
    firstName: 'Ennis',
    lastName: 'Rakestraw Jr.',
    position: 'CB',
    rank: 28,
    college: 'Missouri',
    grade: '81.7',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p29',
    firstName: 'Keon',
    lastName: 'Coleman',
    position: 'WR',
    rank: 29,
    college: 'Florida State',
    grade: '81.2',
    projectedRound: 'Round 2',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p30',
    firstName: 'Mike',
    lastName: 'Sainristil',
    position: 'CB',
    rank: 30,
    college: 'Michigan',
    grade: '80.8',
    projectedRound: 'Round 2-3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p31',
    firstName: 'Marshawn',
    lastName: 'Kneeland',
    position: 'DL',
    rank: 31,
    college: 'Western Michigan',
    grade: '80.4',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p32',
    firstName: 'Malachi',
    lastName: 'Corley',
    position: 'WR',
    rank: 32,
    college: 'Western Kentucky',
    grade: '80.0',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p33',
    firstName: "Ja'Lynn",
    lastName: 'Polk',
    position: 'WR',
    rank: 33,
    college: 'Washington',
    grade: '79.7',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p34',
    firstName: 'Tyler',
    lastName: 'Nubin',
    position: 'S',
    rank: 34,
    college: 'Minnesota',
    grade: '79.3',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p35',
    firstName: 'Cam',
    lastName: 'Ward',
    position: 'QB',
    rank: 35,
    college: 'Washington State',
    grade: '79.0',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p36',
    firstName: 'Sedrick',
    lastName: 'Van Pran',
    position: 'OL',
    rank: 36,
    college: 'Georgia',
    grade: '78.6',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p37',
    firstName: 'Kamren',
    lastName: 'Kinchens',
    position: 'S',
    rank: 37,
    college: 'Miami',
    grade: '78.2',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p38',
    firstName: 'Jonah',
    lastName: 'Elliss',
    position: 'DL',
    rank: 38,
    college: 'Utah',
    grade: '77.8',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p39',
    firstName: 'Roman',
    lastName: 'Wilson',
    position: 'WR',
    rank: 39,
    college: 'Michigan',
    grade: '77.4',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p40',
    firstName: 'Blake',
    lastName: 'Corum',
    position: 'RB',
    rank: 40,
    college: 'Michigan',
    grade: '77.0',
    projectedRound: 'Round 3',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
];

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

  selectPlayer(session, session.currentPickIndex, player);
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
