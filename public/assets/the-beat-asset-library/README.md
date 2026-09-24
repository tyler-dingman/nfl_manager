# The Beat — production SVG asset library v1.0

## Reference and fidelity
Built from the two “The Beat — Card Types” PNG attachments recovered from the linked Update Stadium Sponsors conversation. The requested `/mnt/data/image.png` was not mounted here. Both supplied sheets were inspected: the 4-column sheet defines the main composition and expanded Save/Share footer; the 5-column sheet supplies scouting, coaching, league, video, and fallback treatments. The references differ in top height and footer design. This package normalizes them into one 320 × 180 top canvas. Coordinates below are an explicit implementation specification derived from the images, not original source-design measurements. The scratch texture is an original vector approximation, not an extracted bitmap. Exact font matching requires the host site's existing fonts. No logos or fonts are redistributed.

## Contents and quick start
- `manifest.json`: complete asset index, color roles, opacity, layers, family recipes, live-text rectangles.
- `beat-cards.css`: reference card shell and typography rules; scope/adapt to the site's existing components.
- `config/team-accents.json`: all 32 teams and a neutral default.
- `preview.html`: offline visual index, 20 compositions, 32-team accent selector, inline SVG examples. Open locally. Font substitution is disclosed in the preview.
- `IMPLEMENTATION.md`: integration contract, edge cases, acceptance checklist.
- SVG folders: graphics only. SVGs contain no text, font outlines, team logos, scripts, external references, filters, raster images, or dependencies. Quote marks are deliberately geometric graphics.

## Shared canvas, sizing, and layering
Use a 320 × 180 design coordinate system, aspect ratio 16:9. The 3 CSS-pixel top border is additional to the 180px graphic area. At 320px card width the total top is 183px; at 400px it is 228px. SVGs use `viewBox="0 0 320 180"`, `fill="none"`, and default `preserveAspectRatio="xMidYMid meet"`. Position every asset at inset:0; width/height:100%. Do not crop or independently stretch individual layers. Scale the entire composition uniformly. Preserve normal SVG stroke scaling; do not add non-scaling-stroke. If using the short tops from the 5-column reference, author a separate coordinated text/layout variant; do not crop this 16:9 recipe.

