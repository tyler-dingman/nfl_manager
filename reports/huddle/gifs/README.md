# Huddle GIF support

## Configuration

KLIPY's current standard integration requires API requests and media loads to originate on the end-user client. A D&D server proxy would require KLIPY's prior written approval, so this implementation uses direct client requests and provider-hosted media.

Create an app key intended for public client integration in KLIPY's Partner Panel. Configure an ad-free integration (this picker does not implement KLIPY's ad SDK) and the desired content filters there. Do not put a secret/back-office credential in these variables:

- Web `.env.local`: `NEXT_PUBLIC_KLIPY_APP_KEY=...`
- Native `apps/mobile/.env.local`: `EXPO_PUBLIC_KLIPY_APP_KEY=...`

Restart Next/Expo after configuration; a new native binary/update is required for installed apps. Both keys are intentionally public client app identifiers. No key was added during this change. Missing keys show a clean configuration state; text/emoji remain usable.

Official sources checked September 30, 2026:
- https://docs.klipy.com/integration-requirements
- https://docs.klipy.com/gifs-api/gifs-search-api
- https://docs.klipy.com/gifs-api/gifs-trending-api
- https://docs.klipy.com/gifs-api/gifs-items-api
- https://docs.klipy.com/gifs-api/gifs-share-trigger-api
- https://docs.klipy.com/attribution
- https://klipy.com/support/api-terms

The required search placeholder is “Search KLIPY”. Text attribution is visible in the picker and posted media; supplied source/username attribution is preserved. No invented KLIPY logo. Results retain order. Unsupported ads fail the whole request with a configuration message rather than silently removing provider content. No local GIF library or copies of KLIPY media are created.

## Implementation

- `packages/gifs`: provider interface, normalized results, KLIPY adapter, shared 300ms-debounced picker state. 20 results/page, explicit pagination, 8-second timeout, cancellation and generation guards. No background searches while closed.
- Existing web/native Huddle composers gain a GIF control before image, selected thumbnail/removal, optional text and reply context. Removing a GIF preserves text. Selecting an image replaces a GIF and vice versa.
- Shared `Message.media` stores only `{mediaType,provider,providerMediaId}`. Server validation discards client URLs/titles; only strict KLIPY slugs can be retained. Display URLs come from the real provider adapter, restricted to documented HTTPS delivery domains and preserved verbatim.
- `resolvedGif` is transient local state so selection/posting does not fetch the same item again. Historical references resolve using the Items API. Errors display a fallback without breaking the message.
- Web uses viewport-aware lightweight playback and reduced-motion stills/play controls. Native uses stills and explicit play/pause, stopping playback on scroll start/app background/reduce-motion changes. Picker thumbnails on native are still renditions, virtualized with FlatList.
- Web uses an accessible modal (Escape/focus containment), mobile web a full-width bottom panel; native uses a Modal bottom sheet with safe-area padding and KeyboardAvoidingView.
- Likes/reports/mute/block reuse the same message actions. Archives render media without a composer.
- Existing web analytics event convention extended with aggregate `huddle_gif_picker_opened/search/selected/sent` CustomEvents. No message text, query, media ID, or user identifier in those application events. KLIPY's share endpoint receives the originating query per their documentation. No native analytics infrastructure was found; none was invented.

## Persistence / concept mode

The user's previous no-live-data request remains in force. `/api/huddle` stays disabled; no game polling, provider schedule fetch, real-time connections or production posting was enabled. Daily and GameDay development previews accept local text/GIF posts (cleared on reload/context change). Existing image uploads remain local previews and are not uploaded.

Migration `049_huddle_gif.sql` extends the existing messages table, not a new chat table. It relaxes the text constraint for GIF-only messages and adds reference-only JSON plus reply ID. The existing repository reads/writes those references and retains rate limits, spam/duplicate checks and moderation. Migration is supplied but NOT applied to any database. Production chat activation remains separate; it is not implied by adding a GIF picker.

## Verification

Web and mobile TypeScript checks pass. All 16 GIF/Huddle automated tests pass.

- Automated mocked-provider tests: rendition normalization, URL injection rejection, reference-only persistence shape, GIF-only/text+GIF validation, bounded search/trending, pagination, missing key/rate-limit/outage, abort.
- Shared-hook tests: 300ms debounce, stale response suppression, local Daily/GameDay GIF sends, replies, likes/unlikes, mute, archived send rejection. No live KLIPY dependency.
- Desktop web: picker opens with no-key state; layout inspected; text can still post locally after closing it.
- 390px mobile web: PHI GameDay picker opens as full-width bottom panel with team accent.
- 390px React Native Web: KC Daily picker opens as bottom sheet, full composer present.
- Actual live trending/search/media selection requires a configured key and has NOT been verified. Native keyboard/safe-area behavior on physical iOS/Android, full grid with real media, device playback and production database delivery are NOT verified. No APK was built.
