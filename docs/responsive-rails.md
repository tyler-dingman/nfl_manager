# Responsive secondary rails

Use `ResponsiveRail` from `src/components/layout/responsive-rail.tsx` for a secondary
column. Keep the existing desktop classes and place it alongside the primary content
inside the same padded page container. Set `stackAt` to the **parent grid's stacking
breakpoint**, including tablet breakpoints. Crew uses `stackAt="profile"` to follow its
nearest query container (the existing `profile-content` wrapper) rather than the viewport.

Below that breakpoint the shared stylesheet clears fixed/min/max widths, column/row
placement, sticky positioning and horizontal margins. The rail spans every parent grid
column and lays modules out vertically with a 16px gap (`--stacked-rail-gap` may override).
Direct modules stretch to the rail's width with border-box sizing. Internal card layouts
are not targeted. Page gutters and safe-area padding remain owned by the parent so the
primary content and rail share exactly the same horizontal bounds. Desktop rail widths
and positioning are still owned by the existing page stylesheet.

For a single secondary card, wrap the card; do not turn its internal elements into rail
modules. `style={{ display: 'contents' }}` on that wrapper preserves a legacy desktop
card's grid/sticky placement until stacking. The stacked contract intentionally overrides
legacy sizing declarations; keep these overrides in this shared stylesheet.

## Audit

- Parlay Lab dashboard, players, generator, Alt Stack, research and legacy builder: migrated.
- Front Office home, Draft Central, league news, standings, ownership and settings: migrated.
- Trivia game: migrated; stacked main content precedes the full-width rail.
- Crew: migrated at its existing container breakpoint.
- Home, article detail, draft guide and prospect board: migrated.
- Merch order summary: migrated. Shopping cart is a modal drawer, not a stacking rail.
- Beat and Film Room feeds currently have no desktop secondary rail. Their grids and
  hero layouts were reviewed; full-width Next Game cards already use width:100%.
- Draft room uses mobile panel navigation instead of stacking its desktop panels; preserve
  that interaction. Profile navigation, modal drawers, toasts and hero illustrations are
  not secondary content rails and retain their own behavior.
- Native Expo screens have no desktop secondary columns or constrained rail widths.
  Shared `Screen` explicitly stretches content within its existing SafeAreaView. Custom
  Beat/Film Room ScrollViews already stretch their cards and honor safe-area insets.

## Verification

An isolated Chromium harness renders the actual shared component with deliberately fixed
legacy rail/card widths. It checks 320px, each viewport breakpoint, and one pixel above
all eleven supported viewport thresholds: equal mobile gutters/widths, child widths,
vertical stacking, no overflow, and unchanged 290px desktop sizing. All 33 cases passed. Three additional Crew checks cover a 320px/900px/901px container
inside a 1400px viewport, confirming container-based stacking independent of viewport size.
TypeScript and targeted lint cover web/native changes. These are component checks, not a
claim that every authenticated page has been exercised on a physical device.
