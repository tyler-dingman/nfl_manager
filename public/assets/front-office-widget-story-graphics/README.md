# Front Office Widget Story Graphics — v2

This replaces the overly simplified v1 kit with 44 layered SVGs based on the supplied 16-card draft-news reference: filled arrows, neutral steel bars, a school-accented final bar, machined stopwatch rim, beveled clipboard and trophy, shaded puzzle pieces, and offset editorial ribbons. Every SVG remains actual vector artwork. No player photos, college/NFL logos, production metrics or external dependencies are embedded.

## Install the package

Extract the ZIP into `public/assets/`. It contains the folder `front-office-widget-story-graphics/`, matching the current app's asset directory. Keep a backup of v1 if needed. Stable filenames for all 43 existing assets are preserved; `etched-texture.svg` is added. The new viewBoxes differ from v1: retain each viewBox and use responsive dimensions rather than assuming 64×64.

## Important rendering change

**Do not use CSS masks for these v2 graphics.** A mask collapses independent steel, shadow and highlight layers into one color. Loading the SVG as an external `<img>` preserves shading but does not inherit a page's `currentColor`. The recommended app integration is the provided safe, literal React SVG renderer:

1. Copy `integration/StoryArtwork.tsx` into `src/components/front-office/story-graphics/`.
2. Use `<StoryArtwork id="stopwatch" className={styles.asset} />` inside a wrapper whose `color` is the college primary color.
3. Remove mask/background-color rules from the artwork wrapper. Size the actual `<svg>`.
4. Keep the existing real theme resolver and data adapter.

```css
.art { color: var(--school-primary, #b8c1cc); }
.asset { display: block; width: 100%; height: auto; color: inherit; }
```

The generated renderer uses React `useId` for per-instance gradient IDs. It has no fetches, runtime markup injection, scripts inside SVGs, or remote asset loading. Repeated cards will not share gradient IDs. It mirrors the SVG files; when geometry changes, update/regenerate the corresponding literal JSX too.

The source SVG files use `currentColor` for accent gradients and fixed neutral values for steel, glass, and shadows. Inline SVG is required for inherited page theme colors. Each standalone file has namespaced IDs, but repeated inline copies of the same file must additionally namespace IDs per instance; the supplied React component does that. Standalone file viewing defaults to black unless the viewer supplies a color. Use `preview.html` to inspect the assets correctly on charcoal and change the accent interactively.

## Prepared app integration

`integration/FrontOfficeStoryGraphic.tsx` and `integration/front-office-story-graphic.module.css` are scoped proposed replacements prepared against the app files inspected during this task. Review/merge if those files have changed since then. They:

- Replace the monochrome mask renderer with `StoryArtwork`.
- Put one layered ribbon behind the card instead of piling large slashes over its central symbol.
- Put the filled movement arrow beside the real movement value.
- Place the college logo above a distinct steel-bar motif for rising/falling stories.
- Preserve headline, summary, metrics, source, date, destination identity and the existing model.
- Add compact, card, hero and article presentation sizes without changing ranking, theme or story-selection services.

These are a visual integration patch, not an implementation of additional data feeds. The existing adapter only exposes templates supported by its current logic. All 16 visual categories are available in the asset library; do not manufacture stories to populate them.

## Reference fidelity and limitations

This is a hand-built vector interpretation of the approved raster reference, with richer silhouettes and material layers. It is not a pixel-for-pixel trace. The original board's college and league marks remain dynamic app responsibilities. Original preview ranks, grades, players, and statistics are not baked into this kit.

`preview-board.svg` / `.png` show a 16-template art-direction board with placeholder text and identity slots. `composition-preview.html` is server-rendered from the provided React component with placeholder copy and no invented metrics. `preview.html` is the full color-adjustable asset catalog. These previews are not production news content. Some reference layouts depend on live rank, grade, paired identity or other fields; let the app supply these only when available.

Neutral fallback: charcoal surfaces, #b8c1cc accents, #f4f6f8 foreground. Do not recolor all neutral bars into school color. Do not turn the medical plus into a Red Cross emblem. The draft shield is a generic geometric mark, without the NFL crest's identity.

## Data rules

Chart bars, trend paths, gauges, routes, radar dots and playbook diagrams are symbolic art, not measured data. Do not attach fake axes or values. Use only real comparable snapshots for rank movement. A rising numeric rank is `previousRank - currentRank > 0`; zero means steady; missing history is unknown. Actual historical charts must be rendered separately from actual samples. Omit missing metrics. Preserve real universe data and all existing business logic.

## Asset catalog

