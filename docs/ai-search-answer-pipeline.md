# AI Search answer pipeline

## Why the old answers were unrelated

`/api/search` previously ran PostgreSQL full-text search and optional BGE 384-dimensional embeddings over `search_documents`, fused rankings with reciprocal rank fusion, and summarized the top results. The index contains stories, articles and player bios, not authoritative schedules or odds. Team filtering established relevance to a team but did not establish relevance to the requested fact. The default deterministic answer generator concatenated source sentences. Optional Ollama generation used a generic document-answer prompt. There was no game reference across turns, source-specific freshness check, or structured fact plan.

## Current flow

`POST /api/search` with `includeAnswer: true` routes through `answerSearch`:

1. Resolve the selected team, explicit team mentions and compact previous context.
2. Classify obvious questions deterministically. Optionally ask local Ollama to classify ambiguous wording.
3. Build a source plan before fetching anything. Schedule/score/odds questions never fall back to general article search.
4. Fetch structured evidence, then any planned supporting news.
5. Rank recent reporting by source reliability/tier, importance, recency, impact and corroboration. Cluster duplicate developments before expanding the 24 → 48 → 72-hour window. Shared team names alone do not merge stories.
6. Render factual answers deterministically. Use closed-book Ollama synthesis for narrative answers when configured, requiring known evidence IDs, exact supporting excerpts, basic numeric/entity checks and a separate entailment review.
7. Return a direct lead, typed blocks, source provenance and compact context. The UI renders game cards, odds cards, bounded tables, paragraphs, bullets and original-source links.

The legacy hybrid/fallback entry points also delegate answer requests to this engine. Ordinary result-only search retains the existing hybrid index. No database migration is required by this change.

## Sources and freshness

| Data             | Source                                                           | Behavior                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schedule/results | ESPN team schedule, preseason/regular/postseason                 | 120-second fetch cache; explicit TBD, postponed, live and final statuses; no synthetic schedule fallback                                               |
| Standings        | ESPN                                                             | Current NFL season; conference seed and record; no fabricated playoff probability                                                                      |
| Roster/injuries  | ESPN                                                             | Roster experience identifies rookies; injury entries require a reported date in the last 7 days; absence is not proof of fitness                       |
| Transactions     | NFL.com official ledger                                          | Recent first page for each transaction category, 15-minute fetch cache; not a complete historical archive; includes previous month at month boundaries |
| Odds             | Existing `sportsbook_events`, `bet_markets`, `sportsbook_prices` | Exact teams/kickoff; game-period main lines only; available/unlocked prices; maximum age 3 hours; provider and timestamp displayed                     |
| Stats            | Existing nflverse historical-stat tables                         | Imported season totals, explicitly labeled non-live and through-week where known; unsupported career/snap-count questions return unavailable           |
| News             | Published canonical stories and original-source evidence         | Source reliability at least .75, excludes tier C, maximum 72 hours; breaking claims require tier A                                                     |
| Prospects        | Existing 2027 Tankathon board                                    | Explicit draft year and source-update date                                                                                                             |

Search does not request additional SportsGameOdds data or paid model inference. Answers are not cached across users; the API sends `Cache-Control: no-store`. Public provider fetches use shared short-lived caches. ESPN/NFL requests time out after 8 seconds. Partial provider failures preserve available evidence; missing facts remain explicitly unavailable.

## Conversation and UI

The request accepts selected team, current team, last intent, last referenced game, last opponent and bounded entity names. It does not accept a client-supplied odds/schedule fact as evidence. Changing the selected team clears context and aborts pending requests. Unknown game references do not silently select another betting event. The browser timezone is supplied for kickoff display, with a team-local fallback.

Verified behavior: `When do the Chiefs play?` → `What is the over under?` resolves one game; `Who do they play after that?` advances to the following game. Missing fresh odds return a clear unavailable response.

## Model configuration and limits

`SEARCH_ANSWER_PROVIDER=deterministic` remains the default and produces structured factual answers and a concise briefing outline. For narrative synthesis, configure a reachable local Ollama host:

