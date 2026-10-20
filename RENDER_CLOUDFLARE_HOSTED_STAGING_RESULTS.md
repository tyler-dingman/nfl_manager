# Render + Cloudflare hosted staging results

## Resumed preflight — deployment pending

Owner approved repository access only for `tyler-dingman/nfl_manager` and isolated staging credentials only on existing Render service `srv-dbbsht6i0phs73e2otg0` (`nfl_manager`). The initial main-branch deployment was canceled before completion; auto-deploy is off. No production deployment is authorized.

Render Free is verified in the dashboard; workspace Hobby has no card on file. Initial included usage was 0/750 instance-hours, 0/5 GB bandwidth and 0/500 build minutes. Firebase Spark and Cloudflare Workers Free were verified in their dashboards. Existing ten staging D1 IDs match the manifest; all five staging Workers are private with empty schedules. The unrelated scheduler is excluded.

Local qualification: portable production Node build PASS; TypeScript PASS; two new Worker dry runs PASS; five security/native transaction tests PASS; 78 native-boundary integration assertions PASS. Actual hosted CPU, memory, authentication, SSR, product workflows and cold starts remain UNVERIFIED pending deployment. Prior account-access failure is superseded by this resumed preflight.

Existing databases remain occupied; hosted recovery is UNVERIFIED. No database deletion, migration or new Cloudflare resource is permitted. Providers, ingestion, mail, push and Cron remain disabled. Controlled beta readiness: NO-GO until hosted qualification.

Account-wide pretest usage: 66,316 D1 rows read, 2,844 written; evidence under `reports/render-cloudflare-hosted/`. Historic Worker CPU values are not new hybrid measurements.

Branch: `staging/render-cloudflare-hosted-preflight`.
Commit: identify this reviewed candidate with `git log -1 --format=%H -- scripts/render-staging/build.mjs`; final hosted report will record the deployed candidate explicitly.

## Current stop: public repository publication approval

Staging-only environment configuration was saved on the existing Free Render service without deploying. Auto-deploy remains off; the service still points to main and its initial deploy was canceled. No new Render service or Cloudflare resource was created by this resumed execution. No Cloudflare deployment/exposure toggle was performed.

Automatic approval review rejected the combined local-commit/public-push action because the payload includes application changes, reports and account/deployment metadata, and existing staging authorization did not clearly authorize publishing this entire payload to the public repository. No push occurred. This is a publication authorization blocker, not a security-test failure. Local preparation and commits remain authorized.

Exact next owner action: approve publishing this dedicated staging branch to public `tyler-dingman/nfl_manager`, including the reviewed source/tests/configuration and sanitized evidence. Public metadata includes staging Worker/service names, staging database/account UUIDs, Render service/workspace identifiers, quota totals, local test/build logs and dashboard screenshots. No private environment files, app/gateway secrets, account API token or production credential is included. Existing baseline history will also be made reachable by this branch; review the publication scope below before approval.

Until that approval, hosted deployment, CPU/memory measurement and product validation are NOT RUN. Controlled beta remains NO-GO. Required final results: origin security local PASS/hosted UNVERIFIED; gateway local PASS/hosted UNVERIFIED; Firebase authentication and authenticated SSR local PASS/hosted UNVERIFIED; all-team routing/global feed/product workflows local PASS/hosted UNVERIFIED; hosted recovery UNVERIFIED; billing activation NONE.

Publication scope review found 55 pre-existing local commits absent from locally recorded origin/main, affecting 2611 files, in addition to this resumed candidate. A branch push exposes that baseline history too. See [the complete proposed publication scope](reports/render-cloudflare-hosted/publication-scope.md). The new credential scan is limited to new evidence/configuration, not a historical credential audit. Do not describe this as a small isolated patch publication.

## Final status at publication gate

