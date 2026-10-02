# Dynamic hero visual review

Presentation-only update: environment images span the hero, dark directional overlay, softened team-primary angled tint, constrained editorial copy, and separate contained foreground people. Story engine, source images, selection, data, and CTA behavior are unchanged.

Screenshots were captured in Chrome from the development-only `/dev-hero-visual` fixture using the real WeeklyHeroStory component. Desktop uses the existing 300px layout row. Mobile was checked at 390 × 844, with a consistent 330px hero and Chiefs/Eagles themes.

Captured: stadium, coach, player, trade-player, prospect, locker-room, training-room, trade-deadline, draft, combine, mobile-stadium, mobile-person-phi.

The isolated person fixtures deliberately use the existing Arch Manning prospect cutout as a stand-in for all person categories. They validate foreground layout, not actual coach/current-player identity or live franchise data. The supplied request referenced a collage but only its text attachment was available. Validation follows its detailed written requirements.

Web and native TypeScript passed. Native implementation was updated, but no iOS/Android device visual run was performed. Authenticated franchise rendering was not exercised in this preview.
