# Parlay Lab production data parity

## Root cause found on September 15, 2026

Localhost had migrations 035–040 and locally imported nflverse history plus Week 2 SportsGameOdds data. The configured production database had none of the ten Parlay Lab tables. The shared migration runner also stopped at migration 037, so deployments could not apply migrations 038–040. No development fixture or frontend fallback supplied the local data; the local experience read real PostgreSQL rows populated by the existing nflverse and SportsGameOdds importers.

The UI path is:

1. Parlay Lab pages request `/api/parlay-lab/events`, `/api/parlay-lab/events/[eventId]/markets`, and `/api/parlay-lab/research`.
2. Those routes use `src/server/odds/repository.ts` and `src/server/historical-stats/repository.ts`.
3. Current markets come from `sportsbook_events`, `bet_markets`, and `sportsbook_prices`.
4. Research uses `historical_games`, `historical_player_games`, `historical_team_games`, `historical_team_season_strength`, and provider mapping tables.
5. Last-N, averages, hit rates, margins, distributions, matchup context, and trends are calculated dynamically from raw game logs; they are not separate seed tables.

## Production recovery performed

- Applied scoped, idempotent migrations 035–040 with `npm run parlay-lab:migrate -- --database=production --confirm-production`.
- Imported verified nflverse seasons 2024 and 2026 with the existing importer. Week 1 of 2026 is the latest completed week.
- Imported Week 2 markets from SportsGameOdds for FanDuel, DraftKings, BetMGM, and Caesars while provider usage remained below the configured free-tier ceiling.
- Fixed canonical-market collision handling so two provider records that normalize to the same market merge instead of aborting an event.
- Batch-upserted the freshly verified local odds cache into production with `npm run parlay-lab:sync-odds-production -- --confirm-production` after the original row-at-a-time remote path proved impractical.
- Repeated the batch sync and confirmed counts did not increase.

Post-recovery production audit:

- required tables/columns: 10/10 pass
- historical player-game rows: 19,248
- historical teams: 32/32
- seasons: 2024 and 2026
- latest completed game: 2026-09-14, Week 1
- upcoming Week 2 events: 16
- markets: 19,920
- current prices: 32,307
- sportsbooks: 4
- duplicate games: 0
- duplicate player/game stat identities: 0
- orphan player-game rows: 0
- invalid team IDs: 0

The nflverse source also contains defense, special-teams, and other rows that do not map to the application’s canonical player roster. Those rows retain a null `player_id` by design and are excluded from player-specific research. The audit reports them explicitly rather than silently assigning identities. Current unmapped sportsbook player IDs are written to `reports/unmapped-nfl-markets.csv` for roster/mapping follow-up.

## Commands

Read-only audit:

```bash
npm run parlay-lab:audit -- --database=local
npm run parlay-lab:audit -- --database=production
npm run parlay-lab:audit -- --database=both
```

Scoped schema deployment:

```bash
npm run parlay-lab:migrate -- --database=production --confirm-production
```

Historical refresh after a completed week:

```bash
npm run stats:import -- --season=2026 --week=2 --database=production --confirm-production
```

The production commands require `PRODUCTION_DATABASE_URL`; they never log the URL or credentials and refuse mutation without the explicit confirmation flag. Keep `DATABASE_URL` pointed at localhost when using the cache-to-production odds sync. Never point both variables at the same database.

## Deployment order and failure policy

1. Run the production audit and confirm the target is reported as `production`.
2. Confirm the database provider’s normal recovery/point-in-time restore capability.
3. Run the scoped migration command.
4. Run the historical import for completed weeks only.
5. Run the guarded odds importer for the upcoming week, or use the scoped batch sync from a freshly imported local cache.
6. Run the production audit again. A missing table, zero upcoming events, zero markets, fewer than four sportsbooks, duplicates, or orphans is a deployment failure.
7. Validate the protected production site with an authenticated preview session.

`scripts/migrate-auth.ts` now includes migrations 038–040 so the standard migration path cannot silently stop before the current Parlay Lab schema. No Parlay Lab command truncates tables or touches authentication, profiles, saves, trivia, content, commerce, or other user state.
