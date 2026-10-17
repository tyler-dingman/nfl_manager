# Three-leg FanDuel parlay test

**Complete candidate. Awaiting manual FanDuel verification.**

The user reports that the earlier Tyson Bagent Over 216.5 single populated correctly in FanDuel Iowa. This is user-reported evidence for that specific single; no new screenshot of it was supplied with this test. This report does not extend that confirmation to the three-leg slip.

## Original database selections

| Leg | Player | Game / kickoff UTC | Selection | Class | Stored FanDuel odds |
| --- | --- | --- | --- | --- | --- |
| 1 | Ty Johnson | BUF @ LAR / 2026-10-13T00:15:00.000Z | UNDER 11.5 Receiving Yards | main | -114 |
| 2 | Justice Hill | BAL @ ATL / 2026-10-12T00:20:00.000Z | OVER 0.5 Receptions | alternate | -470 |
| 3 | Tory Horton | SF @ SEA / 2026-10-11T20:25:00.000Z | UNDER 11.5 Receiving Yards | main | -114 |

All three markets are full game, from different upcoming unlocked events, with different resolved player IDs and stored available FanDuel prices. The alternate leg is between -200 and -1000. Selection favors most recently updated eligible records. Classification uses stored FanDuel main/alternate thresholds; no lines or prices were fabricated. Market team_id is null in these records; named-player identity is resolved by the existing provider mapping and player_id, and event teams are preserved.

| Player | Market ID | Player ID | Event ID | Stored odds updated UTC |
| --- | --- | --- | --- | --- |
| Ty Johnson | 223b8436-0b17-4359-8fc4-6aca884339d8 | 3915411 | 9da4177e-1b33-419e-97b5-714b2c591348 | 2026-10-09T20:45:11.731Z |
| Justice Hill | cc7f9126-d3e7-47a7-91cb-2d7482c60858 | 4038441 | 36d43a98-a10d-4b71-82c7-0d196a0bfbff | 2026-10-09T20:45:09.504Z |
| Tory Horton | 58fc8ef7-5962-41df-bc8c-1cbefe0ec3e5 | 4597703 | 647675a9-3187-46f5-b9c0-375a2fae4e62 | 2026-10-09T20:45:07.298Z |

Stored availability is not independently refreshed FanDuel availability. These odds were updated several hours before generation. Full original records are preserved in `unabated-three-leg-audit/selections.json`. No ingestion or database writes were performed.

## Generation

One POST to `/api/v1/bet/generate`, with all three selections together. Iowa and full-game requirements were included in `content.text`; only documented request fields (`type`, `generateMobileLinks`, `content.text`) were used. Same-key bounded status polling followed the [official workflow](https://docs.unabated.com/guides/bet-slips). No automatic POST retry, no individual-link stitching, no additional generations.

| Field | Observed |
| --- | --- |
| Request ID | 09fc21b9-00a6-46f7-904a-4e3b7f193979 |
| Lifecycle | Complete |
| HTTP statuses | 200, 200, 200, 200, 200, 200, 200, 200 |
| Sportsbook | FanDuel |
| Legs requested | 3 |
| Legs matched | 3 |
| Returned individual selections | 3 |
| Provider combined odds (unverified) | 327 |
| Generation time seconds | 15.213 |
| API requests | 8 |
| Status polls | 7 |
| HTTP / transport errors | 0 |
| Lifecycle errors | 0 |

Sanitized raw responses, exact prompt, per-call timings and request checkpoint are retained in `unabated-three-leg-audit/pilot-results.json`. Polling was bounded to 25 polls and a 60-second polling deadline. A local syntax error was corrected before the process made any network request; the captured ledger contains exactly one generation POST.

## Matching results

| Player | Player / game / kickoff / market / threshold / period / book | Requested direction | Returned direction | Returned odds |
| --- | --- | --- | --- | --- |
| Ty Johnson | All match | UNDER | Missing—pending manual verification | -114 |
| Justice Hill | All match | OVER | Missing—pending manual verification | -470 |
| Tory Horton | All match | UNDER | Missing—pending manual verification | -114 |

Matching compares all returned selections against original values, including exact numeric thresholds and scheduled kickoff. LAR/LA is treated as the reviewed Rams team-label alias. Three matched legs alone do not establish success. Missing structured direction is explicitly unresolved; the actual regional sportsbook slip and combined-parlay acceptance require manual verification.

## Generated link

Original returned Gambly URL: https://gambly.com/deeplink/deeplink-cache-v2-20261010-4099f1830f0a0f3088cdbfb580aac683

[Open Complete Parlay in FanDuel](https://gambly.com/deeplink/deeplink-cache-v2-20261010-4099f1830f0a0f3088cdbfb580aac683?utm_campaign=downanddistance)

https://gambly.com/deeplink/deeplink-cache-v2-20261010-4099f1830f0a0f3088cdbfb580aac683?utm_campaign=downanddistance

The requested `utm_campaign=downanddistance` was added through URL query parsing, preserving the original generated path and any existing parameters. No substitute FanDuel URL was constructed. This verifies parameter presence only, not credited click attribution. The original URL is retained alongside the attributed URL.

## Performance

This request completed in 15.213 seconds versus the previous single-leg pilot average of 9.608 seconds: +5.605 seconds (+58.3%). This describes one observation; it cannot establish a material systematic multi-leg slowdown or support capacity/scalability extrapolation.

## FanDuel verification

**Pending manual verification.** The user will open the link in their existing Iowa account. No browser opening, login, location workarounds or wagers were performed by this test. Confirm all three players, games, markets, directions and thresholds, then that FanDuel combines them into one three-leg parlay with combined odds. Update this report only after the user provides confirmation or a screenshot. One confirmed combination would establish feasibility only for that combination.

## Preserved configuration

`ODDS_PROVIDER=sportsgameodds` · `ENABLE_UNABATED_INGESTION=false` · `ENABLE_FANDUEL_BETSLIP=false`. Local configuration was checked, not changed. Production records/configuration, ingestion, Lab Score and Parlay Lab UI were untouched. No transfer button was enabled.

Diagnostics: `scripts/prepare-unabated-three-leg-test.ts`, `scripts/generate-unabated-three-leg-test.mjs`, and the offline `scripts/report-unabated-three-leg-test.py`. Saved checkpoints prevent the generation script from resubmitting this test.
