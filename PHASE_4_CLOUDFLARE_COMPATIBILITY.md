# Phase 4 Cloudflare compatibility

Worktree `/private/tmp/down-distance-zero-cost-phase-4`, branch `poc/zero-cost-production-readiness-phase-4`, base `8adafd53`. No production access, deployment, paid activation, real provider calls or existing user-data deletion. PostgreSQL remains the default and rollback implementation. All binding mutations use synthetic local data.

Next 14.2.35 / OpenNext 1.8.3 moved to pinned Next 15.5.28 / OpenNext 1.20.12. Dependencies were installed in a separate copied dependency tree; Phase 3 dependencies remain intact. Dynamic App Router params/searchParams now await promises; the client story route uses `useParams`. Existing URLs, layouts, SEO metadata and React Native renderers are preserved. Native screens were not replaced or modified.

Node rollback build and actual local Worker boot execute. OpenNext's supported Node runtime uses `nodejs_compat` without the former process-v2 disabling workaround. Cloudflare Static Assets handles static files. Local-only fake IDs, remote=false, workers_dev=false and cleared credentials remain. Password auth retains original-strength Node Argon2; the Worker explicitly returns unavailable instead of weakening hashes. Filesystem/Node-dependent business functions are still unqualified or fail closed in D1 mode.

Final minified dry-run Worker size: **3204.78 KiB gzip**, above the Free **3 MiB** limit. A local dry-run is not account entitlement or deployability proof. The supported framework resolves the old legacy-adapter compatibility gap but does not resolve Free artifact size, startup/memory, password auth or unported APIs.

26 local SSR/API cold/warm probes retain exact statuses in `local-worker-probe.json`. Existing sessions and saved IDs work. Trending Props and editorial admission intentionally return 503. Separate actual workerd tests execute bounded compression/decompression. Local wall time and successful SSR are not billed CPU qualification. No preview or production deployment occurred. Browser checks exercise mobile-web at 390 px and desktop at 1440 px, KC/SEA; Android/iOS devices are unverified.

Sources checked 2026-10-18: [OpenNext support](https://opennext.js.org/cloudflare), [Next support policy](https://nextjs.org/support-policy), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). No claim that all Next features or all application dependencies have been qualified from a build alone.
