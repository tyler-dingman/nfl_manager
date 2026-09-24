# Player Details cinematic hero

Updated the existing reusable Player Details modal. Restored angular team accents, the decorative position abbreviation, a translucent player-team logo, a bottom-aligned photograph, split name hierarchy, and standalone OVR card. Desktop hero is 450 CSS pixels; tablet is 400; mobile stacks the portrait and information. Generic route-diagram overrides are removed. Tabs and content retain the neutral dark Front Office styling.

Accents use `getFrontOfficeTeamTheme(model.teamAbbr)`, independently of the controlled franchise. Base color stays #06121e. OVR uses the real Barlow Condensed 800 normal variant. Contract-value assessment keeps existing business logic; its badge opens the Contract tab. Existing actions, player navigation, focus trapping, close controls, and tabs remain shared.

Validation: TypeScript passes; all five player-details model tests pass. Focused lint reports three existing next/image optimization warnings. Browser fixture screenshots cover Jets at 1440, 768, 390, and 320px, with no modal horizontal overflow and dark content retained. The fixture is presentation QA, not saved NFL data. Other-team browser fixture setup did not resolve a player; cross-team visual validation remains incomplete.

Reference limitation: the attachment included only the written brief, not the two comparison screenshots. The existing model exposes `headshotUrl`; no separate approved full-body Breece cutout was supplied or found in the available project assets. Existing transparent player photography and unavailable-photo fallback remain in use. Exact approved-image matching therefore remains pending those assets.
