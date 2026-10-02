# Native / mobile-web design parity

September 28, 2026. Source changes and local verification record. Android and iOS remain React Native applications. The responsive web implementation is the design reference; the app keeps its persistent six-item bottom navigation.

## Architecture

Web uses DOM/CSS and the app uses native rendering components. Android and iOS share the same native implementation. Shared modules supply team themes, editorial selection, copy, research and draft contracts, parlay generation/results, ownership rules, and the simulated Game Day clock. No WebView was added.

Reusable native components include page headings/states, editorial heroes, section menus, story cards, video overlays, research panels, franchise sections and Crew feed/settings. Future shared changes must update both renderers under the root `AGENTS.md` rule.

## Existing app route coverage

All existing native routes were included in the UI pass. This records implementation coverage, not a claim of pixel-perfect device parity or that every web-only workflow now exists in the app.

| Routes / area | Updated content and layout |
| --- | --- |
| Home | Dedicated stadium-backed homepage hero, full shared introduction, large uppercase headline, team-colored header and Next Up schedule/odds card; editorial sections, Film Room thumbnails, rewards and community entry points |
| Beat / Wire / Film Room | Shared editorial rankings, numbered briefings, filters, cards, circular filled play icon |
| Three and Out / catch-up | Page headings, story hierarchy, spacing, source/detail actions |
| Story / Beat story detail | Editorial content hierarchy, source links, save/share states; story deep links can load their own data |
| Account / profile / security | Account hero, avatar, section menu, labeled forms, connected accounts, password/session controls, data export; failed profile loads cannot expose a blank save form |
| Notifications / notification settings | All/unread filters, read state, delivery preferences, empty/error states, native destinations |
| Saved / search / team picker | White content surfaces, result cards, search controls, team logos, selected states, empty/error feedback |
| Player detail | Portrait hero, first/last-name hierarchy, Overview / Stats / Contract / News sections |
| Trivia / trivia game | Four Minute Drill hero, scheduled events, question/answer controls, timer and buddy lobby presentation |
| Crew | Crew hero, stats, Feed / Leaderboard / Members / Settings, native text/link/photo posts, reactions, comments, ownership and membership actions |
| Game Day | Stadium hero, room cards, predictions, activity/composer, live simulated countdown and failure feedback |
| Rewards | Display typography and shared app shell; existing reward progression/actions retained |
| Merch / product | Department menu, storefront, product image/badge, sizes, quantity, purchase controls and missing-image/load states |
| Cart / checkout | Cart hierarchy, empty states, checkout headings and native fields; empty carts cannot proceed through checkout |
| Orders / order detail | Filters, order summaries, status timeline, shipping address and refund/net-paid details |
| Sign-in | Mobile-web account card, social controls, email/password inputs, loading/error states; existing authentication and isolated demo login retained |

## Expanded native Front Office

The former roster-only surface now includes the experience landing and franchise initialization/restoration, phase progression, roster management, free-agent offers, re-sign/release controls, Draft Central/room, Big Board, Position Rankings, Draft Guide, Team Needs, My Drafts, trade building and evaluation, Trade Finder, Trade Block, partner discovery, offer/activity lists, recently viewed targets, League News/details, Messages, development, ownership, schedule, standings, transactions and settings.

Ownership uses the same project/sponsor/financial rules as web and has Central, Stadium, Facilities, Business, Fan Experience, Report Card and Legacy sections. Its local snapshots and saved parlays use chunked storage so large values do not exceed SecureStore's per-value limits. Trade, roster, draft and simulation actions call the existing APIs.

Draft boards/favorites/order and recently viewed trade targets are scoped to the franchise save. Native scouting details and league-news article modals use shared web data contracts. The outer Front Office menu is consolidated once a franchise is active; real-world roster/transactions remain reachable from the franchise menu.

## Expanded native Parlay Lab

