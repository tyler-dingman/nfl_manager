import { TEAM_LIST } from '@/data/teams';
import { authDb } from '@/server/auth/database';

const endpoint = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const aliases: Record<string, string> = { WSH: 'WAS', WSN: 'WAS', JAC: 'JAX', LA: 'LAR' };
const teamId = (value: string) => {
  const abbr = aliases[value] ?? value;
  return TEAM_LIST.find((t) => t.abbr === abbr)?.abbr;
};
// ESPN is also the source used by the existing Front Office calendar.
export async function ingestSchedule(season: number, dryRun = false) {
  const payloads = await Promise.all(
    [season, season + 1].map(async (year) => {
      const response = await fetch(`${endpoint}?dates=${year}&limit=1000`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Schedule source failed (${response.status})`);
      return response.json();
    }),
  );
  const events = [
    ...new Map<string, any>(
      payloads
        .flatMap((p) => p.events ?? [])
        .filter((e: any) => e.season?.year === season)
        .map((e: any) => [e.id, e]),
    ).values(),
  ];
  const games = events.flatMap((e) => {
    const c = e.competitions?.[0];
    const home = c?.competitors?.find((t: any) => t.homeAway === 'home');
    const away = c?.competitors?.find((t: any) => t.homeAway === 'away');
    const homeTeam = teamId(home?.team?.abbreviation),
      awayTeam = teamId(away?.team?.abbreviation);
    const type = ({ 1: 'PRE', 2: 'REG', 3: 'POST' } as Record<number, string>)[e.season.type];
    // Future playoff placeholders have no determined teams; do not invent them.
    if (!homeTeam || !awayTeam || !type || !e.week?.number || !e.date) return [];
    const status = e.status ?? c.status;
    const state =
      status?.type?.name === 'STATUS_POSTPONED'
        ? 'POSTPONED'
        : status?.type?.name === 'STATUS_CANCELED'
          ? 'CANCELED'
          : status?.type?.completed
            ? 'FINAL'
            : status?.type?.state === 'in'
              ? 'LIVE'
              : 'SCHEDULED';
    const hasScores = state === 'FINAL' || state === 'LIVE';
    return [
      {
        eventId: e.id,
        season,
        seasonType: type,
        week: e.week.number,
        homeTeam,
        awayTeam,
        kickoffAt: e.date,
        kickoffConfirmed: c.timeValid !== false,
        status: state,
        homeScore: hasScores && home.score !== undefined ? Number(home.score) : null,
        awayScore: hasScores && away.score !== undefined ? Number(away.score) : null,
        overtime: Number(status?.period) > 4,
        venue: c.venue?.fullName ?? null,
        broadcastNetwork: c.broadcasts?.flatMap((b: any) => b.names ?? []).join(', ') || null,
      },
    ];
  });
  const regular = games.filter((g) => g.seasonType === 'REG');
  if (
    regular.length !== 272 ||
    new Set(regular.flatMap((g) => [g.homeTeam, g.awayTeam])).size !== 32
  )
    throw new Error(
      `Incomplete ${season} schedule: ${regular.length}/272 regular-season games; no import performed`,
    );
  for (const t of TEAM_LIST)
    if (regular.filter((g) => g.homeTeam === t.abbr || g.awayTeam === t.abbr).length !== 17)
      throw new Error(`Invalid season coverage for ${t.abbr}`);
  if (!dryRun)
    await authDb().begin(async (tx) => {
      for (const g of games)
        await tx`INSERT INTO historical_games(season,season_type,week,provider,provider_game_id,espn_event_id,game_date,kickoff_at,kickoff_confirmed,home_team_id,away_team_id,status,home_score,away_score,overtime,venue,broadcast_network)
    VALUES(${g.season},${g.seasonType},${g.week},'ESPN',${g.eventId},${g.eventId},${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(g.kickoffAt))},${g.kickoffAt},${g.kickoffConfirmed},${g.homeTeam},${g.awayTeam},${g.status},${g.homeScore},${g.awayScore},${g.overtime},${g.venue},${g.broadcastNetwork})
    ON CONFLICT(season,season_type,week,home_team_id,away_team_id) DO UPDATE SET espn_event_id=EXCLUDED.espn_event_id,game_date=EXCLUDED.game_date,kickoff_at=EXCLUDED.kickoff_at,kickoff_confirmed=EXCLUDED.kickoff_confirmed,status=EXCLUDED.status,home_score=EXCLUDED.home_score,away_score=EXCLUDED.away_score,overtime=EXCLUDED.overtime,venue=EXCLUDED.venue,broadcast_network=EXCLUDED.broadcast_network,updated_at=now()`;
    });
  return {
    season,
    regular: regular.length,
    preseason: games.filter((g) => g.seasonType === 'PRE').length,
    postseason: games.filter((g) => g.seasonType === 'POST').length,
    dryRun,
  };
}
