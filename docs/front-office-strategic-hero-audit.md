# Front Office strategic hero route audit

The shared implementation is `FrontOfficeStrategicHero`. `DraftExperienceHero` and the legacy
`FrontOfficePageHeader` now delegate to it, so all standard screens use the same navy background,
playbook artwork, typography, dimensions, and responsive behavior.

| Route                                       | Previous treatment       | Current treatment                        | Status       |
| ------------------------------------------- | ------------------------ | ---------------------------------------- | ------------ |
| `/roster?view=roster`                       | Legacy metrics header    | Roster strategic hero                    | Migrated     |
| `/roster?view=depth`                        | Legacy Roster header     | Depth Chart strategic hero               | Migrated     |
| `/roster?view=cap`                          | Legacy Roster header     | Roster Breakdown strategic hero          | Migrated     |
| `/roster?view=resign`                       | Legacy Roster header     | Contracts strategic hero                 | Migrated     |
| `/free-agents`                              | Legacy metrics header    | Free Agency strategic hero               | Migrated     |
| `/manage/trades`                            | Legacy metrics header    | Trade Hub strategic hero                 | Migrated     |
| `/cap-space`                                | Plain content title      | Cap Space strategic hero                 | Migrated     |
| `/league`                                   | Legacy metrics header    | League strategic hero                    | Migrated     |
| `/front-office/league/news`                 | Bespoke title row        | League News strategic hero               | Migrated     |
| `/front-office/league/standings`            | Bespoke title row        | Standings strategic hero                 | Migrated     |
| `/front-office/league/schedule`             | Bespoke title row        | Schedule strategic hero                  | Migrated     |
| `/front-office/settings`                    | Bespoke title row        | Settings strategic hero                  | Migrated     |
| `/front-office/messages`                    | Plain content title      | Messages strategic hero                  | Migrated     |
| `/front-office/draft`                       | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/draft/room?mode=mock`        | Draft hero with controls | Shared strategic hero with action slot   | Consolidated |
| `/front-office/draft/big-board`             | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/draft/scouting`              | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/draft/prospects`             | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/draft/team-needs`            | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/draft/history`               | Draft hero               | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/trade-hub`                   | Draft Trade Machine hero | Shared strategic hero + Draft navigation | Consolidated |
| `/front-office/trade-hub/[tool]`            | Plain subpage title      | Trade Hub strategic hero                 | Migrated     |
| `/front-office/trade-hub/player/[playerId]` | Plain detail title       | Trade Hub strategic hero                 | Migrated     |

## Intentional exceptions

- `/front-office` remains the editorial Front Office content hub.
- `/experience` remains the immersive Front Office dashboard/home experience.
- The live Draft Room retains its specialized workspace content beneath the shared hero.
- League News story and prospect detail content retain article/detail layouts beneath their parent
  strategic hero treatment rather than introducing a second page-level title.
