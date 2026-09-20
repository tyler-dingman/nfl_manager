# Live mock draft trades

The live room uses one Draft Feed on the left, a large Trade Hub in the center, and compact Available Players on the right. Row clicks still open prospect profiles; the selection action remains **Draft**. The latest Sim dropdown controls remain in the compact hero.

## State and execution

`DraftSessionDTO.tradeState` owns the mock draft's future-pick inventory, team needs, offers, opportunity checkpoints, and completed trade history. Current-year ownership remains in `session.picks`; original ownership is preserved. The ledger is included in the existing session snapshot/restore flow. Mock future capital is copied from the save's projected inventory and isolated from the franchise's real assets.

`src/lib/mock-draft-trades.ts` is the shared pick-package engine. `src/server/logic/mock-draft-trades.ts` initializes it from existing save/team data. Draft progression evaluates opportunities once per pick. The Trade Hub endpoint handles stored-offer acceptance, declines, proposals and counters. Older pick-only proposal endpoints delegate to the same engine.

Acceptance validates the entire package before a synchronous mutation: both sides must contain 1–3 distinct, available, owned assets. Current picks, future picks and history change together; related offers expire. Replaying an accepted offer fails. Trading does not change `currentPickIndex` or `isPaused`. Current-pick ownership changes reset the existing clock through its owner-aware key. Client trade revisions prevent older progression responses from reverting ownership.

The app's existing save/session persistence model is unchanged: this is not a new database-backed draft engine. Existing client snapshots remain necessary when restoring an in-memory server session.

## Values and CPU behavior

The existing `trade-chart.ts` chart is the only base pick chart, including the legacy `getPickValue` adapter. Future values use that chart's existing year and round discounts, relative to the session's actual draft year. Future positions are projected mid-round values, not known future draft slots. The Your Picks tab only shows modeled inventory.

Value labels describe **received / sent** value from the user perspective:

| Ratio  | Label       |
| ------ | ----------- |
| ≥ 1.10 | Great Value |
| ≥ 1.02 | Good Value  |
| ≥ 0.94 | Fair Value  |
| < 0.94 | Poor Value  |

Tuning constants live in `MOCK_TRADE_CONFIG`. CPU motivations consider available prospect ranks, need matches, premium positions, tier depth, distance and capital. Seeded team traits remain stable across renders/restores. Package search adds up to two balancing assets, preferring compact packages. Proposals receive deterministic accept/counter/decline decisions. Counter chains stop after three exchanges.

Opportunities use per-pick seeded probability and proximity modifiers, with pick/team cooldowns and duplicate-package suppression. There is no round quota or timer that advances the draft. Existing offers expire when an asset is picked/transferred or their targeted prospect disappears. The notification is non-blocking; opening the chart does not alter pause state.

## Verification

Run:

```sh
node --import tsx --test src/lib/mock-draft-trades.test.ts src/lib/trade-chart.test.ts src/lib/draft-clock.test.ts src/server/api/draft-live.test.ts
npx tsc --noEmit --incremental false
```

The seeded calibration checks 40 seeded seven-round drafts across teams (280 rounds; measured average 3.66), counts issued opportunities including expired/declined offers, checks a 3–4 average, and verifies round-to-round variation. This measures opportunities, not guaranteed accepted trades; available capital and user decisions change individual drafts.

### Directional offer mix

CPU offer direction is weighted by pick ownership ahead of/behind the user's next selection in that round. The minority direction retains a 25% share when both sides exist: early picks lean roughly 3:1 toward CPU teams moving up, late picks lean 1:3, and middle picks are close to even. Issued offers for that target pick (including declined/expired offers) balance subsequent direction choices. Within the chosen direction, the highest-scoring realistic package wins. If none is feasible, the other direction is allowed; no expired picks or forced trades are introduced. Future-only capital favors CPU teams moving back.

## Trade workspace

Incoming offers show each team's receipts, user-relative values, and expiration tied to actual pick availability. Expired offers remain visible with disabled actions. The two-sided builder groups inventory by year and preserves selections across tabs and player profiles. CPU interest uses a read-only preview of the same proposal thresholds used by the engine; it is not a probability. Counters preserve their original proposal for comparison. Completed trades retain a valuation snapshot and appear chronologically in Trade History.

The feed owns the single pick clock; no large center clock banner is rendered. On narrow screens, users switch between Draft Feed, Trade Hub, and Available Players. Draft buttons remain enabled on the user's turn while paused.

## Offer notifications

Propose a Trade is the default workspace. Incoming offers live in the separate Trade Offers tab and never switch tabs or pause the draft on arrival. `features/draft/trade-notifications.ts` publishes the current session reference to notification consumers and stores only read offer IDs per mock draft in local storage. Active counts and unread counts are separate; invalid/resolved offers stop contributing immediately.

The existing header bell adds draft unread counts to the existing inbox count. During an active mock, it opens the Front Office news drawer in Draft Trade Hub mode. The same Front Office toast component presents one latest offer alert; every unread offer remains in the drawer and tab even if its toast is superseded. View Offer marks that offer read, reveals the center panel, scrolls with reduced-motion support, and focuses the matching card. Explicitly selecting Trade Offers marks its current active offers read. Leaving or completing the mock restores the existing bell and news behavior. Drawer entries resolve their data from the session, never from copied notification packages.
