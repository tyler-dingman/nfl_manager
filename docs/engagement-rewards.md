# Engagement Rewards

`/rewards` retains ProfileLayout, including the desktop profile menu and shared
mobile account navigation. RewardsDashboard renders both responsive web layouts;
the native screen uses the same API, tier presentation and earning configuration.
The shared page shell supplies the footer after the content.

The hero uses getEditorialHeroTheme, shared with The Beat and Film Room. The web
background reuses the existing Front Office playbook SVG. No new artwork or reward
products were added.

Data semantics:

- Progress and tiers use lifetime Move the Chains yards. Presentation tiers live
  in packages/rewards/presentation.ts. Inclusive ranges are 0–100, 101–250,
  251–500, 501–1,000, and 1,001+. The next tier starts at 101, not 100; the
  progress denominator and remaining amount reflect that boundary.
- Touchdowns retain their existing meaning: completed 100-yard drives. Actual
  correct trivia answers appear as supporting desktop text. They are not
  incorrectly substituted for touchdowns.
- Day streak counts consecutive UTC dates with positive yard awards, allowing
  yesterday as the latest active date until today ends.
- Crew and global ranks compare lifetime yards, with tied values sharing rank.
  Global ranks include reward accounts. Users without an active crew see a dash.
- Stats are explicitly All time. No season filter is offered without season data.
- Ways to earn use REWARD_ACTION_YARDS. Reading individual articles, video views,
  AI searches and conversations do not currently award yards, so they are not
  advertised as earning actions.
- Rewards come from active database reward definitions. Mockup discounts and
  merchandise do not override production thresholds or fulfillment behavior.
  Available rewards retain claim/code generation and existing claimed codes.

Verification: tier-boundary and UTC streak tests, web/native TypeScript checks,
scoped web lint, and Chromium/WebKit responsive component fixtures. Fixtures
exercise 320/390/1440px widths, overflow, tier selection, claim callback and reward
expansion. Live database queries and physical-device rendering require a signed-in
integration environment.
