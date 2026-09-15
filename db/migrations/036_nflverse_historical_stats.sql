BEGIN;

ALTER TABLE provider_player_mappings
  ADD COLUMN IF NOT EXISTS confidence text
  CHECK (confidence IS NULL OR confidence IN ('EXACT_ID', 'NAME_TEAM_POSITION', 'NAME_POSITION'));

CREATE TABLE IF NOT EXISTS historical_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  provider text NOT NULL DEFAULT 'NFLVERSE',
  provider_game_id text NOT NULL,
  game_date date NOT NULL,
  kickoff_at timestamptz,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL,
  home_score integer,
  away_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_game_id)
);

CREATE TABLE IF NOT EXISTS historical_player_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  game_id uuid NOT NULL REFERENCES historical_games(id) ON DELETE CASCADE,
  player_id text,
  provider text NOT NULL DEFAULT 'NFLVERSE',
  provider_player_id text NOT NULL,
  provider_player_name text NOT NULL,
  team_id text NOT NULL,
  opponent_team_id text NOT NULL,
  home_away text NOT NULL CHECK (home_away IN ('HOME', 'AWAY')),
  position text,
  passing_attempts integer,
  passing_completions integer,
  passing_yards numeric,
  passing_tds integer,
  interceptions integer,
  sacks_taken numeric,
  carries integer,
  rushing_yards numeric,
  rushing_tds integer,
  targets integer,
  receptions integer,
  receiving_yards numeric,
  receiving_tds integer,
  fumbles numeric,
  fumbles_lost numeric,
  fantasy_points numeric,
  snap_count integer,
  snap_share numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, week, season_type, provider, provider_player_id, game_id)
);

CREATE TABLE IF NOT EXISTS historical_team_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  game_id uuid NOT NULL REFERENCES historical_games(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  opponent_team_id text NOT NULL,
  home_away text NOT NULL CHECK (home_away IN ('HOME', 'AWAY')),
  points integer,
  plays integer,
  passing_attempts integer,
  passing_completions integer,
  passing_yards numeric,
  passing_tds integer,
  interceptions integer,
  rushing_attempts integer,
  rushing_yards numeric,
  rushing_tds integer,
  targets integer,
  receptions integer,
  receiving_yards numeric,
  sacks_allowed numeric,
  sacks_made numeric,
  turnovers numeric,
  first_downs integer,
  third_down_attempts integer,
  third_down_conversions integer,
  time_of_possession interval,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, team_id)
);

CREATE INDEX IF NOT EXISTS historical_player_games_player_season_week_idx ON historical_player_games(player_id, season, week);
CREATE INDEX IF NOT EXISTS historical_player_games_player_game_idx ON historical_player_games(player_id, game_id);
CREATE INDEX IF NOT EXISTS historical_player_games_team_season_idx ON historical_player_games(team_id, season);
CREATE INDEX IF NOT EXISTS historical_player_games_opponent_season_idx ON historical_player_games(opponent_team_id, season);
CREATE INDEX IF NOT EXISTS historical_player_games_position_season_idx ON historical_player_games(position, season);
CREATE INDEX IF NOT EXISTS historical_team_games_team_season_week_idx ON historical_team_games(team_id, season, week);
CREATE INDEX IF NOT EXISTS historical_team_games_opponent_season_idx ON historical_team_games(opponent_team_id, season);

COMMIT;
