import { readFile, writeFile } from 'node:fs/promises';
const measured = JSON.parse(await readFile('measurements/storage-benchmark.json', 'utf8'));
const original = JSON.parse(await readFile('measurements/local-benchmark.json', 'utf8'));
const days = [30, 90, 180, 365];
const fixedTables = new Set([
  'sqlite_schema',
  '_cf_METADATA',
  'teams',
  'content_sources',
  'source_teams',
  'source_checkpoints',
  'content_control',
  'transaction_assertions',
  'video_source_registry',
]);
function project(sample: any) {
  const fixed = sample.physical.objects.reduce(
    (s: number, o: any) => s + (fixedTables.has(o.name) ? o.bytes : 4096),
    0,
  );
  const dailyOwned = Math.max(0, sample.physical.ownedBytes - fixed);
  // 15% reserve for future B-tree packing/fragmentation; preserve original POC allocation.
  const dailyBytes = Math.ceil(dailyOwned * 1.15),
    start = original.sqliteBytes + fixed + 2000000;
  return {
    measuredPhysicalBytes: sample.physical.sqliteBytes,
    measuredOwnedBytes: sample.physical.ownedBytes,
    fixedBytes: fixed,
    dailyOwnedBytes: dailyOwned,
    dailyBytesWith15PercentReserve: dailyBytes,
    initialBytesIncludingOriginalPocAnd2MBScratch: start,
    projections: Object.fromEntries(days.map((d) => [d, start + dailyBytes * d])),
    daysTo500MB: (500000000 - start) / dailyBytes,
  };
}
const projections = Object.fromEntries(
  Object.entries(measured.results).map(([mode, x]) => [mode, project(x)]),
);
const base = projections.compact as ReturnType<typeof project>;
const dailyRows = {
  read: Math.ceil((measured.results.compact.totals.read + 300000 + 100000 + 512) * 1.25),
  written: Math.ceil((measured.results.compact.totals.written + 512) * 1.25),
};
const alternatives = Object.fromEntries(
  days.map((d) => {
    const single = base.projections[d];
    // Architectural planning scenarios only: no multi-D1, R2 or Postgres implementation/benchmark.
    const multi = single * 1.1 + 5000000;
    const hot =
      base.initialBytesIncludingOriginalPocAnd2MBScratch +
      base.dailyBytesWith15PercentReserve * (0.35 * d + 0.65 * Math.min(d, 30));
    const cold = base.dailyBytesWith15PercentReserve * 0.65 * Math.max(0, d - 30);
    return [
      d,
      {
        singleD1: single,
        multipleD1: {
          total: Math.ceil(multi),
          editorial: Math.ceil(multi * 0.3),
          history: Math.ceil(multi * 0.4),
          operations: Math.ceil(multi * 0.3),
        },
        d1R2: { d1: Math.ceil(hot), r2: Math.ceil(cold) },
        postgres: {
          planningLower: Math.ceil(single),
          planningUpper: Math.ceil(
            (projections.inline as ReturnType<typeof project>).projections[d] * 1.5,
          ),
        },
      },
    ];
  }),
);
const output = {
  scope:
    'Extrapolation of one full synthetic day, not a 365-day load test or deployed billing measurement. Fixed root pages allocated once. Growing pages retain all records. 15% growth reserve plus original POC and 2MB scratch; hot/cold and multi-DB allocations are assumptions.',
  publishedQuotas: {
    d1PerDatabaseBytes: 500000000,
    d1AccountBytes: 5000000000,
    d1FreeDatabases: 10,
    d1ReadsPerDay: 5000000,
    d1WritesPerDay: 100000,
    workerFreeRequestsPerDay: 100000,
    workerCpuMs: 10,
  },
  projections,
  dailyRowsWith25PercentReserve: dailyRows,
  alternatives,
  alternativeAssumptions: {
    multipleD1:
      '10% duplication/index overhead plus 5MB; 30/40/30 partition is an unimplemented allocation scenario, not measured per-domain placement. Account reads +20%, writes +10%.',
    d1R2: '35% permanently indexed hot bytes, 65% eligible for cold object storage after 30 days. Keep identity/attribution directory in hot share. No lifecycle deletion. D1 rows assumed equal to single baseline conservatively, R2 adds ~250 puts/day and <=1000 gets/day.',
    postgres:
      'Storage range is optimized SQLite lower planning bound to inline SQLite x1.5, not measured Postgres/TOAST. Caching saves reads, not retained bytes. Same logical workload, physical WAL/index writes unmeasured.',
  },
  decision: {
    singleDatabaseYear:
      base.projections[365] <= 500000000
        ? 'Conditional synthetic storage fit only; CPU/queries/quotas remain unqualified'
        : 'FAIL: optimized single database exceeds 500MB before 365 days; retain all history and do not certify $0 launch',
    production:
      'No account telemetry, remote database access, provisioning, deployment or migration authorized/performed',
  },
};
await writeFile('measurements/storage-projection.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ projections, dailyRows, alternatives }, null, 2));
