# Review-only hosted update and verification plan

**NOT DEPLOYED. Separate explicit owner approval is required.** Review `HOSTED_RELEASE_BLOCKER_REMEDIATION.md`, `authentication-options.md` and `update-manifest.json` before approving any command here. The present CPU approach remains unchanged/blocked; this plan does not imply acceptance of it or authorization to activate a provider.

## Minimal update and security impact

Only existing `down-distance-rc3-staging-api` and `down-distance-rc3-staging-web` require new code. Global list/page/wire projections select D1_SHARED only for the exact NFL sentinel; other teams retain their original strict mapping. Middleware obtains API_SERVICE from the current OpenNext request context and sends only the opaque dd_session cookie to `/api/auth/me` through that private binding. The private API remains the session authority: token hash, database expiry/revocation and user status checks are unchanged. Browser cookies or spoofed identity headers never establish identity by themselves. HTTP redirects, invalid response bodies, missing Cloudflare context/service and backend failures cannot grant access. Non-Cloudflare Next retains its existing same-origin HTTP lookup.

The staging gate still runs before assets/pages/API dispatch. It is not bypassed by a browser or exposed internal route. The API service call is internal and does not forward the outer staging credential. No authentication-result cache, JWT shortcut, schema migration, D1/Worker creation, provider activation, schedule, domain or production update is required. No password Worker, application Worker or odds Worker deployment is proposed. Existing user credentials/sessions and secret values are retained. The password CPU blocker is not fixed by this update.

## Preflight after explicit approval, before any upload

1. Confirm checkout/clean tree and reviewed implementation commit; verify the update manifest against the fresh build. Rebuild artifacts only from that reviewed commit. They are ignored generated files, not the deployment authority; a rebuild changes timestamps/hashes and needs its own recorded manifest.
2. Refresh Wrangler login normally if its existing OAuth session expired. Read account `6e8c301360ab628706dcf3acf55f0dbb` inventory and verify all ten database IDs/names against `reports/hosted-staging-rc3/created-databases.json`; exactly the existing five staging Worker names plus untouched unrelated scheduler. No production route/DNS change.
3. GET each staging script's `/subdomain`, `/settings` and `/schedules`. Require workers.dev/previews disabled, zero schedules, expected service/D1 bindings, no paid/R2 bindings, and all provider/ingestion/mail flags off. Check the two config files still have `workers_dev=false`, `preview_urls=false`, assets `run_worker_first=true`, staging ASSETS and API_SERVICE present. If verification fails, do not deploy.
4. Confirm Workers Free/no billing with owner evidence, collect actual D1/Worker baseline analytics and storage, and establish a remaining bounded budget: at most 5,000 new Worker requests, 100,000 new D1 read rows and 10,000 new written rows. Stop before any exhausted quota. Do not replay a full ingestion day.
5. Confirm restricted isolated secret files still exist and match reviewed staging-only secret names. Do not print them, put credentials in URLs, export user data or reuse production secrets. The old gate deadline is October 22, 2026 at 12:20:33 UTC; if expired, do not enable or silently extend it. A fresh bounded access window/credential must be explicitly included in the security review.

## Exact deployment commands — not executed in this mission

Run only after the preflight and explicit approval of the security/CPU review. The private-directory pointer resolves existing staging-only secret JSON files; it is not a production credential location.

```sh
cd /private/tmp/down-distance-rc3
DD_RC3_PRIVATE_DIR="$(cat /private/tmp/dd-rc3-private-location.txt)"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.api.toml --secrets-file "$DD_RC3_PRIVATE_DIR/api-secrets.json"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.web.toml --secrets-file "$DD_RC3_PRIVATE_DIR/web-secrets.json"
```

Both uploads occur while private. Retain every configuration safety flag; do not deploy the other three Workers. Read settings/subdomains/schedules back again. Record version IDs and exact bundle/build identities. Disable on any unexpected exposure. Rollback can upload the prior reviewed API/Web code while private with the same staging-only secrets and bindings; no data/schema rollback is needed or authorized.

## Ordered hosted acceptance after deployment

1. If the owner-approved access window is valid, enable **only** the existing Web workers.dev endpoint using `node scripts/hosted-staging/exposure.mjs enable` after refreshing its recorded private deployment/settings preconditions with actual reads. Allow bounded routing propagation: platform 404 is denial, but readiness requires the gate's 403; any anonymous content is a stop.
2. Run `node scripts/hosted-staging/qualify-access.mjs`. Require denial of anonymous assets/APIs/home, invalid credential/cookie, spoofed identity/certificate headers and signed expired gate cookie; exact authorized asset bytes; safe same-origin login destination/next parameter and bounded redirects; anonymous product session 401; internal Worker URLs denied. An actual security failure requires `node scripts/hosted-staging/exposure.mjs disable` immediately, read-back confirmation and remote stop.
3. Use existing/synthetic application accounts only. Verify `/api/auth/me` returns each account's correct ID. With that account's dd_session plus the separate staging cookie, require 200 HTML for `/`, `/account`, `/front-office`, `/parlay-lab`, `/the-beat`, `/watch`, `/three-and-out` and `/trivia`. In Chrome, verify hydration, no auth lookup 503, no redirect loop or cross-origin credential forwarding. Signed-out users redirect to same-origin login with the original destination; expired/invalid/revoked cookies do too, while `/api/auth/me` returns 401. Never expose raw cookies/tokens in evidence.
4. Verify `GET /api/content/huddle?team=NFL` returns 200 containing the existing original synthetic NFL fixture ID and pagination, then all 32 canonical teams return their own original IDs. Verify global/team list/page/wire behavior, global article lookup, current team search, existing saved KC/BUF/NFL references/pins, and user progress remain unchanged. Do not copy global stories into team databases or renumber content.
5. Use two synthetic identities to verify concurrent pages/API calls, profile/saved-content/Front Office isolation, expiry, revocation and disabled/deleted user denial. A credential or identity leak is a security stop. Preserve private no-store responses and the independently retained erasure ledger.
6. Only after a specific CPU approach has been reviewed/authorized, collect **actual Cloudflare trace CPU** for every relevant Web/API/password or identity-verification hop during registration, correct/wrong login, reset and session operations. Capture D1 calls, SQL statements, rows read/written, request counts, storage and HTTP/runtime errors. A successful request over the published 10 ms budget still fails Free qualification. Do not change Argon2id parameters, raise CPU limits or enable a provider as a workaround. Avoid sustained repetition of the already over-budget password path.
7. Compare actual final analytics/storage with baseline, report measured coverage/sampling/lag and query maxima precisely, and disable staging when done or on any failure. No production GO follows merely from SSR/feed passing. Hosted recovery still needs approved empty targets; do not restore over occupied databases.
