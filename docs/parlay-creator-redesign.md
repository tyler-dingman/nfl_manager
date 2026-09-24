# Parlay creator

The existing portal modal now presents Create a Parlay with five selectable preset cards, a 500-character request field, optional settings, and team-themed controls. It reuses `useDialogFocus` for Escape, containment, focus restoration, and body scroll locking.

The portal receives the same style tokens as `TeamThemeProvider`. Team selection follows the route team when supplied, then the canonical fan preference, then the existing team store. Filled controls use the existing accessible foreground strategy; no team-color mapping is duplicated.

All generation still calls `parseResearchPrompt` and `generateResearchSlip` against available, full-game stored markets. Presets configure the request and wait for Create My Parlay. Risk options expose only supported balanced/high-confidence filtering (shown as Balanced/Conservative); the existing 1–8 leg bounds are retained. Explicit settings override the parsed count/confidence. Plus Money retains the existing positive-price market filter. No new odds, scoring, or confidence algorithm was introduced.

Market loading, empty, and retryable failure states are passed from the existing research fetch. Requests stay editable while markets load. Generation shows a pending state before executing the existing synchronous engine. Results retain leg selection, research, individual/bulk add, duplicate protection, estimated-odds qualifications, and a fresh request action. Data freshness copy says “available stored odds” rather than promising real-time data.

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- `node --import tsx --test src/lib/parlay-lab/research.test.ts src/lib/team-theme-tokens.test.ts`
- `PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/mobile/parlay-bus.spec.ts`

Browser tests exercise all seven requested widths, focus/scroll behavior, prompt limits, preset filtering, settings, slip preservation, and loading/empty/retry states with fixture markets through the real research engine.
