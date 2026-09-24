import { authDb } from '@/server/auth/database';
import type { CanonicalGame } from '@/lib/canonical-game';

/** One database read per batch; no provider requests or long-lived stale score cache. */
export async function listCanonicalGames(seasons: number[]): Promise<CanonicalGame[]> {
  const rows =
    await authDb()`SELECT id,espn_event_id,season,season_type,week,home_team_id,away_team_id,kickoff_at,kickoff_confirmed,status,home_score,away_score,overtime,venue,broadcast_network FROM historical_games WHERE season=ANY(${seasons}) ORDER BY kickoff_at,id`;
  return rows.map((r) => ({
    id: r.id,
    providerEventId: r.espn_event_id ?? undefined,
    season: r.season,
    seasonType: r.season_type,
    week: r.week,
    homeTeam: r.home_team_id,
    awayTeam: r.away_team_id,
    kickoffAt: r.kickoff_at?.toISOString() ?? null,
    kickoffConfirmed: r.kickoff_confirmed,
    status: r.status,
    homeScore: r.home_score,
    awayScore: r.away_score,
    overtime: r.overtime,
    venue: r.venue,
    broadcastNetwork: r.broadcast_network,
  }));
}
