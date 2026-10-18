# Phase 3 implementation decision

Start at 87101164 in an isolated branch. Establish the complete applicable test baseline before backend work. Keep PostgreSQL code/history and select the new D1 adapter explicitly; reject unported PostgreSQL calls in D1 mode rather than routing them silently to Neon.

Use additive typed D1 identity/session/settings/saved-content tables and verified immutable private R2 aggregates for large objects. Aggregate CAS is an owner-scoped transaction, not a substitute for unported relational gameplay or reward transactions. Import full source rows losslessly for recovery, but label only executable mapped tables as migrated. Restore into offline empty bindings before any cutover.

Keep existing Argon2 security parameters and password hashes. Native Argon2 has no demonstrated Free Workers CPU/ABI path. Isolate its Node loader so full-app Worker build/SSR can be tested; password operations must report an explicit unavailable capability on Workers until a secure compatible implementation is qualified. Do not downgrade hashing or pretend password auth is production ready.

Current OpenNext 1.20.12 requires Next >=15.5.28. Use the older Next-14-compatible OpenNext 1.8.3 adapter and patched Next 14.2.35 for this reversible local compatibility experiment, preserving existing API contracts. This is not a supported production platform selection: Next 14 is end-of-support and a framework upgrade remains required. Production deployment is disabled in configuration. No old adapter is represented as production-safe, and no paid service is enabled.

Provider-independent email uses encrypted private payloads, durable dedupe keys, explicit uncertain delivery state and reserved Free quotas. Resend is the concrete adapter, never invoked against real recipients in this work. Required subscriber demand is modeled independently from DAU. Do not hide quota exhaustion or downgrade subscribed delivery.

Final local qualification adds a documented legacy process compatibility flag and manual redirects, preserving authentication checks. Saved-content private pointers live in a server-owned column with owner/content-ID envelopes; user metadata is never interpreted as an object pointer. The full-product scenario exceeds Free storage/operation budgets even though core local tests pass. PostgreSQL remains authoritative; no deployment or provider activation is authorized.
