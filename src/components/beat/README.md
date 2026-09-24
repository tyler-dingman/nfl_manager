# The Beat card integration

The live `/the-beat` feed opts into `HuddleStoryCard appearance="beat"` from
`team-content-hub.tsx`. Homepage and Game Day consumers retain the legacy default.
The selected feed team controls accents and ghost branding, not the story's subject.
Opponent/transaction logos use `TEAM_LIST` and retain their authorized colors.

`beat-model.ts` defines the structured family contract, validates required fields,
normalizes all 32 app IDs and aliases, and selects stable Standard A–D fallbacks.
The current canonical `TeamBriefing`/story projections provide categories and source
metadata, but no verified structured scores, report rows, contracts, or quotations.
Consequently factual special families are not inferred from headlines. Coaching and
other explicit topic categories can use their corresponding illustrative layouts.
A caller with verified structured data can provide `graphic`; invalid/incomplete
payloads fall back to Standard. Video eligibility/ingestion has not changed.

`beat-graphic.tsx` consumes the supplied manifest's shared/family layer order,
opacities and live-text coordinates. `beat-assets.tsx` contains trusted build-time
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

Typecheck and targeted lint pass. The focused card/editorial/content suite passes all 29 tests; all 12 Chrome/Safari browser checks pass.
The broader video-isolation suite has one pre-existing unrelated failure: its
recurring-workflow assertion still expects a GitHub cron, whereas the current
workflow explicitly delegates scheduling to Cloudflare. Video projection and
pipeline isolation assertions pass; no ingestion workflow was changed.