| Required result | Status |
| --- | --- |
| Render service created | Existing owner-created `nfl_manager`, `srv-dbbsht6i0phs73e2otg0`; no additional service created |
| Render Free verified | YES, Free instance / Hobby workspace; no card on file |
| Billing activated | NONE |
| Origin security | Local PASS; hosted UNVERIFIED; no reviewed app deployment |
| Cloudflare gateway | Local PASS; hybrid deployment NOT RUN; five existing Workers freshly verified private with empty schedules |
| Firebase authentication | Local PASS; hybrid hosted UNVERIFIED; existing Spark project unchanged |
| Authenticated SSR | Local PASS; hybrid hosted UNVERIFIED |
| All-team routing | Local PASS; hybrid hosted UNVERIFIED |
| Global feed | Local PASS; hybrid hosted UNVERIFIED |
| Cloudflare gateway CPU | UNMEASURED; no compliance claim |
| Render memory | UNMEASURED |
| Cold-start behavior | UNMEASURED |
| D1 usage | Account preflight: 66,316 rows read / 2,844 written; storage approximately 5.55 MB. No hybrid application workload executed |
| Product smoke tests | 78 local integration assertions PASS; hybrid hosted NOT RUN |
| Hosted recovery | UNVERIFIED; ten occupied databases, no safe empty isolated restore targets |
| Remaining blockers | Explicit public publication approval and historical secret audit; then actual deployment, security, CPU/memory, product and quota qualification |
| Controlled beta readiness | NO-GO |
| Exact next owner action | Answer the publication-scope approval request; credentials approval alone does not authorize this broader public export |
| Branch | `staging/render-cloudflare-hosted-preflight` |
| Commit | Local candidate `7efa896d`; final documentation commit identified by `git log -1 --format=%H -- RENDER_CLOUDFLARE_HOSTED_STAGING_RESULTS.md` |

Saved credentials are masked in Render's environment view; no secret appears in new repository evidence/configuration. The bulk editor briefly exposed staging values to the private tool transcript before saving; no raw editor snapshot was stored in the repository or published. Subsequent observations were redacted/masked. No production credential was used. This is not a full historical secret audit.

At stop: Render auto-deploy is off and its initial deployment remains canceled; no successful application deployment exists to suspend. All five Cloudflare staging Workers are private. No public staging exposure was enabled by this resumed run. Production DNS, Vercel and production data were untouched. No hosted results are inferred from local tests.

## Publication approval and audit completed

Owner explicitly approved publication after secret audit. Full reachable history at `1897667c` (566 commits) was scanned with checksum-verified official Gitleaks v8.30.1 default rules, ignoring inline allow comments. All 94 findings were individually classified as non-secret checksums, deployment UUIDs, prose, explicit offline synthetic signing fixtures or public registered Firebase client configuration; zero unresolved findings. Exact-byte scanning of 10,117 reachable blobs found no matches for 18 locally known private credentials, including current staging app/origin/transaction secrets and Wrangler OAuth. New dashboard screenshots were visually reviewed: values/hooks masked; synthetic account screenshot has no credential. See `reports/render-cloudflare-hosted/secret-audit.json`. This does not guarantee absence of unknown credentials. No live credential testing or external audit upload occurred.

The publication authorization blocker is resolved. Deployment and hosted tests remain pending; the prior stop table records the state before this authorization and must not be interpreted as current denial to proceed.

## First hybrid hosted evidence and browser gate correction

Render deployed `d12ecd5fac73ff560c492c06a57e67a4b55febfc` successfully on Free. Private API version `9ddd70d2-9728-4bc0-8914-fe328e3c002e` and Web version `6269efa3-4f12-4f14-9cb5-26f26561caa0` use the reviewed native-D1 boundary. The first authentication/security phase passed 40 bounded operations, capturing 63 Web and 39 API actual live-tail CPU events, each 0–3 ms with ok outcomes. Node RSS snapshots: 300,945,408 and 312,217,600 bytes. These are preliminary measurements, not full beta qualification.

A later fresh login failed closed during D1 revocation lookup after signature/claims/provider verification passed. Read-only diagnosis found no revocation; the bounded retest passed after a propagation wait. Exact transport cause is unresolved. All 32 synthetic team feeds and global feed passed in the product retest, as did protected product page HTML and the edge logo asset. Three & Out returned its explicit missing-verified-edition 503; `/api/huddle` returned its intentionally disabled visual-concept 503. Do not call these live workflows qualified.

Chrome's staging form submitted `Origin: null` and received 403, captured in sanitized live-tail metadata. The gate sets `Referrer-Policy: no-referrer`, which makes ordinary form POSTs use a null Origin. [MDN policy behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header). The smallest correction changes only that staging response header to `same-origin`; strict same-origin POST verification still rejects null/untrusted origins. Regression coverage checks the response policy, rejects null/untrusted origins, and retains valid credential, replay, private gateway, rotation and native rollback tests. No CSRF bypass, acceptance of null Origin or client-controlled gateway command is introduced. Hosted browser retest remains pending.
