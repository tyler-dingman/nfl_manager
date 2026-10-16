# Editorial D1 local proof of concept

This standalone package uses **one local D1 database for all 32 NFL teams**. It does not import the application, open PostgreSQL, fetch providers, schedule ingestion, expose content APIs, or deploy infrastructure. See [D1_POC_RESULTS.md](D1_POC_RESULTS.md) for measured results and qualification limits.

Requires Node 22+ and npm. Run commands **from this directory**, not the application root:

```sh
npm ci
npm run typecheck
npm run db:migrate
npm test
npm run benchmark
npm run qualify
npm run build
npm run format:check
npm run dev
```

`dev` listens at `http://127.0.0.1:8797`. Its expected response is 404: “Editorial D1 local proof of concept; no content HTTP API.” It validates local bindings and constructs the Worker-compatible repository without reading or writing content. Stop with Ctrl-C.

`db:migrate` hardcodes `--local` and `.local/state`; `build` hardcodes `--dry-run`. The launcher rejects additional flags and unknown modes. There is no deploy, remote migration, scheduler, provider, bridge, Queue, R2, or paid inference command. The D1 ID is a zero-UUID sentinel, `remote=false`, and Workers/preview routes are disabled. No Cloudflare account or credentials are required. Do not replace the sentinel during this review.

Tests and benchmarks use Miniflare/workerd D1, not a mock SQL implementation, and create disposable synthetic databases in the system temporary directory. The installed Miniflare 5 beta requires its supported v4 configuration conversion helper; persistent tests use `resourcePersistencePath`, not the obsolete `d1Persist` option. All external Worker outbound requests are blocked in the harness. Only harness-owned temporary data is removed. Wrangler dev/migration state remains locally under `.local/` and is ignored by Git.

`measurements/local-benchmark.json` contains aggregate local D1 result metadata, timing, query plans and synthetic payload sizes. `pre-index-baseline.json` is the same benchmark before measured index/query improvements. `free-tier-projection.json` is generated from the final measurement and explicit assumptions. None is production telemetry or billing certification. Node host CPU excludes workerd CPU and does not establish a Free Worker limit.

The repository accepts explicit validated editorial commands; it does not perform automatic story clustering, publication policy inference or article generation. All fixtures live under `test/`. Production HTTP adapters, legacy DTO/ID import mapping, full-catalog parity and migration rehearsals require separate review. No existing API or scheduler points to this database.

Minimal repository usage inside a trusted local Worker:

```ts
import { createLocalRepository } from './src/worker-repository';
const repository = createLocalRepository(env);
const page = await repository.storiesForTeam('kc', 20);
// page.nextCursor is a time/ID keyset cursor; no OFFSET scan or total-count query.
```

Input teams use existing lowercase IDs (`kc`, `sea`, etc.); invalid, missing and uppercase IDs fail explicitly. IDs are opaque text and are never replaced with SQLite row IDs. Indexed timestamps are epoch milliseconds. Unknown editorial record fields, nested JSON and nulls round-trip in `record_json`; this is not a completed importer for PostgreSQL domain DTOs. JSON records larger than 512 KB fail explicitly rather than being truncated. Association/evidence/entity inventories are bounded to 32, pages to 100, each statement to 100 bound parameters and each repository batch to 50 statements. Combining operations in one future invocation still requires its own overall query/CPU budget.
