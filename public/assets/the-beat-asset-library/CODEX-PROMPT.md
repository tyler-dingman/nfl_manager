# Implement The Beat reference card system

Update the existing The Beat page in `/Users/tylerdingman/nfl_manager` using the prepared asset library at `public/assets/the-beat-asset-library`. Implement and verify the change; do not stop at a plan. Work within the existing application architecture and preserve unrelated work in this dirty checkout. Do not commit, push, or deploy unless separately requested.

## Read first

Read applicable AGENTS.md instructions, then these files in the asset folder:
- README.md — layout coordinates, font roles, asset placements, and family-specific rules.
- manifest.json — all 33 assets, their opacities/color roles, and 20 composition recipes.
- IMPLEMENTATION.md — integration and acceptance requirements.
- config/team-accents.json — recommended accents for all 32 teams.
- VALIDATION.md — known limits of the prepared library.

Inspect these two source reference images, available in the originating asset task:
- `/Users/tylerdingman/Documents/Codex/2026-09-24/referenced-chatgpt-conversation-this-is-an-2/outputs/the-beat-reference-main.png`
- `/Users/tylerdingman/Documents/Codex/2026-09-24/referenced-chatgpt-conversation-this-is-an-2/outputs/the-beat-reference-extended.png`

The four-column main image governs card structure and expanded footer. The five-column extended image adds scouting, coaching, league, video, and fallback. They have different top heights. Use the documented normalized 320×180 graphic canvas for this implementation. The offline preview is a component composition aid, not a pixel-perfect typography reference: it has sample data and system font fallbacks. Use the actual reference images and real site Barlow Condensed for visual QA. Do not silently copy preview placeholders into the app.

## Existing integration points already inspected

`src/components/huddle/huddle-story-card.tsx` currently chooses between InjuryGraphicCard, ContractGraphicCard, TradeTalkGraphicCard, RookieBlueprintGraphicCard and a plain top accent bar. Replace this conditional visual system on The Beat with the new shared dark-top system. Every card must receive a graphic top, including Standard; no plain-text remainder. Keep existing props, links, save/open callbacks, source disclosure, first-reported attribution, hot-read semantics, sharing, and material-update data functional. Expand types/adapters only as needed for verified structured fields.

`src/components/team-content-hub.tsx` contains HuddleGrid, filters, URL state, pagination and save handling. Integrate there only where needed to supply card data and selected team. Preserve these behaviors. Confirm which other surfaces import HuddleStoryCard before changing its defaults; scope redesign to The Beat if other consumers would regress. Do not redesign Front Office, native mobile, ingestion, or Film Room as incidental work.

`src/components/front-office/front-office-font.ts` currently loads **only Barlow Condensed 800**, normal/italic. The asset guide's statement that all weights are already available must not be assumed. Reuse the existing font integration pattern and actually load normal weights500/600/700/800 for The Beat, preferably with a Beat-scoped Next font declaration or a carefully shared font module. Preserve Front Office's existing 800/italic behavior. Ensure generated Next font family/variable is applied; a CSS literal 'Barlow Condensed' alone may not resolve the next/font-generated family. No synthetic weights, font-shaped SVG text, or image-rendered headings.

## Exact visual contract

