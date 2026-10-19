ALTER TABLE app_users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_questions ADD COLUMN source_note TEXT;
ALTER TABLE app_trivia_questions ADD COLUMN season_reference INTEGER;
ALTER TABLE app_trivia_questions ADD COLUMN era TEXT;
ALTER TABLE app_trivia_questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE';
ALTER TABLE app_trivia_questions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_questions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN response_time_total_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN best_game_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN ties INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_trivia_stats ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS app_trivia_games (
  id TEXT PRIMARY KEY NOT NULL,
  mode text NOT NULL CHECK (mode IN ('QUICK', 'FULL', 'FRIEND_CHALLENGE', 'GROUP')),
  team_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('WAITING', 'ACTIVE', 'COMPLETED', 'EXPIRED')),
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  question_count INTEGER NOT NULL DEFAULT 10 CHECK(question_count IN(5,10)),timer_seconds INTEGER NOT NULL DEFAULT 15 CHECK(timer_seconds BETWEEN 5 AND 60),version INTEGER NOT NULL DEFAULT 0,started_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE IF NOT EXISTS app_trivia_game_questions (
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES app_trivia_questions(id),
  presented_at INTEGER,
  position integer NOT NULL CHECK (position >= 1),
  PRIMARY KEY (game_id, position),
  UNIQUE (game_id, question_id)
);
CREATE TABLE IF NOT EXISTS app_trivia_game_participants (
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  participant_status TEXT NOT NULL DEFAULT 'JOINED' CHECK(participant_status IN('INVITED','JOINED')),wrong_answers INTEGER NOT NULL DEFAULT 0,timeouts INTEGER NOT NULL DEFAULT 0,response_time_total_ms INTEGER NOT NULL DEFAULT 0,best_question_score INTEGER NOT NULL DEFAULT 0,score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  completed_at INTEGER,
  PRIMARY KEY (game_id, user_id)
);
CREATE TABLE IF NOT EXISTS app_trivia_friendships (
  requester_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  addressee_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  accepted_at INTEGER,
  PRIMARY KEY (requester_user_id, addressee_user_id),
  CHECK (requester_user_id <> addressee_user_id)
);
CREATE TABLE IF NOT EXISTS app_trivia_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenger_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  challenged_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'EXPIRED')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_trivia_groups (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL UNIQUE REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,invite_token_hash TEXT UNIQUE,expires_at INTEGER NOT NULL,
  host_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_trivia_game_answers(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),question_id TEXT NOT NULL REFERENCES app_trivia_questions(id),game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,selected_answer TEXT CHECK(selected_answer IS NULL OR selected_answer IN('A','B','C','D')),correct INTEGER NOT NULL,response_time_ms INTEGER NOT NULL CHECK(response_time_ms>=0),points_awarded INTEGER NOT NULL,answered_at INTEGER NOT NULL,UNIQUE(user_id,question_id,game_id));
CREATE INDEX app_trivia_answers_game ON app_trivia_game_answers(game_id,user_id);
CREATE UNIQUE INDEX app_trivia_friend_pair ON app_trivia_friendships(min(requester_user_id,addressee_user_id),max(requester_user_id,addressee_user_id));
CREATE TABLE app_trivia_invitations(id TEXT PRIMARY KEY NOT NULL,game_id TEXT NOT NULL REFERENCES app_trivia_games(id),inviter_user_id TEXT NOT NULL REFERENCES app_users(id),invited_user_id TEXT REFERENCES app_users(id),invited_phone_hash TEXT,invite_token_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,accepted_at INTEGER,expires_at INTEGER NOT NULL);
CREATE TABLE app_trivia_rank_snapshots(game_id TEXT NOT NULL REFERENCES app_trivia_games(id),user_id TEXT NOT NULL REFERENCES app_users(id),question_position INTEGER NOT NULL CHECK(question_position BETWEEN 0 AND 10),rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 5),score INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(game_id,user_id,question_position));
CREATE TABLE app_trivia_events(id TEXT PRIMARY KEY NOT NULL,team_id TEXT NOT NULL,question_set_game_id TEXT NOT NULL REFERENCES app_trivia_games(id),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,timezone TEXT NOT NULL DEFAULT 'America/Chicago',status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN('SCHEDULED','LIVE','COMPLETED')),created_at INTEGER NOT NULL,CHECK(ends_at>starts_at));
CREATE INDEX app_trivia_events_upcoming ON app_trivia_events(team_id,status,starts_at);
CREATE TABLE app_trivia_event_registrations(event_id TEXT NOT NULL REFERENCES app_trivia_events(id),user_id TEXT NOT NULL REFERENCES app_users(id),game_id TEXT REFERENCES app_trivia_games(id),registered_at INTEGER NOT NULL,PRIMARY KEY(event_id,user_id));
CREATE INDEX app_trivia_participant_user ON app_trivia_game_participants(user_id,completed_at);
CREATE INDEX app_trivia_stats_lifetime ON app_trivia_stats(lifetime_points DESC,user_id);
CREATE INDEX app_trivia_stats_weekly ON app_trivia_stats(weekly_points DESC,user_id);
