# Front Office weekly cover stories

The existing web hero markup, typography, grid placement, dimensions and mobile composition are reused. A native renderer consumes the same persisted story. No new image assets were generated.

## Selection and persistence

`packages/front-office/hero-story.ts` selects only eligible candidates, ranks them, penalizes recent repetition and uses the simulation seed to choose among the strongest. Stories and resolved copy live in `simulation_state.heroStories[season:week]`, committed with the versioned simulation. Existing saves receive their current story on first read. Missing subjects can be replaced; ordinary refreshes preserve the selection. A season marker prevents development from reappearing after its subject disappears.

Week 1 is the approved opener with explicitly labeled simulated dialogue. Weeks 6–9 follow the configured deadline, and Weeks 15–18 use projected playoff position or conservatively proven elimination. The middle weeks use recorded box scores, actual roster/contracts, plausible trade targets, pending offers, available free agents, saved ownership snapshots and existing simulated draft rankings. Missing data disqualifies the corresponding story. No fabricated college game stats or unproven clinching scenarios are used.

## Existing data limitations

- The repository provides coach names but no existing coach headshot assets. The opener therefore uses the existing team stadium; the selector supports a coach image when a real asset is supplied.
- Ownership is currently device-local. Its actual snapshot is submitted on progression after ownership state has been saved on that device. Ownership stories are skipped if no snapshot exists.
- Development is selected once when a qualifying young player's recorded performance is available, preferably Weeks 4–6; it is not fabricated when none qualifies.
- Elimination is conservative; borderline scenarios use projected standings rather than claiming exact win-and-in or tiebreaker outcomes.

## QA

For repeatable new walkthroughs, set `FRONT_OFFICE_QA_SEED=hero-qa` in `.env.local`, restart the server, then use Reset to Week 1. The setting applies only outside production. Keep team, roster/actions, source data and ownership state equal when comparing runs. Existing selections are intentionally not rerolled when changing the seed.

Tests:

- `node --import tsx --test packages/front-office/hero-story.test.ts`
- `node --env-file=.env.local --import tsx scripts/test-franchise-hero-lifecycle.ts`

The lifecycle script rejects non-local/production databases, creates one disposable test user/save, advances all 18 weeks, reloads and compares each persisted story, and removes only its test user/save.

Validated: eight selector tests; related simulation/news regression tests; web/native TypeScript; local PostgreSQL 18-week lifecycle and reload persistence. The browser session was signed out, so authenticated visual QA and physical iOS/Android checks remain unverified.

## Supplied environment graphics

The shared `packages/front-office/hero-assets.ts` registry references the six original PNGs in `public/assets/front-office-hero-assets` without copying or modifying them. Web and native use asset-specific focal positions, cover sizing, and a dark edge blend within the existing image area.

Facility candidates require a saved report-card score below B and an available upgrade. The weakest eligible facility is considered during Weeks 10–14, weighted toward Weeks 10–13; persisted history limits the category to once per season. League rankings are not available and are not claimed. Training-room copy counts actual injured-reserve players without attributing injuries to facilities. Facility links target the relevant project on web; native opens Facilities with that project first.

The trade environment is the fallback during the configured deadline arc. Actual incoming offers and need-fit player targets take precedence. Generic draft copy uses a record-based projection, not the draft intelligence module's default slot when the draft order is still empty. It does not claim ownership of a traded selection. Generic draft art is strongly penalized on consecutive weeks; prospect portraits remain eligible. Eliminated teams prioritize need-fit prospects, then significant projected-position movement, then future roster stories.

Validation for this expansion: 12 selector tests, including three 18-week seeded fixture sequences; three disposable local PostgreSQL seasons (A/B/C), each verifying persisted stories on every weekly reload; web and native TypeScript checks. Seeds B and C selected the same real weak locker-room facility in different weeks (12 and 10). The trade arc remained intact, and seed C/B late elimination selected prospect portraits. Targeted fixtures cover each supplied facility image and draft/trade environments. Existing coach-image fixtures remain synthetic because real coach headshots are unavailable. Authenticated browser screenshots and physical iOS/Android rendering remain unverified.

## Complete offseason lifecycle

The same candidate engine and web/native renderers now cover Season Review → Re-sign Players → Scouting Combine → Tampering → Open Free Agency → Draft → next season's Week 1. The existing direct Super Bowl-to-Combine transition now stops at Season Review and Re-sign Players. Already-advanced Combine/Free Agency saves remain in their current phase. The former separate `OffseasonHomeHero` renderer was removed; the existing hero CSS/dimensions remain unchanged. The supplied `combine.png` is registered directly, with no asset copies or modifications.

Regular-season stories retain their weekly keys. Offseason stories use `season:phase`, a relevant-state signature, and persisted history. Ordinary reloads reuse resolved copy; roster/market/draft changes re-evaluate it. Re-sign and signing endpoints refresh the cover after successful actions. Viewing the celebration CTA acknowledges it (after closing a player-details modal when applicable). A new action or phase also supersedes the celebration. Draft on-clock priority overrides all other draft candidates. Real draft updates, including incomplete sessions, now persist alongside the franchise snapshot; selected prospects are excluded from future-target stories.

Copy uses actual standings/playoff outcomes, cap space, unresolved expiring contracts, supplied facility grades, available free agents, recorded contract terms, current draft ownership/selections, and stored selection grades. Season-star stories require exceptional aggregate season statistics. Combine measurement/performance stories and player-tenure/willingness or competing-free-agent-offer-rank stories are withheld because that supporting simulation state is not currently recorded. Generic Combine copy does not attribute normal ranking movement to a measured workout. Draft trade-offer stories require an active incoming offer in the actual draft session; no offers are generated by the hero engine. Coach portraits remain subject to the existing missing-asset limitation.

Validation: 51 selector/lifecycle/news tests passed; web and native TypeScript checks passed. The local-only lifecycle script was extended with `HERO_QA_OFFSEASON=1`. Final-code seeds B and C completed all 18 weeks, postseason, every offseason phase, a real seven-round draft, and the next-season opener. Each story was checked against a database reload; re-sign celebration stability/acknowledgement, a successful free-agent welcome, draft on-clock priority, draft welcome, and archived season history were asserted. The disposable signing fixture grants cap room specifically to exercise an accepted signing. Results are in `offseason-lifecycle.json`; only disposable test users/saves were deleted.

The localhost browser session is signed out, so authenticated desktop/mobile-web screenshots and physical iOS/Android rendering remain unverified. No production deployment was performed.
