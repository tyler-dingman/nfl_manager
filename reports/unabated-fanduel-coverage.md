# Unabated → FanDuel coverage audit

Snapshot: 2026-10-10T03:04:55.180Z. Pilot: 2026-10-10T03:03:45.210Z–2026-10-10T03:05:21.320Z. Local PostgreSQL only. Free content partner; account quota remains unconfirmed by the user.

**Recommendation: continue evaluating the hybrid approach, but do not enable transfers.** All 10 pilot selections received provider-reported FanDuel matches; 10 preserved the visible requested attributes. **Zero are independently verified**, because the responses omit direction and do not establish current regional availability or actual sportsbook slip contents. This is a validation gap, not evidence that FanDuel has zero market coverage.

## Scope and baseline

Inventoried **21,020 unique active upcoming selections** across 14 games and 33,189 bookmaker-priced offers. **9,900** have FanDuel pricing; **11,120** do not. Uniqueness uses the existing normalized market ID (event, player/entity, stat, period, side and threshold), not one count per sportsbook. Available means the stored price is marked available and the event is upcoming/unlocked; it is not a fresh confirmation from FanDuel.

Every offer in `unabated-fanduel-audit/baseline.json` includes player/team (null where unresolved), event/kickoff, market/stat, period, side, threshold, book, odds, main/alternate/unknown classification, current computed Lab Score (null when unavailable), and odds update time. Lab Scores were read through the existing service without changing calculations. Main/alternate is book-specific using the stored main and alternate line metadata, with the existing alternate flag as fallback. Unknown is retained rather than guessed.

Anytime touchdowns means full-game `touchdowns` with YES/no numeric line (or 0.5); first/last/period touchdowns and 2+/3+ totals remain Other. Categories include every period in the inventory; the pilot pool is full-game only.

## Market coverage

Exact-match percentages below describe only tested selections. Population coverage is unknown in every category; untested selections are neither successes nor failures.

| Category | DB unique | FanDuel priced | No FanDuel price | Pilot tested | Provider matches | Verified / tested |
| --- | --- | --- | --- | --- | --- | --- |
| Anytime touchdowns | 62 | 60 | 2 | 0 | 0 | Not tested |
| Combined yards | 1,802 | 554 | 1,248 | 1 | 1 | 0/1 (0%) |
| Other existing markets | 5,763 | 3,328 | 2,435 | 1 | 1 | 0/1 (0%) |
| Passing touchdowns | 285 | 160 | 125 | 0 | 0 | Not tested |
| Passing yards | 2,577 | 598 | 1,979 | 1 | 1 | 0/1 (0%) |
| Receiving yards | 6,037 | 2,846 | 3,191 | 3 | 3 | 0/3 (0%) |
| Receptions | 1,613 | 1,048 | 565 | 2 | 2 | 0/2 (0%) |
| Rushing attempts | 350 | 92 | 258 | 1 | 1 | 0/1 (0%) |
| Rushing yards | 2,531 | 1,214 | 1,317 | 1 | 1 | 0/1 (0%) |
| TOTAL | 21,020 | 9,900 | 11,120 | 10 | 10 | 0/10 (0%) |

Established verified mappings across the inventory: 0/21,020; across FanDuel-priced selections: 0/9,900. These are **audit evidence counts**, not population estimates of provider capability. Only 0.101% of FanDuel-priced selections were submitted.

## Standard, alternate and odds bands

| FanDuel line classification | Inventory | Tested | Unverified candidates | Verified / tested |
| --- | --- | --- | --- | --- |
| main | 3,003 | 5 | 5 | 0/5 (0%) |
| alternate | 4,415 | 5 | 5 | 0/5 (0%) |
| unknown | 2,482 | 0 | 0 | Not tested |

| Alternate odds band | FanDuel inventory | Tested | Unverified candidates | Verified / tested |
| --- | --- | --- | --- | --- |
| -100 to -199 | 572 | 1 | 1 | 0/1 (0%) |
| -200 to -349 | 371 | 1 | 1 | 0/1 (0%) |
| -350 to -499 | 197 | 1 | 1 | 0/1 (0%) |
| -500 to -749 | 173 | 1 | 1 | 0/1 (0%) |
| -750 to -1000 | 138 | 0 | 0 | Not tested |
| Below -1000 | 157 | 0 | 0 | Not tested |
| Positive | 2,807 | 1 | 1 | 0/1 (0%) |

The -750 to -1000 band was not submitted. Matching alternates down to -1000 reliably is therefore **not established**. Below -1000 is counted for completeness and excluded from the test pool. Positive odds are reported separately.

## Reproducible sampling and quota gate

Seed: `downanddistance-fanduel-2026-10-10-v1`. The saved sample contains 200 selections, including 130 explicit alternates, drawn from 5,779 FanDuel full-game selections with named players and odds no shorter than -1000. SHA256 seeded order; proportional largest-remainder quotas across category/lineType/side/oddsBand/scoreBand; minimum 50 alternates; touchdown subtypes grouped with Other for sampling only. Pilot maximizes diversity across 5 alternate and 5 standard selections; not population-proportional.

