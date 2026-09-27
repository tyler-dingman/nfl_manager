# Mobile page endings and scrolling

The root web layout renders one `SiteFooter` after all page children, outside product grids
and secondary rails. It is in normal document flow. Mobile uses the existing logo, the six
`PRIMARY_NAV_ITEMS`, shared informational labels and copyright; desktop retains the prior
brand/information layout. The existing About/Sources/Privacy/Terms labels have no public
routes, so they remain text rather than dead links. No legal policy content was invented.

The former six-rem footer bottom spacer is removed. Footer padding accounts for the device
safe area. A future fixed web bottom navigation can publish its actual occupied height as
`--app-bottom-navigation-height`; the default is zero. The body uses horizontal clipping
instead of creating an overflow-x:hidden scroll container with implicitly auto vertical
overflow. Normal page shells retain natural height; minimum viewport heights do not cap
content. Desktop sticky sidebar heights and modal/drawer scroll surfaces remain intentional.

All web overlays that mutate body overflow now acquire/release `lockDocumentScroll`.
Independent snapshot/restore effects could strand the page at overflow:hidden when overlays
closed out of order. The shared lock restores the original overflow only after the final
owner releases it, and cleanup is idempotent. Film Room preserves its additional iOS fixed-body
scroll-position restoration while sharing overflow ownership.

Native `PageScrollView` adds the same footer content after children in the page's existing
ScrollView. It preserves refresh controls and sticky header indices; horizontal scrollers
never render a footer. Shared `Screen` uses it too. Migrated pages include Home, Three & Out,
Beat and stories, Film Room, Trivia landing, account/profile, Front Office, Game Day, catch-up,
Crew, Merch, orders, notifications/preferences, rewards and saved content. Native Trivia and
Account previously used fixed flex Views; they now use scroll content with flexGrow instead.
Native links use the existing mobile destination configuration, with Parlay Lab opening the
configured website because no native destination exists. Expo's tab bar occupies separate
layout space; it is not an absolute overlay over the footer. Existing safe-area-aware screens
and footer bottom inset remain in effect.

Sign-in, checkout/cart flows, search utilities, team onboarding and live gameplay do not get
an extra product footer inside their specialized scrolling surfaces. Web auth/admin/preview
footer exclusions remain. Desktop product layout and internal card designs are unchanged.

Verification: the scroll-lock unit test covers both close orders and repeated cleanup. An
isolated browser harness renders the actual footer, shared rail and mobile navigation sheet,
then verifies document scrolling reaches the footer after the rail at 320/390/767/1280px,
including after sheet dismissal, with no horizontal overflow. Web/native TypeScript and
targeted lint checks pass. Full authenticated-page and physical iOS/Android testing remain
manual integration checks; the supplied screenshot's exact stopped-scroll state was not
reproduced against a signed-in deployment.