```
SEARCH_ANSWER_PROVIDER=ollama
SEARCH_LLM_BASE_URL=http://127.0.0.1:11434
SEARCH_LLM_MODEL=qwen2.5:3b-instruct
```

Existing local-host validation applies. A Vercel function cannot reach Ollama running on a developer laptop via `127.0.0.1`; deployment needs an intentionally supported inference architecture. No model was installed and no hosted inference service was added by this change. Each model call times out after 12 seconds; failed or rejected synthesis returns the factual fallback. Automated entailment checks reduce unsupported claims but are not a mathematical guarantee of factual correctness.

Current data limits are deliberate: draft-pick ownership and playoff-probability feeds are not connected, simulation save data is not used as real NFL evidence, imported statistics can lag, and rookie analysis is limited to available recorded production and recent reporting. General questions without sufficient fresh evidence remain unavailable. The supplied brief ended partway through its model-prompt section; the implemented prompt follows the complete requirements above it.

## Validation

- `npm run test:search`: intent routing, follow-up context, source failures, stale odds, invalid reference handling, team changes, zero scores/TBD times, clustering, citation/claim rejection, transaction parsing and mocked Ollama review.
- `npx tsc --noEmit --incremental false` and scoped ESLint.
- Local API exercised against schedule, standings, injuries, transactions and imported stats.
- Browser-tested the three-turn conversation on localhost and checked layouts at 1280, 390 and 320 pixels without horizontal overflow.
- Live Ollama narrative quality has not been evaluated; the synthesis transport and validation paths are tested with controlled responses.

## Stored betting update (2026-09-19)

This replaces the original three-hour odds rejection described above. Search now returns the latest usable **stored** prices for the exact upcoming/referenced game even when several hours or days old. It displays the original price timestamp and warns when prices are at least three hours old. It never calls them live. Locked/started events, unavailable prices, unknown books, invalid/future timestamps and unmapped markets are excluded. Whole-game totals require the `all` entity, preventing a team total from being presented as the game total. Alternate player lines are labeled.

### Audit and isolation

- External requests originate in `src/server/providers/sportsGameOdds.ts`. `sportsbookIngestionService.ts` uses that client; the explicit import scripts call the ingestion service. Those paths and their quota guards are unchanged.
- Parlay Lab's events, market and research routes use `listLocalOddsEvents`, `getLocalEventMarkets` and historical-stat readers. These existing getters query storage; they do not refresh missing odds.
- The reused storage is `sportsbook_events` (teams/kickoff/lock), `bet_markets` (market/entity/player/period/side), `sportsbook_prices` (book/current stored line/price/availability/update time), `provider_player_mappings` (player names), plus existing `sportsbook_price_snapshots` for ingestion history. No second database or schema change.
- `src/server/search/stored-betting.ts` is the dedicated SELECT-only adapter. Its only runtime imports are the database connection and static sportsbook configuration. It has no provider, ingestion, refresh, queue or network capability. Missing rows stay missing.
- Betting intent routing includes total/spread/moneyline/snapshot, favorites and player props. Selected-team and last-game context still resolve the matchup before storage is read. A timestamp match prevents mixing different meetings between the same teams.
- Analytical hit-rate questions have a separate intent and explicitly report that a verified historical calculation is unavailable. They do not substitute a current line or generate an unsupported percentage.
- Development logs contain intent, team, resolved game ID, stored-data result, age and `external_fetch:false`; they contain no keys or credentials.

### Validation and present limits

Search tests spy on all public SportsGameOdds client request methods and assert **zero calls**, including repeated queries, stale data and missing data. The adapter test forbids network access and guards its import allowlist. Existing odds normalization/ingestion/client quota tests still pass. Local API checks returned stored totals, spreads, favorites, snapshots and Mahomes passing props with original timestamps.

Player matching currently requires a stored provider player name and the selected/referenced game's markets. Ambiguous or unknown player names return unavailable. Game answers show a coherent single-book snapshot; prop answers show up to 20 stored selections with alternate lines labeled. Quarter/half markets, unmapped markets, suspended prices, completed-game betting quotes and historical hit-rate analysis are not presented as current game lines. Search neither refreshes nor imports any of these missing markets.
