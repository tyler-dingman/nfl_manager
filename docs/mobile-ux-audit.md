# Mobile UX audit — September 18, 2026

This audit includes implemented fixes, browser verification, and explicit limits below. Browser emulation is not a substitute for installed-app and physical-device testing.

## Architecture and scope

- Web: Next.js App Router, React, Tailwind/global CSS plus component CSS modules.
- Native: separate Expo 54 / React Native application in `apps/mobile`; it is not a wrapper around the web routes.
- Web manifest: standalone display. Added explicit start URL/scope and viewport safe-area support. No offline capability or service worker was introduced.
- Existing shared site menu, Front Office shell, modal portals, mobile draft workspace tabs, team colors and draft state remain the foundation. Desktop layouts were preserved.
- Source inventory included all App Router pages, native screens, sticky/fixed layers, navigation, forms, tables, profiles, drawers, notifications and simulation timers. Admin, developer and lab tools were excluded from customer UX coverage.

## Implemented fixes

| Area                    | Changes                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations             | Safe-area viewport configuration; 16px mobile form inputs; larger touch targets; drawer and toast safe-area spacing.                                                                                                                                                            |
| Navigation              | Reused the shared mobile site menu in primary navigation and Merch; portal above sticky headers; removed the duplicate Front Office team-summary menu button; team names can wrap.                                                                                              |
| Overlays                | Menu, search, notifications, cart and draft result dialogs lock background scrolling and manage focus. Cart restores its opener even in Safari. Draft recap has a reachable close action.                                                                                       |
| Front Office            | More compact mobile heroes; Team Needs rejects failed/malformed API payloads and offers recovery instead of crashing.                                                                                                                                                           |
| NFL/prospect profiles   | Vertical phone heroes, reachable utility controls, stacked identity/projection/ratings, wrapping names and safe-area padding. Existing profile tabs/actions remain available.                                                                                                   |
| Draft workspace         | Compact sticky Skip/Speed/Pause controls, compact hero actions, readable player rows with school and measurements, wrapping filters and stacked trade offers. Existing mobile workspace switching is retained.                                                                  |
| Big Board / Draft Guide | Reflowed mobile rows instead of overflowing desktop column widths; names wrap and actions remain reachable.                                                                                                                                                                     |
| Parlay Lab              | Reflowed the AI query form and action; constrained narrow-screen grid children.                                                                                                                                                                                                 |
| Trivia                  | Removed narrow-phone stat/grid overflow. Answer choices use full card width instead of reserving the timer's width beside every answer.                                                                                                                                         |
| Merch / account         | Header consolidation, smaller/wrapping department and featured-drop headings, wrapping order tabs and responsive Rewards heading.                                                                                                                                               |
| Film Room               | Corrected a viewport-height width formula that could collapse the video dialog in short landscape viewports; close control stays at the top while the dialog scrolls.                                                                                                           |
| Native app              | Safe-area-context in shared screens/sign-in; inset-aware drawer and bottom tabs; keyboard-aware scrolling; scrollable profile; scrollable Crew share sheet; larger search-clear/close touch targets. Avoided stacking automatic keyboard insets on top of KeyboardAvoidingView. |

## Browser coverage

Widths: **320, 360, 375, 390, 393, 414, 430, 768px**. Draft sticky controls also checked at **844 × 390 landscape**.

The route sweeps visited 60 route/query combinations and recorded over 500 width observations, including repeat checks after fixes. These check rendered layout and uncaught browser errors, not every authenticated action. Some routes displayed empty/error states because the isolated test save had no persisted franchise data.

| Surface        | Routes/views included                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content        | Home, The Beat, Catch Up, Three & Out, Huddle, Watch, Wire, Promos                                                                                                                          |
| Front Office   | Public landing; internal home; roster, depth chart, practice squad, re-sign, manage-team redirect; league and transactions; news, standings, schedule; cap space, teams, settings, messages |
| Trades         | Trade Hub, new trade, manage/trades and draft Trade Machine                                                                                                                                 |
| Draft          | Draft Central, draft room, Big Board, Draft Guide, prospects, a real prospect detail route, Team Needs, My Drafts, season/offseason recap                                                   |
| Parlay Lab     | Home, games, trends, Lab Finds, My Plays                                                                                                                                                    |
| Commerce       | Merch home, men, women, kids, hats, accessories, sale, Orders, Rewards                                                                                                                      |
| Account/social | Login, account, profile, onboarding, Crew, Game Day                                                                                                                                         |

Orders/onboarding redirect signed-out visitors to login. The Orders sweep encountered navigation during measurement; its authenticated layout is not marked verified. The original order-tab overflow was fixed in source.

## Interaction verification

- Mobile mock draft: start a two-round draft; pause/resume; change speed; switch Draft Feed/Trade Hub/Player Board; open a prospect; add to board; draft while paused; select picks and submit a proposal; notification drawer All/New/Resolved; sticky controls at all eight widths plus landscape; invoke next-pick/end-round simulation; exit.
- Incoming mock trades: waited for real CPU offers in an isolated local draft, opened a counter in the builder, accepted one offer and declined another. Expired offers correctly disable negotiation actions.
- Prospect detail: desktop and phone layouts, loaded headshot, previous/next, tabs, persistent board toggle, Escape, no horizontal overflow.
- Trivia: all ten solo questions and final results at 320px; no uncaught browser errors. Existing answer submission disables controls during pending/reveal states.
- Commerce: opened a real product at 320px, added it to the cart and dismissed the cart; no order submitted.
- Film Room: fixture-backed video dialog remains wide in landscape and its close button stays reachable after scrolling, in both browser engines. External playback was not tested.
- Shared menu/cart/search: open/close, focus containment/restoration, scroll lock, Escape. Search also checked with viewport height reduced to 440px to approximate available keyboard space.
- Repeatable regression tests: `tests/mobile/mobile-responsive-regressions.spec.ts`. Four routes × eight widths plus menu/cart focus behavior and a fixture-backed landscape video dialog check, run in Chromium and WebKit mobile profiles.

Run the regression suite against a running local server:

```sh
npx playwright test tests/mobile/mobile-responsive-regressions.spec.ts
```

Root and native TypeScript checks pass. Scoped ESLint reports existing raw-image optimization warnings, with no lint errors.

## Performance review

The live draft has one clock controller with cleanup, an in-flight advance guard and an expiry guard. Its 100ms tick publishes integer seconds, so unchanged state values do not force a render every tick. Sticky controls reuse the same draft state rather than running a second simulation. Existing reduced-motion rules remain. No additional polling, animation framework or simulation loop was added.

Large prospect images are still original assets; Next Image list entries retain lazy loading. Image resizing/CDN policy and list virtualization are follow-up profiling opportunities, not unmeasured rewrites made during this audit.

## Remaining device/data verification

- No booted iOS simulator or Android device was available. Native changes are type-checked/source-reviewed, not runtime-certified.
- Test an installed PWA and Expo build on real iOS/Android hardware for notch/home indicator, rotation, actual keyboard behavior, browser chrome and screen-reader navigation.
- Authenticated order/profile/settings edits, multiplayer Trivia with another account, real Crew sending, checkout/payment completion, external OAuth, video-provider playback and TTS require their respective accounts/services. No purchase, real message, deployment or APK build was performed.
- Public/error/empty-state route coverage does not certify all populated private franchise or live-odds states.
- Native Front Office currently has a smaller feature set than the web simulator. This audit improves existing native screens; it does not duplicate the web draft engine as new native business logic.
