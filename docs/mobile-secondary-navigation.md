# Mobile section navigation

`MobileSecondaryNavigation` is the responsive-web/PWA section-navigation bar. Render it
immediately after the global header and pass the **same resolved items** used by the desktop
navigation. It accepts a contextual label, items (label/href/icon/optional active override),
current route, the desktop navigation breakpoint, and an optional Merch background tone.

The 48px full-width trigger uses a menu icon and a stateful chevron. Its navigation sheet
uses the shared `BottomSheet`, extracted from the existing filter sheet. Filters retain a
compatibility wrapper; both uses share focus containment, Escape and backdrop dismissal,
scroll locking, focus restoration, and safe-area padding. The existing sheet does not
implement swipe-to-dismiss. Rows are at least 48px tall, current destinations are marked
with `aria-current` and a check, and selecting a destination closes the sheet. Route changes
or expanding to desktop also close it.

Migrated consumers:

- Merch: Shop departments; existing category configuration and desktop links.
- Parlay Lab: Explore Parlay Lab; existing nine destinations and team-aware URLs.
- Front Office: Front Office sections; existing franchise/pre-franchise configuration,
  query-aware roster destinations, and Change team. The duplicate mobile drawer/focus
  implementation was removed; the desktop sidebar remains.
- Profile: Profile & account; existing profile links and route aliases.

Audit boundaries: global navigation, pagination, feed filters, in-page settings/content tabs,
Front Office subsection tabs, and live-draft panel switching are not replacements for section
navigation. They retain their respective semantics. Beat, Film Room, and Trivia do not need
an additional section bar. The unused legacy ParlayLabSecondaryNav is not mounted by the
current dashboard screens.

Responsive web, installed PWA, and any app surface rendering this frontend use this exact
component. The separate Expo native application does not render these desktop navigation
systems and is outside this shared-frontend migration.

Verification: web TypeScript and targeted lint pass. An isolated Chromium harness exercises
the real component and sheet: destination count/current state, 48px rows, selection closure,
Escape/backdrop dismissal, focus restoration, scroll unlock, 320px overflow, and desktop
resize closure. Full authenticated-page/device navigation remains a manual integration check.
