# Replacement field and corrected end zones

The supplied `public/assets/huddle-field-assets/base_field.png` remains unchanged and is the only static field graphic. Its 1614×304 aspect ratio is preserved. The old SVG turf, yard numbers, end-zone text/backgrounds and asset references have been removed.

The supplied end-zone PNGs did not match the base boundaries even in the supplied QA composite. After the user approved corrected copies, `scripts/align-huddle-endzones.cjs` created 64 geometrically corrected full-canvas PNGs under `public/assets/huddle-field-aligned/endzones`. Original PNGs/geometry are preserved and their SHA-256 hashes are recorded in `source-hashes.json`. No tint, CSS transform, independently positioned overlay, or replacement text is applied at render time.

The corrected boundary intersections, measured on the base image, are:

- Left: (218,35), (315,35), (153,273), (15,273).
- Right: (1269,35), (1369,35), (1569,273), (1428,273).

All three image layers share identical bounds, `contain` sizing, and centered positioning. The complete stack crops together on mobile. Live markers are separate code-driven layers above the PNGs. Shared geometry maps LOS/first-down lines to the field surface; no line extends into the stadium. The painted 50 is not at canvas center. Interior anchors follow the painted numbers; the supplied image's duplicated right-side 30 is preserved, not redrawn.

Native bundles byte-identical local copies using `python3 scripts/build-huddle-field-assets.py`; no remote image fetch is needed for the base or end zones. Rebuild these copies after regenerating corrected assets.

Validation:

- All ten plays exercised in desktop web and React Native Web at mobile width.
- Play 1, 4, 5 and 10 screenshots captured in this directory (`desktop-play-*`, `native-web-play-*`).
- Inspected desktop DOM and native image bounds: all three layers share the same rendered rectangle; web transforms are `none`.
- Inspected corrected overlay composite and native touchdown view against the base's actual white boundaries.
- Shared coordinate/simulator tests pass, including midfield, both directions, stationary incomplete pass, touchdown, goal-to-go and all 32 asset mappings.
- Original base and all 64 supplied PNGs verified unchanged by hash. Native copies verified byte-identical to selected source/corrected assets.
- Web/native TypeScript pass. Physical devices and new APK not built.

No simulator game logic, live-data access, polling, database data, or production ingestion changed. Huddle remains development-only with live access disabled.
