# Offline Firebase CPU diagnosis

Run from the repository root. These tools create only disposable local workerd/D1 fixtures. They never deploy or read staging credentials. Keep the existing `phase-two-network-guard.cjs` preload enabled. Local loopback listeners require execution permission in restricted environments.

```sh
node scripts/firebase-auth/build-profile-map.mjs
NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node scripts/firebase-auth/inspect-probe.mjs
NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node --import tsx scripts/firebase-auth/profile-workerd.mjs
node scripts/firebase-auth/summarize-profiles.mjs
DD_PROFILE_OUT=reports/firebase-cpu-root-cause/repeat-2 DD_PROFILE_WARM_COUNT=20 NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node --import tsx scripts/firebase-auth/profile-workerd.mjs
DD_PROFILE_OUT=reports/firebase-cpu-root-cause/repeat-2 node scripts/firebase-auth/summarize-profiles.mjs
DD_PROFILE_OUT=reports/firebase-cpu-root-cause/repeat-3 NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node --import tsx scripts/firebase-auth/profile-workerd.mjs
DD_PROFILE_OUT=reports/firebase-cpu-root-cause/repeat-3 node scripts/firebase-auth/summarize-profiles.mjs
python3 scripts/firebase-auth/aggregate-profiles.py
DD_PROFILE_LAZY=true DD_PROFILE_OUT=reports/firebase-cpu-root-cause/lazy-module NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node --import tsx scripts/firebase-auth/profile-workerd.mjs
DD_PROFILE_OUT=reports/firebase-cpu-root-cause/lazy-module node scripts/firebase-auth/summarize-profiles.mjs
TSX_TSCONFIG_PATH=tsconfig.test.json NODE_OPTIONS='--require ./scripts/phase-two-network-guard.cjs' node --import tsx scripts/firebase-auth/profile-components.ts
```

The source-map builder uses the production esbuild options with an external map and no embedded source text. Verify its `/private/tmp/dd-api-profile/worker.mjs` hash equals `workers/api/dist/worker.mjs` before mapping production profiles. It writes no production bundle. The existing generated route table is regenerated deterministically.

The workerd harness attaches to `/json/list`'s exact `core:user:api` WebSocket target and enables `Profiler` before sending requests. It records raw standard `.cpuprofile` files plus bounded numeric auth stages. Main-isolate sample counts classify hot synchronous stacks; they are not exact per-stage CPU accounting. `timeDeltas` include sampling gaps and parked time: do not convert samples/elapsed spans to hosted milliseconds or sum nested spans. D1 SQL-engine and native crypto helper-thread CPU are outside this target. The optional lazy-import control separates module evaluation from exchange execution; it is a diagnostic wrapper and is never an application route.

The Node component harness measures the actual verification/import/encryption/opaque-cookie/serialization functions in five batches and wraps repository user lookups only inside its own process. Node process CPU includes Node fixture transport and crypto helper work but excludes the D1 child process. It cannot qualify a Worker. Provider replies and identities are synthetic. Successful identity decisions are never cached; provider lookup occurs once per exchange.

Neither harness emits token/password/cookie values, SQL bind parameters, emails or provider payloads. CPU profiles contain function/source locations, never argument values. Production crypto, claims, revocation, session, ownership and erasure logic remain unchanged. No fixture bypass is registered in application routing.
