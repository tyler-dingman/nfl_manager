# Web ↔ mobile parity audit

Audited 2026-09-03. `COMPLETE` means the native app uses the canonical web API/state, not merely that a similarly named screen exists.

| Product area          | Web route/component             | Mobile route/screen             | Canonical backend                               | Status before this pass | Mobile action                                                                                     |
| --------------------- | ------------------------------- | ------------------------------- | ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| Home                  | `/`, `down-distance-home`       | `/(tabs)/index`                 | `/api/content/homepage`, `/api/user/home`       | OUTDATED                | Adopt current hierarchy, Ask D&D entry, and conditional Game Day hero.                            |
| The Beat / Hot Reads  | `/the-beat`, `team-content-hub` | Legacy `/wire` only             | `/api/content/huddle`                           | MISSING                 | Add canonical briefing list and D&D detail route; never bypass to publisher.                      |
| Catch Me Up           | `/catch-up`                     | `/catch-up`                     | `/api/catch-up`, `/complete`                    | COMPLETE                | Keep above secondary rewards/saved modules.                                                       |
| Ask D&D               | Home search, `/api/search`      | `/search`                       | Search APIs                                     | PARTIAL                 | Keep team context and prompts; consolidate on canonical search when response shapes converge.     |
| Film Room             | `/watch`                        | none                            | `/api/film-room`                                | MISSING                 | Add verified creator list, YouTube handoff, and Crew share.                                       |
| Front Office          | Multiple FO routes              | `/front-office`                 | `/api/mobile/front-office` plus simulation APIs | PARTIAL                 | Current overview is native; trade/draft/free-agency workflows remain deferred.                    |
| Trivia                | `/trivia`                       | `/trivia`, `/trivia-game`       | `/api/trivia/*`                                 | PARTIAL                 | Solo/groups and YARDS work; global/team leaderboard needs native surface.                         |
| Current Drive         | Trivia game components          | `/trivia-game`                  | `/api/trivia/games/*`                           | PARTIAL                 | Scoring is canonical; richer multiplayer field visualization remains.                             |
| Game Day              | `/game-day`, homepage hero      | `/game-day`                     | `/api/game-day/*`, `/homepage`                  | PARTIAL                 | Add conditional homepage state from the same schedule service.                                    |
| The Crew              | `/crew`                         | none                            | `/api/crew/*`                                   | MISSING                 | Add Feed/Leaderboard/Members, create/invite/share/settings.                                       |
| Notifications         | Header Notification Center      | push settings only              | `/api/user/notifications*`                      | MISSING                 | Add canonical inbox, unread badge, read-all, and deep links.                                      |
| Push                  | Notification delivery worker    | `lib/push`                      | device/token + canonical notification APIs      | PARTIAL                 | Registration and deep links exist; production Expo credentials/delivery worker remain setup work. |
| Saved                 | Account saved collection        | `/saved`                        | `/api/user/saved-content`                       | COMPLETE                | Preserve canonical links.                                                                         |
| Team Select           | Header/account                  | `/team-select`                  | `/api/user/team-follows/primary`                | COMPLETE                | Already canonical and shared across screens.                                                      |
| Profile/Auth          | `/login`, `/account`            | `/sign-in`, `/profile`          | `/api/auth/*`, `/api/user/profile`              | PARTIAL                 | Apple/Google/email login exists; native signup and invite continuation need completion.           |
| Merch                 | `/merch`                        | `/merch`                        | `/api/mobile/merch`                             | PARTIAL                 | Browsing exists; checkout remains external/deferred.                                              |
| Three and Out         | `/three-and-out`                | `/three`                        | `/api/three-and-out`                            | COMPLETE                | Keep current canonical story cards.                                                               |
| Rewards               | `/rewards`                      | `/rewards`                      | `/api/rewards`                                  | COMPLETE                | Uses the same YARDS ledger.                                                                       |
| Player search/profile | Search/player surfaces          | `/search`, `/player/[playerId]` | `/api/mobile/search`, `/players`                | COMPLETE                | Retain native cards and canonical player records.                                                 |

## Architecture findings

- Auth already shares web-issued access/refresh tokens and stores them in SecureStore.
- Selected team already persists through `/api/user/team-follows/primary`; there is no mobile-only team record.
- Push registration already creates canonical devices/tokens. Notification records remain the source of truth.
- Mobile had a legacy Wire destination where the current product expects The Beat.
- The largest gaps were canonical Notification Center, The Crew, Film Room, and Game Day homepage state.
- Front Office parity is a product-sized phase of its own. The existing native overview is useful but is not equivalent to the complete web simulation.

## Implementation policy

New native screens must call existing APIs through `authenticatedFetch` or the shared public request helper. No mobile-only Crew, story, notification, scoring, or team state should be introduced.
