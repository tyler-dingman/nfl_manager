BEGIN;

ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS source_item_count integer NOT NULL DEFAULT 1;
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS publisher_count integer NOT NULL DEFAULT 1;
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS independent_source_count integer NOT NULL DEFAULT 1;
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS hot_read_qualified_at timestamptz;
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS hot_read_until timestamptz;
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS cluster_reason text;

WITH counts AS (
  SELECT e.story_id,
    count(*)::int AS source_items,
    count(DISTINCT lower(regexp_replace(s.name, '\\s+(rss|web|x|youtube)$', '', 'i')))::int AS publishers,
    count(DISTINCT lower(regexp_replace(s.name, '\\s+(rss|web|x|youtube)$', '', 'i')))
      FILTER (WHERE s.polling_tier <> 'C')::int AS independent_sources
  FROM story_evidence e
  JOIN content_sources s ON s.id=e.source_id
  GROUP BY e.story_id
)
UPDATE canonical_stories story SET
  source_item_count=counts.source_items,
  publisher_count=counts.publishers,
  independent_source_count=counts.independent_sources
FROM counts WHERE counts.story_id=story.id;

COMMIT;
