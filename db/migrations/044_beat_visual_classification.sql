-- Presentation metadata only: source story_type and article records remain unchanged.
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS visual_classification jsonb;
