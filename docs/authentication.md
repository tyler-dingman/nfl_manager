# Down & Distance authentication

Down & Distance owns its users, identities, credentials, sessions, devices, preferences, and engagement records. Apple, Google, and Facebook are external identity providers only. Supabase Auth, Firebase Auth, Auth0, Clerk, Cognito, and similar hosted identity systems are not used.

## Local setup

1. Provision PostgreSQL. A Supabase PostgreSQL database is compatible, but use only its database connection—not Supabase Auth.
2. Copy the authentication values from `.env.example` into `.env.local`.
3. Generate `AUTH_JWT_SECRET` with `openssl rand -base64 48`.
4. Run `npm run auth:migrate` (applies identity plus profile/preferences migrations).
5. Restart `npm run dev -- --port 3000`.

Email delivery is intentionally an integration boundary. In development, signup and forgot-password responses include their one-time token. Production must send those values through a transactional email provider and never return them to the client.

## Provider consoles

### Apple

- Create a Services ID matching `APPLE_CLIENT_ID`.
- Enable Sign in with Apple and associate the website domain.
- Register `https://YOUR_DOMAIN/api/auth/social/apple/callback` as a return URL.
- Create a Sign in with Apple private key; set team ID, key ID, and PEM private key.
- Configure the native iOS app to send its Apple authorization result to the same backend exchange flow.

### Google

- Create an OAuth 2.0 Web client.
- Register `https://YOUR_DOMAIN/api/auth/social/google/callback`.
- Native iOS/Android clients should acquire a Google ID token for the configured audience and exchange it with the D&D backend. The adapter already validates issuer, audience, expiry, nonce, and signature.

### Facebook

- Create a Facebook app and enable Facebook Login.
- Register `https://YOUR_DOMAIN/api/auth/social/facebook/callback`.
- Add production domains and complete Meta's required review for email/public profile scopes.

## Sessions

Web sessions use a 30-day rotating opaque token in a Secure, HttpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored. Native clients receive a 15-minute signed access token plus the rotating opaque refresh token and should store the refresh token in iOS Keychain or Android secure credential storage.

## API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET|PATCH /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/change-password`
- `GET /api/auth/social/:provider/start`
- `GET|POST /api/auth/social/:provider/callback`
- `POST /api/auth/social/:provider/exchange` (native iOS/Android)
- `GET /api/auth/identities`
- `POST /api/auth/identities/link`
- `DELETE /api/auth/identities/:identityId`
- `GET|DELETE /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`

## Profile and personalization API

- `GET|PATCH /api/user/profile`
- `GET|PATCH /api/user/preferences`
- `GET|POST /api/user/team-follows`
- `PUT /api/user/team-follows/primary`
- `DELETE /api/user/team-follows/:teamId`
- `GET|PATCH /api/user/onboarding`
- `GET /api/user/home`
- `POST /api/user/email-change/request`
- `POST /api/user/email-change/confirm`

New accounts enter a resumable three-step onboarding flow: primary team, push permission, and optional SMS invitation. Leaving onboarding never blocks the rest of the site.

Default preferences are 1× audio, no video autoplay, normal motion, around-the-league stories enabled, Home landing, push and email enabled, SMS disabled, private predictions, hidden poll results until voting, and `LOCKED_IN` intensity.

Provider identities are never merged solely because emails match. A provider matching another account's email is routed to a safe conflict message. Linking must begin from an authenticated account. The final usable identity cannot be removed.

## Mobile integration remaining

- Build native Apple/Google/Facebook authorization UI.
- POST provider results to backend exchange endpoints tailored to the native redirect contract.
- Store refresh tokens in Keychain/Android secure storage.
- Attach access tokens as Bearer credentials and refresh on 401.
- Give each install a durable UUID device ID and expose session/device naming in settings.
