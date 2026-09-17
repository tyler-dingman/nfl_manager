# Parlay Lab: SportsGameOdds pregame ingestion

SportsGameOdds is a server-side ingestion source. Browser pages read PostgreSQL through the Down & Distance API and never call the provider.

## Setup

1. Create a SportsGameOdds account and select the free Amateur plan.
2. Copy the API key from SportsGameOdds.
3. Add `SPORTSGAMEODDS_API_KEY=...` to `.env`. Never expose it through a `NEXT_PUBLIC_` variable.
4. Apply `db/migrations/035_parlay_lab_odds.sql` using the normal database migration process.
5. Import the test week: `npm run odds:import -- --season=2026 --week=1`.
6. Alternatively import one known provider event: `npm run odds:event -- --eventId=PROVIDER_EVENT_ID`.
7. Visit `/dev/parlay-lab-test`.

## Free-plan safety guard

- Imports check SportsGameOdds `/account/usage` before every data request. The usage check does not count against provider limits.
- The importer fails closed when usage cannot be verified.
- The hard local ceiling is 1,000 returned objects per rolling month, 40% of the current 2,500-object Amateur allowance.
- A single importer execution is limited to two provider data requests.
- These ceilings can only be lowered with `SPORTSGAMEODDS_MONTHLY_OBJECT_CEILING` and `SPORTSGAMEODDS_MAX_REQUESTS_PER_RUN`; values above the hard defaults are ignored.
- Run imports manually on the Amateur plan. No automatic polling or scheduled odds import is configured.

## Verification

- Confirm the local event is Denver at Kansas City on September 14, 2026.
- Confirm FanDuel, DraftKings, BetMGM, Caesars, and any configured additional books independently.
- Look for Kansas City moneyline, Patrick Mahomes `PASSING_YARDS` over 249.5, and Kenneth Walker III `RUSHING_YARDS` over 49.5.
- Refresh the dev page and confirm no SportsGameOdds request is logged. The page only calls `/api/parlay-lab/test-ticket`.
- Never infer or fake an unavailable line. Markets and locally stored prices remain usable for research and My Parlay when a deeplink is absent; sportsbook handoff is optional.

## Research-first market storage

Before the next manual odds import, apply `db/migrations/039_parlay_lab_research_first.sql`.
The importer then preserves raw metadata for known and unmapped markets and writes
`reports/unmapped-nfl-markets.csv` after a weekly manual import. The next import is configured for
the broad sportsbook set in `SPORTSGAMEODDS_BOOKMAKER_IDS`; no provider request occurs while users
browse Parlay Lab.

Parlay Lab supports FanDuel, DraftKings, BetMGM, and Caesars. Provider requests are restricted to
those four books, including when a stale `SPORTSGAMEODDS_BOOKMAKER_IDS` environment value contains
an unsupported bookmaker.

## Import policy

- Import missing games beginning within seven days.
- Refresh once in the 24-hour window, then once 60–90 minutes before kickoff.
- `final_snapshot_at` suppresses further refreshes.
- `lockStartedEvents()` locks games at kickoff. Started games are never sent through normalization.
- Imports use database upserts for event, market, and sportsbook price identities. Price snapshots intentionally preserve history.

The provider v2 request is NFL-only, pregame-only, includes opposing odds and alternate lines, and limits bookmakers to the free-tier set: `fanduel,draftkings,betmgm,caesars`. Bet365 is intentionally excluded.
