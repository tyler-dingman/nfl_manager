# Phase 3 reproducibility

This evidence belongs to the isolated Phase 3 worktree based on `87101164`. All runtime database fixtures are disposable synthetic data. No production databases, providers, deployment or paid services were accessed.

1. `python3 scripts/qualify-phase-three.py` — standalone application tests with Node-only CSS/font/JSX adapters.
2. `node scripts/qualify-phase-three-workers.mjs` — complete D1/R2 plus Node-on-D1 handler tests, clean environment.
3. `python3 scripts/qualify-phase-three-postgres.py --browser` — freshly initialized localhost PostgreSQL, gameplay/auth/transfer fixtures, raw D1 import, SQL restore and real Node HTTP/browser checks. Requires PostgreSQL CLI and local Chrome.
4. `node scripts/cloudflare-build.mjs` — Cloudflare compatibility build followed strictly by Wrangler dry-run, credentials removed.
5. `node scripts/probe-local-worker.mjs` — local migrated/seeded workerd probe; never a cloud preview.
6. `node scripts/build-node-phase-three.mjs` — restore a Node production artifact after the Worker-specific build before running the browser fixture.
7. From `workers/content-engine`: `TSX_TSCONFIG_PATH=../../tsconfig.test.json node --import tsx scripts/application-benchmark.ts`; `python3 test/sqlite-pages-test.py`.
8. `node scripts/map-postgres-dependencies.mjs`; `python3 scripts/project-phase-three.py`; `python3 scripts/report-phase-three-final.py`.

The Cloudflare and Node builds use different Argon2 loading capabilities; do not use the Worker-specific `.next` artifact for Node authentication checks. Generated `.open-next`, `.next`, `.wrangler`, native exports and temporary databases are not committed. The committed Wrangler files use zero IDs, disabled provider flags and no production routes.

Read the root Phase 3 reports before interpreting results. Browser 200 responses include empty/error content states on a partial schema. Local wall time is not Worker CPU. Conditional standalone skips execute in dedicated integrations. No result certifies $0 production readiness.
