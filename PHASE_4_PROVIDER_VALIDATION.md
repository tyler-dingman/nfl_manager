# Phase 4 provider integration validation

Only local contracts/mocks were executed. No credentials were read from production or local .env files; no live sending, inference, sports request, partner transfer, paid activation or deployment occurred.

| Integration | Local evidence | Exact remaining external step |
|---|---|---|
| Workers AI | Shared cache, source versioning, durable lease/neuron reservation, JSON/citation validation and explicit configured-provider failure tests | With separately approved synthetic resources, invoke the configured model; score citation/summary quality and compare actual neurons/CPU with estimates |
| Resend | Encrypted deduped queue, reserved quotas, opt-out/preferences, reset/verification routes, redirect rejection, lost-ack state and mock provider contracts | Verify sender/domain and account entitlement; deliver a synthetic message to an owner-controlled mailbox; verify unsubscribe/consent/webhook behavior. Broadcasts consent/contact synchronization still not implemented |
| SportsGameOdds | Real client exercised with mocked usage/events; includes all selected books and alt lines, partial coverage, quota reservation, empty/error cases and three-weekly scheduling | Verify account object budget, NFL coverage, rights and returned metadata against one approved bounded synthetic/staging request; reconcile usage before/after |
| Unabated/Gambly | Existing provider/transfer contracts plus synthetic PostgreSQL transfer DB tests retained | Obtain approved sandbox entitlement and complete a sandbox sportsbook transfer/callback. Full D1 queue/id mapping remains unfinished |
| Authentication | Node original-strength Argon2, D1 session/token/ownership/isolation tests; Worker existing-session probes and password-unavailable assertion | Qualify a secure supported Worker hashing strategy within real CPU/memory; test real OAuth redirects only after explicit approval |
| Scheduled jobs | Durable slots, exactly three weekly odds windows, disabled flags and local dry-run; optional maintenance reuses existing mail tick | After code/capacity approval, run synthetic cloud scheduling/duplicate-delivery traces. No live cron is activated here |

Current public allowances are not account entitlement proof. [Resend pricing](https://resend.com/pricing), [SportsGameOdds pricing](https://sportsgameodds.com/pricing), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). Email remains 60 editorial/day plus ten reserved transactional attempts; this does not serve 1,000 daily subscribers. Existing behavior remains available through PostgreSQL; mocked payloads are never described as live validation.
