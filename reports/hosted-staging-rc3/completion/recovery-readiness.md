# Hosted recovery readiness — no restore performed

All ten Free D1 slots are occupied by the current staging generation. This mission did not delete, empty, restore over, or create a database. Hosted recovery is UNVERIFIED.

Reviewed code: `scripts/multi-d1-recovery.ts`, `scripts/erasure-ledger.ts`, `packages/storage/multi-d1-recovery.ts`, `packages/storage/cross-shard-saves.ts`.

The backup entry point requires `rawWritersStopped: true`, acquires every shard's maintenance fence before reading snapshots, verifies references, exports all ten logical schemas/data under one window ID and mapping version, checks epochs again, seals and reopens the coherent authenticated archive. It is not an atomic cross-database snapshot. Raw writers outside the SDK must remain stopped. Acquiring fences would modify occupied databases, so this procedure was inspected rather than executed here.

Restore rejects `isolatedEmptyTargets: false` before database access. It authenticates the current independent erasure ledger and all archive shards before any destination mutation, then checks every destination is empty before importing. Content and shared targets restore before users. It performs foreign-key and integrity checks, replays the separately maintained current ledger, verifies cross-shard references, and only then unlocks. An interrupted restore leaves isolated destinations unavailable; it must not be advertised as ready or resumed over partially occupied targets without a reviewed recovery procedure.

Actual hosted read-only checks in `final-d1-readonly.json` confirmed private-table ownership on all ten shards, three COMMITTED saved-story references with complete payloads and retention pins in their correct owners, one saved-bet receipt, and zero current erasure-ledger rows. The ledger was not replaced or mutated. These checks are not backup/restore acceptance.

## Feasible next owner procedure

1. Keep public exposure disabled, schedules/providers off, stop every writer and drain in-flight work. Coordinate raw administrator/import access too.
2. Preserve the latest independent erasure ledger separately from historical backups, even when empty. Authenticate and retain it outside the restore set; never roll it back with the archive.
3. Under separately reviewed maintenance authorization, create a coherent ten-shard authenticated backup with reference/payload verification and exact IDs, mapping version, schema hashes, epochs and window ID recorded. Verify the offline archive before releasing fences.
4. Obtain ten empty isolated destinations without paid activation. None exist now. Do not assume twenty concurrent slots. A synthetic-only evacuation/reprovision of existing slots is destructive, outside this mission and requires separate explicit authorization; it is not recommended merely to finish a test.
5. With those empty destinations and no ingress, test missing shards, corrupt archives and revocation-ledger authentication before import; test interrupted recovery isolation; then perform the complete restore and verify original IDs, saved references, bet evidence, user progress, revocation replay and integrity.
6. Do not label hosted recovery PASS until an actual successful hosted restore meets every acceptance criterion. Keep production NO-GO while that result is unavailable.