- White body (#fff), near-black top (#0b1115), neutral grain/etched texture; selected team's accent only on intended details. Outer radius10px, subtle border/shadow. No colored background wash.
- Graphic canvas320×180 with uniform scaling. The3px top accent border is additional. Full-canvas inline SVG layers in manifest order; no independently stretched/cropped layers. Shared texture opacity follows manifest, once only.
- Header marker x14/y13/w4/h18. Category x28/y14, Barlow Condensed12px600, .08em tracking. Age right16/y14,12px500. Uppercase; no category bubble. Do not duplicate the category in the white body.
- Live white ghost abbreviation opacity.085, weight800, tracking-.04em. Never embed abbreviation text in SVG. Use selected-team branding; do not treat it as evidence of story subject.
- Use all live-text slot coordinates/sizes in manifest. Respect intentional newline layouts, letter spacing and display weights. All player names, positions, W3, scores, list numerals, quote words, dates and descriptors remain live accessible HTML.
- White-body padding14px top/18px sides/16px bottom. Title19px/21.85px700, tracking-.035em, max3 rendered lines. Body14px/17.5px400, gap9px, max3 lines. Use site's normal body font here, not Barlow Condensed. Title navy#071c49, summary#45658c. Preserve full accessible headline even when visually clamped.
- Footer bottom-aligned with minimum18px gap before metadata. Metadata10px/13px600, .06em tracking, uppercase. Save, Share with the Crew and navigation arrow below with14px separation. Use current site icon/button components and actual handlers. Make44px touch targets without displacing the visual alignment. Existing source disclosure must remain available, preferably expanded on demand so default cards match the references.
- Preserve readable lead-card behavior; do not merely enlarge a normal graphic across two columns and produce a giant top. Use a constrained graphic area or consistent grid treatment justified against the reference. Document the choice.

## Family requirements

Implement each documented composition with typed data and show every family in a development-only fixture/gallery. Production uses special families only with enough real data; insufficient data becomes Standard. Do not fabricate missing scores, stats, injury statuses, contracts, quotes or timelines from the samples.

1. Standard/Feature: live ghost abbreviation plus lower-right accent stripe.
2. Game/Matchup: two authorized site logo slots, centered week/VS, kickoff beneath.
3. Game Result: existing logos, large live scores, thin middle divider, FINAL/OT beneath.
4. Numbered/List: oversized live count plus two-line descriptor and faint right-side routes. Fit two-digit and3×3 counts using documented size reductions.
5. Stats/Data: left count/descriptor, right three value-and-label rows, narrow accent divider. Optional mini-bars must use real values if presenting actual data.
6. Player Focus: two-line name with accent underline; large outlined live position and small jersey number. Account for long names and three-character positions.
7. Injury: giant W3/IR with structured status rows; crosses only extremely faint background. A story merely mentioning injury need not become a report card.
8. Roster/Transaction: logo on left; **exactly four separated right chevrons** immediately to its right; action at right; position/number/name below; optional contract separated at x218. Use documented coordinates, not an arbitrary arrow icon. Long RELEASED/ELEVATED actions need reduced font size.
9. Quote: accent opening/closing graphic marks; white live quote and attribution. No invented quotations.
10. Film/Strategy: FILM ROOM live left with underline and clear schematic routes right. Assets are illustrative unless sourced play data exists.
11. Developing: three-node accent timeline with distinct live time/detail rows; optional status pill must not collide with third update.
12. Business/Community: abstract linked geometry, ghost abbreviation, live label. Use the requested abstract graphic, not a large heart/handshake pictogram.
13. Scouting/Opponent: live KNOW YOUR FOE, authorized opponent logo when known, diagram behind.
14. Coaching/Strategy: live GAME PLAN and right-side route diagram.
15. League/Around NFL: live LEAGUE UPDATE and neutral network; no new embedded NFL shield.
16. Video/Media: disc/play triangle and waveform with live title, only where actual video content is valid. The app deliberately isolates video ingestion from The Beat; keep that policy. Include the renderer in fixtures without changing feed eligibility to force it into production.
17. Standard A–D: team type, playbook, field, wordmark. Stable story-ID hash, never random on refresh. D needs live small team abbreviation at x246/y119 in addition to live category ghost. Unknown category always gets one of these.

## SVG, team colors, and data correctness

Use trusted build-time inline SVG/components so currentColor inherits. Loading an SVG through img/background-image does not inherit the surrounding accent. Do not create a network fetch per card or insert untrusted story content through raw HTML. Keep repeating SVGs ID-free. Set decorative layers aria-hidden and pointer-events:none.

Map actual app team IDs/aliases explicitly into the32 config keys. Bills blue, Bengals orange, Packers yellow. Never use a red fallback for unknown teams; use configured neutral silver. Test every mapping. Bright UI recommendations are intentionally not official brand-hex claims. Logos retain original authorized colors. On a light video disc use dark triangle rather than white to maintain contrast. Accent is not small body text on white.

Inspect current story types/server adapters before classification. Use canonical metadata where available. Conservative deterministic classification with Standard fallback is preferred to unreliable headline-only extraction. Maintain chronological time/source metadata from actual story data. Avoid hydration mismatch for relative time and stable variants.

## Verification and delivery

Run appropriate existing tests and add meaningful tests for classification/fallback,32-team mapping, special-family required data, and preserved save/share/navigation behavior. Review existing editorial/injury-graphic-card tests: assertions demanding old visual component names should be updated to the new intentional design without removing behavioral coverage.

Use the project's existing test setup; run TypeScript checking and lint, then targeted browser checks. Render all families with Barlow Condensed loaded; wait for document.fonts.ready. Compare screenshots against both provided sheets and fix spacing, line breaks, contrast and overlaps. Cover320px and400px card widths,280px edge case, mobile375/390px viewports and desktop1440px. Check Chiefs, Bengals, Packers, Bills, Raiders and at least one teal team visually, and all32 colors programmatically. Verify four-chevron count, long names/actions, two-digit scores/counts, missing logos/data, keyboard interaction and visible focus.

The asset pack's prior browser QA was blocked, so do not treat its preview as already visually approved. Complete actual browser QA here. If an environment constraint prevents a check, say exactly which check remains unverified. Do not claim pixel-perfect reproduction without screenshot evidence. Finish with concise changed-file summary, validation results, remaining limitations and screenshots. Do not stop after merely copying assets or adding a demo; integrate the shared card system into the live /the-beat route.
