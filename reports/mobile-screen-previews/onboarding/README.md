# Native onboarding previews

Implemented September 28, 2026. React Native screens; these PNGs are browser previews at 360×800 and 430×932, not iOS/Android device captures.

Flow: existing authentication → required favorite team → team value → delivery choices → scheduled delivery time → confirmation → existing Home. All headings and primary labels are white; smaller supporting text is tan.

## Canonical settings

- Favorite team: existing `/api/user/team-follows/primary`, reflected by TeamProvider immediately.
- Progress: existing `/api/user/onboarding`, server cursor 1–5 and completion flag.
- Delivery: existing `/api/three-and-out/preferences`, shared with Account notifications. Existing IN_APP master row holds time/timezone; EMAIL, SMS, PUSH rows hold channel choices.
- Push: existing explicit permission/device-registration function; no onboarding mount permission request. Existing daily scheduler and notification destination remain unchanged.
- Time: existing presets/default 07:00; canonical timezone retained, device timezone if missing. Native system time picker; browser preview uses HH:MM input.

## Existing users

Accounts created before the fixed rollout boundary 2026-09-28T00:00:00Z with a favorite and a Three & Out preference record bypass the new flow when the old cursor is still 1. Completion is persisted through the existing API. Existing incomplete cursors above 1 resume. Legacy accounts with a favorite but no delivery record start at delivery; completed/established accounts missing a favorite select only a team and confirm. No bulk database migration was executed.

## Validation

- Mobile TypeScript check passed.
- Nine focused policy/demo tests passed: completed users, missing team, legacy paths, resume cursors, canonical demo settings and isolation from server mutations.
- `capture-onboarding-preview.cjs` exercises test login, all-team view/search, Bears selection, value, push-unavailable error recovery, email preference, custom time, back navigation and completion to Home on two viewport sizes.
- Test credentials remain `test@gmail.com` / `test`. This local preview session simulates settings in memory; real accounts persist them server-side. Demo news remains clearly labelled sample content.
- Screenshots: `small-*` and `large-*`, covering team, value, delivery, time, confirmation and Home.

## Unverified / unavailable

Daily SMS delivery and phone verification are absent from the existing backend, so SMS is unavailable. Daily email sending is also absent: email preferences can be saved, explicitly labelled as pending delivery support. Account notification settings display the same limitation. No new delivery provider or analytics vendor was introduced.

Android build preflight requires 10 GB free and failed before compilation (about 5.7 GB available). iOS build/device validation is not completed; earlier compilation ran into disk-space constraints. The new native time-picker dependency requires rebuilding the native apps. Real Google/Apple authentication, native picker appearance, physical push permission/receipt, scheduled delivery, and process-kill/server resume still require device/integration validation. No production queries or delivery jobs were executed.

Home handoff: completing setup or choosing Maybe later saves completion, fades onboarding out over 200 ms, and fades Home in over 350 ms. Reduce Motion removes those animations. Skip delivery disables channels; skipping time keeps the saved/default time. Browser checks cover completion with motion and skipping with Reduce Motion.
