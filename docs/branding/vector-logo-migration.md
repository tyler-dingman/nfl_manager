# Down & Distance vector logo migration

The supplied `public/images/team_branded_logos/down_distance_logo_vector.svg` remains unchanged and is the only editable geometry source. `npm run logo:generate` extracts its exact path strings and viewBox into a framework-free module shared by React and React Native. `npm run logo:check` detects drift; production builds run that check automatically.

## Path mapping

The SVG has one group (`Background`), six paths, no strokes, and four original styles:

| Original path | Original style | Actual artwork | Dynamic treatment |
| --- | --- | --- | --- |
| Path 1 | s0, `#fbb815`, opacity 1 | Outer badge silhouette/border | border |
| Path 2 | s1, `#360c0b`, opacity .95 | Inner background | background |
| Path 3 | s2, `#fab714`, opacity 1 | Ampersand badge and ruler ticks | badge / ticks |
| Path 4 | s3, `#f9f9f9`, opacity 1 | Both DOWN and DISTANCE letters, including filled counters | lettering |
| Path 5 | s1, `#360c0b`, opacity .95 | Letter counters and ampersand | background / ampersand |
| Path 6 | s0, `#fbb815`, opacity 1 | Small interior counter of ampersand | badge |

Paths 3 and 5 contain disconnected regions requiring different colors for some references. They are rendered through rectangular clips placed in empty space. No path coordinates are rewritten. Each mounted SVG has unique clip IDs. All six master paths retain their order and geometry, and both renderers retain `viewBox="0 0 1594 806"` and `preserveAspectRatio="xMidYMid meet"`.

The recolored interiors use opaque reference colors. Applying the export's .95 opacity over the outer border would contaminate backgrounds and letter counters with the border color. Outside the badge stays transparent. There are no raster image layers, filters, or new background rectangles.

## Color sources

`src/lib/branding/team-logo-colors.ts` reuses `getTeamBrandTheme` and the existing artwork palette at `public/images/team_branded_logos/down-distance-team-colors.json`. It uses the current theme token when that agrees with the reference palette. Artwork-specific secondaries preserve Denver navy, Detroit silver, Cincinnati white, Saints white, and Jets white without changing UI themes.

`team-logo-overrides.json` contains measured dominant background colors from the 28 approved PNGs: the textured/tinted logo backgrounds are different from the flat UI `dark` tokens. Arizona, Atlanta, Baltimore, and Cincinnati use the new master geometry with canonical palette colors and no PNG-sampled overrides. Their old AI-generated PNGs are incorrect and are not targets for reproduction. These are logo-only overrides; no site theme colors were changed.

Most teams use their artwork secondary for the border, badge, and ticks, white lettering, and the background color for the ampersand. Exceptions:

- Arizona: gold border/ticks, maroon badge, white lettering/ampersand, black background.
- Atlanta: gray border/badge, red ampersand/ticks, white lettering, black background.
- Baltimore: gold border/ticks, purple badge, white lettering/ampersand, black background.
- Cincinnati: white border/ticks/lettering, orange badge, black background/ampersand.
- Kansas City retains white lettering even though its UI light token is cream.
- Denver uses the team light token (white) for the outer border and primary token (Broncos orange) behind the ampersand and for the ruler ticks. These regions intentionally supersede the PNG; other colors are unchanged.
- The generic version keeps cream lettering/border, red badge/ticks, and navy background/ampersand. Unknown teams use this fallback.

## Migrated usages

Updating `FiveWideLogo` migrates the shared desktop/mobile site header and its consumers, home/team picker, login, onboarding, promos, realtime lab, Falco avatar, and preview gate. The standalone `FiveWideWordmark` also uses the vector. The native app's `MobileHeaderLogo` and navigation drawer use the native component and selected team context; 32 bundled raster imports were removed from the native branding hook.

The web mobile menu does not contain a Down & Distance artwork logo; its existing content is unchanged. Team icons, favicon/app icons, merchandise prints, and Front Office artwork are untouched. All reference PNGs and fallback URL mappings remain available.

