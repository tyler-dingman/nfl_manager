# The Beat card integration

The live `/the-beat` feed opts into `HuddleStoryCard appearance="beat"` from
`team-content-hub.tsx`. Homepage and Game Day consumers retain the legacy default.
The selected feed team controls accents and ghost branding, not the story's subject.
Opponent/transaction logos use `TEAM_LIST` and retain their authorized colors.

`beat-model.ts` defines the structured family contract, validates required fields,
normalizes all 32 app IDs and aliases, and selects stable Standard A–D fallbacks.
The production `/api/content/huddle` route calls `adaptBeatStory` with canonical
headline, summary, whatHappened, category, team and source metadata. The hub passes
its decision to the card. Standalone cards use the same adapter as a fallback.
Display category is separate from the unchanged feed/filter category.

The adapter prefers validated structured graphics, then constrained explicit editorial
formats and sourced text. Each extracted fact carries its field, value, source field,
and excerpt; decisions retain source URLs, timestamp, selection reason, and a
diagnostic fallback reason. Team-score pairs use left/right display order, never
implied home/away. Nothing is borrowed from unrelated articles.

Complete variants support no-kickoff matchups, scoreless recaps, roster roundups,
one-stat/topic cards and injury reports without totals. Player Focus requires a
name and position; Player Update requires a name and status. Transcripts without
an attributed useful quote fall back to Standard. Optional jersey numbers, kickoff
and contract details are omitted when unavailable. The card validates the final
decision again before rendering, including decisions received from the API. DNP, week-to-week and in-game
questionable-to-return retain their meanings. Community context precedes coach/draft
keywords; publishing a depth chart is not a player release.

`beat-graphic.tsx` consumes the supplied manifest's shared/family layer order,
live-text coordinates, with deliberately quieter shared texture and diagonal layers. `beat-assets.tsx` contains trusted build-time
JSX, not runtime fetched SVG or untrusted HTML. Regenerate from the repository root:

```sh
python3 scripts/generate-beat-assets.py
npx prettier --write src/components/beat/beat-assets.tsx
```

`beat-font.ts` loads actual Next Barlow Condensed normal 500/600/700/800 and applies
its generated variable only to graphic tops. Front Office's 800 normal/italic
integration is unchanged. The editorial body retains the site's ordinary sans-serif.

## Composition decisions

- One consistent column width, including lead cards, follows the four-column sheet.
  Lead graphics never stretch across two columns. The live feed uses four columns
  at large desktop widths, three at laptop widths, two on tablets and one on phones.
- The supplied normalized 320×180 canvas governs both reference sheets. All layers
  share its aspect ratio; semantic text stays HTML. Long video titles and transaction
  names use smaller type within their slots; oversized player identities fall back.
- The source-count metadata doubles as an expandable disclosure. Save, Crew share
  and the arrow sit below it. The primary headline link is the keyboard navigation
  target; the duplicate arrow does not add a redundant tab stop.
- No fabricated timeline, injury, contract, game or player values enter the feed.
  Gallery fixtures are explicitly labeled and isolated behind a development-only route.
- The vector texture is the library's approximation, not a pixel-identical extraction.

## Verification

`/dev/beat-cards` renders all 20 recipes plus two-digit/3×3 counts, long names,
three-character positions, long actions, missing-logo and incomplete-data cases.
It is unavailable in production. The gallery has 280/320/400px width controls and
all 32 team palettes. Font-load inspection confirmed each of 500/600/700/800 loaded.

`tests/mobile/beat-reference-cards.spec.ts` checks all families at those widths,
semantic text overflow, four chevrons, stable fallback, keyboard Save/focus, plus
live `/the-beat` at 375/390/1440px with isolated API fixtures. Live-route checks cover
Save persistence requests, actual Crew-share submission payloads, source disclosure,
hot-read attribution, selected-team branding, and canonical navigation. No real
user messages or saved-content records are sent during QA.

Exact-size gallery QA disables the existing global 90% desktop zoom in the test
page only. Live-route screenshots retain the site's existing desktop density.
Screenshots under `artifacts/beat-gallery-{280,320,400}.png`,
`beat-live-{375,390,1440}.png`, `beat-palette-{KC,CIN,GB,BUF,LV,MIA}.png`, and
`beat-video-*.png` were compared with both supplied reference sheets.

## Live correction audit

`beat-story-adapter.test.ts` covers all 48 review examples (explicitly labeled
review-supplied excerpts) and the current 48 real feed payloads with source links.
`beat-live-classification.spec.ts` renders these actual feed snapshots through the
production adapter on the live route, checks semantic overflow, and validates the
unmocked API decisions, filtering and pagination. Existing action tests isolate
Save/Share mutations so QA never sends messages to real users.

Run `node --import tsx scripts/audit-beat-cards.ts` against the local server to
refresh `artifacts/beat-audit/current-audit.{md,json}`. The report records all
48 current choices and exact evidence excerpts. Ambiguous analysis remains Standard;
missing scores, aggregate injury totals and ranks remain omitted. Review excerpt
fixtures are not represented as fetched full articles.

Screenshots: `artifacts/beat-audit/{TEAM}-{390,1440}.png` show reproducible current
top-eight snapshots; `production-BUF-{390,1440}.png` captures the unmocked route.

## All-team composition audit

`beat-composition.tsx` coordinates related foreground elements in responsive grids:
number/descriptor, matchup columns, result scores, recap logo/title, player identity
and status, injury week/divider/report, stats and chronological updates. It replaces
independent absolute text slots for these families while preserving the supplied
backgrounds, 320×180 canvas, card grid and editorial/action layout. Depth Chart,
Mailbag and Practice now have explicit family contracts and restrained compositions.
Transactions retain exactly four chevrons.

`all-team-stories.json` captures eight real feed stories for each of all 32 teams.
Run `node --import tsx scripts/audit-beat-renderer.ts` to reproduce the per-story
report and extraction evidence in `artifacts/beat-renderer-audit/`. This uses captured
source excerpts, not fetched full article bodies. The browser suite renders all 256
through the production adapter at 390px and 1440px and checks required fields,
actual family, selected-team accent, Barlow font, equal graphic heights, bounds and
number/divider alignment. Gallery checks cover 37 compositions at 280/320/400px.
Required examples absent from the current feed are explicitly labeled gallery
fixtures, never represented as additional reporting.

See `artifacts/beat-renderer-audit/VALIDATION.md` for verification results and visual
review notes; `AUDIT.md` and `decisions.json` retain each selection/fallback reason.

## Roster moves

`beat-transaction.ts` identifies named roster actions independently of source labels,
including to-join signings, passive elevations, claims, promotions and IR placement.
Multiple players sharing one action use the same transaction flow. Mixed/unnamed
moves retain the roundup composition. Non-player “release” headlines are excluded.

`src/server/content/beat-transactions.ts` adds unique exact roster identities and
available positions/numbers. A number from a former team is not copied. Old roster
contract amounts are not represented as a new transaction contract. Verified explicit
terms remain optional. The coordinated transaction composition always contains four
chevrons and uses the entire details width when there is no contract.

Migration 043 stores backfilled transaction metadata. Re-run with
`npx tsx scripts/backfill-beat-transactions.ts`; see
`artifacts/beat-transaction-audit/AUDIT.md` for all-team coverage and visual checks.
