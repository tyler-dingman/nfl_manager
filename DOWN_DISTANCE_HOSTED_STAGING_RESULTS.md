# Down & Distance hosted staging results

**Production readiness: NO-GO. Hosted qualification stopped at Phase 1.** The actual account is reachable, but its Free-plan/billing status and account-wide quota consumption could not be verified. No remote resources were created, deployed, modified, or deleted. No deployment approval was requested or inferred.

Inspected baseline: `release/down-distance-rc3` / `1dc29c82`, October 20, 2026. Completed RC3 local engineering and validation were not rerun or redesigned.

| Required field             | Result                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging deployed           | **NO**                                                                                                                                                                                                                                                              |
| Account Free plan          | **UNVERIFIED** — subscriptions API returned HTTP 403, error 10000, “Authentication error”                                                                                                                                                                           |
| Billing activation         | **NONE performed**; whether the account meets the no-activation requirement remains unverified                                                                                                                                                                      |
| mTLS protection            | **FAIL qualification / NOT TESTED hosted** — existing fail-closed implementation retained; no staging hostname/certificates configured                                                                                                                              |
| Hosted authentication      | **FAIL qualification / NOT TESTED**                                                                                                                                                                                                                                 |
| Hosted Worker CPU          | **FAIL qualification / NOT MEASURED**                                                                                                                                                                                                                               |
| Ten-D1 operation           | **FAIL qualification / NOT DEPLOYED** — zero existing D1 databases observed                                                                                                                                                                                         |
| Hosted recovery            | **FAIL qualification / NOT TESTED**                                                                                                                                                                                                                                 |
| Daily quota headroom       | **UNKNOWN** — no account-wide request, CPU, D1 read/write, or storage usage measurement obtained                                                                                                                                                                    |
| Critical product workflows | **NOT TESTED hosted** — all 32 teams, authentication, IDs, saves, Front Office, Parlay, erasure, retention, browser behavior, isolation, and quota monitoring remain hosted gates                                                                                   |
| Live integration gates     | Email/push, AI, sportsbook providers/transfers, and ingestion remain disabled in the prepared package; no provider credentials uploaded or calls enabled                                                                                                            |
| Native device validation   | **NOT PERFORMED**; existing RC3 local browser evidence is not native device validation                                                                                                                                                                              |
| Production readiness       | **NO-GO**                                                                                                                                                                                                                                                           |
| Remaining blockers         | Billing/subscription read access; verified Free eligibility and quotas; approved hostname/tester certificates; actual staging IDs and fresh secrets; explicit creation/deployment approval; empty recovery destinations; all hosted measurements/tests              |
| Exact next owner action    | Enable read-only subscription/billing and account analytics access for the authenticated account, or make the corresponding authenticated dashboard views available; then rerun Phase 1. Do not approve or execute deployment while those checks remain unverified. |
| Branch                     | `release/down-distance-rc3`                                                                                                                                                                                                                                         |
| Commit                     | Local preparation commit containing this report (`git rev-parse HEAD`); inspected application baseline remains `1dc29c82`                                                                                                                                           |

“FAIL qualification / NOT TESTED” means the hosted acceptance criterion has not passed. It does not assert that an executed authentication, mTLS, CPU, or recovery test failed.

## Actual account inspection

Wrangler authenticated using its existing local OAuth login. Credentials were not copied into the repository, printed, uploaded, or reused as application secrets. The selected account ID is `6e8c301360ab628706dcf3acf55f0dbb`.

The read-only Cloudflare API results are recorded in [account-readonly.json](reports/hosted-staging/account-readonly.json):

- `GET /accounts/{account}/subscriptions`: **403**, `success:false`, error `10000`, “Authentication error”. The existing login can inspect resources but cannot establish subscription/billing status through this endpoint.
- `GET /accounts/{account}/workers/account-settings`: **200**, `default_usage_model:"standard"`, `green_compute:false`. This is not proof of the Workers Free plan or of no billing activation requirements.
- `GET /accounts/{account}/d1/database?per_page=100&page=1`: **200**, `total_count:0`, empty inventory. This proves no databases were listed, not the account's entitlement or daily unused quota.
- `GET /accounts/{account}/workers/scripts`: **200**, one existing Worker: `dnd-content-scheduler`. It was left untouched. No proposed RC3 Worker name collides with that observed inventory; hostname/zone/route conflicts were not verified.

The initial sandboxed identity check could not reach the auth server. A network-enabled identity check succeeded. Python's HTTP client then failed at transport; the same four GET checks were retried using Node's normal TLS verification. No TLS verification was disabled. The resulting 403 is an actual API authorization failure, not a guessed account condition.

