# Down & Distance Front Office — Transaction Modal Asset Kit

Universal neutral PNG layers for all 32 team themes. No NFL marks, team names, player data, or team colors are baked into these files. Provide each team’s licensed logo separately at runtime.

## Contents and dimensions

| Folder | Asset | Canvas | Suggested opacity |
|---|---|---:|---:|
| `backgrounds/` | distressed charcoal | 2048×2048 | 100% |
| `overlays/` | playbook X/O/arrows | 1920×1280 | 7–14% |
| `overlays/` | field/grid | 1600×1600 | 4–10% |
| `overlays/` | grain/halftone | 1024×1024 | 5–12% |
| `strokes/` | four brush/scratch crops | varies | 12–28% |
| `icons/` | seven generic icons | 512×512 | 70–100% |
| `phrases/` | eight exact phrases | 1400×300 | 70–100% |

All overlays, strokes, icons, and phrases are white artwork on genuine transparent pixels. Tint with CSS masking; do not hue-rotate PNGs.

## Layer order

1. Neutral `#111214` modal base
2. Distressed background (`multiply`, 0.85–1.0)
3. Primary-color wash/gradient (0.18–0.34)
4. Field/grid (0.04–0.10)
5. Playbook (0.07–0.14)
6. Grain (0.05–0.12, `soft-light`)
7. Secondary-tinted brush stroke (0.12–0.28)
8. UI content, logo, icon, phrase

## CSS recipe

```css
.txn-modal {
  --team-primary: #e31837;
  --team-secondary: #ffb81c;
  position: relative; isolation: isolate; overflow: hidden;
  background: #111214 url('./backgrounds/distressed-charcoal-2048.png') center/cover;
  color: white;
}
.txn-modal::before {
  content: ''; position: absolute; inset: 0; z-index: -2;
  background: linear-gradient(125deg,
    color-mix(in srgb, var(--team-primary) 34%, transparent),
    transparent 58%,
    color-mix(in srgb, var(--team-secondary) 18%, transparent));
}
.txn-layer { position:absolute; inset:0; pointer-events:none; background:currentColor center/cover no-repeat; }
.txn-layer--field { color:var(--team-secondary); opacity:.07; mask:url('./overlays/field-grid-1600.png') center/cover; }
.txn-layer--playbook { color:white; opacity:.11; mask:url('./overlays/playbook-xo-arrows-1920x1280.png') center/cover; }
.txn-layer--grain { background:url('./overlays/grain-halftone-1024.png') repeat; opacity:.08; mix-blend-mode:soft-light; }
.txn-icon { width:56px; aspect-ratio:1; background:var(--team-secondary); mask:var(--icon) center/contain no-repeat; }
.txn-phrase { width:min(420px,70%); height:90px; background:var(--team-secondary); mask:var(--phrase) center/contain no-repeat; }
@media (prefers-reduced-motion: reduce) { .txn-layer { animation:none !important; } }
```

Safari support: duplicate `mask` declarations with `-webkit-mask`. For maximum compatibility, use an absolutely positioned `<img>` plus `filter` only for white (untinted) art. Always preserve readable contrast; decorative assets should be `aria-hidden="true"`.

## Transaction mapping

| Flow | Icon | Phrase | Accent guidance |
|---|---|---|---|
| Re-sign | contract or handshake | RUN IT BACK | primary wash, secondary phrase |
| Sign Free Agent | handshake | BRING HIM IN | secondary icon, primary CTA |
| Trade outgoing | trade arrows | MAKE THE CALL | primary-heavy, directional stroke |
| Trade received | trade arrows | THEY'RE CALLING | balanced primary/secondary |
| Counteroffer | contract | BACK TO THE TABLE | secondary underline/stroke |
| Cut | cut X | TOUGH CALL | desaturate wash; reserve red for warnings |
| Waiver | target | PUT IN THE CLAIM | secondary target, primary CTA |
| Depth replacement | helmet | NEXT MAN UP | primary number, secondary phrase |

Chart bars are available for negotiation/interest states. Keep team logos outside this kit and render them as runtime content, never as CSS decoration.

## Example markup

```html
<article class="txn-modal" style="--team-primary:#00338d;--team-secondary:#c60c30">
  <i class="txn-layer txn-layer--field" aria-hidden="true"></i>
  <i class="txn-layer txn-layer--playbook" aria-hidden="true"></i>
  <i class="txn-layer txn-layer--grain" aria-hidden="true"></i>
  <div class="txn-icon" style="--icon:url('./icons/trade-arrows-512.png')" aria-hidden="true"></div>
  <div class="txn-phrase" style="--phrase:url('./phrases/make-the-call-1400x300.png')" aria-hidden="true"></div>
</article>
```

## Safe-area and responsive guidance

Keep player/contract copy inside the central 70% of the modal. Crop decorative overlays with `cover`; use `contain` for icons/phrases. On screens under 640px, hide either the field or playbook layer and cap phrase width at 80%. Use team color tokens from the app’s existing team-theme source of truth—do not duplicate a 32-team palette inside the component.
