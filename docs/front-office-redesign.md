# Front Office redesign

The Home composition described below has been superseded by the [approved Home rebuild](front-office-home-final.md). Other section-page work remains in place.

Implemented against all six supplied references, with the neutral-surface rule taking precedence over tinted mockup backgrounds. Live player, contract, draft, transaction, and franchise data remain the source of displayed values.

## Shared system

- `src/components/front-office/front-office-system.css` owns neutral surfaces, typography, shared controls, table density, responsive layouts, focus treatment, and dialog constraints.
- `AppShell` provides the desktop franchise sidebar, compact live summary, and mobile/tablet drawer. Navigation recognizes the existing `/offseasonmanager` aliases.
- `FrontOfficeStrategicHero` uses the supplied neutral football diagram. The uploaded directory is actually named `graphics ` (with a trailing space); the three production SVGs were copied to `public/assets/front-office/graphics/heroes/`. References were preserved in place. No screenshot slices or fonts were imported.
- Team theme tokens keep surfaces constant. Jets use configured green, Chiefs accessible red, and Bears configured orange. Buttons use contrasting labels; links and focus indicators use an accessible accent variant.
- Existing player and prospect dialogs, contract controls, menus, notifications, draft controls, and loading/empty/error states inherit the same treatment. Portaled menus and the news drawer receive the necessary theme context.

## Page coverage

Primary pages: franchise Home (`/experience`), Roster, Free Agency, Draft Central, League Central, and Trade Hub.

Other reviewed surfaces:

- Roster depth-chart, contracts, and practice-squad views; cap-space comparison; legacy manage-team and trade-builder routes.
- New `/front-office/development`: live roster search, trend and age filters, baseline/current rating comparison, and player-detail access. Missing baselines are shown as unavailable; no historical progression is fabricated.
- Draft big board, guide/scouting, position rankings, prospect profiles, team needs, history, and mock draft room/setup/running states.
- Trade partners, finder, offers, block, recently viewed, activity, legacy/new trade construction, and player targets.
- League news, individual stories, standings, schedule, and transactions; messages and settings.
- Front Office public entry, season simulation, offseason recap, and season recap.

Roster and free-agency tables now have working 10/25/50/100-row pagination alongside their existing filters and sorting. Supporting panels move below the main task on narrow screens. Dense tables scroll inside labeled, keyboard-focusable regions. Section tabs remain independently scrollable. Navigation becomes a focus-managed drawer below desktop width. Metrics reflow into a two-column phone grid; trade columns stack.

The trade-tools review exposed an existing crash when an error response was treated as a successful payload. The endpoint now authorizes the durable save before restoring its process-local cache; tools validate responses and expose a retry state.

## Verification

Results and rendered screenshots are in `artifacts/front-office-redesign/`:

- Six primary pages at 320, 390, 768, 1024, and 1440 pixels (`audit.json`).
- 27 secondary route/view combinations at 320 and 1440 pixels (`secondary.json`).
- Development, public entry, simulation, league-story, and trade-target pages at all five widths (`additional.json`).
- Isolated Jets, Chiefs, and Bears browser contexts: page `rgb(6,18,25)`, panels/header `rgb(9,26,32)` for every team; respective button accents `#125740`, `#E31837`, `#C83803` (`themes.json`).
- Roster search/empty state/reset, sorting, pagination/page size, player-detail tabs, mobile focus/Escape/navigation, trade assets/picks/reset, prospect detail, and news drawer (`interactions.json`). Development filters and a forced trade-load failure/retry were also exercised.
- Mock draft setup, starting a one-round draft, and pausing the running draft were exercised; the paused state exposed Resume Draft (`draft-workflow.json`).
- `tsc --noEmit`: passed. Targeted ESLint: passed. 39 Front Office/navigation/transaction tests plus 5 focused theme tests: passed. All 32 configured team themes pass the contrast audit. `git diff --check`: passed.

A broader theme-test invocation also reaches an existing assertion about the unrelated account navigation implementation (`known selected states use the shared semantic filled-primary contract`). That assertion fails against pre-existing account-screen changes and was left untouched. The Front Office-specific checks pass.