## Dimensions and limitations

No logo-container, header, drawer, margin, padding, alignment, max-size, breakpoint, or navigation styles were changed. The generic web logo explicitly retains the old badge's intrinsic layout ratio (`1601 / 818`); team logos use the master ratio (`1594 / 806`) with contain fitting.

All 32 teams were selected through the actual local site's team picker. Replacing each rendered SVG temporarily with its original PNG confirmed identical header element dimensions: 119 × 59.5 browser pixels at a 393px viewport, including the site's existing font scaling. The independent component audit confirmed invariant dimensions across all teams at 320, 393, 768, and 1440px viewport widths. The generic logo's unconstrained element dimensions also match the old badge. Native header dimensions remain 104 × 46 with 3px vertical margin; drawer dimensions remain 132 × 68.

**Identical element dimensions do not mean pixel-identical artwork footprints for every reference.** Arizona (1627 × 967), Atlanta (1659 × 948), Baltimore (1759 × 894), and Cincinnati (1767 × 890) are incorrect AI-generated artwork with different PNG geometry/proportions, some with opaque black canvas corners. They are intentionally replaced by the same new SVG geometry as every other team. The generic badge (1601 × 818) also differs from the master. Reproducing those silhouettes/footprints exactly would require changing the supplied geometry or introducing team-dependent scaling. This implementation preserves the master geometry, transparency, and stable team sizing instead. The other 28 team PNGs share the master's 1594 × 806 canvas.

All PNGs have raster antialiasing, texture, or shading which a flat-fill vector does not reproduce pixel-for-pixel. The 28 matching-canvas references pass per-region mean RGB-channel error below 6/255. The four incorrect references are intentionally excluded from PNG color matching; the geometric pixel-error threshold does not apply to them.

## Verification

- Web and native TypeScript checks pass.
- Targeted web ESLint passes without warnings.
- `npm run logo:check` verifies exact extracted geometry.
- `npm run logo:audit`: selects all 32 teams in the real shared component/store at four viewport widths (128 cases), compares generic sizing, enforces PNG color thresholds for matching geometry, and creates a 32-team PNG/SVG contact sheet.
- `npm run logo:audit-native`: renders the real native component through React Native Web, checking header and drawer dimensions for all teams (64 cases).
- With the development server running, `PLAYWRIGHT_BASE_URL=http://localhost:3100 node scripts/audit-team-logo-site.mjs`: exercises the actual site's 32-team picker, checks PNG/SVG header dimensions, and captures desktop/mobile/menu screenshots.

Audits write review images and JSON measurements to `/tmp/down-distance-logo-audit`. Desktop header, mobile header, and menu screenshots were visually inspected. Native checks use React Native Web; an iOS/Android device build was not run. Native development clients need rebuilding after adding `react-native-svg`, using the project's normal build workflow. The package is the version documented for [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/svg/).

## Changed files

- `src/components/branding/fivewide-logo.tsx`
- `src/components/branding/fivewide-wordmark.tsx`
- `src/components/branding/team-branded-logo.tsx` (new)
- `src/lib/branding/team-logo-paths.ts` (generated, new)
- `src/lib/branding/team-logo-regions.ts` (new)
- `src/lib/branding/team-logo-colors.ts` (new)
- `src/lib/branding/team-logo-overrides.json` (new)
- `apps/mobile/components/mobile-navigation.tsx`
- `apps/mobile/components/team-branded-logo.tsx` (new)
- `apps/mobile/lib/team-branding.ts`
- `apps/mobile/package.json` and `apps/mobile/package-lock.json`
- `package.json`
- `scripts/generate-team-logo.mjs` (new)
- `scripts/audit-team-logo.mjs` (new)
- `scripts/audit-team-logo-native.mjs` (new)
- `scripts/audit-team-logo-site.mjs` (new)
- `docs/branding/vector-logo-migration.md` (this report)

The user-supplied master SVG was already untracked when work began and remains unmodified. Pre-existing `.DS_Store` changes were left alone.
