# Down & Distance cross-platform design

## Native apps and mobile-web parity

- Android and iOS screens must remain React Native screens. Do not replace them with WebViews or a web-rendered application shell.
- The existing responsive mobile-web implementation is the visual source of truth. Inspect its components and styles before changing an equivalent native screen; screenshots supplement that inspection.
- Treat changes to shared product experiences as web and native work together. When adding a screen or changing a hero, player card, filter, menu, form, or other shared UI, inspect and update both the web implementation and `apps/mobile` in the same change.
- Reuse platform-independent team themes, design values, types, view models, filtering, formatting, and business logic through shared modules where practical. Keep DOM/CSS and React Native rendering adapters separate where required by their runtimes.
- Within each renderer, use reusable visual components rather than copying the same hero/card/button implementation into individual screens. Android and iOS share the native implementation.
- Preserve real API data, authentication, state, deep links, and device integrations. Sample data belongs only in isolated tests/previews.
- Native-only differences include safe areas, system bars, keyboard handling, gestures, and persistent bottom navigation. Native screens must not include the website footer.
- Target native bottom navigation: Home / The Beat / Film Room / Front Office / Parlay Lab / Account. Trivia and Merch remain secondary destinations. This describes the target; do not claim routes exist before implementing them.
- For shared UI changes, validate the corresponding mobile-web and native states, including loading, errors, empty states, forms, modals, and drawers. Check more than one team theme and content clearance above bottom navigation.
- Report precisely which platforms were built or visually checked and which remain unverified. A browser rendering of React Native Web is not an Android/iOS device validation.

See `apps/mobile/AGENTS.md` for Expo-specific instructions and `reports/native-web-design-parity.md` for the architecture decision and initial gaps.
