-- On-demand test generation bookkeeping only. No odds or ingestion changes.
CREATE TABLE IF NOT EXISTS fanduel_transfer_jobs (
 id uuid PRIMARY KEY,
 actor text NOT NULL,
 fingerprint text NOT NULL,
 region text NOT NULL,
 legs jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('submitting','pending','complete','failed')),
 request_id text,
 url text,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 next_poll_at timestamptz NOT NULL DEFAULT now(),
 poll_count integer NOT NULL DEFAULT 0,
 api_calls integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS fanduel_transfer_actor_time ON fanduel_transfer_jobs(actor,created_at);
CREATE INDEX IF NOT EXISTS fanduel_transfer_active ON fanduel_transfer_jobs(status,expires_at);
