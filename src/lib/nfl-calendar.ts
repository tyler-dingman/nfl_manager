import type { FrontOfficePhase } from '@/lib/front-office-phase';

export type NFLPhaseType =
  | 'offseason'
  | 'free_agency'
  | 'draft'
  | 'post_draft'
  | 'training_camp'
  | 'preseason'
  | 'regular_season'
  | 'wild_card'
  | 'divisional'
  | 'conference_championship'
  | 'super_bowl';

export type NFLScheduleGame = {
  id: string;
  season: number;
  seasonType: 'PRE' | 'REG' | 'POST';
  week: number;
  startsAt: string;
  name?: string;
  homeTeam?: string;
  awayTeam?: string;
};

export type NFLCalendarState = {
  season: number;
  phaseType: NFLPhaseType;
  phaseLabel: string;
  frontOfficePhase: FrontOfficePhase;
  week?: number;
  playoffRound?: 'wild_card' | 'divisional' | 'conference_championship' | 'super_bowl';
  events: string[];
};

const DAY = 24 * 60 * 60 * 1000;
const LEAGUE_TIME_ZONE = 'America/New_York';

const OFFSEASON_DATES: Record<
  number,
  { freeAgency: string; draftStart: string; draftEnd: string; trainingCamp: string }
> = {
  2026: {
    freeAgency: '2026-03-11',
    draftStart: '2026-04-23',
    draftEnd: '2026-04-25',
    trainingCamp: '2026-07-15',
  },
};

const dateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: LEAGUE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const postseasonState = (season: number, week: number, name = ''): NFLCalendarState => {
  const normalized = name.toLowerCase();
  if (normalized.includes('super bowl') || week >= 5)
    return {
      season,
      phaseType: 'super_bowl',
      phaseLabel: 'Super Bowl',
      playoffRound: 'super_bowl',
      frontOfficePhase: 'super-bowl',
      events: [],
    };
  if (normalized.includes('conference') || week === 3)
    return {
      season,
      phaseType: 'conference_championship',
      phaseLabel: 'Conference Championships',
      playoffRound: 'conference_championship',
      frontOfficePhase: 'conference',
      events: [],
    };
  if (normalized.includes('divisional') || week === 2)
    return {
      season,
      phaseType: 'divisional',
      phaseLabel: 'Divisional Round',
      playoffRound: 'divisional',
      frontOfficePhase: 'divisional',
      events: [],
    };
  return {
    season,
    phaseType: 'wild_card',
    phaseLabel: 'Wild Card',
    playoffRound: 'wild_card',
    frontOfficePhase: 'wild-card',
    events: [],
  };
};

export function resolveNFLSeasonPhase(date: Date, schedule: NFLScheduleGame[]): NFLCalendarState {
  const now = date.getTime();
  const groups = new Map<string, NFLScheduleGame[]>();
  schedule.forEach((game) => {
    const key = `${game.season}:${game.seasonType}:${game.week}`;
    groups.set(key, [...(groups.get(key) ?? []), game]);
  });
  const periods = [...groups.values()]
    .map((games) => ({
      games,
      startsAt: Math.min(...games.map((game) => new Date(game.startsAt).getTime())) - 2 * DAY,
      endsAt: Math.max(...games.map((game) => new Date(game.startsAt).getTime())) + 2 * DAY,
    }))
    .sort((left, right) => left.startsAt - right.startsAt);

  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index];
    const next = periods[index + 1];
    const end = Math.min(next?.startsAt ?? period.endsAt, period.endsAt);
    if (now < period.startsAt || now >= end) continue;
    const game = period.games[0];
    if (game.seasonType === 'PRE')
      return {
        season: game.season,
        phaseType: 'preseason',
        phaseLabel: 'Preseason',
        frontOfficePhase: 'preseason',
        events: [],
      };
    if (game.seasonType === 'REG')
      return {
        season: game.season,
        phaseType: 'regular_season',
        phaseLabel: `Week ${game.week}`,
        frontOfficePhase: `week-${game.week}`,
        week: game.week,
        events: game.week === 9 ? ['trade_deadline'] : [],
      };
    return postseasonState(game.season, game.week, game.name);
  }

  const easternDate = dateKey(date);
  const calendarYear = Number(easternDate.slice(0, 4));
  const dates = OFFSEASON_DATES[calendarYear];
  if (dates) {
    if (easternDate >= dates.trainingCamp)
      return {
        season: calendarYear,
        phaseType: 'training_camp',
        phaseLabel: 'Training Camp',
        frontOfficePhase: 'preseason',
        events: [],
      };
    if (easternDate > dates.draftEnd)
      return {
        season: calendarYear,
        phaseType: 'post_draft',
        phaseLabel: 'Post-Draft',
        frontOfficePhase: 'post-draft',
        events: [],
      };
    if (easternDate >= dates.draftStart)
      return {
        season: calendarYear,
        phaseType: 'draft',
        phaseLabel: 'NFL Draft',
        frontOfficePhase: 'draft',
        events: [],
      };
    if (easternDate >= dates.freeAgency)
      return {
        season: calendarYear,
        phaseType: 'free_agency',
        phaseLabel: 'Free Agency',
        frontOfficePhase: 'free_agency',
        events: [],
      };
  }
  return {
    season: schedule.at(-1)?.season ?? calendarYear,
    phaseType: 'offseason',
    phaseLabel: 'Offseason',
    frontOfficePhase: 'resign_cut',
    events: [],
  };
}
