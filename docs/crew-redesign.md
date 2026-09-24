# Crew page redesign

The Crew page follows the supplied mock-up: existing global header, warm off-white background, editable circular Crew photo, identity/actions, navy four-column stats panel, Feed/Members/Leaderboard/Settings tabs, and a roughly 70/30 feed/sidebar layout. Mobile uses a stacked header, 2×2 stats, single-column feed and onboarding, followed by the sidebar.

## Existing behavior preserved

The existing Crew API/repository continues to provide membership, invitations, team context, weekly yards, rank, activity, reactions, renaming, and leave handling. Settings now renders in the Settings tab rather than a separate duplicate modal. The complete Members tab includes joined dates, weekly/lifetime yards, pending invitations, and owner-only removal controls. The leaderboard still ranks Crew members by weekly yards.

Current Crew roles are OWNER and MEMBER; there is no persisted ADMIN role. Editing the Crew photo/name and managing members remain owner-only. Unsupported roles, including ADMIN, cannot edit Crew identity. Owners cannot leave without the existing ownership-transfer requirement. Leaving, member removal, and deleting a post require confirmation. No ownership-transfer or Crew-deletion shortcut was introduced.

## New persistence

Migration `041_crew_feed_and_photos.sql` adds the Crew photo URL, private Crew image storage, and comments, and expands activity messages to text. The existing image-related profile feature only accepts avatar URLs; no file upload service or crop editor existed. This implementation therefore uses the current PostgreSQL persistence and authenticated route conventions:

- `POST /api/crew/media`: JPEG/PNG/WebP upload; MIME/signature and 2 MB size checks.
- `GET /api/crew/media/[mediaId]`: image access restricted to active members of that Crew; private, no-store responses.
- `PATCH /api/crew`: owner-only photo assignment, referencing a validated upload owned by that user and Crew; existing name/team updates preserved.
- `POST /api/crew/posts`: Text, Photo, and Link posts stored as existing Crew activity records.
- `POST /api/crew/activity/[activityId]/comments`: comments restricted to active Crew members.
- `DELETE /api/crew/activity/[activityId]`: author/owner deletion of composer posts.
- `DELETE /api/crew/members/[userId]`: owner-only removal of non-owner members.

Photos are resized on the client. Crew photo editing has zoom and horizontal/vertical crop controls; replacing or saving immediately updates the displayed photo and persists across reloads. Existing photos can be cropped again. Empty Crew photos use a camera/upload affordance, never a generated logo. The composer has only Text, Photo, and Link; invalid/empty content cannot be posted. HTTP(S) validation prevents executable link schemes. Existing shared-story/video activity continues to render.

Names, counts, roles, dates, ranks, and yards come from Crew data. No fake online-presence claims are made; the current user is labeled “You,” and other members show their roles. No new font or global header design was introduced.

## Validation

- TypeScript passes.
- Changed Crew files pass targeted ESLint without warnings; project-wide lint completes with existing warnings in unrelated files.
- All 15 Crew unit tests pass, including post validation, image validation, invite/share policy, and owner/member/unsupported-role permissions.
- `node --import tsx scripts/audit-crew.ts` runs against a local app/database only. It applies migration 041 idempotently, creates temporary users, exercises real authenticated requests, and deletes only those temporary users afterward.
- The audit covers photo empty state, persisted upload/crop/replacement, text/photo/link posts, invalid link/empty post rejection, comments/reactions, invite-link creation, tabs/settings/quick actions, owner leave protection, member cancellation/leaving, owner moderation, and loss of media access after leaving.
- Browser layout checks at 320, 393, 768, 1024, and 1440px show no horizontal overflow. Desktop and mobile screenshots are written to `/tmp/crew-redesign-audit` and visually reviewed.
- Invitations are tested using SHARE_LINK only; no email/SMS is sent. Existing providers still handle those channels.

The migration was applied to the configured local development database. Apply migration 041 through the existing `npm run auth:migrate` workflow when deploying to another environment.
