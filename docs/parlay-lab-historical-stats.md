# Parlay Lab historical statistics

Parlay Lab stores raw NFL game results separately from the current sportsbook market database. Current lines and prices come from the already-imported sportsbook tables; historical research never calls SportsGameOdds.

## Source and seasons

The importer uses nflverse/nflfastR-compatible game and season-specific weekly player-stat CSV releases. By default it downloads one maintained `stats_player_week_{season}.csv` asset per requested season. Override source URLs for mirrors or local test servers with `NFLVERSE_GAMES_URL` and `NFLVERSE_PLAYER_STATS_URL`.

## Setup and import

Apply `db/migrations/036_nflverse_historical_stats.sql`, then run:

```bash
npm run stats:import -- --seasons=2024,2025
```

Other supported forms:

```bash
npm run stats:import -- --season=2025
npm run stats:import -- --season=2026 --week=5
npm run stats:import -- --seasons=2024,2025 --dry-run
npm run stats:import -- --season=2025 --players-only
npm run stats:import -- --season=2025 --teams-only
```

Imports use conflict updates and can be rerun without creating duplicate games or stat rows.

## Tables

- `historical_games`: provider schedule identity, teams, venue, and final score.
- `historical_player_games`: one raw statistical row per player appearance and game.
- `historical_team_games`: reliable team totals derived from weekly player data, plus schedule points.
- `provider_player_mappings`: NFLVERSE identity mapped to an existing Down & Distance player with a confidence method.
- `provider_team_mappings`: historical provider code mapped to the canonical team abbreviation.

Raw game values are stored instead of precomputed prop outcomes. A 287-yard passing game can therefore be evaluated later against 224.5, 249.5, 274.5, or any other current line without reimporting history.

## Player mapping and unmatched players

Mapping order is an existing provider ID, normalized name + team + position, then normalized name + position. Ambiguous and unmatched identities remain nullable rather than being silently assigned. Review `reports/unmatched-nflverse-players.csv`, correct/add a `NFLVERSE` row in `provider_player_mappings`, then rerun the import.

Historical rows preserve the player's team at the time of each game. Trades do not rewrite prior-team history.

## Trend definitions

The centralized stat resolver supports passing yards/TDs/completions/attempts/interceptions, rushing yards/attempts/TDs, receiving yards/receptions/TDs, rushing + receiving yards, and anytime TDs. Anytime TD includes rushing and receiving touchdowns, not passing touchdowns.

OVER evaluates `actual > line`; UNDER evaluates `actual < line`. Last 5 and Last 10 use the most recent qualifying games, including postseason. Season, two-year, opponent, and home/away splits are calculated dynamically. Trend Score is a 0–100 research-ranking composite, not probability. Sample confidence is LOW below five games, MEDIUM for 5–9, and HIGH at 10 or more.

## Known limitations

- A missing provider statistic remains null; it is not automatically converted to zero.
- The weekly source does not always distinguish every inactive/dressed edge case. Rows absent from the source are excluded; present zero-stat rows are included.
- Opponent league rank is emitted only when all 32 teams have comparable values.
- Current odds still require a prior sportsbook import, but historical import, calculations, and tests do not require `SPORTSGAMEODDS_API_KEY`.

## Adding 2026

Append a completed week with `npm run stats:import -- --season=2026 --week=5`. No automatic polling is configured.
