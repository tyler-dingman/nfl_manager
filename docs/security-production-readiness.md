# Production readiness

## Authentication architecture

Web authentication uses an HTTP-only `dd_session` refresh cookie and short-lived signed access tokens. Refresh tokens are stored as hashes, rotated transactionally, and grouped into token families. A reused refresh token revokes its family. OAuth web callbacks use signed, expiring state containing provider, nonce, link target, and a validated relative return path. Apple production form-post callbacks use a `Secure` `SameSite=None` state cookie.

Native authorization-code exchange requires a PKCE `codeVerifier`; Google and Apple forward it to the provider token endpoint. Providers validate issuer, audience, signatures, expiry, nonce, and provider subject before account resolution. Facebook tokens are checked against the configured app before profile lookup.

## User data model

User-owned profiles, preferences, team/player follows, devices, push tokens, notifications, consent, saved content, cross-device content state, team visits, poll votes, and predictions all carry a user foreign key. Unique constraints make duplicate follows, saves, votes, and device tokens idempotent. `005_security_audit.sql` adds privacy-safe account/security events with user deletion retaining only the audit event and nulling its user reference.

## Session management and account linking

Sign-in methods are never merged by email alone. A provider identity is linked only from an authenticated session and cannot be unlinked when it is the final sign-in method. Logout revokes the current refresh token; logout-all revokes all sessions. Account deletion removes the user and cascades user-owned data, disables sessions/devices through deletion, and clears the web cookie.

## Provider setup

Set `DATABASE_URL`, `AUTH_JWT_SECRET` (at least 32 characters), and `AUTH_BASE_URL` in the deployment secret manager. Provider credentials are server-only. Configure complete Apple, Google, or Facebook credential sets or leave a provider entirely unset. Push and SMS credentials are represented in `.env.example` for the future delivery adapters; no provider secret is bundled into frontend code.

## Devices and notifications

Device and push-token routes must use the authenticated user and device ownership checks before production push delivery is enabled. Notification events remain decoupled from publication, so provider outages should be retried by a queue worker without blocking content publication. Consent records include channel, policy version, source, and revocation time.

## Cross-device state and privacy

`/api/user/content-state` is batch-readable and stores media version, progress, duration, viewed, and completed state. `/api/user/team-visit` returns material story changes and records the last snapshot. `/api/user/saved-content`, `/api/user/predictions`, and `/api/user/home` use the session user, never a caller-supplied user ID. Account export includes profile, preferences, follows, saved items, predictions, notifications, and consent history.

## Admin and operational security

Source administration requires both `SOURCE_ADMIN_ENABLED=true` and an authenticated user ID in `ADMIN_USER_IDS`. Never expose admin routes without that allowlist. Production startup validates the database/JWT configuration and rejects partial provider configuration. Audit events avoid passwords, access tokens, refresh tokens, reset tokens, full push tokens, and raw IP addresses; IPs are hashed when supplied.

## Rate limits and logging

Email login, signup, password reset, and native social exchange have process-local limits today. Replace the process-local limiter with a shared Redis or edge limiter before horizontal scaling. Add structured security-event shipping around login, reset, identity, session, device, consent, and delivery events without including secrets or token values.

## Local development and testing

Run `npm run auth:migrate` against a disposable database, `npm run build`, and the targeted Node test command used in CI. Provider callbacks require real provider credentials and registered redirect URIs; do not test them with production accounts. The security tests cover PKCE policy, admin allowlisting, redirect validation, token hashing, Catch Me Up, and user-state validation.

## Known limitations and next phase

The current rate limiter is not multi-instance safe, native access-token refresh is still a client contract rather than a dedicated token introspection endpoint, and admin maintenance APIs beyond source administration are not yet exposed. APNs/FCM/SMS delivery adapters, OTP verification, asynchronous export jobs, and queue-backed metrics require deployment infrastructure and provider credentials. Those are the recommended next phase before public scale.