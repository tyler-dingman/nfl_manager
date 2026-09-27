# Profile Account dashboard

AccountDashboard replaces only the Account/Profile content. ProfileLayout retains
its desktop sidebar and shared mobile secondary navigation. Existing account
subsections and the global header/footer remain in their existing shells.

Desktop and responsive web use the same component. Native uses the same account
loader, mutation helper, preference definitions, APIs and editorial theme tokens.
It presents the same section order and uses existing native profile/team flows;
connected-account management and privacy open the existing web security page.

The hero uses getEditorialHeroTheme and the existing playbook-pattern SVG.
Overview data comes from trivia stats, the all-time global leaderboard, current
crew and selected team. Rank is unavailable when the user is outside the returned
leaderboard (top 100); no rank is invented. Optional API failures leave the
remaining cards usable.

Supported controls: display name, verified email-change request (web), avatar URL,
favorite team, email/push preferences, around-league content and video autoplay.
Only configured or already connected authentication providers appear. The final
sign-in method cannot be disconnected. Existing account deletion requires explicit
confirmation before calling its endpoint.

There is no existing file-upload endpoint for profile photos. Change Photo uses
the supported avatarUrl profile field, with an image URL editor and remove option.
About You, marketing consent and profile visibility are absent from the existing
schema and are not presented as functional controls.

Validation: web/native TypeScript, shared loader/mutation regression tests, scoped
lint, and Chromium/WebKit component fixtures at 320/390/1440px. Browser tests use
mock API responses and verify switches, edits, last-provider protection and delete
cancellation. Physical-device and live account mutation tests remain outstanding.
