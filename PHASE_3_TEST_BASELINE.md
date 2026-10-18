# Phase 3 test baseline

Started from `87101164` in `/private/tmp/down-distance-zero-cost-phase-3`, branch `poc/zero-cost-production-readiness-phase-3`. Read the Phase 2 report and its actual 17 failures before backend changes. The baseline was corrected first: 1,057 passes, zero failures, two conditional skips. Gameplay economics, authentication gates and real rosters were preserved.

| Original failure | Classification | Correction |
|---|---|---|
| src/components/auth/user-avatar.test.tsx | Environment issue | Standalone JSX required the React JSX transform; add deterministic Node test loader. |
| News classification excludes messages and reserves Breaking for major stories | Outdated expectation | Classification moved to a shared helper; retain explicit breaking rules and message exclusion. |
| src/components/huddle/huddle-story-card.test.ts | Environment issue | Standalone CSS/font imports require a test adapter; real assets remain checked by production build/browser. |
| src/components/player-type-icon.test.tsx | Environment issue | Use the standalone React JSX test transform. |
| src/components/transaction-modal.test.ts | Environment + outdated expectation | CSS modules and backdrop/accessibility selectors changed; retain accessible modal checks. |
| returning to the same team resumes its durable save without clearing progress | Outdated expectation | Persistence is owned by the durable route wrapper; assert the wrapper owner/latest-save contract. |
| every merch department has a dedicated route with metadata | Outdated expectation | Current merchandising labels use a department variable. |
| homepage is merchandising-led and city discovery links to a shareable catalog URL | Outdated expectation | New & Trending is a JSX text value, not an HTML entity string. |
| team and account controls are desktop-only in the header | Outdated expectation | Current desktop controls use the lg breakpoint. |
| mobile prioritizes the question and summary before standings and activity | Outdated expectation | Current trivia layout uses ResponsiveRail stacking and separate question/stat sections. |
| evaluateDraftPick rewards value and needs | Test bug | Fixture destructuring discarded explicit rating/rank/projection overrides. |
| valid preview cookie grants navigation and disabling prelaunch restores normal access | Test bug | Preview access does not substitute for a revocable authenticated session; mock the session lookup. |
| shared AppShell owns a local Suspense boundary for its search params | Outdated expectation | AppShell now uses usePathname, not useSearchParams. |
| known selected states use the shared semantic filled-primary contract | Outdated expectation | Selected profile navigation moved into its own shared component. |
| fairness bands map to expected ranges | Outdated expectation | Fairness boundaries are .82/.90/1.09/1.21; add exact boundary coverage without rebalancing. |
| premium player plus a second keeps elite trade discussions plausible | Outdated expectation | The current elite asset guard rejects that package; preserve valuation behavior. |
| tests/live-projections.test.ts | Test fixture bug | Live free agents and cap/owned-pick assumptions changed. Inject synthetic FA/picks and use actual contract year-one cap. |

`tsconfig.test.json`, `tests/node-environment.cjs` and the clean-environment runner provide standalone JSX/CSS/font adapters. They do not replace browser assets. No test was deleted. Later provider-dispatch source assertions were updated to follow the retained PostgreSQL implementation and the stronger all-provider failure propagation rule; a behavioral test verifies all configured inference providers fail without invented output.

The skipped sportsbook suite uses its own localhost schema and injected provider fixtures; it now runs with `RUN_FANDUEL_DB_TESTS=true`. The skipped Trade Machine test needed current authenticated version/CAS command headers. It now runs against separate real Next route bundles and a fresh synthetic owner/save. Missing configuration still causes a conditional skip in standalone runs, rather than permitting an accidental real-account test.

| Executed suite | Passed | Failed | Skipped |
|---|---|---|---|
| Application Node | 1059 | 0 | 2 |
| D1/R2 + Node-on-D1 routes | 88 | 0 | 0 |
| Front Office PostgreSQL | 21 | 0 | 0 |
| PostgreSQL auth | 2 | 0 | 0 |
| Sportsbook PostgreSQL fixtures | 1 | 0 | 0 |
| Trade HTTP | 1 | 0 | 0 |

Chromium: 48 route/viewport cases, 0 failures. Two conditional skips remain in the standalone command; **both execute and pass in their dedicated isolated integrations**. They are not unresolved coverage gaps or counted twice as passes. SQLite page tests have a separate log. Local Worker probe statuses are reported separately from applicable suite passes. Native bundle compilation is not device validation.

Commands: `python3 scripts/qualify-phase-three.py`; `node scripts/qualify-phase-three-workers.mjs`; `python3 scripts/qualify-phase-three-postgres.py --browser`. All database runners use newly created local resources and remove only owned synthetic fixture directories. Existing full PostgreSQL migrations still stop at `017_search_documents.sql` because pgvector is absent locally; this is not a successful full-schema rehearsal.
