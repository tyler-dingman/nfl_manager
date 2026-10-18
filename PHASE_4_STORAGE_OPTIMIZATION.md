# Phase 4 storage optimization

Worktree `/private/tmp/down-distance-zero-cost-phase-4`, branch `poc/zero-cost-production-readiness-phase-4`, base `8adafd53`. No production access, deployment, paid activation, real provider calls or existing user-data deletion. PostgreSQL remains the default and rollback implementation. All binding mutations use synthetic local data.

## Root causes and implemented changes

Phase 3 D1 day-365 subtotal: 935.75 MB. The inherited editorial directory is 321.21 MB; accounts/preferences 102.40 MB; sessions/security history 74.75 MB; trivia/points 186.88 MB; saved slips/content 224.26 MB; receipts 2.34 MB; mail/subscriptions 14.02 MB; AI/odds keys 9.82 MB. These are planning envelopes, not production table measurements. Full D1 payload copies are not the only problem: indexed retained row populations themselves grow. Accounts and saved history cannot be treated as disposable.

Implemented: SHA-256 identity over original bytes, optional gzip with bounded decoding and old raw-object reads; server-owned JSON subtree nodes sharing unchanged content across revisions/users; compressed plaintext before randomized authenticated directory encryption; verified encrypted chunk reuse; unchanged checkpoint reuse; bounded expired derived-AI-key maintenance; exact consumed-token archival before removing expired capabilities from D1; additive indexes and compact odds-history directory with timestamp paging. No garbage collection of user/game/editorial bodies is enabled. No paid cache is added.

Measured ordinary game fixture: 25,875,892 full-snapshot logical bytes versus 309,402 primary physical bytes (1.20%). This is a shared-player synthetic fixture, not a general compression guarantee. All 401 game versions remain recoverable; a high-entropy 2.1 MB state is included separately. 21.0 R2 reads per ordinary commit in this fixture includes write/read-back verification. Sharing reduces storage but adds object operations. A 128 KB leaf ceiling / 64,000-character string split bounds the worst-size object fanout; production CPU remains unverified.

## Dataset inventory and workload assumptions

No production datasets were inspected. Empty fixture tables are not evidence of zero production cost. Rates below are ASSUMED Phase 3 envelopes at 1,000 DAU; unquantified domains remain UNVERIFIED. Monthly means 30 days.

| Dataset | Synthetic/known consumption | Daily / monthly / annual growth | Retention | Read / write frequency and opportunity |
|---|---|---|---|---|
| Editorial articles | R2 fixture documents; actual editorial-only prior benchmark retained | Editorial/source/FTS combined 321.21 MB D1 at 365d; separate rates unverified | IDs, revisions, corrections, source attribution retained | Read-heavy; previous published-response cache retained; application gzip does not automatically compress legacy editorial bodies |
| Source ingestion | Prior benchmark; full source population unverified | Included in editorial envelope; split unverified | Preserve evidence, rights and source history | Scheduled; eliminate unchanged admissions before persistence; source rights still gate expansion |
| NFL news | Shares editorial data, not a second counted population | Separate daily/monthly/annual rate unverified | Saved links/history retained | Public caching; do not duplicate per-team content |
| AI summaries/search | Derived index plus immutable outputs | 200 keys/day; 6,000/month; 73,000/year before cleanup | Expired derived keys removable; underlying bodies retained | Shared requests; cleanup capped at 1,000 keys/tick after 30 days beyond expiry; CPU/provider calibration pending |
| Search indexes | FTS pages included in table audit | Full-product index growth unverified | Reconstructable index, durable documents retained | Indexed lexical reads; no semantic-answer parity claim |
| User accounts | 3,000 synthetic users, credentials, preferences, sessions | Initial 10 accounts/DAU × conservative 10,240 bytes; 102.40 MB at 1,000 DAU | Durable, no cleanup | Owner PK reads; accounts are not expired data |
| Front Office | 101 synthetic owners, 401 versions | 25 commands/day; 750/month; 9,125/year; 100 KB ordinary / 2.1 MB stress shape | All progress and versions retained | D1 head/CAS + R2 shared subtrees; actual Front Office route transactions still PostgreSQL |
| Trivia/Move the Chains | Daily route/concurrency/import tests; scale table population absent | Planning 0.512 MB/day / 15.36 MB/month / 186.88 MB/year | Answers, points and reward events retained | Daily D1 answer/stats/award atomic batch; multiplayer/reward redemption unported |
| Saved content/bets | 3,000 synthetic saved bets | Planning 0.6144 MB/day / 18.432 MB/month / 224.256 MB/year | All owned IDs and metadata retained | Owner reads; 32 KB metadata offload threshold preserved to avoid multiplying reads for ordinary lists |
| Parlay Lab/odds | Provider mocks plus historical directory | 16 events × 3/7 refreshes/day; 100 KB/event assumed | All raw books, alt lines, links and timestamps retained | Exactly three weekly refresh windows; dictionary/subtree history; board/Lab Score ports incomplete |
| Backup snapshots | 1,603 objects; 15,535 rows | Depends on changed chunks; zero writes measured for identical repeat only | No blind checkpoint or body pruning | Full frozen inventory verification; expensive reads remain; retention contract still needed |
| Logs | Only local evidence files measured | Production rate unverified | Avoid request bodies/tokens; durable audit retained | Request metrics filtered; no production log-storage estimate invented |
| Temporary processing | Consumed/expired token and AI tests | Actual production rate unverified | Token rows archived exactly before removal; live capabilities excluded | Daily optional bounded maintenance; defaults disabled |

Exact fixture pages by every table/index/column are in `reports/zero-cost-phase-4/scale-recovery.json` under `d1Pages`. Total synthetic D1 is 6,021,120 bytes. This cannot substitute for production population measurements.

## Projections, including backup overhead

| Days | D1 MB | R2 GB, all daily checkpoints | R2 GB, hypothetical eight directories | Worst-game R2 GB |
|---|---:|---:|---:|---:|
| 30 | 198.97 | 1.64 | 0.79 | 3.65 |
| 90 | 329.39 | 6.27 | 1.70 | 12.30 |
| 180 | 525.03 | 16.88 | 3.06 | 28.94 |
| 365 | 927.17 | 52.51 | 5.87 | 76.97 |

D1 after assumes the implemented derived-key maintenance is enabled and keeps pace; it is disabled in shipped local config. Without that assumption, retain Phase 3's approximately 936 MB. Compression factors 0.25 game, 0.50 odds and 0.25 backup-directory/D1-page bytes are ASSUMED, deliberately less optimistic than the ordinary fixture. Unported domain bytes remain null.

Phase 3's 15.3 GB R2 forecast assumed eight directory generations without implemented pruning. The comparable eight-directory counterfactual is 5.87 GB; **it is not an active retention policy or a readiness result**. Retaining every daily checkpoint and crediting no reuse for changed chunks gives the conservative 52.51 GB bound. An identical repeat reuses everything, but that does not prove daily changed-state reuse. The higher bound is a corrected retention assumption, not measured storage regression.

The 350 MB D1 / 7 GB R2 targets are not qualified. The minimum sustainable whole-product footprint is not established while domain volumes and retention guarantees are unknown. The implemented workload envelope still exceeds D1 targets without deleting valuable history. Avoid declaring current indexed history unavoidable in principle: further compact layouts/verified archival may reduce it, but are not implemented here.
