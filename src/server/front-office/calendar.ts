import {
  resolveNFLSeasonPhase,
  type NFLCalendarState,
  type NFLScheduleGame,
} from '@/lib/nfl-calendar';

type EspnEvent = {
  id?: string;
  name?: string;
  date?: string;
  week?: { number?: number };
  season?: { year?: number; type?: number };
  competitions?: Array<{
    neutralSite?: boolean;
    competitors?: Array<{ homeAway?: 'home' | 'away'; team?: { abbreviation?: string } }>;
  }>;
};

const calendarCache = new Map<number, { expiresAt: number; games: NFLScheduleGame[] }>();
const CALENDAR_CACHE_TTL = 6 * 60 * 60 * 1000;

export function createFallbackRegularSeasonSchedule(teamAbbrs: string[], season: number) {
  const teams = [...new Set(teamAbbrs.map((abbr) => abbr.toUpperCase()))].sort();
  if (teams.length % 2 !== 0) throw new Error('An even number of teams is required.');
  const rotation = [...teams];
  const games: NFLScheduleGame[] = [];
  for (let week = 1; week <= 17; week += 1) {
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      const homeTeam = (week + index) % 2 === 0 ? left : right;
      const awayTeam = homeTeam === left ? right : left;
      games.push({
        id: `${season}-fallback-${week}-${awayTeam}-${homeTeam}`,
        season,
        seasonType: 'REG',
        week,
        startsAt: `${season}-09-01T00:00:00.000Z`,
        homeTeam,
        awayTeam,
      });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return games;
}

async function fetchCalendarYear(calendarYear: number) {
  const cached = calendarCache.get(calendarYear);
  if (cached && cached.expiresAt > Date.now()) return cached.games;
  const url = new URL('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  url.searchParams.set('dates', String(calendarYear));
  url.searchParams.set('limit', '1000');
  // The raw annual scoreboard response is several MB, above Next's data-cache item limit.
  // Cache only the compact normalized schedule in memory instead.
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`NFL calendar request failed (${response.status}).`);
  const payload = (await response.json()) as { events?: EspnEvent[] };
  const games = (payload.events ?? []).flatMap<NFLScheduleGame>((event) => {
    const seasonType = ({ 1: 'PRE', 2: 'REG', 3: 'POST' } as const)[
      event.season?.type as 1 | 2 | 3
    ];
    if (!event.id || !event.date || !event.week?.number || !event.season?.year || !seasonType) {
      return [];
    }
    return [
      {
        id: event.id,
        season: event.season.year,
        seasonType,
        week: event.week.number,
        startsAt: event.date,
        name: event.name,
        homeTeam: event.competitions?.[0]?.competitors?.find(
          (competitor) => competitor.homeAway === 'home',
        )?.team?.abbreviation,
        awayTeam: event.competitions?.[0]?.competitors?.find(
          (competitor) => competitor.homeAway === 'away',
        )?.team?.abbreviation,
      },
    ];
  });
  calendarCache.set(calendarYear, { expiresAt: Date.now() + CALENDAR_CACHE_TTL, games });
  return games;
}

export async function getNFLRegularSeasonSchedule(season: number) {
  const games = (
    await Promise.all([fetchCalendarYear(season), fetchCalendarYear(season + 1)])
  ).flat();
  return [...new Map(games.map((game) => [game.id, game])).values()].filter(
    (game) => game.season === season && game.seasonType === 'REG' && game.homeTeam && game.awayTeam,
  );
}

export async function getNFLCalendarState(date = new Date()): Promise<NFLCalendarState> {
  const year = date.getUTCFullYear();
  const results = await Promise.allSettled(
    [year - 1, year, year + 1].map((calendarYear) => fetchCalendarYear(calendarYear)),
  );
  const schedule = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  return resolveNFLSeasonPhase(date, schedule);
}
