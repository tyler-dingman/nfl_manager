> Scoring update: the model described in the original audit below has been superseded by [side-aware-v1](parlay-side-aware-scoring.md). See that document for current weights, directional context and alternate-line handling.

# Trending Props: market and score audit

## Stored market classification

SportsGameOdds normalization reads a bookmaker's parent selection and `altLines`. The normalizer groups thresholds across bookmakers and persists `is_alt_line`, normalized keys, and `raw_provider_metadata`. Its grouped flag is false whenever *any* bookmaker representation is primary, so it cannot reliably describe the selected bookmaker by itself.

The read path now classifies each returned sportsbook price using the stored `odd.byBookmaker[providerId]` parent/alternate structure, with exact numeric threshold matching. `mainLine` is taken from that same bookmaker and snapshot. No odds/price heuristics, provider requests, database migration, or destructive changes are involved. A legacy true flag can confirm an alternate; a legacy false flag without bookmaker evidence is explicitly **Unverified**. The raw payload stays server-side. These labels describe the stored snapshot, not a claim of live odds.

## Existing Lab Score (unchanged)

`calculatePlayerPropTrend` weights L10 hit rate 30, L5 hit rate 20, average relative to the selected line 15, opponent history 10 (at least two games), relevant home/away history 10 when supplied, consistency 10, and sample size 5. Unavailable signals are omitted and weights renormalized. Trending Props currently supplies opponent identity but not a home/away selector, so that split term is absent. Usage and defensive ranks provide supporting research but are **not direct score inputs**. Historical hit rate is not a forecast. The score contains no odds-based value model.

**Model limitation:** easier alternate thresholds can produce high hit rates, positive line margin, and high scores. This reflects historical trend strength, not a superior betting opportunity. Juice is not itself rewarded, but the model is threshold-sensitive. This UI update leaves the formula unchanged and makes that limitation explicit.

No existing tiers for this exact score were defined. `trending-context.ts` centralizes new display-only tiers: High 90–100, Good 70–89, Moderate 50–69, Low 0–49. These are descriptive presentation bands, not calibrated probabilities or sample-confidence levels.

## Display policy

The default view keeps one representative threshold per player/event/stat/period/side. A main line receives a five-point *selection preference*; a substantially stronger alternate can still surface. This does not modify its displayed Lab Score. All Lines remains the default classification filter. Show all thresholds restores redundant thresholds, and existing deeper views/Line Ladder retain stored markets. All displayed representative rows are then sorted by the actual score unless users select another sort.

Row explanations are deterministic: qualifying active hit streak first, otherwise L10 hits, plus side-aware L10 average margin. No value claims. Average now explicitly uses L10, matching those explanations. Opponent defense context uses the stored prior-season ranking, with the season exposed; unavailable rankings remain absent.
