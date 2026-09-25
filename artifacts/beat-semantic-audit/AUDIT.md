# The Beat semantic classification audit

Scope: 2045 stored canonical developments across 32 teams. All rows were reclassified; source categories and articles were preserved.

Visual Analysis before: 881. Dedicated Analysis after: 83. Standard Editorial after: 887.

| Destination from previous visual Analysis | Count |
|---|---:|
| Game Info / Matchup | 7 |
| Player Focus | 80 |
| Player Update | 8 |
| Numbered/List | 0 |
| Stats/Data | 3 |
| Scouting | 0 |
| Coaching | 0 |
| Strategy/Film | 0 |
| Mailbag | 0 |
| Community | 0 |
| Business/Off Field/Event | 11 |
| Other specialized families | 49 |
| Analysis | 62 |
| Standard Editorial | 661 |

Zero migrations mean those formats already overrode the source category before this change. The source-category cohort below includes those existing specialized decisions.

Unchanged source ANALYSIS category: 1207 developments. Their new visual classifications:

| Visual category | Count |
|---|---:|
| Game Info / Matchup | 121 |
| Business/Off Field/Event | 25 |
| Player Focus | 83 |
| Standard Editorial | 661 |
| Mailbag | 42 |
| Player Update | 10 |
| Numbered/List | 42 |
| Other specialized families | 110 |
| Analysis | 62 |
| Stats/Data | 13 |
| Scouting | 9 |
| Community | 27 |
| Strategy/Film | 2 |

Chiefs acceptance: Fan Information → Game Info, IND at KC, WEEK 2, SUN · 8:20 PM ET (canonical schedule). The pregame story stays a matchup after the game finishes. Kenny Chesney → Off Field / EVENT. Kahlil Benson → Player Focus, LT from article, no jersey number available. 10 Quick Facts → Numbered. Interpretive headlines → Analysis.

Validation: classifier/schedule regression and acceptance tests, TypeScript, and browser gallery layout checks at 280/320/400px. Analysis and Events screenshots were visually inspected. before.json and after.json retain individual decisions; summary.json retains machine-readable counts.

Backfill applied to canonical_stories.visual_classification; live feed recomputes decisions with the same classifier and fresh canonical game data.