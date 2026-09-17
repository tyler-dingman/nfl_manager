# Down & Distance Football Icons

102 original, standalone SVG icons organized into 11 categories. Open `catalog.html` locally for a browsable, recolorable preview. Each catalog card links to the corresponding SVG file.

## Design and naming

- 24 × 24 viewBox; default width and height 24; 2-unit stroke.
- Rounded stroke caps and joins; no background, raster images, fonts, scripts, or external dependencies.
- All artwork inherits `stroke="currentColor"`; shapes use `fill="none"`.
- Category folders and filenames use lowercase kebab-case, e.g. `draft/big-board.svg`.
- `manifest.json` lists each display name, category, and path relative to this folder.
- Position icons use player poses, formation marks, and tactical routes; include a visible label where a position must be unambiguous.
- Geometry is newly authored for this set; no team/league logos or copied icon-library paths are included. Generic symbols are necessarily familiar.

## CSS / inline SVG

Paste a file's SVG markup directly into your HTML to inherit the surrounding text color. For example, the Football icon:

```html
<span class="football-icon">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">
    <path d="M4 20C2 11 11 2 20 4C22 13 13 22 4 20Z M8 16L16 8 M8 12L12 16 M12 8L16 12"/>
  </svg>
</span>
```

```css
.football-icon { color: #e66a2c; }
.football-icon svg { width: 1.5rem; height: 1.5rem; vertical-align: middle; }
button:hover .football-icon { color: #158e98; }
/* Optional site-wide stroke tuning */
.football-icon svg { stroke-width: 2; }
```

An SVG loaded through `<img src="...">` is an independent image: it does **not** inherit your page's CSS `color`. Use inline SVG / React components for recoloring, or a CSS mask for decorative icons:

```css
.icon-mask {
  display: inline-block;
  width: 24px;
  height: 24px;
  background-color: currentColor;
  -webkit-mask: url('/icons/football-concepts/football.svg') center / contain no-repeat;
  mask: url('/icons/football-concepts/football.svg') center / contain no-repeat;
}
```

Use `<span class="icon-mask" aria-hidden="true"></span>` alongside visible text. Serve assets over HTTP for masks; local-file browser restrictions may apply.

## React (no SVG loader required)

Convert SVG attribute names to JSX camelCase. This component uses the exact Football geometry:

```jsx
export function FootballIcon({ title, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false" {...props}>
      {title && <title>{title}</title>}
      <path d="M4 20C2 11 11 2 20 4C22 13 13 22 4 20Z M8 16L16 8 M8 12L12 16 M12 8L16 12" />
    </svg>
  );
}

// Decorative icon with a visible label:
<button><FootballIcon style={{ color: '#e66a2c' }} /> Football</button>
// Standalone informative icon:
<FootballIcon title="Football" />
```

If your project has an SVG-to-React loader (such as SVGR), you can import each SVG as a component using that loader's documented import syntax. Plain bundlers may import SVGs as URLs instead.

## Accessibility and scaling

Standalone files include a title and `aria-label`. For decorative inline icons beside text, remove those labels and set `aria-hidden="true"`. Icon-only buttons need their own accessible action name. Status icons should accompany text rather than rely solely on color.

Designed at 24px; 20–32px works well for navigation. Strokes scale proportionally with icon size. Set `vector-effect: non-scaling-stroke` on the geometry only if you deliberately want a constant screen-space stroke at larger sizes.

## Contents

- draft: 9
- roster-team-management: 9
- players-positions: 12
- news: 8
- game-season: 10
- media-content: 8
- analysis-tools: 10
- football-concepts: 10
- actions: 8
- status-indicators: 9
- ui-navigation: 9
