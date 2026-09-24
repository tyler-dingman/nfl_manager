# Canonical schedule / Beat audit

2026 season: 272 regular-season games (17 per team), 49 preseason games. No determined postseason participants were available from the provider; unknown matchups were omitted. PRE/REG/POST and playoff labels are supported.

Backfill: 2,045 existing stories examined; 654 linked with high confidence. Other stories retain their existing presentation or a safe unresolved matchup.

Database checks: zero duplicate game identities; all 16 existing 2026 NFLverse games preserved. Repeat ingestion succeeded without creating duplicate records.

| Requested case | Linked stories | Week | Canonical kickoff | Status |
|---|---:|---|---|---|
| DEN vs KC | 14 | WEEK 1 | MON · 8:15 PM ET | FINAL |
| NE vs PIT | 7 | WEEK 2 | SUN · 1:00 PM ET | FINAL |
| LV vs LAC | 12 | WEEK 2 | SUN · 4:05 PM ET | FINAL |
| KC vs IND | 7 | WEEK 2 | SUN · 8:20 PM ET | FINAL |
| BUF vs LAC | 1 | WEEK 3 | SUN · 1:00 PM ET | SCHEDULED |
| CAR vs ATL | 9 | WEEK 2 | SUN · 1:00 PM ET | FINAL |
| CIN vs PIT | 3 | WEEK 3 | SUN · 1:00 PM ET | SCHEDULED |
| DET vs BUF | 6 | WEEK 2 | THU · 8:15 PM ET | FINAL |

Both explicit-week and title-only Broncos/Chiefs stories resolve to the same game. Raiders division-matchup articles resolve to regular-season Week 2, not the postseason Divisional Round. Every case above uses canonical away/home ordering. Completed games render stored Final scores; upcoming games show the week/VS/kickoff stack.

## Verification

- Typecheck and scoped ESLint passed.
- 126 focused unit tests passed (adapter, resolver, DST, calendar and sportsbook compatibility).
- 18 Chromium/Safari browser checks passed, including live canonical metadata, identical-game consistency, responsive galleries and existing card actions.
- `BUF-390.png`, `BUF-1440.png`, `CIN-390.png`, `CIN-1440.png` show the live enriched cards.
- `2026.json` records every examined story, resolution reason and resulting metadata.

## Operations

Run `npm run schedule:sync -- --season=2026` to refresh games/scores. The next feed request reflects persisted updates without reparsing kickoff text or re-backfilling game IDs. No external schedule request occurs per card. A new hosted scheduler was not installed. See `docs/canonical-nfl-schedule.md` for migration and refresh details.