Render in this order:
1. Neutral `dark-base` (#0b1115), full opacity.
2. White vector grain at .34, white etched schematic at .14, white shadow bands at .035.
3. Family decoration from manifest, with listed CSS opacity. Internal element opacities multiply this value; do not apply the same CSS opacity a second time.
4. Ghost team abbreviation as live HTML text, white at .085, font weight 800, negative .04em tracking. Keep behind readable content; never use opaque giant team text.
5. Logos from the site's authorized existing logo system (if available), foreground typography, data, diagrams/underlines that must sit above the ghost.
6. Category and age labels. The 4px × 18px accent marker sits at x14/y13. Category x28/y14, 12px Barlow Condensed 600, .08em tracking, 1 line; age right16/y14, 12px weight500. No category pill.

Accent stripes have intrinsic varying opacity. The dark base always remains neutral, even for gold, orange, or blue teams. Accent should occupy details and selected display numerals, not the whole background. Background diagrams must remain secondary to text. Expose SVG and ghost layers as aria-hidden, with pointer-events:none.

## Live typography and white editorial area
Use the site's already-loaded **Barlow Condensed** for all uppercase top labels, numbers, position outlines, player names, quote copy, descriptors, week labels, film titles, status and score text. Every name, score, numeral, category, abbreviation, quote, jersey, time, status, and contract value stays live HTML; never convert it to an SVG path. Body headlines use the site's existing sans-serif headline font; the CSS's Arial is a portable substitute, not a request to change the site font.

Exact top slots, sizes, and weights are in manifest.recipes. x/y are top-left coordinates, not text baselines. All dimensions scale by cardWidth/320. Convert x/width to percentages of 320; y/height to percentages of 180; font-size to size/3.2 cqw. Default live line-height .96; uppercase; tracking 0. Use line-height 1.05 for quote and status lists, 1.1 for small contract and attribution text. Outlined positions use transparent fill and 1.3px accent text stroke at 320px; scale stroke with width. Provide a readable hidden equivalent, since outlined position text is decorative.

White body: 18px left/right, 14px top, 16px bottom; minimum height 198px including padding. Headline 19px/21.85px, 700, tracking -.035em; up to 3 lines. Prefer 55–85 characters editorially but clamp by rendered lines, not character count. Short headlines do not force summary placement to equal height; footer remains bottom-aligned via flex. Summary begins 9px below title, 14px/17.5px, 400, #45658c, maximum 3 lines. Metadata: 10px/13px, 600, .06em tracking, #5077a6, uppercase; minimum gap18px above. Footer gap14px, labels11px/13.2px, 600. Navy #071c49 for title and controls on white. Use the site's actual accessible bookmark/share/arrow components, 16px icons, 44px minimum interactive hit areas; the preview's symbols are placeholders. Do not use yellow/light team accents for small text on white.

Keep full titles in link text for assistive technology even when visually clamped. Main article link, Save button, Share button must be siblings; never nest interactive elements in a card-wide link. Ensure focus outline is visible outside any clipped card shell. Avoid redundant tab stops. Time and source count must come from real story data.

## Family details and live content
- **Standard / feature:** large ghost team abbreviation on the right, stripe lower right. Every uncategorized story uses Standard. It is never text-only.
- **Game matchup:** existing logo slots x20/y60/w78/h72 and x222/y60/w78/h72; use contain, preserve ratio, no distortion. Week and VS centered; kickoff at bottom. Use abbreviations in slots if no authorized logo is available.
- **Game result:** smaller logo slots x16/y68/w66/h56 and x240/y68/w66/h56; live scores separated at x160. Final/OT centered below. Do not invent a result for a future game.
- **Numbered/list:** giant live numeral, two-line descriptor, faint routes on right. 1 digit uses110px; 2 digits reduce to86px; 3×3 uses64px and a120px slot with descriptor shifted to148px. Use structured number/descriptor fields.
- **Stats:** left count + descriptor; right three data rows at y42/83/123. Each row value19px/20px, label10px/11px. Mini bars are optional decorative composition; if bars encode actual measurements, construct live data-bound SVG/HTML widths, provide units and an accessible table, and do not reuse arbitrary decorative values.
- **Player:** name up to two lines, underline at y139; outlined position center-right, jersey at far right. Two-character position default110px; three characters72px. Name29px default, minimum23px; if it still exceeds two lines, use standard instead of clipping identity.
- **Injury:** giant live W3/IR; three status rows. Faint crosses stay background. Rows must be verified availability data; an article merely mentioning injury can use Player or Standard.
- **Transaction:** logo x25/y48/w75/h49, FOUR separated right chevrons x126–167/y66–76, action x181/y54, player line below. Contract divider at x218. Action SIGNED34px; RELEASED/ELEVATED26px. Rotate the complete chevron layer 180deg about (146.5,71) only for an intentional opposite direction; never imply movement semantics without data. Contract is optional, never fabricated.
- **Quote:** geometric opening/closing marks; live quote <=3 short lines in given slot, attribution beneath. Drop closing marks if a long quote collides. Use the article's actual quote with attribution, or choose Standard.
- **Film:** FILM ROOM on left with underline, clear X/O diagram on right, diagonal lower-right stripe. Schematics are illustrative, not claimed to reconstruct a real play.
- **Developing:** timeline x34, nodes y62/103/145; text starts x60, time13px600 and detail12px400 below each. Limit to 3 confirmed updates. Optional pill only when third detail uses <=140px width; do not overlay it on long update text. No animation required.
- **Business/community:** ghost abbreviation on left, abstract linked geometry on right, live category title lower left; no handshake/heart centerpiece. This intentionally honors the requested abstract treatment rather than reproducing the heart on one reference sheet.
- **Scouting:** KNOW YOUR FOE live left, opponent logo slot x223/y47/w65/h60, route diagram lower right. Omit logo for an unconfirmed opponent.
- **Coaching:** GAME PLAN live left with restrained route diagram right.
- **League:** live LEAGUE UPDATE and abstract network; no embedded NFL shield. A host-provided licensed league mark can be used in a separately reserved left slot if title is moved right.
- **Video:** static decorative waveform at right, play disc left, live title center. Actual playback requires real media metadata and a labeled control; do not show a play action for an ordinary text article.
- **Standard A:** right ghost abbreviation + corner rule + stripe. **B:** ghost + X/O routes. **C:** ghost + field ticks. **D:** live ghost category word + smaller live team abbreviation at x246/y119,24px700. Choose stable hash(story.id)%4, not randomness or title text.

## Color integration
Set `--beat-accent` on each card from config for the **selected team Beat**. Opponent logos retain their existing natural colors; the card accent remains selected-team-owned. These are curated UI recommendations, not certified official brand hex values. Several dark primary colors have intentionally been brightened; gold/silver secondary colors are used where more legible. Default unknown team is silver. Bills use blue, Bengals orange, Packers yellow. Audit contrast when changing foreground colors. White play triangles must switch to #0b1115 on light accent discs (gold/silver) for legibility; see IMPLEMENTATION.md.

**Important:** currentColor inherits from the surrounding HTML only for **inline SVG**, imported SVG components, or same-document symbols. `<img src="asset.svg">` does NOT inherit parent currentColor. Do not use external SVG image/CSS background loading for accent layers and expect recoloring. Preferred: import as components with your existing SVG pipeline, or inline these trusted bundled files at build time. For external mask use, treat only monochrome assets as masks; mask loading loses multitone internal colors such as the play triangle. All files are ID-free, so repeated inline instances cannot collide.

## Asset index
Each row applies to the full shared canvas unless a placement specifies the occupied region. Foreground assets remain at recipe coordinates. Files are reusable across all 32 teams.

| Asset | Color role | CSS opacity | Used by | Placement |
|---|---|---:|---|---|
| [dark-base](backgrounds/dark-base.svg) | base | 1 | all | Full top; neutral opaque base. |
| [dark-grain-texture](backgrounds/dark-grain-texture.svg) | texture | 0.34 | all | Full top; white currentColor; tile-free fixed seed vector grain. |
| [etched-schematic-texture](backgrounds/etched-schematic-texture.svg) | texture | 0.14 | all | Full top above grain; faint chalk fractures. |
| [diagonal-accent-stripes](backgrounds/diagonal-accent-stripes.svg) | accent | 0.85 | standard, business-community, game-result, film, league | Bottom right; full canvas; stripe boundaries intentionally clipped. |
| [diagonal-shadow-bands](backgrounds/diagonal-shadow-bands.svg) | white | 0.035 | all | Full top under foreground; broad neutral diagonal bands. |
| [xo-corner-routes](playbook/xo-corner-routes.svg) | white | 0.45 | numbered, standard, scouting | Rightmost 90 px; empty left content area. |
| [field-yard-lines](playbook/field-yard-lines.svg) | white | 0.13 | standard, game-matchup | Right x184–298, y35–180; numbers remain live if used. |
| [matchup-framing](game/matchup-framing.svg) | white | 0.3 | game-matchup | Logo slots x20/y60/w78/h72 and x222/y60/w78/h72; center text x108–212. |
| [result-separator](game/result-separator.svg) | accent | 0.65 | game-result | Score divider x160 y66–128; scores in x92–151 and x169–228. |
| [numbered-list-background](stats/numbered-list-background.svg) | white | 0.27 | numbered | Numeral x18–120; descriptor x128–240; routes at right. |
| [data-dividers](stats/data-dividers.svg) | accent | 0.72 | stats | Vertical separator x183; three live rows y42,83,123. |
| [mini-bars](stats/mini-bars.svg) | accent | 0.75 | stats | Optional chart x205–294 y59–114; decorative only, no numeric meaning. |
| [name-underline](player/name-underline.svg) | accent | 1 | player, film | Underline below two-line player name; x22 y139 w105 h5. |
| [position-framing](player/position-framing.svg) | accent | 0.55 | player | Optional brackets around live outlined position; never a rasterized LT. |
| [status-watermark](injury/status-watermark.svg) | white | 0.065 | injury | Background only; crosses must stay behind W3/status typography. |
| [status-divider](injury/status-divider.svg) | accent | 0.75 | injury | W3 x20–160, status rows x186–302 at y72/102/132. |
| [directional-four-chevrons](transaction/directional-four-chevrons.svg) | accent | 1 | transaction | Exactly four right-pointing chevrons; x126–167 y66–76; right of logo, left of action. |
| [contract-divider](transaction/contract-divider.svg) | accent | 0.85 | transaction | Contract column x230–301, y110–155. |
| [opening-quote-marks](quote/opening-quote-marks.svg) | accent | 1 | quote | Opening glyph-like graphic x20–62 y49–78; quotation copy remains live. |
| [closing-quote-marks](quote/closing-quote-marks.svg) | accent | 1 | quote | Closing pair lower right x259–302 y125–154. |
| [strategy-play-diagram](film/strategy-play-diagram.svg) | white | 0.78 | film | Diagram x138–290 y45–156; live FILM ROOM x22–120 y68–131. |
| [story-timeline](developing/story-timeline.svg) | accent | 1 | developing | Rail x34; three nodes y62/103/145; live times x60 y51/92/134. |
| [status-watch-frame](developing/status-watch-frame.svg) | accent | 1 | developing | Optional live STATUS WATCH inside x213–297/y150–167; do not overlap third update. |
| [interlocking-lines](business-community/interlocking-lines.svg) | accent | 0.28 | business-community | Abstract partnership geometry on right; no handshake, no logo. |
| [opponent-route-diagram](scouting/opponent-route-diagram.svg) | white | 0.48 | scouting | Right lower routes beneath opponent logo slot x223/y47/w65/h60. |
| [strategy-routes](coaching/strategy-routes.svg) | white | 0.55 | coaching | Right diagram; live GAME PLAN at x24/y67. |
| [around-nfl-network](league/around-nfl-network.svg) | white | 0.2 | league | Right network; neutral league treatment without NFL shield. |
| [media-waveform](video/media-waveform.svg) | white | 0.38 | video | Waveform right x237–297, centered y101; static decoration. |
| [play-disc](video/play-disc.svg) | accent | 1 | video | Play disk x34–88 y76–130; decorative unless wrapped in a labeled button. |
| [team-type-corner](standard/team-type-corner.svg) | white | 0.16 | standard-a | Variant A: small corner rule; live ghost abbreviation on right. |
| [playbook-variant](standard/playbook-variant.svg) | white | 0.22 | standard-b | Variant B: ghost at x116, route marks at right. |
| [field-variant](standard/field-variant.svg) | white | 0.12 | standard-c | Variant C: ghost at x122 plus field ticks. |
| [wordmark-variant](standard/wordmark-variant.svg) | accent | 0.45 | standard-d | Variant D: live category word x20/y55, small live team abbreviation x246/y119. |
