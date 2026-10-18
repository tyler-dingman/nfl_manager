-- A bounded scan of eligible legacy payloads; no existing row is changed here.
CREATE INDEX app_saved_metadata_pending ON app_saved_content(id)
WHERE metadata_hash IS NULL AND length(CAST(metadata_json AS BLOB))>512;
