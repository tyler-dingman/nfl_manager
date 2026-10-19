-- Public team communities are separate from private game_day/crew memberships.
CREATE TABLE IF NOT EXISTS app_huddle_messages (
 id TEXT PRIMARY KEY NOT NULL, room text NOT NULL, user_id TEXT NOT NULL REFERENCES app_users(id),
 body text NOT NULL CHECK (length(body)<=1000), play_id text, media TEXT CHECK(media IS NULL OR json_valid(media)), reply_to TEXT REFERENCES app_huddle_messages(id),
 created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000), updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
 removed INTEGER NOT NULL DEFAULT 0, client_id TEXT NOT NULL,
 UNIQUE(user_id,client_id)
);
CREATE INDEX IF NOT EXISTS app_huddle_history ON app_huddle_messages(room,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS app_huddle_updates ON app_huddle_messages(room,updated_at,id);
CREATE TABLE IF NOT EXISTS app_huddle_reactions (
 message_id TEXT REFERENCES app_huddle_messages(id) ON DELETE CASCADE,user_id TEXT REFERENCES app_users(id),
 PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS app_huddle_user_filters (
 user_id TEXT REFERENCES app_users(id), target_id TEXT REFERENCES app_users(id), kind text CHECK(kind IN ('mute','block')),
 PRIMARY KEY(user_id,target_id), CHECK(user_id<>target_id)
);
CREATE TABLE IF NOT EXISTS app_huddle_reports (
 message_id TEXT REFERENCES app_huddle_messages(id), user_id TEXT REFERENCES app_users(id), reason text NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000), PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS app_huddle_enforcement (
 user_id TEXT PRIMARY KEY REFERENCES app_users(id), until_at INTEGER NOT NULL, reason text NOT NULL,
 moderator_id TEXT NOT NULL REFERENCES app_users(id)
);
CREATE TABLE IF NOT EXISTS app_huddle_polls (
 id TEXT PRIMARY KEY NOT NULL,room text NOT NULL,question text NOT NULL, options TEXT NOT NULL,
 closes_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_huddle_poll_room ON app_huddle_polls(room,created_at DESC);
CREATE TABLE IF NOT EXISTS app_huddle_poll_votes (
 poll_id TEXT REFERENCES app_huddle_polls(id), user_id TEXT REFERENCES app_users(id),choice integer NOT NULL CHECK(choice>=0 AND choice<6),
 PRIMARY KEY(poll_id,user_id)
);
CREATE INDEX IF NOT EXISTS app_huddle_sender_rate ON app_huddle_messages(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS app_huddle_reaction_user ON app_huddle_reactions(user_id,message_id);
CREATE INDEX IF NOT EXISTS app_huddle_block_target ON app_huddle_user_filters(target_id) WHERE kind='block';
CREATE INDEX IF NOT EXISTS app_huddle_vote_user ON app_huddle_poll_votes(user_id,poll_id);

CREATE TABLE IF NOT EXISTS app_crews (
  id TEXT PRIMARY KEY NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  team_abbr text NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  photo_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);

CREATE TABLE IF NOT EXISTS app_crew_members (
  id TEXT PRIMARY KEY NOT NULL,
  crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','MEMBER')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','LEFT','REMOVED')),
  joined_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  UNIQUE(crew_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS app_crew_members_one_active_crew_idx ON app_crew_members(user_id)
  WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS app_crew_members_crew_idx ON app_crew_members(crew_id,status);

CREATE TABLE IF NOT EXISTS app_crew_invites (
  id TEXT PRIMARY KEY NOT NULL,
  crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,
  inviter_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  invitee_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  recipient_hash text,
  recipient_hint text,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('IN_APP','SMS','EMAIL','SHARE_LINK')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  delivery_state text NOT NULL DEFAULT 'PENDING' CHECK (delivery_state IN ('PENDING','SENT','FAILED','NOT_CONFIGURED','DELIVERED')),
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  last_sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_crew_invites_crew_idx ON app_crew_invites(crew_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS app_crew_invites_pending_recipient_idx ON app_crew_invites(crew_id,recipient_hash)
  WHERE status='PENDING' AND recipient_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_crew_activity (
  id TEXT PRIMARY KEY NOT NULL,
  crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  type text NOT NULL,
  content_id text,
  content_type text,
  href text,
  message varchar(120),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_crew_activity_feed_idx ON app_crew_activity(crew_id,created_at DESC);

CREATE TABLE IF NOT EXISTS app_crew_reactions (
  activity_id TEXT NOT NULL REFERENCES app_crew_activity(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('FIRE','LAUGH','EYES','LIKE')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  PRIMARY KEY(activity_id,user_id,reaction)
);

CREATE TABLE IF NOT EXISTS app_crew_shares (
  id TEXT PRIMARY KEY NOT NULL,
  crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('CREW','TARGETED')),
  content_id text NOT NULL,
  content_type text NOT NULL,
  href text NOT NULL,
  title varchar(180) NOT NULL,
  message varchar(120),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_crew_shares_crew_idx ON app_crew_shares(crew_id,created_at DESC);
CREATE INDEX IF NOT EXISTS app_crew_shares_sender_idx ON app_crew_shares(sender_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS app_crew_share_recipients (
  share_id TEXT NOT NULL REFERENCES app_crew_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  PRIMARY KEY(share_id,user_id)
);
CREATE INDEX IF NOT EXISTS app_crew_share_recipients_user_idx
  ON app_crew_share_recipients(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS app_game_day_rooms(id TEXT PRIMARY KEY NOT NULL,game_id text NOT NULL,team_id text NOT NULL,host_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,name text NOT NULL,join_code varchar(8) NOT NULL UNIQUE,invite_token_hash text NOT NULL UNIQUE,privacy text NOT NULL DEFAULT 'PRIVATE',status text NOT NULL DEFAULT 'TAILGATE',kickoff_at INTEGER NOT NULL,game_state TEXT NOT NULL CHECK(json_valid(game_state)),version INTEGER NOT NULL DEFAULT 0,muted INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),archived_at INTEGER);
CREATE TABLE IF NOT EXISTS app_game_day_room_members(room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,role text NOT NULL DEFAULT 'MEMBER',presence text NOT NULL DEFAULT 'HERE',joined_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),last_seen_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),muted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_id,user_id));
CREATE TABLE IF NOT EXISTS app_game_day_activity(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,kind text NOT NULL,user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,body text NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000));
CREATE INDEX IF NOT EXISTS app_game_day_activity_room_time_idx ON app_game_day_activity(room_id,created_at);
CREATE TABLE IF NOT EXISTS app_game_day_reactions(activity_id TEXT NOT NULL REFERENCES app_game_day_activity(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,reaction text NOT NULL,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),PRIMARY KEY(activity_id,user_id,reaction));
CREATE TABLE IF NOT EXISTS app_game_day_predictions(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,kind text NOT NULL,prompt text NOT NULL,selection text NOT NULL,drive_number int,locked_at INTEGER,settled_at INTEGER,correct INTEGER,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),UNIQUE(room_id,user_id,kind,prompt,drive_number));
CREATE TABLE IF NOT EXISTS app_game_day_events(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,event_type text NOT NULL,team_id text,headline text NOT NULL,detail text,importance int NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000));

CREATE TABLE app_crew_media(id TEXT PRIMARY KEY NOT NULL,crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,uploader_user_id TEXT NOT NULL REFERENCES app_users(id),mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),object_hash TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 2097152),created_at INTEGER NOT NULL);
CREATE INDEX app_crew_media_owner ON app_crew_media(crew_id,uploader_user_id);
CREATE TABLE app_crew_comments(id TEXT PRIMARY KEY NOT NULL,activity_id TEXT NOT NULL REFERENCES app_crew_activity(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id),message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),created_at INTEGER NOT NULL);
CREATE INDEX app_crew_comments_activity ON app_crew_comments(activity_id,created_at,id);
CREATE TABLE app_fan_pulse_reactions(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),content_id TEXT NOT NULL,team_id TEXT NOT NULL,reaction_type TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(user_id,content_id));
CREATE INDEX app_fan_pulse_content ON app_fan_pulse_reactions(content_id,reaction_type);
CREATE TABLE app_social_notification_outbox(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),object_hash TEXT NOT NULL,status TEXT NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,lease_nonce TEXT,attempts INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,error TEXT);
CREATE INDEX app_social_notification_ready ON app_social_notification_outbox(status,created_at,id);
