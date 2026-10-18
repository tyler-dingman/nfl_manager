# Cloudflare hosting implementation

**PARTIALLY RESOLVED; not a qualified production host.** Next server rendering, middleware, dynamic team pages, auth APIs, SEO metadata and client navigation require a server runtime. Static export/SPA fallback cannot preserve them. The local experiment uses OpenNext Workers + Static Assets; mobile screens remain React Native.

Implemented: explicit Cloudflare build/dry-run commands; isolated sentinel Wrangler resources; compatibility flags; request-scoped D1/private R2 bindings; a separate disabled scheduler entry; Static Assets; response security headers and private/no-store policies for cookies/auth/APIs. No paid DO/KV/Queue cache is configured. OpenNext cache/queue providers are dummy implementations; repeated SSR/ISR costs remain unqualified. Framework routing owns APIs; a SPA fallback does not conceal missing handlers.

Next moves from 14.2.5 to patched 14.2.35. The experiment pins legacy OpenNext 1.8.3 to preserve current App Router/React 18 contracts during isolated work. Current adapters require a newer Next version. **Next 14/this old adapter are not a supported production recommendation.** A supported framework/adapter upgrade and renewed auth/dynamic-route/SEO/cache/native-API checks remain required. [OpenNext compatibility](https://opennext.js.org/cloudflare)

Native Argon2 initially blocked bundling. The Worker-specific module explicitly rejects password hashing; Node retains original Argon2id memory/time/parallelism/output parameters and existing hashes. Worker password login/signup/reset/recovery return 503 and are not advertised as available. This is an unavailable capability, not weaker hashing or completed auth hosting.

The first workerd probe failed in the legacy adapter's process.chdir call. The documented disable_nodejs_process_v2 flag restores its expected process surface locally. A second probe reproduced Workers rejecting redirect:error. Middleware/provider/RPC calls now use manual redirects and reject non-success responses before forwarding credentials. Authentication gates were preserved. [Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [process behavior](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)

Latest dry-run compressed Worker: **2832.32 KiB**. It is close to the Free compressed bundle ceiling and lacks 30% size margin. The local build contains 1,770 static files; checked assets fit per-file/count bounds. Actual account asset quotas remain unverified. Local self-fetch success also does not establish same-zone deployment behavior: use an approved Custom Domain/service-binding design for authentication self-requests; routes alone may reject Worker-to-Worker fetches. Packaging success does not establish working data APIs or CPU compliance.

## Actual local Worker responses

A new local D1 is migrated and seeded with one synthetic opaque session. No account/provider credentials are available. Cold/warm HTTP wall time is measured outside workerd. Known 503/empty-data responses remain visible; they are not counted as functional features.

| Family | Attempt | Status | Local HTTP wall ms |
|---|---|---|---|
| Homepage | cold | 200 | 98.21 |
| Homepage | warm | 200 | 29.64 |
| The Beat | cold | 200 | 33.99 |
| The Beat | warm | 200 | 26.57 |
| Film Room | cold | 200 | 30.05 |
| Film Room | warm | 200 | 25.47 |
| AI Search | cold | 200 | 29.31 |
| AI Search | warm | 200 | 4.69 |
| Front Office | cold | 200 | 26.31 |
| Front Office | warm | 200 | 29.37 |
| Parlay Lab | cold | 200 | 31.99 |
| Parlay Lab | warm | 200 | 26.32 |
| Trending Props | cold | 503 | 5.22 |
| Trending Props | warm | 503 | 4.30 |
| Bet Slip | cold | 200 | 30.48 |
| Bet Slip | warm | 200 | 25.03 |
| Authentication | cold | 200 | 2.93 |
| Authentication | warm | 200 | 3.74 |
| Existing session | cold | 200 | 3.76 |
| Existing session | warm | 200 | 4.14 |
| Saved IDs | cold | 200 | 6.23 |
| Saved IDs | warm | 200 | 4.20 |
| Editorial ingestion admission | cold | 503 | 5.58 |
| Editorial ingestion admission | warm | 503 | 2.79 |

Existing session validation, saved-ID access and lexical search exercise actual local D1 bindings. Password capability checks remain explicitly unavailable. Full PostgreSQL-dependent APIs, actual provider/OAuth exchanges, private-list R2 fanout bounds, production cache/startup/memory/billed CPU and supported framework versions remain blockers. Authenticated SSR 200 responses on a small fixture do not establish complete feature data.

No production API/database, deployment, account change, paid activation or real mail occurred. There is no cloud preview. Before proposing one, prepare supported versions, complete critical routes, exact synthetic resource IDs/secrets and rollback artifacts, then obtain separate preview approval. Committed configurations intentionally contain no usable production IDs/routes.
