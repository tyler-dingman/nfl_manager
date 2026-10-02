# Native demo login

Enter `test@gmail.com` and password `test` on the existing email sign-in form.

Available in development and in the explicit internal EAS `demo` profile for Android/iOS. Standard release and Firebase profiles disable it. Build from this directory using `eas build --profile demo --platform android` or `eas build --profile demo --platform ios` (iOS requires signing/provisioning). These commands build new binaries; existing installed apps do not change automatically.

The session lives in memory and ends on sign-out or a full app restart. It issues no authentication tokens, creates no server account, and uses no real account data. A sample-data banner remains visible. API reads use local fixtures/empty states; unsupported features and writes return demo errors without falling through to the live API. Push registration and persistent cart storage are skipped in the demo. External images/links may still use the network.

This enables inspection of native screens, not a fully functional simulated backend. Use a normal account to test server-backed actions. Production email/social login remains unchanged.

Checks: `node --import tsx --test apps/mobile/tests/demo-session.test.ts` from the repository root, plus the mobile TypeScript check.
