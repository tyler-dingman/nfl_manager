# Franchise news lifecycle

Implemented:
- Removed historical real-world seed and welcome-message insertion from GET /api/front-office/events. Reads no longer generate events. Welcome messages remain at explicit initialization in their separate Message channel.
- Weekly news selects up to 3 real completed-game/transaction events (8 in the existing after-Week-9 deadline window). Close games, upsets, user-team games and recorded transactions are prioritized. Sparse weeks are not padded.
- Imported committed roster transactions from the existing save store into the persisted simulation timeline during advancement. User trades are eligible; no fabricated deals or AI calls.
- Routine recaps/contracts are not Breaking. Explicit major events (currently a trade involving a player rated 90+) are eligible. Operational reminders are Messages, not league-news badge items.
- IDs include save, season, week and source event. Simulation updates and league-news insertion share a PostgreSQL transaction and version check.
- News retrieval is bounded to 60 rows with load-more pagination. Unread count is a separate indexed, save-scoped query excluding Messages. Save switching clears client news state and ignores stale responses for another save.
- Existing drawer design and individual/mark-all read behavior preserved. Native uses the same category/Breaking model and excludes Message-channel events from league news.
- Existing user saves/history were not reset or deleted.

## Local validation

Run:

```sh
node --env-file=.env.local --import tsx scripts/test-franchise-news-lifecycle.ts
```

The script refuses production/non-local databases, creates its own temporary user and two unique saves, and cleans up only those records. It does not require resetting an existing franchise. Its actual output is in lifecycle.json.

| Step | New league stories | Types | Breaking | Unread |
| --- | ---: | --- | ---: | ---: |
| New | 0 | None | 0 | 0 |
| Week 2 | 3 | 3 game recaps | 0 | 3 |
| Week 3 | 3 | 3 game recaps | 0 | 6 |
| Mark all read | — | — | — | 0 |
| Week 4 | 3 | 3 game recaps | 0 | 3 |
| Deadline, after Week 9 | 8 | 2 trade records + 6 game recaps | 1 | 27 |

Weeks 5–9 were advanced sequentially, each adding 3 stories. The deadline trade was accepted/executed through the existing trade engine in the disposable save (with test cap space). Both transferred-player records came from that completed transaction; one involved a star player. The second save used the same simulation seed to verify IDs and read state remain isolated.

Assertions passed for fresh zero state, persisted reads, repeated retrieval, duplicate insertion, stale-version retry rejection, save isolation, user-team matching, Breaking classification and rollback of both state/news when an event insert fails.

22 unit tests passed across event generation, repository normalization, story classification, legacy seed fixtures and welcome messages. Web and native TypeScript checks passed. Lifecycle verification ran against local PostgreSQL through the simulation/repository functions, not browser clicks. Native physical-device behavior was not tested.

## Current simulation limits

The existing regular-season simulation produces game results, not autonomous weekly injuries/coaching changes/CPU-to-CPU trades. Therefore ordinary weeks in this exercise contain selected game recaps. Recorded user/league roster transactions are prioritized when available. No CPU trade generator was added; absent completed trades, the deadline can contain more selected game results rather than invented trade claims. Broader injury/coaching/CPU-trade news can be added when those simulation systems provide structured events.
