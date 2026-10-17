-- Additive opt-in experiment. Original IDs, relationships and bodies remain intact.
CREATE TABLE editorial_blob_packs (
 id INTEGER PRIMARY KEY,
 pack_hash TEXT NOT NULL UNIQUE
);
ALTER TABLE editorial_blobs ADD COLUMN pack_id INTEGER REFERENCES editorial_blob_packs(id);
ALTER TABLE editorial_blobs ADD COLUMN byte_offset INTEGER;
ALTER TABLE editorial_blobs ADD COLUMN encoded_length INTEGER;
