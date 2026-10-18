# PostgreSQL to D1 migration results

**PARTIALLY RESOLVED. PostgreSQL remains authoritative by default. It cannot be removed from the whole product.** The work implements executable account/session/settings/saved-content adapters and lossless offline import staging, not a generic JSON archive masquerading as a completed gameplay migration.

## Dependency map

The static inventory covers 115 distinct table declarations in migration history, 878 SQL sites across both backends, 19 connection factories, and 31 variable-query call sites requiring review. `reports/zero-cost-phase-3/postgres-dependency-map.json` retains SQL, files/lines, enclosing functions, syntactic callers, table declarations, imports and interpolation flags. The Markdown companion lists all 115 tables and all factories. These are historical DDL declarations, not 115 verified active production tables. Interpolation includes ordinary bound values; the map does not prove a complete dynamic call graph. No production connection or credentials were inspected.

## Executable staged mappings

| PostgreSQL source | D1 target | Qualification |
|---|---|---|
| users | app_users | Original IDs, case-insensitive email uniqueness, account status |
| user_credentials | app_credentials | Original Argon2 hashes, failures and lockout metadata |
| user_identities | app_identities | Provider/subject uniqueness and explicit linking |
| devices | app_devices | Ownership-checked session device references; extra device fields remain archived |
| sessions | app_sessions | Original IDs/families/hashes, expiration, revocation and replay detection |
| auth_tokens | app_tokens | Hashes, one-time consumption; reset/email confirmation atomic batches |
| user_profiles + user_preferences | app_settings | Mapped profile/preferences fields; every original field also archived |
| user_team_follows | app_team_follows | Original IDs and one-primary partial unique index |
| user_saved_content | app_saved_content + private R2 | Original article/slip IDs and links, large metadata offload |
| new security events | app_security_audit + R2 | D1 login audit persists before session issuance; historical PG events remain archived |

Private saved metadata pointers use a server-owned column and owner/content-ID envelopes; user JSON keys are always literal. A cross-user pointer injection/corruption regression fails closed. Additive migrations `0011`–`0015` leave previous D1 data and PostgreSQL migration history intact. Dispatchers retain original PostgreSQL modules and require `APP_DATA_BACKEND=d1` to select the staged backend. Both connection factories reject PostgreSQL access in D1 mode. Missing D1 methods throw explicitly; they never fall through to Neon. `ApplicationDocuments` provides owner-scoped R2-backed revision CAS/command receipts for future aggregate ports. It preserves old versions and rejects stale writers and oversized objects without advancing a head.

## Actual import and rollback rehearsal

A fresh localhost PostgreSQL cluster replays selected migrations twice, exports exact `row_to_json` text in one read-only repeatable-read statement, and imports **34 rows from 50 tables**, with **21 typed target rows**. Empty source tables are counted as schema coverage, not populated-data coverage. All raw rows, including unported columns and numeric representations, remain in content-addressed private R2 with D1 import references. Typed dates/booleans are mapped explicitly; arbitrary PostgreSQL SQL is not translated.

The source dump restores into another new PostgreSQL database with all 50 per-table fingerprints equal. D1 import leaves source fingerprints unchanged. IDs/password hashes survive D1 restart. The current synthetic D1 file occupies 745472 bytes including every legacy/additive table/index; mirror writes total 2030192 bytes. This is fixture storage, not a 1,000-user forecast. Partial/nonempty D1 import targets are refused; preserve a failed target and import again into a new unserved binding. Configuration rollback restores the retained PostgreSQL adapter; no reverse-drop/data erasure is performed. Post-cutover dual-write reconciliation is not implemented.

## Remaining operations

Front Office relational commands/reference bundles/recovery evidence, trivia multiplayer/results, Move the Chains transactional awards, catch-up, polls/predictions, notifications/consents, account deletion/export, commerce, Huddle, full editorial publication, vector/structured search, odds board/Lab Score generation and sportsbook transfer queues retain PostgreSQL dependencies. Their original tests and code remain. Saved bet slips using `/api/user/saved-content` are exercised through the actual shared account-save helper on D1; grading/transfer/odds APIs remain separate unported operations. Generic aggregate storage tests do not qualify their business transactions.

Signup currently commits account/credentials/settings before its separate token/mail batch; mail failure can leave a pending account. Admission/idempotent retry and a complete signup transaction remain a production gate. Large private saved lists also need bounded pagination/fanout, and full import datatype/field coverage is not certified. Worker password hashing remains unavailable at the original security parameters. Social provider exchanges and distributed rate limiting are not qualified on Free Workers. Production coexistence/cutover, full schema including pgvector, all historical fields as live adapters and all route contracts remain blockers. **Verified Neon compute eliminated: 0.** No existing polling job was disabled before a validated replacement exists.

| Executed suite | Passed | Failed | Skipped |
|---|---|---|---|
| Application Node | 1059 | 0 | 2 |
| D1/R2 + Node-on-D1 routes | 88 | 0 | 0 |
| Front Office PostgreSQL | 21 | 0 | 0 |
| PostgreSQL auth | 2 | 0 | 0 |
| Sportsbook PostgreSQL fixtures | 1 | 0 | 0 |
| Trade HTTP | 1 | 0 | 0 |

Chromium: 48 route/viewport cases, 0 failures. Two conditional skips remain in the standalone command; **both execute and pass in their dedicated isolated integrations**. They are not unresolved coverage gaps or counted twice as passes. SQLite page tests have a separate log. Local Worker probe statuses are reported separately from applicable suite passes. Native bundle compilation is not device validation.
