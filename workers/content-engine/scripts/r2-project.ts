import { readFile, writeFile } from 'node:fs/promises';
const benchmark = JSON.parse(await readFile('measurements/r2-archival-benchmark.json', 'utf8'));
const prior = JSON.parse(await readFile('measurements/storage-projection.json', 'utf8'));
const days = [30, 90, 180, 365];
const results = Object.fromEntries(
  Object.entries(benchmark.results).map(([mode, v]: [string, any]) => {
    const base = prior.projections[mode];
    const delta = v.after.ownedBytes - v.before.ownedBytes;
    const daily = Math.max(0, base.dailyOwnedBytes + delta);
    const recoveryExtra = Math.max(0, v.withRecovery.ownedBytes - v.after.ownedBytes);
    const initial =
      base.initialBytesIncludingOriginalPocAnd2MBScratch +
      Math.max(0, v.before.ownedBytes - (mode === 'compact' ? 2314240 : 3764224));
    const projections = Object.fromEntries(
      days.map((d) => [
        d,
        {
          d1ConservativeAllocatedBudgetBytes: Math.ceil(
            initial +
              1.15 *
                (base.dailyOwnedBytes * Math.min(d, 30) +
                  daily * Math.max(0, d - 30) +
                  recoveryExtra * Math.min(7, Math.max(0, d - 30))),
          ),
          r2RetainedBytes: Math.ceil(v.archival.objectBytes * Math.max(0, d - 30) * 1.25),
          archivePutsPer30Days: v.archival.objectWrites * 30 * 1.25,
        },
      ]),
    );
    return [
      mode,
      {
        dailyBaselineOwnedBytes: base.dailyOwnedBytes,
        measuredArchivalOwnedDelta: delta,
        dailyPostArchiveOwnedBytes: daily,
        initialBytes: initial,
        recoveryExtraPerCohortBytes: recoveryExtra,
        projections,
        d1DailyRowsReadWith25PercentReserve: Math.ceil(
          1.25 * (v.baselineMeters.read + v.archival.rowsRead + 400512),
        ),
        d1DailyRowsWrittenWith25PercentReserve: Math.ceil(
          1.25 * (v.baselineMeters.written + v.archival.rowsWritten + 512),
        ),
        result:
          (projections[365] as any).d1ConservativeAllocatedBudgetBytes < 350000000
            ? 'Synthetic storage model fits; production limits unverified'
            : 'FAIL: 365-day D1 storage target not met',
      },
    ];
  }),
);
await writeFile(
  'measurements/r2-archival-projection.json',
  JSON.stringify(
    {
      scope:
        'Extrapolation, not a year-long test. Same prior launch-day cohort; active NEW candidates, pinned evidence, current stories/videos and newest editions stay hot. Thirty-day hot policy, seven-day recovery, fifteen-percent page-growth reserve and twenty-five-percent R2 retry reserve. Freed pages are reusable, not proof of immediate file shrink. Small cohorts and conservative current-record retention can overstate long-term overhead; no deletion of required content assumed.',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(results, null, 2));
