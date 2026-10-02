# Daily Huddle preview

Implemented September 30, 2026 for responsive web and the shared React Native iOS/Android screen.

## Preview URLs

- Web Daily Huddle: http://localhost:3000/huddle?team=KC
- Native app browser preview: http://localhost:8090/huddle?team=KC
- Eagles theme: http://localhost:3000/huddle?team=PHI
- Existing GameDay simulator: http://localhost:3000/huddle?team=PHI&mode=gameday (same query works on port 8090).
- Existing game deep links with a `game` parameter still select GameDay.

## Implementation

Daily data extends the existing Snapshot/Message/Poll model. Comments, D&D updates and poll references share one chronological message dataset. Chat filters out system entries; Polls and Huddle Pulse reuse the same poll objects and votes. Local preview voting, likes, mute/block and unhide run in the shared hook; they do not write to a server. Sending and media upload remain disabled, with an explicit concept notice. Existing composer avatar, emoji insertion and removable local image preview remain available.

Room identity is deterministic (`daily:TEAM:YYYY-MM-DD`). The daily model includes editorial summary, ACTIVE/ARCHIVED status, metrics, and contextual archive references. The supplied Chiefs example is isolated in `packages/huddle/demo-daily.ts`, loaded only in development. Other teams receive neutral team-specific fixtures, never Chiefs news. Production does not receive these sample metrics or messages. Initial fixture window has eight entries; existing backend cursor pagination (50 older / 100 updated messages) and moderation repository are preserved.

The shared site/app shells and GameDay field renderer are retained. Daily layout adds responsive community modules, hides Play-by-Play, and does not add news/article cards. Archive links resolve to explicitly unfinished placeholders as requested. Initial avatars use initials when no existing profile image is available; no generated portraits are used.

## Existing architecture / integration limits

Before this change, `/api/huddle` was intentionally disabled (503), `getHuddleGame` returned null, and the hook used a local ten-play simulator with no network or timers. The repository contains bounded conversation queries, reactions, reports, mute/block, duplicate/spam checks, rate limiting and moderation, but no active realtime broadcast subscription exists to reuse.

This change keeps that boundary: no new database tables, migrations, schedules, polling, live feeds or uploads. No actual daily rollover job is enabled. ACTIVE/ARCHIVED and room/date identity are prepared for the eventual server lifecycle; no production history is deleted. `huddleExperience` specifies precedence for an already-resolved selected-team game on its game date. Actual automatic GameDay detection needs the intentionally disabled schedule/game source connected again. A game snapshot always takes precedence over daily metadata in both renderers. Development mode uses the explicit GameDay preview query above.

## Validation

- Root and mobile TypeScript checks.
- Six Node tests: shared Daily Chat filtering and poll result; selected-team/date GameDay precedence; team-isolated fixtures; existing field mapping and all ten GameDay states.
- Browser: desktop Chiefs and Eagles, 390px mobile web top and community modules, React Native Web at 390px top and community modules.
- Chat excludes D&D updates and poll entries; preview vote increments the same poll count displayed in Pulse.
- Existing GameDay simulator still displays field, score, Play-by-Play, and manual controls.
- No physical iOS/Android build or device validation performed.

## Screenshots

- [Desktop Live](desktop-live.png)
- [Mobile top](mobile-top.png)
- [Mobile community](mobile-community.png)
- [Full mobile web](mobile-full.png)
- [Eagles desktop](eagles-desktop.png)
- [Native browser top](native-top.png)
- [Native browser community](native-community.png)
