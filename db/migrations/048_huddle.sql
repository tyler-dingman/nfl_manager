-- Public team communities are separate from private game_day/crew memberships.
CREATE TABLE IF NOT EXISTS huddle_messages (
 id uuid PRIMARY KEY, room text NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000), play_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 removed boolean NOT NULL DEFAULT false, client_id uuid NOT NULL,
 UNIQUE(user_id,client_id)
);
CREATE INDEX IF NOT EXISTS huddle_history ON huddle_messages(room,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS huddle_updates ON huddle_messages(room,updated_at,id);
CREATE TABLE IF NOT EXISTS huddle_reactions (
 message_id uuid REFERENCES huddle_messages(id) ON DELETE CASCADE,user_id uuid REFERENCES users(id),
 PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS huddle_user_filters (
 user_id uuid REFERENCES users(id), target_id uuid REFERENCES users(id), kind text CHECK(kind IN ('mute','block')),
 PRIMARY KEY(user_id,target_id), CHECK(user_id<>target_id)
);
CREATE TABLE IF NOT EXISTS huddle_reports (
 message_id uuid REFERENCES huddle_messages(id), user_id uuid REFERENCES users(id), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS huddle_enforcement (
 user_id uuid PRIMARY KEY REFERENCES users(id), until_at timestamptz NOT NULL, reason text NOT NULL,
 moderator_id uuid NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS huddle_polls (
 id uuid PRIMARY KEY,room text NOT NULL,question text NOT NULL, options jsonb NOT NULL,
 closes_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS huddle_poll_room ON huddle_polls(room,created_at DESC);
CREATE TABLE IF NOT EXISTS huddle_poll_votes (
 poll_id uuid REFERENCES huddle_polls(id), user_id uuid REFERENCES users(id),choice integer NOT NULL CHECK(choice>=0 AND choice<6),
 PRIMARY KEY(poll_id,user_id)
);
CREATE INDEX IF NOT EXISTS huddle_sender_rate ON huddle_messages(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS huddle_reaction_user ON huddle_reactions(user_id,message_id);
CREATE INDEX IF NOT EXISTS huddle_block_target ON huddle_user_filters(target_id) WHERE kind='block';
CREATE INDEX IF NOT EXISTS huddle_vote_user ON huddle_poll_votes(user_id,poll_id);
