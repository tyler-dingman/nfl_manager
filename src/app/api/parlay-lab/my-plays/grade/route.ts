import { NextRequest, NextResponse } from 'next/server';
import { authDb } from '@/server/auth/database';
import { gradeSavedLeg } from '@/server/historical-stats/saved-play-grading';
import type { HistoricalPlayerGame } from '@/server/historical-stats/types';
import {
  deriveSavedPlayStatus,
  type SavedLegStatus,
  type SavedPlay,
} from '@/components/parlay-lab/saved-plays';

export const dynamic = 'force-dynamic';

type FinalGame = {
  id: string;
  season: number;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
};

async function finalGameFor(play: SavedPlay) {
  const event = play.event;
  if (!event) return null;
  const rows = await authDb()<FinalGame[]>`
    SELECT id,season,week,home_team_id AS "homeTeamId",away_team_id AS "awayTeamId",
      kickoff_at::text AS "kickoffAt" FROM historical_games
    WHERE season=${event.season ?? new Date(event.kickoffAt).getFullYear()}
      AND week=${event.week}
      AND home_team_id=${event.homeTeamId}
      AND away_team_id=${event.awayTeamId}
      AND home_score IS NOT NULL AND away_score IS NOT NULL
    LIMIT 1`;
  if (rows[0]) return rows[0];

  // Older browser saves may contain a bad event-team snapshot from imports
  // predating team-mapping fixes. Repair only when canonical player IDs point
  // to one shared final game in the same season/week.
  const playerIds = [
    ...new Set(play.selections.map((leg) => leg.playerId).filter(Boolean)),
  ] as string[];
  if (!playerIds.length) return null;
  const repaired = await authDb()<FinalGame[]>`
    SELECT g.id,g.season,g.week,g.home_team_id AS "homeTeamId",g.away_team_id AS "awayTeamId",
      g.kickoff_at::text AS "kickoffAt"
    FROM historical_games g
    JOIN historical_player_games pg ON pg.game_id=g.id
    WHERE g.season=${event.season ?? new Date(event.kickoffAt).getFullYear()}
      AND (g.week=${event.week}
        OR abs(extract(epoch FROM (g.kickoff_at-${new Date(event.kickoffAt)}::timestamptz))) <= 129600)
      AND pg.player_id=ANY(${playerIds})
      AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL
    GROUP BY g.id,g.season,g.week,g.home_team_id,g.away_team_id,g.kickoff_at
    HAVING count(DISTINCT pg.player_id)=${playerIds.length}
    ORDER BY abs(extract(epoch FROM (g.kickoff_at-${new Date(event.kickoffAt)}::timestamptz)))
    LIMIT 1`;
  return repaired[0] ?? null;
}

async function playerResult(gameId: string, playerId: string) {
  const rows = await authDb()<HistoricalPlayerGame[]>`
    SELECT pg.game_id AS "gameId", g.game_date::text AS date, g.kickoff_at::text AS "kickoffAt",
      pg.season, pg.week, pg.season_type AS "seasonType", pg.player_id AS "playerId",
      pg.provider_player_name AS "playerName", pg.team_id AS "teamId",
      pg.opponent_team_id AS "opponentTeamId", pg.home_away AS "homeAway", pg.position,
      pg.passing_attempts AS "passingAttempts", pg.passing_completions AS "passingCompletions",
      pg.passing_yards::float8 AS "passingYards", pg.passing_tds AS "passingTds",
      pg.interceptions, pg.carries, pg.rushing_yards::float8 AS "rushingYards",
      pg.rushing_tds AS "rushingTds", pg.targets, pg.receptions,
      pg.receiving_yards::float8 AS "receivingYards", pg.receiving_tds AS "receivingTds"
    FROM historical_player_games pg
    JOIN historical_games g ON g.id=pg.game_id
    WHERE pg.game_id=${gameId} AND pg.player_id=${playerId}
    LIMIT 1`;
  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { plays?: SavedPlay[] } | null;
  const plays = Array.isArray(body?.plays) ? body.plays.slice(0, 20) : [];
  const now = Date.now();
  const results = await Promise.all(
    plays.map(async (play) => {
      const kickoff = play.event?.kickoffAt ? new Date(play.event.kickoffAt).getTime() : NaN;
      if (Number.isFinite(kickoff) && kickoff > now) {
        return {
          id: play.id,
          status: 'UPCOMING' as const,
          legs: play.selections.map((leg) => ({ id: leg.id, status: 'UPCOMING' as const })),
        };
      }
      const finalGame = await finalGameFor(play);
      if (!finalGame) {
        const status: SavedLegStatus =
          Number.isFinite(kickoff) && now - kickoff < 6 * 60 * 60 * 1000
            ? 'LIVE'
            : 'UNABLE_TO_GRADE';
        return {
          id: play.id,
          status: deriveSavedPlayStatus(play.selections.map(() => status)),
          legs: play.selections.map((leg) => ({ id: leg.id, status })),
        };
      }
      const legs = await Promise.all(
        play.selections.slice(0, 12).map(async (leg) => {
          const game = leg.playerId ? await playerResult(finalGame.id, leg.playerId) : null;
          return { id: leg.id, ...gradeSavedLeg(leg, game), gradedAt: new Date().toISOString() };
        }),
      );
      return {
        id: play.id,
        status: deriveSavedPlayStatus(legs.map((leg) => leg.status)),
        legs,
        event: {
          id: play.event?.id ?? finalGame.id,
          season: finalGame.season,
          week: finalGame.week,
          homeTeamId: finalGame.homeTeamId,
          awayTeamId: finalGame.awayTeamId,
          kickoffAt: finalGame.kickoffAt,
        },
        gradedAt: new Date().toISOString(),
      };
    }),
  );
  return NextResponse.json({ results });
}
