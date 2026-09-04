import { teamTimeZone } from '@/config/game-day-hero';
import { isGameDayActive, type HomepageGame } from '@/features/game-day/homepage-game';

type EspnCompetitor = {
  homeAway?: string;
  team?: { abbreviation?: string; displayName?: string; shortDisplayName?: string };
};

type EspnCompetition = {
  date?: string;
  venue?: { fullName?: string };
  competitors?: EspnCompetitor[];
  status?: { type?: { state?: string; completed?: boolean } };
  weather?: { temperature?: number; displayValue?: string; conditionId?: string };
  odds?: Array<{ details?: string; overUnder?: number }>;
};

type EspnEvent = {
  id?: string;
  date?: string;
  week?: { number?: number };
  competitions?: EspnCompetition[];
};

const espnTeamSlug = (teamAbbr: string) =>
  (({ WAS: 'wsh' }) as Record<string, string>)[teamAbbr] ?? teamAbbr.toLowerCase();

async function schedule(teamAbbr: string, season: number, seasonType: number) {
  const url = new URL(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${espnTeamSlug(teamAbbr)}/schedule`,
  );
  url.searchParams.set('season', String(season));
  url.searchParams.set('seasontype', String(seasonType));
  const response = await fetch(url, { next: { revalidate: 15 * 60 } });
  if (!response.ok) throw new Error(`ESPN schedule request failed (${response.status}).`);
  const payload = (await response.json()) as { events?: EspnEvent[] };
  return payload.events ?? [];
}

const gameState = (competition: EspnCompetition): HomepageGame['state'] => {
  if (competition.status?.type?.completed) return 'FINAL';
  return competition.status?.type?.state === 'in' ? 'LIVE' : 'PREGAME';
};

function normalizeGame(event: EspnEvent, teamAbbr: string): HomepageGame | null {
  const competition = event.competitions?.[0];
  const startsAt = competition?.date ?? event.date;
  if (!event.id || !startsAt || !competition) return null;
  const selected = competition.competitors?.find(
    (item) => item.team?.abbreviation?.toUpperCase() === teamAbbr,
  );
  const opponent = competition.competitors?.find((item) => item !== selected);
  if (!selected?.team || !opponent?.team?.abbreviation) return null;
  const odds = competition.odds?.[0];
  const weather = competition.weather;
  return {
    id: event.id,
    weekNumber: event.week?.number ?? 0,
    startsAt,
    timeZone: teamTimeZone(teamAbbr),
    teamAbbr,
    teamName: selected.team.shortDisplayName ?? selected.team.displayName ?? teamAbbr,
    opponentAbbr: opponent.team.abbreviation.toUpperCase(),
    opponentName:
      opponent.team.shortDisplayName ?? opponent.team.displayName ?? opponent.team.abbreviation,
    venue: competition.venue?.fullName ?? null,
    weather:
      typeof weather?.temperature === 'number'
        ? {
            temperature: Math.round(weather.temperature),
            condition: weather.displayValue ?? weather.conditionId ?? 'Conditions unavailable',
          }
        : null,
    betting: odds ? { spread: odds.details ?? null, overUnder: odds.overUnder ?? null } : null,
    state: gameState(competition),
  };
}

export async function getHomepageGame(
  teamAbbr: string,
  options: { now?: Date; forceGameDay?: boolean } = {},
) {
  const now = options.now ?? new Date();
  const years = [...new Set([now.getUTCFullYear(), now.getUTCFullYear() - 1])];
  const results = await Promise.allSettled(
    years.flatMap((year) => [1, 2, 3].map((seasonType) => schedule(teamAbbr, year, seasonType))),
  );
  const games = new Map<string, HomepageGame>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const event of result.value) {
      const game = normalizeGame(event, teamAbbr);
      if (game) games.set(game.id, game);
    }
  }
  const ordered = [...games.values()].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const today = ordered.find((game) => isGameDayActive(game.startsAt, now, game.timeZone));
  if (today) return today;
  if (!options.forceGameDay) return null;
  const upcoming = ordered.find((game) => new Date(game.startsAt).getTime() >= now.getTime());
  const fallback = upcoming ?? ordered.at(-1) ?? null;
  return fallback ? { ...fallback, devOverride: true } : null;
}
