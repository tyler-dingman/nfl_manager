# Team content monitoring

The monitoring system extends the existing PostgreSQL source watcher and canonical story engine. It never scrapes X, Reddit, paywalls, or authenticated pages. RSS/Atom feeds use conditional requests; credentialed platforms remain `CONFIGURED_BUT_UNAVAILABLE` until their official provider adapter and environment flag are enabled.

## Chiefs observer run

Apply migrations, then run:

```bash
npm run auth:migrate
npm run monitor:test -- --team=KC --hours=24
```

`OBSERVER_MODE=true` is forced by the runner. In this mode ingestion, clustering, synthesis, scoring, and notification decisions execute normally, but breaking candidates are not inserted into the notification delivery queue. The runner captures data every minute and prints a final JSON report. `Ctrl-C` completes the run early and preserves its observations.

Review the latest run at `/admin/observer`. This route and its API require a signed-in user listed in `ADMIN_USER_IDS`. Notification thresholds can be replayed against stored observations without fetching sources again.

## Providers and health

RSS entries with a configured feed are enabled by registry sync. X requires its official API/streaming project; YouTube uses WebSub plus the YouTube Data API; Reddit requires approved developer API credentials. Public-page sources require an explicit compliance review before `PUBLIC_PAGE_INGESTION_ENABLED` is set. Missing credentials never produce fake items.

Cadence defaults are 180 seconds for Tier 1, 600 seconds for Tier 2, and 1,200 seconds for Tier 3. Webhook/stream sources are event-driven. Override polling with `SOURCE_TIER_A_SECONDS`, `SOURCE_TIER_B_SECONDS`, and `SOURCE_TIER_C_SECONDS`.

Source health is available on the dashboard and protected `/api/admin/source-health`. It includes last check, last success, last item, failures, rolling request latency, method, and last error.

## Extending

Add another data-only team registry under `src/data/sources/monitoring/` and register it in `index.ts`. Provider code implements the existing `SourceFetcher` boundary and emits `RawSourceItem`; normalization, deduplication, clustering, scoring, synthesis, and observer reporting remain platform-independent.
