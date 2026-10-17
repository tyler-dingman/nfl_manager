# Phase 2 integration decision

The target remains lean D1 editorial directories plus immutable, verified R2 payloads. This is an isolated integration branch; no production cutover is authorized.

Integrate completed application/source work at `f5276dfc` (which includes main `5e1a6ec5` and Front Office durable persistence) into the selected POC `ae40533f`. This prevents evaluating an obsolete application or discarding the newer game and Parlay behavior. Retain POC migrations and storage tests. Existing data files enter through Git history only; do not import them into any database.

Do not replace PostgreSQL with D1 mechanically: the current repositories depend on PostgreSQL transactions, JSONB, locks, arrays, vector search and native password hashing. Preserve the working adapters until replacement transaction/ownership semantics and restore tests exist. A partially migrated application cannot be certified production ready.

Pages static export cannot preserve dynamic APIs/SSR/authentication alone. Workers/OpenNext is a candidate, subject to native Argon2 compatibility, complete build and deployed CPU validation. Keep the Node application intact. Local workerd timings cannot satisfy the required Cloudflare CPU evidence.

Implement reversible local safety and qualification tools, accurate three-times-weekly odds scheduling, and a backup/restore rehearsal. Do not claim an unconfigured provider, unavailable account metric, or unevaluated AI replacement is free. Whole-product readiness remains blocked until every required dependency has evidence.

Integration testing reproduced the old Request.clone/Undici recovery failure in f5276dfc. The finalized FO-1 branch afe79c90 is not an ancestor of f5276dfc. Integrate its two-file durable-route and regression-test delta explicitly; do not assume main contains that finalization. This retains original IDs, strengthens create/replay identity checks, and avoids consuming a cloned body after database waits.
