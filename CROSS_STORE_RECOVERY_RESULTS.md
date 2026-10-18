# Cross-store recovery results

**PARTIALLY RESOLVED. MEASURED offline local recovery succeeds; production-scale coherent recovery remains unqualified.**

`cold-recovery.ts` now snapshots every logical application/editorial D1 table, excluding SQLite/Cloudflare internals, FTS shadow tables and restore journals. FTS logical content is restored through its virtual table. Original keys, rows, owner references, auth hashes/session families, saved IDs, source references and configuration remain intact. It inventories the entire frozen primary R2 namespace, including unreferenced immutable objects, and checks known D1 object references and content-addressed hashes. It never deletes a source row/object.

Writers must be stopped and the target must remain unserved. The explicit `OFFLINE_WRITERS_STOPPED` precondition is required because reading more than 50 tables across D1 batches is not an online transaction. A second table/inventory/hash pass detects changes during the copy, but cannot prove no writer resumes afterward. No online consistency or simultaneous PostgreSQL/D1 cutover is claimed.

Version-three manifests reference verified immutable backup objects by original key/hash. Existing body copies can be reused between checkpoints; payloads are not re-encrypted and duplicated for each directory snapshot. Raw object backups retain the bytes as stored and require private, encrypted-at-rest buckets; database directory chunks/manifests use AES-GCM with a separately retained key. Version-one/two encrypted-envelope/chunk readers remain. This is not verified off-account encryption/key recovery. The backup namespace must be independent of the frozen source. Adding backup objects to the source would fail the unchanged-inventory check.

Restore verifies/decrypts the manifest, requires the same additive schema and a new unserved target, copies/verifies R2 before D1 references, replays row groups below the batch/parameter ceiling and atomically records chunk receipts. Repeated or interrupted FTS restores do not duplicate rows. Final table fingerprints, counts and foreign-key checks must match before the journal becomes READY. Conflicting/corrupt data is refused rather than overwritten. SQL/HTTP routing must never expose RESTORING targets; the production cutover gate is not implemented.

## Executed rehearsal

61 logical tables; 132 rows; 4 immutable objects. All source and restored D1/R2 stores use disposable Miniflare bindings. A 2.1 MB game document, original credentials/session, saved article, saved bet aggregate, editorial/config aggregates and 85 historical search rows are included. Recovery resumes after an interruption at chunk 9; repeated restore also verifies. Missing D1 references, corrupt source hashes and a wrong decryption key are rejected. Every logical table hash/count matches.

Latest local backup: 0.521s. Successful resumed restore/verification: 0.508s, excluding the intentionally failed attempt. These are small local wall-clock timings, not production RTO. The independent PostgreSQL rehearsal restores all 50 synthetic tables and preserves source fingerprints; raw imported PostgreSQL rows are recoverable but unported business tables are not executable D1 state.

## Limits and retention

Current cold tooling has a 64 MB in-memory logical-row ceiling, 900 KB row ceiling, 8 MB object ceiling, bounded SQL parameter/batch limits and no streaming PostgreSQL/production export. Exceeding a bound fails instead of dropping data. The whole-product forecast exceeds this rehearsal scale. Full gameplay/trivia/odds population, off-account object/key recovery, automated checkpoint scheduling, retention enforcement and recovery-serving gates remain blockers.

All current originals, versions, receipts and artifacts are retained. The capacity model's eight directory copies are a planning assumption, not an active deletion policy. Production retention requires separately reviewed reference-safe pruning; keeping every daily checkpoint indefinitely grows beyond that model. Immutable body references are shared, and old user/editorial history must remain recoverable. Production RPO/RTO: **UNVERIFIED**. No production backup or restore was run.
