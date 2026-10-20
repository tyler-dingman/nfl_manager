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
