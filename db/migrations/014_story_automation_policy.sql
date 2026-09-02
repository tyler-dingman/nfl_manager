BEGIN;
CREATE TABLE IF NOT EXISTS story_publication_decisions (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  story_version integer NOT NULL,
  action text NOT NULL CHECK(action IN ('AUTO_PUBLISH','REVIEW_REQUIRED','DO_NOT_PUBLISH')),
  reason text NOT NULL,
  confidence integer NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,story_version)
);
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedupe_idx ON notification_events(dedupe_key) WHERE dedupe_key IS NOT NULL;
ALTER TABLE story_editorial_overrides DROP CONSTRAINT IF EXISTS story_editorial_overrides_action_check;
ALTER TABLE story_editorial_overrides ADD CONSTRAINT story_editorial_overrides_action_check CHECK(action IN ('PIN','PROMOTE','EXCLUDE','HIDE','FORCE_PUBLISH','FORCE_REVIEW'));
COMMIT;
