# Down & Distance — Contract Update Card Pack

Mirror the working Injury Report card architecture.

Production path: `public/assets/down-distance-contract-card-pack`

Use one neutral background for every team. All contract-specific accent SVGs use `currentColor`; resolve `--card-accent` from the same canonical team theme source already used by Injury Report.

Important: do not render `reference.png` as the production thumbnail. Build the card from the neutral background + SVG layers + live HTML text.

Accent assets:
- contract/accent-bar.svg
- contract/contract-document.svg
- contract/pen.svg
- contract/signature-flourish.svg
- contract/bottom-accent-strip.svg
- contract/contract-template-overlay.svg

Neutral/shared assets:
- shared/background-neutral.webp
- shared/background-neutral.png
- shared/playbook-overlay.svg
- shared/halftone-dots.svg

Default HTML copy:
- eyebrow: FRONT OFFICE
- primary: CONTRACT
- accent: UPDATE

Do not bake visible wording into graphics. No player imagery and no team logos.
