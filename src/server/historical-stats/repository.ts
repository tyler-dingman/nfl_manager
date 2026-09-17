import { authDb } from '@/server/auth/database';
import type { HistoricalPlayerGame, TeamSeasonStrength } from './types';

const DEFAULT_HISTORICAL_SEASONS = [2024, 2025, 2026];

export async function getPlayerGameLogs(playerIds: string[], seasons = DEFAULT_HISTORICAL_SEASONS) {
  if (!playerIds.length) return [];
  return authDb()<HistoricalPlayerGame[]>`
    WITH team_schedule AS (
      SELECT game_id, team_id, kickoff_at,
        lag(kickoff_at) OVER (PARTITION BY team_id, season ORDER BY kickoff_at, game_id) AS previous_kickoff_at
      FROM (
        SELECT id AS game_id, season, home_team_id AS team_id, kickoff_at FROM historical_games
        UNION ALL
        SELECT id AS game_id, season, away_team_id AS team_id, kickoff_at FROM historical_games
      ) schedule
    )
    SELECT pg.game_id AS "gameId", g.game_date::text AS date, g.kickoff_at::text AS "kickoffAt",
      ts.previous_kickoff_at::text AS "previousTeamKickoffAt", pg.season, pg.week,
      pg.season_type AS "seasonType", pg.player_id AS "playerId", pg.provider_player_name AS "playerName",
      pg.team_id AS "teamId", pg.opponent_team_id AS "opponentTeamId", pg.home_away AS "homeAway",
      g.home_team_id AS "homeTeamId",
      pg.position, pg.passing_attempts AS "passingAttempts", pg.passing_completions AS "passingCompletions",
      pg.passing_yards::float8 AS "passingYards", pg.passing_tds AS "passingTds", pg.interceptions,
      pg.carries, pg.rushing_yards::float8 AS "rushingYards", pg.rushing_tds AS "rushingTds", pg.targets,
      pg.receptions, pg.receiving_yards::float8 AS "receivingYards", pg.receiving_tds AS "receivingTds"
      ,CASE WHEN s.team_id IS NULL THEN NULL ELSE json_build_object(
        'season',s.season,'teamId',s.team_id,'passDefenseRank',s.pass_defense_rank,
        'passingYardsAllowedPerGame',s.passing_yards_allowed_per_game::float8,
        'rushDefenseRank',s.rush_defense_rank,'rushingYardsAllowedPerGame',s.rushing_yards_allowed_per_game::float8,
        'scoringDefenseRank',s.scoring_defense_rank,'pointsAllowedPerGame',s.points_allowed_per_game::float8,
        'totalDefenseRank',s.total_defense_rank,'totalYardsAllowedPerGame',s.total_yards_allowed_per_game::float8
      ) END AS "opponentSeasonStrength"
    FROM historical_player_games pg JOIN historical_games g ON g.id=pg.game_id
    LEFT JOIN team_schedule ts ON ts.game_id=pg.game_id AND ts.team_id=pg.team_id
    LEFT JOIN historical_team_season_strength s ON s.season=pg.season AND s.team_id=pg.opponent_team_id
    WHERE pg.player_id = ANY(${playerIds}) AND pg.season = ANY(${seasons})
    ORDER BY g.game_date DESC, pg.week DESC`;
}

export async function getTeamSeasonStrength(teamId: string, season: number) {
  const rows = await authDb()<TeamSeasonStrength[]>`
    SELECT season,team_id AS "teamId",pass_defense_rank AS "passDefenseRank",
      passing_yards_allowed_per_game::float8 AS "passingYardsAllowedPerGame",
      rush_defense_rank AS "rushDefenseRank",rushing_yards_allowed_per_game::float8 AS "rushingYardsAllowedPerGame",
      scoring_defense_rank AS "scoringDefenseRank",points_allowed_per_game::float8 AS "pointsAllowedPerGame",
      total_defense_rank AS "totalDefenseRank",total_yards_allowed_per_game::float8 AS "totalYardsAllowedPerGame"
    FROM historical_team_season_strength WHERE team_id=${teamId} AND season=${season} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getOpponentPositionGameLogs(
  opponentTeamId: string,
  position: 'QB' | 'RB' | 'WR' | 'TE',
  seasons = DEFAULT_HISTORICAL_SEASONS,
) {
  return authDb()<HistoricalPlayerGame[]>`
    SELECT pg.game_id AS "gameId", g.game_date::text AS date, pg.season, pg.week,
      pg.season_type AS "seasonType", pg.player_id AS "playerId", pg.provider_player_name AS "playerName",
      pg.team_id AS "teamId", pg.opponent_team_id AS "opponentTeamId", pg.home_away AS "homeAway", pg.position,
      pg.passing_attempts AS "passingAttempts", pg.passing_completions AS "passingCompletions",
      pg.passing_yards::float8 AS "passingYards", pg.passing_tds AS "passingTds", pg.interceptions,
      pg.carries, pg.rushing_yards::float8 AS "rushingYards", pg.rushing_tds AS "rushingTds", pg.targets,
      pg.receptions, pg.receiving_yards::float8 AS "receivingYards", pg.receiving_tds AS "receivingTds"
    FROM historical_player_games pg JOIN historical_games g ON g.id=pg.game_id
    WHERE pg.opponent_team_id=${opponentTeamId} AND pg.position=${position} AND pg.season=ANY(${seasons})
    ORDER BY g.game_date DESC, pg.week DESC`;
}
