BEGIN;

DROP INDEX IF EXISTS user_player_follows_player_idx;
DROP TABLE IF EXISTS user_player_follows;

COMMIT;