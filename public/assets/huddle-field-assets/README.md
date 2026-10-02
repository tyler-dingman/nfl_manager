# Huddle Team End Zones — built for YOUR base_field.png

This pack uses the uploaded `base_field.png` exactly as supplied.

Base dimensions: 1614 × 304

The base field was NOT regenerated or redesigned.

## Contents

- `base_field.png` — exact user-supplied base
- `endzones/<TEAM>/left.png`
- `endzones/<TEAM>/right.png`
- `masks/left.png`
- `masks/right.png`
- `qa/PHI-vs-DAL.png`
- `qa/KC-vs-DEN.png`
- `qa/NYG-vs-NYJ.png`
- `geometry.json`

There are 64 team end-zone PNG overlays.

## Critical implementation rule

Every end-zone PNG has the SAME full canvas dimensions as `base_field.png`.

Stack them directly over the base:

base_field.png
left team endzone
right team endzone
live game overlays

Use the exact same CSS box for all three full-field images.

DO NOT:
- rotate end-zone PNGs
- skew them
- perspective-transform them
- crop them independently
- use different object-fit/object-position values

The perspective is already baked into the overlays to match this exact base.

## Team treatment

These are clean team-name/color treatments intended to look painted into the end zones.
They do not use copied official team wordmark artwork.

Live team logos, ball marker, LOS, first-down line and down/distance remain code-driven.
