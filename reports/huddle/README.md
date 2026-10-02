> **Replacement PNG field:** Supplied base retained unchanged; user-approved corrected end-zone copies now align to its boundaries. See [current PNG field validation](png-field/README.md). Earlier SVG-field artwork notes are superseded.

> **Field simulator update:** The 10-play simulator is now development-only. Production shows no sample game or comments. See [field simulator notes](field-simulator/README.md) for controls, asset handling, and validation. This supersedes the earlier always-on local concept behavior described below.

> **Current status — concept only (September 29, 2026):** Live Huddle data is disabled at the user's request. Web and native screens use labeled local sample content, without network requests or polling timers. Interactions are in-memory only. GET/POST `/api/huddle` return 503 without authentication, database, or provider access. The Huddle game adapter returns null without fetching ESPN. The implementation notes below describe the earlier live prototype and do not indicate currently enabled behavior. No production deployment or new native build was performed for this change.

# The Huddle implementation and deployment notes

September 29, 2026. All three attached briefs are byte-identical. Approved desktop/mobile references informed the separate web and React Native renderers.

## Existing-system audit

- `/huddle` previously displayed the editorial TeamContentHub. Its existing story/card/content APIs remain intact; the editorial landing is also available at `/briefings`. The Beat stays `/the-beat`.
- `game_day_rooms` is private, membership-bound, simulation-backed, and includes predictions. It is deliberately not repurposed as a public live community. Existing private tailgates are untouched.
- Users, authentication, team themes, stadium/logo assets, push destination handling, and moderation admin-ID authorization are reused. Community tables are additive in migration 048.
- The existing ESPN schedule/search integration supplies the upstream family for a separate Huddle adapter. Summary drives/play data are normalized defensively. Missing field geometry, scores, or plays are not synthesized. No new paid API is introduced.
- No shared websocket/SSE/pub-sub or reliable presence infrastructure was found. The initial transport uses 15-second foreground refresh, one single-flight public room projection per warm process per 15 seconds, compact incremental responses, indexed user preferences, and bounded keyset history. Upstream game fetches use Next's 30-second data cache. Writes invalidate the local room cache. Cross-instance visibility is eventual (up to a refresh/cache interval), not instant.

## Included

Public Team Huddle and game/discussion context routes, shared protocol/merge/filter logic, web desktop rail and narrow-screen PBP tab, native Live/Chat/Polls/PBP, football field, latest play, basic chat, idempotent message client keys, likes, one-vote polls, explicit empty/error states, draft retention on request errors, background-refresh suspension, bounded history, and new-play/comment catch-up controls. Latest-play and notification play context can filter conversation without requiring users to attach a play manually.

Menus, Home, Beat story actions, and notification/native destinations lead to `/huddle?team=PHI&game=...&discussion=...&play=...`. `game` and `discussion` select separate contexts within the same conversation system; general team conversation persists under the team context. Native bottom navigation is unchanged. No video, predictions, public karma, or chat rewards are added.

Report, mute, bilateral block, moderator removal, a report queue, temporary community suspension, simple profanity/repeated-character/link filtering, persisted per-user message throttling, and an additional action throttle are included. The basic text filter is intentionally not represented as comprehensive abuse detection. Moderators can create polls in the web Polls view; the same authenticated API supports native clients. Suspensions apply to community participation; existing account status enforcement remains in the auth layer.

## Setup

- Local schema applied and tested with disposable local records. Production was not queried or migrated.
- Apply `db/migrations/048_huddle.sql` through the normal reviewed deployment migration process before deploying the feature. `node --import tsx scripts/migrate-huddle.ts` intentionally only permits a local database.
- Configure `HUDDLE_MODERATOR_USER_IDS` as a comma-separated list of existing user IDs (falls back to `ADMIN_USER_IDS`). This grants moderation controls, not public-user privileges.
- Native test login uses explicitly labeled local sample content in `demo-huddle.ts`; it issues no server identity and does not send production community writes.

## Scale and feed limitations

Participant counts remain absent until a trustworthy presence service is connected. No fabricated online total or presence heartbeat is written to PostgreSQL. Public fixtures used by screenshot tests are intercepted in the browser, never production API fallbacks.

For large simultaneous Huddles, replace periodic refresh with a shared fan-out service (for example a managed pub/sub broker or a Cloudflare Durable Object) behind the shared protocol, and publish a durable mutation/outbox stream. No paid service was installed. Current process-local caching and action throttling are not a claim of globally coordinated real-time delivery or a high-concurrency load test. Message rate enforcement uses a database advisory transaction lock and an indexed count, so that specific limit works across processes.

The ESPN adapter uses the source already present in the application; live data completeness/availability is not guaranteed. Missing or failed game data is surfaced; the client retains its last known game on a refresh error. A real live-game provider acceptance test remains required before advertising play-by-play coverage. No actual participant load test, live game test, or native device run was performed in this session.

## Validation

- Shared tests: merge/deduplication/removal, bounded history, play filters, explicit field orientation, incomplete provider payloads, context URLs.
- Local database integration: messages/play context, reactions, reports, bilateral blocks, moderator authorization, concurrent single voting, removal, suspension, and keyset pagination across 55 messages sharing one timestamp. Test-owned records are cleaned up.
- Playwright isolated fixtures: desktop 1440, mobile web 393, tablet 900; live, pregame, halftime, final, no game, PBP, polls, sending, and new-play/comment catch-up without forcing the reader to the bottom.
- React Native Web preview at 360 and 430: selected-team navigation, field/latest play, polls, message sending, PBP. This is not iOS/Android device validation.
- Preview PNGs are in `previews/`; scripts are `scripts/capture-huddle.cjs` and `apps/mobile/scripts/capture-huddle-native.cjs`.

Both web and mobile TypeScript checks pass. The shared model/navigation suite passes 9 tests. Native runtime injection keeps the web React 18 and Expo React 19 hook runtimes separate.
