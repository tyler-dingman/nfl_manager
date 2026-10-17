# Phase 2 evidence

This directory contains synthetic local measurements and public-plan projections. It contains no production/account usage export or deployed Worker CPU trace. Start with the three root reports.

Reproduction from the isolated worktree (install the locked root/mobile/Worker dependencies first):

1. `python3 scripts/qualify-phase-two.py` runs all 233 application test files with a minimal environment. Its nonzero result is retained: 17 failures also reproduce on unchanged `f5276dfc`. The checked `full-unit-files.json` is the exact executed list; integration files use a separate `.integration.ts` suffix and runner.
2. In `workers/content-engine`, run `npm test`, `npm run test:pages`, `npm run typecheck`, and `npm run build:lean`. Build uses `deploy --dry-run`, sentinel identities and removed Cloudflare credentials; it does not deploy.
3. Run root `tsc --noEmit`, mobile `tsc --noEmit -p apps/mobile/tsconfig.json`, and `npm run build` with production URLs/provider credentials removed, `NEXT_TELEMETRY_DISABLED=1` and `INFRASTRUCTURE_COST_POLICY=zero-cost`. Keep root and Worker TypeScript projects separate.
4. `python3 scripts/qualify-phase-two-postgres.py --browser` creates a new localhost-only PostgreSQL instance, runs FO/auth tests, replays selected migrations, verifies SQL dumps and starts/stops the production Next server. It requires `initdb`, `pg_ctl`, `psql`, `pg_dump` and installed Chrome. No existing database is used. The synthetic server, dump and restore databases are removed in cleanup. `--auth-only` reruns auth/selected migration/restore checks without overwriting the existing complete game log. `full-postgres-migrations.json` records the fresh full-sequence stop at unavailable pgvector; the selected test schema is deliberately partial.
5. In the Worker project, `node --import tsx scripts/phase-two-schedule-storage.ts` measures a year of 200-byte/32KB slot summaries. From root, `node --import tsx scripts/phase-two-local-benchmark.ts` measures local Node CPU, not Cloudflare CPU.
6. Run `python3 scripts/audit-phase-two.py` then `python3 scripts/report-phase-two.py`. The latter refuses unexplained application regressions, failing critical suites or incomplete browser checks. It still reports whole-product readiness BLOCKED, with production CPU/provider/hosting/messaging gaps.

No production staging approval is implied by these commands. Never reuse application credentials for these tests. The integration guard requires `PHASE_TWO_SYNTHETIC_DATABASE=true`, supplied only by the disposable runner. Do not set it against a persistent application database.

The retained Phase 1 storage/read-amplification artifacts are inputs, not newly measured production results. `capacity-model.json` adds the new measured scheduling table, six middleware auth self-requests/DAU, a 30% quota target and conservative operation allowances. It intentionally does not price an incomplete private-data migration as free.

Browser screenshots show the actual local Node production build, including empty/fallback data and old cached briefing timestamps. Canonical Film Room is `/watch`. An initial harness attempt used `/film-room` (404); the final check uses the route declared in primary navigation. Initial browser launch lacked Playwright-downloaded Chromium; the final run uses installed Chrome. These harness corrections did not change application routes. Android/iOS devices/simulators were not tested. Native TypeScript passed only.

Terminal color/control sequences and trailing whitespace in retained logs were normalized for review; diagnostic text, assertions and test results were retained.
