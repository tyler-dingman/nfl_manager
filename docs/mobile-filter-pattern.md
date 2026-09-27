# Responsive filters: The Beat and Film Room

The audit found that web filters were inline pills/native HTML selects, while the Expo
Beat screen had no filters. Existing web dialogs already share `useDialogFocus` for focus
containment, Escape dismissal, scroll locking and focus restoration. The new sheet reuses it.

- `packages/filters` owns framework-free field definitions, defaults, labels, normalization,
  secondary counts and reset behavior. Web and Expo import the same Beat configuration.
- `ResponsiveFilterBar` wraps existing desktop controls as children. Below 768px it shows
  compact primary selectors and a Filters button. All mobile selectors open `FilterBottomSheet`.
- Expo's `MobileFilterBar` implements the same contract using a native modal, shared colors,
  minimum 44px triggers, 48px option rows, and safe-area insets. This is not a WebView.
- Primary selections apply immediately. Secondary edits are draft-only; dismiss discards,
  Reset resets the draft, and Apply commits it. The badge counts applied secondary fields.
- The web toolbar sticks beneath the measured site header once reached. Expo uses the
  ScrollView sticky header beneath its native navigation. Neither toolbar is a fixed overlay.
- The Beat retains query parameters on web and Expo route parameters in the native stack.
  Opening a story and navigating back retains category, sort and time. Native filters request
  the same paginated server feed; counts cover the full result, with load-more support.

To adopt on another screen, define its fields with the same contract, supply controlled values
and an onChange handler, and wrap its existing desktop UI. Do not put filtering logic into
platform components. Keep defaults and option labels shared; platform renderers own focus,
modal dismissal, safe-area layout and screen-reader semantics.

Verification: web browser interaction harness covers category/sort, cancel/apply/reset, counts,
44px targets, sticky header offset, 320px overflow and desktop fallback. Native TypeScript and
lint are checked separately; physical-device VoiceOver/TalkBack and gesture testing remain
manual checks.

Film Room now uses the same toolbar and sheets with category and sort only (`secondary=[]`).
Its shared definitions and client-side ordering live in `packages/filters/film-room.ts`; both
web and Expo retain selections in route parameters. Desktop keeps its pills and select. Mobile
shows one featured 16:9 video followed by 38%-width thumbnails with adjacent metadata; video
actions use an equal-width 44px YouTube / Share / Channel row. Isolated browser checks cover 320px/390px overflow, compact card
height, playback callbacks, equal action widths, single-line labels and desktop visibility.
