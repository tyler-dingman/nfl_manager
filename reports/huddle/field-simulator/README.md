# Huddle field simulator — September 29, 2026

Open `/huddle?team=PHI` on the web development server (port 3000) or native Expo preview (port 8090). NEXT PLAY, PREVIOUS PLAY and RESET GAME manually advance the fictional PHI/DAL drive. No automatic advancement, live requests, database changes or recurring jobs.

The completed play is shown in Latest Play; the field shows its resulting ball position and next down. The shared fixture supplies both platforms. The ten resulting normalized positions are 26, 35, 38, 50, 58, 63, 63, 84, 91 and 100. Touchdown updates the sample score to 17–10. The sample score includes the specified extra point. Elapsed drive time is calculated between the first and current supplied clocks; the fixture does not invent time before its first play.

## Artwork

Supplied assets remain separate layers: perspective turf, canonical team-colored end zones and supplied wordmarks, vignette, possession container/logo, LOS, optional gold first-down line, ball/direction markers and dynamic badge. All 32 end-zone assets are bundled locally for native use; unknown teams fall back to abbreviation text. The supplied badge/possession sample lettering is removed in the generated bundle and replaced with actual text/logo.

Run `python3 scripts/build-huddle-field-assets.py` to regenerate `packages/huddle/field-assets.ts`. The source artwork is unchanged. The generated base corrects the supplied uneven/missing yard-line marks and number spacing to match the shared goal-line coordinates. Turf, end-zone geometry, hashes and cinematic layers are preserved.

The field retains its 1600:620 aspect ratio. Mobile uses a 560-unit-wide canvas cropped around the ball; desktop shows the full field. Marker transitions last 300ms and respect system Reduce Motion. Native rendering uses React Native views/text and react-native-svg, not a WebView.

## Production gate

`packages/huddle/use-huddle.ts` enables the simulator only when NODE_ENV is development. The guarded fixture module is not loaded by the production hook; it returns an empty game and empty comments with no simulator controls. `/api/huddle` still returns 503 without auth/database/provider imports. `getHuddleGame` still returns null without network access. No production ingestion changes, migrations, scheduled jobs or deployment were performed.

## Validation

- Manually clicked all ten steps in desktop web, 393px mobile web and 393px React Native Web; captured Plays 1, 4, 5, 7, 8 and 10 after marker animations settled.
- Verified Previous and Reset on web/native previews, incremental PBP and selected fixture comments, final 17–10 score and disabled Next at Play 10.
- Shared tests verify both drive directions, own/opponent territory, midfield, every resulting position/first-down target, goal-to-go suppression, unknown-team fallback and incremental fixture visibility.
- Production-mode runtime check verifies no simulator, no game/comments, no fixture module import, no polling timer, no network requests, disabled API and disabled provider.
- Web and native TypeScript checks passed.
- Physical iOS/Android devices and release binaries were not built or validated. No APK update.

Screenshots: `desktop-play-{1,4,5,7,8,10}.png`, `mobile-web-play-{1,4,5,7,8,10}.png`, `native-web-play-{1,4,5,7,8,10}.png`. React Native Web captures are viewport captures of the scrollable app, not physical-device screenshots.
