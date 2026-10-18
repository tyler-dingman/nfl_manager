-- Keep user-controlled JSON separate from server-owned private object references.
-- Existing metadata remains literal and unchanged; no blob or row is deleted.
ALTER TABLE app_saved_content ADD COLUMN metadata_hash TEXT;
