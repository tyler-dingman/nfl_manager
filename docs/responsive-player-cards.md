# Responsive player data

Player-oriented tables use the shared components in `src/components/players/`.
At widths below 768px they render cards; at 768px and above the original desktop
rows remain. Web, PWA, and embedded shared-frontend experiences use the same CSS
breakpoint. Existing native React Native player lists already use cards.

## Usage

- `ResponsivePlayerTable` replaces a table tag while retaining its existing
  header and body cells. Supply `identityColumn`, optional `actionColumn`, and
  `mobileLabels` when headers contain icons or opaque custom components.
- `ResponsivePlayerRow`, `ResponsivePlayerLink`, and `ResponsivePlayerButton`
  adapt existing grid rows. Supply meaningful field labels in column order.
- `PlayerCard` is the explicit identity/fields/actions primitive for new screens.
- `PlayerActions` uses the shared bottom sheet for multiple actions and a direct
  button for a single action. Supply only relevant callbacks, with disabled
  reasons where applicable. Existing `PlayerRowActions` recognizes card context.
- `ResponsivePlayerSelect` retains the controlled desktop select and routes
  mobile sheet choices through its existing change handler.
- `PlayerTableHeader` retains desktop grid headings and exposes existing sort
  callbacks in a mobile sheet. The core PlayerTable uses ResponsiveFilterBar
  for its position and sort controls, with search above them.

Both presentations consume the same cells and callbacks, after the feature's
existing filtering, sorting, pagination and selection. Do not fetch separate
mobile data. Use feature-specific labels and fields; do not manufacture contract
values or impose contract columns on prospects or props.

## Migration audit

Covered player tables and column-based grids:

- Shared PlayerTable: roster/depth/practice-squad views, free-agent lists,
  trade selection and other consumers.
- Roster expiring contracts, trade block, trade asset picker and development.
- Draft Central, prospect board, draft guide and simulator prospect rows.
- Trade Hub player asset selection.
- Parlay Lab player directory, market/prop rows, explore results, dashboard
  movers/props and generated legs.
- Structured search roster, injury and transaction player results.

Kept existing card/tile interactions for offseason player summaries, live draft
pick tiles and positional/drag workspaces. These are not desktop player tables.
Kept non-player tables: standings, team needs, cap summaries, pick trade values,
admin/source/commerce data, diagnostic sportsbook comparisons and individual
player game logs/odds ladders. They should not inherit player-card semantics.

## Verification

`tests/mobile/player-cards.spec.ts` bundles the actual shared components into an
isolated browser fixture. Chromium and WebKit verify 320/390/767px cards without
horizontal overflow, shared filter state, enabled/disabled actions and action
sheet dismissal, then the desktop table at 1280px. The real roster PlayerTable
and wide Parlay Lab grid classes were also exercised in local browser harnesses.
Full authenticated end-to-end checks on every screen and physical native-device
checks remain separate from this component-level coverage.
