# Side-aware Parlay Lab research scoring

## Audit of the pre-change implementation

Traced `trend-service.ts`, `prop-side-research-service.ts`, the research API, rank importer/aggregation, and UI consumers before modifying scoring.

- Table and modal hero use `summary.trendScore`: L10 hit rate weight 30, overlapping L5 20, all-history signed average margin 15, player-vs-opponent hits 10 (minimum two games), relevant home/away hits 10, consistency 10, sample tier 5. Missing factors are removed and remaining weights rescaled. Table omitted home/away input; modal supplied it, so these could disagree.
- Defensive rank is **display-only for that score**, not an indirect input. Current streak and median are display-only. Odds and line classification are ignored. Selected threshold affects hit rates, margin and even consistency (standard deviation divided by line), making easy alternatives saturate.
- Separate modal `labMatchScore` blends that score (50), miss-context (15), rank/32 (20), position-opponent hits (15), rising usage (8), line margin (8), consistency (8), regex interpretation of script prose (4), and venue hit rate (5). Rank and usage were not side-aware. Margin, consistency and histories were double-counted. Small opponent samples were not adequately attenuated.
- Lab Find is a third internal score: recent form 25, cushion 20, usage 15, consistency 15, player-opponent 10, two-year hits 15. Usage and hits are side-aware, but recent/all-history/consistency overlap and defense was absent. Qualification requires five games, score 80, opposite-side gap 15, and three signal groups.
- Day/night/rest and game environment are descriptive in the primary score. Spread script and venue only affected the separate modal score. No EV or win-probability model exists.
- `opponent-vs-position-service.ts` calls `didHit(value,line,side)`: already side-aware. Primary QB/lead RB and target-qualified WR/TE samples are not interchangeable with team defense ranks.

## Verified rank provenance

`importer.ts` aggregates stored player attempts/carries/yards into `historical_team_games` from historical source rows. `team-season-strength-service.ts` joins each team's opponent in the same regular-season game, averages opponent passing/rushing yards and points, and ranks allowed averages **ascending**. Thus #1 = fewest allowed, #32 = most allowed. Passing yards are aggregated player passing yards (not net yards after sacks). Rush/pass labels refer to team yardage allowed, not positional, attempts, receptions, interception or TD defense. Missing source yardage is currently coalesced to zero by the existing aggregation; historical source completeness remains a limitation. Prior-season context is contextual evidence, not a current-season forecast.

## Revised model (side-aware-v1)

`research-score.ts` is the single pure scoring source. Table `trendScore`, research summary/hero and legacy `labMatchScore` now agree. Lab Find uses this score for both sides and counts historical evidence as one supporting group instead of multiple correlated votes. Threshold metadata and sportsbook are passed consistently into the modal request. All data remains local/stored; no external odds calls, database changes or data refreshes are added.

The model is an explicitly heuristic research ranking, not a calibrated probability, forecast, EV or price-value model. Versioned parameters allow later validation/tuning:

- Score starts at 50. Recent historical adjustment is bounded ±40. L10 hit evidence (65%) and standardized mean cushion (35%) share that one budget; L5 and streak are descriptive, not additional votes. Median is reported but not separately scored.
- Historical evidence is attenuated by `min(n/10,1)` and by variability reliability `0.75 + 0.25/(1 + SD/max(abs(mean),1))`. Consistency is a reliability multiplier, never a standalone bonus. No observations means no directional evidence, not a failure.
- Standardized cushion uses `max(SD,20% of baseline,1)` as scale. A material displacement consistent with the rank's production direction halves the cushion contribution. This recognizes possible context, without asserting sportsbook reasoning or observed line movement.
- Rank is continuous: `(rank - 16.5)/15.5`, sign reversed for Under. The neutral label covers a narrow band around zero; adjustments remain continuous. Appropriate yardage context contributes at most ±8 points. Attempts/completions use broad yardage context at only ±3, never a specialized attempts/reception rank.
- Usage compares the last five versus previous five opportunities (requires ten observed usage games), sign reversed for Under, capped ±5. No injury, snap-share or depth-chart assumptions are fabricated.
- Stored primary full-game spread provides at most ±2: RB rushing volume and QB passing volume only, with side inversion. Other script mappings stay unknown. No prose/regex is used as a score input.
- All contextual adjustments are also attenuated by player sample reliability. Unknown matchup/usage/script adds zero, not a synthetic negative value.
- Position-vs-opponent hits already use the selected side and remain descriptive research, **not another scored factor** stacked on team defensive rank. Player-opponent, home/away, venue, environment and miss-context also stay descriptive to avoid counting subsets of the same history as independent evidence. Displayed confidence describes sample size, not confidence of winning.

## Market / position mapping

| Market | Required position | Scored opponent context |
|---|---|---|
| Passing yards | QB | Team pass yards allowed, ±8 |
| Passing attempts/completions | QB | Broad pass yardage context only, ±3; usage/script separately limited |
| Rushing yards | RB | Team rush yards allowed, ±8 |
| Rushing attempts | RB | Broad rush yardage context only, ±3; usage/script prioritized |
| Receiving yards | RB/WR/TE | Broad team pass yards allowed, ±8; not position-specific defense |
| Passing/rushing/receiving TDs, interceptions, receptions | Any | Unknown: no suitable specialized rank in stored schema |
| Passing+rushing, rushing+receiving yards, anytime TD | Any | Unknown: total team yards/points are not an appropriate player combined/TD metric |
| Unrecognized or mismatched position | Any | Unknown |

Legacy broad defense ranks may still be shown as explicitly labeled yardage context. They do not imply a specialized positional metric or score support for unsupported markets.

## Main / alternate thresholds and price

Same-book known main line anchors every threshold-dependent scoring input (hits, cushion, line-displacement comparison). Selected-line L5/L10, averages, streak, graph and adds remain exact. Thus a ladder of easier alternative thresholds has the same research score rather than an automatic progression toward 100. This is an anchor, not a claim all alternatives have equal value. Without verified main context, historical score evidence is attenuated to 75%; we never infer a main line from price. Main/alternate/unverified badges and classification are unchanged. Odds remain visible but do not affect this non-EV research score.

## Explainability / checks

`summary.researchScore` returns version, signal alignments, additive adjustments, sample reliability, selected-line delta, baseline/median, scoring threshold and alternate-to-main delta. Table uses a compact conflict indicator with tooltip. Modal shows side-specific matchup language, context in Lab Insight and an expandable score explanation. No table row-height change.

Verified the local stored Javonte Williams Under 17.5 attempts example: L10 average 6.1, line delta +11.4, WAS 2025 rush rank #32 → Works Against Under. Table and modal both return 79 with current stored usage/spread context, retaining the displayed 10/10 trend. This is a consequence of the general model, not a player-specific rule.

53 focused tests pass, covering inverse side/rank signals, neutral ranks, unknown metrics/positions, missing data, small player samples, opposing-position side inversion, smaller rushing-attempt rank influence, usage/script inversions, alt saturation, Lab Find consistency, historical research and line classification. Model scores are not empirically calibrated and should not be read as outcome probabilities.
