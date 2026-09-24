# Front Office graphics

Reusable graphics for the Front Office redesign, with all six supplied final mockups preserved as reference images. No font files are included.

## Install

Copy `public/assets/front-office/` into your application's `public/assets/` directory. The resulting URL prefix is `/assets/front-office/`. Keep `references/`, `previews/`, and `examples/` outside the public assets folder unless you intentionally want to publish them.

## Production assets

| Public URL | Size / background | Use |
| --- | --- | --- |
| `/assets/front-office/heroes/play-diagram-hero-overlay.svg` | 1600 × 240; transparent | Preferred shared hero overlay; the left half is clear for live text. Neutral line opacity is already 12%. |
| `/assets/front-office/heroes/play-diagram-hero-dark.svg` | 1600 × 240; opaque neutral dark | Ready-to-use hero background with the identical diagram. |
| `/assets/front-office/heroes/play-diagram.svg` | 800 × 240; transparent | Flexible right-aligned diagram for custom containers. Full-strength neutral strokes: apply 0.10–0.16 opacity. |

Each SVG also has a `@2x.png` equivalent in the same directory: hero versions are 3200 × 480; the standalone diagram is 1600 × 480. SVG is preferred for sharpness and small size. PNGs are rendered from the same vector artwork, not crops from the mockups. Do not stack multiple variants of the watermark.

## Reference fidelity and intentional normalization

The football diagram is an original vector reconstruction of the circles, crossing marks, dashed routes, and upfield arrow visible in `league_central_final.png` and `trade_hub_final.png`. It is not an extracted original design layer or a pixel-exact recovery. The same geometry is used by every delivered variant.

The supplied Roster, Free Agency, and Draft screenshots still contain Jets-logo hero watermarks. Follow the user's final shared-diagram direction: replace those logo watermarks with this same play diagram. Home uses a player-led editorial hero; retain that composition when suitable imagery exists, and use the neutral diagram as a fallback. Some screenshots also contain green-tinted surfaces; the final neutral-background rule below takes precedence.

## Non-negotiable theme rule

Every team shares the same neutral dark surfaces:

- Page: `#061219` or `#07171D`.
- Cards/panels: `#091A20` through `#0C2026`.
- Elevated panels: `#0E232A`.
- Borders: white at 7–10% opacity.
- Main text: `#F5F7F7`; secondary text: a cool gray such as `#A8BAC4`.

Read the team's accent from the existing team theme configuration. Apply it to buttons, active tabs/navigation, selected borders, icons, links, focus indicators, and small highlights. Do not recolor the page, shell, large panels, or hero background. No full-screen team-color gradient, blend overlay, or tint. The shared diagram stays neutral. Keep alert/status colors meaningful and independently readable. Check button-label and focus contrast with each team palette; use an accessible accent variant where needed.

## Hero usage

See `examples/hero.css` and `examples/hero.html`. Keep heading, description, tabs, and controls as live HTML. The watermark is decorative and must not intercept pointer events. Use `aria-hidden="true"` and an empty alt attribute if implemented as an image. Use one shared hero component across Roster, Free Agency, Draft Central, League Central, and Trade Hub.

For desktop, keep the motif on the right, clipped within the hero. Avoid enlarging it to cover the whole page. On narrow screens, hide the decoration if it competes with the title. The examples intentionally retain a neutral surface when the accent switches from Jets green to Chiefs red or Bears orange.

## Typography and other visuals

No fonts are packaged. The screenshots alone cannot establish an exact font family. Inspect the application's existing fonts; match the bold display headings, condensed italic editorial headings on Home, and compact body text with existing licensed families. If an exact font is later supplied by the owner, wire it into the shared typography tokens.

Keep buttons, panels, tables, badges, tabs, dividers, shadows, small icons, charts, and diagonal hero accent treatments in CSS/SVG/components. No screenshot slices of these elements are included. Team logos, player photos, the Down & Distance logo, and ads remain within the supplied reference screenshots only; use the application's existing source assets for production. No additional reusable photographic or texture asset was reliably recoverable from these flattened mockups.

## Contents

- `public/assets/front-office/heroes/`: three vector variants and three PNG equivalents.
- `references/`: all six original PNG mockups, unchanged.
- `previews/hero-theme-preview.png`: sample heroes with green, red, and orange accents against identical dark backgrounds.
- `examples/`: optional HTML/CSS integration example; no JavaScript or external dependencies.
- `asset-manifest.json`: dimensions and intended usage of production assets.

The reference screenshots guide layout and appearance, not live player data or league facts.
