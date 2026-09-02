# Down & Distance Mobile

Expo SDK 54 client for the existing D&D backend. D&D remains the account authority: Apple and Google return signed provider identity tokens, the backend verifies them, resolves `user_identities`, and issues D&D access/refresh credentials.

## What is wired

- Native Sign in with Apple on iOS.
- Native Google Sign-In through a development build (not Expo Go).
- Provider-subject matching and the web app's existing no-email-auto-merge rule.
- 15-minute D&D access tokens and rotating 30-day refresh sessions with server-side revocation/replay handling.
- SecureStore persistence, launch restore, single-flight refresh on 401, current user, protected routes, and logout/revocation.
- Canonical account team selection shared with web, team Home, Get Caught Up, Three and Out, Story, The Wire, and server-backed 10-question Solo Trivia.
- Move the Chains/The Locker, server-side story saves, and persisted notification-level preferences.
- Native Merch catalog with existing D&D storefront handoff, team-scoped Story/Player Search, and Front Office roster, cap, contract, and transaction views.
- Facebook remains an adapter/backend option; native Facebook UI is deferred so it does not block Apple/Google.

## Environment variable names

Root `.env.local` (server):

```env
DATABASE_URL=
AUTH_JWT_SECRET=
AUTH_BASE_URL=
APPLE_CLIENT_ID=
APPLE_IOS_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_IOS_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

`APPLE_IOS_CLIENT_ID` must equal the Expo app bundle identifier (`com.downdistance.mobile`). `GOOGLE_CLIENT_ID` is the Google Web application/server OAuth client ID; the native SDK requests an ID token for that audience.

`apps/mobile/.env.local`:

```env
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_TEAM_ID=
EXPO_PUBLIC_USE_FIXTURES=
EXPO_PUBLIC_EAS_PROJECT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

`EXPO_PUBLIC_EAS_PROJECT_ID` is required for Expo push tokens. `EXPO_ACCESS_TOKEN` is an optional server-only root variable when enhanced Expo push security is enabled for the EAS project.

## Real push notification setup

Remote notifications require the Down & Distance development build on a physical iPhone; Expo Go is not supported for this path.

1. Create or select the D&D Expo/EAS project with `npx eas-cli init` and put its project ID in `apps/mobile/.env.local` as `EXPO_PUBLIC_EAS_PROJECT_ID`.
2. In Apple Developer, enable **Push Notifications** for `com.downdistance.mobile`.
3. Configure the project's iOS push credential with `npx eas-cli credentials` (iOS → Push Notifications). This requires an Apple Developer membership.
4. Apply the local schema with `npm run auth:migrate`.
5. Rebuild after installing/configuring `expo-notifications`: `npm --prefix apps/mobile run ios:device`.
6. Open Account → Notification preferences, turn **Push Notifications** on, approve the iOS prompt, then press **Send Test Notification**. The test action exists only in development.
7. Put the app in the background, receive the push, and tap it. The included generic `destination` opens Three and Out; future pushes can use any valid Expo Router path.

For a cable-free physical-iPhone install, register the device and create an internal EAS development build:

```bash
npx eas-cli login
npx eas-cli device:create
npx eas-cli build --profile development --platform ios
```

Open the resulting install URL on the registered iPhone. After installation, run Metro locally with `npm --prefix apps/mobile run start:dev-client`.

Turning push off disables the registered D&D device and the account push preference. A denied iOS permission shows an **Open iPhone Settings** action instead of repeatedly prompting.

Google client IDs and the reversed iOS URL scheme are public application configuration, not secrets. Never add private keys or client secrets to `EXPO_PUBLIC_*` values.

## Provider setup

### Apple

1. In Apple Developer, enable Sign in with Apple for App ID `com.downdistance.mobile`.
2. Use the same Apple developer team and group the web Service ID/App ID where applicable so Apple identity subjects remain consistent between web and native.
3. Set `APPLE_IOS_CLIENT_ID` on the backend. The existing Apple team, key ID, and private key remain server-only.
4. Build with Apple signing. Apple only supplies name on the first authorization; D&D stores it on the canonical user.

Expo Go can display/test Apple's API, but its identity belongs to Expo Go and does not use the D&D bundle identifier. Use the development build below for a real end-to-end D&D session.

### Google

1. In one Google Cloud project, create an iOS OAuth client for `com.downdistance.mobile`.
2. Create/use a Web application OAuth client for backend authentication.
3. Put the Web client ID in both server `GOOGLE_CLIENT_ID` and mobile `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Put the iOS client ID and its reversed URL scheme in the two corresponding mobile variables.
5. Rebuild the native app after changing the URL scheme. Google native sign-in cannot run in Expo Go.

### Facebook

The existing backend verifier remains available, but a native Facebook SDK/button was not added. Completing it requires Facebook App ID, iOS bundle registration, URL-scheme config, and a development build.

## Exact local commands

Find your Mac's Wi-Fi LAN IP:

```bash
ipconfig getifaddr en0
```

If that returns nothing, inspect the active interface with `networksetup -listallhardwareports`, then run `ipconfig getifaddr` with that interface. Put the result and the backend port in `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:3000
```

For the iOS simulator only, `http://localhost:3000` is appropriate. A physical iPhone cannot use the Mac's `localhost`.

Terminal 1, repository root:

```bash
npm install
npm run auth:migrate
npm run dev -- --hostname 0.0.0.0
```

The `0.0.0.0` bind is required for the phone to reach the backend over the LAN. Confirm `http://YOUR_MAC_IP:3000/api/auth/me` responds from Safari on the phone; an unauthenticated `401` JSON response is expected and proves connectivity.

Terminal 2, also from the repository root:

```bash
npm --prefix apps/mobile install
cp apps/mobile/.env.example apps/mobile/.env.local
npm --prefix apps/mobile run ios:device
```

Choose the connected iPhone when prompted. Xcode and an Apple Developer signing team are required, and Developer Mode must be enabled on the iPhone. After the first native install, normal JS iterations use:

```bash
npm --prefix apps/mobile run start:dev-client
```

Open the installed Down & Distance development app and connect to Metro. The Mac and iPhone must share a network, macOS Firewall must permit Node, and the backend port must be reachable from the phone.

If Metro reports that port `8081` is already in use, either accept the suggested alternate port and use its new QR code, or stop the older Expo terminal before restarting. Do not run two Metro servers unless you intentionally want separate ports.

Expo Go can run the JavaScript app and email sign-in, but native Google Sign-In requires the installed development build. Use `npm run ios:device` for the complete provider flow.

## Account-linking behavior

Provider identities resolve only by `(provider, provider_subject)`. A verified provider email that already belongs to another D&D user is not silently merged; the user must sign into that existing account and link the provider through the established Security flow. This also protects Apple private-relay addresses.