After that account-safety failure, remote execution stopped as required by Phase 1. Account-wide analytics were not queried afterward. Zero databases do not imply zero daily consumption: historical/deleted workloads and the existing Worker must be included in a real quota assessment.

Cloudflare documents ten databases on Free and a 500 MB per-database Free limit. Those public limits do not establish this account's plan or remaining allowance. See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Free quota failure behavior](https://developers.cloudflare.com/d1/reference/faq/). Subscription inspection is documented in [List Subscriptions](https://developers.cloudflare.com/api/resources/accounts/subresources/subscriptions/methods/get/).

## Local preparation completed

A review-only package was generated without remote calls by `python3 scripts/prepare-hosted-staging-review.py`:

- Five `config/rc3-hosted.*.toml` templates pin the observed account ID and use isolated `down-distance-rc3-staging-*` Worker names.
- Ten proposed databases are named `dd-rc3-staging-1` through `dd-rc3-staging-10`, using the existing team/users/shared migration directories. IDs remain clearly synthetic until approved creation returns real staging IDs.
- All Workers have `workers_dev=false` and `preview_urls=false`; no public routes are configured. The Web entry point remains `workers/staging/mtls-index.ts`, with `assets.run_worker_first=true`, so assets and APIs pass through the existing certificate gate.
- The host and SHA-256 allowlist remain unconfigured placeholders. The existing gate denies missing/malformed host or allowlist settings, unapproved hosts/fingerprints, absent/invalid/revoked certificates, and spoofed certificate HTTP headers. These are code-level properties inherited from RC3, not new hosted test results.
- All configured Cron Triggers and ingestion, odds processing/fetch, email, briefing, social notification, and maintenance flags remain disabled. Search uses the deterministic provider. No R2/PostgreSQL binding or provider credential is introduced.
- Internal service bindings refer only to the five proposed staging Workers. The existing `dnd-content-scheduler` is not a deployment target.

[Local package checks](reports/hosted-staging/local-package-check.json) pass for these newly prepared templates. This was a static configuration check, not a repeat of completed RC3 engineering, a new production build, or hosted security validation.

[Exact command package for owner review](reports/hosted-staging/commands-for-owner-review.txt) contains the ten resource creation commands, ten role migration commands, isolated secret uploads, local build command, and ordered five-Worker deployment commands. **The file was generated, not executed.** It is not a deployable approval request yet: account safety, actual resource IDs, hostname/zone, tester certificate allowlist, and secret provenance remain unresolved. No hostname attachment or database deletion command was invented for unknown resources.

Public registration remains unreachable through this package because no public route exists. Before any tester access, the approved hostname must require client certificate presentation and the Worker must be shown to deny anonymous/invalid/spoofed-header requests for both static assets and APIs. Internal Workers must remain without public endpoints. Use only fresh staging secrets; upload no production, AI, email-provider, or sportsbook-provider secret.

## Hosted validation and recovery still required

After Phase 1 passes, present the completed concrete package for **explicit owner approval before any remote creation or deployment**, as required by this mission. Only after that approval may the reviewed isolated resources be created. Maintain disabled schedules/providers and synthetic data throughout qualification.

Measure actual hosted Worker CPU, including the unchanged Argon2id password Worker, and account-wide D1/request usage. Do not reuse RC3's local elapsed times or modeled 25–50 DAU projections as hosted measurements. No numeric daily quota headroom or safe DAU capacity is claimed here.

The ten-database recovery drill also needs an approved destination strategy. Deploying ten databases would fill the documented ten-slot Free inventory; a second simultaneous ten-database restore set cannot fit within that same limit. Before the drill, review either an independently verified/approved empty Free recovery account or an explicitly approved replacement procedure for synthetic staging databases after authenticating a complete backup and current independent erasure ledger. No existing database should be deleted merely to obtain slots, and no paid upgrade is permitted.

Restore only into empty isolated destinations. Verify all shards and archive integrity before mutation, exercise missing-shard/corruption/interruption behavior, replay the latest independently preserved encrypted erasure ledger before reopening access, and verify original IDs, references, revocation, and user progress. Do not report a restored account erasure complete until its continuations and coordinated cleanup finish. The RC3 owner tools remain local-only; no unqualified hosted export/import implementation was run or represented as complete.

The next action is to unblock read-only account safety verification. Deployment authorization is a later, separate gate. No remote ingestion, cleanup, registration exposure, production migration, billing activation, R2 activation, or schedule change occurred in this session.
