# Three & Out daily briefing

Three & Out is generated once per team per calendar day and delivered to opted-in users at approximately 5 PM in their profile timezone. The scheduled GitHub Action calls application-owned generation and delivery endpoints; Codex is not involved in routine operation.

Required production setup:

- Apply `db/migrations/033_three_and_out_daily.sql`.
- Configure GitHub Actions secrets `CONTENT_AUTOMATION_BASE_URL` and `CONTENT_AUTOMATION_SECRET`.
- Users opt into Email, SMS, Push, or any combination through the existing notification-preference system. Push uses the existing device infrastructure. Email and SMS delivery adapters are intentionally not added until a no-cost or approved provider is available.

Use the workflow's manual dispatch with `generate` to regenerate all teams, or call the automation endpoint with `team=KC&force=true` for an explicit team/date regeneration. All generation, skipped-edition, and push delivery runs emit structured logs.

## Schema deployment and recovery

The daily feature requires migration `033_three_and_out_daily.sql`, including all daily snapshot fields, the daily uniqueness index, and the push-delivery ledger. Do not add just `briefing_date`, and do not backfill legacy snapshots into daily editions: multiple snapshots per team/day may exist, and legacy rows have no daily `items` payload.

Apply only this migration to an existing production installation:

```sh
npm run three-out:migrate -- --database=production --confirm-production
npm run three-out:migrate -- --database=production --check
```

These commands use `PRODUCTION_DATABASE_URL`. It must identify the same database as the deployed automation API's `DATABASE_URL`. Without `--database=production`, the tool uses `DATABASE_URL`. The scoped migration is additive and idempotent; it requires the base snapshot and users tables from the earlier migrations. Full installations still use `npm run auth:migrate`.

After deploying, manually run the Three & Out workflow with action **check**. This authenticated, read-only check validates the deployment's actual database without generating briefings or sending notifications. Both generation and delivery also check schema readiness before running. Missing fields now return HTTP 503 with code `THREE_AND_OUT_SCHEMA_NOT_READY` and the exact migration to apply. A deployment is not ready for scheduled automation until the check succeeds.
