# Field → badge launch concept

Field is the active default. Change only `LAUNCH_ANIMATION_VARIANT` in `apps/mobile/lib/launch/config.ts` to `orbit` to restore the existing concept. `brand-intro.tsx` was not changed. Both render native components; no video, raster sequence, or WebView is used by the animation.

## The transformation

`field-launch-animation.tsx` mounts the badge's 20 real hash paths once. Those same nodes scroll with the field, compress into their canonical badge coordinates and turn red. They are not removed and replaced by a finished logo. The 50/40/30/20/10 labels travel at the same speed as their major hashes.

The 12 letter contours, ampersand, counters, red block and hashes are extracted from the existing official SVG geometry by `scripts/generate-launch-logo.ts`. The original filled border is revealed through a stroked SVG mask while letters slide into place with a 40–45 ms stagger. The ampersand reveals through a mask as its red block builds. Final lettering is white, border tan, marks red, matching the current neutral app badge.

Reanimated shared values drive transforms, SVG brushes, masks and opacity without React state updates every frame. The completed badge settles from 0.98 to 1.0.

## Lifecycle

- First launch: approximately 3.15 seconds, including exit fade.
- Returning launch, authenticated or logged out: approximately 1.1 seconds.
- Reduce Motion: 0.5-second logo fade, no field scroll.
- Existing persisted intro marker determines full versus short. This does not reset server onboarding progress.
- Launch occurs once per app mount, outside authentication routing. Completion reveals the existing auth/onboarding/personalized app state with a short fade.
- Skip, background/resume recovery and a completion watchdog prevent a stuck launch. Storage/accessibility lookup has a bounded fallback.

## Review artifacts

- [Recording](field-launch.webm): browser recording for internal review only; not an implementation asset.
- Keyframes: [50](50.png), [40](40.png), [30](30.png), [20](20.png), [10](10.png), [field only](field.png), [compression](compress.png), [assembly](build.png), [badge](badge.png).

## Validation and limits

Mobile TypeScript check passed. Browser checks passed for full, short returning and reduced-motion launch. The capture script verifies all 20 original hash DOM nodes persist into the completed badge and finish red. Orbit was temporarily selected and its logo/circle/message/completion sequence passed; Field was restored afterward.

Login/signup/reset and test-login onboarding regression checks also passed across three viewport sizes. The `width-360` folder contains the narrower Android-sized capture.

These are React Native Web previews at iPhone- and Android-sized viewports, not native device validation or a 60 fps measurement. Android build preflight still refuses to start with less than 10 GB free (about 6.7 GB available). iOS builds and physical iOS/Android visual/performance/background-resume checks remain unverified. No new native dependency was added; this uses the installed Reanimated and SVG packages.

Field playback is restored to its original speed (`FIELD_LAUNCH_SPEED = 1`); yard numbers are white. Reduced Motion remains brief.

Latest playback adjustment: Field now runs at 0.5× speed (6.3 seconds), and `FIELD_USE_SHORT_RETURNING_INTRO = false` makes repeat launches show all five yard numbers too. The short implementation is retained for later use. Reduced Motion still intentionally omits scrolling numbers.

Latest choreography: scrolling hashes retain the exact red badge shapes and fixed final vertical positions. They settle horizontally before the logo starts assembling. Logo assembly lasts about 1.36 seconds with a 1.2-second completed-logo hold; total playback is about 7.66 seconds. Whole-composition scaling was removed to keep that baseline fixed.
