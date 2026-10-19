-- Small objects avoid a chunk directory/read; historical rows remain compatible.
ALTER TABLE app_payload_objects ADD COLUMN inline_data BLOB;