The screenshot runner is reusable with an authenticated local QA storage file:

```sh
FO_AUDIT_STORAGE=/absolute/path/to/storage.json node scripts/audit-front-office-redesign.cjs
```

Do not commit browser storage or session credentials. Validation used a temporary user in the verified localhost database, not a production account. The temporary user, browser session storage, and account setup/cleanup scripts were removed after validation.

## Design limitations

The package includes no font files. Following the approved typography specification, editorial feature headings now use Barlow Condensed ExtraBold Italic (800), loaded through `next/font/google`. The reusable `FrontOfficeFeatureHeading` component and `.front-office-feature-heading` treatment are opt-in; standard titles and UI retain the existing system sans stack. Home uses the requested two-line focus headline, with additional natural wrapping on narrow screens. Chromium confirmed the real `BarlowCondensed-ExtraBoldItalic` font with synthesis disabled at 320–1440px; screenshots and font identity evidence are in `artifacts/front-office-typography/`. Typography checks used isolated browser-only franchise state and an unavailable-data response; no account or persisted franchise was changed. TypeScript and the seven existing display-type tests pass. Targeted lint has only the two existing Home image warnings. Existing imagery and actual application content differ from mockup photographs and sample statistics; these were intentionally not copied into production. Player Development compares available current/baseline ratings rather than claiming a historical development simulation.

## Prominent stat typography

`front-office-font.ts` loads only Barlow Condensed 800 normal and italic through `next/font/google`; Next.js serves the generated font assets. No font binary was added to source control. The shared CSS variable is available from the root layout without changing the site's default font.

- `.front-office-feature-heading`: ExtraBold italic for editorial features.
- `.front-office-stat-value`: ExtraBold normal, tabular figures, 0.01em tracking, line-height 1, no synthesized font, and no wrapping.
- Standard UI: existing sans-serif for labels, names, buttons, headings, and dense tables.

The shared status bar displays Team OVR, live Record, Cap Space, and Roster Size. Its record comes from the existing phase-control simulation state; unavailable records show a dash. Season remains in the franchise sidebar. Values scale to approximately 39px at 1440px and 34px on the current mobile root sizing. Tablet phase controls move below the metrics to preserve room for monetary and roster values. Trend badges keep their normal UI font and semantic colors.

Opt-in stats also cover prominent player OVR/performance values, prospect fit scores, featured prospect rank and draft insights, draft pick tiles, draft room grades, draft recap metrics, and trade cap projections. Inline contract facts and dense table numbers retain the UI font.

Validation evidence: `artifacts/front-office-stats/verification.json` and screenshots. Forty views cover the six primary routes at 320/390/768/1024/1440px, plus Chiefs and Bears Home at those sizes. No page overflow, status-cell overflow, or browser exceptions occurred in the final run. Chromium identifies the actual `BarlowCondensed-ExtraBold` and `BarlowCondensed-ExtraBoldItalic` faces. The pairs 77/78, 0-0/1-0, and $39.6M/$35.2M have equal rendered widths. Labels retain the UI font and status values retain off-white across teams.

These are isolated browser fixtures for typography; API-backed content may show unavailable states. No authenticated account or persisted franchise was changed. TypeScript and 13 existing phase/display tests pass. Targeted lint has no errors and only three existing `next/no-img-element` warnings in the player details modal.

## Compact player search

`PlayerFilterToolbar` now keeps position filters, an expanding search icon, and table options in one row. It replaces the separate search rows in shared roster/free-agent tables, expiring contracts, and the trade block. Opening search focuses the input and expands it left; Escape or the close button clears the query and restores icon focus. Empty search collapses when focus leaves. On phones, the expanded search temporarily occupies the position selector's space. Reduced-motion preferences disable the width transition.

Browser checks in `artifacts/front-office-search/verification.json` cover roster and free agency at 1440/768/390/320px, with unchanged toolbar height when opening search, no page overflow, roster filtering, and Escape/focus restoration. Fixtures are browser-only. TypeScript and targeted lint pass.
