import { authDb } from '@/server/auth/database';

export async function calculateTeamSeasonStrength(season: number) {
  const db = authDb();
  await db`
    WITH offense AS (
      SELECT season, team_id, count(*)::int games,
        avg(points)::numeric points_per_game,
        avg(coalesce(passing_yards,receiving_yards,0))::numeric passing_yards_per_game,
        avg(coalesce(rushing_yards,0))::numeric rushing_yards_per_game,
        avg(coalesce(passing_yards,receiving_yards,0)+coalesce(rushing_yards,0))::numeric total_yards_per_game
      FROM historical_team_games WHERE season=${season} AND season_type='REG'
      GROUP BY season,team_id
    ), defense AS (
      SELECT own.season, own.team_id,
        avg(opp.points)::numeric points_allowed_per_game,
        avg(coalesce(opp.passing_yards,opp.receiving_yards,0))::numeric passing_yards_allowed_per_game,
        avg(coalesce(opp.rushing_yards,0))::numeric rushing_yards_allowed_per_game,
        avg(coalesce(opp.passing_yards,opp.receiving_yards,0)+coalesce(opp.rushing_yards,0))::numeric total_yards_allowed_per_game
      FROM historical_team_games own
      JOIN historical_team_games opp ON opp.game_id=own.game_id AND opp.team_id=own.opponent_team_id
      WHERE own.season=${season} AND own.season_type='REG' AND opp.season_type='REG'
      GROUP BY own.season,own.team_id
    ), ranked AS (
      SELECT o.*, d.points_allowed_per_game,d.passing_yards_allowed_per_game,
        d.rushing_yards_allowed_per_game,d.total_yards_allowed_per_game,
        row_number() over(order by o.points_per_game desc,o.team_id)::int scoring_offense_rank,
        row_number() over(order by o.passing_yards_per_game desc,o.team_id)::int passing_offense_rank,
        row_number() over(order by o.rushing_yards_per_game desc,o.team_id)::int rushing_offense_rank,
        row_number() over(order by o.total_yards_per_game desc,o.team_id)::int total_offense_rank,
        row_number() over(order by d.points_allowed_per_game asc,o.team_id)::int scoring_defense_rank,
        row_number() over(order by d.passing_yards_allowed_per_game asc,o.team_id)::int pass_defense_rank,
        row_number() over(order by d.rushing_yards_allowed_per_game asc,o.team_id)::int rush_defense_rank,
        row_number() over(order by d.total_yards_allowed_per_game asc,o.team_id)::int total_defense_rank
      FROM offense o JOIN defense d USING(season,team_id)
    )
    INSERT INTO historical_team_season_strength(
      season,team_id,games,points_per_game,scoring_offense_rank,passing_yards_per_game,
      passing_offense_rank,rushing_yards_per_game,rushing_offense_rank,total_yards_per_game,
      total_offense_rank,points_allowed_per_game,scoring_defense_rank,
      passing_yards_allowed_per_game,pass_defense_rank,rushing_yards_allowed_per_game,
      rush_defense_rank,total_yards_allowed_per_game,total_defense_rank)
    SELECT season,team_id,games,points_per_game,scoring_offense_rank,passing_yards_per_game,
      passing_offense_rank,rushing_yards_per_game,rushing_offense_rank,total_yards_per_game,
      total_offense_rank,points_allowed_per_game,scoring_defense_rank,
      passing_yards_allowed_per_game,pass_defense_rank,rushing_yards_allowed_per_game,
      rush_defense_rank,total_yards_allowed_per_game,total_defense_rank FROM ranked
    ON CONFLICT(season,team_id) DO UPDATE SET games=excluded.games,
      points_per_game=excluded.points_per_game,scoring_offense_rank=excluded.scoring_offense_rank,
      passing_yards_per_game=excluded.passing_yards_per_game,passing_offense_rank=excluded.passing_offense_rank,
      rushing_yards_per_game=excluded.rushing_yards_per_game,rushing_offense_rank=excluded.rushing_offense_rank,
      total_yards_per_game=excluded.total_yards_per_game,total_offense_rank=excluded.total_offense_rank,
      points_allowed_per_game=excluded.points_allowed_per_game,scoring_defense_rank=excluded.scoring_defense_rank,
      passing_yards_allowed_per_game=excluded.passing_yards_allowed_per_game,pass_defense_rank=excluded.pass_defense_rank,
      rushing_yards_allowed_per_game=excluded.rushing_yards_allowed_per_game,rush_defense_rank=excluded.rush_defense_rank,
      total_yards_allowed_per_game=excluded.total_yards_allowed_per_game,total_defense_rank=excluded.total_defense_rank,
      updated_at=now()`;
  const [{ count } = { count: 0 }] = await db<Array<{ count: number }>>`
    SELECT count(*)::int count FROM historical_team_season_strength WHERE season=${season}`;
  return count;
}

export async function calculateTeamSeasonStrengths(seasons: number[]) {
  const results: Record<number, number> = {};
  for (const season of seasons) results[season] = await calculateTeamSeasonStrength(season);
  return results;
}
