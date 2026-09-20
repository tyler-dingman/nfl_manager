export { loadTransactions } from './transactions';
import { TEAM_LIST } from '@/data/teams';
import type { AnswerSource, SearchGame } from '@/features/search/answer-types';
import { authDb } from '@/server/auth/database';

export type Standing = {
  team: string;
  conference: string;
  wins: number;
  losses: number;
  ties: number;
  seed: number | null;
  season: number;
};
export type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  experience: number | null;
};
export type Injury = {
  name: string;
  position: string;
  status: string;
  detail: string;
  date: string;
};
export type NewsEvidence = {
  id: string;
  title: string;
  summary: string;
  category: string;
  entities: string[];
  publishedAt: string;
  importance: number;
  independentSources: number;
  sources: Array<AnswerSource & { tier: string; reliability: number }>;
};
export { getStoredGameOdds as loadOdds } from './stored-betting';
export type { OddsLine } from './stored-betting';

const iso = (value: any) => (value instanceof Date ? value.toISOString() : String(value ?? ''));
const abbr = (value: string) => ({ WSH: 'WAS', JAC: 'JAX', LA: 'LAR' })[value] ?? value;
const slug = (team: string) => (team === 'WAS' ? 'wsh' : team.toLowerCase());
export const nflSeason = (now: Date) => now.getUTCFullYear() - (now.getUTCMonth() < 3 ? 1 : 0);
const source = (id: string, title: string, url: string, updatedAt: string): AnswerSource => ({
  id,
  title,
  url,
  provider: 'ESPN',
  updatedAt,
});
async function espn(path: string) {
  const response = await fetch(`https://site.api.espn.com/${path}`, {
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Schedule/data provider returned ${response.status}`);
  return response.json();
}
export function normalizeSearchGame(event: any, fetchedAt: string): SearchGame | null {
  const c = event.competitions?.[0];
  const home = c?.competitors?.find((x: any) => x.homeAway === 'home'),
    away = c?.competitors?.find((x: any) => x.homeAway === 'away');
  const startsAt = c?.date ?? event.date;
  if (
    !event.id ||
    !home?.team?.abbreviation ||
    !away?.team?.abbreviation ||
    !Number.isFinite(Date.parse(startsAt))
  )
    return null;
  const status = c.status?.type ?? event.status?.type;
  const score = (v: any) =>
    v === undefined || v === null
      ? null
      : Number.isFinite(Number(v.value ?? v))
        ? Number(v.value ?? v)
        : null;
  return {
    id: String(event.id),
    home: abbr(home.team.abbreviation),
    away: abbr(away.team.abbreviation),
    startsAt: new Date(startsAt).toISOString(),
    week: event.week?.number ?? null,
    venue: c.venue?.fullName ?? null,
    network:
      c.broadcasts?.flatMap((x: any) => x.names ?? x.media?.shortName ?? []).join(', ') || null,
    status: status?.completed
      ? 'final'
      : status?.state === 'in'
        ? 'live'
        : /postpon|cancel/i.test(status?.name ?? '')
          ? 'postponed'
          : 'scheduled',
    homeScore: score(home.score),
    awayScore: score(away.score),
    timeTbd: event.timeValid === false || c.timeValid === false,
    source: source(
      `game:${event.id}`,
      event.name ?? `${away.team.abbreviation} at ${home.team.abbreviation}`,
      `https://www.espn.com/nfl/game/_/gameId/${encodeURIComponent(event.id)}`,
      fetchedAt,
    ),
  };
}
export async function loadSchedule(team: string, now: Date): Promise<SearchGame[]> {
  const season = nflSeason(now);
  const results = await Promise.allSettled(
    [1, 2, 3].map((type) =>
      espn(
        `apis/site/v2/sports/football/nfl/teams/${slug(team)}/schedule?season=${season}&seasontype=${type}`,
      ),
    ),
  );
  if (results.every((r) => r.status === 'rejected')) throw new Error('Schedule unavailable');
  const games = results.flatMap((r) =>
    r.status === 'fulfilled'
      ? (r.value.events ?? [])
          .map((e: any) => normalizeSearchGame(e, r.value.timestamp ?? now.toISOString()))
          .filter(Boolean)
      : [],
  ) as SearchGame[];
  return [...new Map(games.map((g) => [g.id, g])).values()]
    .filter((g) => g.home === team || g.away === team)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export async function loadStandings(
  now: Date,
): Promise<{ rows: Standing[]; source: AnswerSource }> {
  const season = nflSeason(now),
    data = await espn(`apis/v2/sports/football/nfl/standings?season=${season}`);
  const rows: Standing[] = [];
  for (const group of data.children ?? [])
    for (const entry of group.standings?.entries ?? []) {
      const stat = (key: string) => entry.stats?.find((s: any) => s.name === key)?.value;
      if (
        !entry.team?.abbreviation ||
        !Number.isFinite(stat('wins')) ||
        !Number.isFinite(stat('losses'))
      )
        continue;
      rows.push({
        team: abbr(entry.team.abbreviation),
        conference: group.abbreviation,
        wins: stat('wins'),
        losses: stat('losses'),
        ties: stat('ties') ?? 0,
        seed: stat('playoffSeed') ?? null,
        season: group.standings.season ?? season,
      });
    }
  return {
    rows,
    source: source(
      `standings:${season}`,
      `${season} NFL standings`,
      'https://www.espn.com/nfl/standings',
      now.toISOString(),
    ),
  };
}
export async function loadRoster(
  team: string,
  now: Date,
): Promise<{ players: RosterPlayer[]; source: AnswerSource }> {
  const data = await espn(`apis/site/v2/sports/football/nfl/teams/${slug(team)}/roster`);
  if (!Array.isArray(data.athletes)) throw new Error('Roster unavailable');
  return {
    players: data.athletes.flatMap((g: any) =>
      (g.items ?? []).map((p: any) => ({
        id: p.id,
        name: p.fullName,
        position: p.position?.abbreviation ?? '—',
        experience: p.experience?.years ?? null,
      })),
    ),
    source: source(
      `roster:${team}`,
      `${team} roster`,
      `https://www.espn.com/nfl/team/roster/_/name/${slug(team)}`,
      data.timestamp ?? now.toISOString(),
    ),
  };
}
export async function loadInjuries(
  team: string,
  now: Date,
): Promise<{ rows: Injury[]; source: AnswerSource }> {
  const data = await espn('apis/site/v2/sports/football/nfl/injuries');
  if (!Array.isArray(data.injuries)) throw new Error('Injuries unavailable');
  const name = TEAM_LIST.find((t) => t.abbr === team)?.name;
  const group = data.injuries.find((g: any) => g.displayName === name);
  const rows = (group?.injuries ?? [])
    .filter(
      (r: any) =>
        Date.parse(r.date) > now.getTime() - 7 * 86400000 &&
        Date.parse(r.date) <= now.getTime() + 60000,
    )
    .map((r: any) => ({
      name: r.athlete?.displayName ?? '',
      position: r.athlete?.position?.abbreviation ?? '',
      status: r.status,
      detail: r.shortComment ?? '',
      date: r.date,
    }));
  return {
    rows,
    source: source(
      `injuries:${team}`,
      `${team} injury report`,
      'https://www.espn.com/nfl/injuries',
      data.timestamp ?? now.toISOString(),
    ),
  };
}
export async function loadNews(team: string, now: Date): Promise<NewsEvidence[]> {
  const db = authDb();
  const rows =
    await db`SELECT s.id,s.headline,s.summary,s.story_type,s.entities,s.importance_score,s.independent_source_count,
      s.last_meaningful_update_at,c.title,c.canonical_url,c.published_at,cs.name,cs.polling_tier,cs.reliability_score
    FROM canonical_stories s JOIN story_evidence e ON e.story_id=s.id
    JOIN content_candidates c ON c.id=e.content_candidate_id JOIN content_sources cs ON cs.id=e.source_id
    WHERE s.team_id=${team} AND s.publication_state IN ('PUBLISHED','AUTO_PUBLISHED') AND s.status<>'HOLDING'
      AND s.last_meaningful_update_at>=${new Date(now.getTime() - 72 * 3600000)}
      AND c.published_at>=${new Date(now.getTime() - 72 * 3600000)} AND c.published_at<=${now}
    ORDER BY s.last_meaningful_update_at DESC,cs.reliability_score DESC LIMIT 150`;
  const clusters = new Map<string, NewsEvidence>();
  for (const r of rows) {
    let c = clusters.get(r.id);
    if (!c) {
      c = {
        id: r.id,
        title: r.headline,
        summary: r.summary,
        category: r.story_type,
        entities: Array.isArray(r.entities)
          ? r.entities
              .map((e: any) => (typeof e === 'string' ? e : (e.name ?? e.value ?? '')))
              .filter(Boolean)
          : [],
        publishedAt: iso(r.last_meaningful_update_at),
        importance: Number(r.importance_score),
        independentSources: Number(r.independent_source_count ?? 1),
        sources: [],
      };
      clusters.set(r.id, c);
    }
    if (!c.sources.some((s) => s.url === r.canonical_url))
      c.sources.push({
        id: `evidence:${r.id}:${c.sources.length}`,
        title: r.title,
        url: r.canonical_url,
        provider: r.name,
        publishedAt: iso(r.published_at),
        tier: r.polling_tier,
        reliability: Number(r.reliability_score),
      });
  }
  return [...clusters.values()];
}
export async function loadStats(
  team: string,
  season: number,
  player: boolean,
): Promise<{ columns: string[]; rows: string[][]; throughWeek: number | null }> {
  const db = authDb();
  if (player) {
    const rows =
      await db`SELECT provider_player_name AS name,position,max(week)::int AS week,count(*)::int AS games,
      sum(passing_yards)::float8 AS passing,sum(rushing_yards)::float8 AS rushing,sum(receiving_yards)::float8 AS receiving,
      sum(passing_tds)::int AS passing_tds,sum(rushing_tds)::int AS rushing_tds,sum(receiving_tds)::int AS receiving_tds,sum(receptions)::int AS receptions
      FROM historical_player_games WHERE team_id=${team} AND season=${season} AND season_type='REG'
      GROUP BY player_id,provider_player_name,position ORDER BY sum(coalesce(passing_yards,0)+coalesce(rushing_yards,0)+coalesce(receiving_yards,0)) DESC LIMIT 60`;
    return {
      columns: [
        'Player',
        'Position',
        'Games',
        'Pass yds',
        'Rush yds',
        'Rec yds',
        'Pass TD',
        'Rush TD',
        'Rec TD',
        'Receptions',
      ],
      rows: rows.map((r) => [
        r.name,
        r.position,
        String(r.games),
        String(r.passing ?? '—'),
        String(r.rushing ?? '—'),
        String(r.receiving ?? '—'),
        String(r.passing_tds ?? '—'),
        String(r.rushing_tds ?? '—'),
        String(r.receiving_tds ?? '—'),
        String(r.receptions ?? '—'),
      ]),
      throughWeek: Math.max(0, ...rows.map((r) => r.week)),
    };
  }
  const rows =
    await db`SELECT season,pass_defense_rank,passing_yards_allowed_per_game,rush_defense_rank,rushing_yards_allowed_per_game,scoring_defense_rank,points_allowed_per_game FROM historical_team_season_strength WHERE team_id=${team} AND season=${season}`;
  return {
    columns: ['Metric', 'Value'],
    rows: rows.flatMap((r) => [
      ['Pass defense rank', String(r.pass_defense_rank)],
      ['Pass yards allowed/game', String(r.passing_yards_allowed_per_game)],
      ['Rush defense rank', String(r.rush_defense_rank)],
      ['Rush yards allowed/game', String(r.rushing_yards_allowed_per_game)],
      ['Points allowed/game', String(r.points_allowed_per_game)],
    ]),
    throughWeek: null,
  };
}
