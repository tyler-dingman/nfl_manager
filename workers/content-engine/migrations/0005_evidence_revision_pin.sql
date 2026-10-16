-- New evidence pins its exact source revision. Existing NULLs remain explicitly unproven.
ALTER TABLE story_evidence ADD COLUMN candidate_revision INTEGER CHECK(candidate_revision IS NULL OR candidate_revision>0);
