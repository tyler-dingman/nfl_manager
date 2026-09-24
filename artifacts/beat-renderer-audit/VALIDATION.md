# Beat renderer verification

## Scope and evidence

- All 32 team feeds: eight captured real articles each, 256 total. `AUDIT.md` records each family, metadata contract result, accent, and selection/fallback reason; `decisions.json` includes source URLs and field-level extraction evidence.
- Browser checks render these snapshots through the production adapter and actual `/the-beat` route at 390px and 1440px. Checks cover rendered family, required data, accent, Barlow font, equal graphic heights, bounds, number alignment, and centered injury dividers.
- Visual review covered KC, ARI, ATL, BAL, BUF, CAR, CHI, CIN, CLE, DAL, DEN, DET, plus LV. Screenshots are named `{TEAM}-{width}.png`.
- Gallery coverage includes 37 compositions at 280px, 320px and 400px. Labeled fixtures cover reference examples absent from the captured feeds. They are not fabricated live updates.

## Visual findings after correction

- Numbered lists: 10 Things Said, 3 Takeaways, 3×3, and Chiefs Quick Facts use one horizontally aligned number/descriptor unit with responsive gaps.
- Matchups: logos and center week/VS/kickoff stack share a three-column composition. Raiders no-kickoff fixture preserves the full layout without inventing a time.
- Results: Chiefs 33–30 Colts, Chiefs 31–10 Broncos, and Bills 41–31 Lions have explicit team/score ownership. Incidental scores in rankings or player features do not create false Final cards.
- Recap: scoreless Raiders fixture balances the logo with GAME RECAP. The captured live Raiders recap includes a 26–14 final, so it correctly uses Result.
- DJ Moore: name and WR stay related; the status rule and QUESTIONABLE TO RETURN remain together, with IN-GAME UPDATE underneath.
- Injury/inactive: W2 and the report label center around a grid divider. Unknown weeks and totals stay absent.
- Transactions: four directional chevrons remain centered between the team mark and transaction state. A role such as “Wide Receiver” is no longer mistaken for a player name.
- Bengals/Denver coaching, Panthers scouting, and formal depth-chart/mailbag/practice compositions preserve restrained graphics and selected-team accents.
- Dark graphic heights, white headline starting positions, clamped text and action placement remain consistent across the grid. Save, source disclosure, Crew sharing and navigation use the existing behavior.

## Checks

- TypeScript: `npx tsc --noEmit` — passed.
- ESLint on changed Beat components, integration files, audit script and browser tests — passed without warnings.
- Focused unit suite — 132 passed.
- Chromium browser suite — 43 passed (all-team, reference gallery/actions, live classification/filtering/pagination).
- Safari browser suite — 43 passed (same all-team, gallery/actions and live-route checks).
- `git diff --check` — passed.

## Boundaries

These are captured feed excerpts and structured metadata, not an independent audit of every full source article. Live feeds may change. Incomplete required data falls back to Standard; approved topic-only stats and injury-report variants remain complete compositions. Unknown kickoff, jersey, contract and aggregate totals are never invented. Save/Share mutations were intercepted during QA; no messages were sent to real users.
