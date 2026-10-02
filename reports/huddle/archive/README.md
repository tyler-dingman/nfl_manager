# Previous Huddles

The archive detail reuses the active Huddle renderer on web and React Native, including the shared team theme, typography, stadium hero and 50/50 desktop split. Narrow layouts stack the hero and move results beneath the conversation.

Preview: http://localhost:3000/huddle/archive?team=KC&date=2026-09-27
Native browser: http://localhost:8090/huddle-archive?team=KC&date=2026-09-27
Index: http://localhost:3000/huddle/archive?team=KC

Includes Past Huddle/date/closed status, a link to today's conversation, chronological All Activity/Comments/Polls tabs, final poll bars, Final Huddle Pulse, Huddle Results and Top Poll. No quote card. Archived conversations have no composer, no voting controls and disabled reactions; moderation options remain available. The shared hook also refuses archived message/like/vote actions.

Fixtures are isolated in `packages/huddle/demo-archive.ts`, loaded only in development. Existing archive links resolve by team/date; unknown dates show unavailable state instead of inventing history. The list uses editorial summaries as titles. No backend, game-provider, database, live refresh or upload functionality was enabled.

Validation: root/mobile TypeScript checks; eight archive/daily/field tests passed. Desktop, mobile web and React Native Web previews inspected. Comments filter excludes updates/polls and the composer is absent. Previous Huddles list navigation verified. Physical iOS/Android builds were not performed.

Screenshots: [desktop](desktop.png), [mobile web](mobile-full.png), [native top](native-top.png), [native results](native-results.png).
