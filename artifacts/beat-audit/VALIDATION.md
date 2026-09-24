# Beat live integration validation

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: changed components, adapter, route, types, scripts and browser tests passed.
- Focused Node suite: 127 tests passed, including all 48 review cases and all 48 current feed stories with independently reviewed expected families and source-excerpt assertions.
- Playwright: 22 checks passed across Mobile Chrome and Mobile Safari. Covered 280/320/400px composition canvases, live-route real payloads at 390/1440px, existing actions at 375/390/1440px, review excerpts, unmocked API decisions, and real filter/pagination controls.
- Save, unsave, Crew share, source disclosure and article navigation passed with isolated mutation endpoints. No real messages were sent.
- Screenshot checks waited for live fonts and decoded logos; semantic text overflow checks passed.
- Unmocked production captures: [desktop](production-BUF-1440.png), [mobile](production-BUF-390.png).
- Six-team reproducible top-eight captures: HOU/MIA/BUF/CHI/TB/IND at 390 and 1440px in this directory.
- Compared typography, hierarchy, four-chevron transactions, team pairing, neutral backgrounds and quieter texture with both supplied reference sheets.

## Evidence and limits

[current-audit.md](current-audit.md) and [current-audit.json](current-audit.json) record the current top eight for each requested team, reason, graphic fields, source excerpts, URLs and timestamps. Five of 48 remain Standard: Texans Last 20 Yards, Living On The Edge, Ready For Cincinnati, Bears defense displays growth, and Bucs Power Rankings. Their text does not establish a supported specific format or verified rank.

The current-story fixtures are fetched canonical feed payloads. The separate review fixtures use the review's supplied title/summary excerpts for all 48 historical examples; they are labeled as excerpts, not complete fetched articles. Facts are checked against the supplied canonical story text; this does not independently verify the reporting itself.

No inferred home/away, medical OUT status, missing score, fabricated injury total, quote, jersey, contract or playable video is supplied to complete a design. Ambiguous or oversized identities retain a diagnostic Standard fallback. Feed categories and ingestion logic remain unchanged.
