BEGIN;
-- Additive only. The original simulation and all existing IDs remain intact.
CREATE TABLE IF NOT EXISTS front_office_reference_bundles (
  hash text PRIMARY KEY,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  entities jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS front_office_durable_state (
  user_id uuid NOT NULL,
  save_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  migration_status text NOT NULL CHECK (migration_status IN
    ('LEGACY_COMPLETE','LEGACY_PARTIAL','RECONCILIATION_REQUIRED','MIGRATED','MIGRATION_FAILED')),
  reference_hash text REFERENCES front_office_reference_bundles(hash),
  state_data jsonb,
  state_checksum text,
  legacy_record jsonb,
  recovery_candidate jsonb,
  recovery_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,save_id),
  FOREIGN KEY(user_id,save_id) REFERENCES user_front_office_saves(user_id,save_id) ON DELETE CASCADE,
  CHECK (migration_status <> 'MIGRATED' OR (state_data IS NOT NULL AND reference_hash IS NOT NULL AND state_checksum IS NOT NULL))
);
INSERT INTO front_office_durable_state(user_id,save_id,migration_status,legacy_record,recovery_report)
SELECT user_id,save_id,'LEGACY_PARTIAL',to_jsonb(s),
  '{"reason":"Legacy simulation does not prove complete mutable franchise recovery."}'::jsonb
FROM user_front_office_saves s ON CONFLICT DO NOTHING;
-- Retain every submitted recovery artifact, including incomplete/superseded candidates.
CREATE TABLE IF NOT EXISTS front_office_recovery_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  save_id text NOT NULL,
  candidate jsonb NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,save_id) REFERENCES user_front_office_saves(user_id,save_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS front_office_command_receipts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_id text NOT NULL CHECK(length(command_id) BETWEEN 8 AND 160),
  save_id text NOT NULL,
  request_hash text NOT NULL,
  result_version integer NOT NULL,
  response_status integer NOT NULL,
  response_body bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,command_id),
  FOREIGN KEY(user_id,save_id) REFERENCES user_front_office_saves(user_id,save_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS front_office_receipts_save_idx ON front_office_command_receipts(user_id,save_id,result_version);
CREATE INDEX IF NOT EXISTS front_office_saves_latest_idx ON user_front_office_saves(user_id,team_abbr,updated_at DESC,save_id);
COMMIT;
