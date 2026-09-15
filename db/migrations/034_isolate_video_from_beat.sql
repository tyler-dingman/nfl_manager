BEGIN;

-- Video candidates belong exclusively to Film Room. Quarantine historical
-- stories whose complete evidence set came from YouTube.
UPDATE canonical_stories story
SET publication_state = 'REJECTED', updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM story_evidence evidence
  JOIN content_sources source ON source.id = evidence.source_id
  WHERE evidence.story_id = story.id
    AND (source.source_type = 'YOUTUBE' OR source.metadata->>'platform' = 'YOUTUBE')
)
AND NOT EXISTS (
  SELECT 1
  FROM story_evidence evidence
  JOIN content_sources source ON source.id = evidence.source_id
  WHERE evidence.story_id = story.id
    AND source.source_type <> 'YOUTUBE'
    AND coalesce(source.metadata->>'platform', '') <> 'YOUTUBE'
);

-- Preserve video candidates for Film Room, but retire legacy synthesis jobs.
UPDATE ingestion_jobs job
SET status = 'COMPLETED',
    locked_at = NULL,
    locked_by = NULL,
    last_error = 'Skipped: video candidates are Film Room only.',
    updated_at = now()
WHERE job.job_type = 'CANDIDATE_PROCESS'
  AND job.status IN ('PENDING', 'FAILED', 'RUNNING')
  AND EXISTS (
    SELECT 1
    FROM content_candidates candidate
    JOIN content_sources source ON source.id = candidate.source_id
    WHERE candidate.id = (job.payload->>'candidateId')::uuid
      AND (source.source_type = 'YOUTUBE' OR source.metadata->>'platform' = 'YOUTUBE')
  );

COMMIT;
