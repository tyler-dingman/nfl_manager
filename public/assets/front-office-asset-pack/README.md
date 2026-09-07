# Down & Distance — Front Office Asset Pack

Implementation reference for the Front Office redesign. The PNGs in `references/` are the canonical visual source. Reusable SVG/CSS assets are intentionally code-native so they scale cleanly and remain easy to recolor.

## Folder map

- `references/` — untouched full-screen mockups: Home, Roster, Trade Hub, Free Agency, Draft.
- `brand/` — extracted Down & Distance logo crop from the Home reference.
- `icons/` — reusable red outline UI icons plus one sprite sheet.
- `components/` — phase indicator/split-button, page-title accent, dividers, OVR ring, status badges, and empty-slot art.
- `textures/` — subtle background and panel textures.
- `tokens/` — CSS variables and machine-readable JSON design tokens.
- `IMPLEMENTATION.md` — behavior, responsive rules, phase state model, and per-page asset mapping.

## Non-negotiable layout rules

1. Preserve two stacked navigations on every Front Office page.
   - Global nav: logo, The Beat, Film Room, Front Office, Trivia, Merch, search, notifications, team selector, profile.
   - Front Office nav: Front Office label plus Overview, Roster, Contracts, Cap Space, Depth Chart, Re-sign/Cut Players, Trade Hub, Free Agency, Draft Board.
2. Internal pages use a text-only title block. Never add a hero image behind Roster, Trade Hub, Free Agency, or Draft.
3. Home/Overview is the only supplied screen with a photographic hero treatment.
4. Active navigation uses a yellow underline; primary actions use red.
5. The phase strip is persistent simulation state, not decorative content. Its record, phase, CTA, and skip options must all update from one franchise save.

## Quick start for Codex

1. Copy `tokens/front-office.css` into the app’s shared styles or map its variables to the existing token system.
2. Build one shared `<GlobalNav />`, one shared `<FrontOfficeNav />`, one shared `<PageTitle />`, and one shared `<PhaseControl />`.
3. Use SVGs with `<img>` or inline them. When inlined, set `color` on the parent; most icons use `currentColor`.
4. Match structure and spacing before using assets as pixel decorations. Do not reproduce screenshot text as flattened images.
5. Read `IMPLEMENTATION.md` before changing any screen.

## Font guidance

The reference uses a tall, compressed, athletic display face for headings and a compact sans-serif for UI. The pack does not redistribute font files. Preferred CSS fallbacks:

- Display: `Roboto Condensed`, `Arial Narrow`, `Impact`, sans-serif; use italic, 800–900 weight.
- UI/body: `Inter`, `Roboto Condensed`, `Arial`, sans-serif.

If the existing site already has licensed brand fonts, keep them and use these assets/tokens only as visual guidance.

