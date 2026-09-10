# Down & Distance Injury Content-Card Pack

This pack separates the card into a neutral raster background, recolorable SVG overlays, and editable HTML text. The goal is one production template that works for every team.

## Files

- `reference.png` — visual reference only; do not use as production background because its yellow is baked in.
- `shared/background-neutral.webp` — production neutral grunge background.
- `shared/background-neutral.png` — lossless neutral alternative.
- `shared/playbook-overlay.svg` — optional white/chalk overlay.
- `shared/halftone-dots.svg` — optional decoration.
- `injury/accent-bar.svg` — uses `currentColor`.
- `injury/medical-cross.svg` — uses `currentColor`.
- `injury/heartbeat.svg` — uses `currentColor`.
- `injury/underline.svg` — uses `currentColor`.
- `injury/injury-template-overlay.svg` — combined accent overlay if Codex prefers one SVG.
- `team-accent-map.css` — starter 32-team accent variables. Prefer the app's existing team-theme source of truth if it already exists.
- `injury-card.css` — sample composition CSS.
- `ExampleInjuryCard.tsx` — sample component only.
- `codex-prompt.txt` — implementation instructions.

## Critical SVG note

All team-colored SVGs use `currentColor`, so CSS controls their color. Example:

```css
[data-team="KC"] { --card-accent:#ffb81c; }
[data-team="CIN"] { --card-accent:#fb4f14; }
.injury-card-art__cross { color:var(--card-accent); }
```

Do not use CSS filters to recolor a flattened PNG. Do not bake `INJURY ALERT` into an image. Keep the words as editable HTML.

## Recommended public path

Copy this folder to:

`public/content-card-elements/`

Then reference SVGs from `/content-card-elements/injury/...`.
