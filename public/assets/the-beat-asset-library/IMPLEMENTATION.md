# Codex implementation handoff

Implement the reference card system using this library, the existing Barlow Condensed font, the site's existing body font, and the site's existing authorized logo assets. Read README.md and manifest.json before editing. The references establish visual intent; the manifest is the normalized coordinate contract. Do not replace authored diagrams with emoji or unrelated icon-library symbols.

1. Build a shared BeatCard shell with dark top and white editorial body. Use beat-cards.css as a scoped starting point. Feed family, selectedTeam, age, headline, summary, sources, updatedAt and family-specific structured data into it.
2. Bundle SVGs as inline components. Render shared layers once followed by family decoration. Color roles: base is fixed neutral; texture/white use #fff; accent uses var(--beat-accent). Each layer's wrapper owns its manifest cssOpacity. No parent group opacity should fade live text.
3. Render all semantic text with HTML. manifest text slots describe position/size, not source data. The generic preview is a composition reference, not a production data renderer. For stats, injury, timeline and contract, create individual semantic rows at README's coordinates. Do not render a multiline block that loses value/label styling. Make live text visible/selectable; decorative duplicates are aria-hidden.
4. The manifest layers omit optional elements intentionally: mini-bars, position-framing, status-watch-frame. Add only when there is room. The Standard D recipe additionally needs a 24px team abbreviation at x246/y119, width54/height30. Matchup/result/transaction/scouting logo slots are described in README and are not graphical assets.
5. Map existing team IDs to the 32 stable config keys. Use LAR for Rams, LAC for Chargers, LV for Raiders, WAS for Commanders; unknown IDs use defaultAccent. Do not fall back to Chiefs red. Apply the selected team's accent to number/underline/stripe/chevrons/top rule/marker. Keep background neutral.
6. The white triangle in video/play-disc.svg is a neutral foreground. Inline it and override its path fill using `.beat-play-disc path{fill:var(--beat-on-accent,#fff)}`. Set --beat-on-accent to #0b1115 if relative-luminance(accent) > .18, else #fff. This yields at least ~4.5:1 against configured accents. Use the same approach for any small text placed on accent fills. Do not recolor the entire play SVG with a mask.
7. Use the site's loaded Barlow Condensed 500/600/700/800. No synthetic bold and no font download required by this package. Wait for document.fonts.ready for screenshot comparisons. Top text size scales with composition width. The manifest's fontSize/3.2 yields cqw. For browser targets without container units, a ResizeObserver can set an explicit scale custom property; the CSS fallback sizes are only for a 320px card. Test at280/320/400px. Below280px use a list layout rather than shrinking live text indefinitely.
8. Determine Standard A–D using a stable hash of story.id. Example JavaScript:

```js
export function standardVariant(id) {
  let hash = 2166136261;
  for (const ch of String(id)) hash = Math.imul(hash ^ ch.codePointAt(0), 16777619);
  return ['standard-a','standard-b','standard-c','standard-d'][(hash >>> 0) % 4];
}
```

9. Only select a special family if required structured fields exist. Missing game score, quote, status or contract never becomes invented data. Missing logos use live abbreviations. Unknown family maps to Standard. Long headline clamping must preserve full accessible link text. Do not let logos overlap category text or age.
10. Match the expanded footer in the 4-column reference: source/update metadata on its own line; bookmark Save, Share with the Crew and navigation arrow beneath. The 5-column reference's compact footer may be an explicit alternate density, not an accidental hybrid. Use existing app controls and wire Save/Share/navigation; placeholder preview symbols are not production icons.

## Acceptance checklist
- Every article including fallback has the neutral dark graphic top and white bottom.
- All 32 team options recolor accent layers; Bills blue, Bengals orange, Packers yellow.
- Roster card has exactly four distinct chevrons to the right of the logo.
- No SVG text, logos, embedded fonts, raster textures, external dependencies or duplicate IDs.
- Ghost abbreviation is low-opacity live Barlow Condensed; readable headline is white-body HTML.
- 2-digit lists, long surnames/actions, three-letter positions and missing optional data remain readable.
- At280/320/400px, zero text/logo collisions or cropped semantic content.
- Keyboard actions, 44px hit targets, screen-reader names, focus visibility and reduced motion checked.
- Compare screenshots with both original reference sheets after the site's fonts load. Texture is intentionally a vector approximation; do not claim pixel-identical reconstruction.

## Library verification
The build parses every SVG as XML, rejects text/image/script/foreignObject, checks the shared viewBox and unique names, checks currentColor on non-base assets, validates all manifest recipe references, and checks32 distinct team entries. Archive contains SHA256SUMS.txt. Browser screenshot QA could not run in the sandbox (browser launch and local server were blocked). The offline index is provided for visual review; integration into the actual site and its fonts must still be verified by the implementing Codex session.
