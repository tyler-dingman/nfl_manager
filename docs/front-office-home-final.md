# Front Office Home — approved composition

Home was rebuilt from `home_screen_final.png`, replacing the old matchup/wire-centered layout. The global Down & Distance header was not changed.

## Composition

The desktop dashboard has a roughly 234px rendered franchise sidebar, central status/feature/gameplay area, and roughly 310px right rail at 1536px. The main column contains the compact franchise status bar, player feature, Trade Market and Player Development, then Roster & Needs, Development Spotlight, and League Movement. The rail order is Advance, Next Game, Injury Report, Division Standings, Recent Transactions, The Wire. The existing FanDuel image appears at the bottom of the sidebar with its original eligibility text and a gambling-help line.

The old Home components were removed from the render tree and replaced, rather than hidden. Home styling is isolated in `front-office-home.module.css`; section heroes elsewhere retain the play-diagram treatment. The approved normal and italic Barlow Condensed roles remain distinct from UI typography.

Tablet collapses the sidebar and moves the rail beneath the primary content. Mobile orders the modules as requested, with an advance control before Next Game. Tabs scroll within their cards.

## Data and actions

- Live simulation state supplies records, matchup, standings, and transactions. Published kickoff timestamps now survive schedule initialization. Fallback schedules do not present fabricated kickoff dates.
- Trade Market consumes the existing authenticated trade-hub API, including rumors, available targets, and activity. Player targets link to their existing detail route.
- Development uses current minus stored baseline ratings. Rows open the existing player details. Spotlight uses a labeled two-point comparison; it does not invent monthly rating history or performance explanations.
- Needs use the shared roster-needs calculation. Feature copy uses applicable franchise events or a factual rating/matchup summary. The hero selects an actual roster player and uses the available headshot.
- Weekly Brief opens an accessible, focus-managed dialog. The existing advance control remains wired to simulation actions. Home refreshes on both week-complete and simulation-advanced events.
- API failures are isolated: one failed source does not remove the whole dashboard. Retry reloads the sources and roster.

## Roster correction

The seed includes 72 Jets players and previously marked every one Active. Browser persistence also omitted `rosterLimit`, restoring its old zero default and displaying a dash.

`front-office-roster.ts` now assigns an explicit **simulation** active lineup using position-depth coverage followed by player ratings, up to the shared 53-player limit. Other players remain reserves; no player is deleted and no contract or cap value is changed. This is a simulation lineup assignment, not a claim that the source supplied official NFL active-roster designations. Existing explicit assignments remain authoritative. Short rosters and genuinely over-limit explicit rosters are counted honestly.

Seed creation, restoration, client hydration, status calculations, header counts, and the simulation's user-player pool share this mapping. The limit and count now persist across browser reloads. Duplicate original-team player entries are excluded from the simulation pool when the user's assigned roster replaces them. The verified Jets save reports 53 active players and 19 additional players outside the active lineup.

## Verification

Artifacts: `artifacts/front-office-home-final/`.

- Authenticated local API validation with a disposable QA user, not mocked production data. The QA user, sessions, saved metadata, credential files, and setup/cleanup scripts were removed afterward.
- Jets at 1536/1440/1024/768/390/320px; Chiefs and Bears at 1536/390px. No page overflow, clipped development-card content, or browser exceptions in the final run.
- All teams retain page `rgb(6,18,25)` and panel `rgb(9,26,32)`; CTA accents follow existing Jets/Chiefs/Bears tokens.
- Weekly Brief/Escape, both tab groups, trade-target navigation, player-detail navigation, roster persistence, and actual week advancement passed.
- TypeScript passes. Targeted lint has no new warnings. Including the unchanged Experience effect reports its existing missing `phase` dependency warning.
- 25 roster/simulation/phase/display tests pass. Eight of nine broader API checks pass; the existing trade-assets test expects two years/14 picks while the unchanged engine supplies four years/28 picks. That unrelated contract was not altered.

## Asset/data limits

The available player artwork is a headshot, not the approved full-body Breece Hall cutout. It is blended into the hero and changes with the actual featured player. The existing FanDuel asset is landscape; it is preserved rather than reconstructed as a portrait ad. Detailed injury/practice fields, stadium/odds, and monthly progression history are not present in the current simulation schema, so unsupported details are omitted and injury cards show available roster designations or an honest empty state. Existing schedule navigation is used because there is no simulation game-hub route.
