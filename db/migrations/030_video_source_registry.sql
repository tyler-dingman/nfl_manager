BEGIN;

CREATE TABLE IF NOT EXISTS video_source_registry (
  id text PRIMARY KEY,
  name text NOT NULL,
  team_id text,
  category text NOT NULL CHECK (category IN ('official','independent_media','creator','podcast','film','local_media','league_media')),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL CHECK (scope IN ('team','league')),
  multi_team boolean NOT NULL DEFAULT false,
  priority integer NOT NULL CHECK (priority BETWEEN 1 AND 3),
  source_weight numeric(4,3) NOT NULL CHECK (source_weight BETWEEN 0 AND 1),
  youtube_channel_id text,
  youtube_handle text,
  youtube_url text,
  status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','REVIEW_REQUIRED','ERROR')),
  review_reason text,
  last_verified_at timestamptz,
  last_upload_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR (youtube_channel_id IS NOT NULL AND youtube_url IS NOT NULL)),
  CHECK (scope <> 'team' OR team_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS video_source_registry_channel_id_idx
  ON video_source_registry(youtube_channel_id) WHERE youtube_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_source_registry_team_status_idx
  ON video_source_registry(team_id,status);

COMMIT;
