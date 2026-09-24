# Beat transaction audit

Reviewed 2,045 persisted stories across all 32 teams. Backfilled 60 confirmed named transaction records into `canonical_stories.transaction_metadata`. Source categories, headlines, summaries, navigation and user actions remain unchanged.

## Composition

The shared transaction family now uses a coordinated logo → four chevrons → action flow, followed by player identity and destination/origin. Details use the full available width without a contract; verified contracts add a compact right column. Team logos come from the existing configuration, and the selected card team supplies its accent. Barlow Condensed is retained.

## Requested cases

| Team | Player(s) | Action | Destination / origin |
|---|---|---|---|
| WAS | Van Jefferson | SIGNED | PRACTICE SQUAD |
| CLE | Krys Barnes | SIGNED | PRACTICE SQUAD |
| CLE | Jimmy Horn Jr. | SIGNED | PRACTICE SQUAD |
| CLE | Nathaniel Watson, D'Angelo Ross | ELEVATED | Not asserted |
| BUF | Greg Dortch, Frank Gore Jr. | ELEVATED | ACTIVE ROSTER |
| ATL | A.J. Terrell Jr. | PLACED_ON_IR | INJURED RESERVE |
| BAL | Shedrick Jackson | SIGNED | PRACTICE SQUAD |
| DET | Jalen Mills | SIGNED | PRACTICE SQUAD |
| PHI | Gabe Hall | RELEASED | FROM PRACTICE SQUAD |

Van Jefferson: WAS logo, four gold chevrons, SIGNED, WR, VAN JEFFERSON and PRACTICE SQUAD. The persisted player ID is resolved; a Commanders jersey number is not available, so none is invented. See `WAS-Van-Jefferson-390.png` and `WAS-Van-Jefferson-1440.png`.

## All-team coverage

| Team | Stories examined | Named transactions |
|---|---:|---:|
| ARI | 44 | 2 |
| ATL | 46 | 2 |
| BAL | 84 | 2 |
| BUF | 53 | 3 |
| CAR | 73 | 3 |
| CHI | 69 | 1 |
| CIN | 56 | 2 |
| CLE | 79 | 7 |
| DAL | 114 | 0 |
| DEN | 46 | 3 |
| DET | 64 | 1 |
| GB | 77 | 1 |
| HOU | 47 | 0 |
| IND | 72 | 4 |
| JAX | 52 | 2 |
| KC | 173 | 0 |
| LAC | 54 | 2 |
| LAR | 62 | 0 |
| LV | 62 | 2 |
| MIA | 43 | 0 |
| MIN | 58 | 4 |
| NE | 44 | 3 |
| NO | 69 | 0 |
| NYG | 83 | 4 |
| NYJ | 57 | 4 |
| PHI | 49 | 3 |
| PIT | 64 | 0 |
| SEA | 78 | 2 |
| SF | 48 | 0 |
| TB | 74 | 2 |
| TEN | 33 | 0 |
| WAS | 18 | 1 |

## Data boundaries

- Structured graphics take priority. The server then resolves unique exact player identities against the existing persisted roster dataset. Article positions and explicit actions remain available even when no roster match exists.
- Jersey numbers are used only when verified for the transaction team. No current jersey data was available for the Van Jefferson case.
- Old roster contract values are not treated as a newly signed contract. Only supplied structured terms or explicit paired term/value in the article are displayed.
- Multiple players sharing an action can appear together. Mixed/unnamed roster actions remain roundups. Uniform releases, depth-chart publications and broadcast agreements are not player transactions. Injury participation news stays separate from IR placement/activation.

## Verification

Typecheck and scoped ESLint passed. 127 focused unit tests passed, including all 32 teams across SIGNING/PRACTICE/ROSTER/INJURY/STANDARD source labels, action priority, multi-player names, false-positive exclusions and roster enrichment. Chromium/Safari checks passed for the requested live cases, loaded logos, 280/320/400px galleries, existing actions and API classification. All 60 backfilled transaction cards passed geometry and four-chevron checks at mobile and desktop widths in both browsers (34 distinct browser checks overall; loaded-logo checks also re-run separately).

## Reproduce

`npx tsx scripts/backfill-beat-transactions.ts` applies migration 043 and re-runs the audit/backfill against the configured database. `stories.json` contains per-story decisions and evidence. Live list/detail responses enrich through the same shared server adapter; there is no per-card external player API request.
