# Phase 4 D1 application integration

Worktree `/private/tmp/down-distance-zero-cost-phase-4`, branch `poc/zero-cost-production-readiness-phase-4`, base `8adafd53`. No production access, deployment, paid activation, real provider calls or existing user-data deletion. PostgreSQL remains the default and rollback implementation. All binding mutations use synthetic local data.

**PARTIAL. The entire application cannot yet operate on D1.** Authentication/session/profile/preferences/saved-content adapters from Phase 3 remain. New actual daily-trivia handlers dispatch through a D1 repository; the original PostgreSQL repository is retained separately. Daily answer, stats, yards, unlock and notification records commit in one D1 batch with uniqueness and account-version guards. Concurrent duplicates award once. Truth and timing are read from trusted storage, not caller assertions. Owned reads, FK constraints, failure rollback, expired sessions and credential handling retain their tested behavior. Additive settings CAS and timestamp-indexed odds history are available; application settings consumers are not globally migrated.

Typed import now includes questions, daily assignments/views/answers, stats, Move the Chains accounts/events, reward definitions and unlocks. Non-daily/null-answer rows retain exact raw archives; they are not claimed executable. The representative daily/reward import preserves ten original source rows and relationships. The full 50-table synthetic PostgreSQL rehearsal archives 34 populated rows and imports 29 typed rows; source remains unchanged. Original row text retains unported fields/precision. Imports intentionally require a fresh unserved target after failure, preserving the failed binding; this is not an in-place resumable importer.

| Domain | D1 status | Remaining PostgreSQL dependency |
|---|---|---|
| Auth/sessions/profiles/preferences/saved content | Existing staged adapters tested | Worker password hashing unavailable; mail transaction/cutover gaps |
| Daily trivia | Integrated actual GET/POST, atomic stats/yard award | Multiplayer/group games, social rooms, rematches and pools remain PostgreSQL |
| Move the Chains | Atomic award/account/event/unlock path | Rewards dashboard, crew ranking, claim/redemption/commerce and notifications UI remain PostgreSQL |
| Front Office | Shared immutable aggregate substrate and full PostgreSQL regression | Durable route transactions, events, offers, reconstruction and legacy recovery still PostgreSQL |
| Parlay Lab | Scheduler history uses shared tree format; old raw envelopes readable | Board IDs/mappings, Lab Score, Trending Props, grading and transfer queues unported |
| Editorial/search | Prior lean metadata/lexical adapters retained | Full original editorial application operations not all ported |
| Application settings | New bounded D1 CAS class tested | Full consumers/imports remain incomplete |
| Other domains | Existing Phase 3 inventory retained | Huddle, crew, game-day, commerce, notifications, video and additional SQL paths remain |

The Phase 3 115 historical declarations/877 SQL-site inventory is the starting dependency evidence, not repeated as a new broad audit. Concrete dispatch changes are limited to daily trivia and the standalone award path. No generic PostgreSQL-to-SQLite textual emulation or fake transaction wrapper was introduced. Selecting D1 globally still fails closed on unported paths. Whole-product migration, stateful multi-route parity and disabling old polling remain production blockers. Verified PostgreSQL compute eliminated: 0.

New readers accept legacy D1 objects/checkpoints; Phase 3 readers do not understand every new format. A production rollback must retain Phase 4 readers or verify a reverse import of post-cutover writes. PostgreSQL default retention alone is not proof of bidirectional rollback after D1 writes. No production cutover occurred.
