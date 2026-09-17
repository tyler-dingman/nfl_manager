# Codex follow-up — install the reference-based v2 story artwork

Replace the simplified Front Office graphics with this v2 package. Read README.md and inspect preview-board.png plus the user-supplied approved 16-card reference.

The package belongs at `public/assets/front-office-widget-story-graphics/`, keeping its existing filenames. It now contains 44 layered SVGs. Back up any existing files before replacing them; preserve unrelated work.

The essential change is rendering: v1's CSS mask destroys the new multicolor shading. Use `integration/StoryArtwork.tsx` as a safe literal inline React renderer. Copy it into `src/components/front-office/story-graphics/`; merge the provided `FrontOfficeStoryGraphic.tsx` and CSS changes against the current app rather than overwriting newer work blindly. The renderer uses per-instance IDs for gradients and currentColor for the school's accent; keep steel/shadow/highlight layers independent. Never run these assets through a mask or recolor every fill into one uniform color. Do not use arbitrary remote SVG markup injection.

Restore the reference composition: filled up/down arrow beside the real movement number, previous/current rank boxes underneath, a prominent dynamic college logo above separate steel bars, and one narrow layered ribbon behind the right portion of the card. Use subtle etched/playbook textures. For the other story types, use the detailed stopwatch, medical plus, pin/route, clipboard, VS, declaration card, transfer arrows, trophy, milestone, generic draft card/shield, puzzle, signal or radar. Respect template-specific hierarchy: top prospect and record stories are primarily typography/data-led, not giant generic icons. Keep all copy, rank/grade/measurement values, identities and logos live in application components.

Keep ~80–90% charcoal/black, white readable headlines, muted metadata, and school accents. Avoid oversized slashes that obscure symbols, tiny school logos as the only identity, invisible bars, or repeating bars as a bottom border. Use restrained neutral medical styling where the school color would resemble a protected Red Cross emblem.

Preserve the current theme registry, IDs, data adapters, news ordering, app routes, user-universe state, rankings and business logic. No production example data. Use neutral fallback for missing themes, meaningful identity text for unavailable logos, and omit unknown metrics. Treat provided chart art as decorative; render actual charts only from real history. Show steady/unknown rank states honestly. Do not infer a fall solely from an ambiguous headline.

Keep compact and mobile cards readable, text wrapping intact, and decorative art behind/in its own area. Reuse the shared system on existing relevant surfaces. Check known-school accents, neutral fallback, repeated gradient IDs, real rank values, all 16 template types in a test-only gallery, long headlines, 320px mobile and desktop card widths, contrast, links and keyboard access. Run focused type/build checks and inspect actual browser screenshots before reporting completion. The static preview board is art direction, not proof of app integration.

Report which files changed, which checks ran, and any remaining real-data or visual gaps. Do not claim a pixel-perfect match or browser validation without evidence.
