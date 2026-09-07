# Codex implementation guide

## Shared shell

Desktop vertical order:

1. `GlobalNav` — 72–94 px depending on breakpoint.
2. `FrontOfficeNav` — 44–58 px.
3. Page title / team summary region.
4. Phase strip (when franchise simulation state is available).
5. Page-specific workspace.

Keep both navigations visible on every Front Office route. At narrow widths, allow horizontal scrolling in the secondary nav; do not silently hide destinations. The active route gets a 4 px yellow underline. The global Front Office item is active for every child route.

Recommended route labels:

`Overview · Roster · Contracts · Cap Space · Depth Chart · Re-sign/Cut Players · Trade Hub · Free Agency · Draft Board`

Free Agency and Draft Board remain clickable in every phase. Their content is phase-aware, not phase-hidden.

## Page-title pattern

Internal pages use a clean white-to-pale-blue surface with no hero graphic:

- Eyebrow: `DOWN & DISTANCE`, 12–15 px, uppercase, red ampersand.
- H1: compressed italic uppercase, 48–64 px desktop, 36–44 px tablet.
- Strapline: uppercase navy, 15–18 px, tracking around .04em.
- Optional description: 14–16 px, max width about 58 characters.
- Team summary/tools may sit to the right on desktop and stack below on mobile.

Home/Overview is the exception: it uses the supplied hero mockup and may place its Front Office title over photography.

## Phase indicator and simulation behavior

Treat these as two separate values:

- `startingPath`: current real-world week/phase by default, or user-selected Free Agency or Draft.
- `currentPhase`: the saved franchise’s current point in the football calendar.

Canonical progression:

`Preseason → Week 1 … Week 18 → Wild Card → Divisional → Conference Championship → Super Bowl → Re-signing → Free Agency → Draft → Post-Draft → Preseason`

The reusable phase strip contains:

- team identity and OVR;
- current record;
- cap space;
- needs;
- season;
- current phase;
- split progression button.

During Week 1, the primary action is `Continue to Week 2`. Clicking it must simulate Week 1, update the record from `0–0`, update all dependent franchise state, switch the strip to Week 2, and change the CTA to `Continue to Week 3`.

The dropdown contains context-valid milestones:

- Before deadline: `Continue to Trade Deadline`, `Continue to Playoffs`.
- After deadline: omit the deadline option.
- Postseason: `Continue to Next Round`, then `Continue to Offseason`.
- Before Free Agency: `Continue to Free Agency`.
- Before Draft: `Continue to Draft`.

One-step advancement needs no confirmation. Large jumps require a confirmation stating the simulated range. Never only relabel the phase; simulate every intervening game and transaction. Record, standings, player stats, injuries, roster, cap, contracts, draft position, and league transactions derive from the same saved simulation.

Suggested state shape:

```ts
type FranchisePhase =
  | { kind: 'preseason' }
  | { kind: 'regular-season'; week: number }
  | { kind: 'postseason'; round: 'wild-card' | 'divisional' | 'conference' | 'super-bowl' }
  | { kind: 'offseason'; stage: 're-signing' | 'free-agency' | 'draft' | 'post-draft' };

type PhaseControlModel = {
  season: number;
  phase: FranchisePhase;
  record: { wins: number; losses: number; ties?: number };
  primaryAction: { label: string; target: FranchisePhase };
  jumpActions: Array<{ label: string; target: FranchisePhase; confirm: string }>;
};
```

Use `components/phase-control.svg` as visual anatomy, not as a flattened production control. Implement the real control accessibly in HTML: one primary `<button>`, one adjacent menu button with `aria-haspopup="menu"`, keyboard navigation, focus states, and a confirmation dialog for jumps.

## Page mapping

### Home / Overview

Reference: `references/Home_Screen.png`

- Only screen with the photographic hero.
- Use the full two-nav shell.
- Place the phase strip immediately below the hero (or sticky below the secondary nav if the product already supports it).
- Below: Contracts, Team Finances, Roster Plan, Franchise Briefing cards.
- Useful assets: `brand/down-distance-logo.png`, `components/phase-control.svg`, `components/card-accent.svg`, `textures/panel-grid.svg`.

### Roster

Reference: `references/Roster_Screen.png`

- Text-only `ROSTER` title.
- Team summary and Roster Tools to the right.
- Main roster table with position rail; Depth Chart and Roster Breakdown at right.
- Lower cards: Cap Overview, Contract Status, Injury Report, Practice Squad.
- Useful assets: `icons/person.svg`, `icons/trade.svg`, `icons/cut.svg`, `icons/clipboard.svg`, `components/ovr-ring.svg`, badges.

### Trade Hub

Reference: `references/Trade_Hub_Screen.png`

- Text-only `TRADE HUB` title and team summary.
- Three-column core: Your Team, Trade Builder, Trade Market.
- Offer wells use `components/add-slot.svg`; exchange affordance uses `icons/trade.svg`.
- Lower row: Salary Cap Impact, Trade Analysis, Recent Trade Activity.
- Primary Evaluate Trade action spans the builder; secondary Clear Trade is outlined.

### Free Agency

Reference: `references/Free_Agency_Screen.png`

- Text-only `FREE AGENCY` title.
- Phase-aware behavior: in-season shows current free-agent pool; offseason shows full signing workflow.
- Main table tabs remain All Free Agents, My Targets, Signed Players, Compensatory Picks.
- Right rail includes tools, Top Free Agents, and Team Needs.
- Lower row includes Cap Impact Simulator, Recent Signings, and News.
- Useful assets: `icons/search.svg`, `icons/target.svg`, `icons/cap.svg`, `icons/clipboard.svg`, `icons/scales.svg`, interest/status badges.

### Draft / Draft Board

Reference: `references/Draft_Screen.png`

- Text-only `DRAFT` title.
- In-season nav destination renders Draft Prospects: scouting, big board, position rankings, projected rounds, watchlist, mock position; no Make Pick controls.
- Active Draft phase renders the draft workflow/room and may enable pick/trade controls.
- Main prospects table with left filter rail; right rail has picks and team needs.
- Lower row: Draft Analysis, Recent Mock Drafts, Draft News.
- Useful assets: `icons/search.svg`, `icons/target.svg`, `icons/trade.svg`, `icons/clipboard.svg`, `icons/settings.svg`, need/status badges.

## Responsive behavior

- ≥1200 px: match the multi-column references.
- 768–1199 px: stack title and summary; use two-column workspaces; tables can scroll horizontally.
- <768 px: keep global controls compact, horizontally scroll secondary nav, stack all cards, preserve table headers with horizontal scrolling, and make the phase control full-width.
- Never replace internal page titles with a hero on smaller screens.

## Accessibility

- Use real text for headings and table content.
- Red on white is acceptable only at sufficient contrast; use `--dd-red-700` for small text.
- Never communicate status only by color; badge text is required.
- Minimum target size: 44 × 44 px.
- Add visible focus rings using `--dd-focus`.
- SVG icons marked decorative use `aria-hidden="true"`; otherwise provide an accessible name.

## Visual QA checklist

- Both navs appear and the correct child route is underlined yellow.
- Internal title area contains no hero illustration/photo.
- Team metrics use aligned dividers and a green OVR ring.
- Cards use thin cool-gray borders, slight radius, and minimal shadow.
- Tables use pale blue-gray headers and alternating/subtle row separators.
- Red is reserved for actions, active tools, and alerts; yellow marks global active state or warnings.
- Phase CTA and record change together after advancement.
- Free Agency and Draft are reachable in every phase but render the correct phase-specific experience.

