# Local multi-D1 integration — incomplete application migration

This directory contains fresh role bootstrap migrations, not a migration of existing user data.
Never apply them over an existing database. Original single-D1/PostgreSQL migrations remain unchanged.
The API's `APP_MULTI_D1=true` mode is experimental: repositories without declared ownership fail closed.
Do not deploy this configuration or switch an existing application to it.

`table-ownership.json` is the reviewed ownership contract for the 138 non-shadow application tables.
The generator fails on an unknown application table. SQLite manages the five FTS shadow tables.
Legacy editorial POC tables stay in single-D1 rollback migrations, rather than being duplicated ten times.
Source definitions, candidates, evidence, leases and retry inboxes are co-located to preserve their
foreign keys. NFL-wide editorial schema is also present in SHARED. No content duplication is required.
Trivia question/reward catalogs and commerce inventory remain USERS to preserve existing atomic operations.
Editorial override actor records remain USERS with their user FK; canonical story overrides remain team-owned.
Large cross-team events/markets/board histories/scores are SHARED, with private transfer records in USERS.

Generate and validate locally:

```sh
python3 scripts/prepare-multi-d1-schema.py
node scripts/build-split-worker.mjs --api-only
DD_MULTI_D1=true DD_NO_R2=true DD_AUTH_REPORT_DIR=reports/multi-d1-implementation/auth node scripts/probe-staging-auth.mjs
```

The auth probe applies role migrations to ten independent temporary local databases and runs the real
API/password service in workerd. It sanitizes the environment and never supplies DATABASE_URL.
The configuration contains synthetic IDs, no R2 binding, no remote mode and no Cron Triggers.
The single-D1 browser probe remains the rollback regression test, not a multi-D1 browser qualification.

## Hosted staging requirements (not activated)

The intended layout binds all ten databases to the API Worker and only the required owners to each
background Worker. The password Worker needs no database; the web/static Worker should use the API
service, rather than duplicate database access. D1's documented binding limit permits ten, but
account headroom, private Access protection and hosted CPU still need verification.

Before creating any hosted configuration: complete shard-aware polling continuations, global ID lookup,
reference pin/receipt reconciliation, role-specific retention contracts and ten-database recovery.
Use isolated staging resource IDs and secrets; keep cron/ingestion/email/paid AI disabled. Preserve
existing static asset routing and private-response cache bypass. Never put production credentials here.

Required isolated secrets: AUTH_JWT_SECRET, APP_MAIL_ENCRYPTION_KEY, scheduler authentication, and
private staging Access configuration. Keep the password service internal with no public URL.
Health checks must verify all ten ownership identities and schema versions, not merely API startup.
Account read/write quotas are shared; monitoring must include every Worker/database and background job.

## Recovery and rollback

The new archive codec authenticates a global manifest and all ten encrypted shard exports before
returning restore inputs. It is NOT a coordinated exporter or complete restore orchestrator. Do not
use it as a production backup. Existing single-D1 backup/restore remains available for rollback.
A future multi-D1 recovery runner must stop every writer, acquire all maintenance fences, export
lossless BLOB/FTS rowids, verify cross-owner references, test interruption, and restore into ten NEW
isolated databases. Leave a failed restore isolated; never advertise a partially restored set.

Rollback during local development: use wrangler.api-no-billing-local.toml with its original APP_DB
and original migrations. Do not combine databases, overwrite IDs, delete histories or prune referenced
records to make the new architecture appear functional. Hosted rollback requires a verified pre-cutover
snapshot and an explicit reconciliation plan for any post-cutover writes.
