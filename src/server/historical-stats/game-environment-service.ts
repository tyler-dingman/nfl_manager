import type { HistoricalPlayerGame } from './types';

export type GameWindow =
  | 'THURSDAY_NIGHT'
  | 'SUNDAY_EARLY'
  | 'SUNDAY_LATE'
  | 'SUNDAY_NIGHT'
  | 'MONDAY_NIGHT'
  | 'SATURDAY_DAY'
  | 'SATURDAY_NIGHT'
  | 'INTERNATIONAL'
  | 'HOLIDAY'
  | 'OTHER';
export type PrimetimeType = 'TNF' | 'SNF' | 'MNF' | 'OTHER_PRIMETIME' | null;
export type RestBucket = 'SHORT_REST' | 'NORMAL_REST' | 'EXTENDED_REST' | 'SEASON_OPENER';
export type GameEnvironment = {
  dayOfWeek: string;
  localKickoffTime: string;
  gameWindow: GameWindow;
  isPrimetime: boolean;
  primetimeType: PrimetimeType;
  isDayGame: boolean;
  isNightGame: boolean;
  dayNight: 'DAY' | 'NIGHT';
  restDays: number | null;
  restBucket: RestBucket;
};

// nflverse supplies league-window kickoff times in Eastern time. Keep this
// conversion centralized so no consumer classifies games from a raw UTC hour.
export const LEAGUE_TIME_ZONE = 'America/New_York';
export const NIGHT_START_HOUR = 18;
const localParts = (kickoffAt: string | Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAGUE_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(kickoffAt));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: get('weekday'), hour: Number(get('hour')), minute: Number(get('minute')) };
};
export const calculateRestDays = (kickoffAt: string | Date, previous?: string | Date | null) => {
  if (!previous) return null;
  const elapsed = new Date(kickoffAt).getTime() - new Date(previous).getTime();
  return elapsed > 0 ? Math.floor(elapsed / 86_400_000) : null;
};
export const restBucketFor = (days: number | null): RestBucket =>
  days === null
    ? 'SEASON_OPENER'
    : days <= 5
      ? 'SHORT_REST'
      : days >= 9
        ? 'EXTENDED_REST'
        : 'NORMAL_REST';

export function deriveGameEnvironment(
  kickoffAt: string | Date,
  previousTeamKickoffAt?: string | Date | null,
): GameEnvironment {
  const { weekday, hour, minute } = localParts(kickoffAt),
    clock = hour + minute / 60,
    isNightGame = clock >= NIGHT_START_HOUR;
  let gameWindow: GameWindow = 'OTHER';
  if (weekday === 'Thursday' && isNightGame) gameWindow = 'THURSDAY_NIGHT';
  else if (weekday === 'Monday' && isNightGame) gameWindow = 'MONDAY_NIGHT';
  else if (weekday === 'Sunday' && isNightGame) gameWindow = 'SUNDAY_NIGHT';
  else if (weekday === 'Sunday' && clock >= 11.5 && clock <= 14.5) gameWindow = 'SUNDAY_EARLY';
  else if (weekday === 'Sunday' && clock >= 15.5 && clock <= 17.75) gameWindow = 'SUNDAY_LATE';
  else if (weekday === 'Saturday') gameWindow = isNightGame ? 'SATURDAY_NIGHT' : 'SATURDAY_DAY';
  const primetimeType: PrimetimeType =
      gameWindow === 'THURSDAY_NIGHT'
        ? 'TNF'
        : gameWindow === 'SUNDAY_NIGHT'
          ? 'SNF'
          : gameWindow === 'MONDAY_NIGHT'
            ? 'MNF'
            : null,
    restDays = calculateRestDays(kickoffAt, previousTeamKickoffAt);
  return {
    dayOfWeek: weekday,
    localKickoffTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    gameWindow,
    isPrimetime: primetimeType !== null,
    primetimeType,
    isDayGame: !isNightGame,
    isNightGame,
    dayNight: isNightGame ? 'NIGHT' : 'DAY',
    restDays,
    restBucket: restBucketFor(restDays),
  };
}
export const deriveHistoricalGameContext = (game: HistoricalPlayerGame) =>
  deriveGameEnvironment(game.kickoffAt ?? `${game.date}T17:00:00Z`, game.previousTeamKickoffAt);
export const gameWindowLabel = (window: GameWindow) =>
  ({
    THURSDAY_NIGHT: 'Thursday Night Football',
    SUNDAY_EARLY: 'Sunday Early',
    SUNDAY_LATE: 'Sunday Late',
    SUNDAY_NIGHT: 'Sunday Night Football',
    MONDAY_NIGHT: 'Monday Night Football',
    SATURDAY_DAY: 'Saturday Day',
    SATURDAY_NIGHT: 'Saturday Night',
    INTERNATIONAL: 'International',
    HOLIDAY: 'Holiday',
    OTHER: 'Other',
  })[window];
