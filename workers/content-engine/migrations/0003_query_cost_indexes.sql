-- Measured local scans: child updates lacked reverse indexes; claims sorted all due jobs.
CREATE INDEX story_entities_story ON story_entities(story_id,entity_key);
CREATE INDEX video_teams_video ON film_room_video_teams(video_id,team_id);
CREATE INDEX stories_team_page ON canonical_stories(team_id,publication_state,meaningful_update_at DESC,id DESC);
CREATE INDEX sources_national ON content_sources(league_wide,id);
CREATE INDEX jobs_exhausted ON ingestion_jobs(owner_epoch,status,available_at,lease_until,id) WHERE attempts>=max_attempts;
