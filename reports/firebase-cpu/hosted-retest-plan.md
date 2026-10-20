# Reviewed staging-only retest preparation — NOT AUTHORIZED FOR DEPLOYMENT BY THIS MISSION

The current mission stops locally. All existing staging exposure must remain disabled. Do not run the upload/enable commands below until separate owner approval. No database migration, new Worker, new D1 database, paid service, billing, R2 or production change is needed.

## Local preparation and deployment boundary

1. Review the committed API/Web changes, especially request-local configuration, the atomic session/association/revocation batch and native-only access-token signing. Retain actual Firebase configuration in the existing restricted staging secret files. `AUTH_PROVIDER=firebase`, `FIREBASE_AUTH_ENABLED=true`, `APP_PASSWORD_ENABLED=false`; never enable the legacy rollback path as a CPU workaround. The same five Workers and ten database IDs remain mandatory.
2. Rebuild from the reviewed commit with `DD_BUILD_WRANGLER_CONFIG=config/rc3-hosted.web.toml node scripts/build-split-worker.mjs`; regenerate all five dry runs and the bundle manifest. Verify Workers Free/Spark, account identity, current quotas, existing bindings, zero schedules, no production routes/paid bindings and disabled subdomains/previews. Check the original gate expiry is still valid; never extend it silently.
3. Only after separate approval, upload existing API then Web **while private**:

```sh
cd /private/tmp/down-distance-rc3
DD_RC3_PRIVATE_DIR="$(cat /private/tmp/dd-rc3-private-location.txt)"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.api.toml --secrets-file "$DD_RC3_PRIVATE_DIR/api-secrets.json"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.web.toml --secrets-file "$DD_RC3_PRIVATE_DIR/web-secrets.json"
```

Do not deploy password/application/odds Workers or apply another migration. Read back private settings and disabled schedules. Only then authorize/enable the existing credential-gated Web endpoint within a bounded window, and immediately repeat the existing anonymous/invalid/expired asset/API/redirect/internal-Worker security harness. A bypass requires immediate disable/read-back and remote stop.

## Numeric instrumentation and actual CPU

`APP_AUTH_TIMINGS=true` enables bounded request-local numeric stage logs. They contain fixed stage names, elapsed milliseconds and completion booleans, with no credentials, tokens, UID, cookie, email or exception messages. They contain **no hosted per-stage CPU measurement**. Nested spans overlap: `jwt.signature` includes key resolution and jose standard JWT claims; `jwt.claims` isolates the additional Firebase-specific checks. `jwt.key_fetch` appears only when the existing bounded public-key cache fetches. Never sum nested spans or call elapsed time CPU.

Attach temporary Cloudflare live tails to existing Web/API/password Workers. Retain actual event `cpuTime` in milliseconds, Worker identity, operation label, response status, sanitized stage metrics and D1 counters. Capture every Web/API service-binding hop; a Web event without the API event cannot qualify SSR. No password Worker invocation is permitted. Local timing or Node process CPU cannot replace these measurements.

If available without a billing change, use supported Cloudflare CPU profiling for the same first-exchange request to attribute executing functions. Otherwise report per-stage CPU UNMEASURED and use spans only to locate elapsed work/I/O. Instrumentation has its own cost; disclose that. Do not drop failed/cold samples or disable revocation checks to manufacture a passing measurement.

## Ordered bounded hosted checks

Use two new synthetic Firebase identities or retained owner-controlled test identities with no D1 email collision. Keep application email/AI/push/sportsbook/ingestion providers and all Cron Triggers disabled. Do not delete existing accounts automatically.

| Operation | Exact verification |
| --- | --- |
| Registration / first exchange | Register through official SDK; POST `/api/auth/firebase/session` with its signed ID token. Record first/cold Google-key fetch, D1 mapping and capped-cookie issuance. Require HTTP 200, correct stable app UUID, no native access JWT in the web response and actual CPU <=10 ms for each Worker |
| Existing-user exchange | Sign in again and exchange; preserve UUID/preferences/saves and reject legacy email auto-linking. Collect existing-user provisioning/read/write counts |
| Native exchange | POST with `mobile:true`; require exactly one access JWT, unchanged issuer/audience/session claims, correct D1-backed ownership and expiration |
| Session lookup | GET `/api/auth/me` using HttpOnly cookie and separately native bearer; validate signature, current provider account/validSince, revocation tombstones, D1 session and user status each time. Record API CPU and D1 metrics |
| Authenticated SSR | GET `/`, `/account`, `/front-office`, `/parlay-lab` with the approved staging cookie and app cookie; require HTML, private/no-store caching and no 503/loop. Record Web CPU, `ssr.authentication` elapsed span, and each internal API lookup CPU separately |
| Refresh | Obtain SDK-refreshed ID token, exchange using the current same-user session; verify old app session revoked and new capped association committed atomically. A foreign prior token must not revoke another user's session. Web still signs no native JWT; native signs one |
| Logout | POST `/api/auth/logout`; require revoked cookie/session rejected and no resurrection from pending SDK exchanges. Record actual CPU |
| Revocation | Revoke one and all app sessions; verify other-user isolation, revoked old ID-token auth_time rejected, and full reauthentication required where applicable. Test provider disable/reset/deletion/validSince changes; no cache may retain a successful authorization decision |
| Negative identity | Reject missing, malformed, forged, expired, wrong audience/issuer/UID/tenant tokens and missing/invalid provider metadata. Reject provider redirects and outage. Keep legacy endpoints unavailable |
| Account erasure | Recent same-user proof, cross-user denial, provider acknowledgement journal and retained independent erasure ledger; no occupied-database restore or automatic existing-account deletion |

Stop and disable exposure immediately if any invocation exceeds 10 ms, a security check fails, the platform reports CPU limits, quotas approach thresholds, or any paid/production change would be required. Do not continue with warmed requests after a failing cold sample merely to claim compliance. This bounded run must stay below the existing limits of 5,000 Worker requests, 100,000 D1 read rows and 10,000 written rows, stopping earlier at account safety thresholds.

Record actual before/after D1/Worker aggregates with lag caveats, direct returned D1 metadata, storage and errors; do not reconcile lagging totals falsely. Disable staging when finished and remove only temporary telemetry sessions created by the run. Keep beta NO-GO until cold/warm/native/SSR CPU and security/workflow gates actually pass. Hosted recovery/native-device/live-provider gates remain separate.
