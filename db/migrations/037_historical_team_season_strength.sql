BEGIN;

CREATE TABLE IF NOT EXISTS historical_team_season_strength (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  team_id text NOT NULL,
  games integer NOT NULL,
  points_per_game numeric NOT NULL,
  scoring_offense_rank integer NOT NULL,
  passing_yards_per_game numeric NOT NULL,
  passing_offense_rank integer NOT NULL,
  rushing_yards_per_game numeric NOT NULL,
  rushing_offense_rank integer NOT NULL,
  total_yards_per_game numeric NOT NULL,
  total_offense_rank integer NOT NULL,
  points_allowed_per_game numeric NOT NULL,
  scoring_defense_rank integer NOT NULL,
  passing_yards_allowed_per_game numeric NOT NULL,
  pass_defense_rank integer NOT NULL,
  rushing_yards_allowed_per_game numeric NOT NULL,
  rush_defense_rank integer NOT NULL,
  total_yards_allowed_per_game numeric NOT NULL,
  total_defense_rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, team_id)
);

CREATE INDEX IF NOT EXISTS historical_team_season_strength_lookup_idx
  ON historical_team_season_strength(season, team_id);

COMMIT;
