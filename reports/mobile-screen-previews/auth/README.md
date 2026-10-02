# Native authentication redesign previews

September 28, 2026. React Native Web captures, not iOS simulator or Android device screenshots.

Run `node apps/mobile/scripts/capture-auth-preview.cjs` with Expo Web on port 8090. APIs are intercepted; no real accounts or password-reset requests are created.

Captured launch, animated orbit, brand message, welcome, login, and signup at 360×800, 393×852, and 430×932. Verified intro completion survives reload, intro skip with reduced motion, password reset acknowledgement, and signup password validation. Existing local demo credential tests pass; the test credentials also reached the authenticated preview shell from the new login form in all three viewports. Test login remains gated by the existing development/demo build flag; credentials are no longer displayed in the login UI.

The native components reuse the exact header SVG geometry with its neutral brand palette. Intro state is stored in SecureStore on devices and localStorage in browser previews; successful authentication also marks the intro complete. Authentication providers retain existing availability checks and flows. Native signup calls the existing signup endpoint, then the existing mobile email login for token storage. No web login or backend change.

Build limits: Android preflight requires 10 GB free; this machine has about 2.3 GB. iOS initially failed processing PNGs under an invalid C.UTF-8 locale. Retrying with en_US.UTF-8 progressed into compilation, but was stopped as free disk space fell to roughly 1.4 GB. Temporary build output was removed. Device keyboard/autofill, actual social sign-in, frame rate, and native screenshots remain unverified.
