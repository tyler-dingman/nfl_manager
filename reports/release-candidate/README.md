# RC1 evidence

All data and provider responses are synthetic. No production access or deployment.

- `measurements.json`: measured mixed day, separate bounded scheduler and labeled planning assumptions.
- `day-final-50/`: final measured 50-follower day (fixture setup excluded from operational totals); scheduler cap is not applied by this mixed driver.
- `day-50/`: earlier counter implementation for the before/after read comparison.
- `day/`: earlier zero-follower run; do not treat its storage sample as a complete ten-database total.
- `scheduler/`: actual automation route with a 32-call runner and unchanged RSS, all 18,504 expected checks.
- `browser-multi/`: ten-database Chromium viewport/product/restart checks and screenshots; not native device validation.
- `auth/`: real local workerd Argon2id/session/reset samples; hosted CPU is null.
- `build/`: five local Wrangler dry runs; no remote resource creation.
- `regression/`: final regression and focused integration logs. `worker-first-run.log` intentionally retains the first two failures, subsequently corrected; it is not the final result.
- `account-erasure-gap.json`: static role-schema/planner evidence of the existing over-budget account-deletion path; not a destructive probe.

Use the root `DOWN_DISTANCE_RELEASE_CANDIDATE.md` for the release decision and remaining blockers. Passing test counts do not certify every product path or production quota headroom.
