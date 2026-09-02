export type GameStatus =
  | 'SCHEDULED'
  | 'PREGAME'
  | 'LIVE'
  | 'HALFTIME'
  | 'FINAL'
  | 'POSTPONED'
  | 'CANCELED';
export type RoomStatus = 'TAILGATE' | 'LIVE' | 'HALFTIME' | 'POSTGAME' | 'ARCHIVED';
export type GameEventType =
  | 'GAME_STARTED'
  | 'DRIVE_STARTED'
  | 'PLAY'
  | 'FIRST_DOWN'
  | 'BIG_PLAY'
  | 'TOUCHDOWN'
  | 'FIELD_GOAL'
  | 'TURNOVER'
  | 'INTERCEPTION'
  | 'FUMBLE'
  | 'SACK'
  | 'PUNT'
  | 'PENALTY'
  | 'INJURY'
  | 'QUARTER_END'
  | 'HALFTIME'
  | 'GAME_FINAL';
export type DriveResult = 'TOUCHDOWN' | 'FIELD_GOAL' | 'PUNT' | 'TURNOVER';
export type GameState = {
  gameId: string;
  status: GameStatus;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  clock: string;
  possessionTeamId: string | null;
  down: number | null;
  distance: number | null;
  yardLine: string | null;
  redZone: boolean;
  lastPlay: string | null;
  driveNumber: number;
  updatedAt: string;
};
export type GameDayEvent = {
  id: string;
  type: GameEventType;
  teamId?: string;
  headline: string;
  detail?: string;
  importance: number;
  createdAt: string;
};
export type RoomMember = {
  userId: string;
  displayName: string;
  role: 'HOST' | 'MEMBER';
  presence: 'HERE' | 'AWAY';
  joinedAt: string;
};
export type RoomActivity = {
  id: string;
  kind: 'MESSAGE' | 'SYSTEM' | 'MOMENT' | 'SHARED_CONTENT';
  userId: string | null;
  displayName: string | null;
  body: string;
  payload: Record<string, unknown>;
  createdAt: string;
  reactions: Record<string, number>;
};
export type GameDayRoom = {
  id: string;
  gameId: string;
  teamId: string;
  hostUserId: string;
  name: string;
  joinCode: string;
  inviteToken: string;
  privacy: 'PRIVATE';
  status: RoomStatus;
  kickoffAt: string;
  gameState: GameState;
  members: RoomMember[];
  activity: RoomActivity[];
  predictions: Array<{
    id: string;
    userId: string;
    kind: 'PREGAME' | 'DRIVE';
    prompt: string;
    selection: string;
    driveNumber: number | null;
    settled: boolean;
    correct: boolean | null;
  }>;
  createdAt: string;
  updatedAt: string;
};
export type SimulationAction =
  | 'START_TAILGATE'
  | 'KICKOFF'
  | 'START_DRIVE'
  | 'FIRST_DOWN'
  | 'BIG_PLAY'
  | 'TOUCHDOWN_HOME'
  | 'FIELD_GOAL_HOME'
  | 'TURNOVER_HOME'
  | 'TOUCHDOWN_AWAY'
  | 'INJURY'
  | 'HALFTIME'
  | 'START_3Q'
  | 'FINAL';
export const roomStatusForGame = (status: GameStatus): RoomStatus =>
  status === 'HALFTIME'
    ? 'HALFTIME'
    : status === 'FINAL'
      ? 'POSTGAME'
      : status === 'LIVE'
        ? 'LIVE'
        : 'TAILGATE';
export function applySimulation(
  state: GameState,
  action: SimulationAction,
  now = new Date().toISOString(),
): { state: GameState; event: Omit<GameDayEvent, 'id'> | null; driveResult?: DriveResult } {
  const next = { ...state, updatedAt: now };
  let event: Omit<GameDayEvent, 'id'> | null = null,
    driveResult: DriveResult | undefined;
  const home = state.homeTeamId,
    away = state.awayTeamId;
  switch (action) {
    case 'START_TAILGATE':
      next.status = 'PREGAME';
      break;
    case 'KICKOFF':
      next.status = 'LIVE';
      next.quarter = 1;
      next.clock = '15:00';
      next.possessionTeamId = home;
      event = {
        type: 'GAME_STARTED',
        headline: "IT'S GAME TIME.",
        importance: 100,
        createdAt: now,
      };
      break;
    case 'START_DRIVE':
      next.driveNumber++;
      next.possessionTeamId = next.possessionTeamId === home ? away : home;
      next.down = 1;
      next.distance = 10;
      next.yardLine = 'OWN 25';
      event = {
        type: 'DRIVE_STARTED',
        teamId: next.possessionTeamId,
        headline: 'NEW DRIVE',
        importance: 40,
        createdAt: now,
      };
      break;
    case 'FIRST_DOWN':
      next.down = 1;
      next.distance = 10;
      event = {
        type: 'FIRST_DOWN',
        teamId: next.possessionTeamId || undefined,
        headline: 'FIRST DOWN',
        importance: 45,
        createdAt: now,
      };
      break;
    case 'BIG_PLAY':
      next.yardLine = 'OPP 28';
      next.redZone = false;
      event = {
        type: 'BIG_PLAY',
        teamId: next.possessionTeamId || undefined,
        headline: 'BIG PLAY',
        detail: 'A chunk gain flips the field.',
        importance: 75,
        createdAt: now,
      };
      break;
    case 'TOUCHDOWN_HOME':
      next.homeScore += 7;
      event = {
        type: 'TOUCHDOWN',
        teamId: home,
        headline: `TOUCHDOWN ${home}`,
        importance: 100,
        createdAt: now,
      };
      driveResult = 'TOUCHDOWN';
      break;
    case 'FIELD_GOAL_HOME':
      next.homeScore += 3;
      event = {
        type: 'FIELD_GOAL',
        teamId: home,
        headline: `FIELD GOAL ${home}`,
        importance: 80,
        createdAt: now,
      };
      driveResult = 'FIELD_GOAL';
      break;
    case 'TURNOVER_HOME':
      next.possessionTeamId = away;
      event = {
        type: 'TURNOVER',
        teamId: away,
        headline: 'TURNOVER',
        importance: 95,
        createdAt: now,
      };
      driveResult = 'TURNOVER';
      break;
    case 'TOUCHDOWN_AWAY':
      next.awayScore += 7;
      event = {
        type: 'TOUCHDOWN',
        teamId: away,
        headline: `TOUCHDOWN ${away}`,
        importance: 100,
        createdAt: now,
      };
      driveResult = 'TOUCHDOWN';
      break;
    case 'INJURY':
      event = {
        type: 'INJURY',
        headline: 'INJURY UPDATE',
        detail: 'Medical staff is evaluating a player.',
        importance: 85,
        createdAt: now,
      };
      break;
    case 'HALFTIME':
      next.status = 'HALFTIME';
      next.clock = '0:00';
      event = { type: 'HALFTIME', headline: 'HALFTIME', importance: 90, createdAt: now };
      break;
    case 'START_3Q':
      next.status = 'LIVE';
      next.quarter = 3;
      next.clock = '15:00';
      event = { type: 'GAME_STARTED', headline: 'SECOND HALF', importance: 70, createdAt: now };
      break;
    case 'FINAL':
      next.status = 'FINAL';
      next.clock = '0:00';
      event = { type: 'GAME_FINAL', headline: 'FINAL', importance: 100, createdAt: now };
      break;
  }
  return { state: next, event, driveResult };
}