| File | Usage | Template associations |
|---|---|---|
| [`arrow-up.svg`](svg/arrow-up.svg) | Layered decorative editorial symbol; no data values. | rising-prospect |
| [`arrow-down.svg`](svg/arrow-down.svg) | Layered decorative editorial symbol; no data values. | falling-prospect |
| [`bars-ascending.svg`](svg/bars-ascending.svg) | Symbolic bars only. Three steel bars and one school-colored bar; not a historical chart. | rising-prospect |
| [`bars-descending.svg`](svg/bars-descending.svg) | Symbolic bars only. Three steel bars and one school-colored bar; not a historical chart. | falling-prospect |
| [`trend-up.svg`](svg/trend-up.svg) | Decorative directional motif; never substitute for actual history. | draft-stock |
| [`trend-down.svg`](svg/trend-down.svg) | Decorative directional motif; never substitute for actual history. | draft-stock |
| [`stopwatch.svg`](svg/stopwatch.svg) | Layered decorative editorial symbol; no data values. | combine-pro-day |
| [`medical-cross.svg`](svg/medical-cross.svg) | Generic beveled medical plus. Render neutral/school-toned, never as a Red Cross emblem. | injury-update |
| [`return-arrow.svg`](svg/return-arrow.svg) | Layered decorative editorial symbol; no data values. | injury-update |
| [`map-pin.svg`](svg/map-pin.svg) | Layered decorative editorial symbol; no data values. | team-visit |
| [`visit-route.svg`](svg/visit-route.svg) | Layered decorative editorial symbol; no data values. | team-visit, transfer |
| [`clipboard.svg`](svg/clipboard.svg) | Layered decorative editorial symbol; no data values. | scouting-report |
| [`versus.svg`](svg/versus.svg) | Layered decorative editorial symbol; no data values. | position-battle |
| [`declaration-card.svg`](svg/declaration-card.svg) | Layered decorative editorial symbol; no data values. | draft-declaration |
| [`transfer-arrows.svg`](svg/transfer-arrows.svg) | Layered decorative editorial symbol; no data values. | transfer |
| [`trophy.svg`](svg/trophy.svg) | Layered decorative editorial symbol; no data values. | award-recognition |
| [`milestone-marker.svg`](svg/milestone-marker.svg) | Layered decorative editorial symbol; no data values. | record-milestone |
| [`draft-card.svg`](svg/draft-card.svg) | Layered decorative editorial symbol; no data values. | mock-draft-projection |
| [`draft-shield.svg`](svg/draft-shield.svg) | Original plain shield: no league logo, lettering, stars or copied NFL crest. | mock-draft-projection |
| [`puzzle.svg`](svg/puzzle.svg) | Layered decorative editorial symbol; no data values. | best-fit |
| [`signal.svg`](svg/signal.svg) | Layered decorative editorial symbol; no data values. | draft-buzz |
| [`target.svg`](svg/target.svg) | Layered decorative editorial symbol; no data values. | top-prospect, best-fit |
| [`radar.svg`](svg/radar.svg) | Layered decorative editorial symbol; no data values. | draft-buzz |
| [`football.svg`](svg/football.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`playbook-marks.svg`](svg/playbook-marks.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`playbook-pattern.svg`](svg/playbook-pattern.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`diagonal-slashes.svg`](svg/diagonal-slashes.svg) | Full-height offset editorial ribbon; place behind content along the right edge, never centered over the primary symbol. | rising-prospect, falling-prospect, position-battle |
| [`accent-rule.svg`](svg/accent-rule.svg) | Layered decorative editorial symbol; no data values. | scouting-report |
| [`measurement-grid.svg`](svg/measurement-grid.svg) | Layered decorative editorial symbol; no data values. | combine-pro-day |
| [`calendar.svg`](svg/calendar.svg) | Layered decorative editorial symbol; no data values. | team-visit |
| [`star.svg`](svg/star.svg) | Layered decorative editorial symbol; no data values. | award-recognition |
| [`checkmark.svg`](svg/checkmark.svg) | Layered decorative editorial symbol; no data values. | draft-declaration |
| [`chevron-right.svg`](svg/chevron-right.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`arrow-right.svg`](svg/arrow-right.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`minus.svg`](svg/minus.svg) | Layered decorative editorial symbol; no data values. | draft-stock |
| [`plus.svg`](svg/plus.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`status-dot.svg`](svg/status-dot.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`bookmark.svg`](svg/bookmark.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`clock.svg`](svg/clock.svg) | Layered decorative editorial symbol; no data values. | Shared supporting UI |
| [`gauge.svg`](svg/gauge.svg) | Decorative gauge only; no computed score. | Shared supporting UI |
| [`corner-brackets.svg`](svg/corner-brackets.svg) | Layered decorative editorial symbol; no data values. | top-prospect |
| [`burst.svg`](svg/burst.svg) | Layered decorative editorial symbol; no data values. | record-milestone |
| [`handshake.svg`](svg/handshake.svg) | Layered decorative editorial symbol; no data values. | team-visit |
| [`etched-texture.svg`](svg/etched-texture.svg) | Very subtle etched diagonal grain, clipped by the card boundary. | rising-prospect, falling-prospect, top-prospect, draft-stock, combine-pro-day, injury-update, team-visit, scouting-report, position-battle, draft-declaration, transfer, award-recognition, record-milestone, mock-draft-projection, best-fit, draft-buzz |

## Validation

All SVG XML and local references were checked. A raster contact sheet of every asset and the 16-template board were visually inspected. The generated React artwork passed an isolated TypeScript check, and the proposed component was compiled and rendered to static HTML. Browser-based layout inspection was unavailable in this session; responsive app QA remains necessary after integration. Do not treat the static composition board as a screenshot of the running app.
