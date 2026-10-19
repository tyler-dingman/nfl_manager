-- LOCAL CANDIDATE SCHEMA. See ownership.json blockers before activation.
CREATE TABLE app_users(id TEXT PRIMARY KEY,display_name TEXT,first_name TEXT,last_name TEXT,primary_email TEXT COLLATE NOCASE UNIQUE,email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)),avatar_url TEXT,status TEXT NOT NULL CHECK(status IN ('ACTIVE','PENDING','SUSPENDED','DELETED')),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_login_at INTEGER, is_guest INTEGER NOT NULL DEFAULT 0);
CREATE TABLE app_credentials(user_id TEXT PRIMARY KEY REFERENCES app_users(id),password_hash TEXT NOT NULL,failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until INTEGER,password_changed_at INTEGER);
CREATE TABLE app_identities(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),provider TEXT NOT NULL,provider_subject TEXT NOT NULL,provider_email TEXT,provider_email_verified INTEGER NOT NULL DEFAULT 0,provider_display_name TEXT,created_at INTEGER NOT NULL,last_used_at INTEGER,UNIQUE(provider,provider_subject));
CREATE INDEX app_identity_owner ON app_identities(user_id);
CREATE TABLE app_devices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),name TEXT,last_seen_at INTEGER, platform TEXT, app_version TEXT, os_version TEXT, installation_id TEXT, disabled_at INTEGER);
CREATE TABLE app_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),device_id TEXT REFERENCES app_devices(id),refresh_token_hash TEXT NOT NULL UNIQUE,token_family_id TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,replaced_by_session_id TEXT,created_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL,ip_metadata TEXT,user_agent_metadata TEXT);
CREATE INDEX app_session_owner ON app_sessions(user_id);
CREATE INDEX app_session_family ON app_sessions(token_family_id);
CREATE TABLE app_tokens(id TEXT PRIMARY KEY,user_id TEXT REFERENCES app_users(id),type TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,consumed_at INTEGER,consume_nonce TEXT);
CREATE INDEX app_token_owner ON app_tokens(user_id,type);
CREATE TABLE app_settings(user_id TEXT PRIMARY KEY REFERENCES app_users(id),profile_json TEXT NOT NULL DEFAULT '{}',preferences_json TEXT NOT NULL DEFAULT '{}',updated_at INTEGER NOT NULL);
CREATE TABLE app_saved_content(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),content_type TEXT NOT NULL,content_id TEXT NOT NULL,title TEXT NOT NULL,href TEXT,image_url TEXT,metadata_json TEXT NOT NULL,created_at INTEGER NOT NULL, metadata_hash TEXT,UNIQUE(user_id,content_type,content_id));
CREATE TABLE app_assertions(nonce TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE app_heads(owner_id TEXT NOT NULL REFERENCES app_users(id),kind TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,object_hash TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(owner_id,kind,id)) WITHOUT ROWID;
CREATE TABLE app_receipts(owner_id TEXT NOT NULL REFERENCES app_users(id),command_id TEXT NOT NULL,request_hash TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,object_hash TEXT NOT NULL,PRIMARY KEY(owner_id,command_id)) WITHOUT ROWID;
CREATE TABLE app_mail(id TEXT PRIMARY KEY,user_id TEXT REFERENCES app_users(id),purpose TEXT NOT NULL,dedupe_key TEXT NOT NULL UNIQUE,object_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('READY','SENDING','SENT','FAILED','UNCERTAIN','SUPPRESSED')),next_at INTEGER NOT NULL,lease_nonce TEXT,attempts INTEGER NOT NULL DEFAULT 0,first_attempt_at INTEGER,provider_id TEXT,last_error TEXT);
CREATE INDEX app_mail_due ON app_mail(status,next_at);
CREATE TABLE app_subscriptions(user_id TEXT NOT NULL REFERENCES app_users(id),topic TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,topic)) WITHOUT ROWID;
CREATE TABLE app_team_follows(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),team_id TEXT NOT NULL,is_primary INTEGER NOT NULL DEFAULT 0,notification_level TEXT NOT NULL DEFAULT 'DEFAULT',created_at INTEGER NOT NULL,UNIQUE(user_id,team_id));
CREATE UNIQUE INDEX app_one_primary_team ON app_team_follows(user_id) WHERE is_primary=1;
CREATE TABLE app_security_audit(id TEXT PRIMARY KEY,user_id TEXT REFERENCES app_users(id),event_type TEXT NOT NULL,ip_hash TEXT,user_agent_family TEXT,metadata_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX app_security_audit_owner ON app_security_audit(user_id,created_at DESC);
CREATE INDEX app_token_expiry ON app_tokens(expires_at,id) WHERE consumed_at IS NOT NULL;
CREATE TABLE app_trivia_questions(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,question TEXT NOT NULL,answer_a TEXT NOT NULL,answer_b TEXT NOT NULL,answer_c TEXT NOT NULL,answer_d TEXT NOT NULL,correct_answer TEXT NOT NULL CHECK(correct_answer IN ('A','B','C','D')),explanation TEXT NOT NULL,category TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1, source_note TEXT, season_reference INTEGER, era TEXT, question_type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE', created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0);
CREATE INDEX app_trivia_pool ON app_trivia_questions(team_id,active,verified,id);
CREATE TABLE app_trivia_daily(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,question_date TEXT NOT NULL,question_id TEXT NOT NULL REFERENCES app_trivia_questions(id),UNIQUE(team_id,question_date));
CREATE TABLE app_trivia_views(user_id TEXT NOT NULL REFERENCES app_users(id),daily_id TEXT NOT NULL REFERENCES app_trivia_daily(id),presented_at INTEGER NOT NULL,PRIMARY KEY(user_id,daily_id)) WITHOUT ROWID;
CREATE TABLE app_trivia_answers(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),daily_id TEXT NOT NULL REFERENCES app_trivia_daily(id),question_id TEXT NOT NULL REFERENCES app_trivia_questions(id),selected_answer TEXT NOT NULL,correct INTEGER NOT NULL,response_time_ms INTEGER NOT NULL,points_awarded INTEGER NOT NULL,answered_at INTEGER NOT NULL,UNIQUE(user_id,daily_id));
CREATE TABLE app_trivia_stats(user_id TEXT PRIMARY KEY REFERENCES app_users(id),lifetime_points INTEGER NOT NULL DEFAULT 0,weekly_points INTEGER NOT NULL DEFAULT 0,questions_answered INTEGER NOT NULL DEFAULT 0,correct_answers INTEGER NOT NULL DEFAULT 0,games_played INTEGER NOT NULL DEFAULT 0,current_streak INTEGER NOT NULL DEFAULT 0,best_streak INTEGER NOT NULL DEFAULT 0, response_time_total_ms INTEGER NOT NULL DEFAULT 0, best_game_score INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, ties INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE app_reward_accounts(user_id TEXT PRIMARY KEY REFERENCES app_users(id),current_drive_yards INTEGER NOT NULL DEFAULT 0,touchdowns INTEGER NOT NULL DEFAULT 0,lifetime_yards INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE app_reward_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),event_type TEXT NOT NULL,yards INTEGER NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,idempotency_key));
CREATE INDEX app_reward_history ON app_reward_events(user_id,created_at DESC,id);
CREATE TABLE app_reward_definitions(id TEXT PRIMARY KEY,type TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,threshold_yards INTEGER NOT NULL,discount_percent INTEGER,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE app_user_rewards(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),reward_definition_id TEXT NOT NULL REFERENCES app_reward_definitions(id),status TEXT NOT NULL DEFAULT 'AVAILABLE',unlocked_at INTEGER NOT NULL,claimed_at INTEGER,redeemed_at INTEGER,coupon_code TEXT UNIQUE,UNIQUE(user_id,reward_definition_id));
CREATE TABLE app_reward_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),reward_id TEXT NOT NULL REFERENCES app_reward_definitions(id),created_at INTEGER NOT NULL,UNIQUE(user_id,reward_id));
CREATE TABLE app_franchise_heads(user_id TEXT NOT NULL REFERENCES app_users(id),save_id TEXT NOT NULL,team_abbr TEXT NOT NULL,season INTEGER NOT NULL,phase TEXT NOT NULL,version INTEGER NOT NULL,object_hash TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,PRIMARY KEY(user_id,save_id)) WITHOUT ROWID;
CREATE INDEX app_franchise_latest ON app_franchise_heads(user_id,team_abbr,updated_at DESC,save_id);
CREATE TABLE app_franchise_commands(user_id TEXT NOT NULL REFERENCES app_users(id),command_id TEXT NOT NULL,save_id TEXT NOT NULL,request_hash TEXT NOT NULL,object_hash TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(user_id,command_id),FOREIGN KEY(user_id,save_id) REFERENCES app_franchise_heads(user_id,save_id)) WITHOUT ROWID;
CREATE TABLE app_franchise_routes(user_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,save_id TEXT NOT NULL,PRIMARY KEY(user_id,kind,id),FOREIGN KEY(user_id,save_id) REFERENCES app_franchise_heads(user_id,save_id)) WITHOUT ROWID;
CREATE INDEX app_reward_rank ON app_reward_accounts(lifetime_yards DESC,user_id);
CREATE TABLE app_briefing_mail_jobs(id TEXT PRIMARY KEY,object_hash TEXT NOT NULL,after_user TEXT NOT NULL DEFAULT '',status TEXT NOT NULL CHECK(status IN('READY','RUNNING','DONE')),lease_nonce TEXT,lease_until INTEGER NOT NULL DEFAULT 0);
CREATE INDEX app_saved_metadata_pending ON app_saved_content(id)
WHERE metadata_hash IS NULL AND length(CAST(metadata_json AS BLOB))>512;
CREATE UNIQUE INDEX app_device_installation ON app_devices(user_id,installation_id) WHERE installation_id IS NOT NULL;
CREATE TABLE app_push_tokens(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),device_id TEXT NOT NULL REFERENCES app_devices(id),provider TEXT NOT NULL,token_hash TEXT NOT NULL,token_ciphertext TEXT NOT NULL,created_at INTEGER NOT NULL,last_validated_at INTEGER,invalidated_at INTEGER, web_endpoint_hash TEXT,UNIQUE(user_id,device_id,provider,token_hash));
CREATE INDEX app_push_owner ON app_push_tokens(user_id,invalidated_at);
CREATE TABLE app_notification_preferences(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),topic_type TEXT,topic_id TEXT,category TEXT NOT NULL,channel TEXT NOT NULL,enabled INTEGER NOT NULL,minimum_priority TEXT NOT NULL DEFAULT 'NORMAL',delivery_time TEXT,delivery_timezone TEXT,created_at INTEGER NOT NULL,UNIQUE(user_id,topic_type,topic_id,category,channel));
CREATE INDEX app_notification_preference_owner ON app_notification_preferences(user_id,created_at DESC);
CREATE TABLE app_phone_numbers(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),phone_number TEXT NOT NULL,is_verified INTEGER NOT NULL DEFAULT 0,verified_at INTEGER,removed_at INTEGER,UNIQUE(user_id,phone_number));
CREATE TABLE app_consents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),channel TEXT NOT NULL,consent_type TEXT NOT NULL,policy_version TEXT NOT NULL,granted_at INTEGER NOT NULL,revoked_at INTEGER,source TEXT NOT NULL,metadata_hash TEXT);
CREATE INDEX app_consent_owner ON app_consents(user_id,granted_at DESC);
CREATE TABLE app_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),dedupe_key TEXT,team_abbr TEXT,object_hash TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER,seen_at INTEGER,dismissed_at INTEGER,expires_at INTEGER,delivery_state TEXT NOT NULL,push_sent_at INTEGER,UNIQUE(user_id,dedupe_key));
CREATE INDEX app_notification_inbox ON app_notifications(user_id,created_at DESC,id) WHERE dismissed_at IS NULL;
CREATE TABLE app_notification_deliveries(id TEXT PRIMARY KEY,notification_id TEXT NOT NULL REFERENCES app_notifications(id),channel TEXT NOT NULL,device_id TEXT REFERENCES app_devices(id),provider TEXT NOT NULL,state TEXT NOT NULL,attempted_at INTEGER NOT NULL,delivered_at INTEGER,failed_at INTEGER,failure_code TEXT);
CREATE TABLE app_editorial_overrides(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,story_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),object_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX app_editorial_overrides_team ON app_editorial_overrides(team_id,created_at,id);
CREATE TABLE app_huddle_messages (
 id TEXT PRIMARY KEY NOT NULL, room text NOT NULL, user_id TEXT NOT NULL REFERENCES app_users(id),
 body text NOT NULL CHECK (length(body)<=1000), play_id text, media TEXT CHECK(media IS NULL OR json_valid(media)), reply_to TEXT REFERENCES app_huddle_messages(id),
 created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000), updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
 removed INTEGER NOT NULL DEFAULT 0, client_id TEXT NOT NULL,
 UNIQUE(user_id,client_id)
);
CREATE INDEX app_huddle_history ON app_huddle_messages(room,created_at DESC,id DESC);
CREATE INDEX app_huddle_updates ON app_huddle_messages(room,updated_at,id);
CREATE TABLE app_huddle_reactions (
 message_id TEXT REFERENCES app_huddle_messages(id) ON DELETE CASCADE,user_id TEXT REFERENCES app_users(id),
 PRIMARY KEY(message_id,user_id)
);
CREATE TABLE app_huddle_user_filters (
 user_id TEXT REFERENCES app_users(id), target_id TEXT REFERENCES app_users(id), kind text CHECK(kind IN ('mute','block')),
 PRIMARY KEY(user_id,target_id), CHECK(user_id<>target_id)
);
CREATE TABLE app_huddle_reports (
 message_id TEXT REFERENCES app_huddle_messages(id), user_id TEXT REFERENCES app_users(id), reason text NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000), PRIMARY KEY(message_id,user_id)
);
CREATE TABLE app_huddle_enforcement (
 user_id TEXT PRIMARY KEY REFERENCES app_users(id), until_at INTEGER NOT NULL, reason text NOT NULL,
 moderator_id TEXT NOT NULL REFERENCES app_users(id)
);
CREATE TABLE app_huddle_polls (
 id TEXT PRIMARY KEY NOT NULL,room text NOT NULL,question text NOT NULL, options TEXT NOT NULL,
 closes_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX app_huddle_poll_room ON app_huddle_polls(room,created_at DESC);
CREATE TABLE app_huddle_poll_votes (
 poll_id TEXT REFERENCES app_huddle_polls(id), user_id TEXT REFERENCES app_users(id),choice integer NOT NULL CHECK(choice>=0 AND choice<6),
 PRIMARY KEY(poll_id,user_id)
);
CREATE INDEX app_huddle_sender_rate ON app_huddle_messages(user_id,created_at DESC);
CREATE INDEX app_huddle_reaction_user ON app_huddle_reactions(user_id,message_id);
CREATE INDEX app_huddle_block_target ON app_huddle_user_filters(target_id) WHERE kind='block';
CREATE INDEX app_huddle_vote_user ON app_huddle_poll_votes(user_id,poll_id);
CREATE TABLE app_crews (
  id TEXT PRIMARY KEY NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  team_abbr text NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  photo_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_crew_members (
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
CREATE UNIQUE INDEX app_crew_members_one_active_crew_idx ON app_crew_members(user_id)
  WHERE status='ACTIVE';
CREATE INDEX app_crew_members_crew_idx ON app_crew_members(crew_id,status);
CREATE TABLE app_crew_invites (
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
CREATE INDEX app_crew_invites_crew_idx ON app_crew_invites(crew_id,status,created_at DESC);
CREATE UNIQUE INDEX app_crew_invites_pending_recipient_idx ON app_crew_invites(crew_id,recipient_hash)
  WHERE status='PENDING' AND recipient_hash IS NOT NULL;
CREATE TABLE app_crew_activity (
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
CREATE INDEX app_crew_activity_feed_idx ON app_crew_activity(crew_id,created_at DESC);
CREATE TABLE app_crew_reactions (
  activity_id TEXT NOT NULL REFERENCES app_crew_activity(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('FIRE','LAUGH','EYES','LIKE')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  PRIMARY KEY(activity_id,user_id,reaction)
);
CREATE TABLE app_crew_shares (
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
CREATE INDEX app_crew_shares_crew_idx ON app_crew_shares(crew_id,created_at DESC);
CREATE INDEX app_crew_shares_sender_idx ON app_crew_shares(sender_user_id,created_at DESC);
CREATE TABLE app_crew_share_recipients (
  share_id TEXT NOT NULL REFERENCES app_crew_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  PRIMARY KEY(share_id,user_id)
);
CREATE INDEX app_crew_share_recipients_user_idx
  ON app_crew_share_recipients(user_id,created_at DESC);
CREATE TABLE app_game_day_rooms(id TEXT PRIMARY KEY NOT NULL,game_id text NOT NULL,team_id text NOT NULL,host_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,name text NOT NULL,join_code varchar(8) NOT NULL UNIQUE,invite_token_hash text NOT NULL UNIQUE,privacy text NOT NULL DEFAULT 'PRIVATE',status text NOT NULL DEFAULT 'TAILGATE',kickoff_at INTEGER NOT NULL,game_state TEXT NOT NULL CHECK(json_valid(game_state)),version INTEGER NOT NULL DEFAULT 0,muted INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),archived_at INTEGER);
CREATE TABLE app_game_day_room_members(room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,role text NOT NULL DEFAULT 'MEMBER',presence text NOT NULL DEFAULT 'HERE',joined_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),last_seen_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),muted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_id,user_id));
CREATE TABLE app_game_day_activity(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,kind text NOT NULL,user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,body text NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000));
CREATE INDEX app_game_day_activity_room_time_idx ON app_game_day_activity(room_id,created_at);
CREATE TABLE app_game_day_reactions(activity_id TEXT NOT NULL REFERENCES app_game_day_activity(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,reaction text NOT NULL,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),PRIMARY KEY(activity_id,user_id,reaction));
CREATE TABLE app_game_day_predictions(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,kind text NOT NULL,prompt text NOT NULL,selection text NOT NULL,drive_number int,locked_at INTEGER,settled_at INTEGER,correct INTEGER,created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),UNIQUE(room_id,user_id,kind,prompt,drive_number));
CREATE TABLE app_game_day_events(id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES app_game_day_rooms(id) ON DELETE CASCADE,event_type text NOT NULL,team_id text,headline text NOT NULL,detail text,importance int NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000));
CREATE TABLE app_crew_media(id TEXT PRIMARY KEY NOT NULL,crew_id TEXT NOT NULL REFERENCES app_crews(id) ON DELETE CASCADE,uploader_user_id TEXT NOT NULL REFERENCES app_users(id),mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),object_hash TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 2097152),created_at INTEGER NOT NULL);
CREATE INDEX app_crew_media_owner ON app_crew_media(crew_id,uploader_user_id);
CREATE TABLE app_crew_comments(id TEXT PRIMARY KEY NOT NULL,activity_id TEXT NOT NULL REFERENCES app_crew_activity(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES app_users(id),message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),created_at INTEGER NOT NULL);
CREATE INDEX app_crew_comments_activity ON app_crew_comments(activity_id,created_at,id);
CREATE TABLE app_fan_pulse_reactions(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),content_id TEXT NOT NULL,team_id TEXT NOT NULL,reaction_type TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(user_id,content_id));
CREATE INDEX app_fan_pulse_content ON app_fan_pulse_reactions(content_id,reaction_type);
CREATE TABLE app_social_notification_outbox(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),object_hash TEXT NOT NULL,status TEXT NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,lease_nonce TEXT,attempts INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,error TEXT);
CREATE INDEX app_social_notification_ready ON app_social_notification_outbox(status,created_at,id);
CREATE TABLE app_trivia_games (
  id TEXT PRIMARY KEY NOT NULL,
  mode text NOT NULL CHECK (mode IN ('QUICK', 'FULL', 'FRIEND_CHALLENGE', 'GROUP')),
  team_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('WAITING', 'ACTIVE', 'COMPLETED', 'EXPIRED')),
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  question_count INTEGER NOT NULL DEFAULT 10 CHECK(question_count IN(5,10)),timer_seconds INTEGER NOT NULL DEFAULT 15 CHECK(timer_seconds BETWEEN 5 AND 60),version INTEGER NOT NULL DEFAULT 0,started_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_trivia_game_questions (
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES app_trivia_questions(id),
  presented_at INTEGER,
  position integer NOT NULL CHECK (position >= 1),
  PRIMARY KEY (game_id, position),
  UNIQUE (game_id, question_id)
);
CREATE TABLE app_trivia_game_participants (
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  participant_status TEXT NOT NULL DEFAULT 'JOINED' CHECK(participant_status IN('INVITED','JOINED')),wrong_answers INTEGER NOT NULL DEFAULT 0,timeouts INTEGER NOT NULL DEFAULT 0,response_time_total_ms INTEGER NOT NULL DEFAULT 0,best_question_score INTEGER NOT NULL DEFAULT 0,score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  completed_at INTEGER,
  PRIMARY KEY (game_id, user_id)
);
CREATE TABLE app_trivia_friendships (
  requester_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  addressee_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  accepted_at INTEGER,
  PRIMARY KEY (requester_user_id, addressee_user_id),
  CHECK (requester_user_id <> addressee_user_id)
);
CREATE TABLE app_trivia_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenger_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  challenged_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES app_trivia_games(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'EXPIRED')),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  expires_at INTEGER NOT NULL
);
CREATE TABLE app_trivia_groups (
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
CREATE UNIQUE INDEX app_web_push_endpoint ON app_push_tokens(web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL;
CREATE TABLE app_web_push_test_limits(user_id TEXT PRIMARY KEY REFERENCES app_users(id),attempted_at INTEGER NOT NULL);
CREATE TABLE app_commerce_products (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_commerce_product_variants (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL REFERENCES app_commerce_products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  city_code text,
  city_name text,
  size text,
  color_label text,
  price_cents integer CHECK (price_cents >= 0),
  image_url text,
  inventory_on_hand integer NOT NULL DEFAULT 0 CHECK (inventory_on_hand >= 0),
  inventory_reserved integer NOT NULL DEFAULT 0 CHECK (inventory_reserved >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  CHECK (inventory_reserved <= inventory_on_hand)
);
CREATE INDEX app_commerce_variants_product_idx ON app_commerce_product_variants(product_id,active);
CREATE TABLE app_commerce_promo_codes (
  code text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('PERCENT','FIXED')),
  value integer NOT NULL CHECK (value > 0),
  active INTEGER NOT NULL DEFAULT 1,
  starts_at INTEGER,
  ends_at INTEGER,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  minimum_subtotal_cents integer,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_commerce_orders (
  id TEXT PRIMARY KEY NOT NULL,
  order_number text NOT NULL UNIQUE,
  user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','PAID','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_status text NOT NULL CHECK (payment_status IN ('PENDING','PAID','DECLINED','FAILED','CANCELED','REFUNDED','PARTIALLY_REFUNDED')),
  fulfillment_status text NOT NULL DEFAULT 'NEW' CHECK (fulfillment_status IN ('NEW','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_provider text NOT NULL,
  payment_reference text,stripe_payment_intent_id TEXT UNIQUE,currency TEXT NOT NULL DEFAULT 'usd',paid_at INTEGER,checkout_attempt_id TEXT UNIQUE,checkout_request_hash TEXT,refunded_total_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_total_cents>=0),inventory_reservation_status TEXT NOT NULL DEFAULT 'HELD' CHECK(inventory_reservation_status IN('HELD','RELEASED','CONSUMED')),stripe_payment_event_created_at INTEGER,payment_attempt_started_at INTEGER,version INTEGER NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL,
  discount_total_cents integer NOT NULL DEFAULT 0,
  shipping_total_cents integer NOT NULL,
  tax_total_cents integer NOT NULL,
  total_cents integer NOT NULL,
  promo_code text,
  shipping_address TEXT NOT NULL,
  shipping_method text NOT NULL,
  carrier text,
  tracking_number text,
  internal_note text,
  shipped_at INTEGER,
  delivered_at INTEGER,
  canceled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX app_commerce_orders_user_idx ON app_commerce_orders(user_id,created_at DESC);
CREATE INDEX app_commerce_orders_status_idx ON app_commerce_orders(fulfillment_status,created_at DESC);
CREATE INDEX app_commerce_orders_email_idx ON app_commerce_orders(lower(email),created_at DESC);
CREATE TABLE app_commerce_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES app_commerce_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES app_commerce_products(id),
  variant_id text NOT NULL REFERENCES app_commerce_product_variants(id),
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_label text NOT NULL,
  image_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX app_commerce_order_items_order_idx ON app_commerce_order_items(order_id);
CREATE TABLE app_commerce_inventory_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  variant_id text NOT NULL REFERENCES app_commerce_product_variants(id),
  admin_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_commerce_stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  order_id TEXT REFERENCES app_commerce_orders(id) ON DELETE SET NULL,
  result text,
  received_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  processed_at INTEGER
);
CREATE TABLE app_commerce_refunds (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT UNIQUE,
  order_id TEXT NOT NULL REFERENCES app_commerce_orders(id) ON DELETE CASCADE,
  stripe_refund_id text UNIQUE,
  stripe_payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('PENDING','REQUIRES_ACTION','SUCCEEDED','FAILED','CANCELED')),
  reason text,
  failure_reason text,
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  stripe_created_at INTEGER,
  stripe_event_created_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_commerce_counters(name TEXT PRIMARY KEY,next_value INTEGER NOT NULL);
CREATE INDEX app_commerce_refunds_order ON app_commerce_refunds(order_id,created_at DESC);
CREATE TABLE app_briefing_push_deliveries(briefing_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),delivery_date TEXT NOT NULL,status TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 1,attempted_at INTEGER NOT NULL,delivered_at INTEGER,last_error TEXT,PRIMARY KEY(user_id,delivery_date));
CREATE TABLE app_sportsbook_transfer_jobs(id TEXT PRIMARY KEY NOT NULL,sportsbook TEXT NOT NULL,actor TEXT NOT NULL,fingerprint TEXT NOT NULL,region TEXT NOT NULL,object_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('submitting','pending','complete','failed')),request_id TEXT,url TEXT,error TEXT,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,next_poll_at INTEGER NOT NULL,poll_count INTEGER NOT NULL DEFAULT 0,api_calls INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 0);
CREATE INDEX app_transfer_actor ON app_sportsbook_transfer_jobs(actor,created_at);
CREATE INDEX app_transfer_active ON app_sportsbook_transfer_jobs(status,expires_at);
CREATE TABLE app_user_content_state(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),content_type TEXT NOT NULL,content_id TEXT NOT NULL,media_version TEXT,first_viewed_at INTEGER,last_viewed_at INTEGER,completed_at INTEGER,progress_seconds REAL,duration_seconds REAL,updated_at INTEGER NOT NULL,UNIQUE(user_id,content_type,content_id));
CREATE INDEX app_content_state_owner ON app_user_content_state(user_id,updated_at DESC);
CREATE TABLE app_user_team_visit_state(user_id TEXT NOT NULL REFERENCES app_users(id),team_id TEXT NOT NULL,last_visited_at INTEGER NOT NULL,last_seen_snapshot_id TEXT,updated_at INTEGER NOT NULL,first_seen_at INTEGER NOT NULL,current_visit_started_at INTEGER NOT NULL,visit_count INTEGER NOT NULL DEFAULT 1,last_caught_up_at INTEGER,last_caught_up_snapshot_id TEXT,caught_up_story_state TEXT NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,team_id));
CREATE TABLE app_user_poll_votes(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),question_id TEXT NOT NULL,option_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,question_id));
CREATE TABLE app_user_predictions(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),prediction_type TEXT NOT NULL,subject_type TEXT NOT NULL,subject_id TEXT NOT NULL,object_hash TEXT NOT NULL,submitted_at INTEGER NOT NULL,locked_at INTEGER,resolved_at INTEGER,result TEXT,score REAL,UNIQUE(user_id,prediction_type,subject_type,subject_id));
CREATE INDEX app_prediction_owner ON app_user_predictions(user_id,submitted_at DESC);
CREATE TABLE app_email_change_requests(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES app_users(id),new_email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,consumed_at INTEGER,created_at INTEGER NOT NULL);
CREATE TABLE app_payload_objects (
 hash TEXT PRIMARY KEY CHECK(length(hash)=64),
 bytes INTEGER NOT NULL CHECK(bytes>=0 AND bytes<=4000000),
 chunks INTEGER NOT NULL CHECK(chunks>=0 AND chunks<=84),
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1))
, inline_data BLOB) WITHOUT ROWID;
CREATE TABLE app_payload_chunks (
 hash TEXT NOT NULL REFERENCES app_payload_objects(hash),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<84),
 body TEXT NOT NULL CHECK(length(body)<=64000), data BLOB,
 PRIMARY KEY(hash,ordinal)
) WITHOUT ROWID;
CREATE TABLE app_payload_capacity (
 id INTEGER PRIMARY KEY CHECK(id=1),
 used_bytes INTEGER NOT NULL CHECK(used_bytes>=0 AND used_bytes<=64000000)
);
CREATE TABLE app_storage_epoch(id INTEGER PRIMARY KEY CHECK(id=1),epoch INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)));
CREATE TABLE app_storage_guards(id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1)) WITHOUT ROWID;
CREATE TABLE app_storage_pins(hash TEXT PRIMARY KEY CHECK(length(hash)=64),reason TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_audit(run_id TEXT NOT NULL,hash TEXT NOT NULL,encoded_bytes INTEGER NOT NULL,deleted_at INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
CREATE TABLE app_storage_gc_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('RUNNING','DONE')),last_hash TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_candidates(run_id TEXT NOT NULL REFERENCES app_storage_gc_plans(id),hash TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
CREATE TABLE app_storage_lifecycle_totals(policy TEXT PRIMARY KEY,removed INTEGER NOT NULL CHECK(removed>=0),last_run_at INTEGER NOT NULL,last_run_id TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_retention_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('PREPARING','RUNNING','DONE')),archive_digest TEXT NOT NULL,archive_path TEXT NOT NULL,last_ordinal INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_retention_items(run_id TEXT NOT NULL REFERENCES app_storage_retention_plans(id),ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,operations_json TEXT NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;
CREATE TABLE app_storage_retention_audit(run_id TEXT NOT NULL,ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,archive_digest TEXT NOT NULL,retired_at INTEGER NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;