Native sections cover Home, Trends, Games, Players, Teams, Generator, Alt Stack, My Parlays and Settings. Secondary sections no longer repeat the large home hero. Research has a player hero, hit-rate metrics, game chart, Overview / Game Log / Matchup / Splits / Line Ladder panels, add/remove controls and a persistent close button.

The generator uses the shared constraint engine, separate results, regeneration, refinements, recent requests and explicit add-to-build controls. Both web and native use the same fresh-line/price/game validation before adding generated legs. Alt Stack has leg-count, price, hit-rate, game and market controls, researched results, swap/remove and refreshed add-to-build validation. Saved parlays preserve price snapshots, use account-scoped device storage, and refresh results through the grading API using the same merge logic as web. They are device-local, not account-synchronized.

## Verification

- Mobile TypeScript and root/web TypeScript passed.
- Android and iOS Metro/Hermes bundle exports passed. These are JavaScript bundles, not signed APK/IPA builds.
- 30 targeted tests passed: demo-session isolation, large-snapshot persistence/failure recovery, player aggregation, saved-price snapshots/results including duplicate IDs, ownership rules, generator constraints, Alt Stack selection/swaps and fresh-build validation.
- Phone-sized React Native Web previews use isolated API responses at 412 × 892. Eight main routes, 21 secondary/detail routes, sign-in, research tabs, franchise sections, trade selection/evaluation, draft submenus, trade submenus and Parlay section menus were exercised.
- Account preferences, persistent bottom navigation, research open/close, profile-load failure protection and research error feedback were checked.
- Kansas City and Seattle theme previews were captured. Preview content is illustrative and does not validate live account/data integrations.
- The expanded menu checks caught an Alt Stack malformed-response crash; native response-shape validation now shows an error instead. The isolated fixture was also corrected to match the endpoint contract.
- Native device text scaling, keyboard/safe-area behavior, photo permissions/upload and end-to-end authenticated mutations remain unverified. No production login, purchase or franchise mutation was performed by the capture script.
- No APK/IPA was built, installed or uploaded. Local free disk space is below the Android build script's 10 GiB requirement. Existing installed app binaries will not change until rebuilt and installed.

## Reproduce visual checks

Start Expo Web in `apps/mobile`:

```sh
node node_modules/expo/bin/cli start --web --port 8090
```

From the repository root:

```sh
node apps/mobile/scripts/capture-design-preview.cjs
ALL_SCREENS=1 FLOWS=1 STATES=1 node apps/mobile/scripts/capture-design-preview.cjs
PREVIEW_TEAM=SEA node apps/mobile/scripts/capture-design-preview.cjs
```

The script intercepts API calls locally; sample credentials and mutations do not reach the backend. See [the preview gallery](mobile-screen-previews/README.md).

## Homepage correction after visual review

The original coverage claim overstated Home parity: Home still used a compact editorial hero and a game-day-only card. Corrected September 28: native Home now uses the web stadium asset mapping, shared hero copy/description, responsive headline sizing, full introductory text, and the same `/api/content/next-game` endpoint and date formatter as web. Next Up remains present outside game day, with loading, unavailable and empty states. The demo has a local sample matchup. Team logos use bundled copies of the existing web SVG assets through Expo Image. The KC stadium image is bundled; other team stadium images use the shared web asset paths. The updated Home screenshot is a React Native Web preview, not a device screenshot. Mobile/root TypeScript, three demo tests, and iOS/Android bundle exports passed after this correction.

## Shared header correction

All authenticated native routes now use `MobileSiteHeader`, with the logo left and search, notifications and menu right. Its background uses the same team `dark` token as web `SiteHeaderShell` (`#E31837` for KC), replacing both the fixed navy headers and the Home-only primary-color override. Circular controls, 80-point content height, 112×56 logo, safe-area padding and a right-aligned drawer are shared across routes. Detail routes preserve an explicit Back row. Mobile TypeScript and phone-sized KC/SEA component previews were checked; an installed native binary was not updated.