The remaining inventory is not in that eligible sample pool; this is not a census of all periods or all prices. The ten-selection pilot spans five standard and five alternate lines, both directions, varied games/players and high/low/unknown scores. Its diversity selection is not proportional, so its rate must not be extrapolated to the full database. The 200-selection sample remains unsubmitted beyond these ten.

Unabated documents Free access to generation/status, but the reviewed [access-tier documentation](https://docs.unabated.com/start/access-tiers) provides no generation quota, daily cap or traffic capacity guarantee. The user confirmed no account-specific quota is known. Following the requested gate, no additional generation requests or complete-parlay submissions were made.

## Per-selection results

| Player / game | Requested market / selection | Class / DB odds / score | Returned line / odds | Result | Seconds / calls |
| --- | --- | --- | --- | --- | --- |
| Tyjae Spears / HOU @ TEN | Receiving Yards: OVER 29.5 | alternate / 580 / 24 | 29.5 / 580 | Unverified candidate | 8.867 / 5 |
| DeMario Douglas / LV @ NE | Longest Reception: UNDER 14.5 | alternate / -120 / Unavailable | 14.50 / -120 | Unverified candidate | 8.639 / 5 |
| Omarion Hampton / DEN @ LAC | Rushing Yards: OVER 14.5 | alternate / -700 / 76 | 14.5 / -700 | Unverified candidate | 8.489 / 5 |
| Dalton Kincaid / BUF @ LAR | Receptions: OVER 2.5 | alternate / -470 / 61 | 2.5 / -470 | Unverified candidate | 10.646 / 6 |
| Deshaun Watson / CLE @ NYJ | Passing Yards: OVER 174.5 | alternate / -245 / 55 | 174.5 / -235 | Unverified candidate | 10.574 / 6 |
| Kyler Murray / MIN @ NO | Passing and Rushing Yards: UNDER 233.5 | main / -114 / 51 | 233.50 / -114 | Unverified candidate | 10.538 / 6 |
| Bhayshul Tuten / PHI @ JAX | Rushing Attempts: OVER 14.5 | main / -130 / 58 | 14.50 / -130 | Unverified candidate | 12.683 / 7 |
| Zay Flowers / BAL @ ATL | Receiving Yards: UNDER 68.5 | main / -114 / 43 | 68.50 / -114 | Unverified candidate | 8.602 / 5 |
| Tucker Kraft / CHI @ GB | Receiving Yards: UNDER 49.5 | main / -114 / 47 | 49.50 / -114 | Unverified candidate | 8.507 / 5 |
| Pat Freiermuth / IND @ PIT | Receptions: OVER 3.5 | main / 116 / 53 | 3.50 / 114 | Unverified candidate | 8.536 / 5 |


The returned player names, team labels, kickoff times, market descriptions, periods and thresholds match the requests in this pilot. Jacksonville JAX/JAC and Los Angeles Rams LAR/LA were reviewed as team-label aliases. Matching labels do not establish independently resolved provider identity. Deshaun Watson returned -235 versus stored -245 at the same 174.5 threshold; Pat Freiermuth returned +114 versus stored +116 at 3.5. These are price differences, not threshold substitutions. Stored odds predate generation by several hours; this audit did not refresh prices.

## Direction and failure analysis

All ten FanDuel results omit direction. Inspection covered every selection field, bet-type text, metadata (no `additionalInfo` was present), and individual link. Generated links use opaque cache identifiers; they do not expose an outcome. The [current OpenAPI contract](https://data.unabated.com/swagger/v1/swagger.json) has no required side field on `BetslipBet`; its optional metadata does not guarantee one. No documented direct generated-offer-ID-to-outcome resolver was found. Generic `/deeplink` expects current odds market-line IDs, which are not assumed interchangeable with generated offer IDs or SportsGameOdds identifiers.

Consequently, each visible match remains unverified. The returned match count and echoed request text cannot establish Over versus Under. Availability, region support, link lifetime and sportsbook population also lack independent evidence. A generated URL passing host/path checks is not proof that it opens the requested live offer.

In this pilot: 10 unverified candidates; 0 visible mismatches/unavailable results; 0 lifecycle errors; 0 timeouts. No FanDuel threshold substitutions were observed. Other sportsbooks sometimes returned different thresholds despite reporting a match; they were excluded from FanDuel coverage. Earlier diagnostics likewise found substitutions at other books. Do not use another book as a fallback without a fresh exact selection check.

Prior odds diagnostics are retained separately in `unabated-diagnostics.json`: NFL straight odds succeeded, while NFL/MLB props returned HTTP 200 with `success:false` and `Unexpected error while retrieving odds for the provided filter.` Those failures were not retried during this pilot. Text generation functioning independently supports continued hybrid evaluation, not a claim that the props odds endpoint has recovered.

## Complete parlays and sportsbook acceptance

| Scenario | Planned legs | Submitted | Matched / independently verified | Complete populated slip / FanDuel acceptance |
| --- | --- | --- | --- | --- |
| Different-game props | 3 | No—quota gate | Not measured | Not verified |
| Same-game props | 3 | No—quota gate | Not measured | Not verified |
| Different-game alternates | 3 | No—quota gate | Not measured | Not verified |
| Mixed standard/alternate | 3 | No—quota gate | Not measured | Not verified |

Prepared exact selections are retained in `parlay-plans.json`; refresh availability before any later submission. No parlay combination support is inferred from single-selection results. Earlier generic two-game moneyline deep-link diagnostics returned `full_support`, but were not a populated prop-parlay test. The previous account-example browser test reached FanDuel region/login screens; no complete slip was verified and no wager was placed. This pilot does not claim new browser or Android/iOS verification.

The documented SGP quote endpoints are Enterprise-only; they were not called with the Free key. Text generation being available to Free accounts does not itself prove acceptance of an SGP. All four scenarios still need an allowed live generation and actual sportsbook inspection once quota and direction verification are resolved.

## API performance and scale

Measured client latency includes submission, network and two-second polling waits. One lifecycle ran at a time, with no POST retries, at most 25 polls and a 60-second polling deadline. Request intent and IDs were checkpointed; re-running the pilot skips existing selections. HTTP responses and sanitized bodies remain local in `pilot-results.json`.

| Metric | Observed |
| --- | --- |
| API requests | 55 |
| Generation submissions | 10 |
| Status polls | 45 |
| HTTP non-200 / transport failures | 0 |
| Average completion seconds | 9.608 |
| Median completion seconds | 8.753 |
| p95 completion seconds (nearest rank) | 12.683 |
| Lifecycle error rate | 0/10 (0%) |
| Timeout rate | 0/10 (0%) |
| Independently verified match rate | 0/10 (0%) |
| Unverified candidate rate | 10/10 (100%) |
| Requests per returned candidate link | 5.5 |
| Requests per verified usable link | Undefined—zero verified usable links |

These counts exclude previous diagnostics, public-document reads and local database work. The [generation guide](https://docs.unabated.com/guides/bet-slips) documents asynchronous completion and a bounded polling approach; the [five-second shared odds interval](https://docs.unabated.com/guides/errors-and-limits) is not a generation quota.

| Daily generations | POSTs | Estimated status polls | Estimated API calls |
| --- | --- | --- | --- |
| 100 | 100 | 450 | 550 |
| 1,000 | 1,000 | 4,500 | 5,500 |
| 10,000 | 10,000 | 45,000 | 55,000 |

This is a linear illustration of the observed single-selection polling pattern, not a capacity forecast or measured parlay performance. Multi-leg latency, concurrency, retries and polling policy can change usage. Free-tier capacity and costs at all three volumes are **unknown**. Confirm submission/poll quotas, daily caps, concurrency policy and commercial terms before scaling.

## Proposed cache and integration boundary

Keep SportsGameOdds ingestion, PostgreSQL normalization, Lab Score and My Parlay unchanged. Generate a complete slip on demand from the user’s current selections, rather than generate thousands of links during odds ingestion. Deduplicate concurrent requests for the same canonical slip and region, retain the request ID and poll that job instead of resubmitting.

Only after independent validation, a separate mapping cache could store provider/book/region, event ID plus kickoff, player ID, market/stat/subtype, period, direction, exact threshold, generated offer ID and independently resolved sportsbook market/selection IDs, verification evidence/time, source odds timestamp and provider expiry. Include every identity field and region in the key; do not reuse IDs across events or regions.

Cache mappings separately from prices and complete-slip URLs. Invalidate when event, availability, line, direction, region or provider identity changes; recheck current odds at transfer time. Invalidate any cached slip when any leg changes. Link expiration is undocumented here, so no durable lifetime is assumed; initially generate fresh complete slips and reuse only the current in-flight job. A mapping cache cannot replace whole-slip compatibility validation. Unverified evidence stays in local audit files, never production mapping tables.

## Decision and next steps

The hybrid architecture is technically promising: the generation service finds the exact visible FanDuel lines without Unabated props odds. It is not ready for user transfers. Request an explicit outcome/direction field or documented authorized resolver, then validate current regional offers and actual complete sportsbook slips. Obtain quota confirmation before the remaining sample and four parlay scenarios.

The project targets remain provisional: ≥95% verified coverage is a strong candidate; 85–94% requires documented limitations; 70–84% supports only limited rollout; below 70% calls for alternatives. This pilot cannot estimate population coverage against those targets. Missing direction or complete-slip verification independently prevents enabling transfers.

Local configuration uses the repository’s actual identifier `ODDS_PROVIDER=sportsgameodds`, with `ENABLE_UNABATED_INGESTION=false` and `ENABLE_FANDUEL_BETSLIP=false`. No production data/configuration, existing prop records, scoring, UI or transfer buttons were changed in this audit. No API credentials are included in the artifacts.

Reproduce offline report: `python3 scripts/report-unabated-fanduel-audit.py`. Preparation: `node --import tsx scripts/prepare-unabated-fanduel-audit.ts` (local read-only DB). The pilot runner is capped at ten and skips recorded submissions; do not clear its evidence or expand it until quotas are confirmed.
