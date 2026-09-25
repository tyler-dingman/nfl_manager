# Canonical NFL schedule

The existing `historical_games` table is the canonical game store. Migration 042 extends it with ESPN event identity, state, overtime, venue, broadcast, and kickoff confirmation; PRE joins the existing REG/POST season types. Existing UUIDs and player/team-stat foreign keys remain intact. Team IDs retain the existing stats/provider mapping IDs (KC, DEN, etc.), never team-name strings. A unique season/type/week/home/away index prevents different providers creating duplicate games.

`src/server/schedule/repository.ts` exposes `listCanonicalGames` as a batch read for editorial, schedule, search and other server consumers. Front Office's real regular-season schedule lookup now prefers it while retaining the ESPN event IDs expected by existing saves. Simulated results and generated fallback schedules are never imported into the editorial store.

## Import and refresh

```sh
npm run schedule:sync -- --season=2026 --migrate --backfill
npm run schedule:sync -- --season=2026
```

The first command applies the additive migration, imports and backfills the configured database. The second refreshes schedule changes, current state and scores, without reprocessing articles. Use the refresh command in the deployment's existing scheduler; no new hosted cron job is installed by this change. `--dry-run` checks coverage without importing (do not combine with `--migrate` if no schema changes are wanted).

Source: the same free ESPN scoreboard endpoint already used by the Front Office calendar (`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`). Two calendar years cover the entire season. Imports require all 272 regular-season games, all 32 teams and 17 games per team before writing; writes are transactional. Current ingestion supports 2021+ 17-game seasons. Unknown playoff participants are not fabricated. Future postseason games enter this same schema once teams are determined.

ESPN IDs are stored alongside existing NFLverse IDs. NFLverse stats ingestion upserts the same natural game identity and retains confirmed ESPN kickoff timestamps. Reimports update records rather than creating new identities.

## Story resolution

`resolve.ts` matches selected team and a single reliable opponent, then uses explicit ID, explicit week, explicit game date, or a unique game within ten days of publication. A nearest-game tie within three days remains unresolved. Explicit week/date conflicts never fall through to a different match. PRE/REG/POST are separate; “divisional matchup” is not a playoff round and “since 2020” is not a season declaration.

`canonical_stories.game_id` references the game; `game_resolution` records confidence, method and reason. Batch enrichment runs for the Beat list and legacy briefing detail endpoints, including newly encountered stories. Backfill processes existing season stories and persists decisions only for game-related subjects. Unrelated story content is unchanged.

Enriched `game` metadata includes gameId, season, week, selected team, opponent, away/home teams, homeAway, kickoffAt, dayOfWeek, kickoffDisplay, weekDisplay, gameStatus and scores. The visual adapter uses that object, not article text, for a resolved matchup/result. List/scouting and other editorial identities retain their family while receiving game context. Unresolved stories retain existing safe fallbacks.

All resolved game graphics use away-left/home-right ordering. Completed games use canonical scores and FINAL / FINAL · OT. Eastern display uses America/New_York (DST-aware) and the editorial ET suffix. Unconfirmed kickoff times are omitted. Postseason labels are WILD CARD, DIVISIONAL, CONF CHAMP and SUPER BOWL.

## Freshness

Cards make no external schedule request. The server reads persisted games once per batch, rather than caching a copied kickoff/score on each story. Schedule updates therefore appear on the next feed request without re-backfilling game IDs. Refreshing the provider is a separate ingestion operation.

## Production NEXT UP troubleshooting

On September 25, 2026, production had historical game rows but lacked all six columns from migration 042 (`espn_event_id`, `status`, `kickoff_confirmed`, `venue`, `broadcast_network`, `overtime`). Local already had the migration. This caused the NEXT UP query to fail rather than return an empty schedule. Applying the existing migration and running the existing 2026 sync repaired production (272 regular-season games plus 49 preseason games). Existing game UUIDs were preserved.

For another deployment, run `npm run schedule:sync -- --season=2026 --migrate` with that environment's `DATABASE_URL` and existing server auth configuration; never assume a code deployment applies database migrations. Subsequent refreshes omit `--migrate`. No new provider, API key, homepage dataset, or browser-side external request is required. The sync is still an operational job: this repository does not currently schedule the canonical schedule refresh automatically.

NEXT UP logs the selected team, canonical source, returned game count and safe database failure codes. Schema errors identify migration 042; missing configuration logs variable names only. Saved Parlay Lab market lookup errors return the game with null betting data. A missing venue also leaves the matchup usable. Production-equivalent route checks resolved KC at MIA, PHI at CHI, and LAC at BUF after the repair.

## Verification

See `artifacts/beat-schedule-audit/2026.json` for per-story links, reasons and resulting metadata; `AUDIT.md` in that folder records requested case checks and season coverage. Unit tests cover DST, postseason labels, rematches, conflicts, ambiguous/missing opponents, stale article scores, canonical ordering and fallback behavior. Browser tests cover the live schedule-enriched route on mobile and desktop and existing gallery/action behavior.
