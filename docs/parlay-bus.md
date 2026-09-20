# The Parlay Bus

User-facing naming updated in primary navigation (including the shared mobile menu), hero, page metadata, secondary navigation accessibility label, research help, saved-play sharing/export images, and supporting pages. `/parlay-lab`, APIs, environment variables, Lab Score and database identifiers stay unchanged.

`ParlayLabHome.tsx` removes the permanent prompt block and duplicate research-suggestion generator. Trending Props is the first main section, 24px beneath the hero, beside the existing My Parlay rail. Its header has nowrap Ride the Bus and See all trends actions. Dense rows/mobile filters remain intact.

`RideTheBusDrawer.tsx` and `ride-the-bus.module.css` provide the right-side overlay (full-width on mobile). Search was audited: it currently uses a dimmed overlay, not a reusable drawer component. This implementation follows its backdrop dismissal and reuses `useDialogFocus` for Escape, Tab containment, scroll locking and focus restoration. Reduced-motion preference disables the entry animation.

The existing `generateResearchSlip` / `parseResearchPrompt` functions perform local rule-based generation. There was no AI/model request behind the replaced home generator. This work does not add one or simulate processing stages. Copy makes stored-market matching and fresh requests explicit. Quick Rides populate and run supported intents. No external odds requests occur when opening or generating; candidates come from already-loaded full-game research.

Your Ride is review state, separate from the existing My Parlay state. Checkboxes exclude legs, Add inserts an individual leg, and Add Ride merges selected valid legs without duplicate id/book combinations. Research closes the drawer before opening the existing research modal, avoiding overlapping focus traps. Reopening preserves the suggestion. New Ride resets the suggestion for a fresh request.

Generated cards show actual odds, exact thresholds, alternate classification, Lab Score and centralized side-aware matchup wording. Combined prices are clearly estimated, not sportsbook quotes or EV. Lab Score retains its name and research-only meaning.

Validation: unit tests cover brand/navigation and prompt parsing; `tests/mobile/parlay-bus.spec.ts` covers narrow/wide layouts, hierarchy, nowrap, drawer open/close/Escape/focus restoration, generation, alternate/conflict labels, selected/individual/bulk additions, duplicate safety, no new betting-data requests, and mobile filters. Real-data browser checks cover generation and player-research handoff. Typecheck, scoped lint and production build checked separately.
