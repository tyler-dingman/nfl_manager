BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS search_documents (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  team_id text,
  result_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text NOT NULL DEFAULT '',
  url text NOT NULL,
  source_name text,
  source_url text,
  published_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  image_url text,
  canonical_story_id uuid,
  content_hash text NOT NULL,
  embedding vector(384),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED,
  active boolean NOT NULL DEFAULT true,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS search_documents_lexical_idx ON search_documents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS search_documents_team_idx ON search_documents(team_id, active, source_updated_at DESC);
CREATE INDEX IF NOT EXISTS search_documents_embedding_idx ON search_documents USING hnsw (embedding vector_cosine_ops);

COMMIT;
