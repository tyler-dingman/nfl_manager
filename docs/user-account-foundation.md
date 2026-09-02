# Down & Distance user account foundation

This document records the completed schema, API, UI, onboarding, and cross-platform account foundation for the D&D personalized account experience.

## Schema changes

The canonical user architecture remains centered on the existing `users` + `user_identities` + `sessions` model. The account personalization layer was layered on top without replacing it.

### Tables and constraints

- `user_profiles`
  - `user_id` primary key
  - `timezone` and `locale` defaults
  - `onboarding_completed` and `onboarding_step`
  - `created_at` / `updated_at`
- `user_preferences`
  - typed columns for playback speed, autoplay, motion, landing experience, email/push/SMS, prediction visibility, intensity, and `advanced_notifications` JSON
  - constraints for supported values and default settings
- `user_team_follows`
  - unique `(user_id, team_id)`
  - single-primary enforcement with a partial unique index on `is_primary`
  - supported notification levels
- `email_change_requests`
  - one-time token flow for secure email replacement

### Integrity rules

- only one team can be primary per user
- duplicate team follow rows are rejected by unique indexes
- provider identities are unique by `(provider, provider_subject)`
- user identities are cascade-deleted with the owning user
- linking requires an authenticated session and blocks cross-account provider conflicts

## API routes

### Profile and preferences

- `GET /api/user/profile`
- `PATCH /api/user/profile`
- `GET /api/user/preferences`
- `PATCH /api/user/preferences`

### Team follows

- `GET /api/user/team-follows`
- `POST /api/user/team-follows`
- `DELETE /api/user/team-follows/:teamId`
- `PUT /api/user/team-follows/primary`

### Onboarding and personalization

- `GET /api/user/onboarding`
- `PATCH /api/user/onboarding`
- `GET /api/user/home`

### Identity linking and email change

- `GET /api/auth/identities`
- `POST /api/auth/identities/link`
- `DELETE /api/auth/identities/:identityId`
- `POST /api/user/email-change/request`
- `POST /api/user/email-change/confirm`

## UI components

The account experience is built around reusable sections that can be rendered across web and mobile surfaces:

- `AccountScreen`
  - sidebar navigation for My Team, Notifications, Content, Account, Devices, Privacy & Security
- `OnboardingFlow`
  - three-step onboarding flow covering team selection, push permission, and optional SMS invite
- `ProfileSection`
  - display name and account email editing
- `PreferencesSection`
  - primary team and content preferences
- `NotificationsSection`
  - notification toggles and advanced notification customizations
- `SecuritySection`
  - identity list, unlink protections, device/session listing, and revoke flows

## Onboarding flow

The onboarding flow is resumable and does not lock the user out if they leave halfway through.

1. Who’s your team?
2. Get the important stuff
3. Optional SMS invitation

The flow stores progression in `user_profiles.onboarding_step` and `onboarding_completed` and always leaves the rest of the site accessible.

## Account linking rules

- Apple, Google, Facebook, and Email sign-ins are supported as separate provider identities.
- Users can add a second provider to an existing account.
- Email-based provider identity matching does not auto-merge accounts.
- If a provider identity already belongs to another account, the linking is rejected and the flow should route to a safe account-recovery/conflict path.
- A user cannot unlink their final available login method.

## Default preferences

Default settings are intentionally strong and platform-safe:

- `preferredTeamId`: `null`
- `audioPlaybackSpeed`: `1`
- `autoplayVideo`: `false`
- `reducedMotion`: `false`
- `showAroundLeague`: `true`
- `preferredLandingExperience`: `HOME`
- `pushEnabled`: `true`
- `smsEnabled`: `false`
- `emailEnabled`: `true`
- `showPollResultsBeforeVoting`: `false`
- `predictionVisibility`: `PRIVATE`
- `intensity`: `LOCKED_IN`
- `advancedNotifications`: `{}`

## Remaining mobile work

This foundation is complete for server-owned account settings and shared APIs, but the remaining native work is explicitly outside the current backend scope:

- iOS and Android native provider auth UI
- secure refresh-token storage in device keychains and Android secure storage
- mobile access-token refresh cycles and 401 handling
- device ID assignment and push-permission handling on native apps
- full notification delivery engine (not implemented yet)

## Completion status

The personalization foundation is in place and aligned with the prompt’s backend architecture:

- user profile management
- scalable preference model
- team/player follow systems
- resumable onboarding
- account identity linking and unlink protection
- email-change verification flow
- personalized home API
- server-owned profile state for web/mobile consistency

Notification delivery itself remains intentionally deferred, as specified.
