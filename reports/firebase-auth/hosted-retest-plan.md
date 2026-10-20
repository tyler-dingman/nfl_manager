# Firebase staging review and hosted retest — NOT EXECUTED

No deployment is authorized by this implementation mission. Only the existing staging API/Web need code updates; the existing password, application and odds Workers remain private and unchanged. One additive migration applies to D1_USERS only. Never create databases, enable production schedules or modify occupied stores for restore tests.

## Owner Firebase setup

The signed-in Firebase console already contains **Down and Distance**, project `down-and-distance-8526c`, and visibly reports **Spark / No-cost ($0/month)**. Two Android app registrations exist. Authentication displays **Get started**, and no Web app was listed. No Firebase settings, apps, providers, users, permissions, billing or resources were changed.

1. Open the existing [project](https://console.firebase.google.com/u/0/project/down-and-distance-8526c/overview). Keep Spark. Do not upgrade to Blaze, link billing, create a replacement project, enable Firestore/Storage/Functions/Hosting, or change either Android registration.
2. Open Authentication, choose Get started, then enable **Email/Password only**. Keep email-link, phone/SMS, anonymous, enterprise and other sign-in providers disabled. Keep email enumeration protection enabled. Configure an enforced password policy with minimum length 10 (maximum app length 256). Do not accept a billing or Identity Platform upgrade prompt.
3. Register a **Web** app from Project settings > General > Add app. Do not select Firebase Hosting or Analytics/other products. Save its actual `projectId`, `apiKey`, `authDomain`, `appId`. These are public SDK configuration, not Admin credentials. Do not send or create service-account keys.
4. Verify Authentication settings/authorized domains. Use the existing staging host `down-distance-rc3-staging-web.tdingman5.workers.dev` plus the project's own Firebase handler domain. Do not add downdistance.com or change Vercel. Add localhost only for an explicitly isolated development run. Use Firebase's default hosted password-reset handler; do not use Dynamic Links or email-link sign-in. Inspect/reset the email template sender and test delivery with owner-controlled synthetic inboxes. Application ingestion/email/push/AI/sportsbook flags stay false; Firebase authentication reset mail is a separate explicitly tested provider operation.
5. Review Firebase API-key restrictions for Identity Toolkit and Secure Token use from web/native and the Worker lookup endpoint; do not configure an HTTP-referrer restriction that breaks Worker REST lookups. No Admin SDK or privileged Google credentials are required. Confirm the actual project still reports Spark and billing remains unlinked before proceeding.
6. Configure the actual public values as `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID` for staging API (and Web for consistency). Keep `AUTH_PROVIDER=firebase`, `APP_PASSWORD_ENABLED=false`. Flip `FIREBASE_AUTH_ENABLED=true` only after configuration review; missing configuration currently fails closed. Keep the existing isolated `AUTH_JWT_SECRET`; never reuse a production secret. The browser/native SDK fetches public configuration from `/api/auth/config`, so no invented NEXT_PUBLIC or EXPO_PUBLIC project values are compiled into builds.

Native uses the Firebase JS SDK (Expo 54, SDK 12+) and SecureStore persistence; no new native Firebase plugin, Google plist/json replacement, OAuth callback, deep-link scheme change, or WebView is required for email/password. Android/iOS device validation remains required.

## Synthetic accounts

Do not delete or auto-link any existing owner test identity/data. Use new synthetic addresses or owner-controlled test inbox aliases that do not collide with existing D1 emails. A verified Firebase project/UID maps through `app_identities(provider=FIREBASE, provider_subject=project:UID)` to a stable application UUID. Existing test emails deliberately return a generic failure rather than linking on email ownership claims alone. If an old test email must be reused, the owner must first export/review its D1 data and explicitly approve either a verified UID-to-UUID mapping or its erasure; no automated migration is included. Password hashes stay unchanged in retained old accounts. No real customer passwords are migrated.

## Exact reviewed staging commands — approval required before any remote execution

First verify the intended Cloudflare account `6e8c301360ab628706dcf3acf55f0dbb`, existing five Worker names and ten IDs in `reports/hosted-staging-rc3/created-databases.json`, Workers Free, remaining account-wide quotas, private subdomains/previews, no paid/R2 bindings, no production routes and empty schedules. Confirm staging access is disabled and review its current expiration; never silently extend an expired gate. Rebuild from the reviewed clean commit and regenerate the manifest; generated bundle hashes are not authority to deploy.

```sh
cd /private/tmp/down-distance-rc3
# These local commands do not deploy:
DD_BUILD_WRANGLER_CONFIG=config/rc3-hosted.web.toml node scripts/build-split-worker.mjs
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config config/rc3-hosted.api.toml
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config config/rc3-hosted.web.toml
```

After separate explicit owner approval, and after the Firebase public values have been placed in reviewed staging configuration/secrets files without removing existing gate/session secrets:

```sh
# ADDITIVE schema migration of the existing staging D1_USERS only; review pending list first.
node node_modules/wrangler/bin/wrangler.js d1 migrations list D1_USERS --remote --config config/rc3-hosted.api.toml
# Stop if anything other than the reviewed 0010 migration is pending.
node node_modules/wrangler/bin/wrangler.js d1 migrations apply D1_USERS --remote --config config/rc3-hosted.api.toml
DD_RC3_PRIVATE_DIR="$(cat /private/tmp/dd-rc3-private-location.txt)"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.api.toml --secrets-file "$DD_RC3_PRIVATE_DIR/api-secrets.json"
node node_modules/wrangler/bin/wrangler.js deploy --config config/rc3-hosted.web.toml --secrets-file "$DD_RC3_PRIVATE_DIR/web-secrets.json"
```

Read back actual deployment settings, bindings, schedules and subdomain flags. Keep both private throughout migration/uploads. Review a bounded gate window separately before enabling the existing protected Web endpoint with `node scripts/hosted-staging/exposure.mjs enable`. Never enable internal Worker URLs. Upload rollback must remain in Firebase fail-closed mode; restoring legacy password access is not an acceptable CPU workaround. Do not reverse 0010 or remove existing user data.

## Ordered acceptance and measurements

1. Repeat `node scripts/hosted-staging/qualify-access.mjs`: anonymous/invalid/expired staging credentials, protected assets/APIs, trusted redirects, internal Worker denial, authorized exact asset bytes. Verify old password/OAuth/mobile exchange endpoints are 404 even with approved staging access. On a bypass, run `node scripts/hosted-staging/exposure.mjs disable`, verify actual disabled settings and stop.
2. With two synthetic Firebase identities, run registration, correct/incorrect password, login/logout, reload, browser reopen, SDK ID-token refresh, one-hour identity expiry, mobile 15-minute app-token refresh, concurrent sessions, revoke-one/revoke-all, real password-reset email delivery/action/replay and old-password rejection. Verify accounts:lookup really supplies `validSince` and disabled/deleted state with the public ID-token API: missing metadata must reject access, never silently skip revocation. Test external provider revocation and deletion, recent-login deletion requirement, cross-user deletion denial and D1 cleanup. Missing metadata/delivery is a release blocker.
3. Require correct signed-in SSR HTML for `/`, `/account`, `/front-office`, `/parlay-lab`, plus all requested product routes; signed-out/expired/revoked sessions redirect to same-origin login without loops. Verify all 32 team feeds, global NFL, original IDs/search, saved cross-shard content, saved bets, Front Office, trivia, Move the Chains and deterministic Parlay/Search paths. Local fixtures do not qualify live providers.
4. Use actual Cloudflare trace `CPUTimeMs` for Web/API invocations associated with registration exchange, login exchange, session verification/SSR, refresh and logout. Preserve existing `application_headers` D1 metrics (`d1Calls`, `statements`, `rowsRead`, `rowsWritten`) and status/error correlation. `wallMs` and local workerd execution time are never CPU qualification. Include cold JWKS fetch and warmed verification, and every service-binding hop. Password computation occurs at Firebase, not a hidden paid Worker executor. A successful request above Workers Free's allowance still fails CPU qualification.
5. Record actual request/error totals, D1 storage and account-wide rows read/written before/after. Maximum bounded workload: 5,000 Worker requests, 100,000 D1 read rows, 10,000 written rows, and stop earlier at existing safety thresholds. Keep all provider/ingestion schedules disabled; do not run a complete remote day. Confirm provider quota/error rates and recovery from provider outage without accepting cached identity.
6. Disable public staging exposure after bounded testing and record version IDs, time, measured coverage and limitations. No production GO follows from local success.

## Erasure interruption and recovery

Firebase deletion requires current application authorization, a signed ID token for the same mapped UID and authentication within five minutes. The server journals intent before deleting the provider account; only after provider acknowledgement does it record a permanent UID tombstone, revoke app sessions and request the existing D1 erasure workflow. If D1 fails after provider acknowledgement, the account stays denied and `resumeFirebaseErasures()` is a bounded **owner-only** repository operation, not a public HTTP endpoint. Run it under the existing isolated owner D1 binding harness; it replays at most ten acknowledged pending deletions without making any Firebase delete calls. If `provider_deleted=0`, the owner must inspect the provider account using its still-existing `app_identities` mapping before any manual recovery; a failed/ambiguous request is not evidence of deletion. Never automatically purge those rows or create a replacement identity.

Preserve the existing independently encrypted application erasure ledger. Additionally export a **current**, independently retained encrypted Firebase ledger using `sealFirebaseLedger`, validate with `openFirebaseLedger`, then replay with `replayFirebaseLedger` after an isolated restore. Replay is monotonic and cannot lower a revocation epoch or revive a deleted UID. Keep the isolated AUTH_JWT_SECRET stable/protected for identity hashing and encrypted session recovery; rotating it requires an explicit key/ledger migration. Do not restore stale ledgers over current ones. Journal entries lose their application UUID after D1 erasure is accepted; hash-only revocation tombstones intentionally survive erasure. Preserve pending deletion evidence until acknowledged erasure can resume.

Ten occupied D1 slots still prevent an isolated hosted ten-database restore. Do not delete occupied staging stores to create capacity. Hosted recovery remains UNVERIFIED until an approved empty isolated environment can complete actual restore, interruption, corruption/missing-shard rejection, original IDs, revocation replay, references and user-progress checks. No such restore occurred here.
