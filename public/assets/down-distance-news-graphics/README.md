# Down & Distance — News Graphics Asset Pack

This package is designed for the Front Office / League News engine.

## Goal

Create dynamic story artwork without requiring:
- NFL logos
- NFL shield
- official team marks
- player photos / player likenesses
- pre-rendered text inside images

Codex should assemble each story graphic from:
1. one neutral background
2. a dark overlay
3. team color CSS variables
4. one reusable SVG motif
5. live HTML/CSS text and data

This lets one component support all teams and thousands of generated stories.

## Upload location

Copy the `public/assets/front-office/news-graphics` folder into the same path in the site.

Recommended final structure:

public/
  assets/
    front-office/
      news-graphics/
        backgrounds/
          field.svg
          stadium.svg
          tunnel.svg
          locker-room.svg
          playbook.svg
          city.svg
          grunge.svg
        overlays/
          trade-arrows.svg
          injury-cross.svg
          signature.svg
          signed-stamp.svg
          breaking-bars.svg
          draft-frame.svg
          standings-bars.svg
          quote-mark.svg
          rumor-xo.svg
          number-frame.svg

## Team identity

Do not put a logo into these templates.

Each team needs data such as:

```ts
{
  abbreviation: "KC",
  displayName: "Kansas City",
  primaryColor: "#...",
  secondaryColor: "#..."
}
```

Use colors as CSS variables.

Suggested runtime variables:

```css
--team-primary
--team-secondary
--opponent-primary
--opponent-secondary
```

## Story types

TRADE_RUMOR
INJURY
GAME_RECAP
CONTRACT
SIGNING
TRADE
PLAYER_PERFORMANCE
DRAFT
STANDINGS
COACH
RUMOR

See `story-graphic-map.json`.

## Important

Never bake player names, headlines, stats, team names, records, scores, jersey numbers, or labels into the image asset.

Those are HTML/CSS text layers.

The SVG backgrounds and overlays should remain generic.

## Recommended aspect ratios

Lead story:
16:9 or approximately 1.75:1

Article grid card:
4:3

Huddle-style card:
1.25:1

Mobile:
1:1 or 4:5 as needed.

Use `object-fit: cover` / CSS backgrounds rather than generating separate artwork for every breakpoint.
