# CODEX PROMPT — Dynamic Down & Distance News Graphics

We have uploaded a reusable legal-safe visual asset pack to:

`public/assets/front-office/news-graphics/`

Build a dynamic graphic-rendering system for Front Office > League > News and other areas that display generated football stories.

## Core rule

DO NOT render story cards using NFL/team logos or player photos.

DO NOT bake text into raster assets.

All visible team names, abbreviations, player names, jersey numbers, stats, scores, headlines and labels must be live HTML/CSS.

The provided SVGs are neutral visual ingredients only.

## Available assets

Backgrounds:

- `/assets/front-office/news-graphics/backgrounds/field.svg`
- `/assets/front-office/news-graphics/backgrounds/stadium.svg`
- `/assets/front-office/news-graphics/backgrounds/tunnel.svg`
- `/assets/front-office/news-graphics/backgrounds/locker-room.svg`
- `/assets/front-office/news-graphics/backgrounds/playbook.svg`
- `/assets/front-office/news-graphics/backgrounds/city.svg`
- `/assets/front-office/news-graphics/backgrounds/grunge.svg`

Overlays:

- `/assets/front-office/news-graphics/overlays/trade-arrows.svg`
- `/assets/front-office/news-graphics/overlays/injury-cross.svg`
- `/assets/front-office/news-graphics/overlays/signature.svg`
- `/assets/front-office/news-graphics/overlays/signed-stamp.svg`
- `/assets/front-office/news-graphics/overlays/breaking-bars.svg`
- `/assets/front-office/news-graphics/overlays/draft-frame.svg`
- `/assets/front-office/news-graphics/overlays/standings-bars.svg`
- `/assets/front-office/news-graphics/overlays/quote-mark.svg`
- `/assets/front-office/news-graphics/overlays/rumor-xo.svg`
- `/assets/front-office/news-graphics/overlays/number-frame.svg`

Use these as CSS background images or `<img aria-hidden>` decorative layers.

## Create components

Create:

`src/components/front-office/news-graphics/NewsGraphic.tsx`

and helper components as appropriate.

Recommended API:

```ts
type NewsGraphicProps = {
  variant:
    | "trade-rumor"
    | "trade"
    | "injury"
    | "game-recap"
    | "contract"
    | "signing"
    | "player-performance"
    | "draft"
    | "standings"
    | "coach"
    | "rumor"
    | "breaking";

  size?: "hero" | "card" | "compact";

  team?: {
    id: string;
    abbreviation: string;
    displayName: string;
    primaryColor: string;
    secondaryColor: string;
  };

  opponent?: {
    id: string;
    abbreviation: string;
    displayName: string;
    primaryColor: string;
    secondaryColor: string;
  };

  player?: {
    id: string;
    name: string;
    number?: number | string;
    position?: string;
  };

  headline: string;
  description?: string;

  stats?: Array<{
    label: string;
    value: string | number;
  }>;

  score?: {
    team: number;
    opponent: number;
    status?: string;
  };

  label?: string;
};
```

## Visual language

Match the latest approved Down & Distance Huddle / News Graphic direction:

- dark black / charcoal base
- neutral gritty football imagery
- oversized condensed sports typography
- strong information hierarchy
- white / off-white type
- team color used only as an accent
- light chalk/playbook textures when relevant
- large jersey number for player stories
- large abbreviations for team stories
- thin vertical accent bar
- compact uppercase category label
- no decorative handwritten AI slogans
- no official logos

## CSS variables

At component root set:

```css
--team-primary
--team-secondary
--opponent-primary
--opponent-secondary
```

Use runtime data.

Do not hardcode Kansas City colors in the reusable component.

## Variant behavior

### TRADE RUMOR / TRADE

Background:
`grunge.svg` or `playbook.svg`

Overlay:
`trade-arrows.svg`

Layout:
- team abbreviation left
- target/opponent abbreviation right
- large trade arrows between
- player name / number if applicable
- "TRADE TALK" or "TRADE RUMOR" label

For two teams, use a subtle CSS split:
left side tinted with team primary
right side tinted with opponent primary

Never use logos.

### INJURY

Background:
`field.svg`

Overlay:
`injury-cross.svg`

Layout:
- huge player jersey number
- position
- status
- expected absence or injury descriptor

Example live text:

INJURY UPDATE
26
RB
OUT AT LEAST 3 WEEKS
Ankle

### GAME RECAP

Background:
`stadium.svg`

Layout:
- team abbreviation and score
- opponent abbreviation and score
- FINAL
- one sentence or top player stat

Do not use helmets or logos.

### CONTRACT

Background:
`locker-room.svg`

Overlay:
`signature.svg`

Layout:
- jersey number
- CONTRACT UPDATE
- contract status
- optional value / years

### SIGNING / TRANSACTION

Background:
`tunnel.svg`

Overlay:
`signed-stamp.svg`

Use large:
SIGNED

Then:
player position
player name
contract line if available

### PLAYER PERFORMANCE

Background:
`playbook.svg`

Overlay:
`number-frame.svg`

Use:
large jersey number
position
3 key stats

Example:
1
WR
8 REC
142 YDS
2 TD

### DRAFT

Background:
`tunnel.svg`

Overlay:
`draft-frame.svg`

Use:
ROUND
PICK
position / prospect name

No college/team logo required.

### STANDINGS / PLAYOFF

Background:
`stadium.svg`

Overlay:
`standings-bars.svg`

Render actual live HTML standings rows.

### COACH / FRONT OFFICE

Background:
`locker-room.svg`

Overlay:
`quote-mark.svg`

No coach image required.

Use quote as primary visual.

### RUMOR / DEVELOPING

Background:
`playbook.svg`

Overlay:
`rumor-xo.svg`

Use:
DEVELOPING STORY
RUMOR

Then short headline.

## Lead Story

Replace the photo-dependent lead News story artwork with `NewsGraphic size="hero"`.

Example:

```tsx
<NewsGraphic
  variant="trade-rumor"
  size="hero"
  team={story.team}
  player={story.player}
  label="TRADE RUMORS"
  headline="Kansas City expected to explore WR options"
  description="The team is expected to be active ahead of the trade deadline."
/>
```

The component must expand cleanly to the same dimensions currently used by the News hero card.

## News grid

All Latest News cards should use the same component with `size="card"`.

Do not show the same background repeatedly in adjacent cards when alternate valid backgrounds exist.

Use deterministic variant-to-background mapping so cards do not change on refresh.

## The Wire

The Wire can remain primarily text/social UI.

However, when a Wire item links to a full generated story, the destination News story should use this graphic system.

## Article page

At top of generated article pages, render a wide NewsGraphic hero before article body.

Reuse the same story data that powers the article headline.

## Accessibility

All SVG overlays are decorative:
`aria-hidden="true"`

Do not place essential text in SVGs.

Ensure text contrast remains WCAG-readable.

## Responsive

Hero:
desktop 16:9-ish
mobile ~4:3

Cards:
desktop 4:3
mobile wide enough to keep text readable

Use CSS clamp() for large type.

The same component must work without manually generating mobile images.

## Do not

- import NFL logos
- use team-logo image URLs
- scrape player photographs
- use generated player likenesses
- create official helmet graphics
- use NFL shield imagery
- add random slogan text
- bake story content into graphics

## Result

We want the site to feel intentionally designed around a proprietary Down & Distance visual system rather than like a sports site missing licensed photography.

One small reusable asset library should support every team, every week and every generated story.
