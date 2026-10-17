import { readFile, writeFile } from 'node:fs/promises';
const measured = JSON.parse(await readFile('measurements/storage-final-benchmark.json', 'utf8'));
const prior = JSON.parse(await readFile('measurements/storage-projection.json', 'utf8'));
const output: any = {
  scope:
    'Measured one-day cohorts; extrapolation, not multi-year load or billing measurement. MB=1000000 bytes. Shards and PostgreSQL are planning models only.',
  assumptions: {
    hotDays: 30,
    recoveryDays: 7,
    pageReserve: 0.15,
    operationReserve: 0.25,
    historyRequestsPerDay: 1000,
    requestCacheHitRate: 0.95,
    extraShardScratchBytes: 2000000,
    shardSkew: 0.25,
    postgresStorageMultiplier: 1.5,
  },
  results: {},
};
for (const [mode, v] of Object.entries(measured.results) as [string, any][]) {
  const beforeTables = v.before.objects.filter(
    (o: any) =>
      o.type === 'table' && !['editorial_blob_fragments', 'editorial_blob_packs'].includes(o.name),
  );
  for (const original of beforeTables) {
    const current = v.after.objects.find((o: any) => o.name === original.name);
    if (current?.rows !== original.rows) throw Error(`Record count regression: ${original.name}`);
  }
  if (v.after.ownedBytes >= v.before.ownedBytes) throw Error('Owned-page regression');
  const base = prior.projections[mode],
    optimization = v.optimization;
  const daily = Math.max(0, base.dailyOwnedBytes + v.after.ownedBytes - v.before.ownedBytes);
  const legacyDaily =
    base.dailyOwnedBytes + optimization.legacyAfter.ownedBytes - v.before.ownedBytes;
  const recovery =
    Math.max(0, optimization.copied.ownedBytes - v.after.ownedBytes) +
    Math.max(0, v.withRecovery.ownedBytes - optimization.legacyAfter.ownedBytes);
  const initial =
    base.initialBytesIncludingOriginalPocAnd2MBScratch +
    Math.max(0, v.before.ownedBytes - (mode === 'compact' ? 2314240 : 3764224));
  const rowsRead = Math.ceil(
    1.25 *
      (v.baselineMeters.read + v.archival.rowsRead + 400512 + (1000 * v.retrieval.rowsRead) / 5),
  );
  const rowsWritten = Math.ceil(1.25 * (v.baselineMeters.written + v.archival.rowsWritten + 512));
  const objectsPerHistory = v.retrieval.objectReads / 5;
  const rawLogical = v.after.objects
    .filter((o: any) => o.type === 'table')
    .reduce(
      (n: number, o: any) =>
        n + Object.values(o.columnBytes ?? {}).reduce((s: number, b: any) => s + b, 0),
      0,
    );
  const logicalDaily = rawLogical; // Explicit planning allowance, not PostgreSQL measurement.
  const projections: any = {};
  for (const d of [30, 90, 180, 365, 730, 1095, 1825]) {
    const cold = Math.max(0, d - 30);
    const d1 = Math.ceil(
      initial +
        1.15 *
          (base.dailyOwnedBytes * Math.min(30, d) + daily * cold + recovery * Math.min(7, cold)),
    );
    const r2 = Math.ceil((v.archival.objectBytes + optimization.packBytes) * cold * 1.25);
    const legacy = Math.ceil(
      initial +
        1.15 *
          (base.dailyOwnedBytes * Math.min(30, d) +
            legacyDaily * cold +
            Math.max(0, v.withRecovery.ownedBytes - optimization.legacyAfter.ownedBytes) *
              Math.min(7, cold)),
    );
    const choices: any = {};
    for (const shards of [1, 2, 3])
      choices[String(shards)] = {
        totalD1Bytes: d1 + 2000000 * (shards - 1),
        idealMaxDatabaseBytes: Math.ceil(d1 / shards) + 2000000 * (shards > 1 ? 1 : 0),
        skewedMaxDatabaseBytes:
          Math.ceil((d1 / shards) * (shards === 1 ? 1 : 1.25)) + 2000000 * (shards > 1 ? 1 : 0),
        dailyD1ReadsLowerBound: rowsRead,
        dailyD1WritesLowerBound: rowsWritten,
        dailyD1ReadsWithWorstCaseSelectionScan:
          rowsRead +
          Math.ceil(
            1.25 * (optimization.packs + 1) * optimization.retiredBodies * Math.max(0, d - 31),
          ),
        r2Bytes: r2,
        workerCpu: 'UNMEASURED; local host CPU cannot qualify Worker limit',
        operationalComplexity:
          shards === 1
            ? 'One relational graph; private object dependency'
            : 'Unimplemented routing, cross-shard relationships, coordinated backups/restore; account operations unchanged',
      };
    choices.postgresql = {
      planningStorageBytes: Math.ceil(initial + 1.5 * logicalDaily * d),
      dailyD1Reads: 0,
      dailyD1Writes: 0,
      estimatedDatabaseRowsReadAt95PercentCacheHit: Math.ceil(rowsRead * 0.05),
      databaseRowsWritten: rowsWritten,
      r2Bytes: r2,
      workerCpu: 'UNMEASURED; cache miss/origin latency and connection pooling untested',
      operationalComplexity:
        'Hosted provider, cache invalidation, pooling, backups; no free provider selected or provisioned',
      freeTierFeasibility: 'UNVERIFIED; no universal PostgreSQL free tier',
    };
    projections[d] = { legacyD1Bytes: legacy, choices };
  }
  output.results[mode] = {
    dailyOwnedBytes: daily,
    legacyDailyOwnedBytes: legacyDaily,
    recoveryExtraPerCohortBytes: recovery,
    initialBytes: initial,
    rowsReadLowerBound: rowsRead,
    rowsWrittenLowerBound: rowsWritten,
    objectsPerHistory,
    monthlyClassA: Math.ceil(v.archival.objectWrites * 30 * 1.25),
    monthlyClassB: Math.ceil((v.archival.objectReads + 1000 * objectsPerHistory) * 30 * 1.25),
    hostCpuMs: v.archival.hostCpuMs,
    projections,
    warnings: [
      'Selection/reachability scans grow with retained history; one-cohort row counts are lower bounds at later horizons.',
      'R2 keeps all encoded bytes; hot blob offload after 30 days assumes a separately approved retention/retirement policy. Runtime never evicts originals.',
      'PostgreSQL multiplier is a planning sensitivity against SQLite logical bytes; it is not a PostgreSQL benchmark.',
    ],
  };
}
await writeFile(
  'measurements/storage-final-projection.json',
  JSON.stringify(output, null, 2) + '\n',
);
console.log(JSON.stringify(output, null, 2));
