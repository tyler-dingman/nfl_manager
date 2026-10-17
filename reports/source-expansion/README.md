# Reproducing this local review

The committed snapshots describe the capture timestamp, not current production state. No credentials are needed. Never load an application `.env` or run source watcher/seed/ingest scripts for this review.

`existing.json` is the pre-change catalog snapshot from base `5e1a6ec5`: 37 general, 120 monitoring and 179 video records. Keep it frozen for the before/after comparison. `reporters.json` contains factual directory references only; activity and reliability remain unverified. `manual-candidates.json` lists additional named public outlets. No copied publisher article bodies are stored.

To refresh public HTTP/feed observations deliberately, run from the isolated worktree:

```sh
python3 scripts/research-nfl-sources.py discover
python3 scripts/research-nfl-sources.py probe
python3 scripts/research-nfl-sources.py feeds
python3 scripts/research-nfl-sources.py extras
python3 scripts/research-nfl-sources.py feeds
python3 scripts/build-nfl-source-research.py
node --import tsx scripts/benchmark-nfl-source-expansion.ts
python3 scripts/report-nfl-source-research.py
```

Network checks are opt-in, bounded, use the system trust store and public publisher pages/advertised feeds only, and stop on access errors. They never follow X links, authenticate, subscribe, write to application databases, activate sources, generate editorial copy or publish anything. Review newly discovered URLs before rerunning. The research parser is for metadata discovery; runtime RSS/Atom behavior is covered by separate tests.

Offline validation:

```sh
node --import tsx --test src/data/sources/research/research.test.ts src/features/story-engine/*.test.ts src/features/monitoring/*.test.ts src/server/story-engine/*.test.ts src/data/sources/video/*.test.ts src/server/film-room/*.test.ts src/server/content-automation/*.test.ts scripts/content-ingestion-request.test.mjs
./node_modules/.bin/tsc --noEmit --incremental false
node --import tsx scripts/benchmark-nfl-source-expansion.ts
python3 scripts/validate-source-sync-local.py
```

The last command requires local PostgreSQL binaries. It creates a disposable cluster with TCP disabled and an isolated Unix socket, validates actual captured upsert statements against the original migration table, then stops/removes the synthetic cluster. It explicitly excludes application DB settings and never uses `DATABASE_URL`. Counts are logical PostgreSQL row mutations, not physical WAL or measured D1 writes.

`tests.txt` contains the final relevant suite; `baseline-test-failures.txt` reproduces stale test expectations on the untouched base. `release-gates.json` independently records the unmet quality/coverage/production requirements. Green code tests do not change those failed gates. The benchmark measures local Node wall time, not Worker CPU.
